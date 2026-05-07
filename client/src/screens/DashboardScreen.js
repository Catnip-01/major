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
import { ArrowUpRight, MessageSquare, RotateCcw, WifiOff, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';

const FALLBACK = {
  total_spent: '24,380',
  tx_count: 38,
  summary: 'Food & Dining is your biggest category. Your subscriptions renew soon.',
  insights: [
    'Grocery spend is 18% lower than last month',
    'You have 3 active subscriptions due this week',
    'You\'re on pace to save ₹5,000 more this month',
  ],
  categories: [
    { label: 'Food', amount: '₹8.2k', pct: 34, color: '#FF6B35' },
    { label: 'Transport', amount: '₹4.5k', pct: 18, color: '#3B82F6' },
    { label: 'Shopping', amount: '₹6.8k', pct: 28, color: '#8B5CF6' },
    { label: 'Bills', amount: '₹2.9k', pct: 12, color: '#10B981' },
  ],
};

export const DashboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const id = await apiClient.getDeviceId();
      const data = await apiClient.fetchLatestReport(id);
      setReport(data || null);
      setOffline(!data);
    } catch {
      setOffline(true);
    }
    setLoading(false);
  };

  const rawTotal = report?.data?.total_spent;
  const totalSpent = rawTotal ? new Intl.NumberFormat('en-IN').format(rawTotal) : FALLBACK.total_spent;
  const txCount = report?.data?.tx_count || FALLBACK.tx_count;
  const summary = report?.data?.summary || FALLBACK.summary;
  const insights = report?.data?.insights || FALLBACK.insights;
  
  // Calculate real categories from report data if available
  const reportCats = report?.data?.graph_data?.categories;
  const totalAmount = reportCats?.reduce((sum, c) => sum + (c.total || 0), 0) || 1;
  
  const cats = reportCats ? reportCats.map((c, i) => ({
    label: c.category,
    amount: `₹${(c.total / 1000).toFixed(1)}k`,
    pct: Math.round((c.total / totalAmount) * 100),
    color: ['#FF6B35', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'][i % 5]
  })) : FALLBACK.categories;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={styles.topbar}>
          <View>
            <Text style={[styles.brand, { color: theme.text }]}>palfin</Text>
            {offline && (
              <View style={styles.offlineRow}>
                <WifiOff size={10} color={theme.error} />
                <Text style={[styles.offlineLabel, { color: theme.error }]}>cached data</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={load}
            style={[styles.refreshBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <RotateCcw size={16} color={theme.subtext} />
          </TouchableOpacity>
        </View>

        {/* Main card */}
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Text style={styles.cardEyebrow}>THIS MONTH</Text>
          <Text style={styles.cardAmount}>₹{totalSpent}</Text>
          <Text style={styles.cardSub}>{txCount} transactions recorded</Text>

          <View style={styles.cardRow}>
            <View style={styles.cardBadge}>
              <TrendingDown size={11} color="rgba(255,255,255,0.9)" />
              <Text style={styles.cardBadgeText}>8% vs last month</Text>
            </View>
            <TouchableOpacity
              style={styles.cardLink}
              onPress={() => navigation.navigate('Insights')}
            >
              <Text style={styles.cardLinkText}>Analytics</Text>
              <ArrowUpRight size={13} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Category bars */}
        <Text style={[styles.sectionHead, { color: theme.text }]}>Breakdown</Text>
        <View style={[styles.barsCard, { backgroundColor: theme.card }]}>
          {cats.map((cat, i) => (
            <View key={i} style={[styles.barRow, i < cats.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <View style={[styles.barDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.barLabel, { color: theme.text }]}>{cat.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${cat.pct}%`, backgroundColor: cat.color + 'DD' }]} />
              </View>
              <Text style={[styles.barAmt, { color: theme.subtext }]}>{cat.amount}</Text>
            </View>
          ))}
        </View>

        {/* AI summary strip */}
        <View style={[styles.summaryStrip, { backgroundColor: theme.primary + '12', borderLeftColor: theme.primary }]}>
          <Text style={[styles.summaryEye, { color: theme.primary }]}>AI INSIGHT</Text>
          <Text style={[styles.summaryText, { color: theme.text }]}>{summary}</Text>
        </View>

        {/* Tips */}
        <Text style={[styles.sectionHead, { color: theme.text }]}>Smart tips</Text>
        {insights.map((tip, i) => (
          <View key={i} style={[styles.tipItem, { backgroundColor: theme.card }]}>
            <Text style={[styles.tipNum, { color: theme.primary }]}>{i + 1}</Text>
            <Text style={[styles.tipText, { color: theme.text }]}>{tip}</Text>
          </View>
        ))}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('ChatDetail')}
        >
          <MessageSquare size={20} color="#fff" />
          <Text style={styles.ctaText}>Ask Finize anything</Text>
          <ArrowUpRight size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },

  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  offlineLabel: { fontSize: 10, fontWeight: '700' },
  refreshBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  card: { borderRadius: 24, padding: 22, marginBottom: 28 },
  cardEyebrow: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  cardAmount: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -1.5, marginBottom: 6 },
  cardSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 18 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cardBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  cardLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLinkText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' },

  sectionHead: { fontSize: 16, fontWeight: '800', marginBottom: 12, letterSpacing: -0.2 },

  barsCard: { borderRadius: 20, paddingHorizontal: 16, marginBottom: 20, elevation: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  barDot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { width: 60, fontSize: 13, fontWeight: '600' },
  barTrack: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barAmt: { fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right' },

  summaryStrip: { borderLeftWidth: 3, borderRadius: 14, padding: 16, marginBottom: 24 },
  summaryEye: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  summaryText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },

  tipItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14, borderRadius: 16, marginBottom: 8, elevation: 1 },
  tipNum: { fontSize: 14, fontWeight: '900', width: 16 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },

  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 20, marginTop: 16, elevation: 4 },
  ctaText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
});
