package dev.epersonf.deck

import android.content.Context
import java.io.File

/** Paths and the proot command line for the Ubuntu rootfs that hosts the deck. */
class Env(ctx: Context) {
    companion object { const val LOOPBACK = "127.0.0.1" }

    val nativeDir: String = ctx.applicationInfo.nativeLibraryDir
    val base: File = ctx.filesDir
    val rootfs = File(base, "rootfs")
    val libDir = File(base, "lib")
    val tmpDir = File(base, "tmp")
    val logFile = File(base, "deck.log")
    /** Logs stay in English whatever the UI language (they are technical output). */
    val en: Context = ctx.createConfigurationContext(
        android.content.res.Configuration(ctx.resources.configuration).apply { setLocale(java.util.Locale.ENGLISH) },
    )
    val prefs = ctx.getSharedPreferences("deck", Context.MODE_PRIVATE)

    val port: Int get() = prefs.getInt("port", 7842)
    /** Bind address; migrates the old "accept LAN" switch. */
    val host: String get() = prefs.getString("host", null)
        ?: if (prefs.getBoolean("lan", false)) "0.0.0.0" else LOOPBACK
    val exposed: Boolean get() = host != LOOPBACK && host != "localhost"
    /** Extra diagnostics in the log (system info, terminal self-tests, debug-level server log). */
    val verbose: Boolean get() = prefs.getBoolean("verbose", false)
    /** "Phone access" (battery, notifications...) for the agents: off until the user turns it on and confirms. */
    val phoneAccess: Boolean get() = prefs.getBoolean("phone_access", false)
    /** One capability of the phone for the agents (needs "Phone access" too): its own checkbox in the settings. */
    fun cap(id: String): Boolean = phoneAccess && prefs.getBoolean("cap_$id", false)
    /** "off", "shared" (only the folder "CLI Deck" of the phone storage) or "all" (the whole storage). */
    val phoneFiles: String get() = if (phoneAccess) prefs.getString("phone_files", "off") ?: "off" else "off"
    val password: String get() = prefs.getString("password", "") ?: ""

    /** libtalloc & friends ship as lib*.so (APK rule); the linker wants their real sonames. */
    fun prepareLibs() {
        libDir.mkdirs()
        tmpDir.mkdirs()
        for ((src, soname) in listOf("libtalloc2.so" to "libtalloc.so.2", "libandroid-shmem.so" to "libandroid-shmem.so")) {
            val link = File(libDir, soname)
            // After an in-place update nativeLibraryDir changes, leaving a dangling link that File.exists() reports
            // as missing; always replace it (delete() removes the link itself, never its target).
            link.delete()
            android.system.Os.symlink("$nativeDir/$src", link.path)
        }
    }

    /** What the deck server is told when it starts: its port and bind address, diagnostics, and the phone bridge. */
    fun serverEnv(phone: PhoneBridge?): Map<String, String> {
        val extra = mutableMapOf("DECK_PORT" to port.toString(), "DECK_HOST" to LOOPBACK)
        if (verbose) { extra["DECK_VERBOSE"] = "1"; extra["DECK_LOG_LEVEL"] = "debug" }
        if (phone != null) { extra["DECK_PHONE_URL"] = phone.url; extra["DECK_PHONE_TOKEN"] = phone.token }
        if (exposed && password.isNotEmpty()) { extra["DECK_HOST"] = host; extra["DECK_PASSWORD"] = password }
        return extra
    }

    /** The phone storage inside the Ubuntu, only when the person chose to share it. */
    private fun phoneBinds(): List<String> {
        val storage = android.os.Environment.getExternalStorageDirectory()
        return when (phoneFiles) {
            "all" -> listOf("-b", "${storage.path}:/sdcard").also { File(rootfs, "sdcard").mkdirs() }
            "shared" -> File(storage, "CLI Deck").let { dir ->
                dir.mkdirs()
                File(rootfs, "root/phone").mkdirs()
                if (dir.isDirectory) listOf("-b", "${dir.path}:/root/phone") else emptyList()
            }
            else -> emptyList()
        }
    }

    fun prootCommand(script: String, extraEnv: Map<String, String> = emptyMap()): ProcessBuilder {
        val envArgs = mutableListOf(
            "HOME=/root", "USER=root", "LANG=C.UTF-8", "TERM=xterm-256color",
            "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "TMPDIR=/tmp",
        )
        extraEnv.forEach { (k, v) -> envArgs += "$k=$v" }
        val cmd = mutableListOf(
            "$nativeDir/libproot.so", "-r", rootfs.path, "-0", "--link2symlink", "--sysvipc", "-L",
            "--kill-on-exit", "--kernel-release=6.17.0-PRoot-Distro",
            "-b", "/dev", "-b", "/proc", "-b", "/sys", "-b", "/dev/urandom:/dev/random",
            "-b", "${tmpDir.path}:/tmp",
            *phoneBinds().toTypedArray(),
            "-w", "/root",
            "/usr/bin/env", "-i", *envArgs.toTypedArray(),
            "/bin/bash", "-lc", script,
        )
        return ProcessBuilder(cmd).redirectErrorStream(true).also {
            val e = it.environment()
            e["PROOT_LOADER"] = "$nativeDir/libproot-loader.so"
            e["PROOT_TMP_DIR"] = tmpDir.path
            e["LD_LIBRARY_PATH"] = libDir.path
        }
    }
}
