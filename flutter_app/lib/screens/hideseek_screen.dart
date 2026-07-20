import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Hide & Seek on a 6x6 velvet floor plan.
/// Roles: Hider picks a tile in secret, Seeker gets proximity "whispers"
/// ("very close" / "close" / "far") after each guess. 5 guesses to find them.
class HideSeekScreen extends ConsumerStatefulWidget {
  const HideSeekScreen({super.key});
  @override
  ConsumerState<HideSeekScreen> createState() => _HideSeekScreenState();
}

class _HideSeekScreenState extends ConsumerState<HideSeekScreen> {
  static const _N = 6;
  int? _hidden; // tile index 0..35, hider only
  int _hiderIdx = 0; // 0 = you, 1 = partner
  int _myIndex = 0;
  final List<int> _guesses = []; // indices
  final List<String> _whispers = [];
  String? _outcome; // 'found' | 'safe'
  String _partnerName = 'Partner';
  String _status = 'Loading…';
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
    // Lower id starts as hider.
    _hiderIdx = 0;
    final key = 'hs:${ids[0]}:${ids[1]}';
    final ch = supa.channel(key, opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'hide', callback: (p) {
      if (p['from'] == me.id) return;
      setState(() { _status = 'Hider chose a tile. Time to seek.'; });
    });
    ch.onBroadcast(event: 'guess', callback: (p) {
      if (p['from'] == me.id) return;
      _handleRemoteGuess(p['idx'] as int, (p['whisper'] as String?), p['outcome'] as String?);
    });
    ch.onBroadcast(event: 'reset', callback: (p) {
      if (p['from'] == me.id) return;
      setState(() {
        _hidden = null; _guesses.clear(); _whispers.clear();
        _outcome = null;
        _hiderIdx = p['hider'] as int? ?? _hiderIdx;
        _status = _amHider ? 'Pick a hiding tile.' : 'Waiting for partner to hide…';
      });
    });
    ch.subscribe();
    _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
    _channel = ch;
    _updateStatus();
    setState(() {});
  }

  bool get _amHider => _hiderIdx == _myIndex;

  void _updateStatus() {
    if (_outcome == 'found') {
      _status = _amHider ? 'You were found' : 'You caught $_partnerName';
    } else if (_outcome == 'safe') {
      _status = _amHider ? 'Safe — nobody found you' : 'Out of guesses';
    } else if (_amHider) {
      _status = _hidden == null ? 'Pick a hiding tile.' : 'Wait for $_partnerName to seek.';
    } else {
      _status = 'Seek: ${5 - _guesses.length} guesses remaining';
    }
  }

  void _handleRemoteGuess(int idx, String? whisper, String? outcome) {
    setState(() {
      _guesses.add(idx);
      if (whisper != null) _whispers.add(whisper);
      _outcome = outcome;
      _updateStatus();
    });
  }

  String _whisperFor(int guess) {
    if (_hidden == null) return '';
    final gr = guess ~/ _N, gc = guess % _N;
    final hr = _hidden! ~/ _N, hc = _hidden! % _N;
    final d = math.max((gr - hr).abs(), (gc - hc).abs());
    if (d == 0) return 'Found';
    if (d == 1) return 'A breath away';
    if (d <= 2) return 'Very close';
    if (d <= 3) return 'Close';
    return 'Distant';
  }

  void _tap(int idx) {
    if (_outcome != null) return;
    final me = ref.read(currentUserProvider);
    if (_amHider) {
      if (_hidden != null) return;
      setState(() { _hidden = idx; _updateStatus(); });
      _channel?.sendBroadcastMessage(event: 'hide', payload: {'from': me?.id});
    } else {
      if (_hidden == null) return; // seeker doesn't know hidden yet, but we need it for whisper
      if (_guesses.contains(idx)) return;
    }
  }

  // Seeker's tile taps happen on partner's channel — but we don't know _hidden locally as seeker.
  // Real flow: seeker sends the guess; hider replies with whisper/outcome.
  // Simpler: use a listener where both sides know via prior broadcast.
  // To keep this compact, seeker sends guess; hider responds via a second broadcast.

  void _seekerTap(int idx) async {
    if (_amHider || _outcome != null) return;
    if (_guesses.contains(idx)) return;
    final me = ref.read(currentUserProvider);
    setState(() {
      _guesses.add(idx);
    });
    _channel?.sendBroadcastMessage(event: 'guess-request', payload: {'from': me?.id, 'idx': idx});
  }

  Future<void> _initHiderListeners() async {
    // Hider listens for guess-request and replies with whisper + outcome
    final me = ref.read(currentUserProvider);
    _channel?.onBroadcast(event: 'guess-request', callback: (p) {
      if (p['from'] == me?.id || !_amHider || _hidden == null) return;
      final idx = p['idx'] as int;
      final w = _whisperFor(idx);
      String? outcome;
      final guessCount = _guesses.length + 1;
      if (idx == _hidden) outcome = 'found';
      else if (guessCount >= 5) outcome = 'safe';
      setState(() {
        _guesses.add(idx);
        _whispers.add(w);
        _outcome = outcome;
        _updateStatus();
      });
      _channel?.sendBroadcastMessage(event: 'guess', payload: {
        'from': me?.id, 'idx': idx, 'whisper': w, 'outcome': outcome,
      });
    });
  }

  void _reset() {
    final me = ref.read(currentUserProvider);
    setState(() {
      _hidden = null; _guesses.clear(); _whispers.clear();
      _outcome = null;
      _hiderIdx = 1 - _hiderIdx; // swap roles
      _updateStatus();
    });
    _channel?.sendBroadcastMessage(event: 'reset', payload: {'from': me?.id, 'hider': _hiderIdx});
  }

  @override
  void dispose() {
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Attach the hider listener once channel is ready.
    if (_channel != null) _initHiderListeners();
    return Scaffold(
      appBar: AppBar(title: const Text('Hide & Seek')),
      body: SafeArea(
        child: Column(children: [
          Padding(padding: const EdgeInsets.all(16), child: Column(children: [
            Text('Chapter · ${_amHider ? "Hider" : "Seeker"}', style: eyebrow()),
            const SizedBox(height: 4),
            Text(_status, style: serifItalic(size: 22)),
          ])),
          Expanded(
            child: Center(child: LayoutBuilder(builder: (_, c) {
              final s = math.min(c.maxWidth, c.maxHeight) - 24;
              return SizedBox(
                width: s, height: s,
                child: GridView.builder(
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(6),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: _N, mainAxisSpacing: 6, crossAxisSpacing: 6,
                  ),
                  itemCount: _N * _N,
                  itemBuilder: (_, i) {
                    final guessed = _guesses.contains(i);
                    final isMyHide = _amHider && _hidden == i;
                    final foundHere = _outcome == 'found' && _guesses.isNotEmpty && _guesses.last == i;
                    return GestureDetector(
                      onTap: () => _amHider ? _tap(i) : _seekerTap(i),
                      child: Container(
                        decoration: BoxDecoration(
                          color: foundHere
                              ? AppColors.coral
                              : guessed
                                  ? AppColors.surface.withOpacity(0.4)
                                  : AppColors.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: isMyHide ? AppColors.coral : AppColors.border,
                            width: isMyHide ? 2 : 1,
                          ),
                        ),
                        alignment: Alignment.center,
                        child: isMyHide
                            ? Text('★', style: TextStyle(color: AppColors.coral, fontSize: 22))
                            : guessed
                                ? Text('${_guesses.indexOf(i) + 1}',
                                    style: const TextStyle(color: AppColors.candleMuted, fontSize: 12))
                                : null,
                      ),
                    );
                  },
                ),
              );
            })),
          ),
          if (_whispers.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Wrap(spacing: 8, runSpacing: 6, children: [
                for (final w in _whispers.reversed.take(3))
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.wine.withOpacity(0.4),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: AppColors.coral.withOpacity(0.4)),
                    ),
                    child: Text('“$w”', style: const TextStyle(fontSize: 12)),
                  ).animate().fadeIn(),
              ]),
            ),
          if (_outcome != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: FilledButton(onPressed: _reset, child: const Text('Swap roles')),
            ),
        ]),
      ),
    );
  }
}
