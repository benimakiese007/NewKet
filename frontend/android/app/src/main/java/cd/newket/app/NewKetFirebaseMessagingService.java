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
    private static final String CALL_CHANNEL_ID = "calls";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        Log.d(TAG, "FCM message reçu, data: " + data);

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

        Log.d(TAG, "Déclenchement appel entrant natif plein écran pour " + callerName + " (Commande: " + orderId + ")");

        // 1. S'assurer que le canal d'appel haute priorité existe
        createCallNotificationChannel();

        // 2. Intent plein écran vers IncomingCallActivity
        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("caller_name", callerName);
        fullScreenIntent.putExtra("order_id", orderId);
        fullScreenIntent.putExtra("caller_avatar", callerAvatar);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this, 0, fullScreenIntent, pendingFlags
        );

        // 3. Actions sur la notification (Décrocher / Refuser)
        Intent answerIntent = new Intent(this, CallNotificationActionReceiver.class);
        answerIntent.setAction(CallNotificationActionReceiver.ACTION_ANSWER_CALL);
        answerIntent.putExtra("order_id", orderId);
        answerIntent.putExtra("caller_name", callerName);
        PendingIntent answerPendingIntent = PendingIntent.getBroadcast(
                this, 1, answerIntent, pendingFlags
        );

        Intent declineIntent = new Intent(this, CallNotificationActionReceiver.class);
        declineIntent.setAction(CallNotificationActionReceiver.ACTION_DECLINE_CALL);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                this, 2, declineIntent, pendingFlags
        );

        // 4. Construction de la notification avec FullScreenIntent
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
                .setColor(0xFF10B981) // Emerald NewKet
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .addAction(R.drawable.ic_call_decline, "Refuser", declinePendingIntent)
                .addAction(R.drawable.ic_call_answer, "Décrocher", answerPendingIntent);

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(CallNotificationActionReceiver.NOTIFICATION_ID, builder.build());
        }

        // 5. Démarrer la sonnerie et le vibreur au niveau service également
        CallRingtoneHelper.getInstance().startRingtoneAndVibration(this);
    }

    private void createCallNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            NotificationChannel existing = notificationManager.getNotificationChannel(CALL_CHANNEL_ID);
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

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                channel.setSound(soundUri, audioAttributes);

                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
