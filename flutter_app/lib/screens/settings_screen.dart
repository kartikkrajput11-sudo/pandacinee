import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Local settings backed by SharedPreferences. Kept intentionally simple so
/// toggles work offline and merge cleanly with the web app's `localStorage`
/// counterparts on the same account.
final settingsProvider =
    StateNotifierProvider<SettingsController, SettingsState>((ref) => SettingsController());

class SettingsState {
  final bool sfx;
  final bool activityVisible;
  final bool notifications;
  const SettingsState({this.sfx = true, this.activityVisible = true, this.notifications = true});
  SettingsState copy({bool? sfx, bool? activityVisible, bool? notifications}) =>
      SettingsState(
        sfx: sfx ?? this.sfx,
        activityVisible: activityVisible ?? this.activityVisible,
        notifications: notifications ?? this.notifications,
      );
}

class SettingsController extends StateNotifier<SettingsState> {
  SettingsController() : super(const SettingsState()) { _load(); }
  Future<void> _load() async {
    final p = await SharedPreferences.getInstance();
    state = SettingsState(
      sfx: p.getBool('sfx') ?? true,
      activityVisible: p.getBool('activity_visible') ?? true,
      notifications: p.getBool('notifications') ?? true,
    );
  }
  Future<void> setSfx(bool v) async {
    state = state.copy(sfx: v);
    (await SharedPreferences.getInstance()).setBool('sfx', v);
  }
  Future<void> setActivity(bool v) async {
    state = state.copy(activityVisible: v);
    (await SharedPreferences.getInstance()).setBool('activity_visible', v);
  }
  Future<void> setNotifications(bool v) async {
    state = state.copy(notifications: v);
    (await SharedPreferences.getInstance()).setBool('notifications', v);
  }
}

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(settingsProvider);
    final c = ref.read(settingsProvider.notifier);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            Text('Chapter · Preferences', style: eyebrow()),
            const SizedBox(height: 6),
            Text('Tune your velvet room', style: serifItalic(size: 28)),
            const SizedBox(height: 20),
            _Section('Sound', children: [
              _Toggle(
                label: 'Sound effects',
                subtitle: 'Chimes on messages, wins, and affections',
                value: s.sfx, onChanged: c.setSfx,
              ),
            ]),
            _Section('Presence', children: [
              _Toggle(
                label: 'Activity status',
                subtitle: 'Let your partner see when you\'re around',
                value: s.activityVisible, onChanged: c.setActivity,
              ),
              _Toggle(
                label: 'Notifications',
                subtitle: 'Slide-in message alerts on other screens',
                value: s.notifications, onChanged: c.setNotifications,
              ),
            ]),
            const SizedBox(height: 20),
            _Section('Account', children: [
              ListTile(
                title: const Text('Unpair partner'),
                subtitle: const Text('Break the current pairing (both sides).',
                    style: TextStyle(color: AppColors.candleMuted)),
                trailing: const Icon(Icons.link_off, color: AppColors.coral),
                onTap: () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (_) => AlertDialog(
                      backgroundColor: AppColors.surface,
                      title: Text('Unpair?', style: serifItalic(size: 22)),
                      content: const Text('This severs the partner link for both of you.'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Unpair')),
                      ],
                    ),
                  );
                  if (ok == true) {
                    try {
                      await ref.read(supabaseProvider).rpc('unpair_partner');
                      ref.invalidate(profileProvider);
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                      }
                    }
                  }
                },
              ),
              ListTile(
                title: const Text('Sign out'),
                trailing: const Icon(Icons.logout, color: AppColors.candleMuted),
                onTap: () => ref.read(supabaseProvider).auth.signOut(),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _Section(this.title, {required this.children});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(title.toUpperCase(), style: eyebrow()),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(children: children),
        ),
      ]),
    );
  }
}

class _Toggle extends StatelessWidget {
  final String label, subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _Toggle({required this.label, required this.subtitle, required this.value, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      title: Text(label),
      subtitle: Text(subtitle, style: const TextStyle(color: AppColors.candleMuted, fontSize: 12)),
      value: value,
      onChanged: onChanged,
      activeColor: AppColors.coral,
    );
  }
}
