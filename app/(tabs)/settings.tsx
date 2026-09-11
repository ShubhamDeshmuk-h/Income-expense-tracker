import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  Settings as SettingsIcon,
  Lock,
  Bell,
  Download,
  Upload,
  Shield,
  Eye,
  EyeOff,
  Globe,
  Trash2,
} from 'lucide-react-native';
import {
  clearAllTransactions,
  getTransactions,
  mergeTransactions,
} from '@/lib/db';
import {
  scheduleMonthlySummaryNotification,
  requestNotificationPermissions,
} from '@/lib/notifications';
import {
  getCurrencyPreference,
  setCurrencyPreference,
  DEFAULT_CURRENCY,
  ONBOARDING_KEY,
  SETTINGS_KEY,
  PIN_KEY,
  type CurrencyPreference,
} from '@/lib/preferences';
import { CURRENCY_OPTIONS, formatAmount, type CurrencyOption } from '@/lib/currency';
import UpdateChecker from '@/components/UpdateChecker';
import { theme } from '@/lib/theme';

const DEFAULT_SETTINGS = {
  monthlySummaryAlerts: true,
  largeTransactionThreshold: 10000,
  largeTransactionAlerts: true,
  lowBalanceThreshold: 1000,
  lowBalanceAlerts: true,
};

export default function Settings() {
  const insets = useSafeAreaInsets();
  const [currency, setCurrency] = useState<CurrencyOption>(DEFAULT_CURRENCY);
  const [currencySearch, setCurrencySearch] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
    checkBiometrics();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      }
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      setPinEnabled(!!pin);

      const bioEnabled = await SecureStore.getItemAsync('biometric_enabled');
      setBiometricEnabled(bioEnabled === 'true');

      const savedCurrency = await getCurrencyPreference();
      setCurrency(savedCurrency);
    } catch (e) {
      console.error(e);
    }
  };

  const checkBiometrics = async () => {
    const available = await LocalAuthentication.hasHardwareAsync();
    setBiometricAvailable(available);
  };

  const saveSettings = async (next: typeof DEFAULT_SETTINGS) => {
    setSettings(next);
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
    await scheduleMonthlySummaryNotification();
  };

  const toggleSetting = (key: keyof typeof DEFAULT_SETTINGS, val: boolean) => {
    saveSettings({ ...settings, [key]: val });
  };

  const updateThreshold = (key: keyof typeof DEFAULT_SETTINGS, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) saveSettings({ ...settings, [key]: num });
  };

  const handleSaveCurrency = async (opt: CurrencyOption) => {
    await setCurrencyPreference(opt);
    setCurrency(opt);
    Alert.alert('Currency Updated', `Amounts will now show in ${opt.currencyCode}.`);
  };

  const handleSetPin = async () => {
    if (pinInput.length < 4) {
      Alert.alert('Too Short', 'PIN must be at least 4 digits.');
      return;
    }
    if (pinInput !== confirmPin) {
      Alert.alert('Mismatch', 'PINs do not match.');
      return;
    }
    await SecureStore.setItemAsync(PIN_KEY, pinInput);
    setPinEnabled(true);
    setShowPinForm(false);
    setPinInput('');
    setConfirmPin('');
    Alert.alert('PIN Set', 'App lock is now enabled.');
  };

  const handleDisablePin = async () => {
    Alert.alert('Disable PIN', 'Remove PIN lock?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync(PIN_KEY);
          await SecureStore.setItemAsync('biometric_enabled', 'false');
          setPinEnabled(false);
          setBiometricEnabled(false);
        },
      },
    ]);
  };

  const toggleBiometric = async (val: boolean) => {
    if (val && !pinEnabled) {
      Alert.alert('Set PIN First', 'You need to set a PIN before enabling biometrics.');
      return;
    }
    await SecureStore.setItemAsync('biometric_enabled', val ? 'true' : 'false');
    setBiometricEnabled(val);
  };

  const createBackup = async () => {
    setLoading(true);
    try {
      const transactions = await getTransactions();
      const savedSettings = await SecureStore.getItemAsync(SETTINGS_KEY);
      const savedCurrency = await getCurrencyPreference();
      const backup = {
        app: 'VaultFlow',
        version: '2.0',
        backupDate: new Date().toISOString(),
        transactions,
        settings: savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS,
        currency: savedCurrency,
      };

      const path = `${FileSystem.documentDirectory}vaultflow_backup_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Save VaultFlow Backup' });
      } else {
        Alert.alert('Saved', `Backup saved at:\n${path}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create backup.');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled || !result.assets[0]) return;

      Alert.alert('Restore Backup', 'This will merge transactions from the backup file. Duplicates will be skipped. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setLoading(true);
            try {
              const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
              const backup = JSON.parse(content);
              if (!backup.transactions || !Array.isArray(backup.transactions)) {
                Alert.alert('Error', 'Invalid backup file.');
                return;
              }

              const mergeResult = await mergeTransactions(backup.transactions);

              if (backup.settings) {
                await saveSettings({ ...DEFAULT_SETTINGS, ...backup.settings });
              }
              if (backup.currency?.currencyCode) {
                await setCurrencyPreference(backup.currency);
                setCurrency(backup.currency);
              }

              Alert.alert(
                'Restore Complete',
                `Imported: ${mergeResult.imported}\nSkipped duplicates: ${mergeResult.skipped}\nFailed: ${mergeResult.failed}`
              );
            } catch {
              Alert.alert('Error', 'Failed to restore backup.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]);
    } catch {
      Alert.alert('Error', 'Could not open file picker.');
    }
  };

  const resetAllData = () => {
    Alert.alert(
      '⚠️ Reset All Data',
      'This will permanently delete ALL transactions, settings, and preferences. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await clearAllTransactions();
              await SecureStore.deleteItemAsync(PIN_KEY);
              await SecureStore.deleteItemAsync(SETTINGS_KEY);
              await SecureStore.deleteItemAsync(ONBOARDING_KEY);
              await setCurrencyPreference(DEFAULT_CURRENCY);
              setPinEnabled(false);
              setSettings(DEFAULT_SETTINGS);
              setCurrency(DEFAULT_CURRENCY);
              DeviceEventEmitter.emit('vaultflow:data-reset');
              Alert.alert('Done', 'All data has been reset.');
              router.replace('/');
            } catch {
              Alert.alert('Error', 'Reset failed.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const filteredCurrencies = CURRENCY_OPTIONS.filter((opt) => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return true;
    return `${opt.country} ${opt.currencyCode} ${opt.locale}`.toLowerCase().includes(q);
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 80 }}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <SettingsIcon size={24} color="rgba(255,255,255,0.8)" style={{ marginBottom: 4 }} />
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSub}>VaultFlow preferences</Text>
      </LinearGradient>

      <UpdateChecker />

      {/* Currency Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Globe size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Currency</Text>
        </View>
        <Text style={styles.currentCurrency}>
          Current: {currency.country} · {currency.currencyCode} · {formatAmount(1234.56, currency)}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Search country or currency…"
          placeholderTextColor={theme.colors.textMuted}
          value={currencySearch}
          onChangeText={setCurrencySearch}
        />
        <View style={styles.currencyList}>
          {filteredCurrencies.slice(0, currencySearch ? 999 : 6).map((opt) => (
            <TouchableOpacity
              key={`${opt.currencyCode}-${opt.locale}`}
              style={[styles.currencyItem, opt.currencyCode === currency.currencyCode && styles.currencyItemActive]}
              onPress={() => handleSaveCurrency(opt)}>
              <View>
                <Text style={styles.currencyCountry}>{opt.country}</Text>
                <Text style={styles.currencyCode}>{opt.currencyCode} · {opt.currencySymbol}</Text>
              </View>
              {opt.currencyCode === currency.currencyCode && (
                <Text style={styles.selectedBadge}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Bell size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Monthly Summary Alerts</Text>
          <Switch
            value={settings.monthlySummaryAlerts}
            onValueChange={(v) => toggleSetting('monthlySummaryAlerts', v)}
            trackColor={{ true: theme.colors.primary }}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Large Transaction Alerts</Text>
          <Switch
            value={settings.largeTransactionAlerts}
            onValueChange={(v) => toggleSetting('largeTransactionAlerts', v)}
            trackColor={{ true: theme.colors.primary }}
          />
        </View>
        {settings.largeTransactionAlerts && (
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>Threshold ({currency.currencyCode})</Text>
            <TextInput
              style={styles.thresholdInput}
              keyboardType="numeric"
              value={String(settings.largeTransactionThreshold)}
              onChangeText={(v) => updateThreshold('largeTransactionThreshold', v)}
            />
          </View>
        )}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Low Balance Alerts</Text>
          <Switch
            value={settings.lowBalanceAlerts}
            onValueChange={(v) => toggleSetting('lowBalanceAlerts', v)}
            trackColor={{ true: theme.colors.primary }}
          />
        </View>
        {settings.lowBalanceAlerts && (
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>Threshold ({currency.currencyCode})</Text>
            <TextInput
              style={styles.thresholdInput}
              keyboardType="numeric"
              value={String(settings.lowBalanceThreshold)}
              onChangeText={(v) => updateThreshold('lowBalanceThreshold', v)}
            />
          </View>
        )}
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Shield size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Security</Text>
        </View>
        {!pinEnabled ? (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPinForm(!showPinForm)}>
              <Lock size={16} color={theme.colors.primary} />
              <Text style={styles.actionBtnText}>Set PIN Lock</Text>
            </TouchableOpacity>
            {showPinForm && (
              <View style={styles.pinForm}>
                <TextInput
                  style={styles.input}
                  placeholder="New PIN (min 4 digits)"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  secureTextEntry={!showPin}
                  value={pinInput}
                  onChangeText={setPinInput}
                  maxLength={8}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm PIN"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  secureTextEntry={!showPin}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  maxLength={8}
                />
                <View style={styles.pinActions}>
                  <TouchableOpacity
                    style={styles.showPinBtn}
                    onPress={() => setShowPin(!showPin)}>
                    {showPin ? <EyeOff size={16} color={theme.colors.textSecondary} /> : <Eye size={16} color={theme.colors.textSecondary} />}
                    <Text style={styles.showPinText}>{showPin ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSetPin}>
                    <Text style={styles.saveBtnText}>Save PIN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>PIN Lock Active</Text>
              <Text style={styles.settingMeta}>App is locked with PIN</Text>
            </View>
            <TouchableOpacity onPress={handleDisablePin} style={styles.dangerBtn}>
              <Text style={styles.dangerBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        {biometricAvailable && pinEnabled && (
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Biometric Unlock</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>
        )}
      </View>

      {/* Backup Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Download size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Backup & Restore</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={createBackup} disabled={loading}>
          <Download size={16} color={theme.colors.primary} />
          <Text style={styles.actionBtnText}>Create Backup (JSON)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={restoreBackup} disabled={loading}>
          <Upload size={16} color={theme.colors.primary} />
          <Text style={styles.actionBtnText}>Restore from Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.dangerAction]} onPress={resetAllData} disabled={loading}>
          <Trash2 size={16} color={theme.colors.expense} />
          <Text style={[styles.actionBtnText, { color: theme.colors.expense }]}>Reset All Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
    alignItems: 'center',
  },
  headerTitle: { ...theme.typography.title, color: '#fff' },
  headerSub: { ...theme.typography.subtitle, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  section: {
    margin: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
    gap: theme.spacing.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text },
  currentCurrency: { ...theme.typography.label, color: theme.colors.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    ...theme.typography.body,
    color: theme.colors.text,
  },
  currencyList: { gap: 4 },
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currencyItemActive: { borderColor: theme.colors.primary, backgroundColor: '#EEF2FF' },
  currencyCountry: { ...theme.typography.label, color: theme.colors.text },
  currencyCode: { ...theme.typography.caption, color: theme.colors.textMuted },
  selectedBadge: { color: theme.colors.primary, fontWeight: '700', fontSize: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  settingLabel: { ...theme.typography.label, color: theme.colors.text },
  settingMeta: { ...theme.typography.caption, color: theme.colors.textMuted },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  thresholdLabel: { ...theme.typography.label, color: theme.colors.textSecondary, flex: 1 },
  thresholdInput: {
    width: 100,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'right',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtnText: { ...theme.typography.label, color: theme.colors.primary },
  dangerAction: { borderColor: theme.colors.expenseLight },
  pinForm: { gap: theme.spacing.sm },
  pinActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  showPinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  showPinText: { ...theme.typography.label, color: theme.colors.textSecondary },
  saveBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, paddingVertical: 8 },
  saveBtnText: { ...theme.typography.label, color: '#fff' },
  dangerBtn: { backgroundColor: theme.colors.expenseLight, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, paddingVertical: 8 },
  dangerBtnText: { ...theme.typography.label, color: theme.colors.expense },
});
