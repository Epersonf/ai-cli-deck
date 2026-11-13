package dev.epersonf.deck

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

typealias PhoneReply = Pair<String, JSONObject>

/**
 * What each request to the phone bridge does. Anything beyond battery, device and notifications needs its checkbox
 * in the settings ([PhoneCaps]); some also need a tap on Allow in a notification for every single use.
 */
class PhoneRouter(ctx: Context, private val env: Env) {
    private val ui = Lang.wrap(ctx)
    private val api = PhoneApi(ui)
    private val wifi = PhoneWifi(ctx)
    private val confirm = PhoneConfirm(ui)
    private val low = PhoneLow(ctx)
    private val sensors = PhoneSensors(ctx) { File(env.rootfs, "root/inbox").also { it.mkdirs() } }
    private val high = PhoneHigh(ctx)
    private val notifyTimes = ArrayDeque<Long>()
    private val changes = setOf("/wifi/connect", "/wifi/enable", "/bluetooth/on", "/bluetooth/off")

    private fun fail(code: String, msg: String): PhoneReply = code to JSONObject().put("error", msg)
    private fun ok(json: JSONObject): PhoneReply = "200 OK" to json

    fun handle(method: String, path: String, body: String): PhoneReply {
        val json = runCatching { JSONObject(body.ifBlank { "{}" }) }.getOrNull() ?: return fail("400 Bad Request", "Bad JSON")
        if (path == "/capabilities") return ok(capabilities())
        val cap = PhoneCaps.forPath(path)
        if (cap == null) return basic(method, path, json)
        if (!env.cap(cap.id)) return fail("403 Forbidden", "${cap.label()} access is off (Settings > Phone access)")
        if ((cap.confirm || path in changes) && !confirm.ask(prompt(path, json))) {
            return fail("403 Forbidden", "The person holding the phone did not allow it")
        }
        return try {
            ok(dispatch(cap.id, path.removePrefix(cap.paths.first()).trim('/'), json))
        } catch (e: SecurityException) {
            fail("403 Forbidden", "Android permission missing: grant it in the settings of CLI Deck (${e.message})")
        } catch (e: IllegalStateException) {
            fail("409 Conflict", e.message ?: "failed")
        } catch (e: Exception) {
            fail("500 Internal Server Error", e.message ?: e.javaClass.simpleName)
        }
    }

    private fun Cap.label() = id

    private fun basic(method: String, path: String, json: JSONObject): PhoneReply = when {
        method == "GET" && path == "/battery" -> ok(api.battery())
        method == "GET" && path == "/device" -> ok(api.device())
        method == "POST" && path == "/notify" -> notify(json)
        else -> fail("404 Not Found", "Unknown request")
    }

    private fun dispatch(id: String, sub: String, json: JSONObject): JSONObject = when (id) {
        "clipboard" -> low.clipboard(sub.ifEmpty { "get" }, json)
        "vibrate" -> low.vibrate(json)
        "torch" -> low.torch(json)
        "volume" -> low.volume(sub.ifEmpty { "get" }, json)
        "brightness" -> low.brightness(sub.ifEmpty { "get" }, json)
        "tts" -> low.speak(json)
        "wifi" -> wifiRequest(sub, json)
        "location" -> sensors.location()
        "camera" -> sensors.photo(json)
        "microphone" -> sensors.record(json)
        "bluetooth" -> sensors.bluetooth(sub.ifEmpty { "status" })
        "contacts" -> high.contacts(json)
        "sms" -> high.sms(sub, json)
        "calls" -> high.calls(sub, json)
        "calendar" -> high.calendar(sub.ifEmpty { "events" }, json)
        else -> error("Unknown capability")
    }

    private fun wifiRequest(sub: String, json: JSONObject): JSONObject = when (sub) {
        "" -> wifi.status()
        "scan" -> wifi.scan().also { if (it.has("error")) error(it.getString("error")) }
        "connect" -> {
            val ssid = json.optString("ssid")
            if (ssid.isBlank()) error("ssid is required")
            wifi.connect(ssid, json.optString("password"))?.let { error(it) }
            JSONObject().put("requested", true).put("ssid", ssid)
        }
        "enable" -> {
            val on = json.optBoolean("on", true)
            wifi.enable(on)?.let { error(it) }
            JSONObject().put("enabled", on)
        }
        else -> error("Unknown Wi-Fi request")
    }

    /** What the person is asked to allow: the request itself, without secrets. */
    private fun prompt(path: String, json: JSONObject): String {
        if (path == "/wifi/connect") return ui.getString(R.string.phone_ask_connect, json.optString("ssid"))
        if (path == "/wifi/enable") return ui.getString(if (json.optBoolean("on", true)) R.string.phone_ask_wifi_on else R.string.phone_ask_wifi_off)
        val args = json.keys().asSequence().filter { it != "password" }.joinToString(" ") { "$it=${json.optString(it).take(80)}" }
        return ui.getString(R.string.phone_ask_generic, "$path $args".trim())
    }

    /** What an agent may do right now, for `clideck phone help`. */
    private fun capabilities(): JSONObject {
        val list = JSONArray()
        for (cap in PhoneCaps.all.filter { env.cap(it.id) }) list.put(JSONObject().put("id", cap.id).put("risk", cap.risk.name.lowercase()).put("usage", cap.usage))
        return JSONObject().put("always", JSONArray(listOf("battery", "device", "notify --text T [--title T]"))).put("enabled", list)
    }

    /** The button text in the phone's language for the usual answers, else what the deck sent. */
    private fun label(a: JSONObject): String = when (a.optString("kind")) {
        "yes" -> api.string(R.string.phone_allow)
        "no" -> api.string(R.string.phone_deny)
        else -> a.optString("label").take(30)
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
        val buttons = json.optJSONArray("actions")
        val actions = (0 until (buttons?.length() ?: 0)).mapNotNull { buttons?.optJSONObject(it) }.mapNotNull { a ->
            val url = a.optString("url")
            if (url.isBlank()) null else NotifyAction(label(a), url)
        }
        val problem = api.notify(json.optString("title"), text, actions, json.optString("sessionId").takeIf { it.isNotBlank() && it.length <= 64 })
        return if (problem == null) ok(JSONObject().put("shown", true)) else fail("409 Conflict", problem)
    }
}
