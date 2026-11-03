package dev.epersonf.deck

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.Switch
import android.widget.Toast

/** Server settings: port, bind host, password, auto-start, battery exemption and interface language. */
class SettingsActivity : Activity() {

    private lateinit var env: Env
    private lateinit var port: EditText
    private lateinit var host: EditText
    private lateinit var password: EditText
    private lateinit var auto: Switch
    private lateinit var lang: Spinner
    private val codes = listOf<String?>(null) + Lang.ALL.map { it.first }

    override fun attachBaseContext(base: Context) = super.attachBaseContext(Lang.wrap(base))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.DeckTheme)
        env = Env(this)
        val pad = Ui.dp(this, 18)
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        col.addView(Ui.heading(this, getString(R.string.section_settings), 22f))
        col.addView(networkCard())
        col.addView(behaviorCard())
        col.addView(Ui.button(this, getString(R.string.setting_save), primary = true) { save() }
            .also { it.layoutParams = Ui.lp(top = 16) })
        setContentView(ScrollView(this).apply { addView(col) })
    }

    private fun networkCard(): LinearLayout {
        val card = Ui.card(this)
        card.addView(Ui.heading(this, getString(R.string.section_network), 11f))
        port = Ui.input(this, getString(R.string.setting_port)).apply {
            inputType = InputType.TYPE_CLASS_NUMBER; setText(env.port.toString())
        }
        host = Ui.input(this, getString(R.string.setting_host)).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI; setText(env.host)
        }
        password = Ui.input(this, getString(R.string.password_hint)).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD; setText(env.password)
        }
        card.addView(label(R.string.setting_port)); card.addView(port)
        card.addView(label(R.string.setting_host)); card.addView(host)
        card.addView(Ui.body(this, getString(R.string.setting_host_hint), muted = true).apply { textSize = 12f })
        card.addView(label(R.string.password_hint)); card.addView(password)
        return card
    }

    private fun behaviorCard(): LinearLayout {
        val card = Ui.card(this)
        card.addView(Ui.heading(this, getString(R.string.section_behavior), 11f))
        auto = Switch(this).apply {
            text = getString(R.string.autostart); isChecked = env.prefs.getBoolean("autostart", true)
            setTextColor(getColor(R.color.parchment)); layoutParams = Ui.lp(top = 6)
        }
        card.addView(auto)
        card.addView(label(R.string.setting_language))
        val names = listOf(getString(R.string.language_system)) + Lang.ALL.map { it.second }
        lang = Spinner(this).apply {
            adapter = ArrayAdapter(this@SettingsActivity, android.R.layout.simple_spinner_dropdown_item, names)
            setSelection(codes.indexOf(Lang.saved(this@SettingsActivity)).coerceAtLeast(0))
        }
        card.addView(lang)
        card.addView(Ui.button(this, getString(R.string.battery)) { requestBatteryExemption() }
            .also { it.layoutParams = Ui.lp(top = 10) })
        return card
    }

    private fun save() {
        val p = port.text.toString().toIntOrNull()
        val h = host.text.toString().trim().ifEmpty { Env.LOOPBACK }
        val exposed = h != Env.LOOPBACK && h != "localhost"
        if (p == null || p !in 1024..65535) return toast(R.string.err_port)
        if (exposed && password.text.isEmpty()) return toast(R.string.err_host_password)
        val newLang = codes[lang.selectedItemPosition]
        val langChanged = newLang != Lang.saved(this)
        env.prefs.edit().putInt("port", p).putString("host", h)
            .putString("password", password.text.toString())
            .putBoolean("autostart", auto.isChecked)
            .also { if (newLang == null) it.remove("lang") else it.putString("lang", newLang) }
            .apply()
        toast(R.string.setting_saved)
        if (langChanged) {
            startActivity(Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        finish()
    }

    private fun label(res: Int) = Ui.body(this, getString(res), muted = true).apply {
        textSize = 12f; layoutParams = Ui.lp(top = 8)
    }

    private fun toast(res: Int) = Toast.makeText(this, res, Toast.LENGTH_LONG).show()

    private fun requestBatteryExemption() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (pm.isIgnoringBatteryOptimizations(packageName)) return
        @Suppress("BatteryLife")
        startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
    }
}
