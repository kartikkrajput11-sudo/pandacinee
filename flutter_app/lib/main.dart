import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'env.dart';
import 'router.dart';
import 'services/push_service.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  // Phase 22 — best-effort push init; do not block launch on failure.
  // Requires `flutter_app/android/app/google-services.json` (see RELEASE.md).
  try {
    await PushService.instance.init();
  } catch (e) {
    debugPrint('Push init failed (non-fatal): $e');
  }

  runApp(const ProviderScope(child: PandacineApp()));
}

class PandacineApp extends ConsumerWidget {
  const PandacineApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'PANDACINE',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: router,
    );
  }
}
