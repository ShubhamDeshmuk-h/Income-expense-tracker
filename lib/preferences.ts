import * as SecureStore from 'expo-secure-store';

export const ONBOARDING_KEY = 'vaultflow_onboarding_complete';
export const SETTINGS_KEY = 'user_settings';
export const CURRENCY_PREFS_KEY = 'vaultflow_currency_preferences';
export const PIN_KEY = 'vaultflow_pin';

export type CurrencyPreference = {
  country: string;
  currencyCode: string;
  currencySymbol: string;
  locale: string;
};

export const DEFAULT_CURRENCY: CurrencyPreference = {
  country: 'India',
  currencyCode: 'INR',
  currencySymbol: '₹',
  locale: 'en-IN',
};

export async function getCurrencyPreference(): Promise<CurrencyPreference> {
  try {
    const raw = await SecureStore.getItemAsync(CURRENCY_PREFS_KEY);
    if (!raw) return DEFAULT_CURRENCY;
    const parsed = JSON.parse(raw) as Partial<CurrencyPreference>;
    if (!parsed.currencyCode || !parsed.locale || !parsed.country) {
      return DEFAULT_CURRENCY;
    }
    return {
      country: parsed.country,
      currencyCode: parsed.currencyCode,
      currencySymbol: parsed.currencySymbol || parsed.currencyCode,
      locale: parsed.locale,
    };
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export async function setCurrencyPreference(pref: CurrencyPreference) {
  await SecureStore.setItemAsync(CURRENCY_PREFS_KEY, JSON.stringify(pref));
}
