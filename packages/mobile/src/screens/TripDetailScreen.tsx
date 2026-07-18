import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { api } from '../lib/api';

interface TripDetail {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  destination: string | null;
  budget: number | null;
}

export function TripDetailScreen({ route }: any) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'map' | 'expenses' | 'docs'>('timeline');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: TripDetail }>(`/api/trips/${tripId}`)
      .then((res) => setTrip(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  if (!trip) {
    return <View style={styles.center}><Text>Trip not found</Text></View>;
  }

  const tabs = [
    { id: 'timeline' as const, label: '📅 Timeline' },
    { id: 'map' as const, label: '🗺️ Map' },
    { id: 'expenses' as const, label: '💰 Expenses' },
    { id: 'docs' as const, label: '📄 Docs' },
  ];

  return (
    <View style={styles.container}>
      {/* Trip header */}
      <View style={styles.header}>
        <Text style={styles.tripName}>{trip.name}</Text>
        {trip.destination && <Text style={styles.destination}>📍 {trip.destination}</Text>}
        {trip.start_date && (
          <Text style={styles.dates}>
            {new Date(trip.start_date).toLocaleDateString()} —{' '}
            {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : 'Open'}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <ScrollView style={styles.content}>
        {activeTab === 'timeline' && <TimelineView tripId={tripId} />}
        {activeTab === 'map' && <MapView />}
        {activeTab === 'expenses' && <ExpensesView tripId={tripId} />}
        {activeTab === 'docs' && <DocumentsView />}
      </ScrollView>
    </View>
  );
}

function TimelineView({ tripId }: { tripId: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>📅 Timeline events will appear here</Text>
      <Text style={styles.placeholderSubtext}>Add bookings and events to populate your timeline</Text>
    </View>
  );
}

function MapView() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>🗺️ Map View</Text>
      <Text style={styles.placeholderSubtext}>Your trip locations with custom markers</Text>
    </View>
  );
}

function ExpensesView({ tripId }: { tripId: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>💰 Expenses</Text>
      <Text style={styles.placeholderSubtext}>Track spending and scan receipts</Text>
    </View>
  );
}

function DocumentsView() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>📄 Documents</Text>
      <Text style={styles.placeholderSubtext}>Boarding passes, confirmations, and vouchers</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tripName: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  destination: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  dates: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#2563eb' },
  tabText: { fontSize: 12, color: '#6b7280' },
  tabTextActive: { color: '#2563eb', fontWeight: '600' },
  content: { flex: 1 },
  placeholder: { padding: 32, alignItems: 'center' },
  placeholderText: { fontSize: 16, color: '#6b7280', fontWeight: '600' },
  placeholderSubtext: { fontSize: 14, color: '#9ca3af', marginTop: 8, textAlign: 'center' },
});
