package dev.epersonf.deck

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.Switch
import android.widget.Toast

/**
 * "Phone access". Off by default. The master switch needs a plain-words warning and two confirmations. Under it
 * every capability is its own checkbox, grouped by risk, each with its own warning and its own permission request:
 * nothing is granted by turning the master switch on alone. The choices are saved with the rest of the settings.
 */
class PhoneAccessCard(private val act: Activity, env: Env) {
    private val filesModes = listOf("off", "shared", "all")
    private var reverting = false
    private val boxes = LinkedHashMap<String, CheckBox>()

    private fun hint(res: Int) = Ui.body(act, act.getString(res), muted = true).apply { textSize = 12f }
    private fun label(text: String, color: Int, top: Int = 12) =
        Ui.heading(act, text, 11f).apply { setTextColor(act.getColor(color)); layoutParams = Ui.lp(top = top) }

    private val master = Switch(act).apply {
        text = act.getString(R.string.setting_phone); isChecked = env.phoneAccess
        setTextColor(act.getColor(R.color.parchment)); layoutParams = Ui.lp(top = 6)
    }
    private val files = Spinner(act).apply {
        adapter = ArrayAdapter(act, android.R.layout.simple_spinner_dropdown_item,
            listOf(R.string.files_off, R.string.files_shared, R.string.files_all).map { act.getString(it) })
        setSelection(filesModes.indexOf(env.phoneFiles).coerceAtLeast(0))
    }
    private val more = LinearLayout(act).apply {
        orientation = LinearLayout.VERTICAL
        visibility = if (env.phoneAccess) View.VISIBLE else View.GONE
        for ((risk, color, title) in listOf(Triple(Risk.LOW, R.color.verdigris, R.string.risk_low), Triple(Risk.MEDIUM, R.color.amber, R.string.risk_medium), Triple(Risk.HIGH, R.color.danger, R.string.risk_high))) {
            addView(label(act.getString(title), color))
            for (cap in PhoneCaps.all.filter { it.risk == risk }) {
                val box = CheckBox(act).apply { text = act.getString(cap.label); isChecked = env.cap(cap.id); setTextColor(act.getColor(R.color.parchment)) }
                boxes[cap.id] = box
                addView(box); addView(hint(cap.hint))
                box.setOnClickListener { if (box.isChecked) warn(cap) else Unit }
            }
        }
        addView(label(act.getString(R.string.setting_phone_files), R.color.amber))
        addView(files); addView(hint(R.string.setting_phone_files_hint))
    }

    val enabled: Boolean get() = master.isChecked
    val filesMode: String get() = filesModes[files.selectedItemPosition]
    fun selected(): Set<String> = boxes.filterValues { it.isChecked }.keys

    val view: LinearLayout = Ui.card(act).apply {
        addView(Ui.heading(act, act.getString(R.string.section_phone), 11f))
        addView(master); addView(hint(R.string.setting_phone_hint)); addView(more)
        // Listening to clicks (not to every change) keeps our own undo from re-opening the dialogs.
        master.setOnClickListener {
            if (!master.isChecked) more.visibility = View.GONE
            else Ui.dialog(act, act.getString(R.string.phone_warn_title), act.getString(R.string.phone_warn_body), act.getString(R.string.phone_continue), act.getString(android.R.string.cancel), { confirmAgain() }, { master.isChecked = false })
        }
        files.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (reverting || pos == 0) { reverting = false; return }
                val body = if (pos == 1) R.string.phone_files_shared_body else R.string.phone_files_all_body
                Ui.dialog(act, act.getString(R.string.phone_files_warn_title), act.getString(body), act.getString(R.string.phone_enable), act.getString(android.R.string.cancel),
                    { ask(FILES, listOf(android.Manifest.permission.READ_EXTERNAL_STORAGE, android.Manifest.permission.WRITE_EXTERNAL_STORAGE)) }, { revertFiles() })
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    private fun revertFiles() { reverting = true; files.setSelection(0) }

    private fun confirmAgain() {
        Ui.dialog(act, act.getString(R.string.phone_confirm_title), act.getString(R.string.phone_confirm_body), act.getString(R.string.phone_enable), act.getString(android.R.string.cancel),
            { more.visibility = View.VISIBLE; checkNotifications() }, { master.isChecked = false })
    }

    /** One capability's warning (its own text, then the one for its risk), then what Android needs to allow it. */
    private fun warn(cap: Cap) {
        val (title, body) = when (cap.risk) {
            Risk.LOW -> R.string.phone_cap_title_low to R.string.phone_cap_body_low
            Risk.MEDIUM -> R.string.phone_cap_title_medium to R.string.phone_cap_body_medium
            Risk.HIGH -> R.string.phone_cap_title_high to R.string.phone_cap_body_high
        }
        val text = "${act.getString(cap.label)}\n${act.getString(cap.hint)}\n\n${act.getString(body)}"
        Ui.dialog(act, act.getString(title), text, act.getString(R.string.phone_enable), act.getString(android.R.string.cancel),
            { enable(cap) }, { boxes[cap.id]?.isChecked = false })
    }

    private fun enable(cap: Cap) {
        if (cap.confirm || cap.id == "wifi") checkNotifications()
        if (cap.special && !Settings.System.canWrite(act)) {
            Toast.makeText(act, R.string.phone_special_page, Toast.LENGTH_LONG).show()
            act.startActivity(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:${act.packageName}")))
        }
        if (cap.permissions.isNotEmpty()) ask(100 + PhoneCaps.all.indexOf(cap), cap.permissions)
    }

    private fun ask(code: Int, permissions: List<String>) {
        val missing = permissions.filter { act.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) onPermissionResult(code, true) else act.requestPermissions(missing.toTypedArray(), code)
    }

    /** Called by the settings screen with the answer to a permission request. */
    fun onPermissionResult(code: Int, granted: Boolean) {
        if (code == FILES && granted && Build.VERSION.SDK_INT >= 30 && !Environment.isExternalStorageManager()) {
            // Newer Android keeps most files behind a separate "All files access" page.
            Toast.makeText(act, R.string.phone_files_allfiles, Toast.LENGTH_LONG).show()
            act.startActivity(Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${act.packageName}")))
            return
        }
        if (granted) return
        Toast.makeText(act, R.string.phone_permission_denied, Toast.LENGTH_LONG).show()
        if (code == FILES) revertFiles() else PhoneCaps.all.getOrNull(code - 100)?.let { boxes[it.id]?.isChecked = false }
    }

    /** Notifications are how agents reach you and how you answer their requests: make sure Android allows them. */
    private fun checkNotifications() {
        val nm = act.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.areNotificationsEnabled()) return
        Toast.makeText(act, R.string.phone_notif_off, Toast.LENGTH_LONG).show()
        act.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, act.packageName))
    }

    companion object { const val FILES = 22 }
}
