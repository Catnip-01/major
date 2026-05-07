import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import { ShieldCheck, Moon, Trash2, Info } from 'lucide-react-native';

export const VaultScreen = ({ navigation }) => {
  const { theme, isDark, setIsDark } = useTheme();
  const [deviceId, setDeviceId] = useState('');

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    const id = await apiClient.getDeviceId();
    setDeviceId(id);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>The Vault</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>Your private, secure space.</Text>
      </View>

      {/* Security */}
      <Text style={[styles.sectionLabel, { color: theme.subtext }]}>SECURITY</Text>
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <View style={styles.row}>
          <View style={styles.iconLabel}>
            <ShieldCheck size={20} color={theme.secondary} />
            <View>
              <Text style={[styles.label, { color: theme.text }]}>Device Identity</Text>
              <Text style={[styles.value, { color: theme.subtext }]} numberOfLines={1}>{deviceId || 'Loading...'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Preferences */}
      <Text style={[styles.sectionLabel, { color: theme.subtext }]}>PREFERENCES</Text>
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <View style={styles.row}>
          <View style={styles.iconLabel}>
            <Moon size={20} color={theme.primary} />
            <Text style={[styles.label, { color: theme.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={setIsDark}
            trackColor={{ false: theme.border, true: theme.primary + '50' }}
            thumbColor={isDark ? theme.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* About */}
      <Text style={[styles.sectionLabel, { color: theme.subtext }]}>ABOUT</Text>
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <View style={styles.row}>
          <View style={styles.iconLabel}>
            <Info size={20} color={theme.subtext} />
            <Text style={[styles.label, { color: theme.text }]}>Palfin v1.0.0</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.dangerBtn}>
        <Trash2 size={18} color={theme.error} />
        <Text style={[styles.dangerText, { color: theme.error }]}>Wipe Local Cache</Text>
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { paddingHorizontal: 24, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },

  sectionLabel: { fontSize: 11, fontWeight: '800', marginHorizontal: 24, marginBottom: 8, letterSpacing: 1.2 },
  section: { marginHorizontal: 24, borderRadius: 20, padding: 16, marginBottom: 28, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  label: { fontSize: 15, fontWeight: '600' },
  value: { fontSize: 11, maxWidth: 200, marginTop: 2 },

  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 40 },
  dangerText: { fontSize: 14, fontWeight: '700' },
});
