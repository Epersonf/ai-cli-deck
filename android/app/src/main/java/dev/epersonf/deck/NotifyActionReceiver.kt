package dev.epersonf.deck

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.net.HttpURLConnection
import java.net.URL

/**
 * A button on a notification the deck sent (Approve / Reject): calls the one-time address that came with it, on this
 * phone only, then removes the notification.
 */
class NotifyActionReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val url = intent.getStringExtra("url") ?: return
        val host = runCatching { URL(url).host }.getOrNull()
        if (host != "127.0.0.1" && host != "localhost") return
        val nid = intent.getIntExtra("nid", -1)
        val pending = goAsync()
        Thread {
            try {
                val c = URL(url).openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.connectTimeout = 5000
                c.readTimeout = 20000
                c.doOutput = true
                c.setFixedLengthStreamingMode(0)
                c.outputStream.close()
                c.responseCode
                c.disconnect()
            } catch (_: Exception) {
                // the deck is not reachable: the notification stays so the person can open the app instead
            } finally {
                if (nid >= 0) (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(nid)
                pending.finish()
            }
        }.start()
    }
}
