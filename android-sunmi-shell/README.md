# Chapter99 Sunmi Mini staff shell

Thin Android WebView kiosk that loads the live staff PWA and exposes
`window.Chapter99Sunmi` so receipts print on the built-in thermal head.

## What it does

- Loads `https://chapter99thaimass-v20.vercel.app/chapter99/staff` (overrideable)
- Binds Sunmi print service `woyou.aidlservice.jiuiv5`
- JS bridge: `Chapter99Sunmi.isAvailable()` / `printText(text)` / `printRawBase64(b64)`

## Build (Android Studio)

1. Open folder `android-sunmi-shell` in Android Studio (Ladybug / Koala or newer).
2. Let Gradle sync (JDK 17).
3. **Build → Build Bundle(s) / APK(s) → Build APK(s)** (debug is fine for sideload).
4. APK path: `app/build/outputs/apk/debug/app-debug.apk`

Or CLI (from this folder, with Android SDK installed):

```bash
./gradlew :app:assembleDebug
```

Windows:

```bat
gradlew.bat :app:assembleDebug
```

## Install / sideload on Sunmi Mini

1. On the Mini: enable **Developer options** → **USB debugging** (and allow install from USB/unknown sources if prompted).
2. Connect USB (or copy APK to device storage).
3. Sideload:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n au.com.chapter99.sunmishell/.MainActivity
```

Shop-specific staff URL:

```bash
adb shell am start -n au.com.chapter99.sunmishell/.MainActivity \
  --es staff_url "https://chapter99thaimass-v20.vercel.app/chapter99/staff?shop=mira"
```

4. Optionally pin the app as the home/kiosk app in Sunmi settings.

## End-to-end test

1. Open the shell app on the Mini (not Chrome).
2. Confirm PIN screen loads; log in (e.g. cashier `4444` / owner `9999`).
3. Open POS → add a service → Charge → complete payment.
4. Expect **auto-print** on the built-in printer.
5. On success screen, tap **🖨 Print Receipt** to reprint.

In Chrome DevTools remote debugging (`chrome://inspect`), `window.Chapter99Sunmi.isAvailable()` should be `true` inside the WebView.

## Non-Sunmi devices

Bridge is absent → web app falls back to Web USB then `window.print()` (unchanged).
