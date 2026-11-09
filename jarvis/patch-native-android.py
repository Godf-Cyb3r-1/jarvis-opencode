#!/usr/bin/env python3
"""Reuse the original native Jarvis Android app, adding an explicit HTTPS cloud mode.
The native dashboard stays the default for local execution; cloud opens OpenCode's
graphical web UI in the same app. No shell/TUI is shown to the user.
"""
from pathlib import Path
p = Path("native-android/opencode-android/app/src/main/java/com/termux/app/OpenCodeWebActivity.java")
s = p.read_text()
def edit(old, new):
    global s
    if old not in s:
        raise SystemExit("Android source changed: " + old[:90])
    s = s.replace(old, new, 1)

edit('menu.getMenu().add(0, 10, 9, R.string.oc_status);',
     'menu.getMenu().add(0, 10, 9, R.string.oc_status);\n        menu.getMenu().add(0, 11, 10, "Execution mode: Local / Instabox");')
edit('case 10: recoveryStatus(); break;', 'case 10: recoveryStatus(); break;\n                case 11: chooseExecutionMode(); break;')
point = '    private void loadRoute(String route) {'
addition = """
    /** Native platform picker; never store Instabox API tokens in the app. */
    private void chooseExecutionMode() {
        final String[] choices = {"Local Android engine", "Instabox cloud (HTTPS)"};
        new AlertDialog.Builder(this).setTitle("Jarvis execution mode")
            .setSingleChoiceItems(choices,
                "cloud".equals(OpenCodeWebService.preferences(this).getString("jarvis_execution_mode", "local")) ? 1 : 0,
                (dialog, choice) -> {
                    dialog.dismiss();
                    if (choice == 0) {
                        OpenCodeWebService.preferences(this).edit().putString("jarvis_execution_mode", "local").apply();
                        recreate();
                    } else requestCloudEndpoint();
                })
            .setNegativeButton(android.R.string.cancel, null).show();
    }

    private void requestCloudEndpoint() {
        final android.widget.EditText input = new android.widget.EditText(this);
        input.setSingleLine(true);
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT |
            android.text.InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("https://your-instabox-endpoint");
        input.setText(OpenCodeWebService.preferences(this).getString("jarvis_cloud_url", ""));
        new AlertDialog.Builder(this).setTitle("Instabox OpenCode web endpoint")
            .setMessage("Use the HTTPS URL of your authenticated, running Jarvis server. Do not paste an Instabox API token.")
            .setView(input)
            .setPositiveButton("Connect", (dialog, which) -> {
                String endpoint = input.getText().toString().trim();
                android.net.Uri uri = android.net.Uri.parse(endpoint);
                if (!"https".equals(uri.getScheme()) || uri.getHost() == null ||
                    uri.getEncodedAuthority().contains("@") || uri.getFragment() != null ||
                    uri.getHost().equals("localhost") || uri.getHost().equals("127.0.0.1")) {
                    android.widget.Toast.makeText(this, "A valid remote HTTPS URL is required",
                        android.widget.Toast.LENGTH_LONG).show();
                    return;
                }
                OpenCodeWebService.preferences(this).edit()
                    .putString("jarvis_execution_mode", "cloud").putString("jarvis_cloud_url", endpoint).apply();
                connectCloud(endpoint);
            }).setNegativeButton(android.R.string.cancel, null).show();
    }

    private void connectCloud(String endpoint) {
        if (dashboard != null) dashboard.setVisibility(View.GONE);
        if (loading != null) loading.setVisibility(View.GONE);
        if (web == null) return;
        final android.net.Uri base = android.net.Uri.parse(endpoint);
        web.setWebViewClient(new android.webkit.WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                android.net.Uri next = request.getUrl();
                return !("https".equals(next.getScheme()) && base.getHost().equals(next.getHost()) &&
                    base.getPort() == next.getPort());
            }
            @Override public void onReceivedHttpAuthRequest(WebView view, android.webkit.HttpAuthHandler handler, String host, String realm) {
                android.widget.EditText user = new android.widget.EditText(OpenCodeWebActivity.this);
                user.setHint("Username");
                android.widget.EditText password = new android.widget.EditText(OpenCodeWebActivity.this);
                password.setHint("Server password");
                password.setInputType(129);
                android.widget.LinearLayout form = new android.widget.LinearLayout(OpenCodeWebActivity.this);
                form.setOrientation(android.widget.LinearLayout.VERTICAL);
                form.addView(user); form.addView(password);
                new AlertDialog.Builder(OpenCodeWebActivity.this)
                    .setTitle("Jarvis server authentication").setView(form)
                    .setPositiveButton("Sign in", (d,w) -> handler.proceed(user.getText().toString(), password.getText().toString()))
                    .setNegativeButton("Cancel", (d,w) -> handler.cancel()).show();
            }
        });
        if (web.getParent() instanceof android.widget.FrameLayout) {
            android.widget.Button changeMode = new android.widget.Button(this);
            changeMode.setText("MODE");
            changeMode.setContentDescription("Change execution mode");
            changeMode.setOnClickListener(v -> chooseExecutionMode());
            android.widget.FrameLayout.LayoutParams position = new android.widget.FrameLayout.LayoutParams(
                dp(84), dp(48), android.view.Gravity.TOP | android.view.Gravity.END);
            ((android.widget.FrameLayout) web.getParent()).addView(changeMode, position);
        }
        web.loadUrl(endpoint);
    }

"""
edit(point,addition + point)
edit('"Android TTS settings"\n        };', '"Android TTS settings",\n            "Execution mode: Local / Instabox"\n        };')
edit('case 7:\n                        try { startActivity(new Intent("com.android.settings.TTS_SETTINGS")); }\n                        catch (Exception unavailable) { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); }\n                        break;',
     'case 7:\n                        try { startActivity(new Intent("com.android.settings.TTS_SETTINGS")); }\n                        catch (Exception unavailable) { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); }\n                        break;\n                    case 8: chooseExecutionMode(); break;')

edit('TermuxInstaller.setupBootstrapIfNeeded(this, () -> { bootstrapped = true; begin(); offerBackgroundAccess(); });',
     '''if ("cloud".equals(OpenCodeWebService.preferences(this).getString("jarvis_execution_mode", "local"))) {
            String endpoint = OpenCodeWebService.preferences(this).getString("jarvis_cloud_url", "");
            if (endpoint.startsWith("https://")) connectCloud(endpoint);
            else requestCloudEndpoint();
        } else {
            TermuxInstaller.setupBootstrapIfNeeded(this, () -> { bootstrapped = true; begin(); offerBackgroundAccess(); });
        }''')
p.write_text(s)
print("Patched native Android UI:",p)


# Adapt only the native speech channel; never alter the exact on-screen transcript.
voice = Path("native-android/opencode-android/app/src/main/java/com/termux/app/JarvisSpeechStyle.java")
spoken = voice.read_text()
target = "        String text = normalizeOmniVoiceTags(raw)\n"
substitute = r'''        String human = raw.replaceAll("(?i)\\[(?:laughter|sigh|confirmation-en|question-(?:oh|en|ah|ei|yi)|surprise-(?:ah|wa|yo|oh)|dissatisfaction-hnn)\\]", " ").trim();
        if (human.contains("\x60\x60\x60") || human.startsWith("{") ||
            human.matches("(?s).*(?:Traceback \\(most recent call last\\)|Exception in thread).*"))
            return "I've put the technical details on screen.";
        String text = normalizeOmniVoiceTags(raw)
            .replaceAll("(?i)\\[(?:laughter|sigh|confirmation-en|question-(?:oh|en|ah|ei|yi)|surprise-(?:ah|wa|yo|oh)|dissatisfaction-hnn)\\]", " ")
'''
if target not in spoken:
    raise SystemExit("Android JarvisSpeechStyle.prepare changed; cannot apply voice patch")
voice.write_text(spoken.replace(target, substitute, 1))
print("Patched native spoken response rendering:", voice)
