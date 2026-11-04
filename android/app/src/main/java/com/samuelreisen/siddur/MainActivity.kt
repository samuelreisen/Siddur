package com.samuelreisen.siddur

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.content.res.Configuration
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var updater: Updater
    private lateinit var bridge: UpdateBridge
    private val main = Handler(Looper.getMainLooper())

    // Built-in page and installed updates are served from one https origin, so settings in localStorage
    // carry over between versions, and motion sensors (tilt to turn pages) get a secure context.
    private lateinit var assetLoader: WebViewAssetLoader

    private val pickFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) {
            sendEvent("install", JSONObject().put("status", "cancelled").toString())
        } else {
            bridge.installChosenFile({ readUri(uri) }) { sendEvent("install", it.toString()) }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val bundled = readBundledMark()
        updater = Updater(filesDir, BuildConfig.VERSION_NAME, bundled.optInt("mark", 0), bundled.optString("title", ""))
        bridge = UpdateBridge(this, updater)
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(APP_HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/site/", WebViewAssetLoader.InternalStoragePathHandler(this, File(filesDir, "site")))
            .build()

        webView = WebView(this)
        // Colours first, so a Dark or Paper reader never sees a white flash.
        applyAppearance(storedAppearance())
        // Android 15 forces edge-to-edge; keep the page clear of the bars and the keyboard, and let the window colour show behind them.
        ViewCompat.setOnApplyWindowInsetsListener(webView) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_NO_CACHE
            // The page sizes its own text; no pinch zoom or zoom buttons. textZoom is left at the system value.
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            if (Build.VERSION.SDK_INT >= 29) {
                // The page ships its own dark theme (prefers-color-scheme).
                @Suppress("DEPRECATION")
                forceDark = WebSettings.FORCE_DARK_OFF
            }
            if (Build.VERSION.SDK_INT >= 33) {
                isAlgorithmicDarkeningAllowed = false
            }
        }
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalScrollBarEnabled = false
        webView.addJavascriptInterface(bridge, "SiddurApp")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.host == APP_HOST) return false
                val scheme = uri.scheme?.lowercase()
                if (scheme == "http" || scheme == "https") {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                    } catch (_: ActivityNotFoundException) {
                        // No browser available; ignore the tap.
                    }
                }
                return true
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        if (savedInstanceState != null) webView.restoreState(savedInstanceState) else loadStartPage()
        handleOpenedFile(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleOpenedFile(intent)
    }

    /** Someone opened a .oleh file with the app (from Files or a download). */
    private fun handleOpenedFile(intent: Intent?) {
        if (intent?.action != Intent.ACTION_VIEW) return
        val uri = intent.data ?: return
        intent.data = null // don't install it again after a rotation
        bridge.installChosenFile({ readUri(uri) }) { result ->
            main.post {
                val msg = if (result.optString("status") == "installed") "Installed ${result.optString("name")}" else result.optString("message")
                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun readUri(uri: Uri): ByteArray =
        contentResolver.openInputStream(uri)?.use { UpdateBridge.readCapped(it) }
            ?: throw MarkException("NOT_A_MARK", "Couldn't open that file.")

    fun pickUpdateFile() {
        try {
            pickFile.launch(arrayOf("*/*"))
        } catch (_: ActivityNotFoundException) {
            sendEvent("install", JSONObject().put("status", "error").put("message", "This phone has no file picker.").toString())
        }
    }

    /** Calls window.siddurAppEvent(type, json) in the page. Safe from any thread. */
    fun sendEvent(type: String, json: String) = main.post {
        webView.evaluateJavascript("window.siddurAppEvent && window.siddurAppEvent(${JSONObject.quote(type)}, ${JSONObject.quote(json)})", null)
    }

    /** Reloads into whichever version is now current, after the "Installed" message has shown briefly. */
    fun reloadSoon() = main.postDelayed({ loadStartPage() }, 900)

    private fun loadStartPage() {
        webView.loadUrl("https://$APP_HOST${updater.startPath()}")
    }

    private fun readBundledMark(): JSONObject = try {
        JSONObject(assets.open("bundled-mark.json").bufferedReader().use { it.readText() })
    } catch (e: Exception) {
        JSONObject()
    }

    private fun storedAppearance(): String =
        Appearance.parse(getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_APPEARANCE, null)) ?: Appearance.AUTO

    private fun systemNight(): Boolean =
        (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    /** Makes the window, WebView and system bars match the page's reading theme. Call on the UI thread. */
    fun applyAppearance(mode: String) {
        val night = systemNight()
        val bg = Appearance.backgroundFor(mode, night)
        val light = !Appearance.isDark(mode, night)
        window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(bg))
        if (::webView.isInitialized) webView.setBackgroundColor(bg)
        @Suppress("DEPRECATION")
        window.statusBarColor = bg
        @Suppress("DEPRECATION")
        window.navigationBarColor = bg
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = light
            isAppearanceLightNavigationBars = light
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (storedAppearance() == Appearance.AUTO) applyAppearance(Appearance.AUTO)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        const val PREFS = "prefs"
        const val KEY_APPEARANCE = "appearance"
        const val APP_HOST = "appassets.androidplatform.net"
    }
}
