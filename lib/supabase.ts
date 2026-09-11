import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';

// Prefer values provided via Expo config extra (app.config.js/app.json) and
// fall back to process.env for other environments. This makes `.env` work
// during development when using the added `app.config.js` that loads it.
const supabaseUrl =
  (Constants.expoConfig && Constants.expoConfig.extra?.EXPO_PUBLIC_SUPABASE_URL) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  (Constants.expoConfig && Constants.expoConfig.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Friendly developer message — this won't crash the app but will make it
  // obvious in logs why requests to Supabase fail.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env or app config.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Transaction = {
  id: string;
  type: 'income' | 'expense';
  mode: 'cash' | 'bank';
  category: string;
  amount: number;
  date: string;
  note: string;
  attachment_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type Balance = {
  id: string;
  mode: 'cash' | 'bank';
  total_income: number;
  total_expense: number;
  current_balance: number;
  updated_at: string;
};
