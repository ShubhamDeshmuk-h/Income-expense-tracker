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
  Modal,
  Platform,
} from 'react-native';
import { supabase, Transaction } from '@/lib/supabase';
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
} from 'lucide-react-native';
import * as XLSX from 'xlsx';
import {
  scheduleMonthlySummaryNotification,
  requestNotificationPermissions,
} from '@/lib/notifications';
import UpdateChecker from '@/components/UpdateChecker';

const PIN_KEY = 'user_pin';
const SETTINGS_KEY = 'user_settings';

interface UserSettings {
  pinHash?: string;
  biometricEnabled: boolean;
  monthlySummaryAlerts: boolean;
  largeTransactionThreshold: number;
  largeTransactionAlerts: boolean;
  lowBalanceThreshold: number;
  lowBalanceAlerts: boolean;
}

export default function Settings() {
  const [settings, setSettings] = useState<UserSettings>({
    biometricEnabled: false,
    monthlySummaryAlerts: true,
    largeTransactionThreshold: 10000,
    largeTransactionAlerts: true,
    lowBalanceThreshold: 1000,
    lowBalanceAlerts: true,
  });
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
  };

  const loadSettings = async () => {
    try {
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      setPinEnabled(!!pin);

      const savedSettings = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: UserSettings) => {
    try {
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      
      // Schedule notifications if monthly alerts are enabled
      if (newSettings.monthlySummaryAlerts) {
        await requestNotificationPermissions();
        await scheduleMonthlySummaryNotification();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleSetPin = async () => {
    if (pinInput.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }

    try {
      // If PIN is already enabled, verify current PIN first
      if (pinEnabled && !settingPin) {
        const currentPin = await SecureStore.getItemAsync(PIN_KEY);
        if (pinInput !== currentPin) {
          Alert.alert('Error', 'Incorrect PIN');
          setPinInput('');
          return;
        }
        // Current PIN verified, now ask for new PIN
        setSettingPin(true);
        setPinInput('');
        return;
      }

      // Setting or confirming new PIN
      if (settingPin) {
        if (pinInput !== confirmPin) {
          Alert.alert('Error', 'PINs do not match');
          return;
        }
        // Save the new PIN
        await SecureStore.setItemAsync(PIN_KEY, pinInput);
        setPinEnabled(true);
        setPinModalVisible(false);
        setPinInput('');
        setConfirmPin('');
        setSettingPin(false);
        Alert.alert('Success', 'PIN set successfully');
      } else {
        // First time setting PIN, move to confirmation
        setSettingPin(true);
        setConfirmPin('');
        const firstPin = pinInput;
        setPinInput('');
        Alert.alert('Confirm PIN', 'Please confirm your PIN');
      }
    } catch (error) {
      console.error('PIN setting error:', error);
      Alert.alert('Error', 'Failed to set PIN');
    }
  };

  const handleDisablePin = async () => {
    Alert.alert(
      'Disable PIN',
      'Are you sure you want to disable PIN protection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync(PIN_KEY);
            setPinEnabled(false);
          },
        },
      ]
    );
  };

  const handleEnableBiometric = async () => {
    if (!biometricAvailable) {
      Alert.alert('Error', 'Biometric authentication is not available on this device');
      return;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric lock',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        await saveSettings({ ...settings, biometricEnabled: true });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to enable biometric authentication');
    }
  };

  const exportToCSV = async () => {
    try {
      setLoading(true);
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        Alert.alert('Info', 'No transactions to export');
        return;
      }

      // Create CSV content
      const headers = ['Date', 'Type', 'Mode', 'Category', 'Amount', 'Note'];
      const csvRows = [headers.join(',')];

      transactions.forEach((t) => {
        const row = [
          t.date,
          t.type,
          t.mode,
          t.category,
          t.amount,
          (t.note || '').replace(/,/g, ';'),
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', `File saved to: ${fileUri}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export transactions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setLoading(true);
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        Alert.alert('Info', 'No transactions to export');
        return;
      }

      // Prepare data for Excel
      const excelData = transactions.map((t) => ({
        Date: t.date,
        Type: t.type,
        Mode: t.mode,
        Category: t.category,
        Amount: t.amount,
        Note: t.note || '',
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

      // Generate base64 string
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = `transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', `File saved to: ${fileUri}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export transactions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    try {
      setLoading(true);
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*');

      if (error) throw error;

      const backup = {
        transactions: transactions || [],
        backupDate: new Date().toISOString(),
        version: '1.0',
      };

      const backupJson = JSON.stringify(backup, null, 2);
      const filename = `backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, backupJson);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', `Backup saved to: ${fileUri}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create backup');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
      });

      if (result.canceled) return;

      Alert.alert(
        'Restore Backup',
        'This will replace all existing transactions. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                const fileContent = await FileSystem.readAsStringAsync(
                  result.assets[0].uri
                );
                const backup = JSON.parse(fileContent);

                if (!backup.transactions || !Array.isArray(backup.transactions)) {
                  Alert.alert('Error', 'Invalid backup file');
                  return;
                }

                // Delete all existing transactions
                const { error: deleteError } = await supabase
                  .from('transactions')
                  .delete()
                  .neq('id', '00000000-0000-0000-0000-000000000000');

                if (deleteError) throw deleteError;

                // Insert backed up transactions
                const { error: insertError } = await supabase
                  .from('transactions')
                  .insert(backup.transactions);

                if (insertError) throw insertError;

                Alert.alert('Success', 'Backup restored successfully');
              } catch (error) {
                Alert.alert('Error', 'Failed to restore backup');
                console.error(error);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to select backup file');
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <SettingsIcon size={24} color="#ffffff" />
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your preferences</Text>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Lock size={20} color="#3b82f6" />
            <Text style={styles.settingLabel}>PIN Lock</Text>
          </View>
          <View style={styles.settingActions}>
            <Text style={styles.settingValue}>
              {pinEnabled ? 'Enabled' : 'Disabled'}
            </Text>
            <TouchableOpacity
              style={styles.settingButton}
              onPress={() => {
                if (pinEnabled) {
                  handleDisablePin();
                } else {
                  setPinModalVisible(true);
                  setSettingPin(false);
                }
              }}>
              <Text style={styles.settingButtonText}>
                {pinEnabled ? 'Change' : 'Enable'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {biometricAvailable && (
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Shield size={20} color="#8b5cf6" />
              <Text style={styles.settingLabel}>Biometric Lock</Text>
            </View>
            <Switch
              value={settings.biometricEnabled}
              onValueChange={(value) => {
                if (value) {
                  handleEnableBiometric();
                } else {
                  saveSettings({ ...settings, biometricEnabled: false });
                }
              }}
            />
          </View>
        )}
      </View>

      {/* Alerts Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alerts & Notifications</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Bell size={20} color="#10b981" />
            <Text style={styles.settingLabel}>Monthly Summary</Text>
          </View>
          <Switch
            value={settings.monthlySummaryAlerts}
            onValueChange={(value) =>
              saveSettings({ ...settings, monthlySummaryAlerts: value })
            }
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Bell size={20} color="#f59e0b" />
            <Text style={styles.settingLabel}>Large Transactions</Text>
          </View>
          <Switch
            value={settings.largeTransactionAlerts}
            onValueChange={(value) =>
              saveSettings({ ...settings, largeTransactionAlerts: value })
            }
          />
        </View>

        {settings.largeTransactionAlerts && (
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Threshold (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settings.largeTransactionThreshold.toString()}
              onChangeText={(text) =>
                saveSettings({
                  ...settings,
                  largeTransactionThreshold: parseFloat(text) || 0,
                })
              }
            />
          </View>
        )}

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Bell size={20} color="#ef4444" />
            <Text style={styles.settingLabel}>Low Balance Alerts</Text>
          </View>
          <Switch
            value={settings.lowBalanceAlerts}
            onValueChange={(value) =>
              saveSettings({ ...settings, lowBalanceAlerts: value })
            }
          />
        </View>

        {settings.lowBalanceAlerts && (
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Threshold (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settings.lowBalanceThreshold.toString()}
              onChangeText={(text) =>
                saveSettings({
                  ...settings,
                  lowBalanceThreshold: parseFloat(text) || 0,
                })
              }
            />
          </View>
        )}
      </View>

      {/* Updates Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Updates</Text>
        <UpdateChecker />
      </View>

      {/* Export & Backup Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export & Backup</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={exportToCSV}
          disabled={loading}>
          <Download size={20} color="#3b82f6" />
          <Text style={styles.actionButtonText}>Export to CSV</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={exportToExcel}
          disabled={loading}>
          <Download size={20} color="#10b981" />
          <Text style={styles.actionButtonText}>Export to Excel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={createBackup}
          disabled={loading}>
          <Upload size={20} color="#8b5cf6" />
          <Text style={styles.actionButtonText}>Create Backup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.restoreButton]}
          onPress={restoreBackup}
          disabled={loading}>
          <Download size={20} color="#ef4444" />
          <Text style={[styles.actionButtonText, styles.restoreButtonText]}>
            Restore Backup
          </Text>
        </TouchableOpacity>
      </View>

      {/* PIN Modal */}
      <Modal
        visible={pinModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setPinModalVisible(false);
          setPinInput('');
          setConfirmPin('');
          setSettingPin(false);
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {settingPin ? 'Confirm PIN' : pinEnabled ? 'Enter Current PIN' : 'Set PIN'}
            </Text>
            <TextInput
              style={styles.pinInput}
              placeholder={settingPin ? 'Confirm PIN' : 'Enter PIN'}
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={6}
            />
            {settingPin && (
              <TextInput
                style={styles.pinInput}
                placeholder="Confirm PIN"
                value={confirmPin}
                onChangeText={setConfirmPin}
                keyboardType="numeric"
                secureTextEntry={!showPin}
                maxLength={6}
              />
            )}
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPin(!showPin)}>
              {showPin ? (
                <EyeOff size={20} color="#6b7280" />
              ) : (
                <Eye size={20} color="#6b7280" />
              )}
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setPinModalVisible(false);
                  setPinInput('');
                  setConfirmPin('');
                  setSettingPin(false);
                }}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleSetPin}>
                <Text style={styles.modalButtonTextConfirm}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#dbeafe',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  settingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  settingButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  settingButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  restoreButton: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  restoreButtonText: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 8,
  },
  eyeButton: {
    alignSelf: 'center',
    padding: 8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  modalButtonConfirm: {
    backgroundColor: '#3b82f6',
  },
  modalButtonTextCancel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

