import React, { useEffect, useState } from 'react';
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
import { 
  History, 
  ShieldCheck, 
  Moon, 
  ChevronRight, 
  Trash2 
} from 'lucide-react-native';

export const VaultScreen = ({ navigation }) => {
  const { theme, isDark, setIsDark } = useTheme();
  const [deviceId, setDeviceId] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const id = await apiClient.getDeviceId();
    setDeviceId(id);
    const chats = await apiClient.fetchHistory(id);
    setHistory(chats);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>The Vault</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>Secure, private, and encrypted storage.</Text>
      </View>

      {/* Security Status */}
      <View style={[styles.section, { backgroundColor: theme.card }]}>
        <View style={styles.row}>
          <View style={styles.iconLabel}>
            <ShieldCheck size={20} color={theme.secondary} />
            <Text style={[styles.label, { color: theme.text }]}>Device Identity</Text>
          </View>
          <Text style={[styles.value, { color: theme.subtext }]} numberOfLines={1}>{deviceId}</Text>
        </View>
      </View>

      {/* Preferences */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferences</Text>
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

      {/* Chat History */}
      <View style={styles.historyHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>Previous Chats</Text>
        <History size={18} color={theme.subtext} />
      </View>

      {history.length > 0 ? (
        history.filter(h => h.role === 'user').slice(-5).map((item, idx) => (
          <TouchableOpacity 
            key={idx} 
            style={[styles.historyItem, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('ChatDetail')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.historyText, { color: theme.text }]} numberOfLines={1}>{item.content}</Text>
              <Text style={[styles.historyMeta, { color: theme.subtext }]}>{item.created_at}</Text>
            </View>
            <ChevronRight size={16} color={theme.border} />
          </TouchableOpacity>
        ))
      ) : (
        <View style={[styles.empty, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.subtext }}>No conversation history yet.</Text>
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity style={styles.dangerBtn}>
        <Trash2 size={18} color={theme.error} />
        <Text style={[styles.dangerText, { color: theme.error }]}>Wipe Local Cache</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { paddingHorizontal: 24, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },

  section: { marginHorizontal: 24, borderRadius: 20, padding: 16, marginBottom: 32, elevation: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 15, fontWeight: '600' },
  value: { fontSize: 12, maxWidth: 150 },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginHorizontal: 24, marginBottom: 16 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  
  historyItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1 },
  historyText: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  historyMeta: { fontSize: 11 },
  
  empty: { marginHorizontal: 24, padding: 32, borderRadius: 16, alignItems: 'center' },
  
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 40 },
  dangerText: { fontSize: 14, fontWeight: '700' },
});
