package cd.newket.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * NewKet — AppUpdatePlugin
 * Plugin Capacitor interne pour le téléchargement et l'installation
 * des mises à jour APK depuis GitHub Releases.
 *
 * Méthodes exposées au JS :
 *   - canInstallPackages()      → vérifie l'autorisation REQUEST_INSTALL_PACKAGES
 *   - openInstallPermission()   → ouvre les réglages Android correspondants
 *   - downloadApk(url, sha256)  → télécharge l'APK avec progression (events)
 *   - getDownloadedApkPath()    → retourne le chemin local du dernier APK
 *   - installApk()              → lance l'installeur Android natif
 *   - cancelDownload()          → annule le téléchargement en cours
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String TAG = "NewKet.AppUpdate";
    private static final String APK_DIR = "updates";
    private static final String APK_FILENAME = "newket-update.apk";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean cancelRequested = false;
    private File downloadedApk = null;

    // ── 1. Vérification de la permission d'installation ─────────────────────

    @PluginMethod
    public void getCallLogs(PluginCall call) {
        JSObject result = new JSObject();
        result.put("logs", CallDiagnosticLogger.getLogs(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void clearCallLogs(PluginCall call) {
        CallDiagnosticLogger.clearLogs(getContext());
        call.resolve();
    }

    @PluginMethod
    public void triggerNativeCallTest(PluginCall call) {
        try {
            Context ctx = getContext();
            CallDiagnosticLogger.log(ctx, "🧪 Test natif déclenché manuellement depuis l'app");
            Intent serviceIntent = new Intent(ctx, CallForegroundService.class);
            serviceIntent.setAction(CallForegroundService.ACTION_START);
            serviceIntent.putExtra("caller_name", "Testeur NewKet (Natif)");
            serviceIntent.putExtra("order_id", "TEST-DIRECT");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
            CallDiagnosticLogger.log(ctx, "✅ CallForegroundService démarré avec succès");
            call.resolve();
        } catch (Exception e) {
            CallDiagnosticLogger.log(getContext(), "❌ Erreur triggerNativeCallTest: " + e.getMessage());
            call.reject("Erreur test natif: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getNativeVersion(PluginCall call) {
        JSObject result = new JSObject();
        try {
            android.content.pm.PackageInfo pInfo = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            result.put("versionName", pInfo.versionName);
            long vCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? pInfo.getLongVersionCode() : pInfo.versionCode;
            result.put("versionCode", vCode);
            call.resolve(result);
        } catch (Exception e) {
            result.put("versionName", "1.0.75");
            result.put("versionCode", 1);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        boolean canInstall;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            canInstall = getContext().getPackageManager()
                .canRequestPackageInstalls();
        } else {
            // Android < 8.0 : permission toujours accordée si déclarée dans le manifest
            canInstall = true;
        }
        JSObject result = new JSObject();
        result.put("canInstall", canInstall);
        call.resolve(result);
    }

    // ── 2. Ouvrir la page des réglages pour autoriser l'installation ─────────

    @PluginMethod
    public void openInstallPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } else {
            call.resolve(); // Pas nécessaire avant Android 8
        }
    }

    // ── 3. Téléchargement de l'APK avec progression ──────────────────────────

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String apkUrl = call.getString("url");
        String expectedSha256 = call.getString("sha256", "");

        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("URL manquante");
            return;
        }

        cancelRequested = false;
        call.setKeepAlive(true);

        executor.execute(() -> {
            try {
                // Préparer le dossier de destination dans le cache privé
                File cacheDir = new File(getContext().getCacheDir(), APK_DIR);
                if (!cacheDir.exists() && !cacheDir.mkdirs()) {
                    throw new IOException("Impossible de créer le dossier cache updates/");
                }
                File apkFile = new File(cacheDir, APK_FILENAME);
                // Supprimer un éventuel fichier précédent
                if (apkFile.exists()) apkFile.delete();

                // Connexion HTTP
                URL url = new URL(apkUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(60_000);
                conn.setRequestProperty("User-Agent", "NewKet-Android-Updater/1.0");

                // Suivre les redirections (GitHub redirige les assets)
                conn.setInstanceFollowRedirects(true);
                int responseCode = conn.getResponseCode();
                // Gérer les redirections manuellement si nécessaire
                if (responseCode == HttpURLConnection.HTTP_MOVED_TEMP
                    || responseCode == HttpURLConnection.HTTP_MOVED_PERM
                    || responseCode == 307 || responseCode == 308) {
                    String redirectUrl = conn.getHeaderField("Location");
                    conn.disconnect();
                    conn = (HttpURLConnection) new URL(redirectUrl).openConnection();
                    conn.setConnectTimeout(15_000);
                    conn.setReadTimeout(60_000);
                    responseCode = conn.getResponseCode();
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    conn.disconnect();
                    throw new IOException("HTTP " + responseCode + " pour " + apkUrl);
                }

                long totalBytes = conn.getContentLengthLong();

                // Écriture avec suivi de progression
                try (InputStream is = conn.getInputStream();
                     FileOutputStream fos = new FileOutputStream(apkFile)) {

                    byte[] buffer = new byte[8192];
                    long downloadedBytes = 0;
                    int read;
                    int lastProgress = -1;

                    while ((read = is.read(buffer)) != -1) {
                        if (cancelRequested) {
                            conn.disconnect();
                            apkFile.delete();
                            JSObject cancelResult = new JSObject();
                            cancelResult.put("cancelled", true);
                            call.resolve(cancelResult);
                            return;
                        }
                        fos.write(buffer, 0, read);
                        downloadedBytes += read;

                        if (totalBytes > 0) {
                            int progress = (int) ((downloadedBytes * 100L) / totalBytes);
                            if (progress != lastProgress) {
                                lastProgress = progress;
                                JSObject progressData = new JSObject();
                                progressData.put("type", "progress");
                                progressData.put("progress", progress);
                                progressData.put("downloadedBytes", downloadedBytes);
                                progressData.put("totalBytes", totalBytes);
                                notifyListeners("downloadProgress", progressData);
                            }
                        }
                    }
                }
                conn.disconnect();

                // Vérification SHA-256
                if (!expectedSha256.isEmpty()) {
                    String actualSha256 = computeSha256(apkFile);
                    Log.d(TAG, "SHA-256 attendu  : " + expectedSha256);
                    Log.d(TAG, "SHA-256 calculé  : " + actualSha256);
                    if (!expectedSha256.equalsIgnoreCase(actualSha256)) {
                        apkFile.delete();
                        call.reject("SHA-256 invalide : fichier corrompu ou modifié");
                        return;
                    }
                    Log.d(TAG, "✅ Intégrité SHA-256 vérifiée");
                }

                downloadedApk = apkFile;

                JSObject result = new JSObject();
                result.put("type", "done");
                result.put("path", apkFile.getAbsolutePath());
                result.put("size", apkFile.length());
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Erreur téléchargement : " + e.getMessage(), e);
                call.reject("Erreur téléchargement : " + e.getMessage());
            }
        });
    }

    // ── 4. Chemin du dernier APK téléchargé ────────────────────────────────

    @PluginMethod
    public void getDownloadedApkPath(PluginCall call) {
        File cacheDir = new File(getContext().getCacheDir(), APK_DIR);
        File apkFile = new File(cacheDir, APK_FILENAME);
        JSObject result = new JSObject();
        if (apkFile.exists()) {
            result.put("path", apkFile.getAbsolutePath());
            result.put("exists", true);
        } else {
            result.put("exists", false);
        }
        call.resolve(result);
    }

    // ── 5. Déclenchement de l'installeur Android natif ─────────────────────

    @PluginMethod
    public void installApk(PluginCall call) {
        File cacheDir = new File(getContext().getCacheDir(), APK_DIR);
        File apkFile = new File(cacheDir, APK_FILENAME);

        if (!apkFile.exists()) {
            call.reject("Fichier APK introuvable. Téléchargez-le d'abord.");
            return;
        }

        try {
            Context ctx = getContext();
            Uri apkUri = FileProvider.getUriForFile(ctx,
                ctx.getPackageName() + ".fileprovider", apkFile);

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            ctx.startActivity(installIntent);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Erreur installation : " + e.getMessage(), e);
            call.reject("Impossible de lancer l'installation : " + e.getMessage());
        }
    }

    // ── 6. Annulation du téléchargement en cours ────────────────────────────

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelRequested = true;
        call.resolve();
    }

    // ── Utilitaire SHA-256 ──────────────────────────────────────────────────

    private String computeSha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
