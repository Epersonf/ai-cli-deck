package dev.epersonf.deck

import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * The Reply box of a chat notification: sends what was typed to the one-time address that came with it (this phone
 * only), then drops the notification the way a messenger does once you answer.
 */
class NotifyReplyReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val url = intent.getStringExtra("url") ?: return
        val host = runCatching { URL(url).host }.getOrNull()
        if (host != "127.0.0.1" && host != "localhost") return
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY)?.toString()?.trim().orEmpty()
        if (text.isEmpty()) return
        val chat = intent.getStringExtra("chat")
        val pending = goAsync()
        Thread {
            var sent = false
            try {
                val c = URL(url).openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.connectTimeout = 5000
                c.readTimeout = 20000
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(JSONObject().put("text", text).toString().toByteArray()) }
                sent = c.responseCode in 200..299
                c.disconnect()
            } catch (_: Exception) {
                // the deck is not reachable: the notification stays so the person can open the app instead
            } finally {
                if (chat != null && sent) PhoneApi.clearChat(ctx, chat)
                val message = if (sent) R.string.notif_reply_sent else R.string.notif_reply_failed
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    Toast.makeText(ctx, message, Toast.LENGTH_SHORT).show()
                }
                pending.finish()
            }
        }.start()
    }

    companion object { const val KEY = "reply" }
}
