import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Lock, Eye, EyeOff, Shield } from 'lucide-react-native';

const PIN_KEY = 'user_pin';
const SETTINGS_KEY = 'user_settings';

interface UserSettings {
  biometricEnabled: boolean;
}

interface AuthLockProps {
  children: React.ReactNode;
}

export default function AuthLock({ children }: AuthLockProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      const settingsJson = await SecureStore.getItemAsync(SETTINGS_KEY);
      
      if (!storedPin) {
        // No PIN set, no lock needed
        setIsLocked(false);
        return;
      }

      // Check if biometric is available and enabled
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      if (settingsJson) {
        const settings: UserSettings = JSON.parse(settingsJson);
        setBiometricEnabled(settings.biometricEnabled || false);

        // Try biometric first if enabled
        if (settings.biometricEnabled && compatible && enrolled) {
          tryBiometric();
          return;
        }
      }

      // PIN is set, show lock screen
      setIsLocked(true);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsLocked(false);
    }
  };

  const tryBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Finance Tracker',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use PIN',
      });

      if (result.success) {
        setIsLocked(false);
        setError(null);
      } else if (result.error === 'user_fallback') {
        // User chose to use PIN instead
        setIsLocked(true);
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setIsLocked(true);
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    try {
      const storedPin = await SecureStore.getItemAsync(PIN_KEY);
      if (pin === storedPin) {
        setIsLocked(false);
        setPin('');
        setError(null);
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    } catch (error) {
      setError('Authentication failed');
      console.error(error);
    }
  };

  const handleBiometricPress = async () => {
    if (biometricAvailable && biometricEnabled) {
      await tryBiometric();
    }
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <Modal visible={isLocked} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Lock size={48} color="#3b82f6" />
          </View>
          <Text style={styles.title}>Finance Tracker</Text>
          <Text style={styles.subtitle}>Enter your PIN to continue</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.pinContainer}>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={setPin}
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={6}
              autoFocus
              onSubmitEditing={handlePinSubmit}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPin(!showPin)}>
              {showPin ? (
                <EyeOff size={20} color="#6b7280" />
              ) : (
                <Eye size={20} color="#6b7280" />
              )}
            </TouchableOpacity>
          </View>

          {biometricAvailable && biometricEnabled && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricPress}>
              <Shield size={24} color="#3b82f6" />
              <Text style={styles.biometricButtonText}>
                Use Biometric Authentication
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.unlockButton}
            onPress={handlePinSubmit}>
            <Text style={styles.unlockButtonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  pinContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: 24,
  },
  pinInput: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  biometricButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  unlockButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  unlockButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

