package app.volna.player;

import android.content.Context;
import android.os.Environment;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import java.io.File;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/**
 * Встроенный загрузчик музыки: yt-dlp + FFmpeg через youtubedl-android
 * (тот же движок, что в YTDLnis). Отдаёт в WebView события progress/done/error,
 * умеет искать треки на YouTube (ytsearch) и читать метаданные ссылки.
 */
@CapacitorPlugin(name = "VolnaYtdl")
public class VolnaYtdlPlugin extends Plugin {

    private final AtomicBoolean initialized = new AtomicBoolean(false);
    private volatile String activeProcessId = null;

    /** Однократная инициализация python + yt-dlp + ffmpeg (медленная, кешируется) */
    private synchronized boolean ensureInit() {
        if (initialized.get()) return true;
        try {
            Context ctx = getContext().getApplicationContext();
            YoutubeDL.getInstance().init(ctx);
            FFmpeg.getInstance().init(ctx);
            try {
                // свежий yt-dlp с GitHub; без сети остаётся вшитая версия
                YoutubeDL.getInstance().updateYoutubeDL(ctx, YoutubeDL.UpdateChannel._STABLE);
            } catch (Exception ignored) {
                // оффлайн — работаем на вшитой версии
            }
            initialized.set(true);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private File downloadDir(String destDir) {
        if (destDir != null && !destDir.trim().isEmpty()) return new File(destDir);
        Context ctx = getContext().getApplicationContext();
        File dir = new File(ctx.getExternalFilesDir(Environment.DIRECTORY_MUSIC), "Volna");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    @PluginMethod
    public void start(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("url required");
            return;
        }
        final String destDir = call.getString("destDir");
        final String processId = UUID.randomUUID().toString();
        activeProcessId = processId;
        Thread t = new Thread(() -> {
            if (!ensureInit()) {
                notifyListeners("error", errorData("Не удалось инициализировать загрузчик"));
                return;
            }
            try {
                File dir = downloadDir(destDir);
                long before = System.currentTimeMillis();
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                req.addOption("-f", "bestaudio[ext=m4a]/bestaudio/best");
                req.addOption("--extract-audio");
                req.addOption("--audio-format", "mp3");
                req.addOption("--audio-quality", "0");
                req.addOption("--embed-thumbnail");
                req.addOption("--add-metadata");
                req.addOption("--no-playlist");
                req.addOption("--no-mtime");
                req.addOption("-o", new File(dir, "%(title)s.%(ext)s").getAbsolutePath());
                YoutubeDLResponse resp = YoutubeDL.getInstance().execute(req, processId, (progress, eta, line) -> {
                    JSObject data = new JSObject();
                    data.put("percent", progress.doubleValue());
                    data.put("status", line == null ? "" : line);
                    notifyListeners("progress", data);
                    return kotlin.Unit.INSTANCE;
                });
                File produced = findNewestAudio(dir, before);
                JSObject done = new JSObject();
                if (produced != null) {
                    done.put("path", produced.getAbsolutePath());
                    String name = produced.getName();
                    done.put("title", name.replaceAll("\\.(mp3|m4a|opus|ogg|wav)$", ""));
                } else {
                    done.put("path", "");
                    String out = resp.getOut();
                    done.put("title", out == null || out.isEmpty() ? url : url);
                }
                notifyListeners("done", done);
            } catch (YoutubeDL.CanceledException e) {
                notifyListeners("error", errorData("canceled"));
            } catch (Exception e) {
                String msg = e.getMessage() == null ? "download failed" : e.getMessage();
                notifyListeners("error", errorData(msg));
            } finally {
                if (processId.equals(activeProcessId)) activeProcessId = null;
            }
        }, "volna-ytdl-start");
        t.setPriority(Thread.NORM_PRIORITY - 1);
        t.start();
        call.resolve();
    }

    /** поиск на YouTube: до 8 результатов по названию */
    @PluginMethod
    public void search(PluginCall call) {
        final String query = call.getString("query");
        if (query == null || query.trim().isEmpty()) {
            call.resolve();
            return;
        }
        Thread t = new Thread(() -> {
            JSObject res = new JSObject();
            JSArray results = new JSArray();
            if (ensureInit()) {
                try {
                    YoutubeDLRequest req = new YoutubeDLRequest("ytsearch8:" + query);
                    req.addOption("--flat-playlist");
                    req.addOption("--dump-json");
                    req.addOption("--no-warnings");
                    YoutubeDLResponse resp = YoutubeDL.getInstance().execute(req);
                    String out = resp.getOut();
                    if (out != null) {
                        for (String line : out.split("\n")) {
                            String s = line.trim();
                            if (!s.startsWith("{")) continue;
                            try {
                                JSONObject o = new JSONObject(s);
                                JSONObject item = new JSONObject();
                                String vid = o.optString("id", "");
                                item.put("url", vid.isEmpty() ? o.optString("url", "") : "https://www.youtube.com/watch?v=" + vid);
                                item.put("title", o.optString("title", ""));
                                String ch = o.optString("channel", "");
                                if (ch.isEmpty()) ch = o.optString("uploader", "");
                                item.put("channel", ch);
                                item.put("duration", (double) o.optLong("duration", 0));
                                String thumb = "";
                                JSONObject thumbs = o.optJSONObject("thumbnail");
                                if (thumbs != null) thumb = thumbs.optString("url", "");
                                item.put("thumb", thumb.isEmpty() ? null : thumb);
                                results.put(item);
                            } catch (Exception ignored) {
                                // битая строка — пропускаем
                            }
                        }
                    }
                } catch (Exception ignored) {
                    // поиск не удался — вернём пустой список
                }
            }
            res.put("results", results);
            call.resolve(res);
        }, "volna-ytdl-search");
        t.start();
    }

    /** метаданные ссылки без скачивания */
    @PluginMethod
    public void meta(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.resolve();
            return;
        }
        Thread t = new Thread(() -> {
            if (!ensureInit()) {
                call.resolve();
                return;
            }
            try {
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                req.addOption("--dump-json");
                req.addOption("--skip-download");
                req.addOption("--no-playlist");
                YoutubeDLResponse resp = YoutubeDL.getInstance().execute(req);
                String out = resp.getOut();
                if (out != null) {
                    for (String line : out.split("\n")) {
                        String s = line.trim();
                        if (!s.startsWith("{")) continue;
                        try {
                            JSONObject o = new JSONObject(s);
                            JSObject m = new JSObject();
                            m.put("title", o.optString("title", null));
                            String ch = o.optString("channel", "");
                            if (ch.isEmpty()) ch = o.optString("uploader", "");
                            m.put("channel", ch);
                            m.put("duration", (double) o.optLong("duration", 0));
                            String thumb = "";
                            JSONObject thumbs = o.optJSONObject("thumbnail");
                            if (thumbs != null) thumb = thumbs.optString("url", "");
                            m.put("thumb", thumb.isEmpty() ? null : thumb);
                            call.resolve(m);
                            return;
                        } catch (Exception ignored) {
                            // битый JSON — пропускаем
                        }
                    }
                }
                call.resolve();
            } catch (Exception e) {
                call.resolve();
            }
        }, "volna-ytdl-meta");
        t.start();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            String id = activeProcessId;
            if (id != null) YoutubeDL.getInstance().destroyProcessById(id);
        } catch (Exception ignored) {
            // нечего отменять
        }
        call.resolve();
    }

    private JSObject errorData(String message) {
        JSObject d = new JSObject();
        d.put("message", message);
        return d;
    }

    /** самый свежий аудиофайл в папке, появившийся после startedAt */
    private File findNewestAudio(File dir, long startedAt) {
        File best = null;
        File[] files = dir.listFiles();
        if (files == null) return null;
        for (File f : files) {
            String n = f.getName().toLowerCase();
            boolean audio = n.endsWith(".mp3") || n.endsWith(".m4a") || n.endsWith(".opus") || n.endsWith(".ogg") || n.endsWith(".wav");
            if (!audio || !f.isFile()) continue;
            if (f.lastModified() < startedAt) continue;
            if (best == null || f.lastModified() > best.lastModified()) best = f;
        }
        return best;
    }
}
