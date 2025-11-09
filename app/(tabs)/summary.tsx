import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { supabase, Transaction, Balance } from '@/lib/supabase';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import {
  Filter,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  DollarSign,
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;
const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#3b82f6',
  },
};

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

export default function Summary() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Fetch balances
      const { data: balancesData, error: balancesError } = await supabase
        .from('balances')
        .select('*')
        .order('mode');

      if (balancesError) throw balancesError;

      if (transactionsData) setTransactions(transactionsData);
      if (balancesData) setBalances(balancesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter transactions by month and category
  const filteredTransactions = transactions.filter((t) => {
    const transactionMonth = t.date.slice(0, 7);
    const monthMatch = transactionMonth === selectedMonth;
    const categoryMatch = selectedCategory === 'all' || t.category === selectedCategory;
    return monthMatch && categoryMatch;
  });

  // Calculate monthly income and expense
  const monthlyIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Prepare data for bar chart (income vs expense)
  const barChartData = {
    labels: ['Income', 'Expense'],
    datasets: [
      {
        data: [monthlyIncome, monthlyExpense],
      },
    ],
  };

  // Prepare data for expense distribution pie chart
  const expenseTransactions = filteredTransactions.filter((t) => t.type === 'expense');
  const categoryTotals: { [key: string]: number } = {};
  expenseTransactions.forEach((t) => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
  });

  const pieChartData = Object.entries(categoryTotals).map(([category, amount], index) => ({
    name: category,
    population: amount,
    color: `hsl(${(index * 360) / Math.max(Object.keys(categoryTotals).length, 1)}, 70%, 50%)`,
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  }));

  // Prepare data for line chart (monthly trends)
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return date.toISOString().slice(0, 7);
  });

  const monthlyTrends = months.map((month) => {
    const monthTransactions = transactions.filter((t) => t.date.slice(0, 7) === month);
    const income = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { month, income, expense };
  });

  const lineChartData = {
    labels: monthlyTrends.map((t) => {
      const date = new Date(t.month + '-01');
      return date.toLocaleDateString('en-US', { month: 'short' });
    }),
    datasets: [
      {
        data: monthlyTrends.map((t) => t.income),
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: monthlyTrends.map((t) => t.expense),
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Income', 'Expense'],
  };

  const cashBalance = balances.find((b) => b.mode === 'cash');
  const bankBalance = balances.find((b) => b.mode === 'bank');
  const totalBalance = (cashBalance ? Number(cashBalance.current_balance) : 0) +
    (bankBalance ? Number(bankBalance.current_balance) : 0);

  // Generate months for filter
  const availableMonths = Array.from(
    new Set(transactions.map((t) => t.date.slice(0, 7)))
  ).sort().reverse();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <View style={styles.header}>
        <Text style={styles.title}>Monthly Summary</Text>
        <Text style={styles.subtitle}>Analytics & Insights</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}>
          <Filter size={20} color="#ffffff" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Balance Summary */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <Wallet size={20} color="#3b82f6" />
            <Text style={styles.balanceLabel}>Cash</Text>
          </View>
          <Text style={styles.balanceAmount}>
            ₹{cashBalance ? Number(cashBalance.current_balance).toFixed(2) : '0.00'}
          </Text>
        </View>
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <CreditCard size={20} color="#8b5cf6" />
            <Text style={styles.balanceLabel}>Bank</Text>
          </View>
          <Text style={styles.balanceAmount}>
            ₹{bankBalance ? Number(bankBalance.current_balance).toFixed(2) : '0.00'}
          </Text>
        </View>
        <View style={[styles.balanceCard, styles.totalBalanceCard]}>
          <View style={styles.balanceRow}>
            <DollarSign size={20} color="#10b981" />
            <Text style={styles.balanceLabel}>Total</Text>
          </View>
          <Text style={[styles.balanceAmount, styles.totalBalanceAmount]}>
            ₹{totalBalance.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Income vs Expense Bar Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Income vs Expense</Text>
        <View style={styles.chartContainer}>
          <BarChart
            data={barChartData}
            width={Math.max(screenWidth - 32, 300)}
            height={220}
            yAxisLabel="₹"
            yAxisSuffix=""
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
          />
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <TrendingUp size={16} color="#10b981" />
            <Text style={styles.statLabel}>Income</Text>
            <Text style={[styles.statValue, styles.incomeText]}>
              ₹{monthlyIncome.toFixed(2)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <TrendingDown size={16} color="#ef4444" />
            <Text style={styles.statLabel}>Expense</Text>
            <Text style={[styles.statValue, styles.expenseText]}>
              ₹{monthlyExpense.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* Expense Distribution Pie Chart */}
      {pieChartData.length > 0 && (
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Expense Distribution</Text>
          <View style={styles.chartContainer}>
            <PieChart
              data={pieChartData}
              width={screenWidth - 32}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              style={styles.chart}
            />
          </View>
        </View>
      )}

      {/* Monthly Trends Line Chart */}
      {monthlyTrends.some((t) => t.income > 0 || t.expense > 0) && (
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>6-Month Trends</Text>
          <View style={styles.chartContainer}>
            <LineChart
              data={lineChartData}
              width={Math.max(screenWidth - 32, 300)}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              fromZero
            />
          </View>
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Options</Text>
            
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Month</Text>
              <FlatList
                data={availableMonths}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const date = new Date(item + '-01');
                  const monthName = date.toLocaleDateString('en-US', { 
                    month: 'long', 
                    year: 'numeric' 
                  });
                  return (
                    <TouchableOpacity
                      style={[
                        styles.filterOption,
                        selectedMonth === item && styles.filterOptionActive,
                      ]}
                      onPress={() => setSelectedMonth(item)}>
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedMonth === item && styles.filterOptionTextActive,
                        ]}>
                        {monthName}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.categoryFilterGrid}>
                <TouchableOpacity
                  style={[
                    styles.categoryFilterButton,
                    selectedCategory === 'all' && styles.categoryFilterButtonActive,
                  ]}
                  onPress={() => setSelectedCategory('all')}>
                  <Text
                    style={[
                      styles.categoryFilterButtonText,
                      selectedCategory === 'all' && styles.categoryFilterButtonTextActive,
                    ]}>
                    All
                  </Text>
                </TouchableOpacity>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryFilterButton,
                      selectedCategory === cat && styles.categoryFilterButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}>
                    <Text
                      style={[
                        styles.categoryFilterButtonText,
                        selectedCategory === cat && styles.categoryFilterButtonTextActive,
                      ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 8,
  },
  filterButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
  balanceSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  balanceCard: {
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
  totalBalanceCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  totalBalanceAmount: {
    color: '#10b981',
    fontSize: 20,
  },
  chartSection: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  incomeText: {
    color: '#10b981',
  },
  expenseText: {
    color: '#ef4444',
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
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
  filterOption: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  filterOptionActive: {
    backgroundColor: '#3b82f6',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  filterOptionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  categoryFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  categoryFilterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryFilterButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  categoryFilterButtonTextActive: {
    color: '#ffffff',
  },
  modalCloseButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

