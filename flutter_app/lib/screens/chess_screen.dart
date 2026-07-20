import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../games/chess_engine.dart';
import '../supabase_providers.dart';
import '../theme.dart';

class ChessScreen extends ConsumerStatefulWidget {
  const ChessScreen({super.key});
  @override
  ConsumerState<ChessScreen> createState() => _ChessScreenState();
}

class _ChessScreenState extends ConsumerState<ChessScreen> {
  ChessState _state = ChessState.initial();
  Sq? _selected;
  List<Sq> _legal = const [];
  PieceColor? _myColor; // set when we join the room
  String? _partnerName;
  RealtimeChannel? _channel;

  // Capture animation state
  _CaptureAnim? _capture;
  String _status = 'Loading…';
  bool _gameOver = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final supa = ref.read(supabaseProvider);
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final row = await supa
        .from('profiles')
        .select('partner_id')
        .eq('id', me.id)
        .maybeSingle();
    final partnerId = row?['partner_id'] as String?;
    if (partnerId == null) {
      setState(() => _status = 'Link a partner to play.');
      return;
    }
    final partner = await supa
        .from('profiles')
        .select('display_name, username')
        .eq('id', partnerId)
        .maybeSingle();
    final ids = [me.id, partnerId]..sort();
    // Deterministic color assignment — lower id plays white.
    final myColor = ids[0] == me.id ? PieceColor.white : PieceColor.black;
    final key = 'chess:${ids[0]}:${ids[1]}';

    final ch = supa.channel(key, opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'move', callback: (payload) {
      final from = payload['from'] as String?;
      if (from == me.id) return;
      _applyRemote(payload);
    });
    ch.subscribe();

    setState(() {
      _myColor = myColor;
      _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
      _channel = ch;
      _status = myColor == PieceColor.white ? 'Your move' : 'Waiting for opponent…';
    });
  }

  void _applyRemote(Map payload) {
    final from = Sq(payload['fr'] as int, payload['ff'] as int);
    final to = Sq(payload['tr'] as int, payload['tf'] as int);
    _doMove(from, to, broadcast: false);
  }

  void _doMove(Sq from, Sq to, {required bool broadcast}) {
    final moving = _state.at(from);
    if (moving == null) return;
    final result = _state.move(from, to);
    // Trigger capture animation before committing final state visually.
    if (result.captured != null) {
      setState(() {
        _capture = _CaptureAnim(
          attacker: moving,
          victim: result.captured!,
          from: from,
          to: to,
        );
      });
      Timer(const Duration(milliseconds: 3000), () {
        if (mounted) setState(() => _capture = null);
      });
    }
    setState(() {
      _state = result.next;
      _selected = null;
      _legal = const [];
    });
    _updateStatus();

    if (broadcast && _channel != null) {
      final me = ref.read(currentUserProvider);
      _channel!.sendBroadcastMessage(event: 'move', payload: {
        'from': me?.id,
        'fr': from.r,
        'ff': from.f,
        'tr': to.r,
        'tf': to.f,
      });
    }
  }

  void _updateStatus() {
    final side = _state.toMove;
    final hasMoves = _state.hasAnyLegalMove(side);
    final inCheck = _state.inCheck(side);
    if (!hasMoves) {
      _gameOver = true;
      _status = inCheck ? 'Checkmate' : 'Stalemate';
      return;
    }
    final mine = side == _myColor;
    _status = (inCheck ? 'Check · ' : '') +
        (mine ? 'Your move' : '$_partnerName to move');
  }

  void _tap(Sq s) {
    if (_gameOver) return;
    if (_myColor == null || _state.toMove != _myColor) return;
    final piece = _state.at(s);
    if (_selected == null) {
      if (piece != null && piece.color == _myColor) {
        setState(() {
          _selected = s;
          _legal = _state.legalMoves(s);
        });
      }
      return;
    }
    if (_selected == s) {
      setState(() { _selected = null; _legal = const []; });
      return;
    }
    if (_legal.contains(s)) {
      _doMove(_selected!, s, broadcast: true);
    } else if (piece != null && piece.color == _myColor) {
      setState(() {
        _selected = s;
        _legal = _state.legalMoves(s);
      });
    }
  }

  @override
  void dispose() {
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Flip board so my pieces are on the bottom.
    final flip = _myColor == PieceColor.black;
    return Scaffold(
      appBar: AppBar(title: const Text('Chess')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Column(children: [
                Text('Chapter · Duel', style: eyebrow()),
                const SizedBox(height: 6),
                Text(_status, style: serifItalic(size: 22), textAlign: TextAlign.center),
              ]),
            ),
            Expanded(
              child: Center(
                child: LayoutBuilder(builder: (context, c) {
                  final side = math.min(c.maxWidth, c.maxHeight) - 12;
                  return SizedBox(
                    width: side, height: side,
                    child: _Board(
                      state: _state,
                      flip: flip,
                      selected: _selected,
                      legal: _legal,
                      capture: _capture,
                      onTap: _tap,
                    ),
                  );
                }),
              ),
            ),
            if (_gameOver)
              Padding(
                padding: const EdgeInsets.only(bottom: 20, top: 8),
                child: FilledButton(
                  onPressed: () => setState(() {
                    _state = ChessState.initial();
                    _selected = null;
                    _legal = const [];
                    _capture = null;
                    _gameOver = false;
                    _updateStatus();
                  }),
                  child: const Text('New game'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CaptureAnim {
  final Piece attacker;
  final Piece victim;
  final Sq from;
  final Sq to;
  _CaptureAnim({required this.attacker, required this.victim, required this.from, required this.to});
}

class _Board extends StatelessWidget {
  final ChessState state;
  final bool flip;
  final Sq? selected;
  final List<Sq> legal;
  final _CaptureAnim? capture;
  final void Function(Sq) onTap;
  const _Board({
    required this.state,
    required this.flip,
    required this.selected,
    required this.legal,
    required this.capture,
    required this.onTap,
  });

  Sq _display(int row, int col) {
    // row 0 at top on screen. If not flipped, top row = rank 7 (black back).
    final r = flip ? row : 7 - row;
    final f = flip ? 7 - col : col;
    return Sq(r, f);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.coral, width: 1.4),
        borderRadius: BorderRadius.circular(6),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: LayoutBuilder(builder: (context, c) {
          final cell = c.maxWidth / 8;
          return Stack(children: [
            Column(
              children: List.generate(8, (row) {
                return Expanded(
                  child: Row(
                    children: List.generate(8, (col) {
                      final s = _display(row, col);
                      final piece = state.at(s);
                      final light = (row + col) % 2 == 0;
                      final isSel = selected == s;
                      final isTarget = legal.contains(s);
                      // Hide piece being animated (attacker at destination, victim being dragged)
                      final hidePiece = capture != null &&
                          (s == capture!.to && piece != null);
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => onTap(s),
                          child: Container(
                            decoration: BoxDecoration(
                              color: light
                                  ? const Color(0xFF3A2A3E)
                                  : const Color(0xFF1A1220),
                              border: isSel
                                  ? Border.all(color: AppColors.coral, width: 2)
                                  : null,
                            ),
                            alignment: Alignment.center,
                            child: Stack(alignment: Alignment.center, children: [
                              if (isTarget)
                                Container(
                                  width: cell * 0.35,
                                  height: cell * 0.35,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.coral.withOpacity(0.35),
                                  ),
                                ),
                              if (piece != null && !hidePiece)
                                Text(
                                  piece.glyph,
                                  style: TextStyle(
                                    fontSize: cell * 0.72,
                                    color: piece.color == PieceColor.white
                                        ? const Color(0xFFF6EEDF)
                                        : const Color(0xFF0F0812),
                                    shadows: const [
                                      Shadow(color: Colors.black45, blurRadius: 4),
                                    ],
                                  ),
                                ),
                            ]),
                          ),
                        ),
                      );
                    }),
                  ),
                );
              }),
            ),
            if (capture != null) _CaptureLayer(capture: capture!, flip: flip, cell: cell),
          ]);
        }),
      ),
    );
  }
}

class _CaptureLayer extends StatelessWidget {
  final _CaptureAnim capture;
  final bool flip;
  final double cell;
  const _CaptureLayer({required this.capture, required this.flip, required this.cell});

  Offset _pos(Sq s) {
    final col = flip ? 7 - s.f : s.f;
    final row = flip ? s.r : 7 - s.r;
    return Offset(col * cell, row * cell);
  }

  @override
  Widget build(BuildContext context) {
    final start = _pos(capture.from);
    final end = _pos(capture.to);
    // Drag path: victim starts at destination and slides slightly past it
    final beyond = Offset(end.dx + (end.dx - start.dx) * 0.35,
        end.dy + (end.dy - start.dy) * 0.35);

    return IgnorePointer(
      child: SizedBox.expand(
        child: Stack(children: [
          // Blood dots trail
          ...List.generate(9, (i) {
            final t = i / 8;
            final p = Offset.lerp(end, beyond, t)!;
            final r = 3.0 + math.Random(i).nextDouble() * 3.0;
            return Positioned(
              left: p.dx + cell / 2 - r,
              top: p.dy + cell / 2 - r,
              child: Container(
                width: r * 2, height: r * 2,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xCC5C0A17), // oxblood
                ),
              ).animate().fadeIn(delay: (i * 120).ms, duration: 200.ms)
                  .fadeOut(delay: (1800 + i * 60).ms, duration: 700.ms),
            );
          }),
          // Attacker slides to destination
          Positioned(
            left: start.dx, top: start.dy,
            width: cell, height: cell,
            child: Text(
              capture.attacker.glyph,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: cell * 0.72,
                color: capture.attacker.color == PieceColor.white
                    ? const Color(0xFFF6EEDF) : const Color(0xFF0F0812),
                shadows: const [Shadow(color: Colors.black45, blurRadius: 4)],
              ),
            ).animate().moveX(begin: 0, end: end.dx - start.dx, duration: 500.ms)
                .moveY(begin: 0, end: end.dy - start.dy, duration: 500.ms),
          ),
          // Victim dragged past destination
          Positioned(
            left: end.dx, top: end.dy,
            width: cell, height: cell,
            child: Text(
              capture.victim.glyph,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: cell * 0.72,
                color: capture.victim.color == PieceColor.white
                    ? const Color(0xFFF6EEDF) : const Color(0xFF0F0812),
                shadows: const [Shadow(color: Colors.black45, blurRadius: 4)],
              ),
            ).animate()
                .moveX(begin: 0, end: beyond.dx - end.dx, delay: 350.ms, duration: 900.ms)
                .moveY(begin: 0, end: beyond.dy - end.dy, delay: 350.ms, duration: 900.ms)
                .fadeOut(delay: 1200.ms, duration: 700.ms),
          ),
        ]),
      ),
    );
  }
}
