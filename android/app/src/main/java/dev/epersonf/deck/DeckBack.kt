package dev.epersonf.deck

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.webkit.WebView

/** Chat -> sessions -> profiles -> native logs. Never use WebView history as the app navigation stack. */
class DeckBack(private val activity: Activity, private val web: WebView, private val handler: Handler) {
    private var pending = false
    private val fallback = Runnable { if (pending) logs() }

    fun press() {
        if (pending || activity.isFinishing) return
        pending = true
        // An unavailable or older web UI must still let the person reach the logs.
        handler.postDelayed(fallback, 1500)
        web.evaluateJavascript(
            "(function(){try{return typeof window.deckBack==='function'&&window.deckBack()===true}catch(e){return false}})()"
        ) { result ->
            if (pending) {
                pending = false
                handler.removeCallbacks(fallback)
                if (result != "true") logs()
            }
        }
    }

    private fun logs() {
        pending = false
        handler.removeCallbacks(fallback)
        if (activity.isFinishing) return
        activity.startActivity(Intent(activity, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP))
        activity.finish()
    }
}
