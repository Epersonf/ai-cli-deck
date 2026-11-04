package dev.epersonf.deck

import android.content.Context
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.animation.Animation
import android.view.animation.LinearInterpolator
import android.view.animation.RotateAnimation
import android.widget.ImageView
import android.widget.LinearLayout

/** Pieces of the home screen that need no state: the brand header and the log colouring. */
object HomeWidgets {
    private val errorWords =
        Regex("error|fail|fatal|exception|not found|invalid|cannot|denied|rc=[1-9]|unexpected", RegexOption.IGNORE_CASE)

    /** Error lines (failures, non-zero exits, shell errors) in red. */
    fun colorize(ctx: Context, text: String): CharSequence {
        val sb = SpannableStringBuilder()
        for (line in text.lines()) {
            val start = sb.length
            sb.append(line).append('\n')
            if (errorWords.containsMatchIn(line)) {
                sb.setSpan(ForegroundColorSpan(ctx.getColor(R.color.danger)), start, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
        return sb
    }

    /** Spinning brass gear + CLI DECK title, like the web top bar. */
    fun brand(ctx: Context): LinearLayout {
        val box = LinearLayout(ctx).apply { gravity = Gravity.CENTER_VERTICAL }
        val size = Ui.dp(ctx, 52)
        val gear = ImageView(ctx).apply {
            setImageResource(R.drawable.ic_gear)
            layoutParams = LinearLayout.LayoutParams(size, size)
            startAnimation(RotateAnimation(0f, 360f, Animation.RELATIVE_TO_SELF, .5f, Animation.RELATIVE_TO_SELF, .5f).apply {
                duration = 24000; repeatCount = Animation.INFINITE; interpolator = LinearInterpolator()
            })
        }
        val names = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(Ui.dp(ctx, 14), 0, 0, 0)
            addView(Ui.heading(ctx, ctx.getString(R.string.app_name), 24f))
            addView(Ui.body(ctx, ctx.getString(R.string.tagline), muted = true))
        }
        box.addView(gear); box.addView(names)
        return box
    }
}
