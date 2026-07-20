import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Daily — today's rotating question, mood log, quick shared prompts.
class DailyScreen extends ConsumerStatefulWidget {
  const DailyScreen({super.key});
  @override
  ConsumerState<DailyScreen> createState() => _DailyScreenState();
}

class _DailyScreenState extends ConsumerState<DailyScreen> {
  Map<String, dynamic>? _question;
  Map<String, dynamic>? _todayAnswer;
  Map<String, dynamic>? _todayMood;
  final _answer = TextEditingController();
  bool _loading = true;

  static const _moods = [
    ('sun',    '☀',  'Bright',   5),
    ('smile',  '🙂', 'Steady',   4),
    ('petal',  '🌸', 'Tender',   4),
    ('cloud',  '☁',  'Cloudy',   3),
    ('rain',   '🌧', 'Rainy',    2),
    ('storm',  '⚡', 'Storming', 1),
  ];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final supa = ref.read(supabaseProvider);
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final dayIdx = DateTime.now().difference(DateTime(DateTime.now().year, 1, 1)).inDays;

    final qs = await supa.from('daily_questions').select().order('day_index', ascending: true);
    Map<String, dynamic>? q;
    if ((qs as List).isNotEmpty) {
      q = (qs as List)[dayIdx % qs.length] as Map<String, dynamic>;
    }
    final a = await supa
        .from('daily_answers').select()
        .eq('user_id', me.id).eq('date', today).maybeSingle();
    final m = await supa
        .from('mood_log').select().eq('user_id', me.id).eq('date', today).maybeSingle();

    if (mounted) setState(() {
      _question = q; _todayAnswer = a; _todayMood = m; _loading = false;
      _answer.text = (a?['answer'] ?? '') as String;
    });
  }

  Future<void> _saveAnswer() async {
    final me = ref.read(currentUserProvider);
    final q = _question;
    if (me == null || q == null) return;
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final row = await ref.read(supabaseProvider).from('profiles')
        .select('partner_id').eq('id', me.id).maybeSingle();
    try {
      await ref.read(supabaseProvider).from('daily_answers').upsert({
        'user_id': me.id, 'partner_id': row?['partner_id'],
        'question_id': q['id'], 'date': today,
        'answer': _answer.text.trim(),
      }, onConflict: 'user_id,date');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _pickMood((String, String, String, int) m) async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final today = DateTime.now().toIso8601String().substring(0, 10);
    try {
      await ref.read(supabaseProvider).from('mood_log').upsert({
        'user_id': me.id, 'date': today,
        'emoji': m.$2, 'label': m.$3, 'score': m.$4,
      }, onConflict: 'user_id,date');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Daily')),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.petal))
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  Text('Chapter · Today', style: eyebrow()),
                  const SizedBox(height: 6),
                  Text('A daily prompt for two', style: serifItalic(size: 26)),
                  const SizedBox(height: 20),

                  // Question
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.coral.withOpacity(0.4)),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Question of the day', style: eyebrow()),
                      const SizedBox(height: 8),
                      Text(_question?['prompt'] ?? 'No prompt available.',
                          style: serifItalic(size: 22)),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _answer, maxLines: 3,
                        decoration: const InputDecoration(labelText: 'Your answer'),
                      ),
                      const SizedBox(height: 10),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton(
                          onPressed: _saveAnswer,
                          child: Text(_todayAnswer == null ? 'Save' : 'Update'),
                        ),
                      ),
                    ]),
                  ).animate().fadeIn().slideY(begin: .1),

                  const SizedBox(height: 20),

                  // Mood
                  Text('How are you today?', style: serifItalic(size: 20)),
                  const SizedBox(height: 12),
                  Wrap(spacing: 10, runSpacing: 10, children: [
                    for (final m in _moods)
                      _MoodChip(
                        emoji: m.$2, label: m.$3,
                        selected: _todayMood?['emoji'] == m.$2,
                        onTap: () => _pickMood(m),
                      ),
                  ]),
                ],
              ),
      ),
    );
  }
}

class _MoodChip extends StatelessWidget {
  final String emoji, label;
  final bool selected;
  final VoidCallback onTap;
  const _MoodChip({required this.emoji, required this.label, required this.selected, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.coral.withOpacity(0.2) : AppColors.surface,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: selected ? AppColors.coral : AppColors.border,
                width: selected ? 1.4 : 1),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(width: 6),
            Text(label),
          ]),
        ),
      ),
    );
  }
}
