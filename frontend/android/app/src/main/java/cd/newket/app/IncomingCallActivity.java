package cd.newket.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.TextView;
import android.util.Log;

public class IncomingCallActivity extends Activity {
    private static final String TAG = "NewKetIncomingCall";

    private String callerName = "Livreur NewKet";
    private String orderId = "";
    private String callerAvatar = "";
    private Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CallDiagnosticLogger.log(this, "🌟🌟🌟 IncomingCallActivity.onCreate() — ÉCRAN PLEIN ÉCRAN AFFICHÉ !");

        // 1. Allumer l'écran et passer par dessus le lock screen
        configureWindowForLockScreen();

        setContentView(R.layout.activity_incoming_call);

        // 2. Extraire les paramètres
        Intent intent = getIntent();
        if (intent != null) {
            String name = intent.getStringExtra("caller_name");
            if (name != null && !name.trim().isEmpty()) {
                callerName = name;
            }
            orderId = intent.getStringExtra("order_id") != null ? intent.getStringExtra("order_id") : "";
            callerAvatar = intent.getStringExtra("caller_avatar") != null ? intent.getStringExtra("caller_avatar") : "";
        }

        // 3. Mettre à jour l'interface
        TextView nameTextView = findViewById(R.id.call_caller_name);
        TextView orderTextView = findViewById(R.id.call_order_info);
        TextView initialTextView = findViewById(R.id.call_avatar_initial);

        if (nameTextView != null) {
            nameTextView.setText(callerName);
        }
        if (orderTextView != null && !orderId.isEmpty()) {
            orderTextView.setText("Commande #" + orderId + " • Appel vocal en direct");
        }
        if (initialTextView != null && !callerName.isEmpty()) {
            initialTextView.setText(String.valueOf(callerName.charAt(0)).toUpperCase());
        }

        // 4. Lancer la sonnerie et le vibreur
        CallRingtoneHelper.getInstance().startRingtoneAndVibration(this);

        // 5. Bouton Décrocher
        ImageButton btnAnswer = findViewById(R.id.btn_answer_call);
        if (btnAnswer != null) {
            btnAnswer.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    answerCall();
                }
            });
        }

        // 6. Bouton Refuser
        ImageButton btnDecline = findViewById(R.id.btn_decline_call);
        if (btnDecline != null) {
            btnDecline.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    declineCall();
                }
            });
        }

        // 7. Timeout automatique après 45 secondes d'absence de réponse
        timeoutRunnable = new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Délai d'appel dépassé (45s sans réponse).");
                dismissCall();
            }
        };
        timeoutHandler.postDelayed(timeoutRunnable, 45000);
    }

    private void configureWindowForLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            try {
                android.app.KeyguardManager km = (android.app.KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (km != null) {
                    km.requestDismissKeyguard(this, null);
                }
            } catch (Exception ignored) {}
        }
        // Drapeaux de fenêtre indispensables pour Samsung One UI
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );
    }

    private void answerCall() {
        Log.d(TAG, "Appel accepté par l'utilisateur.");
        cleanupRingtoneAndNotification();

        // Lancer l'activité principale NewKet avec les données de la commande
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        mainIntent.putExtra("type", "incoming-call");
        mainIntent.putExtra("order_id", orderId);
        mainIntent.putExtra("caller_name", callerName);
        mainIntent.putExtra("open_chat", "1");
        mainIntent.putExtra("auto_answer", "1");

        startActivity(mainIntent);
        finish();
    }

    private void declineCall() {
        Log.d(TAG, "Appel refusé par l'utilisateur.");
        cleanupRingtoneAndNotification();
        finish();
    }

    private void dismissCall() {
        cleanupRingtoneAndNotification();
        finish();
    }

    private void cleanupRingtoneAndNotification() {
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }
        CallRingtoneHelper.getInstance().stopRingtoneAndVibration();

        try {
            Intent stopService = new Intent(this, CallForegroundService.class);
            stopService.setAction(CallForegroundService.ACTION_STOP);
            startService(stopService);
        } catch (Exception ignored) {}

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(CallNotificationActionReceiver.NOTIFICATION_ID);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cleanupRingtoneAndNotification();
    }
}
