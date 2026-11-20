package cd.newket.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

public class CallRingtoneHelper {
    private static final String TAG = "NewKetCallRingtone";
    private static CallRingtoneHelper instance;

    private Ringtone ringtone;
    private Vibrator vibrator;
    private boolean isPlaying = false;

    private CallRingtoneHelper() {}

    public static synchronized CallRingtoneHelper getInstance() {
        if (instance == null) {
            instance = new CallRingtoneHelper();
        }
        return instance;
    }

    public synchronized void startRingtoneAndVibration(Context context) {
        if (isPlaying) return;
        isPlaying = true;

        try {
            // 1. Sonnerie
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri == null) {
                ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), ringtoneUri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes attributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    ringtone.setAudioAttributes(attributes);
                }
                ringtone.play();
            }

            // 2. Vibreur
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vibratorManager != null) {
                    vibrator = vibratorManager.getDefaultVibrator();
                }
            } else {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = { 0, 1000, 1000, 1000, 1000 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
            Log.d(TAG, "Sonnerie et vibreur d'appel démarrés.");
        } catch (Exception e) {
            Log.w(TAG, "Erreur démarrage sonnerie: " + e.getMessage());
        }
    }

    public synchronized void stopRingtoneAndVibration() {
        if (!isPlaying) return;
        isPlaying = false;

        try {
            if (ringtone != null && ringtone.isPlaying()) {
                ringtone.stop();
                ringtone = null;
            }
            if (vibrator != null) {
                vibrator.cancel();
                vibrator = null;
            }
            Log.d(TAG, "Sonnerie et vibreur d'appel arrêtés.");
        } catch (Exception e) {
            Log.w(TAG, "Erreur arrêt sonnerie: " + e.getMessage());
        }
    }
}
