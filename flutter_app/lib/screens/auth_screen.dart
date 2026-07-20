import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../supabase_providers.dart';
import '../theme.dart';

class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key});
  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _isSignup = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    try {
      final auth = ref.read(supabaseProvider).auth;
      if (_isSignup) {
        await auth.signUp(email: _email.text.trim(), password: _password.text);
      } else {
        await auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
      }
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _google() async {
    try {
      await ref.read(supabaseProvider).auth.signInWithOAuth(
            OAuthProvider.google,
            redirectTo: 'com.pandacine://auth-callback',
          );
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Chapter · One', style: eyebrow()),
                  const SizedBox(height: 12),
                  Text(
                    _isSignup ? 'Begin the story' : 'Welcome back',
                    style: serifItalic(size: 40),
                  ).animate().fadeIn().slideY(begin: .1),
                  const SizedBox(height: 8),
                  const Text(
                    'A private velvet room for two.',
                    style: TextStyle(color: AppColors.candleMuted),
                  ),
                  const SizedBox(height: 32),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(hintText: 'Email'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(hintText: 'Password'),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: AppColors.coral)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? '…' : (_isSignup ? 'Create account' : 'Sign in')),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _google,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.border),
                      shape: const StadiumBorder(),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Continue with Google'),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => setState(() => _isSignup = !_isSignup),
                    child: Text(
                      _isSignup ? 'Have an account? Sign in' : 'New here? Create one',
                      style: const TextStyle(color: AppColors.petal),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
