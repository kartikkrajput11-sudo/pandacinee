import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Global Supabase client (initialised in main.dart).
final supabaseProvider = Provider<SupabaseClient>((_) => Supabase.instance.client);

/// Reactive auth state — emits every sign-in / sign-out.
final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(supabaseProvider).auth.onAuthStateChange;
});

/// Convenience: current user or null.
final currentUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(supabaseProvider).auth.currentUser;
});

/// Current profile row (id, username, display_name, avatar_url, partner_id, ...).
final profileProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  final row = await ref
      .read(supabaseProvider)
      .from('profiles')
      .select()
      .eq('id', user.id)
      .maybeSingle();
  return row;
});
