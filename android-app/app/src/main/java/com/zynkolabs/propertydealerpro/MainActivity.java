package com.zynkolabs.propertydealerpro;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
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

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private WebViewAssetLoader assetLoader;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
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
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
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
            if (url.startsWith(APP_ORIGIN + "/")) injectAndroidBackupBridge();
        }
    }

    private class AppWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams fileChooserParams) {
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

    private void injectAndroidBackupBridge() {
        String script = "(function(){if(!window.AndroidBridge||typeof window.AndroidBridge.saveBackup!=='function')return;" +
                "window.backupData=function(){var createdAt=new Date().toISOString();var payload={app:'Property Dealer Pro',appId:BACKUP_APP_ID,storageKey:KEY,backupVersion:BACKUP_VERSION,createdAt:createdAt,data:state};" +
                "try{var filename='Property_Dealer_Pro_Backup_'+today()+'.json';AndroidBridge.saveBackup(filename,JSON.stringify(payload,null,2));localStorage.setItem(BACKUP_META_KEY,createdAt);updateBackupStatus();showSimpleToast('Backup saved to Downloads');}" +
                "catch(e){alert('Could not create backup on this device.');}};" +
                "var h=document.querySelector('.mgr-license-help');if(h)h.innerHTML='<b>Important:</b> the license is tied to this app and this Device ID. If app data is cleared or the app is reinstalled, a new activation may be required.';" +
                "})();";
        webView.evaluateJavascript(script, null);
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void saveBackup(String requestedName, String json) {
            String filename = sanitizeFilename(requestedName);
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
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

    private String sanitizeFilename(String name) {
        String clean = name == null ? "Property_Dealer_Pro_Backup.json" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!clean.toLowerCase().endsWith(".json")) clean += ".json";
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
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
        }
        super.onDestroy();
    }
}
