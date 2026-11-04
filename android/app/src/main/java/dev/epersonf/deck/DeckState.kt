package dev.epersonf.deck

import android.content.Context

enum class DeckState { STOPPED, INSTALLING, STARTING, RUNNING, RESTARTING }

/**
 * Status text in the language of [ctx]. The service publishes only the state (and a number: the port or the
 * restart countdown) so each screen formats it with its own, language-aware context.
 */
fun DeckState.label(ctx: Context, arg: Int = 0): String = when (this) {
    DeckState.STOPPED -> ctx.getString(R.string.state_stopped)
    DeckState.INSTALLING -> ctx.getString(R.string.state_installing)
    DeckState.STARTING -> ctx.getString(R.string.state_starting)
    DeckState.RUNNING -> ctx.getString(R.string.state_running, arg)
    DeckState.RESTARTING -> ctx.getString(R.string.state_restarting, arg)
}
