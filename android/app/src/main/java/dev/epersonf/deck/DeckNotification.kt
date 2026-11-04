package dev.epersonf.deck

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/** The ongoing foreground notification: status text, tap to open the app, Stop action. */
object DeckNotification {
    /** [ctx] is the service; [ui] is its language-aware context used for the texts. */
    fun build(ctx: Context, ui: Context, text: String): Notification {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel("deck", ui.getString(R.string.app_name), NotificationManager.IMPORTANCE_LOW))
        }
        val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(
            ctx, 1, Intent(ctx, DeckService::class.java).setAction(DeckService.ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, "deck") else @Suppress("DEPRECATION") Notification.Builder(ctx)
        return b.setContentTitle(ui.getString(R.string.app_name)).setContentText(text)
            .setSmallIcon(R.drawable.ic_gear).setContentIntent(open)
            .addAction(Notification.Action.Builder(null, ui.getString(R.string.notif_stop), stop).build())
            .setOngoing(true).build()
    }
}
