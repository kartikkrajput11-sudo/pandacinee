import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase_providers.dart';
import '../theme.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    return Scaffold(
      body: SafeArea(
        child: profile.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.petal)),
          error: (e, _) => Center(child: Text('Error: $e')),
          data: (p) {
            final name = (p?['display_name'] ?? p?['username'] ?? 'panda') as String;
            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
              children: [
                Text('Chapter · Home', style: eyebrow()),
                const SizedBox(height: 10),
                Text('Hello, $name', style: serifItalic(size: 40))
                    .animate().fadeIn().slideY(begin: .1),
                const SizedBox(height: 8),
                const Text(
                  'Your velvet room is ready.',
                  style: TextStyle(color: AppColors.candleMuted),
                ),
                const SizedBox(height: 28),
                _card('Chats', 'DMs, groups, affections'),
                _card('Play', 'Chess, Ludo, Uno, Pool…'),
                _card('Movies', 'Watch in lock-step'),
                _card('Profile', 'Badges & achievements'),
                const SizedBox(height: 40),
                Center(
                  child: TextButton(
                    onPressed: () => ref.read(supabaseProvider).auth.signOut(),
                    child: const Text('Sign out',
                        style: TextStyle(color: AppColors.candleMuted)),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _card(String title, String subtitle) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(width: 4, height: 32, color: AppColors.coral),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: serifItalic(size: 22, color: AppColors.candle)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: const TextStyle(color: AppColors.candleMuted, fontSize: 13)),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward, color: AppColors.petal, size: 18),
          ],
        ),
      );
}
