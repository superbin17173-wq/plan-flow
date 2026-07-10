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
    CapacitorUpdater: {
      // 关闭插件自动更新,完全走手动流程(用户点"立即更新"才下载)
      autoUpdate: 'off',
      // 下载失败的 bundle 自动清理
      autoDeleteFailed: true,
      // 应用新版本后删除旧 bundle
      autoDeletePrevious: true,
      // 装了更新的原生 APK 时清理旧 bundle
      resetWhenUpdate: true,
    },
  },
};

export default config;
