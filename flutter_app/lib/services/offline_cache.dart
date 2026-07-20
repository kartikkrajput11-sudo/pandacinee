import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

/// Phase 24 — Lightweight offline cache for chat threads.
///
/// Stores the most recent N messages per DM / group so the chat list and
/// thread screens can paint instantly on cold-start, before the Supabase
/// subscription hydrates. Uses `shared_preferences` (already a dependency)
/// so no extra native plugins are pulled in.
class OfflineCache {
  OfflineCache._();
  static final instance = OfflineCache._();

  static const _maxMessagesPerThread = 60;

  Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  String _dmKey(String peerId) => 'cache.dm.$peerId';
  String _groupKey(String groupId) => 'cache.group.$groupId';

  /// Merge newest messages into the cached slice, trimming to N.
  Future<void> saveDmMessages(
    String peerId,
    List<Map<String, dynamic>> messages,
  ) => _save(_dmKey(peerId), messages);

  Future<void> saveGroupMessages(
    String groupId,
    List<Map<String, dynamic>> messages,
  ) => _save(_groupKey(groupId), messages);

  Future<List<Map<String, dynamic>>> loadDm(String peerId) =>
      _load(_dmKey(peerId));

  Future<List<Map<String, dynamic>>> loadGroup(String groupId) =>
      _load(_groupKey(groupId));

  Future<void> _save(String key, List<Map<String, dynamic>> messages) async {
    final prefs = await _prefs;
    // Keep the newest slice sorted by created_at desc.
    final sorted = [...messages]..sort((a, b) {
      final ax = a['created_at']?.toString() ?? '';
      final bx = b['created_at']?.toString() ?? '';
      return bx.compareTo(ax);
    });
    final slice = sorted.take(_maxMessagesPerThread).toList();
    await prefs.setString(key, jsonEncode(slice));
  }

  Future<List<Map<String, dynamic>>> _load(String key) async {
    final prefs = await _prefs;
    final raw = prefs.getString(key);
    if (raw == null) return const [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list.cast<Map<String, dynamic>>();
    } catch (_) {
      return const [];
    }
  }

  Future<void> clearAll() async {
    final prefs = await _prefs;
    final keys = prefs.getKeys().where((k) => k.startsWith('cache.')).toList();
    for (final k in keys) {
      await prefs.remove(k);
    }
  }
}
