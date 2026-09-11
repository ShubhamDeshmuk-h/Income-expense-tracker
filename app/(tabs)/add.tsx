import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { X, Camera, Image as ImageIcon } from 'lucide-react-native';
import {
  checkLargeTransaction,
  checkLowBalance,
  sendTransactionNotification,
} from '@/lib/notifications';

const CATEGORIES = [
  'Salary',
  'Business',
  'Investment',
  'Food',
  'Shopping',
  'Bills',
  'Transport',
  'Entertainment',
  'Healthcare',
  'Education',
  'Other',
];

export default function AddTransaction() {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [mode, setMode] = useState<'cash' | 'bank'>('cash');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to attach images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
      console.error(error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAttachmentUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error(error);
    }
  };

  const removeAttachment = () => {
    setAttachmentUri(null);
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentUri) return null;

    try {
      setUploadingAttachment(true);
      // For simplicity, we'll store the image locally and save the path
      // In production, you might want to upload to Supabase Storage
      const filename = `attachment_${Date.now()}.jpg`;
      const destinationUri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.copyAsync({
        from: attachmentUri,
        to: destinationUri,
      });

      return destinationUri;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      Alert.alert('Error', 'Failed to upload attachment');
      return null;
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (!category) {
      setError('Please select a category');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      // Upload attachment if exists
      const attachmentUrl = await uploadAttachment();

      const { error: insertError } = await supabase.from('transactions').insert({
        type,
        mode,
        category,
        amount: parseFloat(amount),
        date,
        note: note || '',
        attachment_url: attachmentUrl || null,
      });

      if (insertError) throw insertError;

      // Check for alerts
      const amountValue = parseFloat(amount);
      await checkLargeTransaction(amountValue);
      await checkLowBalance();
      
      // Send transaction notification (optional - can be disabled in settings)
      // await sendTransactionNotification(type, amountValue, category);

      setSuccess(true);
      setCategory('');
      setAmount('');
      setNote('');
      setAttachmentUri(null);

      setTimeout(() => {
        setSuccess(false);
        router.push('/(tabs)');
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to add transaction'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Transaction</Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>Transaction added successfully!</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Transaction Type</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                type === 'income' && styles.toggleButtonActive,
              ]}
              onPress={() => setType('income')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  type === 'income' && styles.toggleButtonTextActive,
                ]}>
                Income
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                type === 'expense' && styles.toggleButtonActive,
              ]}
              onPress={() => setType('expense')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  type === 'expense' && styles.toggleButtonTextActive,
                ]}>
                Expense
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Payment Mode</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                mode === 'cash' && styles.toggleButtonActive,
              ]}
              onPress={() => setMode('cash')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  mode === 'cash' && styles.toggleButtonTextActive,
                ]}>
                Cash
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                mode === 'bank' && styles.toggleButtonActive,
              ]}
              onPress={() => setMode('bank')}>
              <Text
                style={[
                  styles.toggleButtonText,
                  mode === 'bank' && styles.toggleButtonTextActive,
                ]}>
                Bank
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  category === cat && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat)}>
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === cat && styles.categoryButtonTextActive,
                  ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Note (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add a note..."
            multiline
            numberOfLines={3}
            value={note}
            onChangeText={setNote}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Bill Image (Optional)</Text>
          {attachmentUri ? (
            <View style={styles.attachmentContainer}>
              <Image source={{ uri: attachmentUri }} style={styles.attachmentImage} />
              <TouchableOpacity
                style={styles.removeAttachmentButton}
                onPress={removeAttachment}>
                <X size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.attachmentButtons}>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={pickImage}
                disabled={uploadingAttachment}>
                <ImageIcon size={20} color="#3b82f6" />
                <Text style={styles.attachmentButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachmentButton}
                onPress={takePhoto}
                disabled={uploadingAttachment}>
                <Camera size={20} color="#3b82f6" />
                <Text style={styles.attachmentButtonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || uploadingAttachment}>
          <Text style={styles.submitButtonText}>
            {loading || uploadingAttachment
              ? uploadingAttachment
                ? 'Uploading...'
                : 'Adding...'
              : 'Add Transaction'}
          </Text>
        </TouchableOpacity>
      </View>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  form: {
    padding: 16,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    marginBottom: 16,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  successContainer: {
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    marginBottom: 16,
  },
  successText: {
    color: '#065f46',
    fontSize: 14,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  categoryButtonTextActive: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  attachmentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  attachmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  attachmentButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
