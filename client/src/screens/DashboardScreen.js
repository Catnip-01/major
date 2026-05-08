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
  total_spent: 24380,
  burn_projection: 35000,
  behavioral_summary: 'Your spending is focused on Food & Dining. You are on track to exceed last month.',
  smart_tips: [
    { title: 'Reduce your Swiggy orders', description: 'You spent ₹5k on Food. Try cooking at home more to save ₹2k.', impact: 'High' },
    { title: 'Subscription Check', description: 'I found 3 recurring charges. You might want to cancel the ones you don\'t use.', impact: 'Medium' },
  ],
  raw_data: {
    categories: [
      { category: 'Food', total: 8200 },
      { category: 'Transport', total: 4500 },
      { category: 'Shopping', total: 6800 },
    ]
  }
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
    } catch (e) {
      console.error(e);
      setOffline(true);
    }
    setLoading(false);
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '0';
    return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const data = report?.data || FALLBACK;
  const totalSpent = formatCurrency(data.total_spent);
  const burnProjection = formatCurrency(data.burn_projection);
  const dailyBurn = formatCurrency(data.daily_burn_rate || 0);
  const summary = data.behavioral_summary || data.summary; // fallback for old reports
  const tips = data.smart_tips || [];
  const zeroStreak = data.consistency?.zero_spend_days || 0;
  const microDrain = data.invisible_drain || { sum: 0, count: 0 };
  
  // Calculate real categories from raw_data if available
  const reportCats = data.raw_data?.categories || data.graph_data?.categories;
  const totalAmount = reportCats?.reduce((sum, c) => sum + (Number(c.total || c.value) || 0), 0) || 1;
  
  const cats = reportCats ? reportCats.slice(0, 3).map((c, i) => {
    const amt = Number(c.total || c.value) || 0;
    return {
      label: c.category || c.label || 'Other',
      amount: `₹${(amt / 1000).toFixed(1)}k`,
      pct: Math.round((amt / totalAmount) * 100),
      color: ['#FF6B35', '#3B82F6', '#8B5CF6'][i % 3]
    };
  }) : [];

  // Spending Velocity calculation
  const velocityPct = data.burn_projection > 0 ? Math.min(Math.round((data.total_spent / data.burn_projection) * 100), 100) : 0;
  const microPct = data.total_spent > 0 ? Math.min(Math.round((microDrain.sum / data.total_spent) * 100), 100) : 0;

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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {zeroStreak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: theme.primary + '15' }]}>
                <RotateCcw size={12} color={theme.primary} />
                <Text style={[styles.streakText, { color: theme.primary }]}>{zeroStreak}d Streak</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={load}
              style={[styles.refreshBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <RotateCcw size={16} color={theme.subtext} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main card */}
        <LinearGradient
          colors={theme.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Text style={styles.cardEyebrow}>MONTHLY SPEND</Text>
          <Text style={styles.cardAmount}>₹{totalSpent}</Text>
          <View style={styles.burnRow}>
            <Text style={styles.cardSub}>₹{dailyBurn}/day avg</Text>
            <Text style={styles.cardSub}>Projected: ₹{burnProjection}</Text>
          </View>

          {/* Velocity Progress */}
          <View style={styles.velocityContainer}>
             <View style={styles.velocityLabelRow}>
                <Text style={styles.velocityLabel}>Spending Velocity</Text>
                <Text style={styles.velocityPct}>{velocityPct}%</Text>
             </View>
             <View style={styles.velocityTrack}>
                <View style={[styles.velocityFill, { width: `${velocityPct}%` }]} />
             </View>
          </View>

          <View style={styles.cardRow}>
            <View style={styles.cardBadge}>
              <TrendingDown size={11} color="rgba(255,255,255,0.9)" />
              <Text style={styles.cardBadgeText}>Behavioral Audit</Text>
            </View>
            <TouchableOpacity
              style={styles.cardLink}
              onPress={() => navigation.navigate('Insights')}
            >
              <Text style={styles.cardLinkText}>Detailed Analysis</Text>
              <ArrowUpRight size={13} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Category bars */}
        <Text style={[styles.sectionHead, { color: theme.text }]}>Top Categories</Text>
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

        {/* Invisible Drain Section */}
        <View style={[styles.drainCard, { backgroundColor: theme.card }]}>
            <View style={styles.drainHeader}>
                <Text style={[styles.drainTitle, { color: theme.text }]}>Invisible Drain</Text>
                <Text style={[styles.drainSubtitle, { color: theme.subtext }]}>Spends under ₹100</Text>
            </View>
            <View style={styles.drainRow}>
                <View style={styles.drainTrack}>
                    <View style={[styles.drainFill, { width: `${microPct}%`, backgroundColor: theme.error }]} />
                </View>
                <Text style={[styles.drainAmt, { color: theme.text }]}>₹{formatCurrency(microDrain.sum)}</Text>
            </View>
            <Text style={styles.drainInfo}>You've made {microDrain.count} micro-transactions this month.</Text>
        </View>

        {/* AI summary strip */}
        <View style={[styles.summaryStrip, { backgroundColor: theme.primary + '12', borderLeftColor: theme.primary }]}>
          <Text style={[styles.summaryEye, { color: theme.primary }]}>FINIZE PULSE</Text>
          <Text style={[styles.summaryText, { color: theme.text }]}>{summary}</Text>
        </View>

        {/* Tips */}
        <Text style={[styles.sectionHead, { color: theme.text }]}>Smart Tips</Text>
        {tips.map((tip, i) => (
          <View key={i} style={[styles.tipItem, { backgroundColor: theme.card }]}>
            <View style={[styles.impactBadge, { backgroundColor: tip.impact === 'High' ? theme.error + '15' : theme.primary + '15' }]}>
               <Text style={[styles.impactText, { color: tip.impact === 'High' ? theme.error : theme.primary }]}>{tip.impact}</Text>
            </View>
            <View style={{ flex: 1 }}>
               <Text style={[styles.tipTitle, { color: theme.text }]}>{tip.title}</Text>
               <Text style={[styles.tipDesc, { color: theme.subtext }]}>{tip.description}</Text>
            </View>
          </View>
        ))}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('ChatDetail')}
        >
          <MessageSquare size={18} color="#fff" />
          <Text style={styles.ctaText}>Ask Finize anything</Text>
          <ArrowUpRight size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },

  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  offlineLabel: { fontSize: 10, fontWeight: '700' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  streakText: { fontSize: 12, fontWeight: '700' },
  refreshBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  card: { borderRadius: 24, padding: 20, marginBottom: 20 },
  cardEyebrow: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  cardAmount: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1.5, marginBottom: 4 },
  burnRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  cardSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  
  velocityContainer: { marginBottom: 16 },
  velocityLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  velocityLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' },
  velocityPct: { color: '#fff', fontSize: 11, fontWeight: '800' },
  velocityTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
  velocityFill: { height: 4, backgroundColor: '#fff', borderRadius: 2 },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cardBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  cardLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLinkText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '700' },

  sectionHead: { fontSize: 16, fontWeight: '800', marginBottom: 10, letterSpacing: -0.2 },

  barsCard: { borderRadius: 20, paddingHorizontal: 16, marginBottom: 16, elevation: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  barDot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { width: 60, fontSize: 12, fontWeight: '600' },
  barTrack: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barAmt: { fontSize: 11, fontWeight: '700', width: 40, textAlign: 'right' },

  drainCard: { padding: 16, borderRadius: 20, marginBottom: 20, elevation: 1 },
  drainHeader: { marginBottom: 10 },
  drainTitle: { fontSize: 14, fontWeight: '800' },
  drainSubtitle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  drainRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  drainTrack: { flex: 1, height: 4, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' },
  drainFill: { height: 4, borderRadius: 2 },
  drainAmt: { fontSize: 13, fontWeight: '900' },
  drainInfo: { fontSize: 10, color: '#999', fontWeight: '500' },

  summaryStrip: { borderLeftWidth: 3, borderRadius: 14, padding: 14, marginBottom: 20 },
  summaryEye: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  summaryText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },

  tipItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, marginBottom: 8, elevation: 1 },
  impactBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  impactText: { fontSize: 9, fontWeight: '800' },
  tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  tipDesc: { fontSize: 12, lineHeight: 17 },

  cta: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 18, marginTop: 12, elevation: 4 },
  ctaText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
});
