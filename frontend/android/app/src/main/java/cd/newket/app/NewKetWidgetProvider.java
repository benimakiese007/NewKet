package cd.newket.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.RemoteViews;

/**
 * NewKetWidgetProvider
 * --------------------
 * Fournit le widget d'écran d'accueil Android principal (Accès Rapide).
 * Supporte le redimensionnement dynamique (Responsive 2x2 carré ou barre horizontale 4x1/4x2).
 */
public class NewKetWidgetProvider extends AppWidgetProvider {

    private static final String SCHEME_SHOPS = "newket://shops";
    private static final String SCHEME_NOTIFICATIONS = "newket://notifications";
    private static final String SCHEME_FAVORITES = "newket://favorites";
    private static final String SCHEME_CART = "newket://achat";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        updateAppWidget(context, appWidgetManager, appWidgetId);
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        int minWidth = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) : 0;
        int maxHeight = options != null ? options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT) : 0;

        // Si l'utilisateur a étiré le widget en largeur (mode barre 4x1/4x2)
        boolean isHorizontalBar = (minWidth >= 220 && maxHeight <= 130);
        int layoutId = isHorizontalBar ? R.layout.newket_widget_horizontal : R.layout.newket_widget;

        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);

        // Liaison des deep links interactifs sur les 4 boutons
        views.setOnClickPendingIntent(R.id.widget_btn_shops, createDeepLinkPendingIntent(context, SCHEME_SHOPS, 101));
        views.setOnClickPendingIntent(R.id.widget_btn_notifications, createDeepLinkPendingIntent(context, SCHEME_NOTIFICATIONS, 102));
        views.setOnClickPendingIntent(R.id.widget_btn_favorites, createDeepLinkPendingIntent(context, SCHEME_FAVORITES, 103));
        views.setOnClickPendingIntent(R.id.widget_btn_cart, createDeepLinkPendingIntent(context, SCHEME_CART, 104));

        // Clic sur le fond ou brand -> ouvre simplement l'application
        Intent mainIntent = new Intent(context, MainActivity.class);
        mainIntent.setAction(Intent.ACTION_MAIN);
        mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent mainPendingIntent = PendingIntent.getActivity(context, 100, mainIntent, flags);
        
        int rootId = isHorizontalBar ? R.id.widget_bar_root : R.id.widget_root;
        views.setOnClickPendingIntent(rootId, mainPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent createDeepLinkPendingIntent(Context context, String uriString, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(uriString));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }
}
