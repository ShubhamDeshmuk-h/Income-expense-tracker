import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Plus, Camera, Image, FileText, ChevronDown } from 'lucide-react-native';
import { addTransaction } from '@/lib/db';
import { parseTransactionFromText } from '@/lib/ocr';
import { sendTransactionNotification, checkLargeTransaction, checkLowBalance } from '@/lib/notifications';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

const CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Bills', 'Health',
  'Entertainment', 'Salary', 'Transfer', 'Other',
];

export default function AddTransaction() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [mode, setMode] = useState<'cash' | 'bank'>('cash');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [smsText, setSmsText] = useState('');
  const [showSmsParser, setShowSmsParser] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const openSettingsPrompt = (message: string) => {
    Alert.alert('Permission Required', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
  };

  const ensureMediaLibraryPermission = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (perm.granted) return true;
    const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (req.granted) return true;
    if (!req.canAskAgain) {
      openSettingsPrompt('Photo access is disabled. Enable it in Settings to attach receipts.');
    } else {
      Alert.alert('Permission Needed', 'Please allow photo library access.');
    }
    return false;
  };

  const ensureCameraPermission = async () => {
    const perm = await ImagePicker.getCameraPermissionsAsync();
    if (perm.granted) return true;
    const req = await ImagePicker.requestCameraPermissionsAsync();
    if (req.granted) return true;
    if (!req.canAskAgain) {
      openSettingsPrompt('Camera access is disabled. Enable it in Settings.');
    } else {
      Alert.alert('Permission Needed', 'Please allow camera access.');
    }
    return false;
  };

  const applyParsedResult = (parsed: ReturnType<typeof parseTransactionFromText>) => {
    if (parsed.amount) setAmount(parsed.amount.toString());
    if (parsed.type) setType(parsed.type);
    if (parsed.date) setDate(parsed.date);
    if (parsed.note) setNote(parsed.note);
    if (parsed.category) setCategory(parsed.category);
  };

  const handleParseSMS = () => {
    if (!smsText.trim()) {
      Alert.alert('Empty', 'Paste an SMS or UPI message to parse.');
      return;
    }
    const parsed = parseTransactionFromText(smsText);
    const summary = [
      parsed.amount ? `Amount: ${formatAmount(parsed.amount, currency)}` : 'Amount: –',
      parsed.date ? `Date: ${parsed.date}` : 'Date: –',
      parsed.type ? `Type: ${parsed.type}` : 'Type: –',
      parsed.note ? `Note: ${parsed.note}` : 'Note: –',
    ].join('\n');
    Alert.alert('Parsed Result', summary, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: () => applyParsedResult(parsed) },
    ]);
  };

  const handlePickFromGallery = async () => {
    const granted = await ensureMediaLibraryPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAttachmentUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const granted = await ensureCameraPermission();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setAttachmentUri(result.assets[0].uri);
    }
  };

  const handleScanOCR = async () => {
    const granted = await ensureMediaLibraryPermission();
    if (!granted) return;

    setOcrLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) return;

      // Simulate OCR parse from filename/path context (real OCR needs native module)
      const parsed = parseTransactionFromText(result.assets[0].uri);
      const summary = [
        parsed.amount ? `Amount: ${formatAmount(parsed.amount, currency)}` : 'Amount: –',
        parsed.date ? `Date: ${parsed.date}` : 'Date: –',
        parsed.type ? `Type: ${parsed.type}` : 'Type: –',
      ].join('\n');

      Alert.alert('Scan Results', summary + '\n\nTip: Paste the receipt text in the SMS parser for better accuracy.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply + Attach',
          onPress: () => {
            setAttachmentUri(result.assets[0].uri);
            applyParsedResult(parsed);
          },
        },
        { text: 'Apply', onPress: () => applyParsedResult(parsed) },
      ]);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Invalid Date', 'Use YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      await addTransaction({
        type,
        mode,
        category,
        amount: numAmount,
        date,
        note,
        attachment_uri: attachmentUri,
        is_automated: 0,
      });

      await sendTransactionNotification(type, numAmount, category);
      await checkLargeTransaction(numAmount);
      await checkLowBalance();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset form
      setAmount('');
      setNote('');
      setSmsText('');
      setAttachmentUri(null);
      setShowSmsParser(false);

      Alert.alert('Saved!', `${type === 'income' ? 'Income' : 'Expense'} of ${formatAmount(numAmount, currency)} recorded.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to save transaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom, 16) + 80 },
      ]}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <Text style={styles.headerTitle}>Add Transaction</Text>
        <Text style={styles.headerSub}>Log income or expense</Text>
      </LinearGradient>

      <View style={styles.form}>
        {/* Type Toggle */}
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpense]}
            onPress={() => setType('expense')}>
            <Text style={[styles.typeBtnText, type === 'expense' && { color: '#fff' }]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'income' && styles.typeBtnIncome]}
            onPress={() => setType('income')}>
            <Text style={[styles.typeBtnText, type === 'income' && { color: '#fff' }]}>Income</Text>
          </TouchableOpacity>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeRow}>
          {(['cash', 'bank'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => setMode(m)}>
              <Text style={[styles.modeBtnText, mode === m && { color: '#fff' }]}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Amount ({currency.currencyCode})</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder={`0.00`}
            placeholderTextColor={theme.colors.textMuted}
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {/* Category */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, category === cat && styles.catChipActive]}
                onPress={() => setCategory(cat)}>
                <Text style={[styles.catChipText, category === cat && { color: '#fff' }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2025-01-01"
            placeholderTextColor={theme.colors.textMuted}
            value={date}
            onChangeText={setDate}
          />
        </View>

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            multiline
            numberOfLines={3}
            placeholder="What was this for?"
            placeholderTextColor={theme.colors.textMuted}
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Attachment */}
        {attachmentUri && (
          <View style={styles.attachmentRow}>
            <Text style={styles.attachmentText}>📎 Receipt attached</Text>
            <TouchableOpacity onPress={() => setAttachmentUri(null)}>
              <Text style={styles.removeAttachment}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Media Actions */}
        <View style={styles.mediaRow}>
          <TouchableOpacity style={styles.mediaBtn} onPress={handlePickFromGallery}>
            <Image size={18} color={theme.colors.primary} />
            <Text style={styles.mediaBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={handleTakePhoto}>
            <Camera size={18} color={theme.colors.primary} />
            <Text style={styles.mediaBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={handleScanOCR} disabled={ocrLoading}>
            {ocrLoading
              ? <ActivityIndicator size={18} color={theme.colors.primary} />
              : <FileText size={18} color={theme.colors.primary} />}
            <Text style={styles.mediaBtnText}>Scan OCR</Text>
          </TouchableOpacity>
        </View>

        {/* SMS/UPI Parser */}
        <TouchableOpacity
          style={styles.smsToggle}
          onPress={() => setShowSmsParser(!showSmsParser)}>
          <Text style={styles.smsToggleText}>Autofill from UPI/SMS</Text>
          <ChevronDown size={16} color={theme.colors.primary} style={{ transform: [{ rotate: showSmsParser ? '180deg' : '0deg' }] }} />
        </TouchableOpacity>

        {showSmsParser && (
          <View style={styles.smsBox}>
            <TextInput
              style={[styles.input, styles.smsInput]}
              multiline
              numberOfLines={5}
              placeholder="Paste UPI confirmation SMS here…"
              placeholderTextColor={theme.colors.textMuted}
              value={smsText}
              onChangeText={setSmsText}
            />
            <TouchableOpacity style={styles.parseBtn} onPress={handleParseSMS}>
              <Text style={styles.parseBtnText}>Parse & Autofill</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.saveBtnGradient}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Plus size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Transaction</Text>
                </>
            }
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
  typeRow: { flexDirection: 'row', backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radius.md, padding: 4, gap: 4 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: theme.colors.expense },
  typeBtnIncome: { backgroundColor: theme.colors.income },
  typeBtnText: { ...theme.typography.label, color: theme.colors.textSecondary },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center' },
  modeBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  modeBtnText: { ...theme.typography.label, color: theme.colors.textSecondary },
  fieldGroup: { gap: 6 },
  label: { ...theme.typography.label, color: theme.colors.textSecondary },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    ...theme.typography.body,
    color: theme.colors.text,
  },
  noteInput: { height: 80, textAlignVertical: 'top' },
  catScroll: { maxHeight: 44 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  catChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  catChipText: { ...theme.typography.label, color: theme.colors.textSecondary },
  attachmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.successLight, padding: theme.spacing.sm, borderRadius: theme.radius.sm },
  attachmentText: { ...theme.typography.label, color: theme.colors.success },
  removeAttachment: { ...theme.typography.label, color: theme.colors.expense },
  mediaRow: { flexDirection: 'row', gap: 8 },
  mediaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  mediaBtnText: { ...theme.typography.label, color: theme.colors.primary },
  smsToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  smsToggleText: { ...theme.typography.label, color: theme.colors.primary },
  smsBox: { gap: 8 },
  smsInput: { height: 100, textAlignVertical: 'top' },
  parseBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, padding: 12, alignItems: 'center' },
  parseBtnText: { ...theme.typography.label, color: '#fff' },
  saveBtn: { marginTop: 8 },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: theme.radius.lg, paddingVertical: 16 },
  saveBtnText: { ...theme.typography.heading, color: '#fff' },
});
