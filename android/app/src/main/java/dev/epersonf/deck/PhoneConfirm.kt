package dev.epersonf.deck

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Asks the person holding the phone before an agent changes something (Wi-Fi). A notification with Allow and Deny
 * buttons; no answer within the time limit counts as Deny. The agent's request waits for the answer.
 */
class PhoneConfirm(private val ctx: Context) {
    private val counter = AtomicInteger(5000)

    fun ask(message: String, timeoutSeconds: Long = 30): Boolean {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return false
        val id = counter.incrementAndGet()
        val action = "${ctx.packageName}.CONFIRM.$id"
        val latch = CountDownLatch(1)
        var allowed = false
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { allowed = i.getBooleanExtra("allow", false); latch.countDown() }
        }
        ctx.registerReceiver(receiver, IntentFilter(action))
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                nm.createNotificationChannel(NotificationChannel("confirm", ctx.getString(R.string.phone_confirm_channel), NotificationManager.IMPORTANCE_HIGH))
            }
            fun button(allow: Boolean, label: Int) = Notification.Action.Builder(
                null, ctx.getString(label),
                PendingIntent.getBroadcast(ctx, id * 2 + (if (allow) 1 else 0),
                    Intent(action).setPackage(ctx.packageName).putExtra("allow", allow),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            ).build()
            val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, "confirm") else @Suppress("DEPRECATION") Notification.Builder(ctx)
            nm.notify(id, b.setContentTitle(ctx.getString(R.string.app_name)).setContentText(message)
                .setStyle(Notification.BigTextStyle().bigText(message)).setSmallIcon(R.drawable.ic_gear)
                .addAction(button(true, R.string.phone_allow)).addAction(button(false, R.string.phone_deny))
                .setTimeoutAfter(timeoutSeconds * 1000).build())
            latch.await(timeoutSeconds, TimeUnit.SECONDS)
        } finally {
            runCatching { ctx.unregisterReceiver(receiver) }
            nm.cancel(id)
        }
        return allowed
    }
}
