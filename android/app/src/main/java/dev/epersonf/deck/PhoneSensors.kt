package dev.epersonf.deck

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.graphics.SurfaceTexture
import android.hardware.Camera
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.media.MediaRecorder
import android.os.Bundle
import android.os.Looper
import org.json.JSONObject
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Capabilities that read the world around the phone: location, camera, microphone, and Bluetooth. */
@Suppress("DEPRECATION")
class PhoneSensors(private val ctx: Context, private val inbox: () -> File) {

    @SuppressLint("MissingPermission")
    fun location(): JSONObject {
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).filter { lm.isProviderEnabled(it) }
        if (providers.isEmpty()) error("Location is off: turn it on in Android quick settings")
        var best: Location? = providers.mapNotNull { lm.getLastKnownLocation(it) }.maxByOrNull { it.time }
        if (best == null || System.currentTimeMillis() - best.time > 120_000) {
            val latch = CountDownLatch(1)
            val listener = object : LocationListener {
                override fun onLocationChanged(l: Location) { best = l; latch.countDown() }
                override fun onStatusChanged(p: String?, s: Int, e: Bundle?) {}
                override fun onProviderEnabled(p: String) {}
                override fun onProviderDisabled(p: String) {}
            }
            lm.requestSingleUpdate(providers.first(), listener, Looper.getMainLooper())
            latch.await(10, TimeUnit.SECONDS)
            lm.removeUpdates(listener)
        }
        val l = best ?: error("No location fix yet (try outdoors, or again in a moment)")
        return JSONObject().put("lat", l.latitude).put("lon", l.longitude).put("accuracyM", l.accuracy)
            .put("provider", l.provider).put("ageSeconds", (System.currentTimeMillis() - l.time) / 1000)
    }

    /** Takes one photo without showing anything. Android only lets the app on screen use the camera, so open CLI Deck first. */
    fun photo(json: JSONObject): JSONObject {
        val want = if (json.optString("facing") == "front") Camera.CameraInfo.CAMERA_FACING_FRONT else Camera.CameraInfo.CAMERA_FACING_BACK
        val id = (0 until Camera.getNumberOfCameras()).firstOrNull { Camera.CameraInfo().also { i -> Camera.getCameraInfo(it, i) }.facing == want }
            ?: error("This phone has no such camera")
        val file = File(inbox(), "photo-${System.currentTimeMillis()}.jpg")
        val camera = try { Camera.open(id) } catch (e: Exception) { error("The camera is not available (open CLI Deck first, and close other camera apps)") }
        try {
            camera.setPreviewTexture(SurfaceTexture(10))
            camera.startPreview()
            Thread.sleep(900) // let exposure and focus settle
            val done = CountDownLatch(1)
            camera.takePicture(null, null) { data, _ -> file.writeBytes(data); done.countDown() }
            if (!done.await(8, TimeUnit.SECONDS)) error("The camera did not answer")
        } finally { camera.release() }
        return JSONObject().put("path", "/root/inbox/${file.name}").put("bytes", file.length())
    }

    fun record(json: JSONObject): JSONObject {
        val seconds = json.optInt("seconds", 5).coerceIn(1, 30)
        val file = File(inbox(), "audio-${System.currentTimeMillis()}.m4a")
        val rec = MediaRecorder()
        try {
            rec.setAudioSource(MediaRecorder.AudioSource.MIC)
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            rec.setOutputFile(file.path)
            rec.prepare(); rec.start()
            Thread.sleep(seconds * 1000L)
            rec.stop()
        } catch (e: RuntimeException) {
            error("The microphone is not available (open CLI Deck first, and close other recorders)")
        } finally { rec.release() }
        return JSONObject().put("path", "/root/inbox/${file.name}").put("seconds", seconds).put("bytes", file.length())
    }

    fun bluetooth(action: String): JSONObject {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: error("This phone has no Bluetooth")
        if (action == "on" || action == "off") {
            val ok = if (action == "on") adapter.enable() else adapter.disable()
            if (!ok) error("Android refused to change Bluetooth (restricted on this phone)")
        }
        return JSONObject().put("enabled", if (action == "status") adapter.isEnabled else action == "on")
    }
}
