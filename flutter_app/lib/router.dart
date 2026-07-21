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
import 'screens/hideseek_screen.dart';
import 'screens/knowme_screen.dart';
import 'screens/movies_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/affections_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/groups_list_screen.dart';
import 'screens/group_matches_screen.dart';
import 'screens/punishment_lock_screen.dart';
import 'screens/vault_screen.dart';
import 'screens/daily_screen.dart';
import 'screens/shop_screen.dart';
import 'screens/calls_screen.dart';
import 'screens/watch_party_screen.dart' as watch_party;
import 'screens/admin_screen.dart';
import 'screens/tour_screen.dart';
import 'screens/shared_media_screen.dart';
import 'screens/live_call_room_screen.dart';
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
      GoRoute(path: '/app/play/ludo', builder: (_, __) => const LudoScreen()),
      GoRoute(path: '/app/play/uno', builder: (_, __) => const UnoScreen()),
      GoRoute(path: '/app/play/pool', builder: (_, __) => const PoolScreen()),
      GoRoute(path: '/app/play/hideseek', builder: (_, __) => const HideSeekScreen()),
      GoRoute(path: '/app/play/knowme', builder: (_, __) => const KnowMeScreen()),
      GoRoute(path: '/app/movies', builder: (_, __) => const MoviesScreen()),
      GoRoute(path: '/app/me', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/app/affections', builder: (_, __) => const AffectionsScreen()),
      GoRoute(path: '/app/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/app/settings', builder: (_, __) => const SettingsScreen()),
      GoRoute(path: '/app/groups', builder: (_, __) => const GroupsListScreen()),
      GoRoute(
        path: '/app/group/:groupId/matches',
        builder: (_, s) => GroupMatchesScreen(groupId: s.pathParameters['groupId']!),
      ),
      GoRoute(path: '/app/locks', builder: (_, __) => const PunishmentLockScreen()),
      GoRoute(path: '/app/vault', builder: (_, __) => const VaultScreen()),
      GoRoute(path: '/app/daily', builder: (_, __) => const DailyScreen()),
      GoRoute(path: '/app/shop', builder: (_, __) => const ShopScreen()),
      GoRoute(path: '/app/calls', builder: (_, __) => const CallsScreen()),
      GoRoute(
        path: '/app/call/:callId',
        builder: (_, s) => CallRoomScreen(callId: s.pathParameters['callId']!),
      ),
      GoRoute(
        path: '/app/call/:callId/live',
        builder: (_, s) => LiveCallRoomScreen(
          callId: s.pathParameters['callId']!,
          video: (s.uri.queryParameters['video'] ?? '0') == '1',
        ),
      ),
      GoRoute(
        path: '/app/watch/:roomId/:leaderId',
        builder: (_, s) => watch_party.WatchPartyRoomScreen(
          roomId: s.pathParameters['roomId']!,
          leaderId: s.pathParameters['leaderId']!,
        ),
      ),
      GoRoute(path: '/app/admin', builder: (_, __) => const AdminScreen()),
      GoRoute(path: '/app/tour', builder: (_, __) => const TourScreen()),
      GoRoute(
        path: '/app/shared-media/dm/:peerId',
        builder: (_, s) => SharedMediaScreen(peerId: s.pathParameters['peerId']!),
      ),
      GoRoute(
        path: '/app/shared-media/group/:groupId',
        builder: (_, s) => SharedMediaScreen(groupId: s.pathParameters['groupId']!),
      ),
    ],
  );
});

/// Bridges Riverpod auth stream -> Listenable so GoRouter re-evaluates redirects.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen(authStateProvider, (_, __) => notifyListeners());
  }
}
