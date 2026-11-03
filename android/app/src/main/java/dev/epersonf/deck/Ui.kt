package dev.epersonf.deck

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Steampunk look (brass, leather, parchment) shared by every screen; mirrors the web front's CSS. */
object Ui {
    fun dp(ctx: Context, v: Int) = (v * ctx.resources.displayMetrics.density).toInt()
    private fun c(ctx: Context, id: Int) = ctx.getColor(id)

    private fun gradient(top: Int, bottom: Int, radius: Float, stroke: Int, strokeWidth: Int = 2) =
        GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(top, bottom)).apply {
            cornerRadius = radius
            setStroke(strokeWidth, stroke)
        }

    /** Leather panel with a brass border. */
    fun card(ctx: Context): LinearLayout = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        val p = dp(ctx, 14)
        setPadding(p, p, p, p)
        background = gradient(c(ctx, R.color.leather2), c(ctx, R.color.leather), dp(ctx, 8).toFloat(), c(ctx, R.color.brass_lo))
        layoutParams = lp(top = 12)
    }

    fun lp(top: Int = 0, w: Int = ViewGroup.LayoutParams.MATCH_PARENT, h: Int = ViewGroup.LayoutParams.WRAP_CONTENT) =
        LinearLayout.LayoutParams(w, h).apply { topMargin = (top * android.content.res.Resources.getSystem().displayMetrics.density).toInt() }

    /** Small-caps style heading: brass-hi with an amber glow. */
    fun heading(ctx: Context, text: String, size: Float = 13f) = TextView(ctx).apply {
        this.text = text.uppercase(); textSize = size; letterSpacing = 0.14f
        typeface = Typeface.create("serif", Typeface.BOLD)
        setTextColor(c(ctx, R.color.brass_hi))
        setShadowLayer(12f, 0f, 0f, 0x88FFB43A.toInt())
    }

    fun body(ctx: Context, text: String, muted: Boolean = false) = TextView(ctx).apply {
        this.text = text; textSize = 15f; typeface = Typeface.SERIF
        setTextColor(c(ctx, if (muted) R.color.muted else R.color.parchment))
    }

    /** primary = solid brass gradient with dark ink; otherwise leather with a brass border. */
    fun button(ctx: Context, label: String, primary: Boolean = false, onClick: () -> Unit) = Button(ctx).apply {
        text = label.uppercase(); isAllCaps = false; letterSpacing = 0.1f; textSize = 14f
        typeface = Typeface.create("serif", Typeface.BOLD)
        minHeight = dp(ctx, 48); minimumHeight = dp(ctx, 48)
        stateListAnimator = null
        val r = dp(ctx, 6).toFloat()
        if (primary) {
            setTextColor(c(ctx, R.color.ink))
            background = LayerDrawable(arrayOf(
                gradient(c(ctx, R.color.brass_lo), c(ctx, R.color.brass_lo), r, c(ctx, R.color.brass_lo)),
                gradient(c(ctx, R.color.brass_hi), c(ctx, R.color.brass), r, c(ctx, R.color.brass_hi)),
            )).also { it.setLayerInset(1, 0, 0, 0, dp(ctx, 3)) }
        } else {
            setTextColor(c(ctx, R.color.brass_hi))
            background = gradient(c(ctx, R.color.leather2), c(ctx, R.color.leather), r, c(ctx, R.color.brass))
        }
        setOnClickListener { onClick() }
    }

    fun input(ctx: Context, hint: String) = android.widget.EditText(ctx).apply {
        this.hint = hint; textSize = 15f; typeface = Typeface.SERIF; setSingleLine()
        setTextColor(c(ctx, R.color.parchment)); setHintTextColor(c(ctx, R.color.muted))
        val p = dp(ctx, 12)
        setPadding(p, p, p, p)
        background = gradient(c(ctx, R.color.ink), c(ctx, R.color.ink), dp(ctx, 6).toFloat(), c(ctx, R.color.brass_lo))
    }

    fun dot(ctx: Context, color: Int): View = View(ctx).apply {
        val s = dp(ctx, 12)
        layoutParams = LinearLayout.LayoutParams(s, s).apply { rightMargin = dp(ctx, 10); gravity = Gravity.CENTER_VERTICAL }
        background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(color) }
    }
}
