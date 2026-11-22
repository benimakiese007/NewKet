package cd.newket.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Journaliseur persistant des événements d'appels natifs.
 * Enregistre chaque étape (FCM reçu, notification postée, service démarré, écran affiché)
 * dans les SharedPreferences pour consultation directe dans le panneau de diagnostic de l'application.
 */
public class CallDiagnosticLogger {
    private static final String TAG = "NewKetCallDiag";
    private static final String PREFS_NAME = "nk_call_debug_prefs";
    private static final String KEY_LOGS = "call_logs";
    private static final int MAX_LOGS = 60;

    public static synchronized void log(Context context, String message) {
        if (context == null) return;
        try {
            String time = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
            String entry = "[" + time + "] " + message;
            Log.d(TAG, entry);

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existing = prefs.getString(KEY_LOGS, "");
            String[] lines = existing.isEmpty() ? new String[0] : existing.split("\n");

            StringBuilder sb = new StringBuilder();
            sb.append(entry).append("\n");
            int count = 1;
            for (String l : lines) {
                if (count++ >= MAX_LOGS) break;
                sb.append(l).append("\n");
            }
            prefs.edit().putString(KEY_LOGS, sb.toString()).apply();
        } catch (Exception ignored) {}
    }

    public static synchronized String getLogs(Context context) {
        if (context == null) return "Aucun log natif.";
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getString(KEY_LOGS, "Aucun événement d'appel enregistré pour l'instant.");
        } catch (Exception e) {
            return "Erreur lecture logs: " + e.getMessage();
        }
    }

    public static synchronized void clearLogs(Context context) {
        if (context == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().remove(KEY_LOGS).apply();
        } catch (Exception ignored) {}
    }
}
