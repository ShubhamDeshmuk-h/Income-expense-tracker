import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { getBalanceSummary } from './db';
import { formatAmount } from './currency';
import { getCurrencyPreference } from './preferences';

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
    console.warn('Notification permissions not available:', error);
    return false;
  }
}

export async function scheduleMonthlySummaryNotification() {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const settingsJson = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!settingsJson) return;

    const settings: UserSettings = JSON.parse(settingsJson);
    if (!settings.monthlySummaryAlerts) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Monthly Finance Summary',
        body: 'Check your monthly income and expense summary in VaultFlow!',
        sound: true,
      },
      trigger: {
        day: 1,
        hour: 9,
        minute: 0,
        repeats: true,
      } as any,
    });
  } catch (error) {
    console.warn('Error scheduling monthly notification:', error);
  }
}

export async function checkLargeTransaction(amount: number) {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const settingsJson = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!settingsJson) return;

    const settings: UserSettings = JSON.parse(settingsJson);
    if (!settings.largeTransactionAlerts) return;

    if (amount >= settings.largeTransactionThreshold) {
      const currency = await getCurrencyPreference();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Large Transaction Alert',
          body: `A large transaction of ${formatAmount(amount, currency)} was recorded in VaultFlow.`,
          sound: true,
        },
        trigger: null,
      });
    }
  } catch (error) {
    console.warn('Error checking large transaction:', error);
  }
}

export async function checkLowBalance() {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    const settingsJson = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!settingsJson) return;

    const settings: UserSettings = JSON.parse(settingsJson);
    if (!settings.lowBalanceAlerts) return;

    const balances = await getBalanceSummary();
    const total = balances.reduce(
      (sum, b) => sum + Number(b.current_balance),
      0
    );

    if (total < settings.lowBalanceThreshold) {
      const currency = await getCurrencyPreference();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Low Balance Alert',
          body: `Your total balance (${formatAmount(total, currency)}) is below the threshold (${formatAmount(settings.lowBalanceThreshold, currency)}).`,
          sound: true,
        },
        trigger: null,
      });
    }
  } catch (error) {
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
    if (!hasPermission) return;

    const currency = await getCurrencyPreference();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: type === 'income' ? '💚 Income Added' : '🔴 Expense Recorded',
        body: `${category}: ${formatAmount(amount, currency)}`,
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('Error sending transaction notification:', error);
  }
}
