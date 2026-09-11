import { CurrencyPreference, DEFAULT_CURRENCY } from './preferences';

export type CurrencyOption = CurrencyPreference;

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { country: 'India', currencyCode: 'INR', currencySymbol: '₹', locale: 'en-IN' },
  { country: 'United States', currencyCode: 'USD', currencySymbol: '$', locale: 'en-US' },
  { country: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£', locale: 'en-GB' },
  { country: 'European Union', currencyCode: 'EUR', currencySymbol: '€', locale: 'de-DE' },
  { country: 'Japan', currencyCode: 'JPY', currencySymbol: '¥', locale: 'ja-JP' },
  { country: 'Canada', currencyCode: 'CAD', currencySymbol: 'CA$', locale: 'en-CA' },
  { country: 'Australia', currencyCode: 'AUD', currencySymbol: 'A$', locale: 'en-AU' },
  { country: 'Singapore', currencyCode: 'SGD', currencySymbol: 'S$', locale: 'en-SG' },
  { country: 'United Arab Emirates', currencyCode: 'AED', currencySymbol: 'د.إ', locale: 'ar-AE' },
  { country: 'Saudi Arabia', currencyCode: 'SAR', currencySymbol: '﷼', locale: 'ar-SA' },
  { country: 'Switzerland', currencyCode: 'CHF', currencySymbol: 'Fr.', locale: 'de-CH' },
  { country: 'China', currencyCode: 'CNY', currencySymbol: '¥', locale: 'zh-CN' },
  { country: 'South Korea', currencyCode: 'KRW', currencySymbol: '₩', locale: 'ko-KR' },
  { country: 'Brazil', currencyCode: 'BRL', currencySymbol: 'R$', locale: 'pt-BR' },
  { country: 'Mexico', currencyCode: 'MXN', currencySymbol: 'MX$', locale: 'es-MX' },
  { country: 'Russia', currencyCode: 'RUB', currencySymbol: '₽', locale: 'ru-RU' },
  { country: 'South Africa', currencyCode: 'ZAR', currencySymbol: 'R', locale: 'en-ZA' },
  { country: 'Nigeria', currencyCode: 'NGN', currencySymbol: '₦', locale: 'en-NG' },
  { country: 'Pakistan', currencyCode: 'PKR', currencySymbol: '₨', locale: 'ur-PK' },
  { country: 'Bangladesh', currencyCode: 'BDT', currencySymbol: '৳', locale: 'bn-BD' },
  { country: 'Indonesia', currencyCode: 'IDR', currencySymbol: 'Rp', locale: 'id-ID' },
  { country: 'Malaysia', currencyCode: 'MYR', currencySymbol: 'RM', locale: 'ms-MY' },
  { country: 'Thailand', currencyCode: 'THB', currencySymbol: '฿', locale: 'th-TH' },
  { country: 'Philippines', currencyCode: 'PHP', currencySymbol: '₱', locale: 'fil-PH' },
  { country: 'Vietnam', currencyCode: 'VND', currencySymbol: '₫', locale: 'vi-VN' },
  { country: 'New Zealand', currencyCode: 'NZD', currencySymbol: 'NZ$', locale: 'en-NZ' },
];

export function formatAmount(
  amount: number,
  preference: CurrencyPreference = DEFAULT_CURRENCY
): string {
  try {
    return new Intl.NumberFormat(preference.locale, {
      style: 'currency',
      currency: preference.currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${preference.currencySymbol}${amount.toFixed(2)}`;
  }
}
