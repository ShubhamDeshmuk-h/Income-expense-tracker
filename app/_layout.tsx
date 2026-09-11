import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import AuthLock from '@/components/AuthLock';
import Onboarding from '@/components/Onboarding';
import { requestNotificationPermissions } from '@/lib/notifications';
import { initializeDatabase } from '@/lib/db';
import * as SecureStore from 'expo-secure-store';
import {
  ONBOARDING_KEY,
  setCurrencyPreference,
  type CurrencyPreference,
} from '@/lib/preferences';

export default function RootLayout() {
  useFrameworkReady();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Initialize DB and run migrations first
    initializeDatabase().catch(console.error);

    // Check onboarding completion
    SecureStore.getItemAsync(ONBOARDING_KEY)
      .then((value) => setOnboardingComplete(value === 'true'))
      .catch(() => setOnboardingComplete(false));

    // Request notification permissions on app start
    requestNotificationPermissions();
  }, []);

  if (onboardingComplete === null) {
    // Still loading — render nothing (splash handles this)
    return null;
  }

  if (!onboardingComplete) {
    return (
      <SafeAreaProvider>
        <Onboarding
          onDone={async (currency: CurrencyPreference) => {
            await setCurrencyPreference(currency);
            await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
            setOnboardingComplete(true);
          }}
        />
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthLock>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="security-setup" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pin-recovery" options={{ presentation: 'modal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </AuthLock>
    </SafeAreaProvider>
  );
}
