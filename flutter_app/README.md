# PANDACINE — Flutter (Phase 1)

Native Android + iOS port of the PANDACINE web app. Backend stays on Lovable Cloud (Supabase) — this app is a pure client.

## Setup

1. Install Flutter 3.24+ and Android Studio (with Android SDK 34).
2. Create a fresh Flutter project, then overlay this folder:
   ```bash
   flutter create pandacine --org com.pandacine --platforms=android,ios
   cd pandacine
   # copy every file from this flutter_app/ folder into the new project, overwriting
   flutter pub get
   flutter run
   ```
3. First run will use the Lovable Cloud URL + anon key already baked into `lib/env.dart` (safe: publishable key).

## What Phase 1 gives you
- Aubergine Noir theme (velvet / petal / candle / coral tokens) matching the web.
- `go_router` shell with `/auth` and `/app` (authenticated guard).
- Supabase auth screen (email/password + Google).
- Home screen with partner presence hook.
- Kotlin `MainActivity` + notification channel scaffold for Phase 6 push notifications.

## Coming in later phases
Chat • Games • Movies (WebView + sync) • LiveKit calls • Admin.
