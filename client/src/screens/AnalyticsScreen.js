import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import { usePulse } from '../context/usePulse';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { PieChart as PieIcon, Info, Calendar, ShoppingBag, Zap } from 'lucide-react-native';

const screenWidth = Dimensions.get("window").width;

export const AnalyticsScreen = () => {
  const { theme } = useTheme();
  const [report, setReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    apiClient.getDeviceId().then(id => {
      setDeviceId(id);
      load(id);
    });
  }, []);

  const load = async (id) => {
    const dId = id || deviceId;
    if (!dId) return;
    const data = await apiClient.fetchLatestReport(dId);
    setReport(data);
  };

  usePulse(deviceId, (event) => {
    if (event.event === 'report_complete') {
      load();
      setIsGenerating(false);
    }
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await apiClient.triggerReportGeneration(deviceId);
    } catch (e) {
      console.error(e);
      setIsGenerating(false);
    }
  };

  const chartConfig = {
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    color: (opacity = 1) => theme.primary,
    labelColor: (opacity = 1) => theme.subtext,
    strokeWidth: 2,
    barPercentage: 0.6,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
  };

  const data = report?.data;
  const rawData = data?.raw_data;

  // 1. Category Data for Pie Chart
  const catData = rawData?.categories?.map((c, i) => ({
    name: c.category || 'Other',
    population: Number(c.total) || 0,
    color: ['#FF6B35', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'][i % 5] || theme.primary,
    legendFontColor: theme.subtext,
    legendFontSize: 12
  })).filter(c => c.population > 0) || [];

  // 2. Day of Week Data for Bar Chart
  const dowData = {
    labels: rawData?.dow?.map(d => d.day) || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{
      data: rawData?.dow?.map(d => Number(d.total) / 1000) || [0, 0, 0, 0, 0, 0, 0]
    }]
  };

  // 3. Needs vs Wants Split
  const needsWants = data?.needs_wants_split || { needs: 50, wants: 50 };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Analytics</Text>
            <Text style={[styles.subtitle, { color: theme.subtext }]}>Behavioral deep-dive by Finize AI.</Text>
          </View>
          <TouchableOpacity 
            style={[styles.genBtn, { backgroundColor: isGenerating ? theme.border : theme.primary }]}
            onPress={handleGenerate}
            disabled={isGenerating}
          >
            <Text style={styles.genBtnText}>{isGenerating ? '...' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Info size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Spending Personality</Text>
        </View>
        <Text style={[styles.summaryText, { color: theme.text }]}>
          {data?.behavioral_summary || "Analyzing your patterns... Check back after a few more transactions."}
        </Text>
        
        {/* Needs vs Wants Bar */}
        <View style={styles.nwContainer}>
           <View style={styles.nwLabelRow}>
              <Text style={[styles.nwLabel, { color: theme.subtext }]}>Needs ({needsWants.needs}%)</Text>
              <Text style={[styles.nwLabel, { color: theme.subtext }]}>Wants ({needsWants.wants}%)</Text>
           </View>
           <View style={styles.nwTrack}>
              <View style={[styles.nwFillNeeds, { width: `${needsWants.needs}%`, backgroundColor: theme.primary }]} />
              <View style={[styles.nwFillWants, { width: `${needsWants.wants}%`, backgroundColor: theme.secondary }]} />
           </View>
        </View>
      </View>

      {/* Day of Week Breakdown */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Calendar size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Daily Spend (₹k)</Text>
        </View>
        {rawData?.dow ? (
          <BarChart
            data={dowData}
            width={screenWidth - 80}
            height={200}
            chartConfig={chartConfig}
            verticalLabelRotation={0}
            fromZero={true}
            style={{ marginLeft: -10 }}
          />
        ) : (
          <Text style={[styles.emptyText, { color: theme.subtext }]}>Sync more SMS to see daily patterns.</Text>
        )}
      </View>

      {/* Merchant Loyalty */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <ShoppingBag size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Top Merchants</Text>
        </View>
        {rawData?.merchants?.map((m, i) => (
          <View key={i} style={[styles.merchantRow, i < rawData.merchants.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
             <View style={{ flex: 1 }}>
                <Text style={[styles.merchantName, { color: theme.text }]}>{m.merchant}</Text>
                <Text style={[styles.merchantCount, { color: theme.subtext }]}>{m.count} visits this month</Text>
             </View>
             <Text style={[styles.merchantTotal, { color: theme.text }]}>₹{Math.round(m.total)}</Text>
          </View>
        )) || (
          <Text style={[styles.emptyText, { color: theme.subtext }]}>No merchant data yet.</Text>
        )}
      </View>

      {/* Category Pie */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <PieIcon size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Category Share</Text>
        </View>
        {catData.length > 0 ? (
          <PieChart
            data={catData}
            width={screenWidth - 80}
            height={200}
            chartConfig={chartConfig}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            absolute={true}
          />
        ) : (
          <Text style={[styles.emptyText, { color: theme.subtext }]}>Not enough data for charts yet.</Text>
        )}
      </View>

      {/* Deep Insights Cards */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Finize Strategic Tips</Text>
      {data?.smart_tips?.map((tip, idx) => (
        <View key={idx} style={[styles.tipCard, { backgroundColor: theme.card }]}>
          <View style={styles.tipHeader}>
            <Zap size={16} color={theme.primary} />
            <Text style={[styles.tipImpact, { color: theme.primary }]}>{tip.impact} IMPACT</Text>
          </View>
          <Text style={[styles.tipTitle, { color: theme.text }]}>{tip.title}</Text>
          <Text style={[styles.tipDesc, { color: theme.subtext }]}>{tip.description}</Text>
        </View>
      )) || (
        <Text style={[styles.emptyText, { color: theme.subtext, marginLeft: 24 }]}>No deep insights yet.</Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { paddingHorizontal: 24, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },

  genBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  genBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  card: { marginHorizontal: 24, padding: 20, borderRadius: 24, marginBottom: 20, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  summaryText: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  
  nwContainer: { marginTop: 10 },
  nwLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  nwLabel: { fontSize: 11, fontWeight: '600' },
  nwTrack: { height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden' },
  nwFillNeeds: { height: 8 },
  nwFillWants: { height: 8 },

  merchantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  merchantName: { fontSize: 14, fontWeight: '700' },
  merchantCount: { fontSize: 11, marginTop: 2 },
  merchantTotal: { fontSize: 14, fontWeight: '800' },

  emptyText: { textAlign: 'center', marginVertical: 40, fontSize: 13 },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginHorizontal: 24, marginBottom: 16, marginTop: 10 },
  
  tipCard: { marginHorizontal: 24, padding: 18, borderRadius: 20, marginBottom: 12, elevation: 1 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  tipImpact: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  tipTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  tipDesc: { fontSize: 13, lineHeight: 19 },
});
