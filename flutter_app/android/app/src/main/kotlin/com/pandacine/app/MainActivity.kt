package com.pandacine.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * PANDACINE Android host.
 *
 * Registers the "pandacine_default" notification channel on boot and exposes a
 * MethodChannel bridge so Dart can trigger native-only work (e.g. haptics,
 * setting the lock-screen call activity in Phase 5).
 */
class MainActivity : FlutterActivity() {

    private val bridge = "com.pandacine.app/native"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createDefaultChannel()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, bridge)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "ping" -> result.success("pong")
                    "openAppSettings" -> {
                        // Phase 6 hook: launch system notification settings.
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun createDefaultChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            "pandacine_default",
            "PANDACINE",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Messages, calls, and rituals from your panda."
            enableLights(true)
            enableVibration(true)
        }
        mgr.createNotificationChannel(channel)
    }
}
