import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planflow.app',
  appName: 'PlanFlow',
  webDir: 'dist',
  android: {
    backgroundColor: '#F5F7FA',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#81C9D8',
    },
  },
};

export default config;
