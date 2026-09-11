import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, BarChart3, Download, Wallet } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CURRENCY_OPTIONS, type CurrencyOption } from '@/lib/currency';

type OnboardingProps = {
  onDone: (currency: CurrencyOption) => void;
};

const FEATURES = [
  {
    Icon: Wallet,
    title: 'Track Every Rupee',
    desc: 'Log cash & bank transactions instantly. Know where your money goes.',
  },
  {
    Icon: BarChart3,
    title: 'Smart Summaries',
    desc: 'Monthly charts, category breakdowns, and balance at a glance.',
  },
  {
    Icon: ShieldCheck,
    title: 'Private & Secure',
    desc: 'PIN & biometric lock. All data stays on your device.',
  },
  {
    Icon: Download,
    title: 'Backup & Restore',
    desc: 'Export as JSON. Restore with smart duplicate detection.',
  },
];

export default function Onboarding({ onDone }: OnboardingProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption>(
    CURRENCY_OPTIONS[0]
  );

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return CURRENCY_OPTIONS;
    return CURRENCY_OPTIONS.filter((option) => {
      const haystack =
        `${option.country} ${option.currencyCode} ${option.currencySymbol} ${option.locale}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query]);

  return (
    <LinearGradient
      colors={['#4F46E5', '#6C63FF', '#8B5CF6']}
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}>
      {/* Logo */}
      <View style={styles.logoRow}>
        <View style={styles.logoCircle}>
          <Wallet size={28} color="#6C63FF" />
        </View>
        <Text style={styles.appName}>VaultFlow</Text>
      </View>

      <Text style={styles.headline}>Your money, your control.</Text>
      <Text style={styles.sub}>
        Track income & expenses with clarity.
      </Text>

      {/* Feature Pills */}
      <View style={styles.featuresGrid}>
        {FEATURES.map(({ Icon, title, desc }) => (
          <View key={title} style={styles.featureCard}>
            <Icon size={20} color="#A5B4FC" />
            <Text style={styles.featureTitle}>{title}</Text>
            <Text style={styles.featureDesc}>{desc}</Text>
          </View>
        ))}
      </View>

      {/* Currency Picker */}
      <View style={styles.pickerBox}>
        <Text style={styles.pickerLabel}>Choose your currency</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search country or currency…"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.listContainer}>
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => `${item.currencyCode}-${item.locale}`}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const selected =
                item.currencyCode === selectedCurrency.currencyCode &&
                item.locale === selectedCurrency.locale;
              return (
                <TouchableOpacity
                  style={[styles.currencyItem, selected && styles.currencyItemSelected]}
                  onPress={() => setSelectedCurrency(item)}
                  activeOpacity={0.7}>
                  <View style={styles.currencyTextBlock}>
                    <Text style={styles.currencyCountry}>{item.country}</Text>
                    <Text style={styles.currencyMeta}>
                      {item.currencyCode} · {item.currencySymbol}
                    </Text>
                  </View>
                  {selected && (
                    <View style={styles.checkBadge}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No matches — try another term.</Text>
            }
          />
        </View>
        <Text style={styles.selectedLabel}>
          Selected: {selectedCurrency.country} ({selectedCurrency.currencyCode})
        </Text>
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => onDone(selectedCurrency)}
        activeOpacity={0.85}>
        <Text style={styles.ctaText}>Get Started →</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  featureCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  featureDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 15,
  },
  pickerBox: {
    flex: 1,
    minHeight: 0,
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
  },
  listContainer: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    maxHeight: 180,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  currencyItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  currencyTextBlock: {
    flex: 1,
  },
  currencyCountry: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  currencyMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '700',
  },
  selectedLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    padding: 16,
  },
  cta: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C63FF',
    letterSpacing: 0.2,
  },
});
