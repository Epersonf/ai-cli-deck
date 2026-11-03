package dev.epersonf.deck

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Minimal control panel: start/stop, open the deck, LAN access + password, battery exemption, log. */
class MainActivity : Activity() {

    private lateinit var env: Env
    private lateinit var statusView: TextView
    private lateinit var logView: TextView
    private lateinit var scroll: ScrollView
    private val handler = Handler(Looper.getMainLooper())

    private val tick = object : Runnable {
        override fun run() {
            statusView.text = "Estado: ${DeckService.status}"
            val text = try {
                env.logFile.takeIf { it.exists() }?.readText()?.takeLast(6000) ?: ""
            } catch (_: Exception) { "" }
            if (text != logView.text.toString()) {
                logView.text = text
                scroll.post { scroll.fullScroll(ScrollView.FOCUS_DOWN) }
            }
            handler.postDelayed(this, 1500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        env = Env(this)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }

        statusView = TextView(this).apply { textSize = 18f }
        root.addView(statusView)

        fun button(label: String, action: () -> Unit) = Button(this).apply {
            text = label; setOnClickListener { action() }
        }.also { root.addView(it) }

        button("Iniciar") { startDeck() }
        button("Parar") {
            startService(Intent(this, DeckService::class.java).setAction(DeckService.ACTION_STOP))
        }
        button("Abrir o deck no navegador") {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("http://127.0.0.1:${env.port}/")))
        }
        button("Isentar da otimização de bateria") { requestBatteryExemption() }

        root.addView(CheckBox(this).apply {
            text = "Iniciar automaticamente ao ligar o celular"
            isChecked = env.prefs.getBoolean("autostart", true)
            setOnCheckedChangeListener { _, v -> env.prefs.edit().putBoolean("autostart", v).apply() }
        })
        root.addView(CheckBox(this).apply {
            text = "Aceitar conexões da rede (PC/outros aparelhos) — exige senha"
            isChecked = env.exposeLan
            setOnCheckedChangeListener { _, v -> env.prefs.edit().putBoolean("lan", v).apply() }
        })
        root.addView(EditText(this).apply {
            hint = "Senha do deck (para acesso pela rede)"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setText(env.password)
            addTextChangedListener(object : android.text.TextWatcher {
                override fun afterTextChanged(s: android.text.Editable?) {
                    env.prefs.edit().putString("password", s.toString()).apply()
                }
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            })
        })
        root.addView(TextView(this).apply { text = "Mudanças de rede/senha valem após Parar → Iniciar." })

        logView = TextView(this).apply { typeface = android.graphics.Typeface.MONOSPACE; textSize = 11f }
        scroll = ScrollView(this).apply {
            addView(logView)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        root.addView(scroll)
        setContentView(root)

        if (env.prefs.getBoolean("autostart", true) && !DeckService.running) startDeck()
    }

    override fun onResume() { super.onResume(); handler.post(tick) }
    override fun onPause() { super.onPause(); handler.removeCallbacks(tick) }

    private fun startDeck() {
        val i = Intent(this, DeckService::class.java)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
    }

    private fun requestBatteryExemption() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (pm.isIgnoringBatteryOptimizations(packageName)) return
        @Suppress("BatteryLife")
        startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
    }
}
