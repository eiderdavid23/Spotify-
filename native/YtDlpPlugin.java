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
import java.lang.reflect.Method;

@CapacitorPlugin(name = "YtDlp")
public class YtDlpPlugin extends Plugin {

    private static final String[] CLIENTES = { "android_vr,web_safari", "tv", "web" };

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
                for (int i = 0; i + 1 < extra.length; i += 2) {
                    req.addOption(extra[i], extra[i + 1]);
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

    @Override
    public void load() {
        try {
            YoutubeDL.getInstance().init(getContext());
            FFmpeg.getInstance().init(getContext());
        } catch (Exception e) {
            throw new RuntimeException("yt-dlp no inicializo: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void search(PluginCall call) {
        final String q = call.getString("q");
        new Thread(() -> {
            try {
                YoutubeDLRequest req = new YoutubeDLRequest("ytsearch25:" + q);
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
                YoutubeDL.getInstance().execute(req, id, (progress, eta) -> {
                    JSObject p = new JSObject();
                    p.put("progress", progress);
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
                Class<?> uc = Class.forName("com.yausername.youtubedl_android.YoutubeDL$UpdateChannel");
                Object[] cs = uc.getEnumConstants();
                Object elegido = cs[0];
                for (Object c : cs) {
                    if (String.valueOf(c).toUpperCase().contains("STABLE")) { elegido = c; break; }
                }
                Method m = YoutubeDL.class.getMethod("updateYoutubeDL", android.content.Context.class, uc);
                m.invoke(YoutubeDL.getInstance(), getContext(), elegido);
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void restore(PluginCall call) {
        try {
            borrar(new File(getContext().getFilesDir(), "youtubedl-android"));
            boolean forzado = false;
            for (Method m : YoutubeDL.class.getMethods()) {
                if (m.getName().equals("init") && m.getParameterTypes().length == 2
                        && m.getParameterTypes()[1] == boolean.class) {
                    m.invoke(YoutubeDL.getInstance(), getContext(), true);
                    forzado = true;
                    break;
                }
            }
            if (!forzado) YoutubeDL.getInstance().init(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
