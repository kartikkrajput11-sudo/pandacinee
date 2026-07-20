import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/chat_providers.dart';
import '../supabase_providers.dart';
import '../theme.dart';

class GroupScreen extends ConsumerStatefulWidget {
  final String groupId;
  const GroupScreen({super.key, required this.groupId});

  @override
  ConsumerState<GroupScreen> createState() => _GroupScreenState();
}

class _GroupScreenState extends ConsumerState<GroupScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  Map<String, dynamic>? _group;
  Map<String, Map<String, dynamic>> _memberProfiles = {};

  @override
  void initState() {
    super.initState();
    _loadGroup();
  }

  Future<void> _loadGroup() async {
    final supa = ref.read(supabaseProvider);
    final g = await supa.from('groups').select().eq('id', widget.groupId).maybeSingle();
    final members = await supa
        .from('group_members')
        .select('user_id, profiles(id, username, display_name, avatar_url)')
        .eq('group_id', widget.groupId);
    final map = <String, Map<String, dynamic>>{};
    for (final m in members as List) {
      final p = (m['profiles'] as Map?)?.cast<String, dynamic>();
      if (p != null) map[p['id'] as String] = p;
    }
    if (mounted) setState(() {
      _group = g;
      _memberProfiles = map;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final text = _controller.text;
    _controller.clear();
    await sendGroupMessage(ref.read(supabaseProvider), widget.groupId, me.id, text);
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(currentUserProvider);
    final messagesAsync = ref.watch(groupMessagesProvider(widget.groupId));

    return Scaffold(
      appBar: AppBar(
        title: Text(_group?['name'] ?? 'Group'),
      ),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('$e')),
              data: (messages) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (_scroll.hasClients) {
                    _scroll.jumpTo(_scroll.position.maxScrollExtent);
                  }
                });
                return ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  itemCount: messages.length,
                  itemBuilder: (context, i) {
                    final m = messages[i];
                    final senderId = m['sender_id'] as String?;
                    final mine = senderId == me?.id;
                    final p = senderId != null ? _memberProfiles[senderId] : null;
                    return _GroupBubble(
                      text: m['content'] ?? '',
                      mine: mine,
                      senderName: p?['display_name'] ?? p?['username'] ?? '…',
                      avatarUrl: p?['avatar_url'] as String?,
                    );
                  },
                );
              },
            ),
          ),
          _GroupComposer(controller: _controller, onSend: _send),
        ],
      ),
    );
  }
}

class _GroupBubble extends StatelessWidget {
  final String text;
  final bool mine;
  final String senderName;
  final String? avatarUrl;
  const _GroupBubble({
    required this.text,
    required this.mine,
    required this.senderName,
    this.avatarUrl,
  });

  @override
  Widget build(BuildContext context) {
    final avatar = CircleAvatar(
      radius: 14,
      backgroundColor: AubergineNoir.plumDeep,
      backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
      child: avatarUrl == null
          ? Text(senderName[0].toUpperCase(), style: const TextStyle(fontSize: 12))
          : null,
    );
    final bubble = Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
      decoration: BoxDecoration(
        color: mine ? AubergineNoir.coral.withOpacity(0.85) : AubergineNoir.plumDeep,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x22FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!mine)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(senderName,
                  style: const TextStyle(
                      color: AubergineNoir.coral,
                      fontSize: 12,
                      fontWeight: FontWeight.w600)),
            ),
          Text(text, style: const TextStyle(color: Colors.white, height: 1.35)),
        ],
      ),
    );
    return Row(
      mainAxisAlignment: mine ? MainAxisAlignment.end : MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: mine
          ? [bubble]
          : [avatar, const SizedBox(width: 8), Flexible(child: bubble)],
    );
  }
}

class _GroupComposer extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  const _GroupComposer({required this.controller, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0x22FFFFFF))),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: 'Message group…',
                  filled: true,
                  fillColor: AubergineNoir.plumDeep,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Material(
              color: AubergineNoir.coral,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onSend,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Icon(Icons.send, color: Colors.white, size: 20),
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}
