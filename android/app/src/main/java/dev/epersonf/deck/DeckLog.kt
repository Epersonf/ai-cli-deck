package dev.epersonf.deck

import java.io.FileWriter

/** Terminal color escapes from npm/node-gyp are noise in the log view. */
private val ANSI = Regex("\u001B\\[[0-9;]*[A-Za-z]")

/** Appends a line to the server log, keeping the file bounded. */
fun Env.appendLog(line: String) {
    try {
        FileWriter(logFile, true).use { it.appendLine(line.replace(ANSI, "")) }
        if (logFile.length() > 2_000_000) logFile.writeText(logFile.readText().takeLast(500_000))
    } catch (_: Exception) {}
}
