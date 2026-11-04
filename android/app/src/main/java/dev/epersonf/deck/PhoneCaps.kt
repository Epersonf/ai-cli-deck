package dev.epersonf.deck

import android.Manifest

enum class Risk { LOW, MEDIUM, HIGH }

/**
 * One thing agents may do with the phone. Each has its own checkbox in the settings (off by default), its own
 * warning and the Android permissions it needs. [confirm]: every use waits for a tap on Allow in a notification.
 * [usage] is what `clideck phone help` shows an agent when the capability is on.
 */
class Cap(
    val id: String,
    val risk: Risk,
    val label: Int,
    val hint: Int,
    val paths: List<String>,
    val usage: String,
    val permissions: List<String> = emptyList(),
    val confirm: Boolean = false,
    /** Needs a special Android page (not a normal permission prompt): "Modify system settings". */
    val special: Boolean = false,
)

object PhoneCaps {
    val all = listOf(
        Cap("clipboard", Risk.LOW, R.string.cap_clipboard, R.string.cap_clipboard_hint, listOf("/clipboard"),
            "clipboard get | clipboard set --text T"),
        Cap("vibrate", Risk.LOW, R.string.cap_vibrate, R.string.cap_vibrate_hint, listOf("/vibrate"), "vibrate [--ms 300]"),
        Cap("torch", Risk.LOW, R.string.cap_torch, R.string.cap_torch_hint, listOf("/torch"), "torch --on true|false"),
        Cap("volume", Risk.LOW, R.string.cap_volume, R.string.cap_volume_hint, listOf("/volume"),
            "volume get | volume set --stream music|ring|alarm --percent N"),
        Cap("brightness", Risk.LOW, R.string.cap_brightness, R.string.cap_brightness_hint, listOf("/brightness"),
            "brightness get | brightness set --percent N", special = true),
        Cap("tts", Risk.LOW, R.string.cap_tts, R.string.cap_tts_hint, listOf("/tts"), "tts --text T   (speaks aloud)"),
        Cap("share", Risk.LOW, R.string.cap_share, R.string.cap_share_hint, emptyList(),
            "(no command: what the user shares from other apps arrives in /root/inbox)"),
        Cap("wifi", Risk.MEDIUM, R.string.cap_wifi, R.string.cap_wifi_hint, listOf("/wifi"),
            "wifi status | wifi scan | wifi on | wifi off | wifi connect --ssid S [--password P]  (changes need the user's tap)",
            listOf(Manifest.permission.ACCESS_FINE_LOCATION)),
        Cap("location", Risk.MEDIUM, R.string.cap_location, R.string.cap_location_hint, listOf("/location"),
            "location", listOf(Manifest.permission.ACCESS_FINE_LOCATION)),
        Cap("camera", Risk.MEDIUM, R.string.cap_camera, R.string.cap_camera_hint, listOf("/camera"),
            "camera photo [--facing back|front]  (saves to /root/inbox; needs the user's tap)",
            listOf(Manifest.permission.CAMERA), confirm = true),
        Cap("microphone", Risk.MEDIUM, R.string.cap_microphone, R.string.cap_microphone_hint, listOf("/microphone"),
            "microphone record [--seconds 5]  (saves to /root/inbox; needs the user's tap)",
            listOf(Manifest.permission.RECORD_AUDIO), confirm = true),
        Cap("bluetooth", Risk.MEDIUM, R.string.cap_bluetooth, R.string.cap_bluetooth_hint, listOf("/bluetooth"),
            "bluetooth status | bluetooth on | bluetooth off  (changes need the user's tap)"),
        Cap("contacts", Risk.HIGH, R.string.cap_contacts, R.string.cap_contacts_hint, listOf("/contacts"),
            "contacts search --query Q [--limit 10]  (needs the user's tap)",
            listOf(Manifest.permission.READ_CONTACTS), confirm = true),
        Cap("sms", Risk.HIGH, R.string.cap_sms, R.string.cap_sms_hint, listOf("/sms"),
            "sms send --to N --text T | sms inbox [--limit 10]  (needs the user's tap)",
            listOf(Manifest.permission.SEND_SMS, Manifest.permission.READ_SMS), confirm = true),
        Cap("calls", Risk.HIGH, R.string.cap_calls, R.string.cap_calls_hint, listOf("/calls"),
            "calls place --number N | calls log [--limit 10]  (needs the user's tap)",
            listOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_CALL_LOG), confirm = true),
        Cap("calendar", Risk.HIGH, R.string.cap_calendar, R.string.cap_calendar_hint, listOf("/calendar"),
            "calendar events [--days 7] | calendar add --title T --start 2026-01-31T14:00 [--minutes 60]  (needs the user's tap)",
            listOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR), confirm = true),
    )

    fun byId(id: String) = all.firstOrNull { it.id == id }

    fun forPath(path: String) = all.firstOrNull { cap -> cap.paths.any { path == it || path.startsWith("$it/") } }
}
