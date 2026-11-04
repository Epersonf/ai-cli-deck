package dev.epersonf.deck

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiConfiguration
import android.net.wifi.WifiManager
import org.json.JSONArray
import org.json.JSONObject

/**
 * Wi-Fi for the agents: what the phone is connected to, what is around, and (after the user taps Allow, see
 * [PhoneConfirm]) connecting or switching Wi-Fi on and off. The app targets Android 9 on purpose, which keeps the
 * older Wi-Fi calls working on newer versions; some makers still restrict them, so every failure is reported.
 */
@Suppress("DEPRECATION")
class PhoneWifi(private val ctx: Context) {
    private val wm = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    /** SSIDs and scans are hidden from apps without the location permission (and with the location switch off). */
    private val locationOk: Boolean
        get() = ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun status(): JSONObject {
        val info = wm.connectionInfo
        val ip = info?.ipAddress ?: 0
        return JSONObject()
            .put("enabled", wm.isWifiEnabled)
            .put("ssid", info?.ssid?.trim('"')?.takeIf { it != "<unknown ssid>" } ?: JSONObject.NULL)
            .put("signalDbm", info?.rssi ?: JSONObject.NULL)
            .put("linkMbps", info?.linkSpeed ?: JSONObject.NULL)
            .put("ip", if (ip == 0) JSONObject.NULL else "${ip and 255}.${ip shr 8 and 255}.${ip shr 16 and 255}.${ip shr 24 and 255}")
            .put("locationPermission", locationOk)
    }

    /** Networks in range, strongest first (one entry per name). Android limits how often a scan may run. */
    fun scan(): JSONObject {
        if (!locationOk) return JSONObject().put("error", "Location permission is needed to list Wi-Fi networks")
        wm.startScan()
        Thread.sleep(2500)
        val seen = LinkedHashMap<String, JSONObject>()
        for (r in wm.scanResults.sortedByDescending { it.level }) {
            if (r.SSID.isBlank() || seen.containsKey(r.SSID)) continue
            seen[r.SSID] = JSONObject().put("ssid", r.SSID).put("signalDbm", r.level).put("security", security(r.capabilities))
        }
        return JSONObject().put("networks", JSONArray(seen.values.toList()))
    }

    private fun security(capabilities: String) = when {
        "WPA3" in capabilities || "SAE" in capabilities -> "wpa3"
        "WPA" in capabilities -> "wpa2"
        "WEP" in capabilities -> "wep"
        else -> "open"
    }

    /** Returns null when Android accepted the request, or why it did not. Joining can still take a few seconds. */
    fun connect(ssid: String, password: String): String? {
        val config = WifiConfiguration().apply {
            SSID = "\"$ssid\""
            if (password.isEmpty()) allowedKeyManagement.set(WifiConfiguration.KeyMgmt.NONE) else preSharedKey = "\"$password\""
        }
        val id = wm.addNetwork(config)
        if (id < 0) return "Android refused to add the network (it may already be saved by another app, or Wi-Fi changes are restricted on this phone)"
        wm.disconnect()
        if (!wm.enableNetwork(id, true)) return "Android refused to switch to the network"
        wm.reconnect()
        return null
    }

    fun enable(on: Boolean): String? = if (wm.setWifiEnabled(on)) null else "Android refused to change Wi-Fi (restricted on this phone)"
}
