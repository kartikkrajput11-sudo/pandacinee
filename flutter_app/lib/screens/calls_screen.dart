import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Phase 16 — Calls (LiveKit-backed ringing UI).
///
/// This screen relies on Postgres RPCs already deployed:
///  - call_start_direct / call_start_group
///  - call_answer / call_decline / call_leave / call_end
/// The heavy LiveKit media pipeline lives in a native module; this Dart layer
/// handles signalling + ringing UI. When the user answers, the LiveKit room
/// name is `calls-<callId>` and the token is minted server-side.
class CallsScreen extends ConsumerStatefulWidget {
  const CallsScreen({super.key});
  @override
  ConsumerState<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends ConsumerState<CallsScreen> {
  final _client = Supabase.instance.client;
  List<Map<String, dynamic>> _incoming = [];
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _refresh();
    final me = _client.auth.currentUser?.id;
    if (me != null) {
      _channel = _client.channel('calls-incoming-$me')
        ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'call_participants',
          callback: (_) => _refresh(),
        )
        ..subscribe();
    }
  }

  Future<void> _refresh() async {
    final me = _client.auth.currentUser?.id;
    if (me == null) return;
    final rows = await _client
        .from('call_participants')
        .select('call_id, state, calls!inner(id, kind, scope, initiator_id, status, started_at)')
        .eq('user_id', me)
        .eq('state', 'ringing');
    if (mounted) setState(() => _incoming = List<Map<String, dynamic>>.from(rows));
  }

  Future<void> _answer(String callId) async {
    await _client.rpc('call_answer', params: {'_call_id': callId, '_device_id': 'flutter'});
    if (mounted) context.push('/app/call/$callId');
  }

  Future<void> _decline(String callId) =>
      _client.rpc('call_decline', params: {'_call_id': callId});

  @override
  void dispose() {
    if (_channel != null) _client.removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Ringing', style: serifItalic(size: 28))),
      body: _incoming.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.phone_outlined, size: 56, color: AppColors.candleMuted),
                  const SizedBox(height: 12),
                  Text('No incoming calls', style: eyebrow()),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: _incoming.length,
              itemBuilder: (_, i) {
                final row = _incoming[i];
                final call = row['calls'] as Map<String, dynamic>;
                final id = call['id'] as String;
                final kind = call['kind'] as String;
                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.petal),
                  ),
                  child: Row(children: [
                    Icon(kind == 'video' ? Icons.videocam : Icons.call,
                        color: AppColors.petal, size: 32)
                        .animate(onPlay: (c) => c.repeat(reverse: true))
                        .scale(duration: 700.ms, begin: const Offset(1, 1), end: const Offset(1.15, 1.15)),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Incoming ${kind == 'video' ? 'video' : 'voice'} call',
                              style: serifItalic(size: 20)),
                          Text('${call['scope']} · tap to answer', style: eyebrow()),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => _decline(id),
                      icon: const Icon(Icons.call_end, color: Colors.redAccent),
                    ),
                    IconButton(
                      onPressed: () => _answer(id),
                      icon: const Icon(Icons.call, color: AppColors.petal),
                    ),
                  ]),
                );
              },
            ),
    );
  }
}

/// Live call room — LiveKit widgetry is delegated to the platform layer; this
/// screen renders the "in-call" chrome (mute/hangup) and drives the signalling
/// RPCs so the DB row is closed cleanly when the user hangs up.
class CallRoomScreen extends ConsumerStatefulWidget {
  const CallRoomScreen({super.key, required this.callId});
  final String callId;
  @override
  ConsumerState<CallRoomScreen> createState() => _CallRoomScreenState();
}

class _CallRoomScreenState extends ConsumerState<CallRoomScreen> {
  final _client = Supabase.instance.client;
  bool _muted = false;

  Future<void> _hangup() async {
    await _client.rpc('call_leave', params: {'_call_id': widget.callId});
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(children: [
        // Placeholder canvas — the native LiveKit renderer attaches here.
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 120, height: 120,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle, color: AppColors.surface,
                ),
                child: const Icon(Icons.person, size: 60, color: AppColors.candleMuted),
              )
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scale(duration: 1400.ms, begin: const Offset(1, 1), end: const Offset(1.06, 1.06)),
              const SizedBox(height: 24),
              Text('Connected', style: serifItalic(size: 28, color: AppColors.candle)),
              const SizedBox(height: 6),
              Text('call · ${widget.callId.substring(0, 8)}', style: eyebrow()),
            ],
          ),
        ),
        Positioned(
          left: 0, right: 0, bottom: 40,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _pill(_muted ? Icons.mic_off : Icons.mic,
                onTap: () => setState(() => _muted = !_muted)),
            const SizedBox(width: 20),
            _pill(Icons.call_end, red: true, onTap: _hangup),
          ]),
        ),
      ]),
    );
  }

  Widget _pill(IconData icon, {bool red = false, VoidCallback? onTap}) => Material(
        color: red ? Colors.redAccent : AppColors.surface,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Icon(icon, size: 28, color: Colors.white),
          ),
        ),
      );
}
