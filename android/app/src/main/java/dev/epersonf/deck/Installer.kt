package dev.epersonf.deck

import android.content.Context
import android.system.Os
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.GZIPInputStream

/** First-run setup: Ubuntu rootfs download+extract, then bootstrap.sh inside proot (apt, node, npm install). */
class Installer(private val ctx: Context, private val env: Env, private val log: (String) -> Unit) {

    companion object {
        const val ROOTFS_URL =
            "https://cdimage.ubuntu.com/ubuntu-base/releases/24.04/release/ubuntu-base-24.04.5-base-arm64.tar.gz"
    }

    private val marker = File(env.rootfs, "opt/.deck-installed")

    private fun assetVersion(): String =
        ctx.assets.open("deck-version.txt").use { it.readBytes().decodeToString().trim() }

    fun isCurrent(): Boolean = marker.exists() && marker.readText().trim() == assetVersion()

    /** Returns true on success. */
    fun ensure(): Boolean {
        env.prepareLibs()
        if (!File(env.rootfs, "bin/bash").exists() && !File(env.rootfs, "usr/bin/bash").exists()) {
            if (!downloadAndExtractRootfs()) return false
        }
        if (isCurrent()) return true
        log(env.en.getString(R.string.log_installing))
        installAssets()
        val p = env.prootCommand("bash /opt/bootstrap.sh").start()
        p.inputStream.bufferedReader().forEachLine { log(it) }
        val rc = p.waitFor()
        if (rc != 0) {
            log(env.en.getString(R.string.log_bootstrap_failed, rc))
            return false
        }
        marker.writeText(assetVersion())
        return true
    }

    private fun installAssets() {
        File(env.rootfs, "opt").mkdirs()
        for (name in listOf("bootstrap.sh", "run.sh", "epoll_shim.c", "deck-src.bin")) {
            // AGP strips ".gz" from assets, so the source tarball ships as .bin and is unpacked under its real name.
            val dest = if (name == "deck-src.bin") "deck-src.tar.gz" else name
            val out = File(env.rootfs, "opt/$dest")
            ctx.assets.open(name).use { input ->
                if (name.endsWith(".bin")) {
                    FileOutputStream(out).use { input.copyTo(it) }
                } else {
                    // Scripts run under Linux: a checkout with CRLF line endings would break them.
                    out.writeText(input.readBytes().decodeToString().replace("\r\n", "\n"))
                }
            }
        }
        File(env.rootfs, "etc").mkdirs()
        File(env.rootfs, "etc/resolv.conf").writeText("nameserver 8.8.8.8\nnameserver 1.1.1.1\n")
    }

    private fun downloadAndExtractRootfs(): Boolean {
        val tarball = File(env.base, "rootfs.tar.gz")
        try {
            log(env.en.getString(R.string.log_downloading))
            val c = URL(ROOTFS_URL).openConnection() as HttpURLConnection
            c.connectTimeout = 20000; c.readTimeout = 30000
            c.inputStream.use { i -> FileOutputStream(tarball).use { i.copyTo(it) } }
            log(env.en.getString(R.string.log_extracting))
            env.rootfs.deleteRecursively()
            env.rootfs.mkdirs()
            extract(tarball.inputStream().buffered(), env.rootfs)
            tarball.delete()
            return true
        } catch (e: Exception) {
            log(env.en.getString(R.string.log_rootfs_failed, e.toString()))
            env.rootfs.deleteRecursively()
            return false
        }
    }

    private fun extract(raw: InputStream, dest: File) {
        TarArchiveInputStream(GZIPInputStream(BufferedInputStream(raw))).use { tar ->
            while (true) {
                val e = tar.nextEntry ?: break
                val name = e.name.removePrefix("./").trimEnd('/')
                if (name.isEmpty() || name.startsWith("dev/")) continue
                val f = File(dest, name)
                if (!f.canonicalPath.startsWith(dest.canonicalPath)) continue
                f.parentFile?.mkdirs()
                when {
                    e.isDirectory -> { f.mkdirs(); Os.chmod(f.path, (e.mode or 0x1C0) and 0xFFF) }
                    e.isSymbolicLink -> { f.delete(); Os.symlink(e.linkName, f.path) }
                    e.isLink -> {
                        val target = File(dest, e.linkName.removePrefix("./"))
                        f.delete()
                        if (target.exists()) target.copyTo(f, overwrite = true)
                    }
                    e.isFile -> {
                        FileOutputStream(f).use { tar.copyTo(it) }
                        Os.chmod(f.path, (e.mode or 0x180) and 0xFFF)
                    }
                }
            }
        }
    }
}
