package com.samuelreisen.siddur

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.util.zip.GZIPOutputStream

class MarkUpdateTest {

    /** Builds an update file the way scripts/markpack.js packMark does. */
    private fun pack(mark: Int, files: Map<String, ByteArray>, minShell: String = "1.0.0", magic: String = "OLEH____"): ByteArray {
        val names = files.keys.sorted()
        val payload = ByteArrayOutputStream()
        val list = JSONArray()
        var offset = 0
        for (n in names) {
            val b = files.getValue(n)
            list.put(JSONObject().put("path", n).put("size", b.size).put("offset", offset).put("sha256", MarkFile.sha256Hex(b)))
            payload.write(b)
            offset += b.size
        }
        val raw = payload.toByteArray()
        val gz = ByteArrayOutputStream().also { o -> GZIPOutputStream(o).use { it.write(raw) } }.toByteArray()
        val header = JSONObject().put("format", 1).put("mark", mark).put("name", MarkFile.markName(mark)).put("title", "Test $mark")
            .put("minShell", minShell).put("payloadSize", raw.size).put("payloadSha256", MarkFile.sha256Hex(raw))
            .put("gzipBytes", gz.size).put("files", list)
        val hb = header.toString().toByteArray(Charsets.UTF_8)
        val len = byteArrayOf((hb.size ushr 24).toByte(), (hb.size ushr 16).toByte(), (hb.size ushr 8).toByte(), hb.size.toByte())
        return magic.toByteArray(Charsets.ISO_8859_1) + len + hb + gz
    }

    private val page = """<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre&display=swap">
<p>siddur</p>""".toByteArray()

    private fun testMark(n: Int, minShell: String = "1.0.0") =
        pack(n, mapOf("dist/index.html" to page, "HANDOFF.md" to "<!-- handoff-mark: $n -->\n".toByteArray()), minShell)

    private fun code(block: () -> Unit): String = try {
        block(); "none"
    } catch (e: MarkException) {
        e.code
    }

    private fun tempRoot(): File = Files.createTempDirectory("siddur-upd").toFile()

    @Test fun romanNames() {
        assertEquals(listOf("Mk I", "Mk II", "Mk IV", "Mk IX", "Mk XIV", "Mk XL"), listOf(1, 2, 4, 9, 14, 40).map { MarkFile.markName(it) })
    }

    @Test fun readsTheRealMkIFile() {
        val f = File("../../marks/out/Siddur-MkI.oleh")
        assertTrue("Mk I file should exist at ${f.absolutePath}", f.isFile)
        val m = MarkFile.parse(f.readBytes(), "1.1.0")
        assertEquals(1, m.mark)
        assertTrue(m.files.containsKey("dist/index.html"))
        assertTrue(String(m.files.getValue("HANDOFF.md")).startsWith("<!-- handoff-mark: 1 -->"))
    }

    @Test fun refusesBadFiles() {
        val good = testMark(3)
        assertEquals("none", code { MarkFile.parse(good, "1.1.0") })
        val tampered = good.copyOf().also { it[it.size - 20] = (it[it.size - 20].toInt() xor 0xff).toByte() }
        assertEquals("DAMAGED", code { MarkFile.parse(tampered, "1.1.0") })
        assertEquals("NOT_A_MARK", code { MarkFile.parse(pack(3, mapOf("a" to byteArrayOf(1)), magic = "ZIPZIPZI"), "1.1.0") })
        assertEquals("NOT_A_MARK", code { MarkFile.parse(byteArrayOf(1, 2, 3), "1.1.0") })
        assertEquals("TOO_NEW", code { MarkFile.parse(testMark(4, minShell = "2.0.0"), "1.1.0") })
        assertEquals("DAMAGED", code { MarkFile.parse(pack(5, mapOf("../evil" to byteArrayOf(1))), "1.1.0") })
        assertEquals("DAMAGED", code { MarkFile.parse(pack(5, mapOf("/abs" to byteArrayOf(1))), "1.1.0") })
    }

    @Test fun installSwitchesTheAppToTheNewPage() {
        val root = tempRoot()
        val u = Updater(root, "1.1.0", bundledMark = 2, bundledTitle = "Built in")
        assertEquals("/assets/index.html", u.startPath())
        assertTrue(u.current().builtIn)

        u.install(testMark(3), pinned = false)
        assertEquals("/site/Mk3/index.html", u.startPath())
        assertEquals("Mk III", u.current().name)
        val html = File(root, "site/Mk3/index.html").readText()
        assertTrue("font points at the bundled copy", html.contains("href=\"/assets/fonts/fonts.css\""))
        assertFalse("no Google Fonts left", html.contains("googleapis"))
        assertTrue(File(root, "updates/files/Siddur-MkIII.oleh").isFile)
    }

    @Test fun olderDownloadDoesNotBeatTheBuiltInPageUnlessChosen() {
        val root = tempRoot()
        val u = Updater(root, "1.1.0", bundledMark = 4, bundledTitle = "Built in")
        u.install(testMark(3), pinned = false)
        assertEquals("built-in Mk IV stays", "/assets/index.html", u.startPath())
        u.use(3)
        assertEquals("picking Mk III by hand sticks", "/site/Mk3/index.html", u.startPath())
        u.use(0)
        assertEquals("/assets/index.html", u.startPath())
        assertEquals("NOT_A_MARK", code { u.use(9) })
    }

    @Test fun newerApkMovesPastAnOlderDownload() {
        val root = tempRoot()
        Updater(root, "1.1.0", bundledMark = 2, bundledTitle = "").install(testMark(3), pinned = false)
        val afterApkUpdate = Updater(root, "1.2.0", bundledMark = 5, bundledTitle = "")
        assertEquals("/assets/index.html", afterApkUpdate.startPath())
    }

    @Test fun keepsTheNewestFive() {
        val root = tempRoot()
        val u = Updater(root, "1.1.0", bundledMark = 1, bundledTitle = "")
        for (n in 2..8) u.install(testMark(n), pinned = false)
        assertEquals(listOf(8, 7, 6, 5, 4), u.installed().map { it.mark })
        assertFalse(File(root, "site/Mk2").exists())
        assertFalse(File(root, "updates/files/Siddur-MkIII.oleh").exists())
        assertTrue(File(root, "updates/files/Siddur-MkIV.oleh").isFile)
        assertEquals("/site/Mk8/index.html", u.startPath())
    }

    @Test fun badFileChangesNothing() {
        val root = tempRoot()
        val u = Updater(root, "1.1.0", bundledMark = 1, bundledTitle = "")
        u.install(testMark(2), pinned = false)
        val before = u.startPath()
        try {
            u.install(byteArrayOf(9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9), pinned = true)
            fail("should refuse")
        } catch (e: MarkException) {
            assertEquals("NOT_A_MARK", e.code)
        }
        assertEquals(before, u.startPath())
        assertEquals(listOf(2), u.installed().map { it.mark })
    }
}
