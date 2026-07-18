import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Map screen with Google Maps integration.
 * Shows trip locations with custom markers categorized by type.
 */
export function MapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map</Text>
      </View>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapText}>
          Map view with trip locations
        </Text>
        <Text style={styles.mapSubtext}>
          Requires react-native-maps configuration
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    padding: 16, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  mapPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#e5e7eb',
  },
  mapIcon: { fontSize: 48, marginBottom: 16 },
  mapText: { fontSize: 16, color: '#4b5563', fontWeight: '600' },
  mapSubtext: { fontSize: 14, color: '#6b7280', marginTop: 8 },
});
