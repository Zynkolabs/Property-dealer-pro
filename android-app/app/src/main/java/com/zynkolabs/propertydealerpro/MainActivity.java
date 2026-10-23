package com.zynkolabs.propertydealerpro;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private WebViewAssetLoader assetLoader;
    private AndroidBridge androidBridge;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }
        WebView.setWebContentsDebuggingEnabled(false);
        setContentView(webView);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setLoadsImagesAutomatically(true);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }

        androidBridge = new AndroidBridge();
        // "Android" is used by ZK-ONE licensing. "AndroidBridge" keeps native backup compatibility.
        webView.addJavascriptInterface(androidBridge, "Android");
        webView.addJavascriptInterface(androidBridge, "AndroidBridge");
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.loadUrl(APP_ORIGIN + "/assets/index.html");
    }

    private boolean openExternal(String url) {
        try {
            Uri uri = Uri.parse(url);
            Intent intent = url.startsWith("tel:")
                    ? new Intent(Intent.ACTION_DIAL, uri)
                    : new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
            return true;
        } catch (Exception e) {
            Toast.makeText(this, "No app found to open this link", Toast.LENGTH_SHORT).show();
            return true;
        }
    }

    private class AppWebViewClient extends WebViewClient {
        @Nullable
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return assetLoader.shouldInterceptRequest(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (url.startsWith(APP_ORIGIN + "/")) return false;
            return openExternal(url);
        }

        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url.startsWith(APP_ORIGIN + "/")) return false;
            return openExternal(url);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (url.startsWith(APP_ORIGIN + "/")) injectNativeEnhancements();
        }
    }

    private class AppWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (filePathCallback != null) filePathCallback.onReceiveValue(null);
            filePathCallback = callback;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/json", "text/plain"});
            startActivityForResult(intent, FILE_CHOOSER_REQUEST);
            return true;
        }

        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
            WebView popup = new WebView(MainActivity.this);
            popup.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    openExternal(request.getUrl().toString());
                    v.destroy();
                    return true;
                }

                @SuppressWarnings("deprecation")
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, String url) {
                    openExternal(url);
                    v.destroy();
                    return true;
                }
            });
            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
            transport.setWebView(popup);
            resultMsg.sendToTarget();
            return true;
        }
    }

    private void injectNativeEnhancements() {
        String script = "(function(){" +
                "if(window.AndroidBridge&&typeof AndroidBridge.saveBackup==='function'){" +
                "window.backupData=async function(){try{" +
                "state.lastBackup=new Date().toISOString();" +
                "if(typeof dbSet==='function')await dbSet(STATE_KEY,state);" +
                "var payload={app:'Property Dealer Pro All-in-One',appId:'property_dealer_pro',backupVersion:1,createdAt:state.lastBackup,data:state};" +
                "AndroidBridge.saveBackup('Property_Dealer_Pro_Backup_'+today()+'.json',JSON.stringify(payload,null,2));" +
                "if(typeof updateBackupStatus==='function')updateBackupStatus();" +
                "if(typeof toast==='function')toast('Complete backup saved to Downloads');" +
                "}catch(e){if(typeof toast==='function')toast('Backup failed');}};" +
                "}" +
                "document.documentElement.style.webkitTapHighlightColor='transparent';" +
                "})();";
        webView.evaluateJavascript(script, null);
    }

    public class AndroidBridge {
        private String cachedDeviceId;

        @JavascriptInterface
        public String getDeviceId() {
            if (cachedDeviceId == null) cachedDeviceId = buildStableDeviceId();
            return cachedDeviceId;
        }

        @JavascriptInterface
        public void saveBackup(String requestedName, String json) {
            String filename = sanitizeFilename(requestedName);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                    values.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Property Dealer Pro");
                    values.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new Exception("Could not create backup file");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new Exception("Could not open backup file");
                        out.write(json.getBytes(StandardCharsets.UTF_8));
                    }
                    values.clear();
                    values.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, values, null, null);
                    showToast("Backup saved: Downloads/Property Dealer Pro/" + filename);
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), "Backups");
                    if (!dir.exists() && !dir.mkdirs()) throw new Exception("Could not create backup folder");
                    File file = new File(dir, filename);
                    try (FileOutputStream out = new FileOutputStream(file)) {
                        out.write(json.getBytes(StandardCharsets.UTF_8));
                    }
                    showToast("Backup saved in app Documents/Backups");
                }
            } catch (Exception e) {
                showToast("Backup failed: " + e.getMessage());
            }
        }
    }

    private String buildStableDeviceId() {
        try {
            String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
            if (androidId == null || androidId.trim().isEmpty()) {
                androidId = Build.MANUFACTURER + "|" + Build.MODEL + "|" + Build.DEVICE;
            }
            String seed = "zynko-property-dealer-pro|" + androidId;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(seed.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format(Locale.US, "%02X", b & 0xFF));
            String h = hex.substring(0, 24);
            return "DEV-" + h.substring(0, 6) + "-" + h.substring(6, 12) + "-" + h.substring(12, 18) + "-" + h.substring(18, 24);
        } catch (Exception e) {
            return "DEV-000000-000000-000000-000000";
        }
    }

    private String sanitizeFilename(String name) {
        String clean = name == null ? "Property_Dealer_Pro_Backup.json" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!clean.toLowerCase(Locale.US).endsWith(".json")) clean += ".json";
        return clean;
    }

    private void showToast(String text) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_LONG).show());
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("Android");
            webView.removeJavascriptInterface("AndroidBridge");
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
