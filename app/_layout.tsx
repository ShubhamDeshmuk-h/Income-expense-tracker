import 'react-native-get-random-values'; // Required for xlsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import AuthLock from '@/components/AuthLock';
import { requestNotificationPermissions } from '@/lib/notifications';
import { checkForUpdates } from '@/lib/updates';
import * as Updates from 'expo-updates';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    // Request notification permissions on app start
    requestNotificationPermissions();

    // Check for updates on app start (only in production)
    if (!__DEV__ && Updates.isEnabled) {
      // Check for updates after a short delay to not block app startup
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <AuthLock>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </AuthLock>
  );
}
