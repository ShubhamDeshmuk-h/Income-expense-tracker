import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { checkForUpdates, getUpdateInfo } from '@/lib/updates';
import * as Updates from 'expo-updates';
import { RefreshCw, X, Download } from 'lucide-react-native';

interface UpdateCheckerProps {
  onUpdateAvailable?: (available: boolean) => void;
}

export default function UpdateChecker({ onUpdateAvailable }: UpdateCheckerProps) {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    loadUpdateInfo();
  }, []);

  const loadUpdateInfo = async () => {
    try {
      const info = await getUpdateInfo();
      setUpdateInfo(info);
    } catch (error) {
      console.error('Error loading update info:', error);
    }
  };

  const handleCheckForUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    setChecking(true);
    try {
      const hasUpdate = await checkForUpdates();
      setUpdateAvailable(hasUpdate);
      if (onUpdateAvailable) {
        onUpdateAvailable(hasUpdate);
      }
      if (hasUpdate) {
        setShowUpdateModal(true);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setChecking(false);
    }
  };

  if (__DEV__ || !Updates.isEnabled) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={handleCheckForUpdates}
        disabled={checking}>
        {checking ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : (
          <RefreshCw size={16} color="#3b82f6" />
        )}
        <Text style={styles.checkButtonText}>
          {checking ? 'Checking...' : 'Check for Updates'}
        </Text>
      </TouchableOpacity>

      {updateInfo && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Version: {updateInfo.runtimeVersion || 'Unknown'}
          </Text>
          {updateInfo.channel && (
            <Text style={styles.infoText}>Channel: {updateInfo.channel}</Text>
          )}
        </View>
      )}

      <Modal
        visible={showUpdateModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpdateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Download size={24} color="#3b82f6" />
              <Text style={styles.modalTitle}>Update Available</Text>
              <TouchableOpacity onPress={() => setShowUpdateModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalText}>
              A new version of the app is available. Would you like to update now?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowUpdateModal(false)}>
                <Text style={styles.modalButtonTextCancel}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonUpdate]}
                onPress={() => {
                  setShowUpdateModal(false);
                  Updates.reloadAsync();
                }}>
                <Text style={styles.modalButtonTextUpdate}>Update Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 8,
  },
  checkButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginLeft: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 24,
    lineHeight: 24,
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
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalButtonUpdate: {
    backgroundColor: '#3b82f6',
  },
  modalButtonTextCancel: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextUpdate: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

