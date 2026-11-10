package cd.newket.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * NewKetBarWidgetProvider
 * -----------------------
 * Fournit le widget Android barre horizontale 4x1 / 4x2 (style iOS Medium).
 * Permet d'aligner les boutons Boutiques, Notifs, Favoris et Panier
 * de façon élégante et compacte sur l'écran d'accueil.
 */
public class NewKetBarWidgetProvider extends AppWidgetProvider {

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

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.newket_widget_horizontal);

        // Liaison des deep links interactifs sur les 4 boutons
        views.setOnClickPendingIntent(R.id.widget_btn_shops, createDeepLinkPendingIntent(context, SCHEME_SHOPS, 201));
        views.setOnClickPendingIntent(R.id.widget_btn_notifications, createDeepLinkPendingIntent(context, SCHEME_NOTIFICATIONS, 202));
        views.setOnClickPendingIntent(R.id.widget_btn_favorites, createDeepLinkPendingIntent(context, SCHEME_FAVORITES, 203));
        views.setOnClickPendingIntent(R.id.widget_btn_cart, createDeepLinkPendingIntent(context, SCHEME_CART, 204));

        // Clic sur le logo / root -> ouvre simplement l'application
        Intent mainIntent = new Intent(context, MainActivity.class);
        mainIntent.setAction(Intent.ACTION_MAIN);
        mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        mainIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent mainPendingIntent = PendingIntent.getActivity(context, 200, mainIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_bar_root, mainPendingIntent);

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
