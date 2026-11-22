package cd.newket.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
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
    static final String CALL_CHANNEL_ID = "calls"; // accessible par CallForegroundService

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

        Log.d(TAG, "Appel entrant FCM — démarrage du CallForegroundService pour " + callerName);

        // S'assurer que le canal de notification haute priorité existe
        createCallNotificationChannel();

        // Déléguer entièrement au CallForegroundService.
        Intent serviceIntent = new Intent(this, CallForegroundService.class);
        serviceIntent.setAction(CallForegroundService.ACTION_START);
        serviceIntent.putExtra("caller_name", callerName);
        serviceIntent.putExtra("order_id", orderId);
        serviceIntent.putExtra("caller_avatar", callerAvatar);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Log.d(TAG, ">>> FCM : startForegroundService() en cours...");
                startForegroundService(serviceIntent);
            } else {
                Log.d(TAG, ">>> FCM : startService() en cours (Android < 8)...");
                startService(serviceIntent);
            }
            Log.d(TAG, ">>> FCM : CallForegroundService démarré avec succès.");
        } catch (Exception e) {
            Log.e(TAG, ">>> FCM ERREUR : impossible de démarrer CallForegroundService : " + e.getMessage(), e);
        }
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
