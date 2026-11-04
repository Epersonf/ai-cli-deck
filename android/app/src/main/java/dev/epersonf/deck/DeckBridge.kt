package dev.epersonf.deck

import android.app.Activity
import android.content.Intent
import android.webkit.JavascriptInterface
import android.widget.Toast

/**
 * What the deck web page can ask of the app (as `window.DeckAndroid`). A WebView cannot save a download
 * made in the page, so the page hands the text over and Android's own "save as" picker does the rest:
 * the user chooses where, and the app needs no storage permission.
 */
class DeckBridge(private val activity: Activity) {
    private var pending: String? = null

    @JavascriptInterface
    fun saveText(name: String, text: String) {
        pending = text
        activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/octet-stream")
                .putExtra(Intent.EXTRA_TITLE, name)
            try { activity.startActivityForResult(intent, REQUEST) } catch (_: Exception) { pending = null }
        }
    }

    /** Called with the result of the picker; returns true when the request was ours. */
    fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST) return false
        val text = pending
        pending = null
        val uri = data?.data
        if (resultCode == Activity.RESULT_OK && text != null && uri != null) {
            try {
                activity.contentResolver.openOutputStream(uri, "wt")?.use { it.write(text.toByteArray()) }
                Toast.makeText(activity, R.string.file_saved, Toast.LENGTH_SHORT).show()
            } catch (_: Exception) {
                Toast.makeText(activity, R.string.file_not_saved, Toast.LENGTH_SHORT).show()
            }
        }
        return true
    }

    companion object { const val REQUEST = 8 }
}
