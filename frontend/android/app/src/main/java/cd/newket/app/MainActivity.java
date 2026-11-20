package cd.newket.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiveActivityPlugin.class);
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleCallIntent(intent);
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

