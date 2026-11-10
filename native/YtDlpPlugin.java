package app.mimusica.player;

import android.os.Environment;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.ffmpeg.FFmpeg;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

@CapacitorPlugin(name = "YtDlp")
public class YtDlpPlugin extends Plugin {

    private static final String[] CLIENTES = { "android_vr,web_safari", "tv", "web" };
    private static final long ESPERA_MAX = 60000L;

    private final Object candado = new Object();
    private volatile boolean listo = false;
    private volatile String errorInit = null;

    private File cookies() {
        return new File(getContext().getFilesDir(), "cookies.txt");
    }

    private void base(YoutubeDLRequest req, String clientes) {
        req.addOption("--no-playlist");
        req.addOption("--no-warnings");
        req.addOption("--retries", "3");
        req.addOption("--extractor-args", "youtube:player_client=" + clientes);
        File c = cookies();
        if (c.exists() && c.length() > 0) req.addOption("--cookies", c.getAbsolutePath());
    }

    private String conReintentos(String url, String... extra) throws Exception {
        Exception ultimo = null;
        for (String cl : CLIENTES) {
            try {
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                base(req, cl);
                for (int i = 0; i < extra.length; i += 2) {
                    if (i + 1 < extra.length) req.addOption(extra[i], extra[i + 1]);
                    else req.addOption(extra[i]);
                }
                return YoutubeDL.getInstance().execute(req).getOut();
            } catch (Exception e) {
                ultimo = e;
            }
        }
        throw ultimo != null ? ultimo : new Exception("sin respuesta");
    }

    private void borrar(File f) {
        if (f == null || !f.exists()) return;
        File[] hijos = f.listFiles();
        if (hijos != null) for (File h : hijos) borrar(h);
        f.delete();
    }

    /* ---------- inicializacion en segundo plano ---------- */

    @Override
    public void load() {
        new Thread(() -> {
            try {
                YoutubeDL.getInstance().init(getContext());
                FFmpeg.getInstance().init(getContext());
                synchronized (candado) {
                    listo = true;
                    candado.notifyAll();
                }
            } catch (Exception e) {
                errorInit = String.valueOf(e.getMessage());
                synchronized (candado) { candado.notifyAll(); }
            }
        }, "ytdlp-init").start();
    }

    private void esperar() throws Exception {
        synchronized (candado) {
            long fin = System.currentTimeMillis() + ESPERA_MAX;
            while (!listo && errorInit == null && System.currentTimeMillis() < fin) {
                candado.wait(500);
            }
        }
        if (errorInit != null) throw new Exception("yt-dlp no inicializo: " + errorInit);
        if (!listo) throw new Exception("yt-dlp tarda demasiado en inicializar");
    }

    /* ---------- metodos ---------- */

    @PluginMethod
    public void search(PluginCall call) {
        final String q = call.getString("q");
        final int lim = Math.min(100, Math.max(1, call.getInt("limit", 50)));
        new Thread(() -> {
            try {
                esperar();
                YoutubeDLRequest req = new YoutubeDLRequest("ytsearch" + lim + ":" + q);
                req.addOption("--dump-single-json");
                req.addOption("--flat-playlist");
                base(req, CLIENTES[0]);
                JSObject res = new JSObject();
                res.put("json", YoutubeDL.getInstance().execute(req).getOut());
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void streamUrl(PluginCall call) {
        final String url = call.getString("url");
        new Thread(() -> {
            try {
                esperar();
                JSObject res = new JSObject();
                res.put("url", conReintentos(url, "-f", "bestaudio[ext=m4a]/bestaudio", "-g").trim());
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void download(PluginCall call) {
        final String url = call.getString("url");
        final String id = call.getString("id");
        new Thread(() -> {
            try {
                esperar();
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_MUSIC), "");
                dir.mkdirs();
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                base(req, "android_vr,web_safari,tv");
                req.addOption("-x");
                req.addOption("--audio-format", "m4a");
                req.addOption("--audio-quality", "0");
                req.addOption("--embed-thumbnail");
                req.addOption("--embed-metadata");
                req.addOption("-o", dir.getAbsolutePath() + "/" + id + ".%(ext)s");
                YoutubeDL.getInstance().execute(req, id, (progress, eta, linea) -> {
                    JSObject p = new JSObject();
                    p.put("progress", progress);
                    p.put("eta", eta);
                    p.put("id", id);
                    notifyListeners("downloadProgress", p);
                    return kotlin.Unit.INSTANCE;
                });
                JSObject res = new JSObject();
                res.put("path", dir.getAbsolutePath() + "/" + id + ".m4a");
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            YoutubeDL.getInstance().destroyProcessById(call.getString("id"));
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void borrarArchivo(PluginCall call) {
        try {
            File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_MUSIC), "");
            String id = call.getString("id");
            File[] hijos = dir.listFiles();
            if (hijos != null) {
                for (File h : hijos) {
                    if (h.getName().startsWith(id + ".")) h.delete();
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void setCookies(PluginCall call) {
        try {
            String t = call.getString("text", "").replace("\r\n", "\n").trim();
            if (t.length() < 20 || !t.contains("youtube.com")) {
                call.reject("Eso no parece un cookies.txt de YouTube");
                return;
            }
            FileOutputStream f = new FileOutputStream(cookies(), false);
            f.write(t.getBytes("UTF-8"));
            f.close();
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void clearCookies(PluginCall call) {
        cookies().delete();
        call.resolve();
    }

    @PluginMethod
    public void hasCookies(PluginCall call) {
        JSObject res = new JSObject();
        File c = cookies();
        res.put("value", c.exists() && c.length() > 0);
        call.resolve(res);
    }

    @PluginMethod
    public void update(PluginCall call) {
        new Thread(() -> {
            try {
                esperar();
                actualizarExtractor();
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    private void actualizarExtractor() throws Exception {
        try {
            YoutubeDL.getInstance().updateYoutubeDL(getContext(), YoutubeDL.UpdateChannel.STABLE.INSTANCE);
            return;
        } catch (NoSuchMethodError | NoClassDefFoundError ignorado) {
            // sigue por reflexion
        }
        for (Method m : YoutubeDL.class.getMethods()) {
            if (!m.getName().equals("updateYoutubeDL") || m.getParameterTypes().length != 2) continue;
            Class<?> canalClase = m.getParameterTypes()[1];
            Object canal = null;
            for (String nombre : new String[] { "_STABLE", "STABLE" }) {
                try {
                    canal = canalClase.getField(nombre).get(null);
                    break;
                } catch (Exception ignorado) {
                }
            }
            m.invoke(YoutubeDL.getInstance(), getContext(), canal);
            return;
        }
        throw new Exception("esta version del extractor no permite actualizar");
    }

    @PluginMethod
    public void restore(PluginCall call) {
        try {
            borrar(new File(getContext().getNoBackupFilesDir(), YoutubeDL.baseName));
            try {
                Field f = YoutubeDL.class.getDeclaredField("initialized");
                f.setAccessible(true);
                f.setBoolean(null, false);
            } catch (Exception ignorado) {
            }
            YoutubeDL.getInstance().init(getContext());
            FFmpeg.getInstance().init(getContext());
            synchronized (candado) {
                errorInit = null;
                listo = true;
                candado.notifyAll();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
