import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Vibration,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  isPinSet,
  verifyPin,
  getBiometricStatus,
  getBiometricLabel,
  authenticateWithBiometrics,
  type BiometricType,
} from '@/lib/security';
import { theme } from '@/lib/theme';

interface AuthLockProps {
  children: React.ReactNode;
}

const PIN_LENGTH = 6;

type LockState = 'loading' | 'unlocked' | 'locked' | 'locked_out';

export default function AuthLock({ children }: AuthLockProps) {
  const insets = useSafeAreaInsets();
  const [lockState, setLockState] = useState<LockState>('loading');
  const [pinDigits, setPinDigits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [lockoutMs, setLockoutMs] = useState(0);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockoutMs <= 0) return;
    const interval = setInterval(() => {
      setLockoutMs((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          setLockState('locked');
          setError(null);
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutMs]);

  const checkAuthStatus = async () => {
    try {
      const pinSet = await isPinSet();
      if (!pinSet) {
        setLockState('unlocked');
        return;
      }

      const bioStatus = await getBiometricStatus();
      setBiometricType(bioStatus.type);
      setBiometricEnabled(bioStatus.enabled);

      setLockState('locked');

      if (bioStatus.enabled) {
        setTimeout(() => tryBiometric(bioStatus.type), 400);
      }
    } catch {
      setLockState('unlocked'); // Fail open to avoid lockout on error
    }
  };

  const tryBiometric = async (type: BiometricType) => {
    const label = getBiometricLabel(type);
    const success = await authenticateWithBiometrics(label);
    if (success) {
      setLockState('unlocked');
    }
  };

  const handleDigitPress = async (digit: string) => {
    if (lockState !== 'locked') return;
    const next = [...pinDigits, digit];
    setPinDigits(next);

    if (next.length === PIN_LENGTH) {
      await submitPin(next.join(''));
    }
  };

  const handleBackspace = () => {
    setPinDigits((prev) => prev.slice(0, -1));
    setError(null);
  };

  const submitPin = async (pin: string) => {
    const result = await verifyPin(pin);
    if (result.success) {
      setLockState('unlocked');
      setError(null);
      setPinDigits([]);
    } else if (result.lockedOut) {
      setLockState('locked_out');
      setLockoutMs(result.lockoutRemainingMs);
      setPinDigits([]);
      triggerShake();
    } else {
      setPinDigits([]);
      triggerShake();
      Vibration.vibrate(200);
      const remaining = result.attemptsRemaining;
      if (remaining <= 3) {
        setError(`Incorrect PIN — ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining`);
      } else {
        setError('Incorrect PIN');
      }
      setAttemptsRemaining(remaining);
    }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  if (lockState === 'loading') return null;
  if (lockState === 'unlocked') return <>{children}</>;

  const lockoutSeconds = Math.ceil(lockoutMs / 1000);
  const lockoutLabel = lockoutSeconds >= 60
    ? `${Math.floor(lockoutSeconds / 60)}m ${lockoutSeconds % 60}s`
    : `${lockoutSeconds}s`;

  return (
    <LinearGradient
      colors={[theme.colors.primaryDark, theme.colors.primary, '#8B5CF6']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>V</Text>
        </View>
        <Text style={styles.appName}>VaultFlow</Text>
        <Text style={styles.subtitle}>
          {lockState === 'locked_out' ? 'Too many failed attempts' : 'Enter your PIN to continue'}
        </Text>
      </View>

      {lockState === 'locked_out' ? (
        <View style={styles.lockoutBox}>
          <Text style={styles.lockoutIcon}>🔒</Text>
          <Text style={styles.lockoutTitle}>Account Locked</Text>
          <Text style={styles.lockoutBody}>
            Try again in {lockoutLabel}
          </Text>
          <TouchableOpacity
            style={styles.recoveryBtn}
            onPress={() => router.push('/pin-recovery' as any)}
          >
            <Text style={styles.recoveryBtnText}>Forgot PIN?</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* PIN dots */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pinDigits.length ? styles.dotFilled : styles.dotEmpty,
                ]}
              />
            ))}
          </Animated.View>

          {/* Error */}
          {error && (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}

          {/* Numeric keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['bio', '0', 'del'],
            ].map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((key) => {
                  if (key === 'bio') {
                    if (!biometricEnabled || biometricType === 'none') {
                      return <View key={key} style={styles.keyPlaceholder} />;
                    }
                    const label = getBiometricLabel(biometricType);
                    const icon = biometricType === 'face' ? '👤' : '👆';
                    return (
                      <TouchableOpacity
                        key={key}
                        style={styles.keySpecial}
                        onPress={() => tryBiometric(biometricType)}
                        accessibilityLabel={label}
                      >
                        <Text style={styles.keySpecialIcon}>{icon}</Text>
                        <Text style={styles.keySpecialLabel}>{label}</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (key === 'del') {
                    return (
                      <TouchableOpacity
                        key={key}
                        style={styles.keySpecial}
                        onPress={handleBackspace}
                        accessibilityLabel="Delete last digit"
                      >
                        <Text style={styles.keySpecialIcon}>⌫</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.key}
                      onPress={() => handleDigitPress(key)}
                      accessibilityLabel={`Digit ${key}`}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.keyText}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Forgot PIN */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push('/pin-recovery' as any)}
          >
            <Text style={styles.forgotBtnText}>Forgot PIN?</Text>
          </TouchableOpacity>
        </>
      )}
    </LinearGradient>
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  dotFilled: {
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  keypad: {
    gap: 16,
    alignItems: 'center',
  },
  keyRow: {
    flexDirection: 'row',
    gap: 20,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '500',
    color: '#fff',
  },
  keySpecial: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keySpecialIcon: {
    fontSize: 22,
  },
  keySpecialLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  keyPlaceholder: {
    width: KEY_SIZE,
    height: KEY_SIZE,
  },
  forgotBtn: {
    padding: 12,
  },
  forgotBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  lockoutBox: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 32,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    width: '100%',
  },
  lockoutIcon: { fontSize: 48 },
  lockoutTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  lockoutBody: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  recoveryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  recoveryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
