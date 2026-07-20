import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Simplified turn-based 8-Ball Pool. Cue ball + 8 object balls.
/// Aim with drag, power with slider on the left, tap "Strike" to shoot.
/// Physics steps locally until all balls stop, then broadcast new state + turn.
class PoolScreen extends ConsumerStatefulWidget {
  const PoolScreen({super.key});
  @override
  ConsumerState<PoolScreen> createState() => _PoolScreenState();
}

class _Ball {
  double x, y, vx = 0, vy = 0;
  final int id;
  final Color color;
  bool pocketed = false;
  _Ball(this.id, this.x, this.y, this.color);
}

class _PoolScreenState extends ConsumerState<PoolScreen> with SingleTickerProviderStateMixin {
  static const _W = 400.0;
  static const _H = 220.0;
  static const _R = 8.0;
  late List<_Ball> _balls;
  Offset _aim = const Offset(1, 0);
  double _power = 0.35;
  int _turn = 0;
  int _myIndex = 0;
  String _partnerName = 'Partner';
  String _status = 'Loading…';
  bool _simulating = false;
  int? _winner;
  RealtimeChannel? _channel;
  Ticker? _ticker;
  Duration _last = Duration.zero;

  @override
  void initState() {
    super.initState();
    _balls = _rack();
    _ticker = createTicker(_tick);
    _bootstrap();
  }

  List<_Ball> _rack() {
    final list = <_Ball>[];
    list.add(_Ball(0, _W * 0.25, _H / 2, Colors.white));
    // 8 object balls in a triangle
    const rows = [1, 2, 3];
    var id = 1;
    final palette = [
      Colors.yellow.shade600, Colors.blue.shade600, Colors.red.shade600, Colors.purple.shade400,
      Colors.orange.shade600, Colors.green.shade700, Colors.brown.shade600,
      Colors.black,
    ];
    final startX = _W * 0.72;
    for (var i = 0; i < rows.length; i++) {
      final n = rows[i];
      final x = startX + i * (_R * 2 * 0.87);
      for (var j = 0; j < n; j++) {
        final y = _H / 2 + (j - (n - 1) / 2) * _R * 2;
        list.add(_Ball(id, x, y, palette[(id - 1) % palette.length]));
        id++;
      }
    }
    return list;
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
    final key = 'pool:${ids[0]}:${ids[1]}';
    final ch = supa.channel(key, opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'state', callback: (p) {
      if (p['from'] == me.id) return;
      _applyState(p);
    });
    ch.subscribe();
    _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
    _channel = ch;
    _updateStatus();
    setState(() {});
  }

  void _updateStatus() {
    if (_winner != null) { _status = _winner == _myIndex ? 'Victory' : '$_partnerName wins'; return; }
    if (_simulating) { _status = 'Balls in motion…'; return; }
    _status = _turn == _myIndex ? 'Your shot' : '$_partnerName is aiming…';
  }

  void _applyState(Map p) {
    final list = (p['balls'] as List).cast<Map>();
    setState(() {
      for (var i = 0; i < list.length && i < _balls.length; i++) {
        _balls[i].x = (list[i]['x'] as num).toDouble();
        _balls[i].y = (list[i]['y'] as num).toDouble();
        _balls[i].vx = 0; _balls[i].vy = 0;
        _balls[i].pocketed = list[i]['out'] == true;
      }
      _turn = p['turn'] as int;
      _winner = p['winner'] as int?;
      _updateStatus();
    });
  }

  void _broadcast() {
    final me = ref.read(currentUserProvider);
    _channel?.sendBroadcastMessage(event: 'state', payload: {
      'from': me?.id,
      'balls': _balls.map((b) => {'x': b.x, 'y': b.y, 'out': b.pocketed}).toList(),
      'turn': _turn,
      'winner': _winner,
    });
  }

  void _tick(Duration elapsed) {
    if (_last == Duration.zero) { _last = elapsed; return; }
    final dt = (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    if (!_simulating) return;

    for (var s = 0; s < 4; s++) {
      _step(dt / 4);
    }
    // Stop when all velocities small
    final moving = _balls.any((b) => !b.pocketed && (b.vx.abs() + b.vy.abs()) > 4);
    if (!moving) {
      for (final b in _balls) { b.vx = 0; b.vy = 0; }
      _endShot();
    }
    setState(() {});
  }

  void _step(double dt) {
    const friction = 0.6; // per second
    for (final b in _balls) {
      if (b.pocketed) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Friction
      final speed = math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > 0) {
        final decel = friction * dt * 120;
        final ns = math.max(0.0, speed - decel);
        final k = ns / speed;
        b.vx *= k; b.vy *= k;
      }
      // Walls
      if (b.x < _R) { b.x = _R; b.vx = -b.vx * 0.85; }
      if (b.x > _W - _R) { b.x = _W - _R; b.vx = -b.vx * 0.85; }
      if (b.y < _R) { b.y = _R; b.vy = -b.vy * 0.85; }
      if (b.y > _H - _R) { b.y = _H - _R; b.vy = -b.vy * 0.85; }
      // Pockets (corners + mid-long sides)
      for (final pk in _pockets) {
        final dx = b.x - pk.dx, dy = b.y - pk.dy;
        if (dx * dx + dy * dy < 14 * 14) {
          b.pocketed = true;
          b.vx = 0; b.vy = 0;
          if (b.id == 0) {
            // Cue scratch — re-spot
            b.pocketed = false;
            b.x = _W * 0.25; b.y = _H / 2;
          } else if (b.id == 8) {
            // 8-ball pocketed — end game
            _winner = _turn == 0 ? 1 : 0; // simplification: pocketing 8 ends game against you
          }
          break;
        }
      }
    }
    // Ball-ball collisions (elastic, equal mass)
    for (var i = 0; i < _balls.length; i++) {
      for (var j = i + 1; j < _balls.length; j++) {
        final a = _balls[i], b = _balls[j];
        if (a.pocketed || b.pocketed) continue;
        final dx = b.x - a.x, dy = b.y - a.y;
        final dist2 = dx * dx + dy * dy;
        if (dist2 < (2 * _R) * (2 * _R) && dist2 > 0.0001) {
          final dist = math.sqrt(dist2);
          final nx = dx / dist, ny = dy / dist;
          final overlap = 2 * _R - dist;
          a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
          b.x += nx * overlap / 2; b.y += ny * overlap / 2;
          final va = a.vx * nx + a.vy * ny;
          final vb = b.vx * nx + b.vy * ny;
          final diff = vb - va;
          a.vx += diff * nx; a.vy += diff * ny;
          b.vx -= diff * nx; b.vy -= diff * ny;
        }
      }
    }
  }

  List<Offset> get _pockets => const [
    Offset(0, 0), Offset(_W / 2, 0), Offset(_W, 0),
    Offset(0, _H), Offset(_W / 2, _H), Offset(_W, _H),
  ];

  void _endShot() {
    _simulating = false;
    _ticker?.stop();
    _turn = 1 - _turn;
    _updateStatus();
    _broadcast();
  }

  void _strike() {
    if (_turn != _myIndex || _simulating || _winner != null) return;
    final cue = _balls[0];
    final speed = 500 + _power * 900;
    cue.vx = _aim.dx * speed;
    cue.vy = _aim.dy * speed;
    _simulating = true;
    _last = Duration.zero;
    _ticker?.start();
    _updateStatus();
    setState(() {});
  }

  void _setAimFromDrag(Offset local, Size size) {
    final cue = _balls[0];
    final scale = size.width / _W;
    final cx = cue.x * scale, cy = cue.y * scale;
    final dx = local.dx - cx, dy = local.dy - cy;
    final d = math.sqrt(dx * dx + dy * dy);
    if (d < 4) return;
    setState(() => _aim = Offset(dx / d, dy / d));
  }

  @override
  void dispose() {
    _ticker?.dispose();
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('8-Ball Pool')),
      body: SafeArea(
        child: Column(children: [
          Padding(padding: const EdgeInsets.all(12), child: Column(children: [
            Text('Chapter · Break', style: eyebrow()),
            const SizedBox(height: 4),
            Text(_status, style: serifItalic(size: 22)),
          ])),
          Expanded(
            child: Row(children: [
              // Power slider
              Container(
                width: 48, margin: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.border),
                ),
                child: RotatedBox(
                  quarterTurns: 3,
                  child: Slider(
                    value: _power, min: 0.05, max: 1,
                    activeColor: AppColors.coral,
                    onChanged: _turn == _myIndex && !_simulating
                        ? (v) => setState(() => _power = v) : null,
                  ),
                ),
              ),
              // Table
              Expanded(child: LayoutBuilder(builder: (_, c) {
                final ratio = _W / _H;
                final w = math.min(c.maxWidth, c.maxHeight * ratio);
                final h = w / ratio;
                return Center(
                  child: GestureDetector(
                    onPanUpdate: (d) => _setAimFromDrag(d.localPosition, Size(w, h)),
                    onPanEnd: (_) {},
                    child: CustomPaint(
                      size: Size(w, h),
                      painter: _PoolPainter(balls: _balls, aim: _aim, power: _power, canAim: _turn == _myIndex && !_simulating),
                    ),
                  ),
                );
              })),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              FilledButton(
                onPressed: _turn == _myIndex && !_simulating && _winner == null ? _strike : null,
                child: const Text('Strike'),
              ),
              if (_winner != null) ...[
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: () {
                    setState(() { _balls = _rack(); _winner = null; _turn = 0; });
                    _updateStatus();
                    _broadcast();
                  },
                  child: const Text('Rack again'),
                ),
              ],
            ]),
          ),
        ]),
      ),
    );
  }
}

class _PoolPainter extends CustomPainter {
  final List<_Ball> balls;
  final Offset aim;
  final double power;
  final bool canAim;
  _PoolPainter({required this.balls, required this.aim, required this.power, required this.canAim});

  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / _PoolScreenState._W;
    // Felt
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(14)),
        Paint()..color = const Color(0xFF1E4A2B));
    final rail = Paint()..style = PaintingStyle.stroke..strokeWidth = 4..color = const Color(0xFF5B3320);
    canvas.drawRRect(RRect.fromRectAndRadius(rect.deflate(2), const Radius.circular(12)), rail);
    // Pockets
    for (final pk in const [
      Offset(0, 0), Offset(0.5, 0), Offset(1, 0),
      Offset(0, 1), Offset(0.5, 1), Offset(1, 1),
    ]) {
      canvas.drawCircle(Offset(pk.dx * size.width, pk.dy * size.height), 10,
          Paint()..color = Colors.black);
    }
    // Balls
    for (final b in balls) {
      if (b.pocketed) continue;
      canvas.drawCircle(Offset(b.x * sx, b.y * sx), _PoolScreenState._R * sx,
          Paint()..color = b.color);
      canvas.drawCircle(Offset(b.x * sx, b.y * sx), _PoolScreenState._R * sx,
          Paint()..style = PaintingStyle.stroke..color = Colors.black26..strokeWidth = 1);
    }
    // Aim line + cue stick
    final cue = balls[0];
    if (canAim && !cue.pocketed) {
      final cx = cue.x * sx, cy = cue.y * sx;
      final tip = Offset(cx + aim.dx * 60, cy + aim.dy * 60);
      canvas.drawLine(Offset(cx, cy), tip,
          Paint()..color = Colors.white.withOpacity(0.4)..strokeWidth = 1);
      // Cue stick behind cue ball
      final back = Offset(cx - aim.dx * (30 + power * 40), cy - aim.dy * (30 + power * 40));
      final backEnd = Offset(back.dx - aim.dx * 120, back.dy - aim.dy * 120);
      canvas.drawLine(back, backEnd,
          Paint()..color = const Color(0xFFCFA47A)..strokeWidth = 4..strokeCap = StrokeCap.round);
    }
  }

  @override
  bool shouldRepaint(covariant _PoolPainter old) => true;
}

// Ticker helper
class Ticker {
  final void Function(Duration) onTick;
  Duration _elapsed = Duration.zero;
  bool _active = false;
  Stopwatch? _sw;
  Ticker(this.onTick);
  void start() {
    if (_active) return;
    _active = true;
    _sw = Stopwatch()..start();
    _loop();
  }
  void _loop() async {
    while (_active) {
      await Future.delayed(const Duration(milliseconds: 16));
      if (!_active) return;
      _elapsed = _sw!.elapsed;
      onTick(_elapsed);
    }
  }
  void stop() { _active = false; }
  void dispose() { _active = false; }
}

extension on State {
  Ticker createTicker(void Function(Duration) onTick) => Ticker(onTick);
}
