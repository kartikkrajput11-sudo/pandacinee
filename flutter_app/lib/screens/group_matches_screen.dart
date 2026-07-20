import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Group Matches — lobby list for a given group.
class GroupMatchesScreen extends ConsumerStatefulWidget {
  final String groupId;
  const GroupMatchesScreen({super.key, required this.groupId});
  @override
  ConsumerState<GroupMatchesScreen> createState() => _GroupMatchesScreenState();
}

class _GroupMatchesScreenState extends ConsumerState<GroupMatchesScreen> {
  List<Map<String, dynamic>> _matches = [];
  bool _loading = true;
  static const _games = [
    ('rps', 'Rock · Paper · Scissors', 4),
    ('chess', 'Chess', 2),
    ('ludo', 'Ludo', 4),
    ('uno', 'Uno', 4),
    ('pool', '8-Ball Pool', 2),
    ('hideseek', 'Hide & Seek', 2),
    ('knowme', 'Know Me?', 4),
  ];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final rows = await ref.read(supabaseProvider)
        .from('group_matches')
        .select('id, game, status, max_players, created_by, created_at')
        .eq('group_id', widget.groupId)
        .neq('status', 'ended')
        .order('created_at', ascending: false);
    if (mounted) setState(() {
      _matches = List<Map<String, dynamic>>.from(rows);
      _loading = false;
    });
  }

  Future<void> _propose() async {
    final result = await showModalBottomSheet<(String, int)>(
      context: context,
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      builder: (_) => ListView(
        shrinkWrap: true,
        children: [
          for (final g in _games)
            ListTile(
              title: Text(g.$2),
              subtitle: Text('${g.$3} players', style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
              onTap: () => Navigator.pop(context, (g.$1, g.$3)),
            ),
        ],
      ),
    );
    if (result == null) return;
    try {
      await ref.read(supabaseProvider).rpc('create_group_match', params: {
        '_group_id': widget.groupId,
        '_game': result.$1,
        '_max_players': result.$2,
      });
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _joinMatch(Map<String, dynamic> m) async {
    try {
      await ref.read(supabaseProvider).rpc('join_group_match', params: {'_match_id': m['id']});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _start(Map<String, dynamic> m) async {
    try {
      await ref.read(supabaseProvider).rpc('start_group_match', params: {'_match_id': m['id']});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Group matches')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _propose,
        backgroundColor: AppColors.coral,
        icon: const Icon(Icons.add),
        label: const Text('Propose'),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.petal))
            : _matches.isEmpty
                ? Center(child: Padding(
                    padding: const EdgeInsets.all(30),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Text('No matches yet', style: serifItalic(size: 26)),
                      const SizedBox(height: 6),
                      const Text('Propose a game to open a lobby.',
                          style: TextStyle(color: AppColors.candleMuted)),
                    ]),
                  ))
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 96),
                    itemCount: _matches.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final m = _matches[i];
                      final isHost = m['created_by'] == me?.id;
                      final live = m['status'] == 'live';
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: live ? AppColors.coral : AppColors.border),
                        ),
                        child: Row(children: [
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${m['game']} · ${m['max_players']} seats', style: serifItalic(size: 18)),
                            Text('Status · ${m['status']}',
                                style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
                          ])),
                          if (m['status'] == 'lobby') ...[
                            TextButton(onPressed: () => _joinMatch(m), child: const Text('Seat')),
                            if (isHost)
                              FilledButton(onPressed: () => _start(m), child: const Text('Start')),
                          ] else if (live)
                            FilledButton(onPressed: () => _joinMatch(m), child: const Text('Enter')),
                        ]),
                      );
                    },
                  ),
      ),
    );
  }
}
