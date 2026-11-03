package dev.epersonf.deck

import android.content.Context
import java.io.File

/** Paths and the proot command line for the Ubuntu rootfs that hosts the deck. */
class Env(ctx: Context) {
    val nativeDir: String = ctx.applicationInfo.nativeLibraryDir
    val base: File = ctx.filesDir
    val rootfs = File(base, "rootfs")
    val libDir = File(base, "lib")
    val tmpDir = File(base, "tmp")
    val logFile = File(base, "deck.log")
    val prefs = ctx.getSharedPreferences("deck", Context.MODE_PRIVATE)

    val port: Int get() = prefs.getInt("port", 7842)
    val exposeLan: Boolean get() = prefs.getBoolean("lan", false)
    val password: String get() = prefs.getString("password", "") ?: ""

    /** libtalloc & friends ship as lib*.so (APK rule); the linker wants their real sonames. */
    fun prepareLibs() {
        libDir.mkdirs()
        tmpDir.mkdirs()
        for ((src, soname) in listOf("libtalloc2.so" to "libtalloc.so.2", "libandroid-shmem.so" to "libandroid-shmem.so")) {
            val link = File(libDir, soname)
            if (!link.exists()) android.system.Os.symlink("$nativeDir/$src", link.path)
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
