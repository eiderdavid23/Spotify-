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

@CapacitorPlugin(name = "YtDlp")
public class YtDlpPlugin extends Plugin {

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
                req.addOption("--no-warnings");
                req.addOption("--extractor-args", "youtube:player_client=android_vr,web_safari");
                req.addOption("--no-playlist");
                String out = YoutubeDL.getInstance().execute(req).getOut();
                JSObject res = new JSObject();
                res.put("json", out);
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), e);
            }
        }).start();
    }

    @PluginMethod
    public void streamUrl(PluginCall call) {
        final String url = call.getString("url");
        new Thread(() -> {
            try {
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                req.addOption("-f", "bestaudio[ext=m4a]/bestaudio");
                req.addOption("-g");
                req.addOption("--extractor-args", "youtube:player_client=android_vr,web_safari");
                req.addOption("--no-playlist");
                JSObject res = new JSObject();
                res.put("url", YoutubeDL.getInstance().execute(req).getOut().trim());
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), e);
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
                req.addOption("-x");
                req.addOption("--audio-format", "m4a");
                req.addOption("--audio-quality", "0");
                req.addOption("--embed-thumbnail");
                req.addOption("--embed-metadata");
                req.addOption("--no-playlist");
                req.addOption("--extractor-args", "youtube:player_client=android_vr,web_safari");
                req.addOption("-o", dir.getAbsolutePath() + "/" + id + ".%(ext)s");
                YoutubeDL.getInstance().execute(req, (progress, eta) -> {
                    JSObject p = new JSObject();
                    p.put("progress", progress);
                    p.put("id", id);
                    notifyListeners("downloadProgress", p);
                }, id);
                JSObject res = new JSObject();
                res.put("path", dir.getAbsolutePath() + "/" + id + ".m4a");
                call.resolve(res);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), e);
            }
        }).start();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            YoutubeDL.getInstance().destroyProcessById(call.getString("id"));
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), e);
        }
    }

    @PluginMethod
    public void restore(PluginCall call) {
        try {
            YoutubeDL.getInstance().init(getContext(), true);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), e);
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        new Thread(() -> {
            try {
                YoutubeDL.getInstance().updateYoutubeDL(getContext(), YoutubeDL.UpdateChannel.STABLE);
                call.resolve();
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()), e);
            }
        }).start();
    }
}
