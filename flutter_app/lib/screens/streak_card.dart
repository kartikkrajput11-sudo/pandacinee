import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Couple streak — days both partners checked in consecutively.
/// Uses the existing `couple_streak(_me, _partner)` SQL function and the
/// `daily_checkins` table for today's check-in.
final streakProvider = FutureProvider<int>((ref) async {
  final supa = ref.watch(supabaseProvider);
  final me = ref.watch(currentUserProvider);
  if (me == null) return 0;
  final prof = await supa.from('profiles').select('partner_id').eq('id', me.id).maybeSingle();
  final partnerId = prof?['partner_id'] as String?;
  if (partnerId == null) return 0;
  final val = await supa.rpc('couple_streak', params: {'_me': me.id, '_partner': partnerId});
  return (val as num?)?.toInt() ?? 0;
});

class StreakCard extends ConsumerWidget {
  const StreakCard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final streak = ref.watch(streakProvider);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2A0F1E), Color(0xFF14060F)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.coral.withOpacity(0.35)),
      ),
      child: Row(children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.coral.withOpacity(0.15),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.coral),
          ),
          child: const Icon(Icons.local_fire_department, color: AppColors.coral, size: 26),
        ).animate(onPlay: (c) => c.repeat(reverse: true))
            .scale(begin: const Offset(1, 1), end: const Offset(1.08, 1.08), duration: 1500.ms),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Streak', style: eyebrow()),
          const SizedBox(height: 2),
          streak.when(
            loading: () => const Text('…', style: TextStyle(color: AppColors.candleMuted)),
            error: (_, __) => const Text('—', style: TextStyle(color: AppColors.candleMuted)),
            data: (d) => Text(
              d == 0 ? 'Start today' : '$d ${d == 1 ? "day" : "days"} together',
              style: serifItalic(size: 22),
            ),
          ),
        ])),
        FilledButton.tonal(
          onPressed: () => _checkIn(context, ref),
          child: const Text('Check in'),
        ),
      ]),
    );
  }

  Future<void> _checkIn(BuildContext context, WidgetRef ref) async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    try {
      await ref.read(supabaseProvider).from('daily_checkins').upsert({
        'user_id': me.id, 'date': DateTime.now().toIso8601String().substring(0, 10),
      }, onConflict: 'user_id,date');
      ref.invalidate(streakProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Checked in for today.')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }
}
