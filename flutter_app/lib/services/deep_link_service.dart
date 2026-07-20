import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:go_router/go_router.dart';

/// Phase 23 — Deep-link router for push notification taps.
///
/// Bridges three entry points:
///   1. Cold start: user taps a ringing notification while app is terminated.
///   2. Warm start: app is backgrounded and user taps the notification.
///   3. Foreground: notification tapped inside a live session (local plugin).
///
/// Every path resolves to a GoRouter navigation.
class DeepLinkService {
  DeepLinkService._();
  static final instance = DeepLinkService._();

  GoRouter? _router;
  RemoteMessage? _pendingCold;

  void bind(GoRouter router) {
    _router = router;
    // Flush any deep-link captured before the router was ready.
    final pending = _pendingCold;
    if (pending != null) {
      _pendingCold = null;
      _handleRemote(pending);
    }
  }

  /// Called from PushService.init(). Wires taps from every source.
  Future<void> attach({
    required FlutterLocalNotificationsPlugin fln,
  }) async {
    // Cold-start tap.
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) {
      _handleRemote(initial);
    }

    // Warm-start / background taps.
    FirebaseMessaging.onMessageOpenedApp.listen(_handleRemote);

    // Local-notification taps while foreground (call banner, message banner).
    await fln.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload == null) return;
        _handlePayload(payload);
      },
    );
  }

  void _handleRemote(RemoteMessage msg) {
    final data = msg.data;
    if (data['type'] == 'call' && data['call_id'] is String) {
      _openCall(
        callId: data['call_id']!,
        video: data['mode'] == 'video',
      );
    } else if (data['type'] == 'message') {
      final threadId = data['thread_id'];
      final groupId = data['group_id'];
      if (groupId is String) {
        _push('/app/group/$groupId');
      } else if (threadId is String) {
        _push('/app/chat/$threadId');
      } else {
        _push('/app/chats');
      }
    }
  }

  void _handlePayload(String payload) {
    // "call:<uuid>" or "call:<uuid>:video"
    if (payload.startsWith('call:')) {
      final parts = payload.split(':');
      if (parts.length >= 2) {
        _openCall(callId: parts[1], video: parts.contains('video'));
      }
    } else if (payload.startsWith('dm:')) {
      _push('/app/chat/${payload.substring(3)}');
    } else if (payload.startsWith('group:')) {
      _push('/app/group/${payload.substring(6)}');
    }
  }

  void _openCall({required String callId, required bool video}) {
    _push('/app/call/$callId/live?video=${video ? 1 : 0}');
  }

  void _push(String location) {
    final router = _router;
    if (router == null) return;
    // Slight defer so navigation doesn't collide with app boot frame.
    Future.microtask(() => router.go(location));
  }
}
