package com.samuelreisen.siddur

/** The page's reading themes and the native colours that match them. Pure Kotlin so it can be unit tested.
 *  Dark Paper is the paper theme with the colours flipped: a warm ink-brown page. */
object Appearance {
    const val AUTO = "auto"
    const val LIGHT = "light"
    const val PAPER = "paper"
    const val DARKPAPER = "darkpaper"
    const val DARK = "dark"

    private const val BG_LIGHT = 0xFFFFFFFF.toInt()
    private const val BG_PAPER = 0xFFF4ECD8.toInt()
    private const val BG_DARKPAPER = 0xFF241E17.toInt()
    private const val BG_DARK = 0xFF000000.toInt()

    /** Returns the mode only if it is exactly one of the five known strings, otherwise null. */
    fun parse(mode: String?): String? = when (mode) {
        AUTO, LIGHT, PAPER, DARKPAPER, DARK -> mode
        else -> null
    }

    fun isDark(mode: String, systemNight: Boolean): Boolean = when (mode) {
        DARK, DARKPAPER -> true
        AUTO -> systemNight
        else -> false
    }

    fun backgroundFor(mode: String, systemNight: Boolean): Int = when (mode) {
        PAPER -> BG_PAPER
        DARKPAPER -> BG_DARKPAPER
        else -> if (isDark(mode, systemNight)) BG_DARK else BG_LIGHT
    }
}
