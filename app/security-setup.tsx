import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  savePin,
  setBiometricEnabled,
  getBiometricStatus,
  getBiometricLabel,
  authenticateWithBiometrics,
  saveRecoveryAnswers,
  RECOVERY_QUESTIONS,
} from '@/lib/security';
import { theme } from '@/lib/theme';

type Step = 'pin' | 'confirm' | 'recovery1' | 'recovery2' | 'biometric' | 'done';

const PIN_LENGTH = 6;

export default function SecuritySetup({ onDone }: { onDone?: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [q1Index, setQ1Index] = useState(0);
  const [a1, setA1] = useState('');
  const [q2Index, setQ2Index] = useState(1);
  const [a2, setA2] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricTypeState] = useState<string>('Biometric');
  const [currentInput, setCurrentInput] = useState('');

  const steps: Record<Step, { title: string; subtitle: string }> = {
    pin: { title: 'Create PIN', subtitle: 'Choose a 6-digit PIN to protect VaultFlow' },
    confirm: { title: 'Confirm PIN', subtitle: 'Re-enter your PIN to confirm' },
    recovery1: { title: 'Recovery Question 1', subtitle: 'Helps you recover your PIN if forgotten' },
    recovery2: { title: 'Recovery Question 2', subtitle: 'A second question for added security' },
    biometric: { title: 'Biometric Unlock', subtitle: 'Enable faster access with biometrics' },
    done: { title: 'All Set!', subtitle: 'Your VaultFlow is now secured' },
  };

  const stepOrder: Step[] = ['pin', 'confirm', 'recovery1', 'recovery2', 'biometric', 'done'];
  const currentStepIndex = stepOrder.indexOf(step);
  const progress = ((currentStepIndex + 1) / stepOrder.length) * 100;

  const handleDigit = (digit: string) => {
    if (step === 'pin' || step === 'confirm') {
      const next = (step === 'pin' ? pin : confirmPin) + digit;
      if (next.length > PIN_LENGTH) return;
      step === 'pin' ? setPin(next) : setConfirmPin(next);
      if (next.length === PIN_LENGTH) {
        setTimeout(() => handlePinComplete(next), 200);
      }
    } else {
      setCurrentInput((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    if (step === 'pin') setPin((p) => p.slice(0, -1));
    else if (step === 'confirm') setConfirmPin((p) => p.slice(0, -1));
    else setCurrentInput((p) => p.slice(0, -1));
  };

  const handlePinComplete = (entered: string) => {
    if (step === 'pin') {
      setStep('confirm');
    } else if (step === 'confirm') {
      if (entered !== pin) {
        Alert.alert('PINs Do Not Match', 'Please try again.');
        setPin('');
        setConfirmPin('');
        setStep('pin');
      } else {
        advanceFromConfirm();
      }
    }
  };

  const advanceFromConfirm = async () => {
    setLoading(true);
    try {
      await savePin(pin);
      setStep('recovery1');
    } catch (err) {
      Alert.alert('Error', 'Could not save PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery1Next = () => {
    if (currentInput.trim().length < 3) {
      Alert.alert('Too Short', 'Please enter a more complete answer.');
      return;
    }
    setA1(currentInput.trim());
    setCurrentInput('');
    setStep('recovery2');
  };

  const handleRecovery2Next = async () => {
    if (currentInput.trim().length < 3) {
      Alert.alert('Too Short', 'Please enter a more complete answer.');
      return;
    }
    setA2(currentInput.trim());
    setLoading(true);
    try {
      await saveRecoveryAnswers(
        RECOVERY_QUESTIONS[q1Index],
        a1,
        RECOVERY_QUESTIONS[q2Index],
        currentInput.trim()
      );
      const bioStatus = await getBiometricStatus();
      if (bioStatus.available && bioStatus.enrolled) {
        setBiometricAvailable(true);
        setBiometricTypeState(getBiometricLabel(bioStatus.type));
        setStep('biometric');
      } else {
        setStep('done');
      }
    } catch {
      Alert.alert('Error', 'Could not save recovery answers.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    const bioStatus = await getBiometricStatus();
    const success = await authenticateWithBiometrics(getBiometricLabel(bioStatus.type));
    if (success) {
      await setBiometricEnabled(true);
    }
    setStep('done');
  };

  const handleDone = () => {
    if (onDone) onDone();
    else router.replace('/' as any);
  };

  const currentPin = step === 'pin' ? pin : step === 'confirm' ? confirmPin : '';
  const stepInfo = steps[step];

  return (
    <LinearGradient
      colors={[theme.colors.primaryDark, theme.colors.primary]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{stepInfo.title}</Text>
        <Text style={styles.subtitle}>{stepInfo.subtitle}</Text>

        {(step === 'pin' || step === 'confirm') && (
          <>
            <View style={styles.dotsRow}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <View key={i} style={[styles.dot, i < currentPin.length ? styles.dotFilled : styles.dotEmpty]} />
              ))}
            </View>
            {loading && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
            {!loading && renderKeypad(handleDigit, handleDelete, null)}
          </>
        )}

        {(step === 'recovery1' || step === 'recovery2') && (
          <View style={styles.recoveryContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.questionScroll}>
              {RECOVERY_QUESTIONS.map((q, i) => {
                const selected = step === 'recovery1' ? q1Index === i : q2Index === i;
                const otherSelected = step === 'recovery1' ? q2Index === i : q1Index === i;
                if (otherSelected) return null; // Don't show the other step's question
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.questionChip, selected && styles.questionChipActive]}
                    onPress={() => step === 'recovery1' ? setQ1Index(i) : setQ2Index(i)}
                  >
                    <Text style={[styles.questionText, selected && styles.questionTextActive]}>{q}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>Your Answer</Text>
              <View style={styles.answerDisplay}>
                <Text style={styles.answerText}>{currentInput || '—'}</Text>
              </View>
            </View>

            {renderAlphaKeypad(
              handleDigit,
              handleDelete,
              step === 'recovery1' ? handleRecovery1Next : handleRecovery2Next,
              currentInput
            )}
          </View>
        )}

        {step === 'biometric' && (
          <View style={styles.biometricContainer}>
            <Text style={styles.biometricIcon}>
              {biometricType === 'Face ID' ? '👤' : '👆'}
            </Text>
            <Text style={styles.biometricLabel}>{biometricType} Available</Text>
            <Text style={styles.biometricBody}>
              Enable {biometricType} to unlock VaultFlow faster without entering your PIN.
            </Text>
            <TouchableOpacity style={styles.enableBtn} onPress={handleEnableBiometric}>
              <Text style={styles.enableBtnText}>Enable {biometricType}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('done')}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.doneContainer}>
            <Text style={styles.doneIcon}>🎉</Text>
            <Text style={styles.doneTitle}>VaultFlow is Secured</Text>
            <Text style={styles.doneBody}>
              Your financial data is protected with a PIN{biometricAvailable ? ' and biometric authentication' : ''}.
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneBtnText}>Go to Dashboard →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

function renderKeypad(
  onDigit: (d: string) => void,
  onDelete: () => void,
  onBio: (() => void) | null
) {
  return (
    <View style={styles.keypad}>
      {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'del']].map((row, ri) => (
        <View key={ri} style={styles.keyRow}>
          {row.map((key, ki) => {
            if (key === '') return <View key={ki} style={styles.keyPlaceholder} />;
            if (key === 'del') {
              return (
                <TouchableOpacity key={ki} style={styles.keySpecial} onPress={onDelete}>
                  <Text style={styles.keySpecialIcon}>⌫</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={ki} style={styles.key} onPress={() => onDigit(key)}>
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function renderAlphaKeypad(
  onChar: (c: string) => void,
  onDelete: () => void,
  onNext: () => void,
  current: string
) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const digits = '0123456789'.split('');
  const chars = [...letters, ' ', ...digits];
  return (
    <View style={styles.alphaKeypadContainer}>
      <View style={styles.alphaGrid}>
        {chars.map((c) => (
          <TouchableOpacity key={c} style={styles.alphaKey} onPress={() => onChar(c)}>
            <Text style={styles.alphaKeyText}>{c === ' ' ? '⎵' : c}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.alphaKey} onPress={onDelete}>
          <Text style={styles.alphaKeyText}>⌫</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.nextBtn, current.trim().length < 3 && styles.nextBtnDisabled]}
        onPress={onNext}
        disabled={current.trim().length < 3}
      >
        <Text style={styles.nextBtnText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

const KEY_SIZE = 72;
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 12, marginBottom: 4 },
  progressFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.3)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  dotFilled: { backgroundColor: '#fff' },
  keypad: { gap: 14, alignItems: 'center' },
  keyRow: { flexDirection: 'row', gap: 16 },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  keyText: { fontSize: 24, fontWeight: '500', color: '#fff' },
  keySpecial: { width: KEY_SIZE, height: KEY_SIZE, justifyContent: 'center', alignItems: 'center' },
  keySpecialIcon: { fontSize: 22, color: '#fff' },
  keyPlaceholder: { width: KEY_SIZE, height: KEY_SIZE },
  recoveryContainer: { width: '100%', gap: 16 },
  questionScroll: { maxHeight: 80 },
  questionChip: { marginRight: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', maxWidth: 280 },
  questionChipActive: { backgroundColor: 'rgba(255,255,255,0.3)', borderColor: '#fff' },
  questionText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', flexWrap: 'wrap' },
  questionTextActive: { color: '#fff', fontWeight: '600' },
  answerBox: { gap: 6 },
  answerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  answerDisplay: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
  answerText: { color: '#fff', fontSize: 16 },
  alphaKeypadContainer: { width: '100%', gap: 12 },
  alphaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  alphaKey: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  alphaKeyText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  nextBtn: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  biometricContainer: { alignItems: 'center', gap: 16 },
  biometricIcon: { fontSize: 64 },
  biometricLabel: { fontSize: 22, fontWeight: '700', color: '#fff' },
  biometricBody: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
  enableBtn: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  enableBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  skipBtn: { padding: 12 },
  skipBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textDecorationLine: 'underline' },
  doneContainer: { alignItems: 'center', gap: 16 },
  doneIcon: { fontSize: 64 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  doneBody: { fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 22 },
  doneBtn: { marginTop: 12, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
});
