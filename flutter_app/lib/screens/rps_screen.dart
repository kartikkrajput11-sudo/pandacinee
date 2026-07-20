import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Rock–Paper–Scissors duel over Supabase Realtime broadcast.
///
/// Room is determined by the current user + their partner_id (from profiles).
/// Both peers join the same channel `rps:<sortedPairKey>` and broadcast their
/// picks. First to 3 wins the match.
class RpsScreen extends ConsumerStatefulWidget {
  const RpsScreen({super.key});

  @override
  ConsumerState<RpsScreen> createState() => _RpsScreenState();
}

enum _Pick { rock, paper, scissors }

extension on _Pick {
  String get glyph => switch (this) { _Pick.rock => '✊', _Pick.paper => '✋', _Pick.scissors => '✌' };
  String get label => switch (this) { _Pick.rock => 'Rock', _Pick.paper => 'Paper', _Pick.scissors => 'Scissors' };
}

class _RpsScreenState extends ConsumerState<RpsScreen> {
  RealtimeChannel? _channel;
  String? _roomKey;
  String? _partnerId;
  String? _partnerName;

  _Pick? _myPick;
  _Pick? _theirPick;
  int _myScore = 0;
  int _theirScore = 0;
  int _round = 1;
  String _status = 'Loading…';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final supa = ref.read(supabaseProvider);
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final profile = await supa
        .from('profiles')
        .select('partner_id')
        .eq('id', me.id)
        .maybeSingle();
    final partnerId = profile?['partner_id'] as String?;
    if (partnerId == null) {
      setState(() => _status = 'Link a partner to duel.');
      return;
    }
    final partner = await supa
        .from('profiles')
        .select('display_name, username')
        .eq('id', partnerId)
        .maybeSingle();

    final ids = [me.id, partnerId]..sort();
    final key = 'rps:${ids[0]}:${ids[1]}';

    final ch = supa.channel(key,
        opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(
      event: 'pick',
      callback: (payload) {
        final from = payload['from'] as String?;
        if (from == null || from == me.id) return;
        final p = _Pick.values.firstWhere(
            (x) => x.name == payload['pick'], orElse: () => _Pick.rock);
        setState(() => _theirPick = p);
        _resolveIfReady();
      },
    );
    ch.subscribe();

    setState(() {
      _partnerId = partnerId;
      _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
      _roomKey = key;
      _channel = ch;
      _status = 'Waiting for a pick…';
    });
  }

  void _resolveIfReady() {
    if (_myPick == null || _theirPick == null) return;
    final r = _winner(_myPick!, _theirPick!);
    setState(() {
      if (r > 0) _myScore++;
      if (r < 0) _theirScore++;
      _status = r == 0
          ? 'Draw'
          : r > 0
              ? 'You take the round'
              : '$_partnerName takes the round';
    });
    Timer(const Duration(milliseconds: 1400), () {
      if (!mounted) return;
      if (_myScore >= 3 || _theirScore >= 3) return;
      setState(() {
        _round++;
        _myPick = null;
        _theirPick = null;
        _status = 'Round $_round · make your pick';
      });
    });
  }

  int _winner(_Pick me, _Pick them) {
    if (me == them) return 0;
    const beats = {_Pick.rock: _Pick.scissors, _Pick.paper: _Pick.rock, _Pick.scissors: _Pick.paper};
    return beats[me] == them ? 1 : -1;
  }

  Future<void> _pick(_Pick p) async {
    if (_channel == null || _myPick != null) return;
    final me = ref.read(currentUserProvider)!;
    setState(() {
      _myPick = p;
      _status = _theirPick == null ? 'Waiting for $_partnerName…' : 'Resolving…';
    });
    await _channel!.sendBroadcastMessage(
      event: 'pick',
      payload: {'from': me.id, 'pick': p.name},
    );
    _resolveIfReady();
  }

  void _reset() {
    setState(() {
      _myScore = 0;
      _theirScore = 0;
      _round = 1;
      _myPick = null;
      _theirPick = null;
      _status = 'Round 1 · make your pick';
    });
  }

  @override
  void dispose() {
    if (_channel != null) {
      ref.read(supabaseProvider).removeChannel(_channel!);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final done = _myScore >= 3 || _theirScore >= 3;
    final iWon = _myScore >= 3;

    return Scaffold(
      appBar: AppBar(title: const Text('Rock · Paper · Scissors')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              _ScoreRow(
                left: 'You',
                right: _partnerName ?? '—',
                leftScore: _myScore,
                rightScore: _theirScore,
              ),
              const SizedBox(height: 24),
              Text('Round $_round · first to 3',
                  style: eyebrow(color: AppColors.candleMuted)),
              const SizedBox(height: 8),
              Text(_status, style: serifItalic(size: 26), textAlign: TextAlign.center),
              const SizedBox(height: 28),
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _Reveal(label: 'You', pick: _myPick, revealed: _myPick != null),
                    Text('vs',
                        style: serifItalic(size: 22, color: AppColors.candleMuted)),
                    _Reveal(
                        label: _partnerName ?? '—',
                        pick: _theirPick,
                        revealed: _theirPick != null),
                  ],
                ),
              ),
              if (done) ...[
                Text(iWon ? 'Victory' : 'Defeat',
                        style: serifItalic(size: 40, color: AppColors.coral))
                    .animate()
                    .fadeIn()
                    .scale(begin: const Offset(0.8, 0.8)),
                const SizedBox(height: 12),
                FilledButton(onPressed: _reset, child: const Text('Play again')),
                const SizedBox(height: 12),
              ] else
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: _Pick.values.map((p) {
                    final locked = _myPick != null;
                    return _PickButton(
                      pick: p,
                      onTap: locked ? null : () => _pick(p),
                      selected: _myPick == p,
                    );
                  }).toList(),
                ),
              const SizedBox(height: 8),
              if (_partnerId == null)
                const Text('No partner linked yet.',
                    style: TextStyle(color: AppColors.candleMuted)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScoreRow extends StatelessWidget {
  final String left, right;
  final int leftScore, rightScore;
  const _ScoreRow(
      {required this.left,
      required this.right,
      required this.leftScore,
      required this.rightScore});
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _scoreCell(left, leftScore),
        Container(width: 1, height: 34, color: AppColors.border),
        _scoreCell(right, rightScore),
      ],
    );
  }

  Widget _scoreCell(String name, int s) => Expanded(
        child: Column(
          children: [
            Text(name.toUpperCase(),
                style: eyebrow(color: AppColors.candleMuted), textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text('$s', style: serifItalic(size: 34, color: AppColors.coral)),
          ],
        ),
      );
}

class _Reveal extends StatelessWidget {
  final String label;
  final _Pick? pick;
  final bool revealed;
  const _Reveal({required this.label, required this.pick, required this.revealed});
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 110,
          height: 110,
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
                color: revealed ? AppColors.coral : AppColors.border, width: 1.4),
          ),
          alignment: Alignment.center,
          child: Text(
            revealed && pick != null ? pick!.glyph : '·',
            style: const TextStyle(fontSize: 54),
          ),
        ),
        const SizedBox(height: 10),
        Text(label,
            style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
      ],
    );
  }
}

class _PickButton extends StatelessWidget {
  final _Pick pick;
  final VoidCallback? onTap;
  final bool selected;
  const _PickButton({required this.pick, this.onTap, this.selected = false});
  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null && !selected ? 0.4 : 1,
      child: Material(
        color: selected ? AppColors.coral : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: selected ? AppColors.coral : AppColors.border),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(pick.glyph, style: const TextStyle(fontSize: 34)),
                const SizedBox(height: 4),
                Text(pick.label,
                    style: TextStyle(
                        color: selected ? Colors.white : AppColors.candle,
                        fontSize: 12,
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
