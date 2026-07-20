import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Phase 25 — App bootstrap & crash reporting shim.
///
/// Centralizes Flutter framework errors and un-caught async errors into a
/// single logger. Wired via `runZonedGuarded` in main.dart so a plugin crash
/// on release builds never nukes the process with a raw stack-trace toast.
///
/// Swap `_report` for Sentry / Crashlytics later without touching call sites.
class AppBootstrap {
  static void install() {
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      _report(
        error: details.exception,
        stack: details.stack,
        context: details.context?.toString(),
      );
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      _report(error: error, stack: stack, context: 'platform');
      return true; // swallow — we've logged it.
    };
  }

  /// Fallback UI when a widget subtree crashes at runtime.
  static Widget errorWidget(FlutterErrorDetails details) {
    return Material(
      color: const Color(0xFF120714),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.pets, color: Color(0xFFF77268), size: 48),
              const SizedBox(height: 12),
              const Text(
                'A whisper failed.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                details.exceptionAsString(),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static void _report({
    required Object error,
    StackTrace? stack,
    String? context,
  }) {
    if (kDebugMode) {
      debugPrint('🚨 [$context] $error\n$stack');
    }
    // TODO: forward to Sentry / Crashlytics when SDK is wired.
  }
}
