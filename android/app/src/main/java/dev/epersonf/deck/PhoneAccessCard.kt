package dev.epersonf.deck

import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.Toast

/**
 * The "Phone access" switch. Off by default. Turning it on needs two confirmations after a plain-words warning,
 * then asks for what the features need (today: notifications). The choice is saved with the rest of the settings.
 */
class PhoneAccessCard(private val act: Activity, env: Env) {
    private val toggle = Switch(act).apply {
        text = act.getString(R.string.setting_phone)
        isChecked = env.phoneAccess
        setTextColor(act.getColor(R.color.parchment))
        layoutParams = Ui.lp(top = 6)
    }
    val enabled: Boolean get() = toggle.isChecked

    val view: LinearLayout = Ui.card(act).apply {
        addView(Ui.heading(act, act.getString(R.string.section_phone), 11f))
        addView(toggle)
        addView(Ui.body(act, act.getString(R.string.setting_phone_hint), muted = true).apply { textSize = 12f })
        // A listener on the switch itself would also fire when we undo a cancelled attempt.
        toggle.setOnClickListener { if (toggle.isChecked) warn() }
    }

    private fun refuse() { toggle.isChecked = false }

    private fun warn() {
        dialog(R.string.phone_warn_title, R.string.phone_warn_body, R.string.phone_continue) { confirmAgain() }
    }

    private fun confirmAgain() {
        dialog(R.string.phone_confirm_title, R.string.phone_confirm_body, R.string.phone_enable) { askPermissions() }
    }

    private fun dialog(title: Int, message: Int, yes: Int, onYes: () -> Unit) {
        AlertDialog.Builder(act).setTitle(title).setMessage(message).setCancelable(false)
            .setPositiveButton(yes) { _, _ -> onYes() }
            .setNegativeButton(android.R.string.cancel) { _, _ -> refuse() }
            .show()
    }

    /** Everything the enabled features need. Notifications: if Android has them off for the app, open its page. */
    private fun askPermissions() {
        val nm = act.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.areNotificationsEnabled()) return
        Toast.makeText(act, R.string.phone_notif_off, Toast.LENGTH_LONG).show()
        act.startActivity(
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, act.packageName),
        )
    }
}
