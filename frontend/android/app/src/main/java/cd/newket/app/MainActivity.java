package cd.newket.app;

import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "NewKetMain";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiveActivityPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        requestFullScreenIntentPermissionIfNeeded();
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
    }

    /**
     * Android 14+ (API 34) : USE_FULL_SCREEN_INTENT n'est plus accordée automatiquement.
     * On redirige l'utilisateur vers les paramètres système pour l'accorder manuellement.
     * Sans cette permission, l'écran d'appel entrant n'apparaît pas sur l'écran verrouillé.
     */
    private void requestFullScreenIntentPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null && !nm.canUseFullScreenIntent()) {
                Log.w(TAG, "USE_FULL_SCREEN_INTENT non accordée — redirection vers paramètres.");
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    Log.e(TAG, "Impossible d'ouvrir les paramètres USE_FULL_SCREEN_INTENT", e);
                }
            }
        }
    }

    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        String type = intent.getStringExtra("type");
        if ("incoming-call".equals(type)) {
            final String orderId = intent.getStringExtra("order_id") != null ? intent.getStringExtra("order_id") : "";
            final String openChat = intent.getStringExtra("open_chat") != null ? intent.getStringExtra("open_chat") : "1";
            final String autoAnswer = intent.getStringExtra("auto_answer") != null ? intent.getStringExtra("auto_answer") : "1";

            if (bridge != null && bridge.getWebView() != null) {
                String js = String.format(
                    "javascript:(function(){" +
                    "  try {" +
                    "    localStorage.setItem('nk_auto_open_order_id', '%s');" +
                    "    localStorage.setItem('nk_auto_open_chat', '%s');" +
                    "    localStorage.setItem('nk_auto_answer_call', '%s');" +
                    "    window.dispatchEvent(new CustomEvent('newket:native_call_answered', { detail: { order_id: '%s' } }));" +
                    "  } catch(e) {}" +
                    "})();",
                    orderId, openChat, autoAnswer, orderId
                );
                bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
            }
        }
    }
}

