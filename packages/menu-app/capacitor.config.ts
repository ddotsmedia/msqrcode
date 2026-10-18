import type { CapacitorConfig } from '@capacitor/cli';

// Customer app (iPhone + Android). Builds from this package's `dist` (the coffeesales.ae site).
const config: CapacitorConfig = {
  appId: 'ae.coffeesales.app',
  appName: 'Milestones Coffee',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
