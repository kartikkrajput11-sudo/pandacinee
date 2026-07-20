import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Aubergine Noir tokens — mirrors src/styles.css from the web app.
class AppColors {
  static const velvet = Color(0xFF0F0812);       // near-black aubergine
  static const surface = Color(0xFF1A1220);      // card
  static const border = Color(0xFF2B1F32);
  static const candle = Color(0xFFF6EEDF);       // primary text
  static const candleMuted = Color(0xFFAFA0B4);  // secondary text
  static const petal = Color(0xFFEC789B);        // primary accent (pink)
  static const coral = Color(0xFFFF7A5A);        // editorial coral hairline
  static const wine = Color(0xFF6B2340);
}

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: AppColors.velvet,
    colorScheme: base.colorScheme.copyWith(
      primary: AppColors.petal,
      secondary: AppColors.coral,
      surface: AppColors.surface,
      onPrimary: AppColors.velvet,
      onSurface: AppColors.candle,
    ),
    textTheme: GoogleFonts.dmSansTextTheme(base.textTheme).apply(
      bodyColor: AppColors.candle,
      displayColor: AppColors.candle,
    ),
    dividerColor: AppColors.border,
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.petal,
        foregroundColor: AppColors.velvet,
        shape: const StadiumBorder(),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, letterSpacing: 0.2),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      hintStyle: const TextStyle(color: AppColors.candleMuted),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.petal),
      ),
    ),
  );
}

/// Editorial italic serif — the "Instrument Serif" replacement used in the web hero titles.
TextStyle serifItalic({double size = 32, Color? color}) =>
    GoogleFonts.instrumentSerif(
      fontStyle: FontStyle.italic,
      fontSize: size,
      color: color ?? AppColors.candle,
      height: 1.05,
    );

/// Small uppercase eyebrow used everywhere ("Chapter · One").
TextStyle eyebrow({Color? color}) => GoogleFonts.dmSans(
      fontSize: 10,
      letterSpacing: 3.2,
      fontWeight: FontWeight.w600,
      color: color ?? AppColors.petal,
    );
