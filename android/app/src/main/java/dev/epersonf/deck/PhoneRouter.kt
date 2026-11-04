package dev.epersonf.deck

import android.content.Context
import org.json.JSONObject

typealias PhoneReply = Pair<String, JSONObject>

/** What each request to the phone bridge does. Every capability beyond the basics has its own switch in the settings. */
class PhoneRouter(ctx: Context, private val env: Env) {
    private val ui = Lang.wrap(ctx)
    private val api = PhoneApi(ui)
    private val wifi = PhoneWifi(ctx)
    private val confirm = PhoneConfirm(ui)
    private val notifyTimes = ArrayDeque<Long>()

    private fun fail(code: String, msg: String): PhoneReply = code to JSONObject().put("error", msg)
    private fun ok(json: JSONObject): PhoneReply = "200 OK" to json

    fun handle(method: String, path: String, body: String): PhoneReply {
        if (path.startsWith("/wifi") && !env.phoneWifi) return fail("403 Forbidden", "Wi-Fi access is off (Settings > Phone access > Wi-Fi)")
        val json = runCatching { JSONObject(body.ifBlank { "{}" }) }.getOrNull() ?: return fail("400 Bad Request", "Bad JSON")
        return when {
            method == "GET" && path == "/battery" -> ok(api.battery())
            method == "GET" && path == "/device" -> ok(api.device())
            method == "POST" && path == "/notify" -> notify(json)
            method == "GET" && path == "/wifi" -> ok(wifi.status())
            method == "GET" && path == "/wifi/scan" -> wifi.scan().let { if (it.has("error")) fail("409 Conflict", it.getString("error")) else ok(it) }
            method == "POST" && path == "/wifi/connect" -> connect(json)
            method == "POST" && path == "/wifi/enable" -> enable(json)
            else -> fail("404 Not Found", "Unknown request")
        }
    }

    private fun notify(json: JSONObject): PhoneReply {
        val now = System.currentTimeMillis()
        synchronized(notifyTimes) {
            while (notifyTimes.isNotEmpty() && now - notifyTimes.first() > 60_000) notifyTimes.removeFirst()
            // Agents must not be able to flood the phone with notifications.
            if (notifyTimes.size >= 6) return fail("429 Too Many Requests", "At most 6 notifications a minute")
            notifyTimes.addLast(now)
        }
        val text = json.optString("text")
        if (text.isBlank()) return fail("400 Bad Request", "text is required")
        val problem = api.notify(json.optString("title"), text)
        return if (problem == null) ok(JSONObject().put("shown", true)) else fail("409 Conflict", problem)
    }

    /** Changing Wi-Fi needs a tap on Allow; the password is passed on and never logged. */
    private fun connect(json: JSONObject): PhoneReply {
        val ssid = json.optString("ssid")
        if (ssid.isBlank()) return fail("400 Bad Request", "ssid is required")
        if (!confirm.ask(ctxText(R.string.phone_ask_connect, ssid))) return fail("403 Forbidden", "The person holding the phone did not allow it")
        val problem = wifi.connect(ssid, json.optString("password"))
        return if (problem == null) ok(JSONObject().put("requested", true).put("ssid", ssid)) else fail("409 Conflict", problem)
    }

    private fun enable(json: JSONObject): PhoneReply {
        val on = json.optBoolean("on", true)
        if (!confirm.ask(ctxText(if (on) R.string.phone_ask_wifi_on else R.string.phone_ask_wifi_off))) {
            return fail("403 Forbidden", "The person holding the phone did not allow it")
        }
        val problem = wifi.enable(on)
        return if (problem == null) ok(JSONObject().put("enabled", on)) else fail("409 Conflict", problem)
    }

    private fun ctxText(res: Int, vararg args: Any) = ui.getString(res, *args)
}
