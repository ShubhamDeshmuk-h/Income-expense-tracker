import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react-native';
import { getBalanceSummary, getTransactions, type BalanceSummary, type Transaction } from '@/lib/db';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();
  const [balances, setBalances] = useState<BalanceSummary[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [bal, txns] = await Promise.all([
        getBalanceSummary(),
        getTransactions(),
      ]);
      setBalances(bal);
      setRecentTransactions(txns.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const cashBalance = balances.find((b) => b.mode === 'cash');
  const bankBalance = balances.find((b) => b.mode === 'bank');
  const totalIncome = balances.reduce((s, b) => s + Number(b.total_income), 0);
  const totalExpense = balances.reduce((s, b) => s + Number(b.total_expense), 0);
  const totalBalance = balances.reduce(
    (s, b) => s + Number(b.current_balance),
    0
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <Text style={styles.headerGreeting}>VaultFlow</Text>
        <Text style={styles.headerSub}>Your financial overview</Text>

        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>{formatAmount(totalBalance, currency)}</Text>
          <View style={styles.incomExpRow}>
            <View style={styles.incomExpItem}>
              <TrendingUp size={16} color={theme.colors.income} />
              <Text style={styles.incomeText}>{formatAmount(totalIncome, currency)}</Text>
              <Text style={styles.incomeLabel}>Income</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.incomExpItem}>
              <TrendingDown size={16} color={theme.colors.expense} />
              <Text style={styles.expenseText}>{formatAmount(totalExpense, currency)}</Text>
              <Text style={styles.expenseLabel}>Expense</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Balance Modes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By Mode</Text>
        <View style={styles.modeRow}>
          <View style={[styles.modeCard, theme.shadow.md]}>
            <View style={[styles.modeIconBox, { backgroundColor: theme.colors.infoLight }]}>
              <Wallet size={20} color={theme.colors.info} />
            </View>
            <Text style={styles.modeName}>Cash</Text>
            <Text style={styles.modeBalance}>
              {formatAmount(cashBalance ? Number(cashBalance.current_balance) : 0, currency)}
            </Text>
            <View style={styles.modeStats}>
              <Text style={styles.modeStat}>↑ {formatAmount(cashBalance ? Number(cashBalance.total_income) : 0, currency)}</Text>
              <Text style={[styles.modeStat, { color: theme.colors.expense }]}>↓ {formatAmount(cashBalance ? Number(cashBalance.total_expense) : 0, currency)}</Text>
            </View>
          </View>

          <View style={[styles.modeCard, theme.shadow.md]}>
            <View style={[styles.modeIconBox, { backgroundColor: theme.colors.accentLight }]}>
              <CreditCard size={20} color={theme.colors.accent} />
            </View>
            <Text style={styles.modeName}>Bank</Text>
            <Text style={styles.modeBalance}>
              {formatAmount(bankBalance ? Number(bankBalance.current_balance) : 0, currency)}
            </Text>
            <View style={styles.modeStats}>
              <Text style={styles.modeStat}>↑ {formatAmount(bankBalance ? Number(bankBalance.total_income) : 0, currency)}</Text>
              <Text style={[styles.modeStat, { color: theme.colors.expense }]}>↓ {formatAmount(bankBalance ? Number(bankBalance.total_expense) : 0, currency)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {recentTransactions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No transactions yet. Tap + to add one!</Text>
          </View>
        ) : (
          recentTransactions.map((tx) => (
            <View key={tx.id} style={[styles.txRow, theme.shadow.sm]}>
              <View style={[
                styles.txIcon,
                { backgroundColor: tx.type === 'income' ? theme.colors.incomeLight : theme.colors.expenseLight }
              ]}>
                {tx.type === 'income'
                  ? <TrendingUp size={16} color={theme.colors.income} />
                  : <TrendingDown size={16} color={theme.colors.expense} />
                }
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txCategory}>{tx.category}</Text>
                <Text style={styles.txNote} numberOfLines={1}>{tx.note || tx.date}</Text>
              </View>
              <Text style={[
                styles.txAmount,
                { color: tx.type === 'income' ? theme.colors.income : theme.colors.expense }
              ]}>
                {tx.type === 'income' ? '+' : '-'}{formatAmount(Number(tx.amount), currency)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    borderBottomLeftRadius: theme.radius.xxl,
    borderBottomRightRadius: theme.radius.xxl,
  },
  headerGreeting: { ...theme.typography.title, color: '#fff', marginBottom: 2 },
  headerSub: { ...theme.typography.subtitle, color: 'rgba(255,255,255,0.7)', marginBottom: 20 },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  balanceLabel: { ...theme.typography.label, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  balanceValue: { ...theme.typography.hero, color: '#fff', marginBottom: 16 },
  incomExpRow: { flexDirection: 'row', alignItems: 'center' },
  incomExpItem: { flex: 1, alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.25)' },
  incomeText: { ...theme.typography.heading, color: theme.colors.income },
  incomeLabel: { ...theme.typography.caption, color: 'rgba(255,255,255,0.7)' },
  expenseText: { ...theme.typography.heading, color: theme.colors.expense },
  expenseLabel: { ...theme.typography.caption, color: 'rgba(255,255,255,0.7)' },
  section: { margin: theme.spacing.lg, marginTop: theme.spacing.md },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text, marginBottom: theme.spacing.sm },
  modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  modeCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  modeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  modeName: { ...theme.typography.label, color: theme.colors.textSecondary, marginBottom: 4 },
  modeBalance: { ...theme.typography.heading, color: theme.colors.text, marginBottom: theme.spacing.sm },
  modeStats: { gap: 2 },
  modeStat: { ...theme.typography.caption, color: theme.colors.income },
  emptyBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  txRow: {
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
  txInfo: { flex: 1 },
  txCategory: { ...theme.typography.label, color: theme.colors.text },
  txNote: { ...theme.typography.caption, color: theme.colors.textMuted },
  txAmount: { ...theme.typography.label, fontWeight: '700' },
});
