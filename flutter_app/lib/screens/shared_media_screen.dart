import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme.dart';

/// Phase 20 — Shared media drawer for a DM or group thread.
/// Renders every image/video/file exchanged in the conversation as a grid.
class SharedMediaScreen extends ConsumerStatefulWidget {
  const SharedMediaScreen({super.key, this.peerId, this.groupId})
      : assert(peerId != null || groupId != null);
  final String? peerId;
  final String? groupId;
  @override
  ConsumerState<SharedMediaScreen> createState() => _SharedMediaScreenState();
}

class _SharedMediaScreenState extends ConsumerState<SharedMediaScreen> {
  final _client = Supabase.instance.client;
  List<Map<String, dynamic>> _media = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final me = _client.auth.currentUser?.id;
    if (me == null) return;
    var q = _client.from('messages').select('id, media_url, media_type, created_at, sender_id');
    if (widget.groupId != null) {
      q = q.eq('group_id', widget.groupId!);
    } else {
      q = q.or(
        'and(sender_id.eq.$me,receiver_id.eq.${widget.peerId}),and(sender_id.eq.${widget.peerId},receiver_id.eq.$me)',
      );
    }
    final rows = await q.not('media_url', 'is', null).order('created_at', ascending: false).limit(200);
    if (mounted) {
      setState(() {
        _media = List<Map<String, dynamic>>.from(rows);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Shared media', style: serifItalic(size: 26))),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.petal))
          : _media.isEmpty
              ? Center(child: Text('No shared media yet', style: eyebrow()))
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3, crossAxisSpacing: 8, mainAxisSpacing: 8),
                  itemCount: _media.length,
                  itemBuilder: (_, i) {
                    final m = _media[i];
                    final url = m['media_url'] as String;
                    final type = (m['media_type'] as String?) ?? 'image';
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: type.startsWith('image')
                          ? Image.network(url, fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                color: AppColors.surface,
                                child: const Icon(Icons.broken_image, color: AppColors.candleMuted),
                              ))
                          : Container(
                              color: AppColors.surface,
                              child: Center(
                                child: Icon(
                                  type.startsWith('video') ? Icons.play_circle : Icons.insert_drive_file,
                                  color: AppColors.petal, size: 40),
                              ),
                            ),
                    );
                  },
                ),
    );
  }
}
