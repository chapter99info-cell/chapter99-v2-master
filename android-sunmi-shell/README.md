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

## Install on Sunmi Mini (recommended — no computer)

Use the published APK from the device browser. Full steps:
`public/downloads/INSTALL-SUNMI.txt`

**Download:** https://chapter99thaimass-v20.vercel.app/downloads/chapter99-staff.apk

1. Open that link in the Mini’s browser → download the APK.
2. Open Downloads → tap the file → allow install from unknown sources if asked → Install → Open.
3. First launch: type the **shop code** once (`mira`, `princess`, …). The app saves `?shop=<slug>` itself.

Rebuild/publish APK: GitHub Actions → **Build Sunmi Staff APK** (workflow_dispatch).

### Advanced: adb / USB (developers only)

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## End-to-end test

1. Open the shell app on the Mini (not Chrome).
2. Confirm PIN screen loads; log in (e.g. cashier `4444` / owner `9999`).
3. Open POS → add a service → Charge → complete payment.
4. Expect **auto-print** on the built-in printer.
5. On success screen, tap **🖨 Print Receipt** to reprint.

In Chrome DevTools remote debugging (`chrome://inspect`), `window.Chapter99Sunmi.isAvailable()` should be `true` inside the WebView.

## Non-Sunmi devices

Bridge is absent → web app falls back to Web USB then `window.print()` (unchanged).
