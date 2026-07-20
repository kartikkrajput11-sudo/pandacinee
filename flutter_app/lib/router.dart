import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'screens/auth_screen.dart';
import 'screens/chat_list_screen.dart';
import 'screens/dm_screen.dart';
import 'screens/group_screen.dart';
import 'screens/home_screen.dart';
import 'screens/play_hub_screen.dart';
import 'screens/rps_screen.dart';
import 'screens/chess_screen.dart';
import 'screens/ludo_screen.dart';
import 'screens/uno_screen.dart';
import 'screens/pool_screen.dart';
import 'supabase_providers.dart';

final routerProvider = Provider<GoRouter>((ref) {
  ref.watch(authStateProvider);

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
      GoRoute(path: '/app/chats', builder: (_, __) => const ChatListScreen()),
      GoRoute(
        path: '/app/chat/:otherId',
        builder: (_, s) => DmScreen(otherId: s.pathParameters['otherId']!),
      ),
      GoRoute(
        path: '/app/group/:groupId',
        builder: (_, s) => GroupScreen(groupId: s.pathParameters['groupId']!),
      ),
      GoRoute(path: '/app/play', builder: (_, __) => const PlayHubScreen()),
      GoRoute(path: '/app/play/rps', builder: (_, __) => const RpsScreen()),
      GoRoute(path: '/app/play/chess', builder: (_, __) => const ChessScreen()),
    ],
  );
});

/// Bridges Riverpod auth stream -> Listenable so GoRouter re-evaluates redirects.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen(authStateProvider, (_, __) => notifyListeners());
  }
}
