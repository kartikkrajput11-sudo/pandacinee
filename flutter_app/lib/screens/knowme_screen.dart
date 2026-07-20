import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// "How Well Do You Know Me?" — Setter writes a question and four options,
/// picks the correct one; Guesser picks. Reveal, score, swap roles.
class KnowMeScreen extends ConsumerStatefulWidget {
  const KnowMeScreen({super.key});
  @override
  ConsumerState<KnowMeScreen> createState() => _KnowMeScreenState();
}

class _KnowMeScreenState extends ConsumerState<KnowMeScreen> {
  int _myIndex = 0;
  int _setter = 0;
  int _score0 = 0, _score1 = 0;
  String _partnerName = 'Partner';
  String _status = 'Loading…';

  // Current round
  String? _question;
  List<String>? _options;
  int? _correct; // known to setter only, revealed on answer
  int? _pick;    // guesser's choice
  bool _revealed = false;

  RealtimeChannel? _channel;

  @override
  void initState() { super.initState(); _bootstrap(); }

  Future<void> _bootstrap() async {
    final supa = ref.read(supabaseProvider);
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final row = await supa.from('profiles').select('partner_id').eq('id', me.id).maybeSingle();
    final partnerId = row?['partner_id'] as String?;
    if (partnerId == null) { setState(() => _status = 'Link a partner to play.'); return; }
    final partner = await supa.from('profiles').select('display_name, username').eq('id', partnerId).maybeSingle();
    final ids = [me.id, partnerId]..sort();
    _myIndex = ids[0] == me.id ? 0 : 1;
    final key = 'knowme:${ids[0]}:${ids[1]}';
    final ch = supa.channel(key, opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'round', callback: (p) {
      if (p['from'] == me.id) return;
      setState(() {
        _question = p['q'] as String;
        _options = List<String>.from(p['opts']);
        _correct = null; // guesser doesn't know yet
        _pick = null; _revealed = false;
        _updateStatus();
      });
    });
    ch.onBroadcast(event: 'guess', callback: (p) {
      if (p['from'] == me.id) return;
      setState(() { _pick = p['pick'] as int; _updateStatus(); });
    });
    ch.onBroadcast(event: 'reveal', callback: (p) {
      if (p['from'] == me.id) return;
      setState(() {
        _correct = p['correct'] as int;
        _revealed = true;
        if (_pick == _correct) {
          if (_setter == 0) _score1++; else _score0++;
        }
        _updateStatus();
      });
    });
    ch.onBroadcast(event: 'next', callback: (p) {
      if (p['from'] == me.id) return;
      setState(() {
        _setter = p['setter'] as int;
        _question = null; _options = null; _correct = null;
        _pick = null; _revealed = false;
        _updateStatus();
      });
    });
    ch.subscribe();
    _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
    _channel = ch;
    _updateStatus();
    setState(() {});
  }

  bool get _amSetter => _setter == _myIndex;

  void _updateStatus() {
    if (_question == null) {
      _status = _amSetter ? 'Compose a question' : 'Waiting for $_partnerName to compose…';
      return;
    }
    if (_revealed) {
      final gotIt = _pick == _correct;
      _status = gotIt ? 'Right answer' : 'Missed';
      return;
    }
    if (_amSetter) {
      _status = _pick == null ? 'Awaiting guess…' : 'Reveal when ready';
    } else {
      _status = _pick == null ? 'Pick an answer' : 'Locked in — awaiting reveal';
    }
  }

  Future<void> _compose() async {
    final result = await showDialog<_Composed>(
      context: context,
      builder: (_) => const _ComposeDialog(),
    );
    if (result == null) return;
    final me = ref.read(currentUserProvider);
    setState(() {
      _question = result.question;
      _options = result.options;
      _correct = result.correctIdx;
      _pick = null; _revealed = false;
      _updateStatus();
    });
    _channel?.sendBroadcastMessage(event: 'round', payload: {
      'from': me?.id,
      'q': result.question,
      'opts': result.options,
    });
  }

  void _pickAnswer(int i) {
    if (_amSetter || _pick != null || _revealed) return;
    final me = ref.read(currentUserProvider);
    setState(() { _pick = i; _updateStatus(); });
    _channel?.sendBroadcastMessage(event: 'guess', payload: {'from': me?.id, 'pick': i});
  }

  void _reveal() {
    if (!_amSetter || _correct == null || _pick == null || _revealed) return;
    final me = ref.read(currentUserProvider);
    setState(() {
      _revealed = true;
      if (_pick == _correct) {
        if (_setter == 0) _score1++; else _score0++;
      }
      _updateStatus();
    });
    _channel?.sendBroadcastMessage(event: 'reveal', payload: {'from': me?.id, 'correct': _correct});
  }

  void _next() {
    final me = ref.read(currentUserProvider);
    setState(() {
      _setter = 1 - _setter;
      _question = null; _options = null; _correct = null;
      _pick = null; _revealed = false;
      _updateStatus();
    });
    _channel?.sendBroadcastMessage(event: 'next', payload: {'from': me?.id, 'setter': _setter});
  }

  @override
  void dispose() {
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final myScore = _myIndex == 0 ? _score0 : _score1;
    final theirScore = _myIndex == 0 ? _score1 : _score0;
    return Scaffold(
      appBar: AppBar(title: const Text('How Well Do You Know Me?')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              _scoreCell('You', myScore),
              Container(width: 1, height: 30, color: AppColors.border),
              _scoreCell(_partnerName, theirScore),
            ]),
            const SizedBox(height: 24),
            Text('Chapter · ${_amSetter ? "Setter" : "Guesser"}', style: eyebrow()),
            const SizedBox(height: 6),
            Text(_status, style: serifItalic(size: 22), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            if (_question == null && _amSetter)
              FilledButton(onPressed: _compose, child: const Text('Compose a question'))
            else if (_question != null) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(_question!, style: serifItalic(size: 20), textAlign: TextAlign.center),
              ),
              const SizedBox(height: 16),
              for (var i = 0; i < _options!.length; i++)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: _OptionTile(
                    label: _options![i],
                    selected: _pick == i,
                    correct: _revealed && _correct == i,
                    wrong: _revealed && _pick == i && _correct != i,
                    onTap: !_amSetter && _pick == null ? () => _pickAnswer(i) : null,
                  ),
                ),
              const SizedBox(height: 12),
              if (_amSetter && _pick != null && !_revealed)
                FilledButton(onPressed: _reveal, child: const Text('Reveal')),
              if (_revealed)
                FilledButton(onPressed: _next, child: const Text('Next round · swap')),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _scoreCell(String n, int s) => Expanded(
    child: Column(children: [
      Text(n.toUpperCase(), style: eyebrow(color: AppColors.candleMuted)),
      const SizedBox(height: 4),
      Text('$s', style: serifItalic(size: 30, color: AppColors.coral)),
    ]),
  );
}

class _OptionTile extends StatelessWidget {
  final String label;
  final bool selected, correct, wrong;
  final VoidCallback? onTap;
  const _OptionTile({required this.label, this.selected = false, this.correct = false, this.wrong = false, this.onTap});
  @override
  Widget build(BuildContext context) {
    Color border = AppColors.border;
    Color? bg;
    if (correct) { border = Colors.green; bg = Colors.green.withOpacity(0.15); }
    else if (wrong) { border = Colors.redAccent; bg = Colors.red.withOpacity(0.15); }
    else if (selected) { border = AppColors.coral; }
    return Material(
      color: bg ?? AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: border, width: selected || correct || wrong ? 1.6 : 1),
          ),
          child: Text(label),
        ),
      ),
    );
  }
}

class _Composed {
  final String question;
  final List<String> options;
  final int correctIdx;
  _Composed(this.question, this.options, this.correctIdx);
}

class _ComposeDialog extends StatefulWidget {
  const _ComposeDialog();
  @override
  State<_ComposeDialog> createState() => _ComposeDialogState();
}

class _ComposeDialogState extends State<_ComposeDialog> {
  final _q = TextEditingController();
  final _opts = List.generate(4, (_) => TextEditingController());
  int _correct = 0;

  @override
  void dispose() {
    _q.dispose();
    for (final c in _opts) { c.dispose(); }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface,
      title: Text('Compose', style: serifItalic(size: 22)),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: _q, decoration: const InputDecoration(labelText: 'Question')),
          const SizedBox(height: 12),
          for (var i = 0; i < 4; i++)
            Row(children: [
              Radio<int>(
                value: i, groupValue: _correct,
                onChanged: (v) => setState(() => _correct = v ?? 0),
                activeColor: AppColors.coral,
              ),
              Expanded(child: TextField(
                controller: _opts[i],
                decoration: InputDecoration(labelText: 'Option ${i + 1}'),
              )),
            ]),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            if (_q.text.trim().isEmpty) return;
            final opts = _opts.map((c) => c.text.trim()).toList();
            if (opts.any((s) => s.isEmpty)) return;
            Navigator.pop(context, _Composed(_q.text.trim(), opts, _correct));
          },
          child: const Text('Send'),
        ),
      ],
    );
  }
}
