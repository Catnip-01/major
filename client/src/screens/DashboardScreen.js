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
import { ArrowUpRight, MessageSquare, RotateCcw, WifiOff, TrendingDown, Activity } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';

const FALLBACK = {
  total_spent: 0,
  burn_projection: 0,
  behavioral_summary: 'Welcome to Palfin. Sync your transactions to see insights.',
  smart_tips: [],
  raw_data: { categories: [] }
};

const MetricTile = ({ label, value, subValue, icon: Icon, color, theme }) => (
  <View style={[styles.tile, { backgroundColor: theme.card }]}>
    <View style={styles.tileHeader}>
      {Icon && <Icon size={14} color={color || theme.primary} />}
      <Text style={[styles.tileLabel, { color: theme.subtext }]}>{label}</Text>
    </View>
    <Text style={[styles.tileValue, { color: theme.text }]}>{value}</Text>
    {subValue && <Text style={[styles.tileSub, { color: color || theme.subtext }]}>{subValue}</Text>}
  </View>
);

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
      const report = await apiClient.fetchLatestReport(id);
      setReport(report || null);
      setOffline(!report);
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

  const data = report?.data || {};
  const analytics = report?.analytics || {};
  
  const totalSpent = formatCurrency(data.total_spent || 0);
  const burnProjection = formatCurrency(data.burn_projection || 0);
  const dailyBurn = formatCurrency(data.daily_burn_rate || 0);
  const summary = data.behavioral_summary || data.summary || 'Welcome to Palfin.';
  const tips = data.smart_tips || [];
  const zeroStreak = data.consistency?.zero_spend_days || 0;
  
  // Health & Behavioral Data
  const healthScore = data.leaky_bucket_score || 0;
  const savingsRate = Math.round(data.savings_rate || 0);
  const loyalty = data.top_loyalty || 'N/A';
  
  // Retention Bar (Inflow vs Outflow)
  const credits = Number(data.raw_data?.savings?.credits) || 0;
  const debits = Number(data.raw_data?.savings?.debits) || 1;
  const retentionPct = Math.min(Math.max(Math.round(((credits - debits) / Math.max(credits, 1)) * 100), 0), 100);

  // Categories
  const reportCats = data.raw_data?.categories || data.graph_data?.categories || [];
  const totalAmount = reportCats?.reduce((sum, c) => sum + (Number(c.total || c.value) || 0), 0) || 1;
  const cats = reportCats.slice(0, 3).map((c, i) => {
    const amt = Number(c.total || c.value) || 0;
    return {
      label: c.category || c.label || 'Other',
      amount: `₹${(amt / 1000).toFixed(1)}k`,
      pct: Math.round((amt / totalAmount) * 100),
      color: ['#FF6B35', '#3B82F6', '#8B5CF6'][i % 3]
    };
  });

  // Spending Velocity
  const safeSpent = Number(data.total_spent) || 0;
  const safeProj = Number(data.burn_projection) || 1;
  const velocityPct = Math.min(Math.round((safeSpent / safeProj) * 100), 100) || 0;
  
  const microDrain = analytics.consistency || { total: 0, count: 0 };
  const microPct = safeSpent > 0 ? Math.min(Math.round((microDrain.total / safeSpent) * 100), 100) : 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.primary} />}
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
            <TouchableOpacity onPress={load} style={[styles.refreshBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <RotateCcw size={16} color={theme.subtext} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Financial Pulse Row */}
        <View style={styles.tileRow}>
           <MetricTile 
              label="Health Score" 
              value={`${healthScore}/10`} 
              subValue={healthScore > 7 ? "Excellent" : "Needs Review"}
              color={healthScore > 7 ? '#10B981' : theme.error}
              icon={Activity}
              theme={theme}
           />
           <MetricTile 
              label="Savings Rate" 
              value={`${savingsRate}%`} 
              subValue="of income"
              color={savingsRate > 20 ? '#10B981' : theme.primary}
              icon={TrendingDown}
              theme={theme}
           />
           <MetricTile 
              label="Loyalty" 
              value={loyalty.split(' ')[0]} 
              subValue="Top Merchant"
              icon={RotateCcw}
              theme={theme}
           />
        </View>

        {/* Wallet Retention Bar */}
        <View style={[styles.retentionCard, { backgroundColor: theme.card }]}>
            <View style={styles.retentionHeader}>
                <Text style={[styles.retentionTitle, { color: theme.text }]}>Wallet Retention</Text>
                <Text style={[styles.retentionPct, { color: theme.primary }]}>{retentionPct}% Saved</Text>
            </View>
            <View style={styles.retentionTrack}>
                <View style={[styles.retentionFill, { width: `${retentionPct}%`, backgroundColor: theme.primary }]} />
            </View>
            <View style={styles.retentionLabels}>
                <Text style={styles.retentionSub}>₹{formatCurrency(credits)} Inflow</Text>
                <Text style={styles.retentionSub}>₹{formatCurrency(debits)} Outflow</Text>
            </View>
        </View>

        {/* Main card */}
        <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <Text style={styles.cardEyebrow}>MONTHLY SPEND</Text>
          <Text style={styles.cardAmount}>₹{totalSpent}</Text>
          <View style={styles.burnRow}>
            <Text style={styles.cardSub}>₹{dailyBurn}/day avg</Text>
            <Text style={styles.cardSub}>Projected: ₹{burnProjection}</Text>
          </View>

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
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('Insights')}>
              <Text style={styles.cardLinkText}>Detailed Analysis</Text>
              <ArrowUpRight size={13} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Categories and Drain Row */}
        <View style={styles.halfRow}>
            <View style={[styles.miniCard, { backgroundColor: theme.card, flex: 1.2 }]}>
                <Text style={[styles.miniHead, { color: theme.text }]}>Top Categories</Text>
                {cats.map((cat, i) => (
                    <View key={i} style={styles.miniBarRow}>
                        <View style={[styles.miniDot, { backgroundColor: cat.color }]} />
                        <Text style={[styles.miniLabel, { color: theme.subtext }]} numberOfLines={1}>{cat.label}</Text>
                        <Text style={[styles.miniAmt, { color: theme.text }]}>{cat.amount}</Text>
                    </View>
                ))}
            </View>
            <View style={[styles.miniCard, { backgroundColor: theme.card, flex: 0.8 }]}>
                <Text style={[styles.miniHead, { color: theme.text }]}>Invisible Drain</Text>
                <Text style={[styles.drainBig, { color: theme.error }]}>₹{formatCurrency(microDrain.total || 0)}</Text>
                <Text style={styles.drainSmall}>{microDrain.count || 0} micro-txs</Text>
                <View style={styles.miniTrack}>
                    <View style={[styles.miniFill, { width: `${microPct}%`, backgroundColor: theme.error }]} />
                </View>
            </View>
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

        <TouchableOpacity style={[styles.cta, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('ChatDetail', { sessionId: 'default' })}>
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
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  offlineLabel: { fontSize: 10, fontWeight: '700' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  streakText: { fontSize: 12, fontWeight: '700' },
  refreshBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  tileRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tile: { flex: 1, padding: 12, borderRadius: 18, elevation: 1 },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  tileLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  tileValue: { fontSize: 16, fontWeight: '900' },
  tileSub: { fontSize: 9, fontWeight: '700', marginTop: 1 },

  retentionCard: { padding: 16, borderRadius: 20, marginBottom: 16, elevation: 1 },
  retentionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  retentionTitle: { fontSize: 13, fontWeight: '800' },
  retentionPct: { fontSize: 13, fontWeight: '900' },
  retentionTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' },
  retentionFill: { height: 6, borderRadius: 3 },
  retentionLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  retentionSub: { fontSize: 10, color: '#999', fontWeight: '600' },

  card: { borderRadius: 24, padding: 20, marginBottom: 16 },
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

  halfRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  miniCard: { padding: 14, borderRadius: 20, elevation: 1 },
  miniHead: { fontSize: 11, fontWeight: '800', marginBottom: 10 },
  miniBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  miniLabel: { flex: 1, fontSize: 10, fontWeight: '600' },
  miniAmt: { fontSize: 10, fontWeight: '800' },
  drainBig: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  drainSmall: { fontSize: 9, color: '#999', fontWeight: '600', marginBottom: 8 },
  miniTrack: { height: 3, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1.5 },
  miniFill: { height: 3, borderRadius: 1.5 },

  sectionHead: { fontSize: 16, fontWeight: '800', marginBottom: 10, letterSpacing: -0.2 },
  summaryStrip: { borderLeftWidth: 3, borderRadius: 14, padding: 14, marginBottom: 20 },
  summaryEye: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  summaryText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  tipItem: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, marginBottom: 8, elevation: 1 },
  impactBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  impactText: { fontSize: 8, fontWeight: '800' },
  tipTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  tipDesc: { fontSize: 12, lineHeight: 17 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 18, marginTop: 12, elevation: 4 },
  ctaText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
});
