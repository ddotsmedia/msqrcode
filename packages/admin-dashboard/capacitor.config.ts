import type { CapacitorConfig } from '@capacitor/cli';

// Staff app (counter tablets and managers' phones). Builds from this package's `dist` (admin.coffeesales.ae).
const config: CapacitorConfig = {
  appId: 'ae.coffeesales.staff',
  appName: 'Milestones Staff',
  webDir: 'dist',
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
