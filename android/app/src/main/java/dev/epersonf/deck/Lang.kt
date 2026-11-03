package dev.epersonf.deck

import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import java.util.Locale

/** Same language list as the web front (apps/web/src/shared/i18n/locales.ts). */
object Lang {
    val ALL = listOf(
        "en" to "English", "pt" to "Português (Brasil)", "es" to "Español", "it" to "Italiano",
        "fr" to "Français", "zh" to "中文（简体）", "ja" to "日本語", "ru" to "Русский",
    )

    /** Saved choice wins; otherwise the system language (null = follow the system). */
    fun saved(ctx: Context): String? =
        ctx.getSharedPreferences("deck", Context.MODE_PRIVATE).getString("lang", null)

    fun wrap(base: Context): Context {
        val code = saved(base) ?: return base
        val locale = Locale.forLanguageTag(code)
        Locale.setDefault(locale)
        val cfg = Configuration(base.resources.configuration).apply { setLocale(locale) }
        return object : ContextWrapper(base.createConfigurationContext(cfg)) {}
    }
}
