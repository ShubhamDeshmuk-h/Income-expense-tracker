import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import {
  Wallet, CreditCard, TrendingUp, TrendingDown, Plus,
  Activity, Lightbulb, ChevronRight,
} from 'lucide-react-native';
import {
  getBalanceSummary, getTransactionsPaginated, getMonthlySummary,
  getMonthlyTrend, centsToAmount,
  type BalanceSummary, type Transaction, type MonthlyTrend,
} from '@/lib/db';
import { generateInsights, type SpendingInsight } from '@/lib/analytics';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Minimal SVG-like sparkline using Views */
function SparkLine({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const width = SCREEN_WIDTH - 64;
  const height = 36;
  const stepX = width / (data.length - 1);

  return (
    <View style={{ height, width, flexDirection: 'row', alignItems: 'flex-end' }}>
      {data.map((val, i) => {
        const barHeight = Math.max(3, (val / max) * height);
        return (
          <View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 1,
              height: barHeight,
              backgroundColor: 'rgba(255,255,255,0.35)',
              borderRadius: 2,
            }}
          />
        );
      })}
    </View>
  );
}

const INSIGHT_COLORS: Record<SpendingInsight['type'], string> = {
  positive: theme.colors.income,
  warning: '#F59E0B',
  info: theme.colors.primary,
  anomaly: theme.colors.expense,
};

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();
  const [balances, setBalances] = useState<BalanceSummary[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [trend, setTrend] = useState<MonthlyTrend[]>([]);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;

      const [bal, txns, monthly, trendData, insightData] = await Promise.all([
        getBalanceSummary(),
        getTransactionsPaginated(0, 5),
        getMonthlySummary(y, m),
        getMonthlyTrend(6),
        generateInsights(y, m),
      ]);
      setBalances(bal);
      setRecent(txns);
      setMonthlyIncome(monthly.total_income_cents);
      setMonthlyExpense(monthly.total_expense_cents);
      setTrend(trendData);
      setInsights(insightData.slice(0, 2));
    } catch (e) {
      // Non-fatal — UI shows empty state
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const cashBalance = balances.find((b) => b.mode === 'cash');
  const bankBalance = balances.find((b) => b.mode === 'bank');
  const totalBalance = balances.reduce((s, b) => s + b.current_balance_cents, 0);
  const trendExpenses = trend.map((t) => t.expense_cents);

  const PAYMENT_ICON_MAP: Record<string, string> = {
    cash: '💵',
    bank: '🏦',
    upi: '📱',
    card: '💳',
    atm: '🏧',
    other: '💸',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 80 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getGreeting()} 👋</Text>
            <Text style={styles.appName}>VaultFlow</Text>
          </View>
          <TouchableOpacity
            style={styles.addFab}
            onPress={() => router.push('/(tabs)/add' as any)}
            accessibilityLabel="Add transaction"
          >
            <Plus size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>{formatAmount(centsToAmount(totalBalance), currency)}</Text>

          <SparkLine data={trendExpenses.length ? trendExpenses : [0, 0]} />
          <Text style={styles.sparkLabel}>Last 6 months spending trend</Text>

          <View style={styles.inExRow}>
            <View style={styles.inExItem}>
              <TrendingUp size={14} color={theme.colors.income} />
              <Text style={styles.inExLabel}>Income</Text>
              <Text style={[styles.inExValue, { color: theme.colors.income }]}>
                {formatAmount(centsToAmount(monthlyIncome), currency)}
              </Text>
            </View>
            <View style={styles.inExDivider} />
            <View style={styles.inExItem}>
              <TrendingDown size={14} color={theme.colors.expense} />
              <Text style={styles.inExLabel}>Expenses</Text>
              <Text style={[styles.inExValue, { color: theme.colors.expense }]}>
                {formatAmount(centsToAmount(monthlyExpense), currency)}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Cash & Bank */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <View style={styles.modeRow}>
          {[
            {
              label: 'Cash', icon: Wallet, balance: cashBalance?.current_balance_cents ?? 0,
              income: cashBalance?.total_income_cents ?? 0,
              expense: cashBalance?.total_expense_cents ?? 0,
              bg: theme.colors.infoLight, color: theme.colors.info,
            },
            {
              label: 'Bank', icon: CreditCard, balance: bankBalance?.current_balance_cents ?? 0,
              income: bankBalance?.total_income_cents ?? 0,
              expense: bankBalance?.total_expense_cents ?? 0,
              bg: theme.colors.accentLight, color: theme.colors.accent,
            },
          ].map(({ label, icon: Icon, balance, income, expense, bg, color }) => (
            <View key={label} style={[styles.modeCard, theme.shadow.md]}>
              <View style={[styles.modeIconBox, { backgroundColor: bg }]}>
                <Icon size={20} color={color} />
              </View>
              <Text style={styles.modeName}>{label}</Text>
              <Text style={[
                styles.modeBalance,
                { color: balance >= 0 ? theme.colors.text : theme.colors.expense }
              ]}>
                {formatAmount(centsToAmount(balance), currency)}
              </Text>
              <View style={styles.modeStats}>
                <Text style={[styles.modeStat, { color: theme.colors.income }]}>
                  ↑ {formatAmount(centsToAmount(income), currency)}
                </Text>
                <Text style={[styles.modeStat, { color: theme.colors.expense }]}>
                  ↓ {formatAmount(centsToAmount(expense), currency)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Insights */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Lightbulb size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Insights</Text>
          </View>
          <View style={styles.insightList}>
            {insights.map((ins) => (
              <View key={ins.id} style={[styles.insightCard, theme.shadow.sm]}>
                <View style={[styles.insightBar, { backgroundColor: INSIGHT_COLORS[ins.type] }]} />
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>{ins.title}</Text>
                  <Text style={styles.insightBody}>{ins.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Activity size={16} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history' as any)}>
            <ChevronRight size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyBody}>Tap the + button to record your first income or expense.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/(tabs)/add' as any)}
            >
              <Text style={styles.emptyBtnText}>Add Transaction</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recent.map((tx) => {
            const pmIcon = PAYMENT_ICON_MAP[tx.payment_method] ?? '💸';
            return (
              <View key={tx.id} style={[styles.txRow, theme.shadow.sm]}>
                <View style={[
                  styles.txIcon,
                  { backgroundColor: tx.type === 'income' ? theme.colors.incomeLight : theme.colors.expenseLight }
                ]}>
                  {tx.type === 'income'
                    ? <TrendingUp size={16} color={theme.colors.income} />
                    : <TrendingDown size={16} color={theme.colors.expense} />}
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txCategory}>
                    {tx.merchant ? tx.merchant : tx.category}
                  </Text>
                  <Text style={styles.txMeta} numberOfLines={1}>
                    {pmIcon} {tx.payment_method.toUpperCase()} · {tx.date}
                    {tx.note ? ` · ${tx.note}` : ''}
                  </Text>
                </View>
                <Text style={[
                  styles.txAmount,
                  { color: tx.type === 'income' ? theme.colors.income : theme.colors.expense }
                ]}>
                  {tx.type === 'income' ? '+' : '-'}{formatAmount(centsToAmount(tx.amount_cents), currency)}
                </Text>
              </View>
            );
          })
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  appName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  addFab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  balanceCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 8,
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  balanceValue: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  sparkLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: -4 },
  inExRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  inExItem: { flex: 1, alignItems: 'center', gap: 2 },
  inExDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },
  inExLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
  inExValue: { fontSize: 15, fontWeight: '700' },
  section: { marginHorizontal: theme.spacing.md, marginTop: theme.spacing.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.spacing.sm },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text, flex: 1 },
  modeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  modeCard: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: theme.spacing.md,
  },
  modeIconBox: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  modeName: { ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: 2 },
  modeBalance: { ...theme.typography.heading, color: theme.colors.text, marginBottom: 8 },
  modeStats: { gap: 2 },
  modeStat: { ...theme.typography.caption },
  insightList: { gap: theme.spacing.sm },
  insightCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  insightBar: { width: 4 },
  insightContent: { flex: 1, padding: theme.spacing.md },
  insightTitle: { ...theme.typography.label, color: theme.colors.text, marginBottom: 4 },
  insightBody: { ...theme.typography.caption, color: theme.colors.textSecondary, lineHeight: 18 },
  emptyBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyTitle: { ...theme.typography.heading, color: theme.colors.text },
  emptyBody: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full, paddingVertical: 10, paddingHorizontal: 20,
  },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  txRow: {
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
  txInfo: { flex: 1 },
  txCategory: { ...theme.typography.label, color: theme.colors.text },
  txMeta: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  txAmount: { ...theme.typography.label, fontWeight: '700' },
});
