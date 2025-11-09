import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { supabase, Transaction, Balance } from './supabase';

const SETTINGS_KEY = 'user_settings';

interface UserSettings {
  monthlySummaryAlerts: boolean;
  largeTransactionThreshold: number;
  largeTransactionAlerts: boolean;
  lowBalanceThreshold: number;
  lowBalanceAlerts: boolean;
}

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    // In Expo Go, notifications may not be fully supported
    // Return false but don't throw error
    console.warn('Notification permissions not available in Expo Go:', error);
    return false;
  }
}

export async function scheduleMonthlySummaryNotification() {
  try {
    // Check if notifications are available (not in Expo Go)
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Notifications not available - requires development build');
      return;
    }

    const settingsJson = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!settingsJson) return;

    const settings: UserSettings = JSON.parse(settingsJson);
    if (!settings.monthlySummaryAlerts) return;

    // Cancel existing monthly notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule for the 1st of each month at 9 AM
    const trigger = {
      day: 1,
      hour: 9,
      minute: 0,
      repeats: true,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Monthly Finance Summary',
        body: 'Check your monthly income and expense summary!',
        sound: true,
      },
      trigger,
    });
  } catch (error) {
    // Silently fail in Expo Go - notifications require development build
    console.warn('Error scheduling monthly notification (may require development build):', error);
  }
}

export async function checkLargeTransaction(amount: number) {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return; // Silently fail in Expo Go

    const settingsJson = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!settingsJson) return;

    const settings: UserSettings = JSON.parse(settingsJson);
    if (!settings.largeTransactionAlerts) return;

    if (amount >= settings.largeTransactionThreshold) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Large Transaction Alert',
          body: `A large transaction of ₹${amount.toFixed(2)} was recorded.`,
          sound: true,
        },
        trigger: null, // Show immediately
      });
    }
  } catch (error) {
    // Silently fail - notifications require development build
    console.warn('Error checking large transaction:', error);
  }
}

export async function checkLowBalance() {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return; // Silently fail in Expo Go

    const settingsJson = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!settingsJson) return;

    const settings: UserSettings = JSON.parse(settingsJson);
    if (!settings.lowBalanceAlerts) return;

    const { data: balances, error } = await supabase
      .from('balances')
      .select('*');

    if (error) throw error;

    if (balances) {
      const cashBalance = balances.find((b) => b.mode === 'cash');
      const bankBalance = balances.find((b) => b.mode === 'bank');

      const cash = cashBalance ? Number(cashBalance.current_balance) : 0;
      const bank = bankBalance ? Number(bankBalance.current_balance) : 0;
      const total = cash + bank;

      if (total < settings.lowBalanceThreshold) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Low Balance Alert',
            body: `Your total balance (₹${total.toFixed(2)}) is below the threshold (₹${settings.lowBalanceThreshold.toFixed(2)}).`,
            sound: true,
          },
          trigger: null, // Show immediately
        });
      }
    }
  } catch (error) {
    // Silently fail - notifications require development build
    console.warn('Error checking low balance:', error);
  }
}

export async function sendTransactionNotification(
  type: 'income' | 'expense',
  amount: number,
  category: string
) {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return; // Silently fail in Expo Go

    await Notifications.scheduleNotificationAsync({
      content: {
        title: type === 'income' ? 'Income Added' : 'Expense Recorded',
        body: `${category}: ₹${amount.toFixed(2)}`,
        sound: true,
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    // Silently fail - notifications require development build
    console.warn('Error sending transaction notification:', error);
  }
}

