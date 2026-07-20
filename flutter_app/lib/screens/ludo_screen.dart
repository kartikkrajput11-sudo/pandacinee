import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Compact 2-player Ludo: each player has 4 tokens, path length 52,
/// plus 6-tile home stretch. Position -1 = in base, 57 = crowned.
/// Roll a 6 to leave base. Land on opponent → captured back to base.
/// First to crown all 4 tokens wins.
class LudoScreen extends ConsumerStatefulWidget {
  const LudoScreen({super.key});
  @override
  ConsumerState<LudoScreen> createState() => _LudoScreenState();
}

class _LudoScreenState extends ConsumerState<LudoScreen> {
  // Positions for each player (0 = you, 1 = partner)
  final _pos = [List.filled(4, -1), List.filled(4, -1)];
  int _turn = 0; // 0 = white/you, 1 = partner
  int? _dice;
  bool _rolling = false;
  int _myIndex = 0; // your seat
  String _partnerName = 'Partner';
  String _status = 'Loading…';
  int? _winner;
  RealtimeChannel? _channel;

  // Player 0 starts at path index 0, player 1 at 26 (opposite side).
  static const _starts = [0, 26];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

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
    final key = 'ludo:${ids[0]}:${ids[1]}';
    final ch = supa.channel(key, opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'state', callback: (payload) {
      if (payload['from'] == me.id) return;
      _applyState(payload);
    });
    ch.subscribe();
    setState(() {
      _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
      _channel = ch;
      _updateStatus();
    });
  }

  void _updateStatus() {
    if (_winner != null) {
      _status = _winner == _myIndex ? 'Victory' : '$_partnerName wins';
      return;
    }
    _status = _turn == _myIndex ? 'Your turn' : '$_partnerName rolling…';
  }

  void _broadcast() {
    final me = ref.read(currentUserProvider);
    _channel?.sendBroadcastMessage(event: 'state', payload: {
      'from': me?.id,
      'p0': _pos[0], 'p1': _pos[1],
      'turn': _turn, 'dice': _dice, 'winner': _winner,
    });
  }

  void _applyState(Map p) {
    setState(() {
      _pos[0] = List<int>.from(p['p0']);
      _pos[1] = List<int>.from(p['p1']);
      _turn = p['turn'] as int;
      _dice = p['dice'] as int?;
      _winner = p['winner'] as int?;
      _updateStatus();
    });
  }

  Future<void> _roll() async {
    if (_winner != null || _turn != _myIndex || _rolling || _dice != null) return;
    setState(() => _rolling = true);
    for (var i = 0; i < 8; i++) {
      await Future.delayed(const Duration(milliseconds: 60));
      if (!mounted) return;
      setState(() => _dice = 1 + math.Random().nextInt(6));
    }
    _rolling = false;
    // If no move is possible, pass turn.
    if (!_hasAnyMove()) {
      _endTurn(rolledSix: _dice == 6);
    } else {
      _broadcast();
    }
  }

  bool _hasAnyMove() {
    for (var i = 0; i < 4; i++) {
      if (_canMove(_myIndex, i)) return true;
    }
    return false;
  }

  bool _canMove(int player, int token) {
    final p = _pos[player][token];
    final d = _dice;
    if (d == null) return false;
    if (p == -1) return d == 6;
    if (p + d > 57) return false;
    return true;
  }

  int _absSquare(int player, int p) {
    // p in [0..51] maps to absolute board square; p 52..57 is home stretch (per-player).
    if (p < 0) return -1;
    if (p >= 52) return -1; // home stretch, drawn separately
    return (_starts[player] + p) % 52;
  }

  void _tapToken(int token) {
    if (_turn != _myIndex || _dice == null || _winner != null) return;
    if (!_canMove(_myIndex, token)) return;
    final cur = _pos[_myIndex][token];
    final next = cur == -1 ? 0 : cur + _dice!;
    _pos[_myIndex][token] = next;
    // Capture: same absolute square, not home stretch, not on a safe start.
    final absNext = _absSquare(_myIndex, next);
    if (absNext != -1) {
      final other = 1 - _myIndex;
      for (var i = 0; i < 4; i++) {
        final op = _pos[other][i];
        if (op == -1 || op >= 52) continue;
        if (_absSquare(other, op) == absNext && absNext != _starts[other]) {
          _pos[other][i] = -1;
        }
      }
    }
    // Win check
    if (_pos[_myIndex].every((v) => v == 57)) {
      _winner = _myIndex;
      _updateStatus();
      _broadcast();
      return;
    }
    _endTurn(rolledSix: _dice == 6);
  }

  void _endTurn({required bool rolledSix}) {
    setState(() {
      if (!rolledSix) _turn = 1 - _turn;
      _dice = null;
      _updateStatus();
    });
    _broadcast();
  }

  @override
  void dispose() {
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ludo')),
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: Column(children: [
              Text('Chapter · Race', style: eyebrow()),
              const SizedBox(height: 6),
              Text(_status, style: serifItalic(size: 22)),
            ]),
          ),
          Expanded(
            child: Center(child: LayoutBuilder(builder: (_, c) {
              final s = math.min(c.maxWidth, c.maxHeight) - 16;
              return SizedBox(width: s, height: s, child: _LudoBoard(
                pos: _pos, myIndex: _myIndex,
                onTapToken: _tapToken,
                dice: _dice,
                canMoveToken: (t) => _turn == _myIndex && _canMove(_myIndex, t),
              ));
            })),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _DiceView(value: _dice),
                const SizedBox(width: 16),
                FilledButton(
                  onPressed: (_turn == _myIndex && _dice == null && _winner == null) ? _roll : null,
                  child: Text(_rolling ? 'Rolling…' : 'Roll'),
                ),
                if (_winner != null) ...[
                  const SizedBox(width: 16),
                  OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _pos[0] = List.filled(4, -1);
                        _pos[1] = List.filled(4, -1);
                        _turn = 0; _dice = null; _winner = null;
                        _updateStatus();
                      });
                      _broadcast();
                    },
                    child: const Text('New game'),
                  ),
                ]
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

class _DiceView extends StatelessWidget {
  final int? value;
  const _DiceView({required this.value});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56, height: 56,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.coral),
      ),
      alignment: Alignment.center,
      child: Text(value?.toString() ?? '·',
          style: serifItalic(size: 28, color: AppColors.coral)),
    );
  }
}

class _LudoBoard extends StatelessWidget {
  final List<List<int>> pos;
  final int myIndex;
  final void Function(int token) onTapToken;
  final int? dice;
  final bool Function(int token) canMoveToken;
  const _LudoBoard({
    required this.pos, required this.myIndex,
    required this.onTapToken, required this.dice,
    required this.canMoveToken,
  });

  // Path coordinates on a 15x15 grid — standard Ludo track.
  static const _track = <List<int>>[
    // Starting at bottom-left corridor going right
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],
    [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
    [7,14],
    [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
    [14,7],
    [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
    [7,0],
    [6,0],
  ];

  Offset _pointFor(int player, int p, double cell) {
    // Path idx: player 0 starts at track[0]; player 1 offset by 26.
    if (p < 0) return Offset(-1, -1);
    if (p < 52) {
      final idx = (p + (player == 0 ? 0 : 26)) % 52;
      final row = _track[idx][0], col = _track[idx][1];
      return Offset(col * cell + cell / 2, row * cell + cell / 2);
    }
    // Home stretch (52..57 -> 1..6 steps toward center)
    final step = p - 51; // 1..6
    if (player == 0) {
      // vertical up from row 13 col 7 to row 8 col 7
      final row = 13 - step + 1;
      return Offset(7 * cell + cell / 2, row * cell + cell / 2);
    } else {
      // vertical down from row 1 col 7 to row 6 col 7
      final row = 1 + step - 1;
      return Offset(7 * cell + cell / 2, row * cell + cell / 2);
    }
  }

  Offset _basePoint(int player, int token, double cell) {
    // Player 0 base: bottom-left 6x6, player 1: top-right 6x6.
    final positions0 = const [[11,2],[11,4],[13,2],[13,4]];
    final positions1 = const [[1,10],[1,12],[3,10],[3,12]];
    final t = (player == 0 ? positions0 : positions1)[token];
    return Offset(t[1] * cell + cell / 2, t[0] * cell + cell / 2);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final cell = c.maxWidth / 15;
      return Container(
        decoration: BoxDecoration(
          color: AppColors.velvet,
          border: Border.all(color: AppColors.coral, width: 1.4),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Stack(children: [
          // Track squares
          for (int i = 0; i < _track.length; i++)
            Positioned(
              left: _track[i][1] * cell,
              top: _track[i][0] * cell,
              width: cell, height: cell,
              child: Container(
                margin: const EdgeInsets.all(1),
                decoration: BoxDecoration(
                  color: AppColors.surface.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(3),
                  border: Border.all(color: AppColors.border, width: 0.5),
                ),
              ),
            ),
          // Base squares
          _BaseCorner(topLeft: Offset(1 * cell, 9 * cell), size: cell * 5, color: AppColors.coral.withOpacity(0.15)),
          _BaseCorner(topLeft: Offset(9 * cell, 1 * cell), size: cell * 5, color: AppColors.petal.withOpacity(0.15)),
          // Center
          Positioned(
            left: cell * 6, top: cell * 6, width: cell * 3, height: cell * 3,
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.wine.withOpacity(0.3),
                border: Border.all(color: AppColors.coral),
                borderRadius: BorderRadius.circular(6),
              ),
              alignment: Alignment.center,
              child: Text('★', style: TextStyle(color: AppColors.coral, fontSize: cell * 1.6)),
            ),
          ),
          // Tokens
          for (int player = 0; player < 2; player++)
            for (int t = 0; t < 4; t++)
              _tokenWidget(player, t, cell),
        ]),
      );
    });
  }

  Widget _tokenWidget(int player, int t, double cell) {
    final p = pos[player][t];
    final pt = p == -1 ? _basePoint(player, t, cell) : _pointFor(player, p, cell);
    final r = cell * 0.35;
    final color = player == 0 ? AppColors.coral : AppColors.petal;
    final tappable = player == myIndex && canMoveToken(t);
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutBack,
      left: pt.dx - r, top: pt.dy - r,
      width: r * 2, height: r * 2,
      child: GestureDetector(
        onTap: player == myIndex ? () => onTapToken(t) : null,
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            border: Border.all(
              color: tappable ? Colors.white : Colors.black26,
              width: tappable ? 2 : 1,
            ),
            boxShadow: tappable
                ? [BoxShadow(color: color.withOpacity(0.7), blurRadius: 10, spreadRadius: 1)]
                : null,
          ),
          alignment: Alignment.center,
          child: Text('${t + 1}',
              style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
        ).animate(target: tappable ? 1 : 0).scale(begin: const Offset(1,1), end: const Offset(1.1,1.1)),
      ),
    );
  }
}

class _BaseCorner extends StatelessWidget {
  final Offset topLeft;
  final double size;
  final Color color;
  const _BaseCorner({required this.topLeft, required this.size, required this.color});
  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: topLeft.dx, top: topLeft.dy, width: size, height: size,
      child: Container(
        decoration: BoxDecoration(
          color: color,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(6),
        ),
      ),
    );
  }
}
