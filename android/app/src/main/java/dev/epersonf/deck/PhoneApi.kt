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
    fun notify(title: String, text: String, actions: List<NotifyAction> = emptyList()): String? {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return "Notifications are off for this app in Android settings"
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel("phone", ctx.getString(R.string.phone_channel), NotificationManager.IMPORTANCE_DEFAULT))
        }
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, "phone") else @Suppress("DEPRECATION") Notification.Builder(ctx)
        val id = nextId++
        b.setContentTitle(title.take(80).ifBlank { ctx.getString(R.string.app_name) })
            .setContentText(text.take(400)).setStyle(Notification.BigTextStyle().bigText(text.take(400)))
            .setSmallIcon(R.drawable.ic_gear).setAutoCancel(true)
        // Buttons that call a one-time address of the deck (see [NotifyActionReceiver]); at most three fit.
        actions.take(3).forEachIndexed { index, action ->
            val intent = Intent(ctx, NotifyActionReceiver::class.java).putExtra("url", action.url).putExtra("nid", id)
            val press = android.app.PendingIntent.getBroadcast(ctx, id * 4 + index, intent,
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT)
            b.addAction(Notification.Action.Builder(null, action.label, press).build())
        }
        nm.notify(id, b.build())
        return null
    }
}

/** A button on a notification: its label and the address it calls. */
class NotifyAction(val label: String, val url: String)
