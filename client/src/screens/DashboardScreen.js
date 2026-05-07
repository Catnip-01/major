import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  MessageSquare,
  RefreshCw,
  ShoppingCart,
  Utensils,
  Car,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';

const PLACEHOLDER = {
  total_spent: '24,380.00',
  tx_count: 38,
  summary: 'You\'ve been spending wisely! Food & Dining is your biggest category this month.',
  insights: [
    'Your grocery spend is 18% below last month — great discipline!',
    'Consider reviewing your subscriptions; 3 are due this week.',
    'You\'re on track to save ₹5,000 more than last month.',
  ],
  graph_data: {
    categories: [
      { category: 'Food & Dining', total: 8200, icon: Utensils, color: '#F97316' },
      { category: 'Transport', total: 4500, icon: Car, color: '#3B82F6' },
      { category: 'Shopping', total: 6800, icon: ShoppingCart, color: '#8B5CF6' },
      { category: 'Utilities', total: 2900, icon: Zap, color: '#10B981' },
    ],
  },
};

export const DashboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const id = await apiClient.getDeviceId();
      const data = await apiClient.fetchLatestReport(id);
      if (data) {
        setReport(data);
        setOffline(false);
      } else {
        setOffline(true);
      }
    } catch (e) {
      setOffline(true);
    }
    setLoading(false);
  };

  // Merge live data with placeholder — placeholder acts as fallback for missing fields
  const display = {
    total_spent: report?.data?.total_spent || PLACEHOLDER.total_spent,
    tx_count: report?.data?.tx_count || PLACEHOLDER.tx_count,
    summary: report?.data?.summary || PLACEHOLDER.summary,
    insights: report?.data?.insights || PLACEHOLDER.insights,
    categories: report?.data?.graph_data?.categories || PLACEHOLDER.graph_data.categories,
  };

  const categories = PLACEHOLDER.graph_data.categories; // always show placeholder icons nicely

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={!!loading} onRefresh={load} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.subtext }]}>Welcome back 👋</Text>
            <Text style={[styles.title, { color: theme.text }]}>Palfin</Text>
          </View>
          <View style={styles.headerRight}>
            {offline && (
              <View style={[styles.offlineBadge, { backgroundColor: theme.error + '20' }]}>
                <WifiOff size={12} color={theme.error} />
                <Text style={[styles.offlineText, { color: theme.error }]}>Offline</Text>
              </View>
            )}
            <TouchableOpacity onPress={load} style={[styles.syncBtn, { backgroundColor: theme.card }]}>
              <RefreshCw size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Spend Card */}
        <LinearGradient colors={theme.gradient} style={styles.mainCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.cardTop}>
            <Text style={styles.cardLabel}>MONTHLY SPEND</Text>
            <View style={styles.trendBadge}>
              <TrendingDown size={11} color="#fff" />
              <Text style={styles.trendText}>−8%</Text>
            </View>
          </View>
          <Text style={styles.heroAmount}>₹ {display.total_spent}</Text>
          <Text style={styles.cardSub}>Across {display.tx_count} transactions</Text>
          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => navigation.navigate('Insights')}
            >
              <Text style={styles.detailText}>Full Analytics</Text>
              <ArrowUpRight size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Category Breakdown */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Spending Breakdown</Text>
        <View style={styles.catGrid}>
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            const liveTotal = display.categories.find?.(
              c => c.category === cat.category
            )?.total || cat.total;
            return (
              <View key={idx} style={[styles.catCard, { backgroundColor: theme.card }]}>
                <View style={[styles.catIcon, { backgroundColor: cat.color + '20' }]}>
                  <Icon size={20} color={cat.color} />
                </View>
                <Text style={[styles.catName, { color: theme.subtext }]} numberOfLines={1}>
                  {cat.category}
                </Text>
                <Text style={[styles.catAmount, { color: theme.text }]}>₹{(liveTotal / 1000).toFixed(1)}k</Text>
              </View>
            );
          })}
        </View>

        {/* AI Insight Card */}
        <View style={[styles.insightCard, { backgroundColor: theme.card, borderLeftColor: theme.primary }]}>
          <Text style={[styles.insightLabel, { color: theme.primary }]}>✦ AI Insight</Text>
          <Text style={[styles.insightText, { color: theme.text }]}>{display.summary}</Text>
        </View>

        {/* Quick Insights List */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Smart Tips</Text>
        {display.insights.map((insight, idx) => (
          <View key={idx} style={[styles.tipRow, { backgroundColor: theme.card }]}>
            <View style={[styles.tipDot, { backgroundColor: theme.secondary }]} />
            <Text style={[styles.tipText, { color: theme.text }]}>{insight}</Text>
          </View>
        ))}

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ChatDetail')}
          >
            <MessageSquare size={24} color="#fff" />
            <Text style={styles.actionLabel}>Ask Finize</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.secondary }]}
            onPress={() => navigation.navigate('Insights')}
          >
            <TrendingUp size={24} color="#fff" />
            <Text style={styles.actionLabel}>Analytics</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 60 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 13, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncBtn: { padding: 10, borderRadius: 12 },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  offlineText: { fontSize: 10, fontWeight: '700' },

  mainCard: { padding: 24, borderRadius: 28, marginBottom: 28, elevation: 12, shadowColor: '#0047AB', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  trendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
  trendText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  heroAmount: { color: '#fff', fontSize: 38, fontWeight: '900', marginVertical: 10, letterSpacing: -1 },
  cardSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  detailBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 4 },
  detailText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14, marginTop: 4 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  catCard: { width: '47%', padding: 16, borderRadius: 20, elevation: 2, alignItems: 'flex-start' },
  catIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  catName: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  catAmount: { fontSize: 18, fontWeight: '900' },

  insightCard: { padding: 18, borderRadius: 20, borderLeftWidth: 4, marginBottom: 24, elevation: 2 },
  insightLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  insightText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 16, marginBottom: 10, gap: 12, elevation: 1 },
  tipDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },

  actionGrid: { flexDirection: 'row', gap: 14, marginTop: 4 },
  actionBtn: { flex: 1, padding: 20, borderRadius: 24, alignItems: 'center', elevation: 4 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 10 },
});
