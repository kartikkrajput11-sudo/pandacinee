import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme.dart';

/// Phase 21 — Native LiveKit call room.
///
/// The token is minted by an edge function `livekit_token` which returns
/// `{ url, token }` for the room `calls-<callId>`. The Dart layer:
///   1. Requests mic / cam permissions.
///   2. Connects to the LiveKit SFU.
///   3. Renders the remote video track + local preview.
///   4. Cleans up the DB row via `call_leave` on hang-up.
class LiveCallRoomScreen extends ConsumerStatefulWidget {
  const LiveCallRoomScreen({super.key, required this.callId, required this.video});
  final String callId;
  final bool video;

  @override
  ConsumerState<LiveCallRoomScreen> createState() => _LiveCallRoomScreenState();
}

class _LiveCallRoomScreenState extends ConsumerState<LiveCallRoomScreen> {
  final _client = Supabase.instance.client;
  Room? _room;
  LocalVideoTrack? _localVideo;
  LocalAudioTrack? _localAudio;
  RemoteVideoTrack? _remoteVideo;
  bool _muted = false;
  bool _cameraOff = false;
  String _status = 'connecting…';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    // 1. Permissions.
    final perms = <Permission>[Permission.microphone, if (widget.video) Permission.camera];
    for (final p in perms) {
      final s = await p.request();
      if (!s.isGranted) {
        setState(() => _status = 'Permissions denied');
        return;
      }
    }

    // 2. Mint token from edge function.
    final tokenRes = await _client.functions.invoke('livekit_token', body: {
      'call_id': widget.callId,
      'room': 'calls-${widget.callId}',
    });
    final data = tokenRes.data as Map;
    final url = data['url'] as String;
    final token = data['token'] as String;

    // 3. Connect.
    final room = Room();
    _room = room;
    room.addListener(_onRoomEvent);
    await room.connect(url, token,
        connectOptions: const ConnectOptions(autoSubscribe: true));

    // 4. Publish local tracks.
    _localAudio = await LocalAudioTrack.create();
    await room.localParticipant?.publishAudioTrack(_localAudio!);
    if (widget.video) {
      _localVideo = await LocalVideoTrack.createCameraTrack();
      await room.localParticipant?.publishVideoTrack(_localVideo!);
    }

    setState(() => _status = 'connected');
  }

  void _onRoomEvent() {
    // Pick the first remote video track we can find.
    RemoteVideoTrack? found;
    for (final p in _room?.remoteParticipants.values ?? const <RemoteParticipant>[]) {
      for (final pub in p.videoTrackPublications) {
        if (pub.subscribed && pub.track is RemoteVideoTrack) {
          found = pub.track as RemoteVideoTrack;
        }
      }
    }
    if (found != _remoteVideo) setState(() => _remoteVideo = found);
  }

  Future<void> _toggleMute() async {
    _muted = !_muted;
    await _localAudio?.mute();
    if (!_muted) await _localAudio?.unmute();
    setState(() {});
  }

  Future<void> _toggleCam() async {
    _cameraOff = !_cameraOff;
    if (_cameraOff) {
      await _localVideo?.mute();
    } else {
      await _localVideo?.unmute();
    }
    setState(() {});
  }

  Future<void> _hangup() async {
    await _room?.disconnect();
    await _client.rpc('call_leave', params: {'_call_id': widget.callId});
    if (mounted) context.pop();
  }

  @override
  void dispose() {
    _room?.removeListener(_onRoomEvent);
    _room?.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(children: [
        Positioned.fill(
          child: _remoteVideo != null
              ? VideoTrackRenderer(_remoteVideo!, fit: VideoViewFit.cover)
              : Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: AppColors.petal),
                      const SizedBox(height: 16),
                      Text(_status, style: serifItalic(size: 22, color: AppColors.candle)),
                    ],
                  ),
                ),
        ),
        if (_localVideo != null && !_cameraOff)
          Positioned(
            right: 16, top: 40,
            width: 120, height: 170,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: VideoTrackRenderer(_localVideo!, mirrorMode: VideoViewMirrorMode.mirror),
            ),
          ),
        Positioned(
          left: 0, right: 0, bottom: 40,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            _pill(_muted ? Icons.mic_off : Icons.mic, onTap: _toggleMute),
            if (widget.video) ...[
              const SizedBox(width: 16),
              _pill(_cameraOff ? Icons.videocam_off : Icons.videocam, onTap: _toggleCam),
            ],
            const SizedBox(width: 16),
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
