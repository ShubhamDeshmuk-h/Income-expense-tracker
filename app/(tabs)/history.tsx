import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { supabase, Transaction } from '@/lib/supabase';
import {
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Filter,
  X,
} from 'lucide-react-native';

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>(
    'all'
  );
  const [filterMode, setFilterMode] = useState<'all' | 'cash' | 'bank'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');

  const fetchTransactions = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setTransactions(data);
        applyFilters(data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch transactions'
      );
    }
  };

  const applyFilters = (data: Transaction[] = transactions) => {
    let filtered = [...data];

    if (filterType !== 'all') {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (filterMode !== 'all') {
      filtered = filtered.filter((t) => t.mode === filterMode);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter((t) => t.category === filterCategory);
    }

    setFilteredTransactions(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [filterType, filterMode, filterCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditAmount(transaction.amount.toString());
    setEditNote(transaction.note);
    setEditDate(transaction.date);
    setEditModalVisible(true);
  };

  const handleDelete = async (transaction: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', transaction.id);

              if (error) throw error;

              await fetchTransactions();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : 'Failed to delete transaction'
              );
            }
          },
        },
      ]
    );
  };

  const handleUpdateTransaction = async () => {
    if (!selectedTransaction) return;

    if (!editAmount || parseFloat(editAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          amount: parseFloat(editAmount),
          note: editNote,
          date: editDate,
        })
        .eq('id', selectedTransaction.id);

      if (error) throw error;

      setEditModalVisible(false);
      await fetchTransactions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update transaction'
      );
    }
  };

  const categories = ['all', ...new Set(transactions.map((t) => t.category))];

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isIncome = item.type === 'income';

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View
            style={[
              styles.transactionIcon,
              isIncome ? styles.incomeIcon : styles.expenseIcon,
            ]}>
            {isIncome ? (
              <TrendingUp size={20} color="#10b981" />
            ) : (
              <TrendingDown size={20} color="#ef4444" />
            )}
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionCategory}>{item.category}</Text>
            <Text style={styles.transactionDate}>
              {new Date(item.date).toLocaleDateString()} • {item.mode}
            </Text>
            {item.note ? (
              <Text style={styles.transactionNote}>{item.note}</Text>
            ) : null}
          </View>
          <View style={styles.transactionRight}>
            <Text
              style={[
                styles.transactionAmount,
                isIncome ? styles.incomeText : styles.expenseText,
              ]}>
              {isIncome ? '+' : '-'}₹{Number(item.amount).toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.transactionActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEdit(item)}>
            <Edit size={16} color="#3b82f6" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item)}>
            <Trash2 size={16} color="#ef4444" />
            <Text style={[styles.actionButtonText, styles.deleteText]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}>
          <Filter size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.filterInfo}>
        <Text style={styles.filterInfoText}>
          Showing {filteredTransactions.length} of {transactions.length}{' '}
          transactions
        </Text>
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
      />

      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Transactions</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Type</Text>
              <View style={styles.filterButtonGroup}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterType === 'all' && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterType('all')}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filterType === 'all' && styles.filterChipTextActive,
                    ]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterType === 'income' && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterType('income')}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filterType === 'income' && styles.filterChipTextActive,
                    ]}>
                    Income
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterType === 'expense' && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterType('expense')}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filterType === 'expense' && styles.filterChipTextActive,
                    ]}>
                    Expense
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Mode</Text>
              <View style={styles.filterButtonGroup}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterMode === 'all' && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterMode('all')}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filterMode === 'all' && styles.filterChipTextActive,
                    ]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterMode === 'cash' && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterMode('cash')}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filterMode === 'cash' && styles.filterChipTextActive,
                    ]}>
                    Cash
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filterMode === 'bank' && styles.filterChipActive,
                  ]}
                  onPress={() => setFilterMode('bank')}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filterMode === 'bank' && styles.filterChipTextActive,
                    ]}>
                    Bank
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.filterButtonGroup}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filterChip,
                      filterCategory === cat && styles.filterChipActive,
                    ]}
                    onPress={() => setFilterCategory(cat)}>
                    <Text
                      style={[
                        styles.filterChipText,
                        filterCategory === cat && styles.filterChipTextActive,
                      ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Transaction</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Amount</Text>
                <TextInput
                  style={styles.editInput}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Date</Text>
                <TextInput
                  style={styles.editInput}
                  value={editDate}
                  onChangeText={setEditDate}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Note</Text>
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  value={editNote}
                  onChangeText={setEditNote}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={styles.updateButton}
                onPress={handleUpdateTransaction}>
                <Text style={styles.updateButtonText}>Update Transaction</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
  },
  filterInfo: {
    padding: 16,
    paddingBottom: 8,
  },
  filterInfoText: {
    fontSize: 14,
    color: '#6b7280',
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  transactionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  incomeIcon: {
    backgroundColor: '#d1fae5',
  },
  expenseIcon: {
    backgroundColor: '#fee2e2',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  transactionNote: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  incomeText: {
    color: '#10b981',
  },
  expenseText: {
    color: '#ef4444',
  },
  transactionActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  deleteText: {
    color: '#ef4444',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  filterButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  applyButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  editForm: {
    marginTop: 16,
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  editTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  updateButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
