import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '../lib/api';

interface Trip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  destination: string | null;
}

export function DashboardScreen({ navigation }: any) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrips = useCallback(async () => {
    try {
      const res = await api.get<{ data: Trip[] }>('/api/trips');
      setTrips(res.data);
    } catch {
      // Handle error silently
    }
  }, []);

  useEffect(() => {
    fetchTrips().finally(() => setLoading(false));
  }, [fetchTrips]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchTrips();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={trips.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No trips yet</Text>
            <Text style={styles.emptySubtext}>Create your first trip to get started!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tripCard}
            onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
          >
            <Text style={styles.tripName}>{item.name}</Text>
            {item.destination && (
              <Text style={styles.tripDestination}>📍 {item.destination}</Text>
            )}
            {item.start_date && (
              <Text style={styles.tripDates}>
                {new Date(item.start_date).toLocaleDateString()} —{' '}
                {item.end_date ? new Date(item.end_date).toLocaleDateString() : 'Open'}
              </Text>
            )}
          </TouchableOpacity>
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
    padding: 16, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6b7280' },
  emptySubtext: { fontSize: 14, color: '#9ca3af', marginTop: 8 },
  tripCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12,
  },
  tripName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  tripDestination: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  tripDates: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
});
