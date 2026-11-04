package dev.epersonf.deck

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import java.io.File

/** Facts about the device and the app, written at the top of every run so a pasted log explains itself. */
object DeckDiagnostics {

    @Suppress("DEPRECATION")
    fun header(ctx: Context, env: Env, log: (String) -> Unit) {
        val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
        log("[info] CLI Deck ${info.versionName} (code ${info.versionCode}) | deck assets ${assetVersion(ctx)}")
        log("[info] Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT}) | ${Build.MANUFACTURER} ${Build.MODEL} | ABI ${Build.SUPPORTED_ABIS.joinToString()}")
        val mem = ActivityManager.MemoryInfo().also {
            (ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).getMemoryInfo(it)
        }
        log("[info] memory: ${mem.availMem shr 20} MB free of ${mem.totalMem shr 20} MB (low=${mem.lowMemory}) | storage free: ${env.base.usableSpace shr 20} MB")
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        log("[info] battery optimization ignored=${pm.isIgnoringBatteryOptimizations(ctx.packageName)} | language=${Lang.saved(ctx) ?: "system"}")
        val password = if (env.password.isEmpty()) "none" else "set"
        log("[info] settings: port=${env.port} host=${env.host} exposed=${env.exposed} password=$password verbose=${env.verbose}")
        log("[info] rootfs present=${File(env.rootfs, "usr/bin/bash").exists()} deck installed=${File(env.rootfs, "opt/.deck-installed").exists()}")
        if (env.verbose) {
            File(env.nativeDir).listFiles()?.sortedBy { it.name }?.forEach {
                log("[verbose] native lib ${it.name} ${it.length()} bytes executable=${it.canExecute()}")
            }
        }
    }

    private fun assetVersion(ctx: Context): String =
        try { ctx.assets.open("deck-version.txt").use { it.readBytes().decodeToString().trim() } } catch (_: Exception) { "?" }
}
