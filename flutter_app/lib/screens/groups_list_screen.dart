import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Groups list — my chat groups, plus join-by-code and create.
final myGroupsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final supa = ref.watch(supabaseProvider);
  final me = ref.watch(currentUserProvider);
  if (me == null) return const [];
  // is_group_member policy on chat_groups gates rows to my own memberships.
  final rows = await supa
      .from('chat_groups')
      .select('id, name, avatar_url, invite_code, theme, updated_at')
      .order('updated_at', ascending: false);
  return List<Map<String, dynamic>>.from(rows);
});

class GroupsListScreen extends ConsumerWidget {
  const GroupsListScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(myGroupsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Groups'),
        actions: [
          IconButton(icon: const Icon(Icons.add), onPressed: () => _create(context, ref)),
        ],
      ),
      body: SafeArea(
        child: groups.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.petal)),
          error: (e, _) => Center(child: Text('$e')),
          data: (list) => ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              Text('Chapter · Rooms', style: eyebrow()),
              const SizedBox(height: 6),
              Text('Group chapters', style: serifItalic(size: 28)),
              const SizedBox(height: 16),
              _JoinByCode(),
              const SizedBox(height: 20),
              if (list.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('No groups yet. Create one or join with a code.',
                      style: TextStyle(color: AppColors.candleMuted)),
                )
              else
                for (final g in list) _tile(context, g, ref),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(BuildContext context, Map<String, dynamic> g, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => context.push('/app/group/${g['id']}'),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(children: [
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(
                  color: AppColors.wine, shape: BoxShape.circle,
                  border: Border.all(color: AppColors.coral.withOpacity(0.4)),
                ),
                alignment: Alignment.center,
                child: Text(
                  ((g['name'] ?? '?') as String).characters.first.toUpperCase(),
                  style: serifItalic(size: 20, color: AppColors.coral),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text((g['name'] ?? 'Untitled') as String, style: serifItalic(size: 18)),
                if (g['invite_code'] != null)
                  Text('Code · ${g['invite_code']}',
                      style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
              ])),
              IconButton(
                icon: const Icon(Icons.sports_esports, color: AppColors.coral),
                onPressed: () => context.push('/app/group/${g['id']}/matches'),
                tooltip: 'Matches',
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('New group', style: serifItalic(size: 22)),
        content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Group name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Create')),
        ],
      ),
    );
    if (ok != true || ctrl.text.trim().isEmpty) return;
    final me = ref.read(currentUserProvider);
    final supa = ref.read(supabaseProvider);
    try {
      final g = await supa.from('chat_groups').insert({
        'name': ctrl.text.trim(), 'created_by': me?.id,
      }).select().single();
      await supa.from('chat_group_members').insert({
        'group_id': g['id'], 'user_id': me?.id, 'role': 'admin',
      });
      ref.invalidate(myGroupsProvider);
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class _JoinByCode extends ConsumerStatefulWidget {
  @override
  ConsumerState<_JoinByCode> createState() => _JoinByCodeState();
}

class _JoinByCodeState extends ConsumerState<_JoinByCode> {
  final _ctrl = TextEditingController();
  bool _busy = false;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.coral.withOpacity(0.35)),
      ),
      child: Row(children: [
        Expanded(child: TextField(
          controller: _ctrl,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            labelText: 'Join by code', hintText: 'ABCD2345', border: InputBorder.none,
          ),
        )),
        FilledButton(
          onPressed: _busy ? null : _join,
          child: Text(_busy ? '…' : 'Join'),
        ),
      ]),
    );
  }

  Future<void> _join() async {
    if (_ctrl.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref.read(supabaseProvider).rpc('join_group_with_code', params: {'_code': _ctrl.text.trim()});
      ref.invalidate(myGroupsProvider);
      _ctrl.clear();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
