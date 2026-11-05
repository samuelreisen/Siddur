# The page calls these through window.SiddurApp. R8 would otherwise remove or rename them in release builds,
# because nothing in Kotlin calls them directly.
-keepclassmembers class com.samuelreisen.siddur.UpdateBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
