package com.example

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.example.ui.theme.MyApplicationTheme
import java.io.File

class MainActivity : ComponentActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()

    // Immersive full-screen gaming mode
    val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
    windowInsetsController.systemBarsBehavior =
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())

    // Ensure WebView cache directories exist to avoid Chromium index file enumerator errors
    try {
      val webViewDir = File(cacheDir, "WebView/Default")
      val httpCache = File(webViewDir, "HTTP Cache")
      File(httpCache, "Code Cache/js").mkdirs()
      File(httpCache, "Code Cache/wasm").mkdirs()
      File(webViewDir, "Code Cache/js").mkdirs()
      File(webViewDir, "Code Cache/wasm").mkdirs()
    } catch (_: Exception) {}

    setContent {
      MyApplicationTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF08070D))
                .testTag("tom_fight_container")
        ) {
          TomFightGameScreen()
        }
      }
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TomFightGameScreen() {
  AndroidView(
      modifier = Modifier
          .fillMaxSize()
          .testTag("tom_fight_game_view"),
      factory = { context ->
        WebView(context).apply {
          layoutParams = ViewGroup.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.MATCH_PARENT
          )

          // Use default layer type so Chromium's internal compositor handles hardware/software fallback
          setLayerType(View.LAYER_TYPE_NONE, null)
          setBackgroundColor(0xFF08070D.toInt())

          settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_NO_CACHE
            useWideViewPort = true
            loadWithOverviewMode = true
            displayZoomControls = false
            builtInZoomControls = false
          }

          webViewClient = object : WebViewClient() {}
          webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
              return true
            }
          }

          loadUrl("file:///android_asset/tomfight/index.html")
        }
      },
      update = { webView ->
        // Keep webview updated
      }
  )
}


