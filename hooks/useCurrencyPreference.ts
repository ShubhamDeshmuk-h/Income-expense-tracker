import { useEffect, useState } from 'react';
import {
  DEFAULT_CURRENCY,
  getCurrencyPreference,
  type CurrencyPreference,
} from '@/lib/preferences';

export function useCurrencyPreference() {
  const [currency, setCurrency] = useState<CurrencyPreference>(DEFAULT_CURRENCY);

  useEffect(() => {
    getCurrencyPreference()
      .then(setCurrency)
      .catch(() => setCurrency(DEFAULT_CURRENCY));
  }, []);

  return currency;
}
