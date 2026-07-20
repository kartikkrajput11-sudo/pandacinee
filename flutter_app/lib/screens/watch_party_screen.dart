import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme.dart';

/// Phase 17 — Leader-driven watch-party sync.
///
/// Mirrors the web `useWatchSync` hook: leader publishes {position, paused,
/// updatedAt} @ ~1Hz, followers apply corrections when drift > 1.5s (soft) or
/// > 3s (hard seek). No feedback loop: only leader emits state.
class WatchPartyScreen extends ConsumerStatefulWidget {
  const WatchPartyScreen({super.key, required this.roomId, required this.leaderId});
  final String roomId;
  final String leaderId;
  @override
  ConsumerState<WatchPartyScreen> createState() => _WatchPartyScreenState();
}

class _WatchPartyScreenState extends ConsumerState<WatchPartyScreen> {
  final _client = Supabase.instance.client;
  RealtimeChannel? _channel;
  Timer? _tick;
  double _position = 0;
  bool _paused = true;
  String _remoteState = 'joining';

  bool get _isLeader => _client.auth.currentUser?.id == widget.leaderId;

  @override
  void initState() {
    super.initState();
    _channel = _client.channel('watch-${widget.roomId}')
      ..onBroadcast(
        event: 'state',
        callback: (payload) {
          if (_isLeader) return;
          final pos = (payload['position'] as num).toDouble();
          final paused = payload['paused'] as bool;
          final drift = (pos - _position).abs();
          setState(() {
            _paused = paused;
            _remoteState = 'drift ${drift.toStringAsFixed(2)}s';
            if (drift > 3.0) {
              _position = pos; // hard seek
            } else if (drift > 1.5) {
              _position += (pos - _position) * 0.5; // soft nudge
            }
          });
        },
      )
      ..subscribe();

    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!_paused) setState(() => _position += 1);
      if (_isLeader) {
        _channel?.sendBroadcastMessage(event: 'state', payload: {
          'position': _position,
          'paused': _paused,
          'updated_at': DateTime.now().toIso8601String(),
        });
      }
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    if (_channel != null) _client.removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Watch Party', style: serifItalic(size: 26))),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          Container(
            height: 220,
            decoration: BoxDecoration(
              color: AppColors.surface, borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
            ),
            child: Center(
              child: Text(_isLeader ? 'Leader · you control playback' : _remoteState,
                  style: serifItalic(size: 22)),
            ),
          ),
          const SizedBox(height: 20),
          Text('${_position.toStringAsFixed(1)}s', style: serifItalic(size: 40)),
          const SizedBox(height: 20),
          if (_isLeader)
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              IconButton(
                iconSize: 46,
                icon: Icon(_paused ? Icons.play_circle : Icons.pause_circle,
                    color: AppColors.petal),
                onPressed: () => setState(() => _paused = !_paused),
              ),
              IconButton(
                iconSize: 40,
                icon: const Icon(Icons.replay_10, color: AppColors.candle),
                onPressed: () => setState(() => _position = (_position - 10).clamp(0, 99999)),
              ),
              IconButton(
                iconSize: 40,
                icon: const Icon(Icons.forward_10, color: AppColors.candle),
                onPressed: () => setState(() => _position += 10),
              ),
            ]),
        ]),
      ),
    );
  }
}
