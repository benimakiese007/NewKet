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
 * NewKetSmallProductWidgetProvider
 * --------------------------------
 * Fournit le widget Android Small (2x2) Produit Sponsorisé (identique à iOS Option A) :
 * Affiche la vraie photo du produit sponsorisé en plein écran avec son nom,
 * son prix en FC (vert émeraude) et un clic direct ouvrant la fiche produit.
 */
public class NewKetSmallProductWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateSmallProductWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateSmallProductWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        NewKetProductsFetcher.fetchPinnedProducts(1, new NewKetProductsFetcher.Callback() {
            @Override
            public void onLoaded(List<NewKetProductsFetcher.ProductModel> products) {
                RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.newket_widget_small_product);

                if (products != null && !products.isEmpty()) {
                    NewKetProductsFetcher.ProductModel product = products.get(0);

                    views.setTextViewText(R.id.widget_product_name, product.name);
                    views.setTextViewText(R.id.widget_product_price, product.formattedPrice);

                    if (product.imageBitmap != null) {
                        views.setImageViewBitmap(R.id.widget_product_image, product.imageBitmap);
                    } else {
                        views.setImageViewResource(R.id.widget_product_image, R.drawable.splash);
                    }

                    // Deep link vers la fiche produit
                    String deepLinkUri = (product.id != null && !product.id.isEmpty())
                            ? "newket://product?id=" + product.id
                            : "newket://shops";
                    views.setOnClickPendingIntent(R.id.widget_small_root, createDeepLinkPendingIntent(context, deepLinkUri, 301));
                } else {
                    views.setTextViewText(R.id.widget_product_name, "Découvrez les boutiques");
                    views.setTextViewText(R.id.widget_product_price, "NewKet Market");
                    views.setOnClickPendingIntent(R.id.widget_small_root, createDeepLinkPendingIntent(context, "newket://shops", 301));
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
