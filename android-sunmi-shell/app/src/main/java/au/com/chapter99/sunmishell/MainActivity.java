package au.com.chapter99.sunmishell;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Color;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import woyou.aidlservice.jiuiv5.IWoyouService;

/**
 * Kiosk shell: loads Chapter99 staff PWA and bridges print calls to Sunmi's built-in printer.
 *
 * Override load URL with:
 *   adb shell am start -n au.com.chapter99.sunmishell/.MainActivity \
 *     --es staff_url "https://chapter99thaimass-v20.vercel.app/chapter99/staff?shop=mira"
 */
public class MainActivity extends AppCompatActivity {
    private static final String TAG = "Chapter99Shell";
    public static final String EXTRA_STAFF_URL = "staff_url";
    public static final String DEFAULT_STAFF_URL =
            "https://chapter99thaimass-v20.vercel.app/chapter99/staff";

    private WebView webView;
    private final SunmiPrinterBridge bridge = new SunmiPrinterBridge();

    private final ServiceConnection printConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            Log.i(TAG, "Sunmi print service connected");
            bridge.setPrinter(IWoyouService.Stub.asInterface(service));
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            Log.w(TAG, "Sunmi print service disconnected");
            bridge.setPrinter(null);
        }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(false);
        settings.setUserAgentString(settings.getUserAgentString() + " Chapter99SunmiShell/1.0");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        webView.addJavascriptInterface(bridge, "Chapter99Sunmi");
        bindSunmiPrinter();

        String url = resolveStaffUrl();
        Log.i(TAG, "Loading " + url);
        webView.loadUrl(url);
    }

    private String resolveStaffUrl() {
        Intent intent = getIntent();
        if (intent != null) {
            String fromExtra = intent.getStringExtra(EXTRA_STAFF_URL);
            if (fromExtra != null && fromExtra.startsWith("https://")) return fromExtra;
            if (intent.getData() != null) {
                String data = intent.getData().toString();
                if (data.startsWith("https://")) return data;
            }
        }
        return getSharedPreferences("shell", MODE_PRIVATE)
                .getString("staff_url", DEFAULT_STAFF_URL);
    }

    private void bindSunmiPrinter() {
        try {
            Intent intent = new Intent();
            intent.setPackage("woyou.aidlservice.jiuiv5");
            intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");
            startService(intent);
            boolean bound = bindService(intent, printConnection, Context.BIND_AUTO_CREATE);
            Log.i(TAG, "bindService result=" + bound);
        } catch (Exception e) {
            Log.e(TAG, "Failed to bind Sunmi print service (OK on non-Sunmi devices)", e);
        }
    }

    @Override
    protected void onDestroy() {
        try {
            unbindService(printConnection);
        } catch (Exception ignored) {
        }
        bridge.setPrinter(null);
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            // Kiosk: stay in app
            moveTaskToBack(true);
        }
    }
}
