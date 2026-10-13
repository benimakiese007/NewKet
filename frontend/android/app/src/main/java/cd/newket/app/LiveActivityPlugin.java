package cd.newket.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import android.Manifest;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(
    name = "LiveActivityPlugin",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class LiveActivityPlugin extends Plugin {

    public static final String CHANNEL_ID = "newket_order_tracking";
    public static final String CHANNEL_NAME = "Suivi de commande en direct";
    public static final String CHANNEL_DESC = "Notifications persistantes de suivi de livraison en direct";

    // Emerald brand color #0A4A2E
    private static final int BRAND_COLOR = Color.rgb(10, 74, 46);

    // Track active notifications per orderId
    private static final ConcurrentHashMap<String, Integer> activeOrders = new ConcurrentHashMap<>();

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableLights(true);
            channel.setLightColor(BRAND_COLOR);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            channel.setShowBadge(true);

            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    // MARK: - isAvailable
    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        JSObject ret = new JSObject();
        ret.put("available", true);
        ret.put("enabled", notificationsEnabled);
        call.resolve(ret);
    }

    // MARK: - startActivity
    @PluginMethod
    public void startActivity(PluginCall call) {
        String orderId = call.getString("orderId", String.valueOf(System.currentTimeMillis()));
        String orderNumber = call.getString("orderNumber", "#NK-" + orderId);
        String shopName = call.getString("shopName", "NewKet");
        String status = call.getString("status", "PROCESSING");
        String statusTitle = call.getString("statusTitle", "Commande en cours");
        String statusDescription = call.getString("statusDescription", "Votre commande est prise en charge.");
        double progress = call.getDouble("progress", 0.25);
        int currentStep = call.getInt("currentStep", 1);
        int totalSteps = call.getInt("totalSteps", 4);
        String etaText = call.getString("etaText", null);
        boolean isCancelled = Boolean.TRUE.equals(call.getBoolean("isCancelled", false));

        int notifId = getNotificationId(orderId);
        activeOrders.put(orderId, notifId);

        buildAndPostNotification(
                notifId,
                orderId,
                orderNumber,
                shopName,
                statusTitle,
                statusDescription,
                progress,
                currentStep,
                totalSteps,
                etaText,
                isCancelled,
                true // ongoing
        );

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("orderId", orderId);
        call.resolve(ret);
    }

    // MARK: - updateActivity
    @PluginMethod
    public void updateActivity(PluginCall call) {
        String orderId = call.getString("orderId");
        if (orderId == null) {
            call.reject("Missing 'orderId' parameter.");
            return;
        }

        Integer notifId = activeOrders.get(orderId);
        if (notifId == null) {
            notifId = getNotificationId(orderId);
            activeOrders.put(orderId, notifId);
        }

        String orderNumber = call.getString("orderNumber", "#NK-" + orderId);
        String shopName = call.getString("shopName", "NewKet");
        String statusTitle = call.getString("statusTitle", "Mise à jour");
        String statusDescription = call.getString("statusDescription", "");
        double progress = call.getDouble("progress", 0.5);
        int currentStep = call.getInt("currentStep", 2);
        int totalSteps = call.getInt("totalSteps", 4);
        String etaText = call.getString("etaText", null);
        boolean isCancelled = Boolean.TRUE.equals(call.getBoolean("isCancelled", false));

        boolean ongoing = !isCancelled && progress < 1.0;

        buildAndPostNotification(
                notifId,
                orderId,
                orderNumber,
                shopName,
                statusTitle,
                statusDescription,
                progress,
                currentStep,
                totalSteps,
                etaText,
                isCancelled,
                ongoing
        );

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("orderId", orderId);
        call.resolve(ret);
    }

    // MARK: - endActivity
    @PluginMethod
    public void endActivity(PluginCall call) {
        String orderId = call.getString("orderId");
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(getContext());

        if (orderId != null) {
            Integer notifId = activeOrders.remove(orderId);
            if (notifId != null) {
                notificationManager.cancel(notifId);
            }
        } else {
            for (Integer notifId : activeOrders.values()) {
                notificationManager.cancel(notifId);
            }
            activeOrders.clear();
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    // MARK: - getDiagnostics
    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("platform", "android");
        ret.put("osVersion", android.os.Build.VERSION.RELEASE);
        ret.put("sdkInt", android.os.Build.VERSION.SDK_INT);
        ret.put("deviceModel", android.os.Build.MODEL);
        ret.put("activityKitSupported", false);
        ret.put("notificationsSupported", true);
        ret.put("areActivitiesEnabled", androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        ret.put("activeActivitiesCount", activeOrders.size());
        call.resolve(ret);
    }

    private int getNotificationId(String orderId) {
        return Math.abs(orderId.hashCode() % 100000) + 1000;
    }

    private void buildAndPostNotification(
            int notifId,
            String orderId,
            String orderNumber,
            String shopName,
            String statusTitle,
            String statusDescription,
            double progress,
            int currentStep,
            int totalSteps,
            String etaText,
            boolean isCancelled,
            boolean ongoing
    ) {
        Context context = getContext();

        // Tap action: open app on the order details page
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.putExtra("orderId", orderId);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, notifId, intent, flags);

        // Header and ETA formatting
        String contentTitle = statusTitle;
        if (etaText != null && !etaText.trim().isEmpty()) {
            contentTitle += " • " + etaText;
        }

        // Stepper text summary: e.g. "Étape 3/4 • En route"
        String stepSummary = String.format("Étape %d/%d : %s", currentStep, totalSteps, statusDescription);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(context.getApplicationInfo().icon)
                .setColor(BRAND_COLOR)
                .setContentTitle(contentTitle)
                .setContentText(stepSummary)
                .setSubText(shopName + " (" + orderNumber + ")")
                .setContentIntent(pendingIntent)
                .setOngoing(ongoing)
                .setAutoCancel(!ongoing)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setPriority(ongoing ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT);

        // Progress bar (0 to 100)
        if (ongoing && progress >= 0.0 && progress <= 1.0) {
            int progressPercent = (int) Math.round(progress * 100);
            builder.setProgress(100, progressPercent, false);
        } else {
            builder.setProgress(0, 0, false);
        }

        try {
            NotificationManagerCompat.from(context).notify(notifId, builder.build());
        } catch (SecurityException ignored) {
            // Android 13 POST_NOTIFICATIONS permission not granted
        }
    }
}
