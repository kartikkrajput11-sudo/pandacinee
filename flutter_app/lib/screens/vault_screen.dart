import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// The Vault — Love Letters, Time Capsules, Memory Jar.
class VaultScreen extends ConsumerStatefulWidget {
  const VaultScreen({super.key});
  @override
  ConsumerState<VaultScreen> createState() => _VaultScreenState();
}

class _VaultScreenState extends ConsumerState<VaultScreen> with SingleTickerProviderStateMixin {
  late TabController _tabs;
  @override
  void initState() { super.initState(); _tabs = TabController(length: 3, vsync: this); }
  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vault'),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppColors.coral,
          labelColor: AppColors.candle,
          unselectedLabelColor: AppColors.candleMuted,
          tabs: const [Tab(text: 'Letters'), Tab(text: 'Capsules'), Tab(text: 'Memory Jar')],
        ),
      ),
      body: TabBarView(controller: _tabs, children: const [
        _LoveLettersTab(), _TimeCapsulesTab(), _MemoryJarTab(),
      ]),
    );
  }
}

// ---------------- Love Letters ----------------

class _LoveLettersTab extends ConsumerStatefulWidget {
  const _LoveLettersTab();
  @override
  ConsumerState<_LoveLettersTab> createState() => _LoveLettersTabState();
}

class _LoveLettersTabState extends ConsumerState<_LoveLettersTab> {
  List<Map<String, dynamic>> _letters = [];
  bool _loading = true;
  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final rows = await ref.read(supabaseProvider)
        .from('love_letters')
        .select('id, sender_id, recipient_id, title, body, unlock_at, opened_at, seal_motto, created_at')
        .or('sender_id.eq.${me.id},recipient_id.eq.${me.id}')
        .order('created_at', ascending: false)
        .limit(50);
    if (mounted) setState(() { _letters = List<Map<String, dynamic>>.from(rows); _loading = false; });
  }

  Future<void> _compose() async {
    final title = TextEditingController();
    final body = TextEditingController();
    DateTime unlock = DateTime.now().add(const Duration(days: 1));
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('New letter', style: serifItalic(size: 22)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 10),
          TextField(controller: body, maxLines: 5, decoration: const InputDecoration(labelText: 'Body')),
          const SizedBox(height: 10),
          Row(children: [
            const Expanded(child: Text('Unlock on')),
            TextButton(
              onPressed: () async {
                final d = await showDatePicker(
                  context: ctx, firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 3650)),
                  initialDate: unlock,
                );
                if (d != null) setD(() => unlock = d);
              },
              child: Text('${unlock.year}-${unlock.month.toString().padLeft(2, '0')}-${unlock.day.toString().padLeft(2, '0')}'),
            ),
          ]),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Seal')),
        ],
      )),
    );
    if (ok != true) return;
    final me = ref.read(currentUserProvider);
    final row = await ref.read(supabaseProvider).from('profiles').select('partner_id').eq('id', me!.id).maybeSingle();
    final partnerId = row?['partner_id'] as String?;
    if (partnerId == null) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link a partner first.')));
      return;
    }
    try {
      await ref.read(supabaseProvider).from('love_letters').insert({
        'sender_id': me.id, 'recipient_id': partnerId,
        'title': title.text.trim(), 'body': body.text.trim(),
        'unlock_at': unlock.toIso8601String(),
      });
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _open(Map<String, dynamic> l) async {
    final me = ref.read(currentUserProvider);
    final sealed = DateTime.parse(l['unlock_at'] as String).isAfter(DateTime.now());
    final iAmRecipient = l['recipient_id'] == me?.id;
    if (sealed) {
      showDialog(context: context, builder: (_) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(l['title'] ?? 'Sealed', style: serifItalic(size: 20)),
        content: Text('This letter unlocks on ${l['unlock_at']}'),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
      ));
      return;
    }
    if (iAmRecipient && l['opened_at'] == null) {
      try { await ref.read(supabaseProvider).rpc('open_love_letter', params: {'_id': l['id']}); } catch (_) {}
    }
    if (!mounted) return;
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: AppColors.surface,
      title: Text(l['title'] ?? 'Letter', style: serifItalic(size: 24)),
      content: SingleChildScrollView(child: Text((l['body'] ?? '') as String)),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
    ));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: _compose,
        backgroundColor: AppColors.coral,
        child: const Icon(Icons.edit),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.petal))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
              children: [
                if (_letters.isEmpty) const Text('No letters yet.', style: TextStyle(color: AppColors.candleMuted)),
                for (final l in _letters) _letterCard(l),
              ],
            ),
    );
  }

  Widget _letterCard(Map<String, dynamic> l) {
    final sealed = DateTime.parse(l['unlock_at'] as String).isAfter(DateTime.now());
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => _open(l),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: sealed ? AppColors.coral.withOpacity(0.5) : AppColors.border),
            ),
            child: Row(children: [
              Icon(sealed ? Icons.lock : Icons.mark_email_read,
                  color: sealed ? AppColors.coral : AppColors.petal),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l['title'] ?? 'Untitled', style: serifItalic(size: 18)),
                Text(sealed ? 'Sealed until ${l['unlock_at']}' : 'Unlocked',
                    style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
              ])),
            ]),
          ),
        ),
      ),
    );
  }
}

// ---------------- Time Capsules ----------------

class _TimeCapsulesTab extends ConsumerStatefulWidget {
  const _TimeCapsulesTab();
  @override
  ConsumerState<_TimeCapsulesTab> createState() => _TimeCapsulesTabState();
}

class _TimeCapsulesTabState extends ConsumerState<_TimeCapsulesTab> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final rows = await ref.read(supabaseProvider)
        .from('time_capsules')
        .select('id, sender_id, recipient_id, title, content, unlock_at, created_at')
        .or('sender_id.eq.${me.id},recipient_id.eq.${me.id}')
        .order('unlock_at', ascending: true);
    if (mounted) setState(() { _rows = List<Map<String, dynamic>>.from(rows); _loading = false; });
  }

  Future<void> _compose() async {
    final title = TextEditingController();
    final body = TextEditingController();
    DateTime unlock = DateTime.now().add(const Duration(days: 30));
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('New capsule', style: serifItalic(size: 22)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 10),
          TextField(controller: body, maxLines: 4, decoration: const InputDecoration(labelText: 'Message to the future')),
          const SizedBox(height: 10),
          Row(children: [
            const Expanded(child: Text('Open on')),
            TextButton(
              onPressed: () async {
                final d = await showDatePicker(
                  context: ctx, firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 3650)),
                  initialDate: unlock,
                );
                if (d != null) setD(() => unlock = d);
              },
              child: Text('${unlock.year}-${unlock.month.toString().padLeft(2, '0')}-${unlock.day.toString().padLeft(2, '0')}'),
            ),
          ]),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Bury')),
        ],
      )),
    );
    if (ok != true) return;
    final me = ref.read(currentUserProvider);
    final row = await ref.read(supabaseProvider).from('profiles').select('partner_id').eq('id', me!.id).maybeSingle();
    final partnerId = row?['partner_id'] as String?;
    if (partnerId == null) return;
    await ref.read(supabaseProvider).from('time_capsules').insert({
      'sender_id': me.id, 'recipient_id': partnerId,
      'title': title.text.trim(), 'content': body.text.trim(),
      'unlock_at': unlock.toIso8601String(),
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: _compose, backgroundColor: AppColors.coral,
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.petal))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
              children: [
                if (_rows.isEmpty) const Text('No capsules yet.', style: TextStyle(color: AppColors.candleMuted)),
                for (final c in _rows)
                  _capsuleCard(c),
              ],
            ),
    );
  }

  Widget _capsuleCard(Map<String, dynamic> c) {
    final sealed = DateTime.parse(c['unlock_at'] as String).isAfter(DateTime.now());
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: sealed ? AppColors.coral.withOpacity(0.4) : AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(sealed ? Icons.hourglass_top : Icons.local_florist, color: AppColors.coral),
            const SizedBox(width: 10),
            Expanded(child: Text(c['title'] ?? 'Untitled', style: serifItalic(size: 18))),
          ]),
          const SizedBox(height: 8),
          Text(sealed ? 'Opens ${c['unlock_at']}' : (c['content'] ?? '') as String,
              style: TextStyle(color: sealed ? AppColors.candleMuted : AppColors.candle)),
        ]),
      ),
    );
  }
}

// ---------------- Memory Jar ----------------

class _MemoryJarTab extends ConsumerStatefulWidget {
  const _MemoryJarTab();
  @override
  ConsumerState<_MemoryJarTab> createState() => _MemoryJarTabState();
}

class _MemoryJarTabState extends ConsumerState<_MemoryJarTab> {
  List<Map<String, dynamic>> _rows = [];
  bool _loading = true;
  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final rows = await ref.read(supabaseProvider)
        .from('memory_jar')
        .select('id, author_id, partner_id, title, body, mood, happened_on, created_at')
        .or('author_id.eq.${me.id},partner_id.eq.${me.id}')
        .order('happened_on', ascending: false);
    if (mounted) setState(() { _rows = List<Map<String, dynamic>>.from(rows); _loading = false; });
  }

  Future<void> _compose() async {
    final title = TextEditingController();
    final body = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('New memory', style: serifItalic(size: 22)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 10),
          TextField(controller: body, maxLines: 4, decoration: const InputDecoration(labelText: 'Body')),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok != true) return;
    final me = ref.read(currentUserProvider);
    final row = await ref.read(supabaseProvider).from('profiles').select('partner_id').eq('id', me!.id).maybeSingle();
    final partnerId = row?['partner_id'] as String?;
    await ref.read(supabaseProvider).from('memory_jar').insert({
      'author_id': me.id, 'partner_id': partnerId,
      'title': title.text.trim(), 'body': body.text.trim(),
      'happened_on': DateTime.now().toIso8601String().substring(0, 10),
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: _compose, backgroundColor: AppColors.coral,
        child: const Icon(Icons.bookmark_add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.petal))
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 96),
              children: [
                if (_rows.isEmpty) const Text('No memories yet.', style: TextStyle(color: AppColors.candleMuted)),
                for (final m in _rows) Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(m['title'] ?? 'Untitled', style: serifItalic(size: 18))),
                        Text(m['happened_on'] ?? '', style: const TextStyle(color: AppColors.candleMuted, fontSize: 11)),
                      ]),
                      const SizedBox(height: 6),
                      Text((m['body'] ?? '') as String, style: const TextStyle(color: AppColors.candle)),
                    ]),
                  ),
                ),
              ],
            ),
    );
  }
}
