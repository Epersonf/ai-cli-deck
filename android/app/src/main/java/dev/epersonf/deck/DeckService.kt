package dev.epersonf.deck

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder

/** Foreground service: keeps the deck (Node inside proot) alive, restarts it when it exits. */
class DeckService : Service() {

    companion object {
        const val ACTION_STOP = "dev.epersonf.deck.STOP"
        @Volatile var state = DeckState.STOPPED
        /** Port while running, seconds left while restarting. */
        @Volatile var arg = 0
        @Volatile var running = false
    }

    private lateinit var env: Env
    private lateinit var ui: Context
    private var worker: Thread? = null
    /** Bumped on every stop so a supervisor that is still winding down can never act on a newer run. */
    @Volatile private var generation = 0
    private val locks by lazy { DeckLocks(this) }
    @Volatile private var proc: Process? = null
    @Volatile private var installer: Installer? = null
    /** Lets the agents reach the phone; only exists while "Phone access" is on. */
    @Volatile private var phone: PhoneBridge? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        env = Env(this)
        ui = Lang.wrap(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            shutdown()
            return START_NOT_STICKY
        }
        startForeground(1, DeckNotification.build(this, ui, DeckState.STARTING.label(ui)))
        if (worker == null) {
            runCatching { env.logFile.delete() }
            locks.acquire()
            running = true
            val gen = ++generation
            worker = Thread({ loop(gen) }, "deck-supervisor").also { it.start() }
        }
        return START_STICKY
    }

    private fun alive(gen: Int) = running && gen == generation

    private fun log(line: String) = env.appendLog(line)

    private fun setStatus(gen: Int, st: DeckState, a: Int = 0) {
        if (!alive(gen)) return
        state = st
        arg = a
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(1, DeckNotification.build(this, ui, st.label(ui, a)))
    }

    private fun loop(gen: Int) {
        var fails = 0
        val installer = Installer(this, env, ::log).also { this.installer = it }
        DeckDiagnostics.header(ui, env, ::log)
        while (alive(gen)) {
            try {
                setStatus(gen, DeckState.INSTALLING)
                if (!installer.ensure()) { fails++; countdown(gen, 20); continue }
                if (env.phoneAccess && phone == null) phone = PhoneBridge(this, env).also { it.start() }
                val extra = env.serverEnv(phone)
                setStatus(gen, DeckState.STARTING)
                val started = System.currentTimeMillis()
                log(env.en.getString(R.string.log_starting, java.util.Date().toString()))
                val p = env.prootCommand("bash /opt/run.sh", extra).start()
                proc = p
                readOutput(gen, p)
                val rc = p.waitFor()
                proc = null
                val up = (System.currentTimeMillis() - started) / 1000
                log(env.en.getString(R.string.log_exited, rc, up))
                fails = if (up < 30) fails + 1 else 0
            } catch (e: Exception) {
                if (!alive(gen)) break
                log(env.en.getString(R.string.log_error, e.toString()))
                fails++
            }
            countdown(gen, minOf(30, 3 * (fails + 1)))
        }
        if (gen == generation) state = DeckState.STOPPED
    }

    /** Pumps the server output into the log. Destroying the process closes the stream: that is not an error. */
    private fun readOutput(gen: Int, p: Process) {
        Thread {
            try {
                p.inputStream.bufferedReader().forEachLine { l ->
                    log(l)
                    if (l.contains("Server listening")) setStatus(gen, DeckState.RUNNING, env.port)
                }
            } catch (_: Exception) {}
        }.start()
    }

    /** Live "restarting in Ns" status, updated every second. */
    private fun countdown(gen: Int, seconds: Int) {
        try {
            for (left in seconds downTo 1) {
                if (!alive(gen)) return
                setStatus(gen, DeckState.RESTARTING, left)
                Thread.sleep(1000)
            }
        } catch (_: InterruptedException) {}
    }

    /** Stops the server and the service; the app (its screens) keeps running. */
    private fun shutdown() {
        running = false
        generation++
        proc?.let { killHard(it) }
        installer?.cancel()
        phone?.stop(); phone = null
        worker?.interrupt()
        worker = null
        locks.release()
        state = DeckState.STOPPED
        arg = 0
        stopForeground(true)
        stopSelf()
    }

    /** SIGTERM first; if proot is still alive shortly after, SIGKILL (its --kill-on-exit then takes the server down). */
    private fun killHard(p: Process) {
        p.destroy()
        Thread { try { Thread.sleep(2000) } catch (_: InterruptedException) {}; if (p.isAlive) p.destroyForcibly() }.start()
    }

    override fun onDestroy() {
        running = false
        generation++
        proc?.let { killHard(it) }
        installer?.cancel()
        phone?.stop(); phone = null
        locks.release()
        super.onDestroy()
    }
}
