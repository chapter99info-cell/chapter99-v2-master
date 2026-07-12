package au.com.chapter99.sunmishell;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import java.util.Locale;
import java.util.regex.Pattern;

import woyou.aidlservice.jiuiv5.IWoyouService;

/**
 * Kiosk shell: first-run shop code → staff PWA + Sunmi print bridge.
 */
public class MainActivity extends AppCompatActivity {
    private static final String TAG = "Chapter99Shell";
    private static final String PREFS = "shell";
    private static final String KEY_SHOP_SLUG = "shop_slug";
    private static final String KEY_STAFF_URL = "staff_url";
    private static final String BASE_STAFF_URL =
            "https://chapter99thaimass-v20.vercel.app/chapter99/staff";
    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");

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

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String slug = prefs.getString(KEY_SHOP_SLUG, null);
        String staffUrl = prefs.getString(KEY_STAFF_URL, null);

        // Intent override still works for advanced use; otherwise prefer saved shop.
        String intentUrl = readIntentStaffUrl();
        if (intentUrl != null) {
            showWebApp(intentUrl);
            return;
        }

        if (slug == null || slug.isEmpty() || staffUrl == null || staffUrl.isEmpty()) {
            showSetupScreen();
        } else {
            showWebApp(staffUrl);
        }
    }

    private String readIntentStaffUrl() {
        Intent intent = getIntent();
        if (intent == null) return null;
        String fromExtra = intent.getStringExtra("staff_url");
        if (fromExtra != null && fromExtra.startsWith("https://")) return fromExtra;
        if (intent.getData() != null) {
            String data = intent.getData().toString();
            if (data.startsWith("https://")) return data;
        }
        return null;
    }

    private void showSetupScreen() {
        setContentView(R.layout.activity_setup);
        EditText input = findViewById(R.id.shopSlugInput);
        TextView error = findViewById(R.id.setupError);
        Button save = findViewById(R.id.saveShopBtn);

        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String existing = prefs.getString(KEY_SHOP_SLUG, "");
        if (existing != null && !existing.isEmpty()) {
            input.setText(existing);
        }

        save.setOnClickListener(v -> {
            String raw = input.getText() != null ? input.getText().toString().trim() : "";
            String slug = raw.toLowerCase(Locale.US)
                    .replaceAll("\\s+", "-")
                    .replaceAll("[^a-z0-9-]", "");
            if (!SLUG_PATTERN.matcher(slug).matches()) {
                error.setVisibility(View.VISIBLE);
                error.setText("Enter a simple shop code like mira or princess (letters, numbers, hyphens).");
                return;
            }
            String url = BASE_STAFF_URL + "?shop=" + slug;
            prefs.edit()
                    .putString(KEY_SHOP_SLUG, slug)
                    .putString(KEY_STAFF_URL, url)
                    .apply();
            Toast.makeText(this, "Saved shop: " + slug, Toast.LENGTH_SHORT).show();
            showWebApp(url);
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showWebApp(String url) {
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

        Log.i(TAG, "Loading " + url);
        webView.loadUrl(url);
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
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "Change shop code");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .remove(KEY_SHOP_SLUG)
                    .remove(KEY_STAFF_URL)
                    .apply();
            if (webView != null) {
                webView.destroy();
                webView = null;
            }
            showSetupScreen();
            return true;
        }
        return super.onOptionsItemSelected(item);
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
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }
}
