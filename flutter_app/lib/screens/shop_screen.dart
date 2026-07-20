import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../supabase_providers.dart';
import '../theme.dart';

/// Shop — spend Panda Coins on themes, flairs, sticker packs. Uses the
/// `purchase_shop_item` and `toggle_equip_item` RPCs and the `user_inventory`
/// table.
class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});
  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  List<Map<String, dynamic>> _items = [];
  Set<String> _owned = {};
  Set<String> _equipped = {};
  int _coins = 0;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    final supa = ref.read(supabaseProvider);
    final me = ref.read(currentUserProvider);
    if (me == null) return;
    final items = await supa.from('shop_items')
        .select('id, item_key, category, name, description, price, preview_url, sort_order')
        .eq('active', true)
        .order('sort_order', ascending: true).limit(200);
    final inv = await supa.from('user_inventory').select('item_id, equipped').eq('user_id', me.id);
    final prof = await supa.from('profiles').select('panda_coins').eq('id', me.id).maybeSingle();

    if (!mounted) return;
    setState(() {
      _items = List<Map<String, dynamic>>.from(items);
      _owned = {for (final r in inv as List) r['item_id'] as String};
      _equipped = {for (final r in inv as List) if (r['equipped'] == true) r['item_id'] as String};
      _coins = ((prof?['panda_coins'] ?? 0) as num).toInt();
      _loading = false;
    });
  }

  Future<void> _buy(Map<String, dynamic> item) async {
    try {
      await ref.read(supabaseProvider).rpc('purchase_shop_item', params: {'_item_id': item['id']});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _toggleEquip(String itemId) async {
    final now = _equipped.contains(itemId);
    try {
      await ref.read(supabaseProvider).rpc('toggle_equip_item',
          params: {'_item_id': itemId, '_equip': !now});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Shop'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Row(children: [
              const Icon(Icons.local_fire_department, color: AppColors.coral, size: 18),
              const SizedBox(width: 4),
              Text('$_coins', style: serifItalic(size: 18, color: AppColors.coral)),
            ]),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.petal))
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                children: [
                  Text('Chapter · Boutique', style: eyebrow()),
                  const SizedBox(height: 6),
                  Text('Panda Coins & petals', style: serifItalic(size: 28)),
                  const SizedBox(height: 20),
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12,
                      childAspectRatio: 0.78,
                    ),
                    itemCount: _items.length,
                    itemBuilder: (_, i) => _card(_items[i]),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _card(Map<String, dynamic> it) {
    final id = it['id'] as String;
    final owned = _owned.contains(id);
    final equipped = _equipped.contains(id);
    final price = ((it['price'] ?? 0) as num).toInt();
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: equipped ? AppColors.coral : AppColors.border,
            width: equipped ? 1.4 : 1),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.wine, Color(0xFF2A1230)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.coral.withOpacity(0.3)),
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.auto_awesome, color: AppColors.coral, size: 40),
        )),
        const SizedBox(height: 8),
        Text(it['name'] ?? '', style: serifItalic(size: 16), maxLines: 1, overflow: TextOverflow.ellipsis),
        Text('${it['category']}',
            style: const TextStyle(color: AppColors.candleMuted, fontSize: 11)),
        const SizedBox(height: 6),
        SizedBox(width: double.infinity, child: owned
            ? FilledButton.tonal(
                onPressed: () => _toggleEquip(id),
                child: Text(equipped ? 'Equipped' : 'Equip'),
              )
            : FilledButton(
                onPressed: _coins >= price ? () => _buy(it) : null,
                child: Text('$price coins'),
              ),
        ),
      ]),
    );
  }
}
