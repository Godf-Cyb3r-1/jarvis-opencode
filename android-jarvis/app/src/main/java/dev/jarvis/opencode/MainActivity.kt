package dev.jarvis.opencode

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.view.View
import android.webkit.HttpAuthHandler
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import android.widget.Toast
import android.net.Uri

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var container: LinearLayout
    private lateinit var remoteUrl: EditText
    private lateinit var modes: RadioGroup
    private val preferences by lazy { getSharedPreferences("jarvis", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(22, 22, 22, 22)
        }
        val title = TextView(this).apply { text = "Jarvis OpenCode — execution mode"; textSize = 20f }
        container.addView(title)
        modes = RadioGroup(this)
        val local = RadioButton(this).apply { id = View.generateViewId(); text = "Local server (127.0.0.1:4096)" }
        val cloud = RadioButton(this).apply { id = View.generateViewId(); text = "Instabox cloud server (HTTPS)" }
        modes.addView(local); modes.addView(cloud)
        modes.check(if (preferences.getString("mode", "local") == "cloud") cloud.id else local.id)
        container.addView(modes)
        remoteUrl = EditText(this).apply {
            hint = "https://YOUR-INSTABOX-HTTPS-ENDPOINT"
            setSingleLine(true)
            setText(preferences.getString("url", ""))
        }
        container.addView(remoteUrl)
        container.addView(TextView(this).apply {
            text = "Cloud mode requires a running Jarvis/OpenCode web server on Instabox, exposed over HTTPS with server authentication. Local mode requires a separately running server on this device."
        })
        val connect = Button(this).apply { text = "Connect to Jarvis" }
        container.addView(connect)
        web = WebView(this)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val target = request.url
                val base = Uri.parse(view.url ?: return true)
                return target.host != base.host || target.scheme != base.scheme
            }
            override fun onReceivedHttpAuthRequest(view: WebView, handler: HttpAuthHandler, host: String, realm: String) {
                val username = EditText(this@MainActivity).apply { hint = "Username" }
                val password = EditText(this@MainActivity).apply {
                    hint = "Server password"
                    inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                }
                val fields = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(username); addView(password)
                }
                AlertDialog.Builder(this@MainActivity).setTitle("Server authentication")
                    .setView(fields).setPositiveButton("Sign in") { _, _ -> handler.proceed(username.text.toString(), password.text.toString()) }
                    .setNegativeButton("Cancel") { _, _ -> handler.cancel() }.show()
            }
        }
        connect.setOnClickListener {
            val selected = if (modes.checkedRadioButtonId == cloud.id) "cloud" else "local"
            val url = if (selected == "cloud") remoteUrl.text.toString().trim().trimEnd('/') else "http://127.0.0.1:4096"
            val parsed = Uri.parse(url)
            if ((selected == "cloud" && (parsed.scheme != "https" || parsed.host.isNullOrBlank())) ||
                (selected == "local" && parsed.host != "127.0.0.1")) {
                Toast.makeText(this, "Cloud mode requires a valid HTTPS URL", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            preferences.edit().putString("mode", selected).putString("url", remoteUrl.text.toString().trim()).apply()
            container.removeAllViews()
            container.addView(web, LinearLayout.LayoutParams(-1, 0, 1f))
            container.addView(Button(this).apply { text = "Connection settings"; setOnClickListener { recreate() } })
            web.loadUrl(url)
        }
        setContentView(container)
    }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::web.isInitialized && web.canGoBack()) web.goBack() else super.onBackPressed()
    }
    override fun onDestroy() {
        if (::web.isInitialized) { web.stopLoading(); web.destroy() }
        super.onDestroy()
    }
}
