package app.volna.player;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    /** Последний нативный сбой (читается через SyncPlugin.getCrashLog) */
    public static final String CRASH_FILE = "crash-last.txt";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerCrashHandler();
        registerPlugin(VolnaYtdlPlugin.class);
        registerPlugin(SyncPlugin.class);
        super.onCreate(savedInstanceState);
        // Контент не рисуется под статус-баром и жест-баром (страховка edge-to-edge)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && getWindow() != null) {
            getWindow().setDecorFitsSystemWindows(true);
        }
        requestNotificationsIfNeeded();
    }

    /** Любой непойманный сбой пишем в files/crash-last.txt — его можно прислать из «Настроек» */
    private void registerCrashHandler() {
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, e) -> {
            try {
                PrintWriter pw = new PrintWriter(new FileWriter(new File(getFilesDir(), CRASH_FILE), false));
                pw.println("time: " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()));
                pw.println("thread: " + thread.getName());
                pw.println(Log.getStackTraceString(e));
                pw.close();
            } catch (Exception ignore) {
            }
            if (prev != null) prev.uncaughtException(thread, e);
        });
    }

    /** Android 13+: без разрешения уведомление плеера в шторке не показывается */
    private void requestNotificationsIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4242);
        }
    }
}
