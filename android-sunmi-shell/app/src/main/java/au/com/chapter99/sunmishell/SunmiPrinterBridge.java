package au.com.chapter99.sunmishell;

import android.os.RemoteException;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.IWoyouService;

/**
 * Exposed to the PWA as window.Chapter99Sunmi.
 * Bound from MainActivity after the Sunmi print service connects.
 */
public final class SunmiPrinterBridge {
    private static final String TAG = "Chapter99Sunmi";

    private volatile IWoyouService printer;
    private final ICallback noopCallback = new ICallback.Stub() {
        @Override
        public void onRunResult(boolean isSuccess) {
        }

        @Override
        public void onReturnString(String result) {
        }

        @Override
        public void onRaiseException(int code, String msg) {
            Log.w(TAG, "printer exception " + code + ": " + msg);
        }
    };

    void setPrinter(IWoyouService service) {
        printer = service;
        if (service != null) {
            try {
                service.printerInit(noopCallback);
            } catch (RemoteException e) {
                Log.e(TAG, "printerInit failed", e);
            }
        }
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return printer != null;
    }

    /**
     * Print plain receipt text (reuse buildReceiptText from the web app), then feed + cut.
     */
    @JavascriptInterface
    public boolean printText(String text) {
        IWoyouService svc = printer;
        if (svc == null) {
            Log.w(TAG, "printText: printer not bound");
            return false;
        }
        try {
            svc.printText(text == null ? "" : text, noopCallback);
            svc.lineWrap(3, noopCallback);
            // GS V 0 — full cut (supported on 80mm Mini heads with cutter)
            svc.sendRAWData(new byte[]{0x1d, 0x56, 0x00}, noopCallback);
            return true;
        } catch (RemoteException e) {
            Log.e(TAG, "printText failed", e);
            return false;
        }
    }

    /**
     * Optional: print raw ESC/POS bytes as base64 (for advanced layouts).
     */
    @JavascriptInterface
    public boolean printRawBase64(String base64) {
        IWoyouService svc = printer;
        if (svc == null || base64 == null || base64.isEmpty()) return false;
        try {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            svc.sendRAWData(data, noopCallback);
            return true;
        } catch (Exception e) {
            Log.e(TAG, "printRawBase64 failed", e);
            return false;
        }
    }
}
