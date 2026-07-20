import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../theme.dart';

/// Phase 19 — Guided walk-through of the app's signature features.
/// Chapters: Affections, Locked chats, Badges, Movies, Games, Groups.
class TourScreen extends StatefulWidget {
  const TourScreen({super.key});
  @override
  State<TourScreen> createState() => _TourScreenState();
}

class _TourScreenState extends State<TourScreen> {
  int _i = 0;
  final _chapters = const [
    _Chapter('Affections', 'Kiss, hug, headpat — full-screen panda animations that reach your partner instantly.',
        Icons.favorite),
    _Chapter('Locked chats', 'Word-verification locks turn chat into a gentle ritual. Case & punctuation forgiven.',
        Icons.lock_outline),
    _Chapter('Badges', 'Earn Panda Coins by playing, checking in, and celebrating milestones.',
        Icons.workspace_premium),
    _Chapter('Movies together', 'Watch in lock-step — leader controls, followers auto-correct within 1s.',
        Icons.movie_creation_outlined),
    _Chapter('Games', 'Chess, Ludo, Uno, Pool, Hide-&-Seek. Group matches seat up to 8.',
        Icons.videogame_asset_outlined),
    _Chapter('Groups', 'Rooms with codes, themes, and voice notes. Partner messages glow.',
        Icons.groups_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    final c = _chapters[_i];
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            Row(children: [
              Text('Chapter ${_i + 1} of ${_chapters.length}', style: eyebrow()),
              const Spacer(),
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Skip')),
            ]),
            const Spacer(),
            Icon(c.icon, size: 120, color: AppColors.petal)
                .animate(key: ValueKey(_i))
                .fadeIn()
                .scale(begin: const Offset(.7, .7)),
            const SizedBox(height: 24),
            Text(c.title, style: serifItalic(size: 40))
                .animate(key: ValueKey('t$_i')).fadeIn(delay: 150.ms),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(c.body,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.candleMuted, height: 1.5, fontSize: 16))
                  .animate(key: ValueKey('b$_i')).fadeIn(delay: 250.ms),
            ),
            const Spacer(),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              TextButton(
                onPressed: _i == 0 ? null : () => setState(() => _i--),
                child: const Text('Back'),
              ),
              Row(children: [
                for (int k = 0; k < _chapters.length; k++)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: k == _i ? 22 : 8, height: 8,
                    decoration: BoxDecoration(
                      color: k == _i ? AppColors.petal : AppColors.border,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
              ]),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.petal),
                onPressed: () {
                  if (_i == _chapters.length - 1) {
                    Navigator.pop(context);
                  } else {
                    setState(() => _i++);
                  }
                },
                child: Text(_i == _chapters.length - 1 ? 'Enter' : 'Next'),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Chapter {
  final String title, body; final IconData icon;
  const _Chapter(this.title, this.body, this.icon);
}
