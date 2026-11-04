package dev.epersonf.deck

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.os.Vibrator
import android.provider.Settings
import android.speech.tts.TextToSpeech
import org.json.JSONObject

/** The low-risk capabilities: clipboard, vibration, flashlight, volume, brightness and speaking aloud. */
class PhoneLow(private val ctx: Context) {
    private var tts: TextToSpeech? = null

    fun clipboard(action: String, json: JSONObject): JSONObject {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        if (action == "set") {
            cm.setPrimaryClip(ClipData.newPlainText("CLI Deck", json.optString("text")))
            return JSONObject().put("set", true)
        }
        // From Android 10 only the app on screen may read the clipboard, so this is empty unless CLI Deck is in front.
        val text = cm.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(ctx)?.toString()
        return JSONObject().put("text", text ?: JSONObject.NULL)
            .put("note", if (text == null) "Android only lets the app on screen read the clipboard: open CLI Deck first" else JSONObject.NULL)
    }

    @Suppress("DEPRECATION")
    fun vibrate(json: JSONObject): JSONObject {
        (ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator).vibrate(json.optLong("ms", 300).coerceIn(10, 2000))
        return JSONObject().put("vibrated", true)
    }

    fun torch(json: JSONObject): JSONObject {
        val cm = ctx.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val id = cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true }
            ?: error("This phone has no flashlight")
        val on = json.optBoolean("on", true)
        cm.setTorchMode(id, on)
        return JSONObject().put("on", on)
    }

    private fun stream(name: String) = when (name) {
        "ring" -> AudioManager.STREAM_RING
        "alarm" -> AudioManager.STREAM_ALARM
        else -> AudioManager.STREAM_MUSIC
    }

    fun volume(action: String, json: JSONObject): JSONObject {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (action == "set") {
            val s = stream(json.optString("stream", "music"))
            am.setStreamVolume(s, am.getStreamMaxVolume(s) * json.optInt("percent", 50).coerceIn(0, 100) / 100, 0)
        }
        fun level(s: Int) = JSONObject().put("percent", am.getStreamVolume(s) * 100 / am.getStreamMaxVolume(s).coerceAtLeast(1))
        return JSONObject().put("music", level(AudioManager.STREAM_MUSIC)).put("ring", level(AudioManager.STREAM_RING)).put("alarm", level(AudioManager.STREAM_ALARM))
    }

    fun brightness(action: String, json: JSONObject): JSONObject {
        val resolver = ctx.contentResolver
        if (action == "set") {
            if (!Settings.System.canWrite(ctx)) error("Allow \"Modify system settings\" for CLI Deck in Android settings")
            Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
            Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS, 255 * json.optInt("percent", 50).coerceIn(1, 100) / 100)
        }
        return JSONObject().put("percent", Settings.System.getInt(resolver, Settings.System.SCREEN_BRIGHTNESS, 128) * 100 / 255)
    }

    fun speak(json: JSONObject): JSONObject {
        val text = json.optString("text").take(500)
        if (text.isBlank()) error("text is required")
        val engine = tts ?: TextToSpeech(ctx) { }.also { tts = it }
        // The engine starts asynchronously: give it a moment the first time.
        Thread.sleep(if (tts === engine && !engine.isSpeaking) 600 else 0)
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "deck")
        return JSONObject().put("spoken", true)
    }
}
