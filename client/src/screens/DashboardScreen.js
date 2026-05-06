import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import { PulseBar } from '../components/PulseBar';
import { 
  TrendingUp, 
  ArrowUpRight, 
  MessageSquare, 
  RefreshCw 
} from 'lucide-react-native';

export const DashboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [deviceId, setDeviceId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const id = await apiClient.getDeviceId();
    setDeviceId(id);
    const data = await apiClient.fetchLatestReport(id);
    setReport(data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setLoading(true);
    await init();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <PulseBar deviceId={deviceId} />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.subtext }]}>Welcome back,</Text>
            <Text style={[styles.title, { color: theme.text }]}>Palfin Dashboard</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={[styles.syncBtn, { backgroundColor: theme.card }]}>
            <RefreshCw size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Total Spend Card */}
        <LinearGradient colors={theme.gradient} style={styles.mainCard}>
          <View style={styles.cardTop}>
            <Text style={styles.cardLabel}>TOTAL SPENT THIS MONTH</Text>
            <View style={styles.trendBadge}>
              <TrendingUp size={12} color="#fff" />
              <Text style={styles.trendText}>+12%</Text>
            </View>
          </View>
          <Text style={styles.amount}>₹ {report?.data?.total_spent || '0.00'}</Text>
          <View style={styles.cardBottom}>
            <Text style={styles.cardSub}>Across {report?.data?.tx_count || 0} transactions</Text>
            <TouchableOpacity style={styles.detailBtn}>
              <Text style={styles.detailText}>Analysis</Text>
              <ArrowUpRight size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* AI Insight Snippet */}
        <View style={[styles.insightCard, { backgroundColor: theme.card }]}>
          <View style={[styles.insightIcon, { backgroundColor: theme.primary + '10' }]}>
            <MessageSquare size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.insightTitle, { color: theme.text }]}>Today's Insight</Text>
            <Text style={[styles.insightText, { color: theme.subtext }]} numberOfLines={2}>
              {report?.data?.summary || "No insights ready yet. I'll analyze your spending overnight!"}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ChatDetail')}
          >
            <MessageSquare size={24} color="#fff" />
            <Text style={styles.actionLabel}>Chat with Finize</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.secondary }]}
            onPress={() => navigation.navigate('Insights')}
          >
            <TrendingUp size={24} color="#fff" />
            <Text style={styles.actionLabel}>View Analytics</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 14, fontWeight: '500' },
  title: { fontSize: 24, fontWeight: '800' },
  syncBtn: { padding: 10, borderRadius: 12, elevation: 2 },
  
  mainCard: { padding: 24, borderRadius: 32, marginBottom: 24, elevation: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  trendText: { color: '#fff', fontSize: 10, fontWeight: '700', marginLeft: 4 },
  amount: { color: '#fff', fontSize: 36, fontWeight: '800', marginBottom: 16 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  detailBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  detailText: { color: '#fff', fontSize: 12, fontWeight: '700', marginRight: 4 },

  insightCard: { padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 32, elevation: 2 },
  insightIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  insightTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  insightText: { fontSize: 13, lineHeight: 18 },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  actionGrid: { flexDirection: 'row', gap: 16 },
  actionBtn: { flex: 1, padding: 20, borderRadius: 24, alignItems: 'center', elevation: 4 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 12 },
});
