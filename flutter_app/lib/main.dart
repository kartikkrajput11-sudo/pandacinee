import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'env.dart';
import 'router.dart';
import 'services/app_bootstrap.dart';
import 'services/deep_link_service.dart';
import 'services/push_service.dart';
import 'theme.dart';

Future<void> main() async {
  // Phase 25 — global error boundary.
  AppBootstrap.install();
  ErrorWidget.builder = AppBootstrap.errorWidget;

  await runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    await Supabase.initialize(
      url: Env.supabaseUrl,
      anonKey: Env.supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );

    // Phase 22 — push init (best-effort so a missing google-services.json
    // never blocks first launch during development).
    try {
      await PushService.instance.init();
    } catch (e) {
      debugPrint('Push init skipped: $e');
    }

    runApp(const ProviderScope(child: PandacineApp()));
  }, (error, stack) {
    debugPrint('Uncaught async: $error\n$stack');
  });
}

class PandacineApp extends ConsumerWidget {
  const PandacineApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    // Phase 23 — hand the live router to the deep-link dispatcher so
    // taps captured before first frame can now navigate.
    DeepLinkService.instance.bind(router);
    return MaterialApp.router(
      title: 'PANDACINE',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: router,
    );
  }
}
