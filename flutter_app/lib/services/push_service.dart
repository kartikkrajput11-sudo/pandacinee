import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Phase 22 — Push notifications + background call ringing.
///
/// Wires Firebase Cloud Messaging to Supabase so that:
///   • Every device stores its FCM token in `device_tokens` (keyed by user).
///   • Incoming pushes with `data.type == "call"` raise a full-screen
///     high-priority "ringing" local notification even when the app is
///     backgrounded or killed.
///   • Standard message pushes render as a normal heads-up notification.
class PushService {
  PushService._();
  static final instance = PushService._();

  final _fln = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  static const _ringChannel = AndroidNotificationChannel(
    'pandacine_calls',
    'Incoming calls',
    description: 'Ringing notifications for PANDACINE voice / video calls',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  static const _msgChannel = AndroidNotificationChannel(
    'pandacine_messages',
    'Messages & alerts',
    description: 'Chat, affections, and partner activity',
    importance: Importance.high,
  );

  Future<void> init() async {
    if (_ready) return;
    await Firebase.initializeApp();

    // Local notifications (used to draw ringing UI from FCM data payloads)
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _fln.initialize(
      const InitializationSettings(android: androidInit),
    );

    final android =
        _fln.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_ringChannel);
    await android?.createNotificationChannel(_msgChannel);
    await android?.requestNotificationsPermission();

    // FCM permissions
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Register the current device with Supabase
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) await _saveToken(token);
    FirebaseMessaging.instance.onTokenRefresh.listen(_saveToken);

    // Foreground handler
    FirebaseMessaging.onMessage.listen(_handleForeground);

    // Background handler (must be top-level; see main.dart entry)
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

    _ready = true;
  }

  Future<void> _saveToken(String token) async {
    final client = Supabase.instance.client;
    final userId = client.auth.currentUser?.id;
    if (userId == null) return;
    try {
      await client.from('device_tokens').upsert({
        'user_id': userId,
        'token': token,
        'platform': 'android',
        'updated_at': DateTime.now().toIso8601String(),
      }, onConflict: 'token');
    } catch (_) {
      // Silent — table may not exist yet in dev; push still works.
    }
  }

  void _handleForeground(RemoteMessage msg) {
    final data = msg.data;
    if (data['type'] == 'call') {
      _showRingingNotification(
        title: data['caller_name'] ?? 'Incoming call',
        body: data['mode'] == 'video' ? 'Video call' : 'Voice call',
        callId: data['call_id'] ?? '',
      );
    } else {
      _showMessageNotification(
        title: msg.notification?.title ?? data['title'] ?? 'PANDACINE',
        body: msg.notification?.body ?? data['body'] ?? '',
      );
    }
  }

  Future<void> _showRingingNotification({
    required String title,
    required String body,
    required String callId,
  }) async {
    await _fln.show(
      callId.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _ringChannel.id,
          _ringChannel.name,
          channelDescription: _ringChannel.description,
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.call,
          fullScreenIntent: true,
          ongoing: true,
          autoCancel: false,
          visibility: NotificationVisibility.public,
          ticker: 'Incoming call',
        ),
      ),
      payload: 'call:$callId',
    );
  }

  Future<void> _showMessageNotification({
    required String title,
    required String body,
  }) async {
    await _fln.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _msgChannel.id,
          _msgChannel.name,
          channelDescription: _msgChannel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
    );
  }
}

/// Top-level entry required by FCM for background delivery.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage msg) async {
  await Firebase.initializeApp();
  final fln = FlutterLocalNotificationsPlugin();
  const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  await fln.initialize(const InitializationSettings(android: androidInit));

  final data = msg.data;
  if (data['type'] == 'call') {
    await fln.show(
      (data['call_id'] ?? 'call').hashCode,
      data['caller_name'] ?? 'Incoming call',
      data['mode'] == 'video' ? 'Video call' : 'Voice call',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'pandacine_calls',
          'Incoming calls',
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.call,
          fullScreenIntent: true,
          ongoing: true,
          autoCancel: false,
          visibility: NotificationVisibility.public,
        ),
      ),
    );
  }
}
