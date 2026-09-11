import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  getRecoveryQuestions, verifyRecoveryAnswers,
  savePin, getBiometricStatus, getBiometricLabel, authenticateWithBiometrics,
  clearPin,
} from '@/lib/security';
import { theme } from '@/lib/theme';

type Step = 'choose' | 'biometric' | 'questions' | 'new-pin' | 'confirm-pin';

const PIN_LENGTH = 6;

export default function PinRecovery() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('choose');
  const [questions, setQuestions] = useState<{ q1: string | null; q2: string | null }>({ q1: null, q2: null });
  const [a1, setA1] = useState('');
  const [a2, setA2] = useState('');
  const [activeAnswer, setActiveAnswer] = useState<1 | 2>(1);
  const [currentInput, setCurrentInput] = useState('');
  const [newPin, setNewPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const q = await getRecoveryQuestions();
    setQuestions(q);
    const bio = await getBiometricStatus();
    setBiometricAvailable(bio.available && bio.enrolled);
  };

  const handleDigit = (digit: string) => {
    const target = step === 'new-pin' ? newPin : step === 'confirm-pin' ? currentInput : currentInput;
    const next = target + digit;
    if (next.length > PIN_LENGTH) return;

    if (step === 'new-pin') {
      setNewPin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => { setStep('confirm-pin'); setCurrentInput(''); }, 200);
      }
    } else if (step === 'confirm-pin') {
      setCurrentInput(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => handleConfirmPin(next), 200);
      }
    } else {
      setCurrentInput(next);
    }
  };

  const handleBackspace = () => {
    if (step === 'new-pin') setNewPin((p) => p.slice(0, -1));
    else setCurrentInput((p) => p.slice(0, -1));
  };

  const handleBiometricRecovery = async () => {
    const bio = await getBiometricStatus();
    const success = await authenticateWithBiometrics(getBiometricLabel(bio.type));
    if (success) {
      await clearPin();
      setStep('new-pin');
    } else {
      Alert.alert('Failed', 'Biometric authentication failed. Try recovery questions instead.');
    }
  };

  const handleVerifyAnswers = async () => {
    if (a1.trim().length < 2 || a2.trim().length < 2) {
      setError('Please answer both questions.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await verifyRecoveryAnswers(a1.trim(), a2.trim());
      if (result.success) {
        await clearPin();
        setStep('new-pin');
      } else if (result.lockedOut) {
        Alert.alert(
          'Too Many Attempts',
          'You have been locked out for 24 hours due to too many incorrect answers.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        setAttemptsRemaining(result.attemptsRemaining);
        setError(`Incorrect answers. ${result.attemptsRemaining} attempt(s) remaining.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPin = async (confirm: string) => {
    if (confirm !== newPin) {
      Alert.alert('PINs Do Not Match', 'Please try again.');
      setNewPin('');
      setCurrentInput('');
      setStep('new-pin');
      return;
    }
    setLoading(true);
    try {
      await savePin(newPin);
      Alert.alert(
        '✅ PIN Reset',
        'Your new PIN has been set successfully.',
        [{ text: 'Continue', onPress: () => router.replace('/' as any) }]
      );
    } catch {
      Alert.alert('Error', 'Could not save new PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderKeypad = (activePin: string) => (
    <View style={styles.keypad}>
      <View style={styles.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.dot, i < activePin.length ? styles.dotFilled : styles.dotEmpty]} />
        ))}
      </View>
      {[['1','2','3'],['4','5','6'],['7','8','9'],['','0','del']].map((row, ri) => (
        <View key={ri} style={styles.keyRow}>
          {row.map((key, ki) => {
            if (key === '') return <View key={ki} style={styles.keyPlaceholder} />;
            if (key === 'del') {
              return (
                <TouchableOpacity key={ki} style={styles.keySpecial} onPress={handleBackspace}>
                  <Text style={styles.keySpecialText}>⌫</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={ki} style={styles.key} onPress={() => handleDigit(key)}>
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  return (
    <LinearGradient
      colors={[theme.colors.primaryDark, theme.colors.primary]}
      style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Choose recovery method */}
        {step === 'choose' && (
          <>
            <Text style={styles.title}>Recover Access</Text>
            <Text style={styles.subtitle}>Choose how to verify your identity</Text>
            <View style={styles.optionList}>
              {biometricAvailable && (
                <TouchableOpacity style={styles.optionCard} onPress={handleBiometricRecovery}>
                  <Text style={styles.optionIcon}>👆</Text>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Biometric Verification</Text>
                    <Text style={styles.optionBody}>Use fingerprint or Face ID to reset your PIN</Text>
                  </View>
                </TouchableOpacity>
              )}
              {questions.q1 && (
                <TouchableOpacity style={styles.optionCard} onPress={() => setStep('questions')}>
                  <Text style={styles.optionIcon}>💬</Text>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Recovery Questions</Text>
                    <Text style={styles.optionBody}>Answer your security questions to reset your PIN</Text>
                  </View>
                </TouchableOpacity>
              )}
              {!biometricAvailable && !questions.q1 && (
                <View style={styles.noRecoveryBox}>
                  <Text style={styles.noRecoveryText}>
                    No recovery methods are configured. You will need to reinstall the app to regain access.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Answer recovery questions */}
        {step === 'questions' && (
          <>
            <Text style={styles.title}>Security Questions</Text>
            <Text style={styles.subtitle}>Answer both questions to verify your identity</Text>

            {questions.q1 && (
              <View style={styles.qBlock}>
                <Text style={styles.qLabel}>Question 1</Text>
                <Text style={styles.qText}>{questions.q1}</Text>
                <TouchableOpacity
                  style={[styles.answerInput, activeAnswer === 1 && styles.answerInputActive]}
                  onPress={() => setActiveAnswer(1)}
                >
                  <Text style={styles.answerInputText}>{a1 || 'Tap to answer…'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {questions.q2 && (
              <View style={styles.qBlock}>
                <Text style={styles.qLabel}>Question 2</Text>
                <Text style={styles.qText}>{questions.q2}</Text>
                <TouchableOpacity
                  style={[styles.answerInput, activeAnswer === 2 && styles.answerInputActive]}
                  onPress={() => setActiveAnswer(2)}
                >
                  <Text style={styles.answerInputText}>{a2 || 'Tap to answer…'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Simple alpha keypad for answers */}
            <View style={styles.alphaKeypad}>
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789'.split('').map((c) => (
                <TouchableOpacity
                  key={c}
                  style={styles.alphaKey}
                  onPress={() => {
                    if (activeAnswer === 1) setA1((p) => p + c);
                    else setA2((p) => p + c);
                  }}
                >
                  <Text style={styles.alphaKeyText}>{c === ' ' ? '⎵' : c}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.alphaKey}
                onPress={() => {
                  if (activeAnswer === 1) setA1((p) => p.slice(0, -1));
                  else setA2((p) => p.slice(0, -1));
                }}
              >
                <Text style={styles.alphaKeyText}>⌫</Text>
              </TouchableOpacity>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyAnswers}>
                <Text style={styles.verifyBtnText}>Verify & Reset PIN</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* New PIN */}
        {step === 'new-pin' && (
          <>
            <Text style={styles.title}>Set New PIN</Text>
            <Text style={styles.subtitle}>Choose a new 6-digit PIN</Text>
            {renderKeypad(newPin)}
          </>
        )}

        {/* Confirm new PIN */}
        {step === 'confirm-pin' && (
          <>
            <Text style={styles.title}>Confirm New PIN</Text>
            <Text style={styles.subtitle}>Re-enter your new PIN</Text>
            {loading
              ? <ActivityIndicator color="#fff" size="large" />
              : renderKeypad(currentInput)}
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const KEY_SIZE = 68;
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  backBtn: { paddingVertical: 8 },
  backBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  optionList: { width: '100%', gap: 12 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.15)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  optionIcon: { fontSize: 36 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  optionBody: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  noRecoveryBox: { backgroundColor: 'rgba(255,80,80,0.2)', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,100,100,0.3)' },
  noRecoveryText: { color: '#fff', textAlign: 'center', lineHeight: 22 },
  qBlock: { width: '100%', gap: 6 },
  qLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  qText: { fontSize: 14, color: '#fff', lineHeight: 20 },
  answerInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  answerInputActive: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.18)' },
  answerInputText: { color: '#fff', fontSize: 15 },
  alphaKeypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', width: '100%' },
  alphaKey: { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  alphaKeyText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  errorText: { color: '#FFD700', fontSize: 14, textAlign: 'center' },
  verifyBtn: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  verifyBtnText: { color: theme.colors.primary, fontSize: 16, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)' },
  dotFilled: { backgroundColor: '#fff' },
  keypad: { gap: 14, alignItems: 'center' },
  keyRow: { flexDirection: 'row', gap: 16 },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  keyText: { fontSize: 24, fontWeight: '500', color: '#fff' },
  keySpecial: { width: KEY_SIZE, height: KEY_SIZE, justifyContent: 'center', alignItems: 'center' },
  keySpecialText: { fontSize: 20, color: '#fff' },
  keyPlaceholder: { width: KEY_SIZE, height: KEY_SIZE },
});
