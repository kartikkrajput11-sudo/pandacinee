import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Affections launcher. Six gestures, all render a full-screen panda-emoji
/// card overlay both for the sender and (via broadcast) the receiver.
class AffectionsScreen extends ConsumerStatefulWidget {
  const AffectionsScreen({super.key});
  @override
  ConsumerState<AffectionsScreen> createState() => _AffectionsScreenState();
}

class _AffectionsScreenState extends ConsumerState<AffectionsScreen> {
  RealtimeChannel? _channel;
  String _partnerName = 'Partner';
  String? _partnerId;
  _Overlay? _active;

  static const _gestures = <_Gesture>[
    _Gesture('kiss', 'Kiss', '💋', AppColors.coral, 'A soft imprint at the center of the room'),
    _Gesture('hug', 'Hug', '🐼', AppColors.petal, 'Panda closes its arms around you'),
    _Gesture('headpat', 'Headpat', '🫳', Color(0xFFE6B980), 'Gentle little taps'),
    _Gesture('handhold', 'Handhold', '🤝', Color(0xFFB89EFF), 'Fingers laced'),
    _Gesture('boop', 'Boop', '👉', Color(0xFF9AD1AA), 'A tiny nose-tap'),
    _Gesture('nudge', 'Nudge', '✨', Color(0xFFF6C177), 'A shimmer of attention'),
  ];

  @override
  void initState() { super.initState(); _bootstrap(); }

  Future<void> _bootstrap() async {
    final supa = ref.read(supabaseProvider);
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final row = await supa.from('profiles').select('partner_id').eq('id', me.id).maybeSingle();
    final partnerId = row?['partner_id'] as String?;
    if (partnerId == null) return;
    final partner = await supa.from('profiles').select('display_name, username').eq('id', partnerId).maybeSingle();
    final ids = [me.id, partnerId]..sort();
    final ch = supa.channel('affection:${ids[0]}:${ids[1]}',
        opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'affection', callback: (p) {
      if (p['from'] == me.id) return;
      final id = p['id'] as String;
      final g = _gestures.firstWhere((x) => x.id == id, orElse: () => _gestures.first);
      _play(g, incoming: true);
    });
    ch.subscribe();
    setState(() {
      _channel = ch;
      _partnerId = partnerId;
      _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
    });
  }

  void _play(_Gesture g, {bool incoming = false}) {
    setState(() => _active = _Overlay(g, incoming: incoming));
    Future.delayed(const Duration(milliseconds: 2600), () {
      if (mounted) setState(() => _active = null);
    });
  }

  void _send(_Gesture g) {
    if (_partnerId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Link a partner to send affections.')),
      );
      return;
    }
    final me = ref.read(currentUserProvider);
    _channel?.sendBroadcastMessage(event: 'affection', payload: {
      'from': me?.id, 'id': g.id,
    });
    _play(g, incoming: false);
  }

  @override
  void dispose() {
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Affections')),
      body: Stack(children: [
        SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              Text('Chapter · Tender', style: eyebrow()),
              const SizedBox(height: 6),
              Text('Send something to $_partnerName',
                  style: serifItalic(size: 28)),
              const SizedBox(height: 6),
              const Text('Each gesture arrives as a full-screen animation.',
                  style: TextStyle(color: AppColors.candleMuted)),
              const SizedBox(height: 20),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.1,
                ),
                itemCount: _gestures.length,
                itemBuilder: (_, i) => _GestureTile(
                  gesture: _gestures[i], onTap: () => _send(_gestures[i]),
                ),
              ),
            ],
          ),
        ),
        if (_active != null) _OverlayLayer(overlay: _active!, partnerName: _partnerName),
      ]),
    );
  }
}

class _Gesture {
  final String id, label, emoji, tagline;
  final Color color;
  const _Gesture(this.id, this.label, this.emoji, this.color, this.tagline);
}

class _GestureTile extends StatelessWidget {
  final _Gesture gesture;
  final VoidCallback onTap;
  const _GestureTile({required this.gesture, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: gesture.color.withOpacity(0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(gesture.emoji, style: const TextStyle(fontSize: 40)),
              const Spacer(),
              Text(gesture.label, style: serifItalic(size: 20)),
              const SizedBox(height: 2),
              Text(gesture.tagline,
                  style: const TextStyle(color: AppColors.candleMuted, fontSize: 11),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}

class _Overlay {
  final _Gesture gesture;
  final bool incoming;
  _Overlay(this.gesture, {required this.incoming});
}

class _OverlayLayer extends StatelessWidget {
  final _Overlay overlay;
  final String partnerName;
  const _OverlayLayer({required this.overlay, required this.partnerName});

  @override
  Widget build(BuildContext context) {
    final g = overlay.gesture;
    return Positioned.fill(
      child: IgnorePointer(
        child: Stack(children: [
          Container(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                colors: [g.color.withOpacity(0.35), Colors.black.withOpacity(0.9)],
                radius: 1.0,
              ),
            ),
          ).animate().fadeIn(duration: 200.ms).fadeOut(delay: 2200.ms, duration: 400.ms),
          ..._particles(g),
          Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(overlay.incoming ? 'From $partnerName' : 'Sent',
                  style: eyebrow(color: g.color)),
              const SizedBox(height: 12),
              Text(g.emoji, style: const TextStyle(fontSize: 140))
                  .animate()
                  .scale(begin: const Offset(0.2, 0.2), curve: Curves.elasticOut, duration: 700.ms)
                  .then(delay: 1200.ms)
                  .scale(end: const Offset(1.3, 1.3), duration: 500.ms)
                  .fadeOut(duration: 500.ms),
              const SizedBox(height: 8),
              Text(g.label, style: serifItalic(size: 34, color: g.color))
                  .animate().fadeIn(delay: 300.ms).slideY(begin: 0.4),
            ]),
          ),
        ]),
      ),
    );
  }

  List<Widget> _particles(_Gesture g) {
    final rnd = math.Random(g.id.hashCode);
    return List.generate(12, (i) {
      final dx = (rnd.nextDouble() - 0.5) * 320;
      final dy = (rnd.nextDouble() - 0.5) * 480;
      final delay = (rnd.nextInt(600)).toDouble();
      return Center(
        child: Transform.translate(
          offset: Offset(dx, dy),
          child: Text(g.emoji, style: const TextStyle(fontSize: 24))
              .animate()
              .fadeIn(delay: Duration(milliseconds: delay.toInt()), duration: 300.ms)
              .then()
              .moveY(end: -60, duration: 1600.ms, curve: Curves.easeOut)
              .fadeOut(duration: 800.ms),
        ),
      );
    });
  }
}
