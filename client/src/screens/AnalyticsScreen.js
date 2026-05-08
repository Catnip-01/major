import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import { usePulse } from '../context/usePulse';
import { PieChart, BarChart, LineChart } from 'react-native-chart-kit';
import { PieChart as PieIcon, Info, Calendar, ShoppingBag, Zap, TrendingUp, Landmark, Clock, Activity } from 'lucide-react-native';

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
    color: (opacity = 1) => `rgba(${theme.primaryRGB || '59, 130, 246'}, ${opacity})`,
    labelColor: (opacity = 1) => theme.subtext,
    strokeWidth: 2,
    barPercentage: 0.6,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: theme.primary
    }
  };

  const data = report?.data;
  const rawData = data?.raw_data;

  // 1. 14-Day Trend Line Chart
  const trendData = {
    labels: rawData?.daily_trend?.slice(-7).map(d => d.day.split('-')[2]) || [],
    datasets: [{
      data: rawData?.daily_trend?.slice(-7).map(d => Number(d.total)) || [0]
    }]
  };

  // 2. Bank Share Donut
  const bankData = rawData?.bank_share?.map((b, i) => ({
    name: b.bank || 'Unknown',
    population: Number(b.total) || 0,
    color: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981'][i % 4],
    legendFontColor: theme.subtext,
    legendFontSize: 12
  })) || [];

  // 3. Time of Day Bar Chart
  const timeSlots = rawData?.time_slots || {};
  const timeData = {
    labels: ["Morning", "Afternoon", "Evening", "Night"],
    datasets: [{
      data: [
        timeSlots.Morning || 0,
        timeSlots.Afternoon || 0,
        timeSlots.Evening || 0,
        timeSlots.Night || 0
      ]
    }]
  };

  if (!report && !isGenerating) {
      return (
          <View style={[styles.centered, { backgroundColor: theme.background }]}>
              <Activity size="large" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.subtext }]}>Fetching your audit...</Text>
          </View>
      );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Financial Audit</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>Behavioral deep-dive by Finize AI.</Text>
        </View>
        <TouchableOpacity 
          style={[styles.genBtn, { backgroundColor: isGenerating ? theme.border : theme.primary }]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.genBtnText}>Refresh</Text>}
        </TouchableOpacity>
      </View>

      {/* 1. Daily Trend - Line Chart */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <TrendingUp size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>7-Day Spend Trend</Text>
        </View>
        {trendData.labels.length > 0 ? (
          <LineChart
            data={trendData}
            width={screenWidth - 48}
            height={180}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        ) : (
          <Text style={styles.emptyText}>No trend data yet.</Text>
        )}
      </View>

      {/* 2. Bank Share & Time of Day - Row */}
      <View style={styles.row}>
          <View style={[styles.halfCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                  <Landmark size={16} color={theme.primary} />
                  <Text style={[styles.cardTitleSmall, { color: theme.text }]}>Bank Share</Text>
              </View>
              <PieChart
                data={bankData}
                width={screenWidth / 2}
                height={120}
                chartConfig={chartConfig}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                center={[0, 0]}
                hasLegend={false}
              />
          </View>
          <View style={[styles.halfCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                  <Clock size={16} color={theme.primary} />
                  <Text style={[styles.cardTitleSmall, { color: theme.text }]}>Day Tempo</Text>
              </View>
              <BarChart
                data={timeData}
                width={screenWidth / 2 - 20}
                height={120}
                chartConfig={{...chartConfig, barPercentage: 0.4}}
                style={{ marginLeft: -20 }}
                withHorizontalLabels={false}
                fromZero
              />
          </View>
      </View>

      {/* 3. Consistency Score */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeader}>
              <Activity size={18} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Consistency Audit</Text>
          </View>
          <View style={styles.consistencyRow}>
              <View style={styles.consItem}>
                  <Text style={[styles.consValue, { color: theme.primary }]}>{data?.consistency?.zero_spend_days || 0}</Text>
                  <Text style={[styles.consLabel, { color: theme.subtext }]}>Zero Days</Text>
              </View>
              <View style={[styles.consDivider, { backgroundColor: theme.border }]} />
              <View style={styles.consItem}>
                  <Text style={[styles.consValue, { color: theme.error }]}>{data?.consistency?.high_spend_days || 0}</Text>
                  <Text style={[styles.consLabel, { color: theme.subtext }]}>High Days</Text>
              </View>
              <View style={[styles.consDivider, { backgroundColor: theme.border }]} />
              <View style={styles.consItem}>
                  <Text style={[styles.consValue, { color: theme.text }]}>₹{data?.consistency?.avg_daily || 0}</Text>
                  <Text style={[styles.consLabel, { color: theme.subtext }]}>Avg Daily</Text>
              </View>
          </View>
      </View>

      {/* 4. Heavy Hitters - Impact Cards */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Heavy Hitters</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.impactScroll}>
          {rawData?.heavy_hitters?.map((h, i) => (
              <View key={i} style={[styles.impactCard, { backgroundColor: theme.card }]}>
                  <Text style={[styles.impactMerchant, { color: theme.text }]} numberOfLines={1}>{h.merchant}</Text>
                  <Text style={[styles.impactAmount, { color: theme.primary }]}>₹{h.amount}</Text>
                  <Text style={[styles.impactDate, { color: theme.subtext }]}>{h.date.split('T')[0]}</Text>
                  <View style={styles.impactBar}>
                      <View style={[styles.impactFill, { width: `${Math.min((h.amount / (data?.total_spent || 1)) * 100 * 5, 100)}%`, backgroundColor: theme.primary }]} />
                  </View>
                  <Text style={styles.impactPct}>{Math.round((h.amount / (data?.total_spent || 1)) * 100)}% of total</Text>
              </View>
          ))}
      </ScrollView>

      {/* 5. AI Strategic Summary */}
      <View style={[styles.card, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: theme.primary }]}>
        <View style={styles.cardHeader}>
          <Zap size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Strategic Tip</Text>
        </View>
        <Text style={[styles.summaryText, { color: theme.text }]}>
          {data?.behavioral_summary || "Analyzing your patterns..."}
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '600' },
  header: { paddingHorizontal: 24, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },

  genBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  genBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  card: { marginHorizontal: 24, padding: 20, borderRadius: 24, marginBottom: 16, elevation: 1 },
  halfCard: { width: screenWidth / 2 - 32, marginLeft: 24, padding: 16, borderRadius: 24, marginBottom: 16, elevation: 1 },
  row: { flexDirection: 'row', marginBottom: 16 },
  
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardTitleSmall: { fontSize: 12, fontWeight: '800' },
  chart: { marginVertical: 8, borderRadius: 16, marginLeft: -16 },
  
  consistencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  consItem: { flex: 1, alignItems: 'center' },
  consValue: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  consLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  consDivider: { width: 1, height: 30 },

  impactScroll: { paddingLeft: 24, marginBottom: 24 },
  impactCard: { width: 140, padding: 16, borderRadius: 20, marginRight: 12, elevation: 1 },
  impactMerchant: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  impactAmount: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  impactDate: { fontSize: 10, marginBottom: 12 },
  impactBar: { height: 4, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, marginBottom: 6 },
  impactFill: { height: 4, borderRadius: 2 },
  impactPct: { fontSize: 9, fontWeight: '600', color: '#999' },

  summaryText: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginHorizontal: 24, marginBottom: 16, letterSpacing: -0.3 },
  emptyText: { textAlign: 'center', marginVertical: 20, color: '#999' },
});
