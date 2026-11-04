package com.samuelreisen.siddur

/** The page's reading themes and the native colours that match them. Pure Kotlin so it can be unit tested. */
object Appearance {
    const val AUTO = "auto"
    const val LIGHT = "light"
    const val PAPER = "paper"
    const val DARK = "dark"

    private const val BG_LIGHT = 0xFFFFFFFF.toInt()
    private const val BG_PAPER = 0xFFF4ECD8.toInt()
    private const val BG_DARK = 0xFF000000.toInt()

    /** Returns the mode only if it is exactly one of the four known strings, otherwise null. */
    fun parse(mode: String?): String? = when (mode) {
        AUTO, LIGHT, PAPER, DARK -> mode
        else -> null
    }

    fun isDark(mode: String, systemNight: Boolean): Boolean = when (mode) {
        DARK -> true
        AUTO -> systemNight
        else -> false
    }

    fun backgroundFor(mode: String, systemNight: Boolean): Int = when (mode) {
        PAPER -> BG_PAPER
        else -> if (isDark(mode, systemNight)) BG_DARK else BG_LIGHT
    }
}
