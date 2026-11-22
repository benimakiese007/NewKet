package cd.newket.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Service de premier plan pour les appels vocaux entrants.
 *
 * Pourquoi un Foreground Service ?
 * ─────────────────────────────────────────────────────────────────
 * Sur Android 12+ (et en particulier Samsung One UI 6+), les apps
 * en arrière-plan ne peuvent PAS lancer des activités directement,
 * même avec USE_FULL_SCREEN_INTENT accordée. Samsung ajoute une
 * couche de restriction supplémentaire via "Optimisation batterie".
 *
 * Un Foreground Service contourne cette restriction car :
 *   - Il est considéré comme un composant "visible" par Android
 *   - Il a le droit de lancer des activités (startActivity) depuis
 *     le background, contrairement aux BroadcastReceivers et aux
 *     services ordinaires.
 *   - Samsung ne "tue" pas les foreground services contrairement aux
 *     processus en arrière-plan silencieux.
 */
public class CallForegroundService extends Service {
    private static final String TAG = "NewKetCallFgService";

    static final String ACTION_START = "cd.newket.app.START_CALL";
    static final String ACTION_STOP  = "cd.newket.app.STOP_CALL";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        // Arrêt du service (depuis le receiver Refuser/Décrocher)
        if (ACTION_STOP.equals(intent.getAction())) {
            Log.d(TAG, "Arrêt du foreground service d'appel.");
            CallRingtoneHelper.getInstance().stopRingtoneAndVibration();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Démarrage d'un appel entrant
        String callerName  = intent.getStringExtra("caller_name");
        if (callerName == null || callerName.trim().isEmpty()) callerName = "Livreur NewKet";
        String orderId     = intent.getStringExtra("order_id");
        if (orderId == null) orderId = "";
        String callerAvatar = intent.getStringExtra("caller_avatar");

        Log.d(TAG, "Foreground service démarré — appel de " + callerName + " (commande: " + orderId + ")");
        Log.d(TAG, "--- SDK version : " + Build.VERSION.SDK_INT + " | Modèle : " + Build.MODEL + " ---");
        CallDiagnosticLogger.log(this, "🛡️ ForegroundService démarré pour " + callerName + " (#" + orderId + ")");

        // ── PendingIntent flags ───────────────────────────────────────
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // ── Intent vers IncomingCallActivity ─────────────────────────
        Intent callIntent = new Intent(this, IncomingCallActivity.class);
        callIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        callIntent.putExtra("caller_name", callerName);
        callIntent.putExtra("order_id", orderId);
        callIntent.putExtra("caller_avatar", callerAvatar);
        PendingIntent callPendingIntent = PendingIntent.getActivity(this, 0, callIntent, pendingFlags);

        // ── Action : Décrocher ────────────────────────────────────────
        Intent answerIntent = new Intent(this, CallNotificationActionReceiver.class);
        answerIntent.setAction(CallNotificationActionReceiver.ACTION_ANSWER_CALL);
        answerIntent.putExtra("order_id", orderId);
        answerIntent.putExtra("caller_name", callerName);
        PendingIntent answerPI = PendingIntent.getBroadcast(this, 1, answerIntent, pendingFlags);

        // ── Action : Refuser ──────────────────────────────────────────
        Intent declineIntent = new Intent(this, CallNotificationActionReceiver.class);
        declineIntent.setAction(CallNotificationActionReceiver.ACTION_DECLINE_CALL);
        PendingIntent declinePI = PendingIntent.getBroadcast(this, 2, declineIntent, pendingFlags);

        // ── Construction de la notification ──────────────────────────
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        Notification notification = new NotificationCompat.Builder(this, NewKetFirebaseMessagingService.CALL_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("📞 Appel de " + callerName)
                .setContentText("Appel vocal en direct • Commande #" + orderId)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setSound(ringtoneUri)
                .setVibrate(new long[]{0, 1000, 1000, 1000, 1000})
                .setColor(0xFF10B981)
                .setContentIntent(callPendingIntent)
                .setFullScreenIntent(callPendingIntent, true)
                .addAction(R.drawable.ic_call_decline, "Refuser", declinePI)
                .addAction(R.drawable.ic_call_answer, "Décrocher", answerPI)
                .build();

        // ── startForeground avant de lancer l'activité ────────────────
        Log.d(TAG, ">>> ETAPE 1 : Appel de startForeground() avec notificationId=" + CallNotificationActionReceiver.NOTIFICATION_ID);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(CallNotificationActionReceiver.NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(CallNotificationActionReceiver.NOTIFICATION_ID, notification);
            }
            Log.d(TAG, ">>> ETAPE 1 OK : startForeground() réussi avec FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK.");
            CallDiagnosticLogger.log(this, "✅ startForeground() OK (MediaPlayback)");
        } catch (Exception e) {
            Log.e(TAG, ">>> ETAPE 1 ERREUR : startForeground() a échoué : " + e.getMessage(), e);
            CallDiagnosticLogger.log(this, "❌ startForeground() ÉCHEC: " + e.getMessage());
        }

        // ── Vérification USE_FULL_SCREEN_INTENT ───────────────────────
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            android.app.NotificationManager nm = (android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            boolean canFsi = nm != null && nm.canUseFullScreenIntent();
            Log.d(TAG, ">>> INFO Android 14 : canUseFullScreenIntent() = " + canFsi);
            CallDiagnosticLogger.log(this, "ℹ️ canUseFullScreenIntent: " + canFsi);
        }

        // ── Lancer IncomingCallActivity ───────────────────────────────
        Log.d(TAG, ">>> ETAPE 2 : Lancement de IncomingCallActivity depuis le foreground service...");
        try {
            startActivity(callIntent);
            Log.d(TAG, ">>> ETAPE 2 OK : startActivity(IncomingCallActivity) appelé sans exception.");
            CallDiagnosticLogger.log(this, "🎉 startActivity(IncomingCallActivity) OK");
        } catch (android.content.ActivityNotFoundException e) {
            Log.e(TAG, ">>> ETAPE 2 ERREUR ActivityNotFound : IncomingCallActivity introuvable dans le manifest ! " + e.getMessage(), e);
            CallDiagnosticLogger.log(this, "❌ ActivityNotFoundException: " + e.getMessage());
        } catch (SecurityException e) {
            Log.e(TAG, ">>> ETAPE 2 ERREUR Security : permission refusée pour lancer l'activité. " + e.getMessage(), e);
            CallDiagnosticLogger.log(this, "❌ SecurityException (Samsung BAL): " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, ">>> ETAPE 2 ERREUR inattendue : " + e.getClass().getSimpleName() + " — " + e.getMessage(), e);
            CallDiagnosticLogger.log(this, "❌ Exception startActivity: " + e.getMessage());
        }

        // ── Sonnerie ──────────────────────────────────────────────────
        Log.d(TAG, ">>> ETAPE 3 : Démarrage sonnerie + vibration...");
        CallRingtoneHelper.getInstance().startRingtoneAndVibration(this);
        Log.d(TAG, ">>> ETAPE 3 OK : sonnerie démarrée.");

        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
