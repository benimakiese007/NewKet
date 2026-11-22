package cd.newket.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class NewKetFirebaseMessagingService extends MessagingService {
    private static final String TAG = "NewKetFcmService";
    static final String CALL_CHANNEL_ID = "calls_v2"; // v2 pour forcer la réinitialisation sur Samsung One UI

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        Log.d(TAG, "FCM message reçu, data: " + data);
        CallDiagnosticLogger.log(this, "📩 FCM reçu (data-size=" + data.size() + ") type=" + data.get("type"));

        String type = data.get("type");
        if ("incoming-call".equals(type) || data.containsKey("call_id")) {
            handleIncomingCall(data);
            return;
        }

        // Pour les autres notifications (commandes, chat, marketing), laisser Capacitor gérer
        super.onMessageReceived(remoteMessage);
    }

    private void handleIncomingCall(Map<String, String> data) {
        String callerName = data.get("caller_name");
        if (callerName == null || callerName.trim().isEmpty()) {
            callerName = "Livreur NewKet";
        }
        String orderId = data.get("order_id");
        if (orderId == null) orderId = "";
        String callerAvatar = data.get("caller_avatar");

        Log.d(TAG, "Appel entrant FCM reçu pour " + callerName + " (commande: " + orderId + ")");

        // 1. S'assurer que le canal de notification haute priorité v2 existe
        createCallNotificationChannel();

        // 2. PendingIntents pour l'écran et les actions
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        fullScreenIntent.putExtra("caller_name", callerName);
        fullScreenIntent.putExtra("order_id", orderId);
        fullScreenIntent.putExtra("caller_avatar", callerAvatar);
        PendingIntent fullScreenPI = PendingIntent.getActivity(this, 0, fullScreenIntent, pendingFlags);

        Intent answerIntent = new Intent(this, CallNotificationActionReceiver.class);
        answerIntent.setAction(CallNotificationActionReceiver.ACTION_ANSWER_CALL);
        answerIntent.putExtra("order_id", orderId);
        answerIntent.putExtra("caller_name", callerName);
        PendingIntent answerPI = PendingIntent.getBroadcast(this, 1, answerIntent, pendingFlags);

        Intent declineIntent = new Intent(this, CallNotificationActionReceiver.class);
        declineIntent.setAction(CallNotificationActionReceiver.ACTION_DECLINE_CALL);
        PendingIntent declinePI = PendingIntent.getBroadcast(this, 2, declineIntent, pendingFlags);

        // 3. Poster immédiatement la notification avec fullScreenIntent depuis le hook FCM
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
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
                .setContentIntent(fullScreenPI)
                .setFullScreenIntent(fullScreenPI, true)
                .addAction(R.drawable.ic_call_decline, "Refuser", declinePI)
                .addAction(R.drawable.ic_call_answer, "Décrocher", answerPI);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(CallNotificationActionReceiver.NOTIFICATION_ID, builder.build());
            Log.d(TAG, "Notification d'appel postée avec FullScreenIntent direct.");
            CallDiagnosticLogger.log(this, "🚀 Notification postée (id=" + CallNotificationActionReceiver.NOTIFICATION_ID + ") avec FullScreenIntent");
        }

        // 4. Démarrer le Foreground Service pour maintenir la sonnerie et le processus actif
        Intent serviceIntent = new Intent(this, CallForegroundService.class);
        serviceIntent.setAction(CallForegroundService.ACTION_START);
        serviceIntent.putExtra("caller_name", callerName);
        serviceIntent.putExtra("order_id", orderId);
        serviceIntent.putExtra("caller_avatar", callerAvatar);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            Log.d(TAG, "CallForegroundService démarré.");
            CallDiagnosticLogger.log(this, "▶️ CallForegroundService démarré");
        } catch (Exception e) {
            Log.e(TAG, "Erreur démarrage foreground service : " + e.getMessage(), e);
            CallDiagnosticLogger.log(this, "❌ Erreur startForegroundService: " + e.getMessage());
        }
    }

    private void createCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Supprimer l'ancien canal 'calls' s'il existe pour nettoyer les réglages obsolètes
            try {
                if (nm.getNotificationChannel("calls") != null) {
                    nm.deleteNotificationChannel("calls");
                }
            } catch (Exception ignored) {}

            NotificationChannel existing = nm.getNotificationChannel(CALL_CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                        CALL_CHANNEL_ID,
                        "Appels Vocaux",
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Appels vocaux entrants entre acheteurs et vendeurs");
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 1000, 1000, 1000, 1000});
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                channel.setSound(soundUri, audioAttributes);

                nm.createNotificationChannel(channel);
                Log.d(TAG, "Canal de notification " + CALL_CHANNEL_ID + " créé avec succès.");
            }
        }
    }
}
