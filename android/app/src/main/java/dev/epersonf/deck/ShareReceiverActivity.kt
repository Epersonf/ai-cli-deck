package dev.epersonf.deck

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.widget.Toast
import java.io.File

/**
 * "Send to CLI Deck" in Android's share sheet: whatever the person shares (text, links, photos, files) lands in
 * /root/inbox of the Ubuntu, where the agents can find it. It only appears in the share sheet while the "Share to
 * the deck" checkbox is on (the settings enable and disable this screen).
 */
class ShareReceiverActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val env = Env(this)
        if (!env.cap("share")) { Toast.makeText(this, R.string.share_off, Toast.LENGTH_LONG).show(); finish(); return }
        val inbox = File(env.rootfs, "root/inbox").also { it.mkdirs() }
        val stamp = System.currentTimeMillis()
        var count = 0
        intent.getStringExtra(Intent.EXTRA_TEXT)?.let { File(inbox, "shared-$stamp.txt").writeText(it); count++ }
        val streams = if (intent.action == Intent.ACTION_SEND_MULTIPLE) intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM).orEmpty()
        else listOfNotNull(intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM))
        for (uri in streams) if (runCatching { copy(uri, inbox, stamp + count) }.isSuccess) count++
        Toast.makeText(this, getString(R.string.share_received, count), Toast.LENGTH_LONG).show()
        finish()
    }

    private fun copy(uri: Uri, inbox: File, n: Long) {
        val name = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null }
        val safe = (name ?: "file-$n").replace(Regex("[^A-Za-z0-9._ -]"), "_").take(80)
        contentResolver.openInputStream(uri)?.use { input -> File(inbox, safe).outputStream().use { input.copyTo(it) } }
    }
}
