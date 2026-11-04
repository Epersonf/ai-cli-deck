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
    private val router = PhoneRouter(ctx, env)
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
        if (auth != "Bearer $token") return "401 Unauthorized" to JSONObject().put("error", "Bad token")
        if (!env.phoneAccess) return "403 Forbidden" to JSONObject().put("error", "Phone access is off (Settings > Phone access)")
        env.appendLog("phone: $method $path") // never the body: it can hold a Wi-Fi password
        return router.handle(method, path, body)
    }
}
