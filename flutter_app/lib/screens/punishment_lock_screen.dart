import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Punishment Locks — if someone put a case-insensitive word/phrase task on
/// you, this screen displays it and lets you submit progress. Case & punctuation
/// are normalized against the lock's prompt.
class PunishmentLockScreen extends ConsumerStatefulWidget {
  const PunishmentLockScreen({super.key});
  @override
  ConsumerState<PunishmentLockScreen> createState() => _PunishmentLockScreenState();
}

class _PunishmentLockScreenState extends ConsumerState<PunishmentLockScreen> {
  Map<String, dynamic>? _lock;
  bool _loading = true;
  final _ctrl = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final row = await ref.read(supabaseProvider)
        .from('punishment_locks')
        .select('*')
        .eq('target_id', me.id)
        .eq('status', 'active')
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (mounted) setState(() { _lock = row; _loading = false; });
  }

  String _normalize(String s) =>
      s.toLowerCase().replaceAll(RegExp(r"[^a-z0-9\s]"), '').replaceAll(RegExp(r'\s+'), ' ').trim();

  Future<void> _submit() async {
    final l = _lock;
    if (l == null) return;
    final want = _normalize((l['prompt'] ?? '') as String);
    final got = _normalize(_ctrl.text);
    final match = want.isNotEmpty && got == want;
    final me = ref.read(currentUserProvider);
    final supa = ref.read(supabaseProvider);
    try {
      await supa.from('punishment_verification_messages').insert({
        'lock_id': l['id'],
        'sender_id': me?.id,
        'body': _ctrl.text,
        'accepted': match,
      });
      if (match) {
        final progress = ((l['progress'] ?? 0) as num).toInt() + 1;
        final needed = ((l['required_count'] ?? 1) as num).toInt();
        if (progress >= needed) {
          await supa.from('punishment_locks').update({
            'progress': progress, 'status': 'completed',
            'completed_at': DateTime.now().toIso8601String(),
          }).eq('id', l['id']);
        } else {
          await supa.from('punishment_locks').update({'progress': progress}).eq('id', l['id']);
        }
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
    _ctrl.clear();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.petal)));
    final l = _lock;
    return Scaffold(
      appBar: AppBar(title: const Text('Locked chapter')),
      body: SafeArea(
        child: l == null
            ? Center(child: Padding(
                padding: const EdgeInsets.all(30),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('Nothing pending', style: serifItalic(size: 28)),
                  const SizedBox(height: 8),
                  const Text('No active locks on you right now.',
                      style: TextStyle(color: AppColors.candleMuted)),
                ]),
              ))
            : Padding(
                padding: const EdgeInsets.all(20),
                child: Column(children: [
                  Text('Chapter · Task', style: eyebrow()),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.wine, Color(0xFF1A0616)],
                        begin: Alignment.topLeft, end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.coral.withOpacity(0.5)),
                    ),
                    child: Column(children: [
                      const Icon(Icons.lock_outline, color: AppColors.coral, size: 30),
                      const SizedBox(height: 10),
                      Text((l['prompt'] ?? '') as String,
                          textAlign: TextAlign.center,
                          style: serifItalic(size: 22)),
                      const SizedBox(height: 8),
                      Text('Progress ${l['progress'] ?? 0} / ${l['required_count'] ?? 1}',
                          style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
                    ]),
                  ).animate().fadeIn().slideY(begin: .1),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _ctrl,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Type the exact words',
                      helperText: 'Case & punctuation are forgiven — spelling is not.',
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _submit, child: const Text('Submit')),
                ]),
              ),
      ),
    );
  }
}
