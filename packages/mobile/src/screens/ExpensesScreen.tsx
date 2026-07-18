import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '../lib/api';

interface Expense {
  id: string;
  amount: number;
  currency: string;
  converted_amount: number | null;
  category: string;
  date: string;
  merchant_name: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  food_drink: '🍕',
  transport: '🚗',
  accommodation: '🏨',
  activities: '🎭',
  shopping: '🛍️',
  health: '💊',
  other: '📦',
};

export function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await api.get<{ data: Expense[] }>('/api/expenses');
      setExpenses(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchExpenses().finally(() => setLoading(false));
  }, [fetchExpenses]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchExpenses();
    setRefreshing(false);
  }

  const totalSpent = expenses.reduce((sum, e) => sum + (e.converted_amount ?? e.amount), 0);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <TouchableOpacity style={styles.scanButton}>
          <Text style={styles.scanButtonText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Total */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Spent</Text>
        <Text style={styles.totalAmount}>${totalSpent.toFixed(2)}</Text>
        <Text style={styles.totalCount}>{expenses.length} expenses</Text>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No expenses yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.expenseCard}>
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseIcon}>
                {CATEGORY_ICONS[item.category] ?? '📦'}
              </Text>
              <View>
                <Text style={styles.expenseName}>
                  {item.merchant_name ?? item.category.replace('_', ' ')}
                </Text>
                <Text style={styles.expenseDate}>{item.date}</Text>
              </View>
            </View>
            <View style={styles.expenseRight}>
              <Text style={styles.expenseAmount}>
                {item.currency} {item.amount.toFixed(2)}
              </Text>
              {item.converted_amount && item.currency !== 'USD' && (
                <Text style={styles.expenseConverted}>
                  ≈ ${item.converted_amount.toFixed(2)}
                </Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  scanButton: { backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  scanButtonText: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  totalCard: {
    backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center',
  },
  totalLabel: { fontSize: 14, color: '#6b7280' },
  totalAmount: { fontSize: 32, fontWeight: 'bold', color: '#1f2937', marginTop: 4 },
  totalCount: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  list: { paddingHorizontal: 16 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6b7280' },
  expenseCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8,
  },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expenseIcon: { fontSize: 24 },
  expenseName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  expenseDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  expenseRight: { alignItems: 'flex-end' },
  expenseAmount: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  expenseConverted: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});
