const dotenv = require('dotenv');
const fs = require('fs');

// Load .env if present
const envFile = '.env';
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

module.exports = ({ config }) => {
  return {
    ...config,
    scheme: 'finance-tracker',
    updates: {
      url: `https://u.expo.dev/${process.env.EXPO_PROJECT_ID || 'e75a47f0-98e0-4a46-becc-0caf782343dc'}`,
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: {
      policy: 'sdkVersion',
    },
    extra: {
      ...config.extra,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kihgmhodhbwaocugeygz.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaGdtaG9kaGJ3YW9jdWdleWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNjcwNDMsImV4cCI6MjA3Nzk0MzA0M30.kkb2DR1KfLtIrnNdgxyDMN9xJBnOdSJqENxPZsazB2w',
      eas: {
        projectId: process.env.EXPO_PROJECT_ID || 'e75a47f0-98e0-4a46-becc-0caf782343dc'
      }
    },
    plugins: [
      ...(config.plugins || []),
      [
        'expo-image-picker',
        {
          photosPermission: 'The app needs access to your photos to attach bill images to transactions.',
          cameraPermission: 'The app needs access to your camera to take photos of bills.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#3b82f6',
          sounds: [],
        },
      ],
      'expo-secure-store',
      'expo-local-authentication',
      'expo-file-system',
    ],
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSCameraUsageDescription: 'The app needs access to your camera to take photos of bills.',
        NSPhotoLibraryUsageDescription: 'The app needs access to your photos to attach bill images to transactions.',
      },
    },
    android: {
      ...config.android,
      permissions: [
        ...(config.android?.permissions || []),
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'READ_MEDIA_IMAGES',
      ],
    },
  };
};