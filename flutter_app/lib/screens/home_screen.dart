import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
                _card(context, 'Chats', 'DMs, groups, affections', onTap: () => context.push('/app/chats')),
                _card(context, 'Play', 'Chess, Ludo, Uno, Pool…', onTap: () => context.push('/app/play')),
                _card(context, 'Movies', 'Watch in lock-step', onTap: () => context.push('/app/movies')),
                _card(context, 'Profile', 'Badges & achievements'),
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

  Widget _card(BuildContext context, String title, String subtitle, {VoidCallback? onTap}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Material(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
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
                        Text(title, style: serifItalic(size: 22, color: AppColors.candle)),
                        const SizedBox(height: 2),
                        Text(subtitle,
                            style: const TextStyle(color: AppColors.candleMuted, fontSize: 13)),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward, color: AppColors.petal, size: 18),
                ],
              ),
            ),
          ),
        ),
      );
}
