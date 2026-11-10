package cd.newket.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import java.util.List;

/**
 * NewKetLargeWidgetProvider
 * -------------------------
 * Fournit le grand widget Android Large (4x4) Vitrine Produits Sponsorisés (identique à iOS Large) :
 * Grille 2x2 des 4 produits sponsorisés avec photos, noms, prix en FC,
 * clics directs vers chaque produit + barre inférieure de raccourcis rapides.
 */
public class NewKetLargeWidgetProvider extends AppWidgetProvider {

    private static final String SCHEME_SHOPS = "newket://shops";
    private static final String SCHEME_NOTIFICATIONS = "newket://notifications";
    private static final String SCHEME_FAVORITES = "newket://favorites";
    private static final String SCHEME_CART = "newket://achat";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateLargeWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateLargeWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        NewKetProductsFetcher.fetchPinnedProducts(4, new NewKetProductsFetcher.Callback() {
            @Override
            public void onLoaded(List<NewKetProductsFetcher.ProductModel> products) {
                RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.newket_widget_large);

                // Liaison des boutons de la barre inférieure
                views.setOnClickPendingIntent(R.id.widget_large_link_shops, createDeepLinkPendingIntent(context, SCHEME_SHOPS, 401));
                views.setOnClickPendingIntent(R.id.widget_large_btn_shops, createDeepLinkPendingIntent(context, SCHEME_SHOPS, 402));
                views.setOnClickPendingIntent(R.id.widget_large_btn_notifications, createDeepLinkPendingIntent(context, SCHEME_NOTIFICATIONS, 403));
                views.setOnClickPendingIntent(R.id.widget_large_btn_favorites, createDeepLinkPendingIntent(context, SCHEME_FAVORITES, 404));
                views.setOnClickPendingIntent(R.id.widget_large_btn_cart, createDeepLinkPendingIntent(context, SCHEME_CART, 405));

                int[] cardIds = {R.id.widget_card_1, R.id.widget_card_2, R.id.widget_card_3, R.id.widget_card_4};
                int[] imgIds = {R.id.widget_img_1, R.id.widget_img_2, R.id.widget_img_3, R.id.widget_img_4};
                int[] nameIds = {R.id.widget_name_1, R.id.widget_name_2, R.id.widget_name_3, R.id.widget_name_4};
                int[] priceIds = {R.id.widget_price_1, R.id.widget_price_2, R.id.widget_price_3, R.id.widget_price_4};

                for (int i = 0; i < 4; i++) {
                    if (products != null && i < products.size()) {
                        NewKetProductsFetcher.ProductModel p = products.get(i);
                        views.setTextViewText(nameIds[i], p.name);
                        views.setTextViewText(priceIds[i], p.formattedPrice);

                        if (p.imageBitmap != null) {
                            views.setImageViewBitmap(imgIds[i], p.imageBitmap);
                        } else {
                            views.setImageViewResource(imgIds[i], R.drawable.splash);
                        }

                        String deepLink = (p.id != null && !p.id.isEmpty())
                                ? "newket://product?id=" + p.id
                                : "newket://shops";
                        views.setOnClickPendingIntent(cardIds[i], createDeepLinkPendingIntent(context, deepLink, 410 + i));
                    } else {
                        views.setOnClickPendingIntent(cardIds[i], createDeepLinkPendingIntent(context, "newket://shops", 410 + i));
                    }
                }

                appWidgetManager.updateAppWidget(appWidgetId, views);
            }
        });
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
