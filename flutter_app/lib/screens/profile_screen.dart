import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Catalog of achievements. `condition` receives a stats map from `profiles`
/// row plus any joined counters; leave permissive for missing columns so
/// unlocks degrade to "locked" instead of crashing.
class Badge {
  final String id, title, tagline;
  final IconData icon;
  final bool Function(Map<String, dynamic>) unlocked;
  const Badge(this.id, this.title, this.tagline, this.icon, this.unlocked);
}

final _badges = <Badge>[
  Badge('first_light', 'First Light', 'Signed into the velvet room',
      Icons.wb_twilight, (_) => true),
  Badge('paired', 'Two of Us', 'Linked with a partner', Icons.link,
      (p) => (p['partner_id'] ?? '').toString().isNotEmpty),
  Badge('scribe', 'Scribe', 'Wrote your first hundred lines',
      Icons.edit_note, (p) => ((p['messages_sent'] ?? 0) as num) >= 100),
  Badge('rally', 'Rally', 'Kept a seven-day streak alive',
      Icons.local_fire_department, (p) => ((p['streak_days'] ?? 0) as num) >= 7),
  Badge('duelist', 'Duelist', 'Finished a match with your partner',
      Icons.sports_esports, (p) => ((p['games_played'] ?? 0) as num) >= 1),
  Badge('cinephile', 'Cinephile', 'Watched a movie together',
      Icons.movie_filter, (p) => ((p['movies_watched'] ?? 0) as num) >= 1),
  Badge('tender', 'Tender', 'Sent an affection',
      Icons.favorite, (p) => ((p['affections_sent'] ?? 0) as num) >= 1),
  Badge('night_owl', 'Night Owl', 'Chatted past midnight',
      Icons.nightlight_round, (p) => (p['night_owl'] ?? false) == true),
];

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: profile.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.petal)),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (p) => _body(context, p ?? {}),
      ),
    );
  }

  Widget _body(BuildContext context, Map<String, dynamic> p) {
    final name = (p['display_name'] ?? p['username'] ?? 'panda').toString();
    final username = (p['username'] ?? '').toString();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
      children: [
        // Hero
        Container(
          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.wine, Color(0xFF14060F)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.coral.withOpacity(0.3)),
          ),
          child: Column(children: [
            _Avatar(name: name, size: 96)
                .animate().scale(begin: const Offset(0.7, 0.7)).fadeIn(),
            const SizedBox(height: 14),
            Text('Chapter · You', style: eyebrow()),
            const SizedBox(height: 4),
            Text(name, style: serifItalic(size: 32), textAlign: TextAlign.center),
            if (username.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('@$username',
                    style: const TextStyle(color: AppColors.candleMuted)),
              ),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: () => _editIdentity(p),
              child: const Text('Edit identity'),
            ),
          ]),
        ),
        const SizedBox(height: 24),
        // Affections
        Row(children: [
          Text('Affections', style: serifItalic(size: 22)),
          const Spacer(),
          TextButton(
            onPressed: () => context.push('/app/affections'),
            child: const Text('Open'),
          ),
        ]),
        const SizedBox(height: 6),
        const Text('Full-screen pandas sent to your partner.',
            style: TextStyle(color: AppColors.candleMuted)),
        const SizedBox(height: 24),
        // Badges
        Text('Achievements', style: serifItalic(size: 22)),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.4,
          ),
          itemCount: _badges.length,
          itemBuilder: (_, i) {
            final b = _badges[i];
            final unlocked = b.unlocked(p);
            return _BadgeTile(badge: b, unlocked: unlocked);
          },
        ),
      ],
    );
  }

  Future<void> _editIdentity(Map<String, dynamic> p) async {
    final display = TextEditingController(text: (p['display_name'] ?? '').toString());
    final uname = TextEditingController(text: (p['username'] ?? '').toString());
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('Edit identity', style: serifItalic(size: 22)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: display, decoration: const InputDecoration(labelText: 'Display name')),
          const SizedBox(height: 12),
          TextField(controller: uname, decoration: const InputDecoration(labelText: 'Username')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Save')),
        ],
      ),
    );
    if (result != true) return;
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    try {
      await ref.read(supabaseProvider).from('profiles').update({
        'display_name': display.text.trim(),
        'username': uname.text.trim(),
      }).eq('id', me.id);
      ref.invalidate(profileProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final double size;
  const _Avatar({required this.name, this.size = 48});
  @override
  Widget build(BuildContext context) {
    final initial = name.isEmpty ? '?' : name.characters.first.toUpperCase();
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [AppColors.coral, AppColors.wine],
          radius: 0.85,
        ),
        border: Border.all(color: AppColors.coral, width: 2),
        boxShadow: [
          BoxShadow(color: AppColors.coral.withOpacity(0.35), blurRadius: 24, spreadRadius: 2),
        ],
      ),
      alignment: Alignment.center,
      child: Text(initial,
          style: serifItalic(size: size * 0.42, color: AppColors.candle)),
    );
  }
}

class _BadgeTile extends StatelessWidget {
  final Badge badge;
  final bool unlocked;
  const _BadgeTile({required this.badge, required this.unlocked});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: unlocked ? AppColors.surface : AppColors.surface.withOpacity(0.4),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: unlocked ? AppColors.coral.withOpacity(0.6) : AppColors.border,
          width: unlocked ? 1.4 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: unlocked ? AppColors.coral.withOpacity(0.15) : AppColors.border.withOpacity(0.5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(badge.icon,
                color: unlocked ? AppColors.coral : AppColors.candleMuted, size: 22),
          ),
          const Spacer(),
          Text(badge.title,
              style: serifItalic(
                  size: 16,
                  color: unlocked ? AppColors.candle : AppColors.candleMuted)),
          const SizedBox(height: 2),
          Text(badge.tagline,
              style: const TextStyle(color: AppColors.candleMuted, fontSize: 11),
              maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
