import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export function SettingsScreen() {
  const { logout } = useAuth();

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <Section title="Account">
          <SettingsRow label="Profile" icon="👤" />
          <SettingsRow label="Email Connections" icon="✉️" />
          <SettingsRow label="Notification Preferences" icon="🔔" />
        </Section>

        <Section title="Preferences">
          <SettingsRow label="Interests" icon="❤️" />
          <SettingsRow label="Dietary Preferences" icon="🥗" />
          <SettingsRow label="Display Currency" icon="💱" />
          <SettingsRow label="Temperature Unit" icon="🌡️" />
          <SettingsRow label="Language" icon="🌐" />
        </Section>

        <Section title="Data">
          <SettingsRow label="Offline Trips" icon="📱" />
          <SettingsRow label="Storage Usage" icon="💾" />
          <SettingsRow label="Sync Status" icon="🔄" />
        </Section>

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Travel Companion v0.1.0</Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SettingsRow({ label, icon }: { label: string; icon: string }) {
  return (
    <TouchableOpacity style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowIcon}>{icon}</Text>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    padding: 16, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  content: { flex: 1 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, textTransform: 'uppercase' },
  sectionContent: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { fontSize: 18 },
  rowLabel: { fontSize: 15, color: '#1f2937' },
  rowChevron: { fontSize: 20, color: '#9ca3af' },
  logoutSection: { padding: 16, marginTop: 24 },
  logoutButton: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#fecaca',
  },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
  version: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 24, marginBottom: 32 },
});
