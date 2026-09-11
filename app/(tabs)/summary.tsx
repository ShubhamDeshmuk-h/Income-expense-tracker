import { useCallback, useState } from 'react';
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
import { BarChart3, TrendingUp, TrendingDown, PieChart } from 'lucide-react-native';
import {
  getBalanceSummary,
  getMonthlySummary,
  getCategoryBreakdown,
  type BalanceSummary,
} from '@/lib/db';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function Summary() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();
  const [balances, setBalances] = useState<BalanceSummary[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; total: number; count: number }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const [bal, monthly, cats] = await Promise.all([
      getBalanceSummary(),
      getMonthlySummary(selectedYear, selectedMonth + 1),
      getCategoryBreakdown(activeTab),
    ]);
    setBalances(bal);
    setMonthlyIncome(monthly.total_income);
    setMonthlyExpense(monthly.total_expense);
    setCategoryBreakdown(cats);
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [selectedMonth, activeTab])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const totalBalance = balances.reduce((s, b) => s + Number(b.current_balance), 0);
  const maxCategoryTotal = Math.max(...categoryBreakdown.map((c) => c.total), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 80 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }>
      {/* Header */}
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}>
        <Text style={styles.title}>Financial Summary</Text>
        <Text style={styles.subtitle}>Total Balance: {formatAmount(totalBalance, currency)}</Text>
      </LinearGradient>

      {/* Month Picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.monthRow}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}>
        {MONTHS.map((m, i) => (
          <TouchableOpacity
            key={m}
            style={[styles.monthChip, selectedMonth === i && styles.monthChipActive]}
            onPress={() => setSelectedMonth(i)}>
            <Text style={[styles.monthText, selectedMonth === i && styles.monthTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Monthly Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, theme.shadow.sm]}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.incomeLight }]}>
            <TrendingUp size={18} color={theme.colors.income} />
          </View>
          <Text style={styles.statLabel}>Income</Text>
          <Text style={[styles.statValue, { color: theme.colors.income }]}>
            {formatAmount(monthlyIncome, currency)}
          </Text>
        </View>
        <View style={[styles.statCard, theme.shadow.sm]}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.expenseLight }]}>
            <TrendingDown size={18} color={theme.colors.expense} />
          </View>
          <Text style={styles.statLabel}>Expenses</Text>
          <Text style={[styles.statValue, { color: theme.colors.expense }]}>
            {formatAmount(monthlyExpense, currency)}
          </Text>
        </View>
        <View style={[styles.statCard, theme.shadow.sm]}>
          <View style={[styles.statIcon, { backgroundColor: theme.colors.infoLight }]}>
            <BarChart3 size={18} color={theme.colors.info} />
          </View>
          <Text style={styles.statLabel}>Net</Text>
          <Text style={[
            styles.statValue,
            { color: monthlyIncome - monthlyExpense >= 0 ? theme.colors.income : theme.colors.expense }
          ]}>
            {formatAmount(monthlyIncome - monthlyExpense, currency)}
          </Text>
        </View>
      </View>

      {/* Category Breakdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <PieChart size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
        </View>
        <View style={styles.tabRow}>
          {(['expense', 'income'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {categoryBreakdown.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No data for this period</Text>
          </View>
        ) : (
          categoryBreakdown.map((item) => (
            <View key={item.category} style={styles.catRow}>
              <Text style={styles.catName}>{item.category}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round((item.total / maxCategoryTotal) * 100)}%`,
                      backgroundColor: activeTab === 'income' ? theme.colors.income : theme.colors.expense,
                    },
                  ]}
                />
              </View>
              <Text style={styles.catAmount}>{formatAmount(item.total, currency)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Balance by Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Balance by Mode</Text>
        {balances.map((b) => (
          <View key={b.mode} style={[styles.modeCard, theme.shadow.sm]}>
            <Text style={styles.modeName}>{b.mode.charAt(0).toUpperCase() + b.mode.slice(1)}</Text>
            <View style={styles.modeDetails}>
              <Text style={[styles.modeDetail, { color: theme.colors.income }]}>
                ↑ {formatAmount(Number(b.total_income), currency)}
              </Text>
              <Text style={[styles.modeDetail, { color: theme.colors.expense }]}>
                ↓ {formatAmount(Number(b.total_expense), currency)}
              </Text>
              <Text style={[
                styles.modeBalance,
                { color: Number(b.current_balance) >= 0 ? theme.colors.income : theme.colors.expense }
              ]}>
                {formatAmount(Number(b.current_balance), currency)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
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
  monthRow: { maxHeight: 48, marginVertical: theme.spacing.md },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  monthChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  monthText: { ...theme.typography.label, color: theme.colors.textSecondary },
  monthTextActive: { color: '#fff' },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  statLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  statValue: { ...theme.typography.label, fontWeight: '700', textAlign: 'center' },
  section: { margin: theme.spacing.md, marginTop: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text },
  tabRow: { flexDirection: 'row', backgroundColor: theme.colors.surfaceElevated, borderRadius: theme.radius.md, padding: 4, gap: 4, marginBottom: theme.spacing.md },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.sm, alignItems: 'center' },
  tabBtnActive: { backgroundColor: theme.colors.primary },
  tabBtnText: { ...theme.typography.label, color: theme.colors.textSecondary },
  tabBtnTextActive: { color: '#fff' },
  emptyBox: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  catName: { ...theme.typography.label, color: theme.colors.text, width: 80 },
  barTrack: { flex: 1, height: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  catAmount: { ...theme.typography.caption, color: theme.colors.textSecondary, width: 80, textAlign: 'right' },
  modeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeName: { ...theme.typography.label, color: theme.colors.text },
  modeDetails: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  modeDetail: { ...theme.typography.caption },
  modeBalance: { ...theme.typography.label, fontWeight: '700' },
});
