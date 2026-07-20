import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/chat_providers.dart';
import '../theme.dart';

/// Aubergine Noir chat list — DMs + Groups tabs.
class ChatListScreen extends ConsumerWidget {
  const ChatListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Chats'),
          bottom: const TabBar(
            indicatorColor: AppColors.coral,
            labelColor: AppColors.coral,
            unselectedLabelColor: AppColors.candleMuted,
            tabs: [Tab(text: 'Direct'), Tab(text: 'Groups')],
          ),
        ),
        body: const TabBarView(
          children: [_DirectTab(), _GroupsTab()],
        ),
      ),
    );
  }
}

class _DirectTab extends ConsumerWidget {
  const _DirectTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final threadsAsync = ref.watch(chatThreadsProvider);
    return threadsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (threads) {
        if (threads.isEmpty) {
          return const _EmptyState(text: 'No conversations yet.\nSend a message to begin.');
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(chatThreadsProvider),
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: threads.length,
            separatorBuilder: (_, __) =>
                const Divider(height: 1, color: Color(0x22FFFFFF), indent: 76),
            itemBuilder: (context, i) {
              final t = threads[i];
              return ListTile(
                onTap: () => context.push('/app/chat/${t.otherId}'),
                leading: CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.surface,
                  backgroundImage: t.avatarUrl != null ? NetworkImage(t.avatarUrl!) : null,
                  child: t.avatarUrl == null
                      ? Text((t.displayName ?? t.username ?? '?')[0].toUpperCase())
                      : null,
                ),
                title: Text(t.displayName ?? t.username ?? 'Unknown'),
                subtitle: Text(
                  t.lastMessage ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.candleMuted),
                ),
                trailing: t.lastAt != null
                    ? Text(_timeShort(t.lastAt!),
                        style: const TextStyle(color: AppColors.candleMuted, fontSize: 12))
                    : null,
              );
            },
          ),
        );
      },
    );
  }
}

class _GroupsTab extends ConsumerWidget {
  const _GroupsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(myGroupsProvider);
    return groupsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (groups) {
        if (groups.isEmpty) {
          return const _EmptyState(text: 'You are not in any groups yet.');
        }
        return ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: groups.length,
          separatorBuilder: (_, __) =>
              const Divider(height: 1, color: Color(0x22FFFFFF), indent: 76),
          itemBuilder: (context, i) {
            final g = groups[i];
            return ListTile(
              onTap: () => context.push('/app/group/${g['id']}'),
              leading: CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.surface,
                backgroundImage:
                    g['avatar_url'] != null ? NetworkImage(g['avatar_url']) : null,
                child: g['avatar_url'] == null
                    ? Text((g['name'] ?? '?')[0].toUpperCase())
                    : null,
              ),
              title: Text(g['name'] ?? 'Unnamed group'),
              subtitle: Text('Code: ${g['code'] ?? '—'}',
                  style: const TextStyle(color: AppColors.candleMuted)),
            );
          },
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String text;
  const _EmptyState({required this.text});
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.candleMuted),
        ),
      ),
    );
  }
}

String _timeShort(DateTime dt) {
  final now = DateTime.now();
  final d = now.difference(dt);
  if (d.inMinutes < 1) return 'now';
  if (d.inMinutes < 60) return '${d.inMinutes}m';
  if (d.inHours < 24) return '${d.inHours}h';
  return '${d.inDays}d';
}
