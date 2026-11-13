package dev.epersonf.deck

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.view.Gravity
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.URLUtil
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout

/** Hosts the deck web app in a full-screen WebView (the "Open Deck" screen). */
class DeckActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var splash: View
    private var chooser: ValueCallback<Array<Uri>>? = null
    private val bridge = DeckBridge(this)
    private val handler = Handler(Looper.getMainLooper())
    private var failed = false

    override fun attachBaseContext(base: Context) = super.attachBaseContext(Lang.wrap(base))

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setTheme(R.style.DeckTheme)
        val url = "http://127.0.0.1:${Env(this).port}/"

        web = WebView(this).apply {
            setBackgroundColor(getColor(R.color.bg))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setSupportMultipleWindows(true)
            webViewClient = client(url)
            webChromeClient = chrome()
            addJavascriptInterface(bridge, "DeckAndroid")
            setDownloadListener { dl, _, disposition, mime, _ ->
                bridge.saveUrl(dl, URLUtil.guessFileName(dl, disposition, mime))
            }
        }
        splash = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            setBackgroundColor(getColor(R.color.bg))
            addView(ImageView(context).apply {
                setImageResource(R.drawable.ic_gear)
                layoutParams = LinearLayout.LayoutParams(Ui.dp(context, 72), Ui.dp(context, 72))
            })
            addView(Ui.body(context, getString(R.string.waiting_deck), muted = true).apply {
                gravity = Gravity.CENTER
                textAlignment = View.TEXT_ALIGNMENT_CENTER
                val side = Ui.dp(context, 24)
                setPadding(side, Ui.dp(context, 14), side, 0)
            })
        }
        setContentView(FrameLayout(this).apply { addView(web); addView(splash) })
        web.loadUrl(chatUrl(url, intent))
    }

    /** A tap on a chat notification opens that chat (the page reads `?chat=`). */
    private fun chatUrl(home: String, i: Intent?): String =
        i?.getStringExtra("chat")?.let { "$home?chat=${Uri.encode(it)}" } ?: home

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.getStringExtra("chat")?.let { web.evaluateJavascript("window.deckOpenChat&&window.deckOpenChat(${org.json.JSONObject.quote(it)})", null) }
    }

    private fun client(home: String) = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
            val host = r.url.host
            if (host == "127.0.0.1" || host == "localhost") return false
            openExternal(r.url)
            return true
        }
        override fun onPageStarted(v: WebView, u: String, f: Bitmap?) { failed = false }
        override fun onPageFinished(v: WebView, u: String) { if (!failed) splash.visibility = View.GONE }
        override fun onReceivedError(v: WebView, r: WebResourceRequest, e: WebResourceError) {
            if (!r.isForMainFrame) return
            // Server not up yet (first install or restart): keep the splash and retry.
            failed = true
            splash.visibility = View.VISIBLE
            handler.postDelayed({ web.loadUrl(chatUrl(home, intent)) }, 2000)
        }
    }

    private fun chrome() = object : WebChromeClient() {
        override fun onCreateWindow(v: WebView, d: Boolean, u: Boolean, m: Message): Boolean {
            // target=_blank links: resolve the URL through a throwaway WebView and open it externally.
            val tmp = WebView(this@DeckActivity)
            tmp.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                    openExternal(r.url); tmp.destroy(); return true
                }
            }
            (m.obj as WebView.WebViewTransport).webView = tmp
            m.sendToTarget()
            return true
        }
        override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
            chooser?.onReceiveValue(null)
            chooser = cb
            return try { startActivityForResult(p.createIntent(), 7); true } catch (_: Exception) { chooser = null; false }
        }
    }

    private fun openExternal(uri: Uri) {
        try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) {}
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (bridge.onResult(requestCode, resultCode, data)) return
        if (requestCode == 7) {
            chooser?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            chooser = null
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else finish() }

    override fun onPause() { super.onPause(); web.onPause() }
    override fun onResume() { super.onResume(); web.onResume() }
    override fun onDestroy() { handler.removeCallbacksAndMessages(null); web.destroy(); super.onDestroy() }
}
