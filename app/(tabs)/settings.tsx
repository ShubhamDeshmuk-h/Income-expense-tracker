import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
  Lock, Bell, Download, Upload, Shield, Globe, Trash2,
  ChevronRight, Database, Info, Fingerprint, RefreshCw,
} from 'lucide-react-native';
import { clearAllTransactions, getTransactionCount } from '@/lib/db';
import {
  scheduleMonthlySummaryNotification, requestNotificationPermissions,
} from '@/lib/notifications';
import {
  getCurrencyPreference, setCurrencyPreference, DEFAULT_CURRENCY,
  ONBOARDING_KEY, SETTINGS_KEY, type CurrencyPreference,
} from '@/lib/preferences';
import { CURRENCY_OPTIONS, formatAmount } from '@/lib/currency';
import {
  isPinSet, getBiometricStatus, setBiometricEnabled, clearPin,
  getBiometricLabel,
} from '@/lib/security';
import {
  createBackup, pickAndValidateBackup, importBackup,
} from '@/lib/backup';
import { theme } from '@/lib/theme';

const DEFAULT_SETTINGS = {
  monthlySummaryAlerts: true,
  largeTransactionThreshold: 10000,
  largeTransactionAlerts: true,
  lowBalanceThreshold: 1000,
  lowBalanceAlerts: true,
};

type Section = 'general' | 'security' | 'backup' | 'notifications' | 'data' | 'about';

export default function Settings() {
  const insets = useSafeAreaInsets();
  const [currency, setCurrencyState] = useState<CurrencyPreference>(DEFAULT_CURRENCY);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [txCount, setTxCount] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<Section | null>('general');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [cur, settingsJson, pinSet, bioStatus, count] = await Promise.all([
      getCurrencyPreference(),
      SecureStore.getItemAsync(SETTINGS_KEY),
      isPinSet(),
      getBiometricStatus(),
      getTransactionCount(),
    ]);
    setCurrencyState(cur);
    setPinEnabled(pinSet);
    setBiometricAvailable(bioStatus.available && bioStatus.enrolled);
    setBiometricEnabledState(bioStatus.enabled);
    setBiometricLabel(getBiometricLabel(bioStatus.type));
    setTxCount(count);
    if (settingsJson) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) }); } catch {}
    }
  };

  const saveSettings = async (next: typeof settings) => {
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
    setSettings(next);
  };

  const toggleSetting = async (key: keyof typeof settings, value: boolean | number) => {
    const next = { ...settings, [key]: value };
    await saveSettings(next);
  };

  const handleCurrencySelect = async (cur: CurrencyPreference) => {
    await setCurrencyPreference(cur);
    setCurrencyState(cur);
    setShowCurrencyPicker(false);
    setCurrencySearch('');
    Alert.alert('Currency Updated', `Now using ${cur.currencyCode} (${cur.currencySymbol})`);
  };

  const handleToggleBiometric = async (val: boolean) => {
    await setBiometricEnabled(val);
    setBiometricEnabledState(val);
  };

  const handleDisablePin = () => {
    Alert.alert(
      'Disable PIN',
      'This will remove PIN protection from VaultFlow. Anyone with access to your device can open the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await clearPin();
            setPinEnabled(false);
            setBiometricEnabledState(false);
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Backup
  // ---------------------------------------------------------------------------

  const handleExportBackup = async () => {
    setLoading('backup');
    try {
      const { backup } = await createBackup({ exportedBy: 'manual', share: true });
      Alert.alert(
        '✅ Backup Created',
        `${backup.metadata.transactionCount} transactions exported.`
      );
    } catch (err) {
      Alert.alert('Backup Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  };

  const handleImportBackup = async () => {
    const picked = await pickAndValidateBackup();
    if (!picked) return;

    const { validation, raw } = picked;

    if (!validation.valid) {
      Alert.alert(
        'Invalid Backup',
        validation.errors.join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }

    const warningText = validation.warnings.length > 0
      ? `\n\nWarnings:\n${validation.warnings.join('\n')}`
      : '';

    const txCount = validation.transactionCount ?? 0;
    Alert.alert(
      'Restore Backup',
      `This backup contains ${txCount} transactions.${warningText}\n\nHow would you like to restore?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge (Keep Existing)',
          onPress: async () => {
            setLoading('restore');
            const result = await importBackup(raw, 'merge');
            setLoading(null);
            if (result.success) {
              Alert.alert('✅ Restore Complete', `Imported: ${result.imported}, Skipped: ${result.skipped}`);
            } else {
              Alert.alert('Restore Failed', result.error ?? 'Unknown error');
            }
          },
        },
        {
          text: 'Replace All',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Replace',
              'This will DELETE all existing transactions and replace with backup data.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Replace',
                  style: 'destructive',
                  onPress: async () => {
                    setLoading('restore');
                    const result = await importBackup(raw, 'replace');
                    setLoading(null);
                    if (result.success) {
                      Alert.alert('✅ Restore Complete', `${result.imported} transactions restored.`);
                    } else {
                      Alert.alert('Restore Failed', result.error ?? 'Unknown error');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Data Reset
  // ---------------------------------------------------------------------------

  const handleResetData = () => {
    Alert.alert(
      '⚠️ Reset All Data',
      'This will permanently delete ALL transactions. This action cannot be undone.\n\nType "DELETE" to confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Deletion',
              'Type DELETE to confirm:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete All',
                  style: 'destructive',
              onPress: async (text: string | undefined) => {
                    if (text?.trim().toUpperCase() !== 'DELETE') {
                      Alert.alert('Cancelled', 'You did not type DELETE correctly.');
                      return;
                    }
                    await clearAllTransactions();
                    setTxCount(0);
                    Alert.alert('✅ Done', 'All transactions have been deleted.');
                  },
                },
              ],
              'plain-text'
            );
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const toggleSection = (s: Section) =>
    setOpenSection((prev) => (prev === s ? null : s));

  const filteredCurrencies = CURRENCY_OPTIONS.filter((c) =>
    c.country.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.currencyCode.toLowerCase().includes(currencySearch.toLowerCase())
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 80 }}
    >
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>{txCount} transactions · {currency.currencyCode}</Text>
      </LinearGradient>

      {/* General */}
      <SettingSection
        title="General"
        icon={Globe}
        open={openSection === 'general'}
        onToggle={() => toggleSection('general')}
      >
        <TouchableOpacity style={styles.row} onPress={() => setShowCurrencyPicker((p) => !p)}>
          <Text style={styles.rowLabel}>Currency</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{currency.currencyCode} ({currency.currencySymbol})</Text>
            <ChevronRight size={16} color={theme.colors.textMuted} />
          </View>
        </TouchableOpacity>

        {showCurrencyPicker && (
          <View style={styles.currencyPicker}>
            <TextInput
              style={styles.currencySearch}
              placeholder="Search currency…"
              placeholderTextColor={theme.colors.textMuted}
              value={currencySearch}
              onChangeText={setCurrencySearch}
            />
            <ScrollView style={{ maxHeight: 240 }}>
              {filteredCurrencies.map((c) => (
                <TouchableOpacity
                  key={c.currencyCode}
                  style={[styles.currencyRow, c.currencyCode === currency.currencyCode && styles.currencyRowActive]}
                  onPress={() => handleCurrencySelect(c)}
                >
                  <Text style={styles.currencyFlag}>{c.currencySymbol}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currencyName}>{c.country}</Text>
                    <Text style={styles.currencyCode}>{c.currencyCode}</Text>
                  </View>
                  {c.currencyCode === currency.currencyCode && (
                    <Text style={styles.currencyCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </SettingSection>

      {/* Security */}
      <SettingSection
        title="Security"
        icon={Shield}
        open={openSection === 'security'}
        onToggle={() => toggleSection('security')}
      >
        <View style={styles.row}>
          <Text style={styles.rowLabel}>PIN Protection</Text>
          <Text style={[styles.badge, { backgroundColor: pinEnabled ? theme.colors.incomeLight : theme.colors.expenseLight, color: pinEnabled ? theme.colors.income : theme.colors.expense }]}>
            {pinEnabled ? 'ON' : 'OFF'}
          </Text>
        </View>

        {pinEnabled ? (
          <>
            {biometricAvailable && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{biometricLabel}</Text>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ true: theme.colors.primary }}
                />
              </View>
            )}
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/security-setup' as any)}
            >
              <Text style={styles.rowLabel}>Change PIN</Text>
              <ChevronRight size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.dangerRow]} onPress={handleDisablePin}>
              <Text style={[styles.rowLabel, { color: theme.colors.expense }]}>Disable PIN</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/security-setup' as any)}
          >
            <Lock size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Set Up PIN Protection</Text>
          </TouchableOpacity>
        )}
      </SettingSection>

      {/* Backup */}
      <SettingSection
        title="Backup & Restore"
        icon={Database}
        open={openSection === 'backup'}
        onToggle={() => toggleSection('backup')}
      >
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleExportBackup}
          disabled={loading === 'backup'}
        >
          {loading === 'backup'
            ? <ActivityIndicator size="small" color="#fff" />
            : <Download size={16} color="#fff" />}
          <Text style={styles.actionBtnText}>Export Backup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={handleImportBackup}
          disabled={loading === 'restore'}
        >
          {loading === 'restore'
            ? <ActivityIndicator size="small" color={theme.colors.primary} />
            : <Upload size={16} color={theme.colors.primary} />}
          <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Restore from Backup</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Info size={14} color={theme.colors.info} />
          <Text style={styles.infoText}>
            Backups include all transactions and settings. PIN and biometric data are never exported.
          </Text>
        </View>
      </SettingSection>

      {/* Notifications */}
      <SettingSection
        title="Notifications"
        icon={Bell}
        open={openSection === 'notifications'}
        onToggle={() => toggleSection('notifications')}
      >
        {[
          { key: 'monthlySummaryAlerts' as const, label: 'Monthly Summary' },
          { key: 'largeTransactionAlerts' as const, label: 'Large Transaction Alerts' },
          { key: 'lowBalanceAlerts' as const, label: 'Low Balance Alerts' },
        ].map(({ key, label }) => (
          <View key={key} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Switch
              value={settings[key] as boolean}
              onValueChange={(v) => toggleSetting(key, v)}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>
        ))}
      </SettingSection>

      {/* Data */}
      <SettingSection
        title="Data"
        icon={Trash2}
        open={openSection === 'data'}
        onToggle={() => toggleSection('data')}
      >
        <View style={styles.infoBox}>
          <Info size={14} color={theme.colors.info} />
          <Text style={styles.infoText}>{txCount} transactions stored locally on your device.</Text>
        </View>
        <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleResetData}>
          <Trash2 size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Delete All Transactions</Text>
        </TouchableOpacity>
      </SettingSection>

      {/* About */}
      <SettingSection
        title="About"
        icon={Info}
        open={openSection === 'about'}
        onToggle={() => toggleSection('about')}
      >
        <View style={styles.aboutCard}>
          <Text style={styles.aboutAppName}>VaultFlow</Text>
          <Text style={styles.aboutVersion}>Version 2.0.0</Text>
          <Text style={styles.aboutTagline}>Your money, your control.</Text>
          <Text style={styles.aboutCopyright}>© 2025 Affor Technologies</Text>
        </View>
      </SettingSection>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Section component
// ---------------------------------------------------------------------------

function SettingSection({
  title, icon: Icon, open, onToggle, children,
}: {
  title: string;
  icon: typeof Globe;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity style={styles.sectionToggle} onPress={onToggle}>
        <View style={[styles.sectionIconBox, { backgroundColor: theme.colors.primary + '18' }]}>
          <Icon size={18} color={theme.colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <ChevronRight
          size={18}
          color={theme.colors.textMuted}
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  title: { ...theme.typography.title, color: '#fff' },
  subtitle: { ...theme.typography.subtitle, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  sectionCard: {
    margin: theme.spacing.md,
    marginBottom: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  sectionToggle: {
    flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: 12,
  },
  sectionIconBox: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text, flex: 1 },
  sectionBody: {
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  dangerRow: { borderBottomWidth: 0 },
  rowLabel: { ...theme.typography.body, color: theme.colors.text, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { ...theme.typography.label, color: theme.colors.textSecondary },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full,
    fontSize: 11, fontWeight: '700',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md, paddingVertical: 12,
    margin: theme.spacing.md, marginTop: theme.spacing.sm,
  },
  actionBtnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5, borderColor: theme.colors.primary,
    marginTop: 0,
  },
  dangerBtn: { backgroundColor: theme.colors.expense },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  infoBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: theme.colors.infoLight,
    margin: theme.spacing.md, marginTop: 0,
    padding: theme.spacing.sm, borderRadius: theme.radius.sm,
  },
  infoText: { ...theme.typography.caption, color: theme.colors.info, flex: 1, lineHeight: 18 },
  currencyPicker: {
    margin: theme.spacing.md, marginTop: 0,
    borderRadius: theme.radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  currencySearch: {
    padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    ...theme.typography.body, color: theme.colors.text,
    backgroundColor: theme.colors.surfaceElevated,
  },
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  currencyRowActive: { backgroundColor: `${theme.colors.primary}15` },
  currencyFlag: { fontSize: 20, width: 28, textAlign: 'center' },
  currencyName: { ...theme.typography.label, color: theme.colors.text },
  currencyCode: { ...theme.typography.caption, color: theme.colors.textMuted },
  currencyCheck: { fontSize: 16, color: theme.colors.primary, fontWeight: '700' },
  aboutCard: { alignItems: 'center', padding: theme.spacing.xl, gap: 4 },
  aboutAppName: { fontSize: 22, fontWeight: '800', color: theme.colors.primary },
  aboutVersion: { ...theme.typography.caption, color: theme.colors.textMuted },
  aboutTagline: { ...theme.typography.body, color: theme.colors.textSecondary, marginTop: 8 },
  aboutCopyright: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 4 },
});
