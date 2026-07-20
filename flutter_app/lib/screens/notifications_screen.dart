import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Live "unread DMs from partner + friends" count. Reads recent messages and
/// filters ones where I'm the receiver and haven't marked them seen locally.
final unreadCountProvider = StreamProvider<int>((ref) async* {
  final supa = ref.watch(supabaseProvider);
  final me = ref.watch(currentUserProvider);
  if (me == null) { yield 0; return; }

  Future<int> load() async {
    final rows = await supa
        .from('messages')
        .select('id, sender_id, read_at')
        .eq('receiver_id', me.id)
        .isFilter('read_at', null)
        .isFilter('group_id', null)
        .order('created_at', ascending: false)
        .limit(50);
    return (rows as List).length;
  }

  yield await load();
  final ch = supa
      .channel('unread:${me.id}')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public', table: 'messages',
        filter: PostgresChangeFilter(
          type: PostgresChangeFilterType.eq, column: 'receiver_id', value: me.id,
        ),
        callback: (_) async { /* fall-through: caller reloads */ },
      )
      .subscribe();
  ref.onDispose(() => supa.removeChannel(ch));

  await for (final _ in Stream.periodic(const Duration(seconds: 8))) {
    yield await load();
  }
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final supa = ref.watch(supabaseProvider);
    final me = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: SafeArea(
        child: me == null
            ? const SizedBox.shrink()
            : FutureBuilder<List<dynamic>>(
                future: supa
                    .from('messages')
                    .select('id, sender_id, receiver_id, group_id, content, created_at, read_at')
                    .eq('receiver_id', me.id)
                    .order('created_at', ascending: false)
                    .limit(40),
                builder: (context, snap) {
                  if (!snap.hasData) {
                    return const Center(
                        child: CircularProgressIndicator(color: AppColors.petal));
                  }
                  final items = snap.data!;
                  if (items.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(40),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Quiet room', style: serifItalic(size: 32)),
                            const SizedBox(height: 8),
                            const Text('No new notes yet.',
                                style: TextStyle(color: AppColors.candleMuted)),
                          ],
                        ),
                      ),
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final r = items[i] as Map<String, dynamic>;
                      final unread = r['read_at'] == null;
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: unread ? AppColors.coral.withOpacity(0.5) : AppColors.border,
                          ),
                        ),
                        child: Row(children: [
                          Container(
                            width: 10, height: 10,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: unread ? AppColors.coral : AppColors.candleMuted,
                            ),
                          ).animate(onPlay: (c) => unread ? c.repeat(reverse: true) : null)
                              .fadeIn(duration: 500.ms).fadeOut(duration: 500.ms),
                          const SizedBox(width: 12),
                          Expanded(child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                r['group_id'] != null ? 'Group message' : 'Direct message',
                                style: eyebrow(),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                (r['content'] ?? '') as String,
                                style: serifItalic(size: 16),
                                maxLines: 2, overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          )),
                        ]),
                      );
                    },
                  );
                },
              ),
      ),
    );
  }
}

class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider).valueOrNull ?? 0;
    return Stack(clipBehavior: Clip.none, children: [
      IconButton(
        icon: const Icon(Icons.notifications_outlined, color: AppColors.candle),
        onPressed: () => context.push('/app/notifications'),
      ),
      if (unread > 0)
        Positioned(
          top: 6, right: 6,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: AppColors.coral,
              borderRadius: BorderRadius.circular(999),
            ),
            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
            alignment: Alignment.center,
            child: Text(
              unread > 9 ? '9+' : '$unread',
              style: const TextStyle(
                  color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ),
        ),
    ]);
  }
}
