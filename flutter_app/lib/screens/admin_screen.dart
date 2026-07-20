import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme.dart';

/// Phase 18 — Admin console (feature-flag toggles, animation previews,
/// broadcast). Rendered only when the caller is an admin (profiles.is_admin).
class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});
  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen>
    with TickerProviderStateMixin {
  final _client = Supabase.instance.client;
  bool? _isAdmin;
  Map<String, dynamic> _flags = {};
  final _broadcastTitle = TextEditingController();
  final _broadcastBody = TextEditingController();
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  Future<void> _load() async {
    final me = _client.auth.currentUser?.id;
    if (me == null) return;
    final prof = await _client.from('profiles').select('is_admin').eq('id', me).maybeSingle();
    final flagRows = await _client.from('site_flags').select();
    if (mounted) {
      setState(() {
        _isAdmin = (prof?['is_admin'] as bool?) ?? false;
        _flags = {for (final r in flagRows) r['key']: r['value']};
      });
    }
  }

  Future<void> _toggleFlag(String key) async {
    final current = _flags[key] == true;
    await _client.from('site_flags').upsert({'key': key, 'value': !current});
    setState(() => _flags[key] = !current);
  }

  Future<void> _broadcast() async {
    // Fan-out: writes one message row per active user via RPC (broadcast_notice).
    await _client.rpc('broadcast_notice', params: {
      '_title': _broadcastTitle.text.trim(),
      '_body': _broadcastBody.text.trim(),
    });
    if (mounted) {
      _broadcastTitle.clear();
      _broadcastBody.clear();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Broadcast dispatched')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isAdmin == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.petal)));
    }
    if (_isAdmin == false) {
      return Scaffold(
        appBar: AppBar(title: Text('Admin', style: serifItalic(size: 24))),
        body: Center(child: Text('Not authorized', style: eyebrow())),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text('Admin console', style: serifItalic(size: 26)),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Flags'), Tab(text: 'Animations'), Tab(text: 'Broadcast')],
          indicatorColor: AppColors.petal,
        ),
      ),
      body: TabBarView(controller: _tabs, children: [
        _flagsTab(),
        _animTab(),
        _broadcastTab(),
      ]),
    );
  }

  Widget _flagsTab() {
    final keys = ['owners_banner', 'signup_open', 'movies_enabled', 'games_enabled'];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        for (final k in keys)
          SwitchListTile(
            title: Text(k, style: serifItalic(size: 20)),
            subtitle: Text('site_flags · $k', style: eyebrow()),
            value: _flags[k] == true,
            activeThumbColor: AppColors.petal,
            onChanged: (_) => _toggleFlag(k),
          ),
      ],
    );
  }

  Widget _animTab() {
    final tests = [
      ('Kiss overlay', Icons.favorite),
      ('Hug overlay', Icons.pets),
      ('Headpat', Icons.back_hand),
      ('Owners story', Icons.auto_stories),
      ('Anniversary', Icons.celebration),
    ];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        for (final t in tests)
          Card(
            color: AppColors.surface,
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: Icon(t.$2, color: AppColors.petal),
              title: Text(t.$1, style: serifItalic(size: 20)),
              trailing: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.petal),
                onPressed: () => _preview(t.$1),
                child: const Text('Test'),
              ),
            ),
          ),
      ],
    );
  }

  void _preview(String name) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text(name, style: serifItalic(size: 24)),
        content: SizedBox(
          height: 200,
          child: Center(
            child: Icon(Icons.favorite, size: 80, color: AppColors.petal),
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
  }

  Widget _broadcastTab() => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Site-wide notice', style: serifItalic(size: 24)),
          const SizedBox(height: 12),
          TextField(controller: _broadcastTitle, decoration: const InputDecoration(hintText: 'Title')),
          const SizedBox(height: 10),
          TextField(
            controller: _broadcastBody,
            maxLines: 5,
            decoration: const InputDecoration(hintText: 'Body'),
          ),
          const SizedBox(height: 14),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.petal),
            onPressed: _broadcast,
            child: const Text('Send to every panda'),
          ),
        ],
      );
}
