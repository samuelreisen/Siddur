package com.samuelreisen.siddur

import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * window.SiddurApp in the page (see src/updates.js). Quick calls return JSON strings; network and install work
 * runs off the main thread and answers through window.siddurAppEvent(type, json) with type "check" or "install".
 * Nothing is downloaded unless the person taps a button.
 */
class UpdateBridge(private val activity: MainActivity, private val updater: Updater) {

    private val worker = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun info(): String {
        val cur = updater.current()
        val installed = JSONArray()
        for (v in updater.installed()) installed.put(JSONObject().put("mark", v.mark).put("name", v.name).put("title", v.title))
        return JSONObject()
            .put("shell", updater.shellVersion)
            .put("bundled", JSONObject().put("mark", updater.bundledMark).put("name", if (updater.bundledMark > 0) MarkFile.markName(updater.bundledMark) else "Built-in"))
            .put("current", JSONObject().put("mark", cur.mark).put("name", cur.name).put("title", cur.title).put("builtIn", cur.builtIn))
            .put("installed", installed)
            .toString()
    }

    @JavascriptInterface
    fun check() = worker.execute {
        val result = try {
            val latest = newestRecord(fetchHistory())
            val cur = updater.current()
            when {
                latest == null || latest.getInt("mark") <= cur.mark ->
                    JSONObject().put("status", "uptodate").put("name", cur.name)
                MarkFile.compareVersions(latest.optString("minShell", "1.0.0"), updater.shellVersion) > 0 ->
                    JSONObject().put("status", "needsApp").put("name", MarkFile.markName(latest.getInt("mark")))
                        .put("minShell", latest.optString("minShell")).put("shell", updater.shellVersion)
                else -> JSONObject().put("status", "available").put("mark", latest.getInt("mark"))
                    .put("name", MarkFile.markName(latest.getInt("mark"))).put("title", latest.optString("title"))
                    .put("notes", latest.optString("notes")).put("bytes", latest.optLong("bytes"))
            }
        } catch (e: Exception) {
            error(e, "Couldn't reach GitHub. Check your connection and try again.")
        }
        activity.sendEvent("check", result.toString())
    }

    @JavascriptInterface
    fun install(mark: Int) = worker.execute {
        val result = try {
            val history = fetchHistory()
            val rec = (0 until history.length()).map { history.getJSONObject(it) }.firstOrNull { it.getInt("mark") == mark }
                ?: throw MarkException("NOT_A_MARK", "That update isn't on GitHub any more. Check again.")
            val file = rec.getString("file")
            if (!Regex("^marks/out/[A-Za-z0-9_-]+\\.oleh$").matches(file)) throw MarkException("DAMAGED", "The update list on GitHub looks wrong.")
            val bytes = download(BASE_URL + file)
            if (MarkFile.sha256Hex(bytes) != rec.optString("sha256")) throw MarkException("DAMAGED", "The download didn't match the update list. Try again.")
            val m = updater.install(bytes, pinned = false)
            activity.reloadSoon()
            JSONObject().put("status", "installed").put("name", MarkFile.markName(m.mark))
        } catch (e: Exception) {
            error(e, "The download failed. Check your connection and try again.")
        }
        activity.sendEvent("install", result.toString())
    }

    /** The page reports its reading theme. Anything but the four known modes is ignored silently. */
    @JavascriptInterface
    fun setAppearance(mode: String?) {
        val valid = Appearance.parse(mode) ?: return
        activity.getSharedPreferences(MainActivity.PREFS, android.content.Context.MODE_PRIVATE)
            .edit().putString(MainActivity.KEY_APPEARANCE, valid).apply()
        activity.runOnUiThread { activity.applyAppearance(valid) }
    }

    @JavascriptInterface
    fun pickFile() = activity.runOnUiThread { activity.pickUpdateFile() }

    @JavascriptInterface
    fun use(mark: Int) = worker.execute {
        val result = try {
            updater.use(mark)
            activity.reloadSoon()
            JSONObject().put("status", "installed").put("name", if (mark == 0) "the built-in version" else MarkFile.markName(mark))
        } catch (e: Exception) {
            error(e, "Couldn't switch versions.")
        }
        activity.sendEvent("install", result.toString())
    }

    /** Installs bytes the person chose (file picker or opening a .oleh file). Runs off the main thread. */
    fun installChosenFile(read: () -> ByteArray, onDone: (JSONObject) -> Unit) = worker.execute {
        val result = try {
            val m = updater.install(read(), pinned = true)
            activity.reloadSoon()
            JSONObject().put("status", "installed").put("name", MarkFile.markName(m.mark))
        } catch (e: Exception) {
            error(e, "Couldn't read that file.")
        }
        onDone(result)
    }

    private fun error(e: Exception, fallback: String): JSONObject =
        JSONObject().put("status", "error").put("message", if (e is MarkException) e.message else fallback)

    private fun fetchHistory(): JSONArray =
        JSONArray(String(download(BASE_URL + "marks/history.json"), Charsets.UTF_8))

    private fun newestRecord(arr: JSONArray): JSONObject? =
        (0 until arr.length()).map { arr.getJSONObject(it) }.maxByOrNull { it.getInt("mark") }

    private fun download(url: String): ByteArray {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        conn.setRequestProperty("User-Agent", "Siddur-Android/" + updater.shellVersion)
        conn.setRequestProperty("Cache-Control", "no-cache")
        try {
            if (conn.responseCode != 200) throw MarkException("NOT_A_MARK", "GitHub answered ${conn.responseCode}. Try again later.")
            conn.inputStream.use { input -> return readCapped(input) }
        } finally {
            conn.disconnect()
        }
    }

    companion object {
        const val BASE_URL = "https://raw.githubusercontent.com/samuelreisen/Siddur/main/"
        private const val MAX_DOWNLOAD = 64 * 1024 * 1024

        fun readCapped(input: java.io.InputStream): ByteArray {
            val out = ByteArrayOutputStream()
            val chunk = ByteArray(64 * 1024)
            var total = 0
            while (true) {
                val n = input.read(chunk)
                if (n < 0) break
                total += n
                if (total > MAX_DOWNLOAD) throw MarkException("DAMAGED", "That file is too large to be a Siddur update.")
                out.write(chunk, 0, n)
            }
            return out.toByteArray()
        }
    }
}
