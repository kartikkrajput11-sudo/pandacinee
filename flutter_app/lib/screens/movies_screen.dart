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
          onTap: () => ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Open ${m.title} from a partner invite to sync.')),
          ),
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

/// Watch Party sync UI moved to watch_party_screen.dart.
