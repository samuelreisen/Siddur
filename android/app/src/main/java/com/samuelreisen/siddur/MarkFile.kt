package com.samuelreisen.siddur

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.zip.GZIPInputStream

/** A failure reading an update file. [code] is NOT_A_MARK, DAMAGED or TOO_NEW, as in scripts/markpack.js. */
class MarkException(val code: String, message: String) : Exception(message)

/**
 * An update file ("mark", extension .oleh). Same container and checks as scripts/markpack.js:
 * bytes 0-7 magic "OLEH____" | u32 big-endian header length L | L bytes UTF-8 JSON header | gzip(all files joined).
 * Checksums catch damage; they are not signatures.
 */
class MarkFile private constructor(val header: JSONObject, val files: Map<String, ByteArray>) {
    val mark: Int get() = header.getInt("mark")
    val title: String get() = header.optString("title", "")
    val notes: String get() = header.optString("notes", "")
    val minShell: String get() = header.optString("minShell", "1.0.0")

    companion object {
        private val MAGIC = "OLEH____".toByteArray(Charsets.ISO_8859_1)
        private const val MAX_PAYLOAD = 64L * 1024 * 1024 // guards against a file that unpacks to something huge

        fun parse(buf: ByteArray, shellVersion: String?): MarkFile {
            if (buf.size < 12) throw MarkException("NOT_A_MARK", "This isn't a Siddur update file.")
            if (!buf.copyOfRange(0, 8).contentEquals(MAGIC)) throw MarkException("NOT_A_MARK", "This isn't a Siddur update file.")
            val len = ((buf[8].toLong() and 0xff) shl 24) or ((buf[9].toLong() and 0xff) shl 16) or
                ((buf[10].toLong() and 0xff) shl 8) or (buf[11].toLong() and 0xff)
            if (len < 2 || 12 + len > buf.size) throw damaged("bad header length")
            val header = try {
                JSONObject(String(buf, 12, len.toInt(), Charsets.UTF_8))
            } catch (e: Exception) {
                throw damaged("header is not valid JSON")
            }
            val payload = try {
                gunzip(buf, 12 + len.toInt())
            } catch (e: MarkException) {
                throw e
            } catch (e: Exception) {
                throw damaged("payload will not decompress")
            }
            if (payload.size.toLong() != header.optLong("payloadSize", -1) || sha256Hex(payload) != header.optString("payloadSha256")) {
                throw damaged("payload checksum mismatch")
            }
            val list = header.optJSONArray("files") ?: JSONArray()
            val files = LinkedHashMap<String, ByteArray>()
            for (i in 0 until list.length()) {
                val f = list.getJSONObject(i)
                val rel = safeRel(f.getString("path"))
                val offset = f.getLong("offset")
                val size = f.getLong("size")
                if (offset < 0 || size < 0 || offset + size > payload.size) throw damaged("bad file entry for $rel")
                val bytes = payload.copyOfRange(offset.toInt(), (offset + size).toInt())
                if (sha256Hex(bytes) != f.optString("sha256")) throw damaged("checksum mismatch in $rel")
                files[rel] = bytes
            }
            val minShell = header.optString("minShell", "")
            if (shellVersion != null && minShell.isNotEmpty() && compareVersions(minShell, shellVersion) > 0) {
                throw MarkException("TOO_NEW", "This update needs app $minShell or newer (you have $shellVersion). Install the latest APK first.")
            }
            return MarkFile(header, files)
        }

        private fun damaged(why: String) = MarkException("DAMAGED", "This update file is damaged ($why). Download it again.")

        private fun gunzip(buf: ByteArray, start: Int): ByteArray {
            GZIPInputStream(ByteArrayInputStream(buf, start, buf.size - start)).use { input ->
                val out = ByteArrayOutputStream()
                val chunk = ByteArray(64 * 1024)
                var total = 0L
                while (true) {
                    val n = input.read(chunk)
                    if (n < 0) break
                    total += n
                    if (total > MAX_PAYLOAD) throw damaged("contents are too large")
                    out.write(chunk, 0, n)
                }
                return out.toByteArray()
            }
        }

        /** Rejects absolute paths, drive letters, empty segments and "..", like safeRel in markpack.js. */
        fun safeRel(p: String): String {
            val s = p.replace('\\', '/')
            if (s.isEmpty() || s.startsWith("/") || Regex("^[a-zA-Z]:").containsMatchIn(s) || s.split('/').any { it.isEmpty() || it == ".." }) {
                throw MarkException("DAMAGED", "This update file is damaged (unsafe path $p).")
            }
            return s
        }

        fun compareVersions(a: String, b: String): Int {
            val pa = a.split('.').map { it.toIntOrNull() ?: 0 }
            val pb = b.split('.').map { it.toIntOrNull() ?: 0 }
            for (i in 0 until 3) {
                val d = pa.getOrElse(i) { 0 } - pb.getOrElse(i) { 0 }
                if (d != 0) return if (d < 0) -1 else 1
            }
            return 0
        }

        fun sha256Hex(bytes: ByteArray): String =
            MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

        private val ROMAN = listOf(1000 to "M", 900 to "CM", 500 to "D", 400 to "CD", 100 to "C", 90 to "XC",
            50 to "L", 40 to "XL", 10 to "X", 9 to "IX", 5 to "V", 4 to "IV", 1 to "I")

        fun roman(n: Int): String {
            var left = n
            val sb = StringBuilder()
            for ((v, s) in ROMAN) while (left >= v) { sb.append(s); left -= v }
            return sb.toString()
        }

        fun markName(n: Int): String = "Mk " + roman(n)
    }
}
