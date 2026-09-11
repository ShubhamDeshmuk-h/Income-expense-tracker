import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Filter, Search, Trash2, TrendingUp, TrendingDown } from 'lucide-react-native';
import {
  getTransactions,
  deleteTransaction,
  type Transaction,
} from '@/lib/db';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

const CATEGORIES = [
  'All', 'Food', 'Transport', 'Shopping', 'Bills',
  'Health', 'Entertainment', 'Salary', 'Transfer', 'Other',
];

export default function History() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filtered, setFiltered] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  const fetchTransactions = async () => {
    const txns = await getTransactions();
    setTransactions(txns);
    applyFilters(txns, activeCategory, typeFilter);
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [])
  );

  const applyFilters = (
    txns: Transaction[],
    cat: string,
    typ: 'all' | 'income' | 'expense'
  ) => {
    let result = txns;
    if (cat !== 'All') result = result.filter((t) => t.category === cat);
    if (typ !== 'all') result = result.filter((t) => t.type === typ);
    setFiltered(result);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    applyFilters(transactions, cat, typeFilter);
  };

  const handleTypeChange = (typ: 'all' | 'income' | 'expense') => {
    setTypeFilter(typ);
    applyFilters(transactions, activeCategory, typ);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(id);
          fetchTransactions();
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <Text style={styles.title}>Transaction History</Text>
        <Text style={styles.subtitle}>{filtered.length} records</Text>
      </LinearGradient>

      {/* Type Filter */}
      <View style={styles.typeRow}>
        {(['all', 'income', 'expense'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, typeFilter === t && styles.typeBtnActive]}
            onPress={() => handleTypeChange(t)}>
            <Text style={[styles.typeBtnText, typeFilter === t && styles.typeBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, activeCategory === cat && styles.chipActive]}
            onPress={() => handleCategoryChange(cat)}>
            <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transaction List */}
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: Math.max(insets.bottom, 16) + 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }>
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Filter size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        ) : (
          filtered.map((tx) => (
            <View key={tx.id} style={[styles.txCard, theme.shadow.sm]}>
              <View style={[
                styles.txIcon,
                { backgroundColor: tx.type === 'income' ? theme.colors.incomeLight : theme.colors.expenseLight }
              ]}>
                {tx.type === 'income'
                  ? <TrendingUp size={16} color={theme.colors.income} />
                  : <TrendingDown size={16} color={theme.colors.expense} />}
              </View>
              <View style={styles.txBody}>
                <View style={styles.txTop}>
                  <Text style={styles.txCategory}>{tx.category}</Text>
                  <Text style={[
                    styles.txAmount,
                    { color: tx.type === 'income' ? theme.colors.income : theme.colors.expense }
                  ]}>
                    {tx.type === 'income' ? '+' : '-'}{formatAmount(Number(tx.amount), currency)}
                  </Text>
                </View>
                <View style={styles.txBottom}>
                  <Text style={styles.txMeta}>
                    {tx.mode.toUpperCase()} · {tx.date}
                  </Text>
                  {tx.note ? <Text style={styles.txNote} numberOfLines={1}>{tx.note}</Text> : null}
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(tx.id)}
                accessibilityLabel="Delete transaction">
                <Trash2 size={16} color={theme.colors.expense} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
  },
  title: { ...theme.typography.title, color: '#fff' },
  subtitle: { ...theme.typography.subtitle, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  typeRow: {
    flexDirection: 'row',
    margin: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md,
    padding: 4,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: theme.colors.primary },
  typeBtnText: { ...theme.typography.label, color: theme.colors.textSecondary },
  typeBtnTextActive: { color: '#fff' },
  chipRow: { maxHeight: 44, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { ...theme.typography.label, color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  txBody: { flex: 1 },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txCategory: { ...theme.typography.label, color: theme.colors.text },
  txAmount: { ...theme.typography.label, fontWeight: '700' },
  txBottom: { marginTop: 4, gap: 2 },
  txMeta: { ...theme.typography.caption, color: theme.colors.textMuted },
  txNote: { ...theme.typography.caption, color: theme.colors.textSecondary },
  deleteBtn: {
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.expenseLight,
    marginLeft: 8,
  },
});
