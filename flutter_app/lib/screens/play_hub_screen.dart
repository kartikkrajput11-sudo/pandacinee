import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme.dart';

class _Game {
  final String id;
  final String title;
  final String tagline;
  final IconData icon;
  final bool ready;
  const _Game(this.id, this.title, this.tagline, this.icon, {this.ready = false});
}

const _games = [
  _Game('rps', 'Rock · Paper · Scissors', 'Quick duel, best of five', Icons.back_hand, ready: true),
  _Game('chess', 'Chess', 'Capture animations, blood spots', Icons.castle, ready: true),
  _Game('ludo', 'Ludo', 'Spring-arc tokens, velvet board', Icons.casino, ready: true),
  _Game('uno', 'Uno', 'Table talk & card bursts', Icons.style, ready: true),
  _Game('pool', '8-Ball Pool', 'Cue-pull power, turn-based', Icons.sports_bar, ready: true),
  _Game('hideseek', 'Hide & Seek', 'Whisper hints & proximity', Icons.visibility_off),
  _Game('knowme', 'How Well Do You Know Me?', 'Setter & guesser rounds', Icons.favorite),
];

class PlayHubScreen extends ConsumerWidget {
  const PlayHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Play')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          Text('Chapter · Play', style: eyebrow()),
          const SizedBox(height: 8),
          Text('The velvet arcade', style: serifItalic(size: 32)),
          const SizedBox(height: 20),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.95,
            ),
            itemCount: _games.length,
            itemBuilder: (context, i) {
              final g = _games[i];
              return _GameTile(
                game: g,
                onTap: g.ready ? () => context.push('/app/play/${g.id}') : null,
              );
            },
          ),
        ],
      ),
    );
  }
}

class _GameTile extends StatelessWidget {
  final _Game game;
  final VoidCallback? onTap;
  const _GameTile({required this.game, this.onTap});

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.coral.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.coral.withOpacity(0.4)),
                ),
                child: Icon(game.icon, color: AppColors.coral, size: 22),
              ),
              const Spacer(),
              Text(game.title,
                  style: serifItalic(size: 18, color: AppColors.candle),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 4),
              Text(game.tagline,
                  style: const TextStyle(color: AppColors.candleMuted, fontSize: 11),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 8),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: disabled
                          ? AppColors.border
                          : AppColors.coral.withOpacity(0.85),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      disabled ? 'Soon' : 'Play',
                      style: const TextStyle(
                          color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
