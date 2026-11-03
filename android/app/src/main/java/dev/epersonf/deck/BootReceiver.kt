package dev.epersonf.deck

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/** Starts the deck after boot / app update, if the user left auto-start on (default). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (!Env(ctx).prefs.getBoolean("autostart", true)) return
        val i = Intent(ctx, DeckService::class.java)
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
    }
}
