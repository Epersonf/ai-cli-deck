package dev.epersonf.deck

import android.content.Context
import android.net.wifi.WifiManager
import android.os.PowerManager

/** Wake + Wi-Fi locks held while the server runs, so the phone does not sleep it away. */
class DeckLocks(private val ctx: Context) {
    private var wake: PowerManager.WakeLock? = null
    private var wifi: WifiManager.WifiLock? = null

    fun acquire() {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "deck:server").also { it.acquire() }
        val wm = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        wifi = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "deck:wifi").also { it.acquire() }
    }

    fun release() {
        try { wake?.takeIf { it.isHeld }?.release() } catch (_: Exception) {}
        try { wifi?.takeIf { it.isHeld }?.release() } catch (_: Exception) {}
    }
}
