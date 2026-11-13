package dev.epersonf.deck

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import org.json.JSONObject

/** What the phone bridge can do for the agents: read the battery and device, and show a notification. */
class PhoneApi(private val ctx: Context) {
    private var nextId = 1000

    fun string(id: Int): String = ctx.getString(id)

    fun battery(): JSONObject {
        val i = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = i?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = i?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = i?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = i?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        return JSONObject()
            .put("percent", if (level < 0) JSONObject.NULL else level * 100 / scale)
            .put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
            .put("plugged", when {
                plugged and BatteryManager.BATTERY_PLUGGED_AC != 0 -> "ac"
                plugged and BatteryManager.BATTERY_PLUGGED_USB != 0 -> "usb"
                plugged and BatteryManager.BATTERY_PLUGGED_WIRELESS != 0 -> "wireless"
                else -> "none"
            })
            .put("temperatureC", (i?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10.0)
            .put("voltageMv", i?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) ?: 0)
    }

    fun device(): JSONObject = JSONObject()
        .put("manufacturer", Build.MANUFACTURER)
        .put("model", Build.MODEL)
        .put("android", Build.VERSION.RELEASE)
        .put("sdk", Build.VERSION.SDK_INT)

    /** Returns null when shown, or the reason it could not be. */
    fun notify(title: String, text: String, actions: List<NotifyAction> = emptyList(), chat: String? = null, replyUrl: String? = null): String? {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return "Notifications are off for this app in Android settings"
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel("phone", ctx.getString(R.string.phone_channel), NotificationManager.IMPORTANCE_DEFAULT))
        }
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, "phone") else @Suppress("DEPRECATION") Notification.Builder(ctx)
        // One notification per chat, like a messenger: a new one replaces the last and counts the unread ones.
        val id = if (chat == null) nextId++ else 1
        val tag = chat?.let { chatTag(it) }
        val unread = if (chat == null) 0 else counts.merge(chat, 1, Int::plus) ?: 1
        val open = Intent(ctx, DeckActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        chat?.let { open.putExtra("chat", it) }
        val tap = android.app.PendingIntent.getActivity(ctx, (chat ?: "").hashCode(), open,
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT)
        b.setContentTitle(title.take(80).ifBlank { ctx.getString(R.string.app_name) })
            .setContentText(text.take(400)).setStyle(Notification.BigTextStyle().bigText(text.take(400)))
            .setSmallIcon(R.drawable.ic_gear).setAutoCancel(true).setContentIntent(tap)
        if (unread > 1) b.setNumber(unread)
        // Buttons that call a one-time address of the deck (see [NotifyActionReceiver]); at most three fit.
        actions.take(3).forEachIndexed { index, action ->
            val intent = Intent(ctx, NotifyActionReceiver::class.java).putExtra("url", action.url).putExtra("nid", id)
            val press = android.app.PendingIntent.getBroadcast(ctx, id * 4 + index, intent,
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT)
            b.addAction(Notification.Action.Builder(null, action.label, press).build())
        }
        // A Reply box like a messenger's: the typed text goes to the chat through the one-time address.
        if (replyUrl != null && chat != null && Build.VERSION.SDK_INT >= 24) {
            val input = android.app.RemoteInput.Builder(NotifyReplyReceiver.KEY).setLabel(ctx.getString(R.string.notif_reply_hint)).build()
            val send = Intent(ctx, NotifyReplyReceiver::class.java).putExtra("url", replyUrl).putExtra("chat", chat)
            // RemoteInput needs a mutable intent to carry the typed text back.
            val flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= 31) android.app.PendingIntent.FLAG_MUTABLE else 0)
            val press = android.app.PendingIntent.getBroadcast(ctx, chat.hashCode() xor 0x5E91, send, flags)
            b.addAction(Notification.Action.Builder(null, ctx.getString(R.string.notif_reply), press).addRemoteInput(input).build())
        }
        nm.notify(tag, id, b.build())
        return null
    }

    companion object {
        private val counts = java.util.concurrent.ConcurrentHashMap<String, Int>()
        private fun chatTag(chat: String) = "chat:$chat"

        /** The person is in this chat: its notification and unread count are gone. */
        fun clearChat(ctx: Context, chat: String) {
            counts.remove(chat)
            (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(chatTag(chat), 1)
        }
    }
}

/** A button on a notification: its label and the address it calls. */
class NotifyAction(val label: String, val url: String)
