package cd.newket.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class CallNotificationActionReceiver extends BroadcastReceiver {
    private static final String TAG = "NewKetCallAction";

    public static final String ACTION_ANSWER_CALL = "cd.newket.app.ACTION_ANSWER_CALL";
    public static final String ACTION_DECLINE_CALL = "cd.newket.app.ACTION_DECLINE_CALL";
    public static final int NOTIFICATION_ID = 9991;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) return;

        Log.d(TAG, "Reçu action notification: " + action);

        // 1. Arrêter la sonnerie et le vibreur immédiatement
        CallRingtoneHelper.getInstance().stopRingtoneAndVibration();

        // 1b. Arrêter le Foreground Service s'il tournait
        try {
            Intent stopService = new Intent(context, CallForegroundService.class);
            stopService.setAction(CallForegroundService.ACTION_STOP);
            context.startService(stopService);
        } catch (Exception ignored) {}

        // 2. Supprimer la notification
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }

        // 3. Traitement
        if (ACTION_ANSWER_CALL.equals(action)) {
            String orderId = intent.getStringExtra("order_id");
            String callerName = intent.getStringExtra("caller_name");

            Intent mainIntent = new Intent(context, MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            mainIntent.putExtra("type", "incoming-call");
            mainIntent.putExtra("order_id", orderId != null ? orderId : "");
            mainIntent.putExtra("caller_name", callerName != null ? callerName : "");
            mainIntent.putExtra("open_chat", "1");
            mainIntent.putExtra("auto_answer", "1");

            context.startActivity(mainIntent);
        } else if (ACTION_DECLINE_CALL.equals(action)) {
            Log.d(TAG, "Appel refusé par l'utilisateur.");
        }
    }
}
