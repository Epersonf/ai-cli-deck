package dev.epersonf.deck

import android.content.Context
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.SecureRandom

/**
 * A tiny HTTP server on loopback that the deck server (inside proot) calls to reach the phone. It needs the
 * token the app generated and handed to that server only, and it answers nothing unless "Phone access" is
 * on in the settings (checked on every request, so turning it off takes effect at once).
 */
class PhoneBridge(ctx: Context, private val env: Env) {
    val token: String = ByteArray(24).also { SecureRandom().nextBytes(it) }.joinToString("") { "%02x".format(it) }
    private val socket = ServerSocket(0, 8, InetAddress.getByName(Env.LOOPBACK))
    val url: String get() = "http://${Env.LOOPBACK}:${socket.localPort}"
    private val api = PhoneApi(ctx)
    private val notifyTimes = ArrayDeque<Long>()
    @Volatile private var open = true

    fun start() {
        Thread({
            while (open) {
                try {
                    val client = socket.accept()
                    Thread { serve(client) }.start()
                } catch (_: Exception) { if (!open) return@Thread }
            }
        }, "phone-bridge").start()
    }

    fun stop() { open = false; runCatching { socket.close() } }

    private fun readLine(input: InputStream): String? {
        val out = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            if (b < 0) return if (out.size() == 0) null else out.toString("UTF-8")
            if (b == '\n'.code) return out.toString("UTF-8").trimEnd('\r')
            out.write(b)
        }
    }

    private fun serve(s: Socket) {
        s.use { answer(s) }
    }

    private fun answer(s: Socket) {
        s.soTimeout = 5000
        val input = s.getInputStream().buffered()
        val request = readLine(input)?.split(" ") ?: return
        var length = 0
        var auth = ""
        while (true) {
            val line = readLine(input) ?: break
            if (line.isEmpty()) break
            val (name, value) = line.split(":", limit = 2).let { it[0].lowercase() to it.getOrElse(1) { "" }.trim() }
            if (name == "content-length") length = value.toIntOrNull()?.coerceIn(0, 8192) ?: 0
            if (name == "authorization") auth = value
        }
        val body = if (length > 0) String(ByteArray(length).also { buf -> var n = 0; while (n < length) { val r = input.read(buf, n, length - n); if (r < 0) break; n += r } }) else ""
        val (code, json) = handle(request.getOrElse(0) { "" }, request.getOrElse(1) { "" }, auth, body)
        val bytes = json.toString().toByteArray()
        s.getOutputStream().apply {
            write("HTTP/1.1 $code\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
            write(bytes); flush()
        }
    }

    private fun handle(method: String, path: String, auth: String, body: String): Pair<String, JSONObject> {
        fun fail(code: String, msg: String) = code to JSONObject().put("error", msg)
        if (auth != "Bearer $token") return fail("401 Unauthorized", "Bad token")
        if (!env.phoneAccess) return fail("403 Forbidden", "Phone access is off (Settings > Phone access)")
        env.appendLog("phone: $method $path")
        return when {
            method == "GET" && path == "/battery" -> "200 OK" to api.battery()
            method == "GET" && path == "/device" -> "200 OK" to api.device()
            method == "POST" && path == "/notify" -> notify(body)
            else -> fail("404 Not Found", "Unknown request")
        }
    }

    private fun notify(body: String): Pair<String, JSONObject> {
        val now = System.currentTimeMillis()
        synchronized(notifyTimes) {
            while (notifyTimes.isNotEmpty() && now - notifyTimes.first() > 60_000) notifyTimes.removeFirst()
            // Agents must not be able to flood the phone with notifications.
            if (notifyTimes.size >= 6) return "429 Too Many Requests" to JSONObject().put("error", "At most 6 notifications a minute")
            notifyTimes.addLast(now)
        }
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return "400 Bad Request" to JSONObject().put("error", "Bad JSON")
        val text = json.optString("text")
        if (text.isBlank()) return "400 Bad Request" to JSONObject().put("error", "text is required")
        val problem = api.notify(json.optString("title"), text)
        return if (problem == null) "200 OK" to JSONObject().put("shown", true)
        else "409 Conflict" to JSONObject().put("error", problem)
    }
}
