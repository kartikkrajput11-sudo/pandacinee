# Flutter / Play-Core (deferred components) — safe defaults.
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }

# LiveKit / WebRTC native bridge.
-keep class org.webrtc.** { *; }
-keep class livekit.** { *; }
-keep class io.livekit.** { *; }
-dontwarn org.webrtc.**
-dontwarn livekit.**

# Supabase / OkHttp / Kotlin coroutines.
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn kotlinx.coroutines.**
