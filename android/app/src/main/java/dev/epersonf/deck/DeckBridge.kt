package dev.epersonf.deck

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.net.HttpURLConnection
import java.net.URL

/**
 * What the deck web page can ask of the app (as `window.DeckAndroid`). A WebView cannot save a download
 * made in the page, so the page hands the text over and Android's own "save as" picker does the rest:
 * the user chooses where, and the app needs no storage permission.
 */
class DeckBridge(private val activity: Activity) {
    private var pending: String? = null
    private var pendingUrl: String? = null

    /** A download started in the page (a file or a .zip): the user picks where, then the file is copied there. */
    fun saveUrl(url: String, name: String) {
        pendingUrl = url
        activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/octet-stream")
                .putExtra(Intent.EXTRA_TITLE, name)
            try { activity.startActivityForResult(intent, REQUEST) } catch (_: Exception) { pendingUrl = null }
        }
    }

    private fun copy(url: String, to: Uri) {
        Thread {
            val ok = try {
                val conn = URL(url).openConnection() as HttpURLConnection
                CookieManager.getInstance().getCookie(url)?.let { conn.setRequestProperty("Cookie", it) }
                conn.inputStream.use { input ->
                    activity.contentResolver.openOutputStream(to, "wt")?.use { input.copyTo(it) } != null
                }
            } catch (_: Exception) { false }
            activity.runOnUiThread {
                Toast.makeText(activity, if (ok) R.string.file_saved else R.string.file_not_saved, Toast.LENGTH_SHORT).show()
            }
        }.start()
    }

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
        val url = pendingUrl
        pending = null
        pendingUrl = null
        val uri = data?.data
        if (resultCode == Activity.RESULT_OK && url != null && uri != null) { copy(url, uri); return true }
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
