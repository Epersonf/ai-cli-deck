package dev.epersonf.deck

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.telecom.TelecomManager
import android.telephony.SmsManager
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** The high-risk capabilities (personal data and things that cost money or reach other people). Every use needs a tap. */
class PhoneHigh(private val ctx: Context) {
    private val resolver = ctx.contentResolver

    private fun rows(uri: Uri, columns: Array<String>, where: String?, args: Array<String>?, order: String?, limit: Int, row: (android.database.Cursor) -> JSONObject): JSONArray {
        val out = JSONArray()
        resolver.query(uri, columns, where, args, order)?.use { c -> while (c.moveToNext() && out.length() < limit) out.put(row(c)) }
        return out
    }

    private fun phoneNumber(text: String) = text.trim().also { if (!Regex("[+0-9 ()-]{3,20}").matches(it)) error("Not a phone number") }

    fun contacts(json: JSONObject): JSONObject {
        val q = json.optString("query")
        val list = rows(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER),
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?", arrayOf("%$q%"), null, json.optInt("limit", 10).coerceIn(1, 30)) {
            JSONObject().put("name", it.getString(0)).put("number", it.getString(1))
        }
        return JSONObject().put("contacts", list)
    }

    fun sms(action: String, json: JSONObject): JSONObject {
        if (action != "send") error("Reading messages is not available (Play Protect blocks apps that ask for it). Use: sms send")
        val text = json.optString("text")
        if (text.isBlank()) error("text is required")
        val sms = SmsManager.getDefault()
        sms.sendMultipartTextMessage(phoneNumber(json.optString("to")), null, sms.divideMessage(text), null, null)
        return JSONObject().put("sent", true)
    }

    @Suppress("MissingPermission")
    fun calls(action: String, json: JSONObject): JSONObject {
        if (action != "place") error("Reading the call log is not available (Play Protect blocks apps that ask for it). Use: calls place")
        (ctx.getSystemService(Context.TELECOM_SERVICE) as TelecomManager).placeCall(Uri.fromParts("tel", phoneNumber(json.optString("number")), null), Bundle())
        return JSONObject().put("calling", true)
    }

    fun calendar(action: String, json: JSONObject): JSONObject {
        if (action == "add") return addEvent(json)
        val now = System.currentTimeMillis()
        val end = now + json.optInt("days", 7).coerceIn(1, 30) * 86_400_000L
        val builder = CalendarContract.Instances.CONTENT_URI.buildUpon()
        android.content.ContentUris.appendId(builder, now); android.content.ContentUris.appendId(builder, end)
        val list = rows(builder.build(), arrayOf(CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.EVENT_LOCATION),
            null, null, "${CalendarContract.Instances.BEGIN} ASC", 50) {
            JSONObject().put("title", it.getString(0) ?: "").put("start", it.getLong(1)).put("end", it.getLong(2)).put("where", it.getString(3) ?: JSONObject.NULL)
        }
        return JSONObject().put("events", list)
    }

    private fun addEvent(json: JSONObject): JSONObject {
        val start = runCatching { SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.US).parse(json.optString("start"))?.time }.getOrNull()
            ?: error("start must look like 2026-01-31T14:00 (local time)")
        val calendar = resolver.query(CalendarContract.Calendars.CONTENT_URI, arrayOf(CalendarContract.Calendars._ID), "${CalendarContract.Calendars.VISIBLE} = 1 AND ${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= 500", null, null)
            ?.use { if (it.moveToFirst()) it.getLong(0) else null } ?: error("No writable calendar on this phone")
        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calendar)
            put(CalendarContract.Events.TITLE, json.optString("title").take(200))
            put(CalendarContract.Events.DTSTART, start)
            put(CalendarContract.Events.DTEND, start + json.optInt("minutes", 60).coerceIn(5, 1440) * 60_000L)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
        }
        resolver.insert(CalendarContract.Events.CONTENT_URI, values) ?: error("Android refused to add the event")
        return JSONObject().put("added", true)
    }
}
