package dev.epersonf.deck

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.io.File
import java.io.FileWriter

enum class DeckState { STOPPED, INSTALLING, STARTING, RUNNING, RESTARTING }

/** Foreground service: keeps the deck (Node inside proot) alive, restarts it when it exits. */
class DeckService : Service() {

    companion object {
        const val ACTION_STOP = "dev.epersonf.deck.STOP"
        @Volatile var state = DeckState.STOPPED
        @Volatile var status: String = ""
        @Volatile var running = false
    }

    private lateinit var env: Env
    private var worker: Thread? = null
    private var wake: PowerManager.WakeLock? = null
    private var wifi: WifiManager.WifiLock? = null
    @Volatile private var proc: Process? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        env = Env(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            shutdown()
            return START_NOT_STICKY
        }
        startForeground(1, notification(getString(R.string.state_starting)))
        if (worker == null) {
            runCatching { env.logFile.delete() }
            acquireLocks()
            running = true
            worker = Thread({ loop() }, "deck-supervisor").also { it.start() }
        }
        return START_STICKY
    }

    private fun log(line: String) {
        try {
            FileWriter(env.logFile, true).use { it.appendLine(line) }
            if (env.logFile.length() > 2_000_000) {
                val tail = env.logFile.readText().takeLast(500_000)
                env.logFile.writeText(tail)
            }
        } catch (_: Exception) {}
    }

    private fun setStatus(st: DeckState, s: String) {
        state = st
        status = s
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(1, notification(s))
    }

    private fun loop() {
        var fails = 0
        val installer = Installer(this, env, ::log)
        while (running) {
            try {
                setStatus(DeckState.INSTALLING, getString(R.string.state_installing))
                if (!installer.ensure()) { fails++; countdown(20); continue }
                val extra = mutableMapOf("DECK_PORT" to env.port.toString())
                if (env.exposed && env.password.isNotEmpty()) {
                    extra["DECK_HOST"] = env.host
                    extra["DECK_PASSWORD"] = env.password
                } else {
                    extra["DECK_HOST"] = Env.LOOPBACK
                }
                setStatus(DeckState.STARTING, getString(R.string.state_starting))
                val started = System.currentTimeMillis()
                log(env.en.getString(R.string.log_starting, java.util.Date().toString()))
                val p = env.prootCommand("bash /opt/run.sh", extra).start()
                proc = p
                Thread {
                    p.inputStream.bufferedReader().forEachLine { l ->
                        log(l)
                        if (l.contains("Server listening")) setStatus(DeckState.RUNNING, getString(R.string.state_running, env.port))
                    }
                }.start()
                val rc = p.waitFor()
                proc = null
                val up = (System.currentTimeMillis() - started) / 1000
                log(env.en.getString(R.string.log_exited, rc, up))
                fails = if (up < 30) fails + 1 else 0
            } catch (e: Exception) {
                log(env.en.getString(R.string.log_error, e.toString()))
                fails++
            }
            if (!running) break
            countdown(minOf(30, 3 * (fails + 1)))
        }
        setStatus(DeckState.STOPPED, getString(R.string.state_stopped))
    }

    /** Live "restarting in Ns" status, updated every second. */
    private fun countdown(seconds: Int) {
        try {
            for (left in seconds downTo 1) {
                if (!running) return
                setStatus(DeckState.RESTARTING, getString(R.string.state_restarting, left))
                Thread.sleep(1000)
            }
        } catch (_: InterruptedException) {}
    }

    private fun shutdown() {
        running = false
        proc?.destroy()
        worker?.interrupt()
        worker = null
        releaseLocks()
        state = DeckState.STOPPED
        status = getString(R.string.state_stopped)
        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        proc?.destroy()
        releaseLocks()
        super.onDestroy()
    }

    private fun acquireLocks() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "deck:server").also { it.acquire() }
        val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        wifi = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "deck:wifi").also { it.acquire() }
    }

    private fun releaseLocks() {
        try { wake?.takeIf { it.isHeld }?.release() } catch (_: Exception) {}
        try { wifi?.takeIf { it.isHeld }?.release() } catch (_: Exception) {}
    }

    private fun notification(text: String): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel("deck", getString(R.string.app_name), NotificationManager.IMPORTANCE_LOW))
        }
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(
            this, 1, Intent(this, DeckService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "deck") else @Suppress("DEPRECATION") Notification.Builder(this)
        return b.setContentTitle(getString(R.string.app_name)).setContentText(text)
            .setSmallIcon(R.drawable.ic_gear).setContentIntent(open)
            .addAction(Notification.Action.Builder(null, getString(R.string.notif_stop), stop).build())
            .setOngoing(true).build()
    }
}
