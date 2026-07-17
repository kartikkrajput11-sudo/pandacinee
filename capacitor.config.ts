import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pandacine.app',
  appName: 'Pandacine',
  webDir: 'dist',
  server: {
    // Hot-reload from Lovable preview while developing on your phone.
    // Remove this `server` block (or set url to your published URL) for a
    // production APK that bundles the built web assets from `webDir`.
    url: 'https://25270c29-07a4-4330-b880-59d2d9d53167.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
