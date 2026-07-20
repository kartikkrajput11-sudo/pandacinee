import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Movies — curated list + a "Watch Party" lobby that syncs a shared playhead
/// value over Supabase Realtime. Actual video playback surface is a stub that
/// renders the shared clock; wire a `video_player` or `webview_flutter` widget
/// here to play alongside the sync layer.
class MoviesScreen extends ConsumerWidget {
  const MoviesScreen({super.key});

  static const _catalog = <_Movie>[
    _Movie('vel-01', 'The Aubergine Hour', 'A slow-burn romance in Kyoto', '1h 48m'),
    _Movie('vel-02', 'Coral & Candlelight', 'Two strangers, one endless night', '2h 06m'),
    _Movie('vel-03', 'Panda in the Rain', 'A tender animated short', '42m'),
    _Movie('vel-04', 'Velvet Room', 'Neon-noir dream diary', '1h 33m'),
    _Movie('vel-05', 'Instrument of Us', 'A duet across time zones', '1h 55m'),
    _Movie('vel-06', 'Lockstep', 'Sci-fi love with a countdown', '2h 12m'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Movies')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          Text('Chapter · Together', style: eyebrow()),
          const SizedBox(height: 6),
          Text('Watch in lock-step', style: serifItalic(size: 32)),
          const SizedBox(height: 6),
          const Text(
            'Pick a title. Your partner joins the same velvet room and the playhead stays synced within a second.',
            style: TextStyle(color: AppColors.candleMuted),
          ),
          const SizedBox(height: 20),
          for (final m in _catalog) _card(context, m),
        ],
      ),
    );
  }

  Widget _card(BuildContext context, _Movie m) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => Navigator.push(context, MaterialPageRoute(
            builder: (_) => WatchPartyScreen(movie: m),
          )),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(children: [
              Container(
                width: 74, height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.wine, Color(0xFF2A1230)],
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.coral.withOpacity(0.4)),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.movie_outlined, color: AppColors.coral),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(m.title, style: serifItalic(size: 20)),
                  const SizedBox(height: 4),
                  Text(m.tagline, style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.coral.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: AppColors.coral.withOpacity(0.5)),
                      ),
                      child: Text(m.runtime, style: const TextStyle(fontSize: 10, color: AppColors.coral, fontWeight: FontWeight.w700)),
                    ),
                  ]),
                ],
              )),
              const Icon(Icons.arrow_forward, color: AppColors.petal, size: 18),
            ]),
          ),
        ),
      ),
    );
  }
}

class _Movie {
  final String id, title, tagline, runtime;
  const _Movie(this.id, this.title, this.tagline, this.runtime);
}

/// Watch Party — leader-driven sync. Whichever partner presses Play first
/// becomes host and broadcasts playhead ticks; the follower keeps a soft-sync
/// clock within a 1-second dead-band.
class WatchPartyScreen extends ConsumerStatefulWidget {
  final _Movie movie;
  const WatchPartyScreen({super.key, required this.movie});
  @override
  ConsumerState<WatchPartyScreen> createState() => _WatchPartyScreenState();
}

class _WatchPartyScreenState extends ConsumerState<WatchPartyScreen> {
  RealtimeChannel? _channel;
  Timer? _clock;
  bool _playing = false;
  bool _iAmHost = false;
  double _t = 0; // seconds
  String _partnerName = 'Partner';
  String _status = 'Loading…';

  @override
  void initState() { super.initState(); _bootstrap(); }

  Future<void> _bootstrap() async {
    final supa = ref.read(supabaseProvider);
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final row = await supa.from('profiles').select('partner_id').eq('id', me.id).maybeSingle();
    final partnerId = row?['partner_id'] as String?;
    if (partnerId == null) { setState(() => _status = 'Link a partner to watch together.'); return; }
    final partner = await supa.from('profiles').select('display_name, username').eq('id', partnerId).maybeSingle();
    final ids = [me.id, partnerId]..sort();
    final key = 'movie:${widget.movie.id}:${ids[0]}:${ids[1]}';
    final ch = supa.channel(key, opts: RealtimeChannelConfig(self: false, ack: true));
    ch.onBroadcast(event: 'sync', callback: (p) {
      if (p['from'] == me.id) return;
      _applyRemote(p);
    });
    ch.subscribe();
    _partnerName = partner?['display_name'] ?? partner?['username'] ?? 'Partner';
    _channel = ch;
    _status = 'Ready — press Play to begin';
    setState(() {});
  }

  void _applyRemote(Map p) {
    final host = p['host'] as bool? ?? false;
    if (host && !_iAmHost) {
      // A remote host is broadcasting; we're the follower.
      final rt = (p['t'] as num).toDouble();
      final rPlaying = p['playing'] as bool? ?? false;
      // Soft-sync dead-band ±1.0s
      if ((rt - _t).abs() > 1.0) _t = rt;
      _playing = rPlaying;
      _status = rPlaying ? 'Synced with $_partnerName' : 'Paused by $_partnerName';
      _ensureClock();
      setState(() {});
    } else if (p['event'] == 'pause') {
      _playing = false;
      _status = 'Paused by $_partnerName';
      _ensureClock();
      setState(() {});
    }
  }

  void _ensureClock() {
    _clock?.cancel();
    if (_playing) {
      _clock = Timer.periodic(const Duration(milliseconds: 500), (_) {
        setState(() => _t += 0.5);
        if (_iAmHost) _broadcast();
      });
    }
  }

  void _broadcast() {
    final me = ref.read(currentUserProvider);
    _channel?.sendBroadcastMessage(event: 'sync', payload: {
      'from': me?.id, 'host': _iAmHost, 't': _t, 'playing': _playing,
    });
  }

  void _play() {
    setState(() {
      _iAmHost = true;
      _playing = true;
      _status = 'Hosting · $_partnerName is following';
    });
    _ensureClock();
    _broadcast();
  }

  void _pause() {
    setState(() {
      _playing = false;
      _status = _iAmHost ? 'Paused (you)' : 'Paused (you)';
    });
    _ensureClock();
    _broadcast();
  }

  void _seek(double delta) {
    if (!_iAmHost) return;
    setState(() => _t = (_t + delta).clamp(0, 60 * 60 * 4));
    _broadcast();
  }

  @override
  void dispose() {
    _clock?.cancel();
    if (_channel != null) ref.read(supabaseProvider).removeChannel(_channel!);
    super.dispose();
  }

  String _fmt(double s) {
    final m = (s / 60).floor();
    final ss = (s % 60).floor().toString().padLeft(2, '0');
    final hh = (m / 60).floor();
    final mm = (m % 60).toString().padLeft(2, '0');
    return hh > 0 ? '$hh:$mm:$ss' : '$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.movie.title)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            Text('Chapter · Together', style: eyebrow()),
            const SizedBox(height: 6),
            Text(widget.movie.title, style: serifItalic(size: 26), textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text(widget.movie.tagline,
                style: const TextStyle(color: AppColors.candleMuted), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                alignment: Alignment.center,
                child: _playing
                    ? Text(_fmt(_t), style: serifItalic(size: 40, color: AppColors.coral))
                        .animate(onPlay: (c) => c.repeat()).fadeIn(duration: 800.ms).then().fadeOut()
                    : Text('▶',
                        style: TextStyle(color: AppColors.coral.withOpacity(0.6), fontSize: 60)),
              ),
            ),
            const SizedBox(height: 16),
            Text(_status, style: const TextStyle(color: AppColors.candleMuted)),
            const SizedBox(height: 20),
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              IconButton(
                onPressed: _iAmHost ? () => _seek(-15) : null,
                icon: const Icon(Icons.replay_10, size: 32),
                color: AppColors.coral,
              ),
              FilledButton(
                onPressed: _playing ? _pause : _play,
                child: Text(_playing ? 'Pause' : 'Play together'),
              ),
              IconButton(
                onPressed: _iAmHost ? () => _seek(15) : null,
                icon: const Icon(Icons.forward_10, size: 32),
                color: AppColors.coral,
              ),
            ]),
            const Spacer(),
            Text('Playhead: ${_fmt(_t)}',
                style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
          ]),
        ),
      ),
    );
  }
}
