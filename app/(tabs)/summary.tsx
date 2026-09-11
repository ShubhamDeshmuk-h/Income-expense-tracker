import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  BarChart3, TrendingUp, TrendingDown, PieChart,
  Lightbulb, Zap, Target,
} from 'lucide-react-native';
import {
  getBalanceSummary, centsToAmount,
} from '@/lib/db';
import {
  getAnalyticsSummary, type AnalyticsSummary,
  type SpendingInsight,
} from '@/lib/analytics';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { formatAmount } from '@/lib/currency';
import { theme } from '@/lib/theme';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const INSIGHT_COLORS: Record<SpendingInsight['type'], { bg: string; text: string; border: string }> = {
  positive: { bg: theme.colors.incomeLight, text: theme.colors.income, border: `${theme.colors.income}40` },
  warning: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  info: { bg: theme.colors.infoLight, text: theme.colors.info, border: `${theme.colors.info}40` },
  anomaly: { bg: theme.colors.expenseLight, text: theme.colors.expense, border: `${theme.colors.expense}40` },
};

export default function Summary() {
  const insets = useSafeAreaInsets();
  const currency = useCurrencyPreference();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [data, balances] = await Promise.all([
        getAnalyticsSummary(selectedYear, selectedMonth + 1),
        getBalanceSummary(),
      ]);
      setAnalytics(data);
      setTotalBalance(balances.reduce((s, b) => s + b.current_balance_cents, 0));
    } catch { /* non-fatal */ }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [selectedMonth, selectedYear]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const a = analytics;
  const income_cents = a?.currentMonth.income_cents ?? 0;
  const expense_cents = a?.currentMonth.expense_cents ?? 0;
  const net_cents = income_cents - expense_cents;
  const savingsRate = a?.currentMonth.savingsRate ?? 0;

  const categories = a?.categoryBreakdown ?? [];
  const filteredCategories = categories; // already filtered by month in analytics engine
  const maxCat = Math.max(...filteredCategories.map((c) => c.total_cents), 1);

  // Mini bar chart from trend
  const trendData = a?.trend ?? [];
  const maxTrend = Math.max(...trendData.map((t) => Math.max(t.income_cents, t.expense_cents)), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <LinearGradient
        colors={[theme.colors.primaryDark, theme.colors.primary]}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 8 }]}
      >
        <Text style={styles.title}>Financial Summary</Text>
        <Text style={styles.subtitle}>Balance: {formatAmount(centsToAmount(totalBalance), currency)}</Text>
      </LinearGradient>

      {/* Month picker */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.monthRow}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, gap: 8 }}
      >
        {MONTHS.map((m, i) => (
          <TouchableOpacity
            key={m}
            style={[styles.monthChip, selectedMonth === i && styles.monthChipActive]}
            onPress={() => setSelectedMonth(i)}
          >
            <Text style={[styles.monthText, selectedMonth === i && styles.monthTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        {[
          { label: 'Income', value: income_cents, color: theme.colors.income, bg: theme.colors.incomeLight, icon: TrendingUp },
          { label: 'Expenses', value: expense_cents, color: theme.colors.expense, bg: theme.colors.expenseLight, icon: TrendingDown },
          { label: 'Net', value: net_cents, color: net_cents >= 0 ? theme.colors.income : theme.colors.expense, bg: theme.colors.infoLight, icon: BarChart3 },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <View key={label} style={[styles.statCard, theme.shadow.sm]}>
            <View style={[styles.statIcon, { backgroundColor: bg }]}>
              <Icon size={16} color={color} />
            </View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, { color }]}>
              {formatAmount(centsToAmount(Math.abs(value)), currency)}
            </Text>
          </View>
        ))}
      </View>

      {/* Savings rate + Burn rate */}
      <View style={[styles.section, { flexDirection: 'row', gap: theme.spacing.sm }]}>
        <View style={[styles.metricCard, theme.shadow.sm]}>
          <Target size={16} color={theme.colors.primary} />
          <Text style={styles.metricLabel}>Savings Rate</Text>
          <Text style={[styles.metricValue, { color: savingsRate >= 0 ? theme.colors.income : theme.colors.expense }]}>
            {savingsRate >= 0 ? '+' : ''}{savingsRate.toFixed(1)}%
          </Text>
        </View>
        <View style={[styles.metricCard, theme.shadow.sm]}>
          <Zap size={16} color={theme.colors.accent} />
          <Text style={styles.metricLabel}>Daily Burn</Text>
          <Text style={[styles.metricValue, { color: theme.colors.expense }]}>
            {formatAmount(centsToAmount(a?.currentMonth.burnRate_cents ?? 0), currency)}
          </Text>
        </View>
      </View>

      {/* Trend bars */}
      {trendData.length > 1 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>6-Month Trend</Text>
          </View>
          <View style={styles.trendChart}>
            {trendData.map((t, i) => (
              <View key={i} style={styles.trendColumn}>
                <View style={styles.trendBars}>
                  <View style={[
                    styles.trendBar,
                    {
                      height: Math.max(4, (t.income_cents / maxTrend) * 70),
                      backgroundColor: theme.colors.income,
                    }
                  ]} />
                  <View style={[
                    styles.trendBar,
                    {
                      height: Math.max(4, (t.expense_cents / maxTrend) * 70),
                      backgroundColor: theme.colors.expense,
                    }
                  ]} />
                </View>
                <Text style={styles.trendMonth}>{MONTHS[(t.month - 1) % 12]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.trendLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.income }]} />
              <Text style={styles.legendText}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.colors.expense }]} />
              <Text style={styles.legendText}>Expenses</Text>
            </View>
          </View>
        </View>
      )}

      {/* Category breakdown */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <PieChart size={16} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
        </View>

        <View style={styles.tabRow}>
          {(['expense', 'income'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
                {t === 'expense' ? 'Expenses' : 'Income'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredCategories.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No {activeTab} data this month</Text>
          </View>
        ) : (
          filteredCategories.map((item) => {
            const pct = Math.round((item.total_cents / maxCat) * 100);
            return (
              <View key={item.category} style={styles.catRow}>
                <Text style={styles.catName} numberOfLines={1}>{item.category}</Text>
                <View style={styles.barTrack}>
                  <View style={[
                    styles.barFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: activeTab === 'income' ? theme.colors.income : theme.colors.expense,
                    }
                  ]} />
                </View>
                <Text style={styles.catAmount}>
                  {formatAmount(centsToAmount(item.total_cents), currency)}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Insights */}
      {(a?.insights ?? []).length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Lightbulb size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Insights</Text>
          </View>
          <View style={styles.insightList}>
            {(a?.insights ?? []).map((ins) => {
              const col = INSIGHT_COLORS[ins.type];
              return (
                <View key={ins.id} style={[styles.insightCard, { backgroundColor: col.bg, borderColor: col.border }]}>
                  <Text style={[styles.insightTitle, { color: col.text }]}>{ins.title}</Text>
                  <Text style={[styles.insightBody, { color: col.text }]}>{ins.body}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Forecast */}
      {a?.forecast && a.forecast.confidence !== 'insufficient_data' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>End-of-Month Forecast</Text>
          </View>
          <View style={[styles.forecastCard, theme.shadow.sm]}>
            <Text style={styles.forecastLabel}>Estimated total spend</Text>
            <Text style={styles.forecastValue}>
              {formatAmount(centsToAmount(a.forecast.estimatedEndOfMonthExpense_cents), currency)}
            </Text>
            <Text style={styles.forecastMeta}>
              Confidence: {a.forecast.confidence} · {a.forecast.daysRemaining} days remaining
            </Text>
          </View>
        </View>
      )}

      {/* Top merchants */}
      {(a?.merchantBreakdown ?? []).length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={16} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Top Merchants</Text>
          </View>
          {(a?.merchantBreakdown ?? []).map((m, i) => (
            <View key={m.merchant} style={[styles.merchantRow, theme.shadow.sm]}>
              <View style={styles.merchantRank}>
                <Text style={styles.merchantRankText}>#{i + 1}</Text>
              </View>
              <Text style={styles.merchantName} numberOfLines={1}>{m.merchant}</Text>
              <Text style={styles.merchantAmount}>
                {formatAmount(centsToAmount(m.total_cents), currency)}
              </Text>
            </View>
          ))}
        </View>
      )}
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
  monthRow: { maxHeight: 52, marginVertical: theme.spacing.md },
  monthChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: 1, borderColor: theme.colors.border,
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
    padding: theme.spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statLabel: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  statValue: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  section: { marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text },
  metricCard: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    padding: theme.spacing.md, alignItems: 'center', gap: 4,
  },
  metricLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  metricValue: { ...theme.typography.heading },
  trendChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90, marginBottom: 4 },
  trendColumn: { flex: 1, alignItems: 'center', gap: 4 },
  trendBars: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  trendBar: { width: 8, borderRadius: 3 },
  trendMonth: { fontSize: 9, color: theme.colors.textMuted },
  trendLegend: { flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...theme.typography.caption, color: theme.colors.textMuted },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.md, padding: 4, gap: 4, marginBottom: theme.spacing.md,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.sm, alignItems: 'center' },
  tabBtnActive: { backgroundColor: theme.colors.primary },
  tabBtnText: { ...theme.typography.label, color: theme.colors.textSecondary },
  tabBtnTextActive: { color: '#fff' },
  emptyBox: { padding: theme.spacing.xl, alignItems: 'center' },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  catName: { ...theme.typography.label, color: theme.colors.text, width: 90, fontSize: 12 },
  barTrack: { flex: 1, height: 8, backgroundColor: theme.colors.surfaceElevated, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  catAmount: { ...theme.typography.caption, color: theme.colors.textSecondary, width: 80, textAlign: 'right', fontSize: 11 },
  insightList: { gap: theme.spacing.sm },
  insightCard: {
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    borderWidth: 1, gap: 4,
  },
  insightTitle: { fontSize: 14, fontWeight: '700' },
  insightBody: { fontSize: 13, lineHeight: 18 },
  forecastCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    padding: theme.spacing.md, gap: 4,
  },
  forecastLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  forecastValue: { ...theme.typography.title, color: theme.colors.expense },
  forecastMeta: { ...theme.typography.caption, color: theme.colors.textMuted, textTransform: 'capitalize' },
  merchantRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.sm, gap: 10,
  },
  merchantRank: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.surfaceElevated, justifyContent: 'center', alignItems: 'center',
  },
  merchantRankText: { ...theme.typography.caption, color: theme.colors.textSecondary, fontWeight: '700' },
  merchantName: { ...theme.typography.label, color: theme.colors.text, flex: 1 },
  merchantAmount: { ...theme.typography.label, color: theme.colors.expense, fontWeight: '700' },
});
