import { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, TextInput, Alert, SectionList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Search, Trash2, TrendingUp, TrendingDown, SlidersHorizontal } from 'lucide-react-native';
import {
  getTransactionsPaginated, searchTransactions, deleteTransaction,
  centsToAmount, type Transaction,
} from '@/lib/db';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

const PAGE_SIZE = 50;

const CATEGORIES = [
  'All', 'Food', 'Transport', 'Shopping', 'Bills',
  'Health', 'Entertainment', 'Salary', 'Transfer', 'Other',
];

const PM_ICONS: Record<string, string> = {
  cash: '💵', bank: '🏦', upi: '📱', card: '💳', atm: '🏧', other: '💸',
};

function groupByDate(txns: Transaction[]): { title: string; data: Transaction[] }[] {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const groups: Record<string, Transaction[]> = {};
  for (const tx of txns) {
    let label = tx.date;
    if (tx.date === today) label = 'Today';
    else if (tx.date === yesterday) label = 'Yesterday';
    else {
      const d = new Date(tx.date + 'T00:00:00');
      label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  }
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

export default function History() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const pageRef = useRef(0);

  const fetchPage = async (offset: number, reset = false) => {
    if (isSearchMode) return;
    const txns = await getTransactionsPaginated(offset, PAGE_SIZE);
    setTransactions((prev) => reset ? txns : [...prev, ...txns]);
    setHasMore(txns.length === PAGE_SIZE);
  };

  useFocusEffect(useCallback(() => {
    pageRef.current = 0;
    fetchPage(0, true);
  }, []));

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setIsSearchMode(false);
      pageRef.current = 0;
      fetchPage(0, true);
      return;
    }
    setIsSearchMode(true);
    const results = await searchTransactions(text);
    setTransactions(results);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || isSearchMode) return;
    setLoadingMore(true);
    pageRef.current += PAGE_SIZE;
    await fetchPage(pageRef.current);
    setLoadingMore(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    setIsSearchMode(false);
    pageRef.current = 0;
    await fetchPage(0, true);
    setRefreshing(false);
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Transaction',
      'This cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(id);
            setTransactions((prev) => prev.filter((t) => t.id !== id));
          },
        },
      ]
    );
  };

  // Apply client-side filters on paginated data
  const filtered = transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (categoryFilter !== 'All' && tx.category !== categoryFilter) return false;
    return true;
  });

  const sections = groupByDate(filtered);

  const renderItem = ({ item: tx }: { item: Transaction }) => {
    const pmIcon = PM_ICONS[tx.payment_method] ?? '💸';
    return (
      <View style={[styles.txCard, theme.shadow.sm]}>
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
            <Text style={styles.txCategory} numberOfLines={1}>
              {tx.merchant ? tx.merchant : tx.category}
            </Text>
            <Text style={[
              styles.txAmount,
              { color: tx.type === 'income' ? theme.colors.income : theme.colors.expense }
            ]}>
              {tx.type === 'income' ? '+' : '-'}{formatAmount(centsToAmount(tx.amount_cents), currency)}
            </Text>
          </View>
          <View style={styles.txBottom}>
            <Text style={styles.txMeta}>
              {pmIcon} {tx.payment_method.toUpperCase()} · {tx.category}
            </Text>
            {tx.note ? (
              <Text style={styles.txNote} numberOfLines={1}>{tx.note}</Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(tx.id)}
          accessibilityLabel="Delete transaction"
        >
          <Trash2 size={15} color={theme.colors.expense} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>{filtered.length} records</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchant, note, category…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Type filter */}
      <View style={styles.typeRow}>
        {(['all', 'income', 'expense'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeBtn, typeFilter === t && styles.typeBtnActive]}
            onPress={() => setTypeFilter(t)}
          >
            <Text style={[styles.typeBtnText, typeFilter === t && styles.typeBtnTextActive]}>
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(item) => item}
        style={styles.chipRow}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.chip, categoryFilter === cat && styles.chipActive]}
            onPress={() => setCategoryFilter(cat)}
          >
            <Text style={[styles.chipText, categoryFilter === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Transaction list with date sections */}
      <SectionList
        sections={sections}
        keyExtractor={(tx) => String(tx.id)}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: Math.max(insets.bottom, 16) + 80,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Search size={40} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>
              {searchQuery ? `No results for "${searchQuery}"` : 'No transactions found'}
            </Text>
          </View>
        }
        ListFooterComponent={loadingMore ? (
          <Text style={styles.loadingMore}>Loading more…</Text>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { ...theme.typography.title, color: '#fff' },
  subtitle: { ...theme.typography.caption, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  clearBtn: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  typeRow: {
    flexDirection: 'row', margin: theme.spacing.md, marginBottom: 0,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md, padding: 4, gap: 4,
  },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.sm, alignItems: 'center' },
  typeBtnActive: { backgroundColor: theme.colors.primary },
  typeBtnText: { ...theme.typography.label, color: theme.colors.textSecondary },
  typeBtnTextActive: { color: '#fff' },
  chipRow: { maxHeight: 48, marginVertical: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { ...theme.typography.label, color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },
  sectionHeader: {
    paddingVertical: 6, paddingHorizontal: 2, marginTop: 8,
  },
  sectionHeaderText: {
    ...theme.typography.label, color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11,
  },
  txCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  txIcon: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.sm,
  },
  txBody: { flex: 1 },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txCategory: { ...theme.typography.label, color: theme.colors.text, flex: 1, marginRight: 8 },
  txAmount: { ...theme.typography.label, fontWeight: '700' },
  txBottom: { marginTop: 3, gap: 1 },
  txMeta: { ...theme.typography.caption, color: theme.colors.textMuted },
  txNote: { ...theme.typography.caption, color: theme.colors.textSecondary },
  deleteBtn: {
    padding: 8, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.expenseLight, marginLeft: 6,
  },
  emptyBox: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  loadingMore: { textAlign: 'center', color: theme.colors.textMuted, padding: 12 },
});
