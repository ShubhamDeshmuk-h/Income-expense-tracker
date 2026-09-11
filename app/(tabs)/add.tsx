import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Plus, Camera, Image as ImageIcon, FileText, ChevronDown } from 'lucide-react-native';
import { addTransaction, type PaymentMethod } from '@/lib/db';
import { parseTransactionText } from '@/lib/smsParser';
import { sendTransactionNotification, checkLargeTransaction, checkLowBalance } from '@/lib/notifications';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 'Health',
  'Entertainment', 'Salary', 'Transfer', 'Other',
];

const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'bank', label: 'Bank', icon: '🏦' },
  { key: 'upi', label: 'UPI', icon: '📱' },
  { key: 'card', label: 'Card', icon: '💳' },
  { key: 'atm', label: 'ATM', icon: '🏧' },
];

type FormState = {
  type: 'income' | 'expense';
  paymentMethod: PaymentMethod;
  amount: string;
  category: string;
  merchant: string;
  date: string;
  note: string;
  attachmentUri: string | null;
};

const defaultForm = (): FormState => ({
  type: 'expense',
  paymentMethod: 'cash',
  amount: '',
  category: 'Other',
  merchant: '',
  date: new Date().toISOString().split('T')[0],
  note: '',
  attachmentUri: null,
});

export default function AddTransaction() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();
  const [form, setForm] = useState<FormState>(defaultForm());
  const [smsText, setSmsText] = useState('');
  const [showSmsParser, setShowSmsParser] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState, val: FormState[keyof FormState]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  const ensureMediaPermission = async (type: 'gallery' | 'camera'): Promise<boolean> => {
    const getter = type === 'gallery'
      ? ImagePicker.getMediaLibraryPermissionsAsync
      : ImagePicker.getCameraPermissionsAsync;
    const requester = type === 'gallery'
      ? ImagePicker.requestMediaLibraryPermissionsAsync
      : ImagePicker.requestCameraPermissionsAsync;
    const perm = await getter();
    if (perm.granted) return true;
    const req = await requester();
    return req.granted;
  };

  // ---------------------------------------------------------------------------
  // SMS Parser
  // ---------------------------------------------------------------------------

  const handleParseSMS = () => {
    if (!smsText.trim()) {
      Alert.alert('Empty', 'Paste an SMS or UPI message to parse.');
      return;
    }
    const result = parseTransactionText(smsText);
    const confidenceLabel = result.confidence >= 0.8 ? '✅ High confidence'
      : result.confidence >= 0.6 ? '⚠️ Medium confidence — please review'
      : '❓ Low confidence — review carefully';

    const summary = [
      `Amount: ${result.amount != null ? formatAmount(result.amount, currency) : '–'}`,
      `Type: ${result.type ?? '–'}`,
      `Date: ${result.date ?? '–'}`,
      `Merchant: ${result.merchant ?? '–'}`,
      `Category: ${result.category ?? '–'}`,
      `Payment: ${result.paymentMethod ?? '–'}`,
      '',
      confidenceLabel,
    ].join('\n');

    Alert.alert('Parsed Result', summary, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Apply',
        onPress: () => {
          setForm((prev) => ({
            ...prev,
            ...(result.amount != null ? { amount: String(result.amount) } : {}),
            ...(result.type ? { type: result.type } : {}),
            ...(result.date ? { date: result.date } : {}),
            ...(result.merchant ? { merchant: result.merchant } : {}),
            ...(result.category ? { category: result.category } : {}),
            ...(result.paymentMethod ? { paymentMethod: result.paymentMethod } : {}),
            ...(result.txRef ? { note: `Ref: ${result.txRef}` } : {}),
          }));
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Camera / Gallery
  // ---------------------------------------------------------------------------

  const handlePickGallery = async () => {
    const granted = await ensureMediaPermission('gallery');
    if (!granted) { Alert.alert('Permission Required', 'Enable photo access in Settings.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) set('attachmentUri', result.assets[0].uri);
  };

  const handleCamera = async () => {
    const granted = await ensureMediaPermission('camera');
    if (!granted) { Alert.alert('Permission Required', 'Enable camera access in Settings.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) set('attachmentUri', result.assets[0].uri);
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    const numAmount = parseFloat(form.amount);
    if (!form.amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid positive amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      Alert.alert('Invalid Date', 'Use YYYY-MM-DD format (e.g. 2025-09-12).');
      return;
    }

    setSaving(true);
    try {
      await addTransaction({
        type: form.type,
        payment_method: form.paymentMethod,
        category: form.category,
        merchant: form.merchant.trim(),
        amount: numAmount,
        date: form.date,
        note: form.note.trim(),
        source: 'manual',
        confidence: 1.0,
        attachment_uri: form.attachmentUri,
      });

      await sendTransactionNotification(form.type, numAmount, form.category);
      await checkLargeTransaction(numAmount);
      await checkLowBalance();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setForm(defaultForm());
      setSmsText('');
      setShowSmsParser(false);

      Alert.alert('✅ Saved', `${form.type === 'income' ? 'Income' : 'Expense'} of ${formatAmount(numAmount, currency)} recorded.`);
    } catch {
      Alert.alert('Error', 'Could not save transaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]}
      keyboardShouldPersistTaps="handled"
    >
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}
      >
        <Text style={styles.headerTitle}>Add Transaction</Text>
        <Text style={styles.headerSub}>Log income or expense</Text>
      </LinearGradient>

      <View style={styles.form}>
        {/* Type toggle */}
        <View style={styles.typeRow}>
          {(['expense', 'income'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, form.type === t && (t === 'expense' ? styles.typeBtnExpense : styles.typeBtnIncome)]}
              onPress={() => set('type', t)}
            >
              <Text style={[styles.typeBtnText, form.type === t && { color: '#fff' }]}>
                {t === 'expense' ? '↓ Expense' : '↑ Income'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment method */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Payment Method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 52 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
              {PAYMENT_METHODS.map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.pmChip, form.paymentMethod === key && styles.pmChipActive]}
                  onPress={() => set('paymentMethod', key)}
                >
                  <Text style={styles.pmChipIcon}>{icon}</Text>
                  <Text style={[styles.pmChipText, form.paymentMethod === key && { color: '#fff' }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Amount */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Amount ({currency.currencyCode})</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.colors.textMuted}
            value={form.amount}
            onChangeText={(v) => set('amount', v)}
          />
        </View>

        {/* Merchant */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Merchant / Payee</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Swiggy, Amazon, Salary"
            placeholderTextColor={theme.colors.textMuted}
            value={form.merchant}
            onChangeText={(v) => set('merchant', v)}
          />
        </View>

        {/* Category */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, form.category === cat && styles.catChipActive]}
                  onPress={() => set('category', cat)}
                >
                  <Text style={[styles.catChipText, form.category === cat && { color: '#fff' }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Date */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2025-09-12"
            placeholderTextColor={theme.colors.textMuted}
            value={form.date}
            onChangeText={(v) => set('date', v)}
          />
        </View>

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            multiline numberOfLines={3}
            placeholder="What was this for?"
            placeholderTextColor={theme.colors.textMuted}
            value={form.note}
            onChangeText={(v) => set('note', v)}
          />
        </View>

        {/* Attachment */}
        {form.attachmentUri && (
          <View style={styles.attachRow}>
            <Text style={styles.attachText}>📎 Receipt attached</Text>
            <TouchableOpacity onPress={() => set('attachmentUri', null)}>
              <Text style={styles.removeAttach}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Media actions */}
        <View style={styles.mediaRow}>
          <TouchableOpacity style={styles.mediaBtn} onPress={handlePickGallery}>
            <ImageIcon size={16} color={theme.colors.primary} />
            <Text style={styles.mediaBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={handleCamera}>
            <Camera size={16} color={theme.colors.primary} />
            <Text style={styles.mediaBtnText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {/* SMS/UPI parser */}
        <TouchableOpacity
          style={styles.smsToggle}
          onPress={() => setShowSmsParser((p) => !p)}
        >
          <FileText size={16} color={theme.colors.primary} />
          <Text style={styles.smsToggleText}>Autofill from UPI / Bank SMS</Text>
          <ChevronDown
            size={16}
            color={theme.colors.primary}
            style={{ transform: [{ rotate: showSmsParser ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {showSmsParser && (
          <View style={styles.smsBox}>
            <Text style={styles.smsHint}>
              Paste a bank debit/credit SMS or UPI confirmation message. Parsing is 100% on-device.
            </Text>
            <TextInput
              style={[styles.input, styles.smsInput]}
              multiline numberOfLines={5}
              placeholder="Paste UPI or bank SMS here…"
              placeholderTextColor={theme.colors.textMuted}
              value={smsText}
              onChangeText={setSmsText}
            />
            <TouchableOpacity style={styles.parseBtn} onPress={handleParseSMS}>
              <Text style={styles.parseBtnText}>Parse & Autofill</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDark]}
            style={styles.saveBtnGradient}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Plus size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Transaction</Text>
                </>}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {},
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  headerTitle: { ...theme.typography.title, color: '#fff' },
  headerSub: { ...theme.typography.subtitle, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  form: { padding: theme.spacing.lg, gap: theme.spacing.md },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md, padding: 4, gap: 4,
  },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: theme.colors.expense },
  typeBtnIncome: { backgroundColor: theme.colors.income },
  typeBtnText: { ...theme.typography.label, color: theme.colors.textSecondary },
  fieldGroup: { gap: 6 },
  label: { ...theme.typography.label, color: theme.colors.textSecondary },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, paddingVertical: 12,
    ...theme.typography.body, color: theme.colors.text,
  },
  noteInput: { height: 80, textAlignVertical: 'top' },
  pmChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  pmChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pmChipIcon: { fontSize: 14 },
  pmChipText: { ...theme.typography.label, color: theme.colors.textSecondary },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  catChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  catChipText: { ...theme.typography.label, color: theme.colors.textSecondary },
  attachRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: theme.colors.successLight, padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  attachText: { ...theme.typography.label, color: theme.colors.success },
  removeAttach: { ...theme.typography.label, color: theme.colors.expense },
  mediaRow: { flexDirection: 'row', gap: 8 },
  mediaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  mediaBtnText: { ...theme.typography.label, color: theme.colors.primary },
  smsToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  smsToggleText: { ...theme.typography.label, color: theme.colors.primary, flex: 1, marginLeft: 8 },
  smsBox: { gap: 10 },
  smsHint: { ...theme.typography.caption, color: theme.colors.textMuted, lineHeight: 18 },
  smsInput: { height: 100, textAlignVertical: 'top' },
  parseBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, padding: 12, alignItems: 'center' },
  parseBtnText: { ...theme.typography.label, color: '#fff' },
  saveBtn: { marginTop: 8 },
  saveBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: theme.radius.lg, paddingVertical: 16,
  },
  saveBtnText: { ...theme.typography.heading, color: '#fff' },
});
