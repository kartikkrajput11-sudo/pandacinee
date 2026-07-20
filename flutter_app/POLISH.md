# Phase 25 — Production polish checklist

- [ ] **App icon** — replace `android/app/src/main/res/mipmap-*/ic_launcher.png`
      with the panda glyph (use `flutter_launcher_icons` or Android Studio's
      "Image Asset" wizard).
- [ ] **Splash** — configure `android/app/src/main/res/drawable/launch_background.xml`
      to render the coral bloom over aubergine (`#120714`).
- [ ] **Signing** — see `RELEASE.md` for keystore + `key.properties` setup.
- [ ] **ProGuard** — release build uses R8 by default; the `livekit_client`
      package ships with the required rules.
- [ ] **Crash reporting** — plug Sentry or Crashlytics into
      `services/app_bootstrap.dart::_report`. All framework + async errors
      already funnel through it.
- [ ] **Analytics** — instrument `DeepLinkService._push` for notification-tap
      attribution; add screen-view logging via `GoRouter.observers`.
- [ ] **Google Play** — target SDK 34, provide a 512×512 icon, feature
      graphic, privacy policy URL (already live at `https://pandacine.com/privacy`).
- [ ] **Permissions rationale** — Play Console → Data safety needs entries for
      microphone, camera, notifications, and push token collection.
