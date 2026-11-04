package com.samuelreisen.siddur

import org.json.JSONObject
import java.io.File

/**
 * Keeps installed update files and decides which siddur page the app shows.
 * Everything lives under [root] (the app's files folder), so it works without Android classes and can be unit-tested.
 *
 *   site/MkN/index.html      the page from mark N, with the font link pointed at the bundled font
 *   site/MkN/mark.json       that mark's name and title
 *   updates/files/           the .oleh update files themselves (newest 5 kept)
 *   updates/state.json       {"current": N, "pinned": true|false}; current 0 means the page built into the app
 */
class Updater(
    private val root: File,
    val shellVersion: String,
    val bundledMark: Int,
    private val bundledTitle: String,
) {
    data class Version(val mark: Int, val name: String, val title: String, val builtIn: Boolean)

    private val site = File(root, "site")
    private val stored = File(root, "updates/files")
    private val stateFile = File(root, "updates/state.json")

    /** Parses, checks and installs an update file, then makes it the current page. Throws MarkException. */
    fun install(bytes: ByteArray, pinned: Boolean): MarkFile {
        val m = MarkFile.parse(bytes, shellVersion)
        val page = m.files["dist/index.html"]
            ?: throw MarkException("DAMAGED", "This update file has no siddur page in it.")
        val dir = File(site, "Mk${m.mark}")
        val tmp = File(site, "Mk${m.mark}.tmp")
        tmp.deleteRecursively()
        if (!tmp.mkdirs()) throw MarkException("DAMAGED", "Couldn't save the update on this phone.")
        File(tmp, "index.html").writeText(adaptPage(String(page, Charsets.UTF_8)), Charsets.UTF_8)
        val meta = JSONObject().put("mark", m.mark).put("name", MarkFile.markName(m.mark)).put("title", m.title).put("notes", m.notes)
        File(tmp, "mark.json").writeText(meta.toString(), Charsets.UTF_8)
        m.files["HANDOFF.md"]?.let { File(tmp, "HANDOFF.md").writeBytes(it) }
        dir.deleteRecursively()
        if (!tmp.renameTo(dir)) throw MarkException("DAMAGED", "Couldn't save the update on this phone.")
        stored.mkdirs()
        File(stored, "Siddur-Mk${MarkFile.roman(m.mark)}.oleh").writeBytes(bytes)
        writeState(m.mark, pinned)
        prune()
        return m
    }

    /** Switches to an installed mark, or to the built-in page when [mark] is 0. A choice made here sticks. */
    fun use(mark: Int) {
        if (mark != 0 && !File(site, "Mk$mark/index.html").isFile) throw MarkException("NOT_A_MARK", "That version isn't on this phone any more.")
        writeState(mark, true)
    }

    /** Path of the page to load, served at https://appassets.androidplatform.net + this path. */
    fun startPath(): String {
        val v = current()
        return if (v.builtIn) "/assets/index.html" else "/site/Mk${v.mark}/index.html"
    }

    /**
     * The installed mark wins when it is newer than the one built into the app, or when the person picked it.
     * So installing a newer APK moves past an older downloaded update automatically.
     */
    fun current(): Version {
        val st = readState()
        val mark = st.optInt("current", 0)
        val pinned = st.optBoolean("pinned", false)
        if (mark > 0 && File(site, "Mk$mark/index.html").isFile && (pinned || mark > bundledMark)) {
            return Version(mark, MarkFile.markName(mark), titleOf(mark), false)
        }
        return Version(bundledMark, if (bundledMark > 0) MarkFile.markName(bundledMark) else "Built-in", bundledTitle, true)
    }

    /** Installed marks, newest first. */
    fun installed(): List<Version> =
        (site.listFiles() ?: emptyArray())
            .mapNotNull { f -> Regex("^Mk(\\d+)$").find(f.name)?.groupValues?.get(1)?.toInt() }
            .filter { File(site, "Mk$it/index.html").isFile }
            .sortedDescending()
            .map { Version(it, MarkFile.markName(it), titleOf(it), false) }

    private fun titleOf(mark: Int): String = try {
        JSONObject(File(site, "Mk$mark/mark.json").readText(Charsets.UTF_8)).optString("title", "")
    } catch (e: Exception) {
        ""
    }

    /** Keeps the newest [KEEP] marks, never deleting the one in use. */
    private fun prune() {
        val inUse = readState().optInt("current", 0)
        for (old in installed().drop(KEEP)) {
            if (old.mark == inUse) continue
            File(site, "Mk${old.mark}").deleteRecursively()
            File(stored, "Siddur-Mk${MarkFile.roman(old.mark)}.oleh").delete()
        }
    }

    private fun readState(): JSONObject = try {
        JSONObject(stateFile.readText(Charsets.UTF_8))
    } catch (e: Exception) {
        JSONObject()
    }

    private fun writeState(mark: Int, pinned: Boolean) {
        stateFile.parentFile?.mkdirs()
        val tmp = File(stateFile.path + ".tmp")
        tmp.writeText(JSONObject().put("current", mark).put("pinned", pinned).toString(), Charsets.UTF_8)
        if (!tmp.renameTo(stateFile)) {
            stateFile.writeText(tmp.readText(Charsets.UTF_8), Charsets.UTF_8)
            tmp.delete()
        }
    }

    companion object {
        const val KEEP = 5

        /**
         * The page inside an update file is the web build (dist/index.html), which loads the Hebrew font from Google.
         * The app is offline, so point it at the bundled font instead, as tools/android-assets.js does for the built-in page.
         */
        fun adaptPage(html: String): String =
            html.replace(Regex("<link rel=\"preconnect\"[^>]*>\\n?"), "")
                .replace(Regex("<link rel=\"stylesheet\" href=\"https://fonts\\.googleapis\\.com[^>]*>"), "<link rel=\"stylesheet\" href=\"/assets/fonts/fonts.css\">")
    }
}
