package dev.epersonf.deck

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.Switch
import android.widget.Toast

/**
 * "Phone access". Off by default. The master switch needs a plain-words warning and two confirmations; Wi-Fi and
 * Files each have their own switch, their own warning and their own permission request. Nothing is granted by
 * turning on the master switch alone. The choices are saved with the rest of the settings.
 */
class PhoneAccessCard(private val act: Activity, env: Env) {
    private val modes = listOf("off", "shared", "all")
    private var reverting = false

    private fun switch(label: Int, on: Boolean) = Switch(act).apply {
        text = act.getString(label); isChecked = on
        setTextColor(act.getColor(R.color.parchment)); layoutParams = Ui.lp(top = 6)
    }
    private fun hint(res: Int) = Ui.body(act, act.getString(res), muted = true).apply { textSize = 12f }

    private val master = switch(R.string.setting_phone, env.phoneAccess)
    private val wifi = switch(R.string.setting_phone_wifi, env.phoneWifi)
    private val files = Spinner(act).apply {
        adapter = ArrayAdapter(act, android.R.layout.simple_spinner_dropdown_item,
            listOf(R.string.files_off, R.string.files_shared, R.string.files_all).map { act.getString(it) })
        setSelection(modes.indexOf(env.phoneFiles).coerceAtLeast(0))
    }
    private val more = LinearLayout(act).apply {
        orientation = LinearLayout.VERTICAL
        visibility = if (env.phoneAccess) View.VISIBLE else View.GONE
        addView(wifi); addView(hint(R.string.setting_phone_wifi_hint))
        addView(Ui.body(act, act.getString(R.string.setting_phone_files), muted = true).apply { textSize = 12f; layoutParams = Ui.lp(top = 10) })
        addView(files); addView(hint(R.string.setting_phone_files_hint))
    }

    val enabled: Boolean get() = master.isChecked
    val wifiEnabled: Boolean get() = wifi.isChecked
    val filesMode: String get() = modes[files.selectedItemPosition]

    val view: LinearLayout = Ui.card(act).apply {
        addView(Ui.heading(act, act.getString(R.string.section_phone), 11f))
        addView(master); addView(hint(R.string.setting_phone_hint)); addView(more)
        // Listening to clicks (not to every change) keeps our own undo from re-opening the dialogs.
        master.setOnClickListener { if (master.isChecked) warn(R.string.phone_warn_title, R.string.phone_warn_body, R.string.phone_continue, ::refuseMaster) { confirmAgain() } else more.visibility = View.GONE }
        wifi.setOnClickListener { if (wifi.isChecked) warn(R.string.phone_wifi_warn_title, R.string.phone_wifi_warn_body, R.string.phone_enable, { wifi.isChecked = false }) { ask(WIFI, Manifest.permission.ACCESS_FINE_LOCATION) } }
        files.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (reverting || pos == 0) { reverting = false; return }
                val body = if (pos == 1) R.string.phone_files_shared_body else R.string.phone_files_all_body
                warn(R.string.phone_files_warn_title, body, R.string.phone_enable, { revertFiles() }) {
                    ask(FILES, Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                }
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    private fun refuseMaster() { master.isChecked = false }
    private fun revertFiles() { reverting = true; files.setSelection(0) }

    private fun confirmAgain() {
        warn(R.string.phone_confirm_title, R.string.phone_confirm_body, R.string.phone_enable, ::refuseMaster) { more.visibility = View.VISIBLE; checkNotifications() }
    }

    private fun warn(title: Int, message: Int, yes: Int, onNo: () -> Unit, onYes: () -> Unit) {
        AlertDialog.Builder(act).setTitle(title).setMessage(message).setCancelable(false)
            .setPositiveButton(yes) { _, _ -> onYes() }
            .setNegativeButton(android.R.string.cancel) { _, _ -> onNo() }
            .show()
    }

    private fun ask(code: Int, vararg permissions: String) {
        val missing = permissions.filter { act.checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }
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
        if (code == WIFI) wifi.isChecked = false else revertFiles()
    }

    /** Notifications are how agents reach you and how you answer their requests: make sure Android allows them. */
    private fun checkNotifications() {
        val nm = act.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.areNotificationsEnabled()) return
        Toast.makeText(act, R.string.phone_notif_off, Toast.LENGTH_LONG).show()
        act.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, act.packageName))
    }

    companion object { const val WIFI = 21; const val FILES = 22 }
}
