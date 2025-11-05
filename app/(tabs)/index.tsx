import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase, Balance } from '@/lib/supabase';
import { Wallet, CreditCard, TrendingUp, TrendingDown } from 'lucide-react-native';

export default function Dashboard() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('balances')
        .select('*')
        .order('mode');

      if (error) throw error;

      if (data) {
        setBalances(data);
        const income = data.reduce((sum, b) => sum + Number(b.total_income), 0);
        const expense = data.reduce(
          (sum, b) => sum + Number(b.total_expense),
          0
        );
        setTotalIncome(income);
        setTotalExpense(expense);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch balances');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const cashBalance = balances.find((b) => b.mode === 'cash');
  const bankBalance = balances.find((b) => b.mode === 'bank');

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <View style={styles.header}>
        <Text style={styles.title}>Finance Tracker</Text>
        <Text style={styles.subtitle}>Your Personal Budget Manager</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconContainer}>
            <TrendingUp size={24} color="#10b981" />
          </View>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={[styles.summaryAmount, styles.incomeText]}>
            ₹{totalIncome.toFixed(2)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIconContainer}>
            <TrendingDown size={24} color="#ef4444" />
          </View>
          <Text style={styles.summaryLabel}>Total Expenses</Text>
          <Text style={[styles.summaryAmount, styles.expenseText]}>
            ₹{totalExpense.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.balanceSection}>
        <Text style={styles.sectionTitle}>Current Balances</Text>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceIconWrapper}>
              <Wallet size={24} color="#3b82f6" />
            </View>
            <Text style={styles.balanceTitle}>In-hand Cash</Text>
          </View>
          <Text style={styles.balanceAmount}>
            ₹{cashBalance ? Number(cashBalance.current_balance).toFixed(2) : '0.00'}
          </Text>
          <View style={styles.balanceDetails}>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>Income</Text>
              <Text style={styles.balanceDetailValue}>
                ₹{cashBalance ? Number(cashBalance.total_income).toFixed(2) : '0.00'}
              </Text>
            </View>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>Expense</Text>
              <Text style={styles.balanceDetailValue}>
                ₹{cashBalance ? Number(cashBalance.total_expense).toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceIconWrapper}>
              <CreditCard size={24} color="#8b5cf6" />
            </View>
            <Text style={styles.balanceTitle}>Bank / Online</Text>
          </View>
          <Text style={styles.balanceAmount}>
            ₹{bankBalance ? Number(bankBalance.current_balance).toFixed(2) : '0.00'}
          </Text>
          <View style={styles.balanceDetails}>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>Income</Text>
              <Text style={styles.balanceDetailValue}>
                ₹{bankBalance ? Number(bankBalance.total_income).toFixed(2) : '0.00'}
              </Text>
            </View>
            <View style={styles.balanceDetailItem}>
              <Text style={styles.balanceDetailLabel}>Expense</Text>
              <Text style={styles.balanceDetailValue}>
                ₹{bankBalance ? Number(bankBalance.total_expense).toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>
        </View>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#dbeafe',
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
  summarySection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryIconContainer: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  incomeText: {
    color: '#10b981',
  },
  expenseText: {
    color: '#ef4444',
  },
  balanceSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  balanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  balanceDetailItem: {
    flex: 1,
  },
  balanceDetailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  balanceDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
