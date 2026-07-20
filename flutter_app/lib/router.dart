import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'supabase_providers.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/app',
    refreshListenable: _AuthRefresh(ref),
    redirect: (context, state) {
      final signedIn = ref.read(currentUserProvider) != null;
      final atAuth = state.matchedLocation == '/auth';
      if (!signedIn && !atAuth) return '/auth';
      if (signedIn && atAuth) return '/app';
      return null;
    },
    routes: [
      GoRoute(path: '/auth', builder: (_, __) => const AuthScreen()),
      GoRoute(path: '/app', builder: (_, __) => const HomeScreen()),
    ],
  );
});

/// Bridges Riverpod auth stream -> Listenable so GoRouter re-evaluates redirects.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen(authStateProvider, (_, __) => notifyListeners());
  }
}
