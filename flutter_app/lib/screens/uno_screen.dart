import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Compact 2-player Uno. Cards encoded as `<color><value>`:
///   colors: R/G/B/Y (red/green/blue/yellow) or W (wild)
///   values: 0-9, S (skip), V (reverse — acts as skip in 2p), D (draw two), F (wild draw four)
class UnoScreen extends ConsumerStatefulWidget {
  const UnoScreen({super.key});
  @override
  ConsumerState<UnoScreen> createState() => _UnoScreenState();
}

class _UnoScreenState extends ConsumerState<UnoScreen> {
  final _rng = math.Random();
  List<String> _deck = [];
  List<String> _discard = [];
  final _hands = [<String>[], <String>[]];
  int _turn = 0;
  int _myIndex = 0;
  String _wildColor = '';
  String? _winner;
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
    final key = 'uno:${ids[0]}:${ids[1]}';
    final ch = supa.channel(key, opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'state', callback: (p) {
      if (p['from'] == me.id) return;
      _applyState(p);
    });
    ch.subscribe();
    _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
    _channel = ch;
    if (_myIndex == 0) {
      _newGame();
      _broadcast();
    } else {
      setState(() => _status = 'Waiting for host to deal…');
    }
  }

  void _newGame() {
    _deck = _buildDeck()..shuffle(_rng);
    _hands[0].clear(); _hands[1].clear();
    for (var i = 0; i < 7; i++) {
      _hands[0].add(_deck.removeLast());
      _hands[1].add(_deck.removeLast());
    }
    // First discard: pop until non-wild-draw-four
    while (true) {
      final c = _deck.removeLast();
      if (!c.endsWith('F')) { _discard = [c]; break; }
      _deck.insert(0, c);
    }
    _wildColor = _discard.last[0] == 'W' ? 'R' : _discard.last[0];
    _turn = 0;
    _winner = null;
    _updateStatus();
  }

  List<String> _buildDeck() {
    final d = <String>[];
    for (final c in ['R', 'G', 'B', 'Y']) {
      d.add('${c}0');
      for (var v = 1; v <= 9; v++) { d.add('$c$v'); d.add('$c$v'); }
      for (final a in ['S', 'V', 'D']) { d.add('$c$a'); d.add('$c$a'); }
    }
    for (var i = 0; i < 4; i++) { d.add('W_'); d.add('WF'); }
    return d;
  }

  void _updateStatus() {
    if (_winner != null) {
      _status = _winner == 'you' ? 'Victory' : '$_partnerName wins';
      return;
    }
    _status = _turn == _myIndex ? 'Your turn' : '$_partnerName plays…';
  }

  void _broadcast() {
    final me = ref.read(currentUserProvider);
    _channel?.sendBroadcastMessage(event: 'state', payload: {
      'from': me?.id,
      'deck': _deck, 'discard': _discard,
      'h0': _hands[0], 'h1': _hands[1],
      'turn': _turn, 'wild': _wildColor, 'winner': _winner,
    });
  }

  void _applyState(Map p) {
    setState(() {
      _deck = List<String>.from(p['deck']);
      _discard = List<String>.from(p['discard']);
      _hands[0] = List<String>.from(p['h0']);
      _hands[1] = List<String>.from(p['h1']);
      _turn = p['turn'] as int;
      _wildColor = p['wild'] as String;
      _winner = p['winner'] as String?;
      _updateStatus();
    });
  }

  bool _canPlay(String card) {
    if (_discard.isEmpty) return true;
    final top = _discard.last;
    if (card[0] == 'W') return true;
    // Match color or value
    final activeColor = top[0] == 'W' ? _wildColor : top[0];
    if (card[0] == activeColor) return true;
    if (card[1] == top[1] && top[0] != 'W') return true;
    return false;
  }

  Future<void> _play(int cardIdx) async {
    if (_turn != _myIndex || _winner != null) return;
    final card = _hands[_myIndex][cardIdx];
    if (!_canPlay(card)) return;

    _hands[_myIndex].removeAt(cardIdx);
    _discard.add(card);
    if (card[0] == 'W') {
      // Pick color via dialog
      final chosen = await _pickColor();
      if (chosen == null) {
        _hands[_myIndex].insert(cardIdx, _discard.removeLast());
        return;
      }
      _wildColor = chosen;
    } else {
      _wildColor = card[0];
    }

    // Win?
    if (_hands[_myIndex].isEmpty) {
      _winner = 'you';
      _broadcast();
      // Flip for peer
      setState(() {}); _updateStatus();
      return;
    }

    // Effects
    var skipNext = false;
    final val = card[1];
    if (val == 'S' || val == 'V') skipNext = true;
    if (val == 'D') { _drawFor(1 - _myIndex, 2); skipNext = true; }
    if (val == 'F') { _drawFor(1 - _myIndex, 4); skipNext = true; }

    _turn = skipNext ? _myIndex : 1 - _myIndex;
    _updateStatus();
    _broadcast();
    setState(() {});
  }

  Future<String?> _pickColor() async {
    return showDialog<String>(context: context, builder: (_) => AlertDialog(
      backgroundColor: AppColors.surface,
      title: const Text('Pick a color'),
      content: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final c in ['R', 'G', 'B', 'Y'])
          Padding(
            padding: const EdgeInsets.all(6),
            child: GestureDetector(
              onTap: () => Navigator.pop(context, c),
              child: Container(width: 44, height: 44, decoration: BoxDecoration(
                color: _colorOf(c), shape: BoxShape.circle,
                border: Border.all(color: Colors.white24),
              )),
            ),
          ),
      ]),
    ));
  }

  void _drawFor(int player, int n) {
    for (var i = 0; i < n; i++) {
      if (_deck.isEmpty) _reshuffle();
      if (_deck.isEmpty) return;
      _hands[player].add(_deck.removeLast());
    }
  }

  void _reshuffle() {
    if (_discard.length < 2) return;
    final top = _discard.removeLast();
    _deck = List<String>.from(_discard)..shuffle(_rng);
    _discard = [top];
  }

  void _draw() {
    if (_turn != _myIndex || _winner != null) return;
    if (_deck.isEmpty) _reshuffle();
    if (_deck.isEmpty) return;
    final c = _deck.removeLast();
    _hands[_myIndex].add(c);
    _turn = 1 - _myIndex;
    _updateStatus();
    _broadcast();
    setState(() {});
  }

  Color _colorOf(String code) => switch (code) {
    'R' => const Color(0xFFEF4444),
    'G' => const Color(0xFF22C55E),
    'B' => const Color(0xFF3B82F6),
    'Y' => const Color(0xFFEAB308),
    _   => AppColors.wine,
  };

  @override
  void dispose() {
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = _discard.isNotEmpty ? _discard.last : null;
    final myHand = _hands[_myIndex];
    final theirHand = _hands[1 - _myIndex];
    return Scaffold(
      appBar: AppBar(title: const Text('Uno'), actions: [
        if (_myIndex == 0)
          IconButton(icon: const Icon(Icons.refresh), onPressed: () { _newGame(); _broadcast(); setState((){}); }),
      ]),
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
            child: Column(children: [
              Text('Chapter · Uno', style: eyebrow()),
              const SizedBox(height: 4),
              Text(_status, style: serifItalic(size: 22)),
            ]),
          ),
          // Opponent hand (backs)
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: theirHand.length,
              separatorBuilder: (_, __) => const SizedBox(width: 4),
              itemBuilder: (_, __) => _cardBack(),
            ),
          ),
          const SizedBox(height: 8),
          // Table: draw pile + discard
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            GestureDetector(
              onTap: _draw,
              child: _cardBack(width: 60, height: 88, label: '${_deck.length}'),
            ),
            const SizedBox(width: 20),
            if (top != null) _CardView(code: top, width: 60, height: 88, activeColor: top[0] == 'W' ? _wildColor : null),
          ]),
          const SizedBox(height: 12),
          if (_wildColor.isNotEmpty && top != null && top[0] == 'W')
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Text('Active color: ', style: TextStyle(color: AppColors.candleMuted)),
              Container(width: 14, height: 14, decoration: BoxDecoration(shape: BoxShape.circle, color: _colorOf(_wildColor))),
            ]),
          const Spacer(),
          // My hand
          SizedBox(
            height: 130,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: myHand.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final playable = _turn == _myIndex && _canPlay(myHand[i]);
                return GestureDetector(
                  onTap: playable ? () => _play(i) : null,
                  child: Opacity(
                    opacity: playable ? 1 : 0.55,
                    child: _CardView(code: myHand[i], width: 74, height: 110, glow: playable),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

  Widget _cardBack({double width = 40, double height = 56, String? label}) {
    return Container(
      width: width, height: height,
      decoration: BoxDecoration(
        color: AppColors.wine,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.coral),
      ),
      alignment: Alignment.center,
      child: Text(label ?? '★', style: TextStyle(color: AppColors.coral, fontSize: label != null ? 14 : 20)),
    );
  }
}

class _CardView extends StatelessWidget {
  final String code;
  final double width, height;
  final bool glow;
  final String? activeColor;
  const _CardView({required this.code, required this.width, required this.height, this.glow = false, this.activeColor});
  @override
  Widget build(BuildContext context) {
    final color = code[0] == 'W' ? _wildBase() : _colorOf(code[0]);
    final label = _labelOf(code[1]);
    return Container(
      width: width, height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: glow ? Colors.white : Colors.black26, width: glow ? 2 : 1),
        boxShadow: glow ? [BoxShadow(color: color.withOpacity(0.6), blurRadius: 10)] : null,
      ),
      alignment: Alignment.center,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(label, style: TextStyle(color: Colors.white, fontSize: height * 0.28, fontWeight: FontWeight.w800)),
        if (activeColor != null) ...[
          const SizedBox(height: 6),
          Container(width: 12, height: 12, decoration: BoxDecoration(shape: BoxShape.circle, color: _colorOf(activeColor!))),
        ],
      ]),
    );
  }

  static String _labelOf(String v) => switch (v) {
    'S' => '⊘', 'V' => '⇄', 'D' => '+2', 'F' => '+4', '_' => 'W', _ => v,
  };
  static Color _colorOf(String c) => switch (c) {
    'R' => const Color(0xFFEF4444),
    'G' => const Color(0xFF22C55E),
    'B' => const Color(0xFF3B82F6),
    'Y' => const Color(0xFFEAB308),
    _ => AppColors.wine,
  };
  static Color _wildBase() => const Color(0xFF2A1230);
}
