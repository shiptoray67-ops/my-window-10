# Win10 Simulator (Web + Android APK)

A client-side Windows 10 desktop simulator built with React, TypeScript, Tailwind CSS, and Capacitor for Android.

## Key Features
- Full Windows 10 lifecycle: boot screen, lock screen, login screen, power menu, Start menu, taskbar, Action Center, and indexed virtual file system (`IndexedDB` + `localStorage`).
- Full window manager: 8-direction resize (4 sides + 4 corners), title bar drag & snap (left, right, top maximize, 4 corners with translucent preview), title bar context menu, pinch-to-resize on touch, and persistent window bounds.
- Native **Microsoft Edge** window powered by a custom `EmbeddedWebView` Capacitor plugin with multi-tab support, desktop mode toggle, downloads, find-in-page, bookmarks, history, InPrivate tabs, and full compatibility with Facebook, YouTube, Google, WhatsApp Web, etc.
- **Mouse Mode**: Always-on-top native Android cursor rendering above all WebViews and menus, full-screen invisible touchpad gestures, native hover/click/double-click/long-press/drag/scroll/pinch injection into web pages.
- **In-Place Android APK Updates**: GitHub Actions signs builds consistently and publishes `Win10Simulator.apk` under the `latest` release, with an in-app updater in **Settings → Update & Security**.

## Important Note on In-Place Android Updates

> **One-Time Uninstall Notice:**  
> If you previously installed an older APK built before persistent keystore signing was added, **you must uninstall that old APK one last time** before installing the new persistently signed `Win10Simulator.apk` (because the older APK used an auto-generated random debug keystore).  
>  
> **After that first install**, every future update built by GitHub Actions or downloaded via **Settings → Update & Security → Check for updates** uses the exact same signing key (`android/keystore/app.keystore`) and incrementing `versionCode`, so Android installs updates right over the existing app without uninstalling and preserves all your saved settings, files, bookmarks, and logins.

## Local Development & Android Sync

```bash
npm install --legacy-peer-deps
npm run dev
npm run build
npx cap sync android
```
