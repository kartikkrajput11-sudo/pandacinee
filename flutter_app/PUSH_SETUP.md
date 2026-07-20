# Phase 22 — Push notifications & background call ringing

PANDACINE Flutter uses **Firebase Cloud Messaging (FCM)** to deliver:

- 🔔 Standard heads-up notifications for chat, affections, and partner activity.
- 📞 Full-screen **ringing** notifications for incoming voice/video calls,
  even when the app is backgrounded or killed.

## 1. Firebase project

1. Create (or reuse) a Firebase project.
2. Add an **Android app** with package name `com.pandacine`.
3. Download `google-services.json` and place it at
   `flutter_app/android/app/google-services.json`.
4. Enable **Cloud Messaging API (V1)** in Google Cloud Console.

## 2. Gradle wiring

Add to `flutter_app/android/build.gradle` (project-level):

```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.2'
  }
}
```

Add to `flutter_app/android/app/build.gradle` (bottom):

```gradle
apply plugin: 'com.google.gms.google-services'
```

## 3. Server-side dispatcher secrets

The `/api/public/push-dispatch` route fans messages out via FCM HTTP v1.
Add these secrets to the Lovable backend:

| Secret | Where to find it |
|---|---|
| `PUSH_SECRET` | Any strong random string (32+ chars). Must match the caller. |
| `FCM_PROJECT_ID` | Firebase Console → Project settings → General → **Project ID**. |
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase Console → Project settings → Service accounts → **Generate new private key** → paste the full JSON. |

## 4. Call payload contract

Server sends a data-only push so the app draws the ringing UI itself:

```json
{
  "user_id": "<callee-uuid>",
  "data": {
    "type": "call",
    "call_id": "<uuid>",
    "mode": "voice",
    "caller_name": "Panda"
  }
}
```

## 5. Message payload contract

```json
{
  "user_id": "<recipient-uuid>",
  "title": "New message",
  "body": "Panda: I miss you 🐼",
  "data": { "type": "message", "thread_id": "<uuid>" }
}
```

That's it — install `google-services.json`, add the three secrets, and
every signed-in device auto-registers on next launch.
