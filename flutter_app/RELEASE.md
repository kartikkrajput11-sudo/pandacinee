# Phase 21 — Release / APK build

## 1. Install Flutter deps

```bash
cd flutter_app
flutter pub get
```

## 2. Deploy the LiveKit token edge function

The Dart call room calls `supabase.functions.invoke('livekit_token', ...)`.
The function must mint a LiveKit access token server-side using
`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`, then return
`{ "url": "<LIVEKIT_WS_URL>", "token": "<jwt>" }`.

The web app already has an equivalent endpoint; reuse it or expose it as a
Supabase edge function named `livekit_token`.

## 3. Sign the release build

Create `flutter_app/android/key.properties` (never commit):

```
storePassword=<pw>
keyPassword=<pw>
keyAlias=pandacine
storeFile=../release.keystore
```

Generate the keystore once:

```bash
keytool -genkey -v -keystore flutter_app/android/release.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 -alias pandacine
```

## 4. Build

```bash
# APK (side-load / share)
flutter build apk --release

# App Bundle (Play Store)
flutter build appbundle --release
```

Artifacts land in `build/app/outputs/flutter-apk/app-release.apk` and
`build/app/outputs/bundle/release/app-release.aab`.

## 5. Permissions map

| Permission                | Used by                          |
| ------------------------- | -------------------------------- |
| `RECORD_AUDIO`            | Voice calls, voice notes         |
| `CAMERA`                  | Video calls                      |
| `MODIFY_AUDIO_SETTINGS`   | LiveKit audio routing            |
| `BLUETOOTH_CONNECT`       | BT headset routing               |
| `POST_NOTIFICATIONS`      | Incoming call / message alerts   |
| `FOREGROUND_SERVICE_*`    | Keep call alive when backgrounded|
