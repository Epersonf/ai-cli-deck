package dev.epersonf.deck

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.View
import android.view.animation.Animation
import android.view.animation.LinearInterpolator
import android.view.animation.RotateAnimation
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** CLI Deck home: brand, server status, Open Deck, start/stop and the log. Settings live in SettingsActivity. */
class MainActivity : Activity() {

    private lateinit var env: Env
    private lateinit var statusView: TextView
    private lateinit var dot: View
    private lateinit var logView: TextView
    private lateinit var logScroll: ScrollView
    private var lastLog = ""
    private val handler = Handler(Looper.getMainLooper())

    override fun attachBaseContext(base: Context) = super.attachBaseContext(Lang.wrap(base))

    private val tick = object : Runnable {
        override fun run() {
            statusView.text = DeckService.status.ifEmpty { getString(R.string.state_stopped) }
            val color = when (DeckService.state) {
                DeckState.RUNNING -> R.color.verdigris
                DeckState.STOPPED -> R.color.danger
                else -> R.color.amber
            }
            dot.background.setTint(getColor(color))
            val text = try {
                env.logFile.takeIf { it.exists() }?.readText()?.takeLast(6000) ?: ""
            } catch (_: Exception) { "" }
            if (text != lastLog) {
                lastLog = text
                logView.text = colorize(text)
                logScroll.post { logScroll.fullScroll(ScrollView.FOCUS_DOWN) }
            }
            handler.postDelayed(this, 1500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.DeckTheme)
        env = Env(this)
        val pad = Ui.dp(this, 18)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }

        root.addView(brand())
        root.addView(statusCard())
        root.addView(Ui.button(this, getString(R.string.open_deck), primary = true) { openDeck() }
            .also { it.layoutParams = Ui.lp(top = 14) })

        val controls = LinearLayout(this).apply { layoutParams = Ui.lp(top = 8) }
        fun half(label: String, action: () -> Unit) {
            controls.addView(Ui.button(this, label) { action() }.also {
                it.layoutParams = LinearLayout.LayoutParams(0, -2, 1f).apply {
                    marginEnd = Ui.dp(this@MainActivity, 4); marginStart = Ui.dp(this@MainActivity, 4)
                }
            })
        }
        half(getString(R.string.start)) { startDeck() }
        half(getString(R.string.stop)) {
            startService(Intent(this, DeckService::class.java).setAction(DeckService.ACTION_STOP))
        }
        root.addView(controls)
        root.addView(Ui.button(this, getString(R.string.settings_open)) {
            startActivity(Intent(this, SettingsActivity::class.java))
        }.also { it.layoutParams = Ui.lp(top = 8) })
        root.addView(logCard())
        setContentView(root)

        if (env.prefs.getBoolean("autostart", true) && !DeckService.running) startDeck()
    }

    /** Copies the whole log file (not just the visible tail) so it can be pasted elsewhere. */
    private fun copyLog() {
        val full = try { env.logFile.takeIf { it.exists() }?.readText() ?: "" } catch (_: Exception) { "" }
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        cm.setPrimaryClip(android.content.ClipData.newPlainText("CLI Deck log", full))
        android.widget.Toast.makeText(this, R.string.log_copied, android.widget.Toast.LENGTH_SHORT).show()
    }

    private fun statusCard(): LinearLayout {
        val card = Ui.card(this)
        card.addView(Ui.heading(this, getString(R.string.section_status), 11f))
        val row = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL; layoutParams = Ui.lp(top = 4) }
        dot = Ui.dot(this, getColor(R.color.danger))
        statusView = Ui.body(this, "")
        row.addView(dot); row.addView(statusView)
        card.addView(row)
        return card
    }

    private fun logCard(): LinearLayout {
        val card = Ui.card(this)
        card.layoutParams = LinearLayout.LayoutParams(-1, 0, 1f).apply { topMargin = Ui.dp(this@MainActivity, 14) }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(Ui.heading(this, getString(R.string.section_log), 11f).apply {
            layoutParams = LinearLayout.LayoutParams(0, -2, 1f)
        })
        header.addView(Ui.button(this, getString(R.string.copy_log)) { copyLog() }.apply {
            textSize = 11f; minHeight = 0; minimumHeight = 0
            setPadding(Ui.dp(this@MainActivity, 12), Ui.dp(this@MainActivity, 6), Ui.dp(this@MainActivity, 12), Ui.dp(this@MainActivity, 6))
        })
        card.addView(header)
        logView = TextView(this).apply {
            typeface = android.graphics.Typeface.MONOSPACE; textSize = 11f; setTextColor(getColor(R.color.verdigris))
        }
        logScroll = ScrollView(this).apply {
            addView(logView)
            layoutParams = LinearLayout.LayoutParams(-1, 0, 1f).apply { topMargin = Ui.dp(this@MainActivity, 6) }
        }
        card.addView(logScroll)
        return card
    }

    /** Error lines (failures, non-zero exits, shell errors) in red. */
    private fun colorize(text: String): CharSequence {
        val errorWords = Regex("error|fail|fatal|exception|not found|invalid|cannot|denied|rc=[1-9]|unexpected", RegexOption.IGNORE_CASE)
        val sb = SpannableStringBuilder()
        for (line in text.lines()) {
            val start = sb.length
            sb.append(line).append('\n')
            if (errorWords.containsMatchIn(line)) {
                sb.setSpan(ForegroundColorSpan(getColor(R.color.danger)), start, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
        return sb
    }

    /** Spinning brass gear + CLI DECK title, like the web top bar. */
    private fun brand(): LinearLayout {
        val box = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        val size = Ui.dp(this, 52)
        val gear = ImageView(this).apply {
            setImageResource(R.drawable.ic_gear)
            layoutParams = LinearLayout.LayoutParams(size, size)
            startAnimation(RotateAnimation(0f, 360f, Animation.RELATIVE_TO_SELF, .5f, Animation.RELATIVE_TO_SELF, .5f).apply {
                duration = 24000; repeatCount = Animation.INFINITE; interpolator = LinearInterpolator()
            })
        }
        val names = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(Ui.dp(this@MainActivity, 14), 0, 0, 0)
            addView(Ui.heading(this@MainActivity, getString(R.string.app_name), 24f))
            addView(Ui.body(this@MainActivity, getString(R.string.tagline), muted = true))
        }
        box.addView(gear); box.addView(names)
        return box
    }

    override fun onResume() { super.onResume(); handler.post(tick) }
    override fun onPause() { super.onPause(); handler.removeCallbacks(tick) }

    private fun openDeck() {
        if (!DeckService.running) startDeck()
        startActivity(Intent(this, DeckActivity::class.java))
    }

    private fun startDeck() {
        val i = Intent(this, DeckService::class.java)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
    }
}
