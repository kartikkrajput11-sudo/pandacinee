import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';

/// One DM thread as seen in the chat list.
class ChatThread {
  final String otherId;
  final String? username;
  final String? displayName;
  final String? avatarUrl;
  final String? lastMessage;
  final DateTime? lastAt;
  final int unread;

  ChatThread({
    required this.otherId,
    this.username,
    this.displayName,
    this.avatarUrl,
    this.lastMessage,
    this.lastAt,
    this.unread = 0,
  });
}

/// Loads all DM threads for the current user.
final chatThreadsProvider = FutureProvider.autoDispose<List<ChatThread>>((ref) async {
  final supa = ref.watch(supabaseProvider);
  final me = ref.watch(currentUserProvider);
  if (me == null) return [];

  // Pull recent messages involving me.
  final rows = await supa
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, read_at')
      .or('sender_id.eq.${me.id},recipient_id.eq.${me.id}')
      .order('created_at', ascending: false)
      .limit(400);

  final Map<String, ChatThread> byOther = {};
  for (final r in rows as List) {
    final sender = r['sender_id'] as String;
    final recip = r['recipient_id'] as String?;
    if (recip == null) continue;
    final other = sender == me.id ? recip : sender;
    if (byOther.containsKey(other)) continue;

    final createdAt = DateTime.tryParse(r['created_at'] ?? '');
    byOther[other] = ChatThread(
      otherId: other,
      lastMessage: r['content'] as String?,
      lastAt: createdAt,
    );
  }

  if (byOther.isEmpty) return [];

  final profiles = await supa
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .inFilter('id', byOther.keys.toList());

  for (final p in profiles as List) {
    final id = p['id'] as String;
    final existing = byOther[id]!;
    byOther[id] = ChatThread(
      otherId: id,
      username: p['username'] as String?,
      displayName: p['display_name'] as String?,
      avatarUrl: p['avatar_url'] as String?,
      lastMessage: existing.lastMessage,
      lastAt: existing.lastAt,
      unread: existing.unread,
    );
  }

  final list = byOther.values.toList()
    ..sort((a, b) => (b.lastAt ?? DateTime(0)).compareTo(a.lastAt ?? DateTime(0)));
  return list;
});

/// Streams messages between me and [otherId] in ascending order.
final dmMessagesProvider =
    StreamProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, otherId) {
  final supa = ref.watch(supabaseProvider);
  final me = ref.watch(currentUserProvider);
  if (me == null) return const Stream.empty();

  // Realtime stream of the messages table; we filter client-side to the pair.
  return supa
      .from('messages')
      .stream(primaryKey: ['id'])
      .order('created_at')
      .map((rows) {
        return rows.where((r) {
          final s = r['sender_id'];
          final rc = r['recipient_id'];
          return (s == me.id && rc == otherId) || (s == otherId && rc == me.id);
        }).toList();
      });
});

/// Sends a text DM.
Future<void> sendDm(SupabaseClient supa, String meId, String toId, String text) async {
  final t = text.trim();
  if (t.isEmpty) return;
  await supa.from('messages').insert({
    'sender_id': meId,
    'recipient_id': toId,
    'content': t,
  });
}

/// Groups the current user is a member of.
final myGroupsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final supa = ref.watch(supabaseProvider);
  final me = ref.watch(currentUserProvider);
  if (me == null) return [];
  final rows = await supa
      .from('group_members')
      .select('group_id, groups(id, name, avatar_url, code)')
      .eq('user_id', me.id);
  return (rows as List)
      .map((r) => (r['groups'] as Map).cast<String, dynamic>())
      .toList();
});

/// Streams messages in a group.
final groupMessagesProvider =
    StreamProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, groupId) {
  final supa = ref.watch(supabaseProvider);
  return supa
      .from('group_messages')
      .stream(primaryKey: ['id'])
      .eq('group_id', groupId)
      .order('created_at')
      .map((rows) => rows);
});

Future<void> sendGroupMessage(
    SupabaseClient supa, String groupId, String meId, String text) async {
  final t = text.trim();
  if (t.isEmpty) return;
  await supa.from('group_messages').insert({
    'group_id': groupId,
    'sender_id': meId,
    'content': t,
  });
}
