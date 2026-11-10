package cd.newket.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * NewKetProductsFetcher
 * ---------------------
 * Télécharge en tâche de fond les produits sponsorisés / en vedette depuis Supabase REST
 * pour alimenter les widgets Android (Small 2x2 et Large 4x4), exactement comme sur iOS.
 */
public class NewKetProductsFetcher {

    private static final String SUPABASE_REST_URL =
            "https://kuygjocnnlvjtoaquicq.supabase.co/rest/v1/products?select=id,name,price,image,pinned,stock&pinned=eq.true&is_archived=eq.false&stock=gt.0&order=created_at.desc";

    private static final String ANON_KEY =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1eWdqb2Nubmx2anRvYXF1aWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDM2NjYsImV4cCI6MjA4NjkxOTY2Nn0.1qyGb91CbLeSRNWKUNGiToJYGr8lsI-DeddWTnMv3SY";

    private static final ExecutorService EXECUTOR = Executors.newCachedThreadPool();
    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());

    public static class ProductModel {
        public String id;
        public String name;
        public double price;
        public String formattedPrice;
        public String imageUrl;
        public Bitmap imageBitmap;

        public ProductModel(String id, String name, double price, String formattedPrice, String imageUrl) {
            this.id = id;
            this.name = name;
            this.price = price;
            this.formattedPrice = formattedPrice;
            this.imageUrl = imageUrl;
        }
    }

    public interface Callback {
        void onLoaded(List<ProductModel> products);
    }

    public static void fetchPinnedProducts(int limit, Callback callback) {
        EXECUTOR.execute(() -> {
            List<ProductModel> result = new ArrayList<>();
            HttpURLConnection conn = null;
            try {
                String fullUrl = SUPABASE_REST_URL + "&limit=" + limit;
                URL url = new URL(fullUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("apikey", ANON_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + ANON_KEY);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                if (conn.getResponseCode() == 200) {
                    InputStream in = conn.getInputStream();
                    byte[] buffer = new byte[1024];
                    StringBuilder sb = new StringBuilder();
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        sb.append(new String(buffer, 0, bytesRead));
                    }
                    in.close();

                    JSONArray arr = new JSONArray(sb.toString());
                    for (int i = 0; i < arr.length() && i < limit; i++) {
                        JSONObject obj = arr.getJSONObject(i);
                        String id = obj.optString("id", "");
                        String name = obj.optString("name", "Produit NewKet");
                        double price = obj.optDouble("price", 0);
                        String image = obj.optString("image", null);

                        String formatted = formatPriceFC(price);
                        ProductModel model = new ProductModel(id, name, price, formatted, image);

                        // Téléchargement et redimensionnement optimal de l'image
                        if (image != null && image.startsWith("http")) {
                            model.imageBitmap = downloadBitmap(image, 400, 400);
                        }

                        result.add(model);
                    }
                }
            } catch (Exception e) {
                // Silently fallback to placeholder items
            } finally {
                if (conn != null) {
                    try { conn.disconnect(); } catch (_) {}
                }
            }

            // Fallback si pas de réseau ou liste vide
            if (result.isEmpty()) {
                result.add(new ProductModel("1", "Table basse bois flotté", 210000, "210 000 FC", null));
                result.add(new ProductModel("2", "Canapé 3 places velours", 950000, "950 000 FC", null));
                result.add(new ProductModel("3", "Plante palmier 180cm", 75000, "75 000 FC", null));
                result.add(new ProductModel("4", "Vélo de route carbone", 2500000, "2 500 000 FC", null));
            }

            MAIN_HANDLER.post(() -> callback.onLoaded(result));
        });
    }

    private static String formatPriceFC(double price) {
        try {
            DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.FRENCH);
            symbols.setGroupingSeparator(' ');
            DecimalFormat df = new DecimalFormat("#,##0", symbols);
            return df.format((long) price) + " FC";
        } catch (Exception e) {
            return ((long) price) + " FC";
        }
    }

    private static Bitmap downloadBitmap(String urlString, int reqWidth, int reqHeight) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setDoInput(true);
            conn.connect();

            InputStream input = conn.getInputStream();
            Bitmap original = BitmapFactory.decodeStream(input);
            input.close();

            if (original == null) return null;

            // Redimensionnement pour respecter les quotas RemoteViews d'Android
            int width = original.getWidth();
            int height = original.getHeight();

            if (width > reqWidth || height > reqHeight) {
                float ratio = Math.min((float) reqWidth / width, (float) reqHeight / height);
                int finalWidth = Math.round(width * ratio);
                int finalHeight = Math.round(height * ratio);
                Bitmap scaled = Bitmap.createScaledBitmap(original, finalWidth, finalHeight, true);
                if (scaled != original) {
                    original.recycle();
                }
                return scaled;
            }
            return original;
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (_) {}
            }
        }
    }
}
