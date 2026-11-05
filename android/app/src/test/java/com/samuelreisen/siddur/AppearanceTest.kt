package com.samuelreisen.siddur

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppearanceTest {
    @Test
    fun parseAcceptsExactlyTheFiveModes() {
        for (m in listOf("auto", "light", "paper", "darkpaper", "dark")) assertEquals(m, Appearance.parse(m))
    }

    @Test
    fun parseRejectsEverythingElse() {
        val bad = listOf(
            null, "", "Dark", "DARK", " dark", "dark ", "dark\n", "#fff", "light;alert(1)",
            "a".repeat(100_000), "dark\u0000", "sepia", "Darkpaper", "dark paper", "dark-paper", "darkpaper ",
        )
        for (m in bad) assertNull("should reject: ${m?.take(20)}", Appearance.parse(m))
    }

    @Test
    fun backgrounds() {
        assertEquals(0xFFFFFFFF.toInt(), Appearance.backgroundFor("light", false))
        assertEquals(0xFFFFFFFF.toInt(), Appearance.backgroundFor("light", true))
        assertEquals(0xFFF4ECD8.toInt(), Appearance.backgroundFor("paper", false))
        assertEquals(0xFFF4ECD8.toInt(), Appearance.backgroundFor("paper", true))
        assertEquals(0xFF241E17.toInt(), Appearance.backgroundFor("darkpaper", false))
        assertEquals(0xFF241E17.toInt(), Appearance.backgroundFor("darkpaper", true))
        assertEquals(0xFF000000.toInt(), Appearance.backgroundFor("dark", false))
        assertEquals(0xFF000000.toInt(), Appearance.backgroundFor("dark", true))
        assertEquals(0xFFFFFFFF.toInt(), Appearance.backgroundFor("auto", false))
        assertEquals(0xFF000000.toInt(), Appearance.backgroundFor("auto", true))
    }

    @Test
    fun darkness() {
        for (night in listOf(true, false)) {
            assertFalse(Appearance.isDark("light", night))
            assertFalse(Appearance.isDark("paper", night))
            assertTrue(Appearance.isDark("dark", night))
            assertTrue(Appearance.isDark("darkpaper", night))
        }
        assertTrue(Appearance.isDark("auto", true))
        assertFalse(Appearance.isDark("auto", false))
    }
}
