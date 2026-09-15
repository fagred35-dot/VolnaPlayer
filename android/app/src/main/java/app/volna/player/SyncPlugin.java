package app.volna.player;

import android.app.WallpaperManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.wifi.WifiManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.InetAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;

/**
 * Помощники синхронизации и системных функций:
 *  - getIp      — локальный IPv4 в Wi-Fi-сети (для скана подсети);
 *  - listAudio  — вся аудиобиблиотека устройства через MediaStore («Вся музыка»);
 *  - getAppVersion / getCrashLog / clearCrashLog — версия сборки и последний
 *    нативный сбой (экран «О приложении»);
 *  - setWallpaper / restoreWallpaper — обои из обложки трека (MusWall-style:
 *    пока играет трек — обои = обложка, на паузе — возврат стандартных);
 *  - startDiscovery / getDiscovered / stopDiscovery — UDP-слушатель анонсов ПК
 *    (поиск устройств как в LocalSend, вместо слепого скана подсети).
 */
@CapacitorPlugin(name = "SyncPlugin")
public class SyncPlugin extends Plugin {

    private static final int DISCOVERY_PORT = 51789;
    private static final String MULTICAST_ADDR = "224.0.0.167";
    private static final String WALLPAPER_BACKUP = "wallpaper-backup.jpg";

    private volatile MulticastSocket discoverySocket;
    private volatile Thread discoveryThread;
    private volatile JSObject discoveredPc;
    private WifiManager.MulticastLock multicastLock;

    /* ---------- сеть: локальный IPv4 ---------- */

    @PluginMethod
    public void getIp(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ip", findLocalIp());
        call.resolve(ret);
    }

    /* ---------- MediaStore: вся аудиобиблиотека устройства ---------- */

    @PluginMethod
    public void listAudio(PluginCall call) {
        JSArray tracks = new JSArray();
        try {
            String[] projection = {
                    android.provider.MediaStore.Audio.Media._ID,
                    android.provider.MediaStore.Audio.Media.DATA,
                    android.provider.MediaStore.Audio.Media.TITLE,
                    android.provider.MediaStore.Audio.Media.ARTIST,
                    android.provider.MediaStore.Audio.Media.ALBUM,
                    android.provider.MediaStore.Audio.Media.DURATION,
                    android.provider.MediaStore.Audio.Media.SIZE
            };
            String selection = android.provider.MediaStore.Audio.Media.DURATION + " >= ?";
            String[] selectionArgs = { "500" }; // 0.5 секунды — отсечь звуки уведомлений
            android.database.Cursor c = getContext().getContentResolver().query(
                    android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                    projection, selection, selectionArgs,
                    android.provider.MediaStore.Audio.Media.TITLE + " COLLATE NOCASE ASC");
            if (c != null) {
                while (c.moveToNext()) {
                    String path = c.getString(1);
                    if (path == null || path.isEmpty()) continue;
                    JSObject t = new JSObject();
                    t.put("path", path);
                    t.put("title", safe(c.getString(2), fileName(path)));
                    t.put("artist", safe(c.getString(3), ""));
                    t.put("album", safe(c.getString(4), ""));
                    t.put("duration", c.getLong(5) / 1000L);
                    t.put("size", c.getLong(6));
                    tracks.put(t);
                }
                c.close();
            }
        } catch (Exception e) {
            call.reject("MediaStore query failed: " + e.getMessage());
            return;
        }
        JSObject ret = new JSObject();
        ret.put("tracks", tracks);
        call.resolve(ret);
    }

    /* ---------- версия сборки ---------- */

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        JSObject ret = new JSObject();
        String version = "";
        long build = 0;
        try {
            PackageInfo pi = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0);
            version = pi.versionName == null ? "" : pi.versionName;
            build = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? pi.getLongVersionCode()
                    : pi.versionCode;
        } catch (Exception ignore) {
            /* остаёмся с пустыми значениями */
        }
        ret.put("version", version);
        ret.put("build", build);
        call.resolve(ret);
    }

    /* ---------- журнал последнего нативного сбоя ---------- */

    @PluginMethod
    public void getCrashLog(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", readCrashFile(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void clearCrashLog(PluginCall call) {
        boolean ok = false;
        try {
            ok = new File(getContext().getFilesDir(), MainActivity.CRASH_FILE).delete();
        } catch (Exception ignore) {
            /* нет файла — уже чисто */
        }
        JSObject ret = new JSObject();
        ret.put("ok", ok);
        call.resolve(ret);
    }

    private static String readCrashFile(Context ctx) {
        try {
            File f = new File(ctx.getFilesDir(), MainActivity.CRASH_FILE);
            if (!f.exists()) return "";
            FileInputStream in = new FileInputStream(f);
            byte[] buf = new byte[(int) Math.min(f.length(), 40000)];
            int n = in.read(buf);
            in.close();
            return n > 0 ? new String(buf, 0, n, StandardCharsets.UTF_8) : "";
        } catch (Exception e) {
            return "";
        }
    }

    /* ---------- обои из обложки трека ---------- */

    /**
     * path — абсолютный путь к готовому кадру (JS уже отмасштабировал и размыл);
     * target — "system" | "lock" | "both". Перед первой установкой текущие
     * системные обои бэкапятся в filesDir — их вернёт restoreWallpaper().
     */
    @PluginMethod
    public void setWallpaper(PluginCall call) {
        String path = call.getString("path", "");
        String target = call.getString("target", "both");
        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }
        Context ctx = getContext();
        Bitmap bmp = decodeCover(path, ctx);
        if (bmp == null) {
            call.reject("cannot decode image: " + path);
            return;
        }
        try {
            backupWallpaperIfNeeded(ctx);
        } catch (Exception ignore) {
            /* бэкап не критичен: без него restore просто вернёт ok:false */
        }
        int flags = WallpaperManager.FLAG_SYSTEM;
        if ("lock".equals(target) || "both".equals(target) && Build.VERSION.SDK_INT >= 24) {
            flags |= WallpaperManager.FLAG_LOCK;
        }
        WallpaperManager wm = WallpaperManager.getInstance(ctx);
        boolean ok = false;
        String error = null;
        try {
            wm.setBitmap(bmp, null, true, flags);
            ok = true;
        } catch (Exception e) {
            error = String.valueOf(e.getMessage());
            if (flags != WallpaperManager.FLAG_SYSTEM) {
                // часть прошивок не даёт менять экран блокировки — пробуем хотя бы домашний
                try {
                    wm.setBitmap(bmp, null, true, WallpaperManager.FLAG_SYSTEM);
                    ok = true;
                    error = null;
                } catch (Exception e2) {
                    error = error + "; " + e2.getMessage();
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("ok", ok);
        if (error != null) ret.put("error", error);
        call.resolve(ret);
    }

    /** Вернуть стандартные обои из бэкапа (вызывается на паузе/остановке) */
    @PluginMethod
    public void restoreWallpaper(PluginCall call) {
        Context ctx = getContext();
        File backup = new File(ctx.getFilesDir(), WALLPAPER_BACKUP);
        JSObject ret = new JSObject();
        if (!backup.exists()) {
            ret.put("ok", false);
            ret.put("restored", false);
            call.resolve(ret);
            return;
        }
        Bitmap bmp = BitmapFactory.decodeFile(backup.getAbsolutePath());
        boolean ok = false;
        if (bmp != null) {
            WallpaperManager wm = WallpaperManager.getInstance(ctx);
            int flags = WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK;
            try {
                wm.setBitmap(bmp, null, true, flags);
                ok = true;
            } catch (Exception e) {
                try {
                    wm.setBitmap(bmp, null, true, WallpaperManager.FLAG_SYSTEM);
                    ok = true;
                } catch (Exception ignore) {
                    /* не смогли — обои остаются как есть */
                }
            }
        }
        if (ok) {
            // бэкап возвращён — следующий setWallpaper снимет новый (уже стандартный)
            backup.delete();
        }
        ret.put("ok", ok);
        ret.put("restored", ok);
        call.resolve(ret);
    }

    /** Бэкап текущих системных обоев — один раз, до первой замены */
    private static void backupWallpaperIfNeeded(Context ctx) throws Exception {
        File f = new File(ctx.getFilesDir(), WALLPAPER_BACKUP);
        if (f.exists()) return;
        WallpaperManager wm = WallpaperManager.getInstance(ctx);
        Drawable d = wm.getDrawable();
        if (d == null) return;
        int w = d.getIntrinsicWidth() > 0 ? d.getIntrinsicWidth() : 1080;
        int h = d.getIntrinsicHeight() > 0 ? d.getIntrinsicHeight() : 1920;
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        d.setBounds(0, 0, w, h);
        d.draw(c);
        FileOutputStream out = new FileOutputStream(f);
        bmp.compress(Bitmap.CompressFormat.JPEG, 90, out);
        out.close();
    }

    /** Декодирует кадр и приводит к размеру обоев (crop по центру) */
    private static Bitmap decodeCover(String path, Context ctx) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
        WallpaperManager wm = WallpaperManager.getInstance(ctx);
        int wantW = Math.max(720, wm.getDesiredMinimumWidth());
        int wantH = Math.max(1280, wm.getDesiredMinimumHeight());
        int sample = 1;
        while (bounds.outWidth / (sample * 2) >= wantW && bounds.outHeight / (sample * 2) >= wantH) {
            sample *= 2;
        }
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap src = BitmapFactory.decodeFile(path, opts);
        if (src == null) return null;
        int sw = src.getWidth(), sh = src.getHeight();
        float scale = Math.max(wantW / (float) sw, wantH / (float) sh);
        int cw = Math.min(sw, Math.round(wantW / scale));
        int ch = Math.min(sh, Math.round(wantH / scale));
        int x = Math.max(0, (sw - cw) / 2);
        int y = Math.max(0, (sh - ch) / 2);
        Bitmap cropped = Bitmap.createBitmap(src, x, y, cw, ch);
        if (cw == wantW && ch == wantH) return cropped;
        return Bitmap.createScaledBitmap(cropped, wantW, wantH, true);
    }

    /* ---------- UDP-поиск ПК: слушаем анонсы sync-server ---------- */

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        Thread t = discoveryThread;
        if (t != null && t.isAlive()) {
            call.resolve();
            return;
        }
        try {
            WifiManager wmi = (WifiManager) getContext().getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            if (wmi != null) {
                // Android режет multicast на Wi-Fi без MulticastLock
                multicastLock = wmi.createMulticastLock("volna-sync");
                multicastLock.setReferenceCounted(false);
                multicastLock.acquire();
            }
        } catch (Exception ignore) {
            /* без lock — multicast может не дойти, broadcast всё равно ловится */
        }
        discoveredPc = null;
        JSObject ret = new JSObject();
        try {
            final MulticastSocket socket = new MulticastSocket(DISCOVERY_PORT);
            socket.setBroadcast(true);
            try {
                socket.joinGroup(InetAddress.getByName(MULTICAST_ADDR));
            } catch (Exception ignore) {
                /* нет multicast-маршрута — broadcast-анонсы всё равно ловятся */
            }
            discoverySocket = socket;
            Thread listener = new Thread(() -> {
                byte[] buf = new byte[4096];
                while (!socket.isClosed()) {
                    try {
                        DatagramPacket p = new DatagramPacket(buf, buf.length);
                        socket.receive(p);
                        String s = new String(p.getData(), p.getOffset(), p.getLength(), StandardCharsets.UTF_8);
                        JSONObject j = new JSONObject(s);
                        if (!"volna".equals(j.optString("app"))) continue;
                        if (!"pc".equals(j.optString("deviceType"))) continue;
                        String deviceId = j.optString("deviceId", "");
                        if (deviceId.isEmpty()) continue;
                        JSObject pc = new JSObject();
                        pc.put("ip", p.getAddress().getHostAddress());
                        pc.put("port", j.optInt("port", DISCOVERY_PORT));
                        pc.put("deviceId", deviceId);
                        pc.put("name", j.optString("deviceName", "ПК"));
                        pc.put("seenAt", System.currentTimeMillis());
                        discoveredPc = pc;
                    } catch (Exception e) {
                        if (socket.isClosed()) break;
                    }
                }
            }, "volna-discovery");
            listener.setDaemon(true);
            listener.start();
            discoveryThread = listener;
            ret.put("ok", true);
        } catch (Exception e) {
            ret.put("ok", false);
            ret.put("error", String.valueOf(e.getMessage()));
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void getDiscovered(PluginCall call) {
        JSObject ret = new JSObject();
        JSObject pc = discoveredPc;
        if (pc != null) ret.put("pc", pc);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        closeDiscovery();
        call.resolve();
    }

    private void closeDiscovery() {
        try {
            if (discoverySocket != null) discoverySocket.close();
        } catch (Exception ignore) {
            /* уже закрыт */
        }
        discoverySocket = null;
        discoveryThread = null;
        try {
            if (multicastLock != null) multicastLock.release();
        } catch (Exception ignore) {
            /* уже снят */
        }
        multicastLock = null;
    }

    /* ---------- helpers ---------- */

    private static String safe(String v, String fallback) {
        return v == null || v.isEmpty() ? fallback : v;
    }

    private static String fileName(String path) {
        int i = path.lastIndexOf('/');
        return i >= 0 ? path.substring(i + 1) : path;
    }

    private static String findLocalIp() {
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            String fallback = null;
            while (nis.hasMoreElements()) {
                NetworkInterface ni = nis.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress a = addrs.nextElement();
                    if (!a.isSiteLocalAddress()) continue;
                    String host = a.getHostAddress();
                    if (host == null || host.contains(":")) continue;
                    // предпочтителен wlan0 (192.168.x.x)
                    if (host.startsWith("192.168.")) return host;
                    if (fallback == null) fallback = host;
                }
            }
            return fallback;
        } catch (SocketException e) {
            return null;
        }
    }
}
