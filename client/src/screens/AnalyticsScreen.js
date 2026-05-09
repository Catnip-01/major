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
    const data = await apiClient.fetchAnalytics(dId);
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

  // 1. 14-Day Trend Line Chart
  const dailyTrend = report?.analytics?.daily_trend || [];
  const trendPoints = dailyTrend.length > 0 
    ? dailyTrend.slice(-7).map(d => {
        const val = Number(d?.total);
        return isNaN(val) ? 0 : val;
      }) 
    : [0, 0, 0, 0, 0, 0, 0]; // Placeholder line
  const trendLabels = dailyTrend.length > 0
    ? dailyTrend.slice(-7).map(d => (d?.day && typeof d.day === 'string' && d.day.includes('-')) ? d.day.split('-')[2] : '..')
    : ["-", "-", "-", "-", "-", "-", "-"];
  const trendData = { labels: trendLabels, datasets: [{ data: trendPoints }] };

  // 2. Bank Share Donut
  const bankShare = report?.analytics?.bank_share || [];
  const bankData = bankShare.length > 0 
    ? bankShare.map((b, i) => {
        const pop = Number(b?.total);
        return {
          name: String(b?.bank || 'Unknown'),
          population: isNaN(pop) ? 0 : pop,
          color: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981'][i % 4],
          legendFontColor: theme.subtext,
          legendFontSize: 12
        };
      }).filter(b => b.population >= 0)
    : [{ name: 'No Data', population: 1, color: theme.border, legendFontColor: theme.subtext, legendFontSize: 12 }];

  // 3. Time of Day Bar Chart
  const timeSlots = report?.analytics?.time_slots || {};
  const hasTimeData = Object.values(timeSlots).some(v => v > 0);
  const timeData = {
    labels: ["Morn", "Aft", "Eve", "Nit"],
    datasets: [{
      data: hasTimeData 
        ? [
            Number(timeSlots.Morning || 0) || 0,
            Number(timeSlots.Afternoon || 0) || 0,
            Number(timeSlots.Evening || 0) || 0,
            Number(timeSlots.Night || 0) || 0
          ]
        : [1, 1, 1, 1] // Placeholder bars
    }]
  };

  // Heavy Hitters
  const heavyHitters = report?.raw_data?.heavy_hitters || [];
  const consistency = report?.consistency || [];
  const totalSpent = report?.data?.total_spent || 1;

  if (!report && !isGenerating) {
      return (
          <View style={[styles.centered, { backgroundColor: theme.background }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <TouchableOpacity 
                onPress={handleGenerate} 
                style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: theme.primary, borderRadius: 16 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Generate First Audit</Text>
              </TouchableOpacity>
          </View>
      );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
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
        {report?.daily_trend?.length > 0 ? (
          <LineChart
            data={trendData}
            width={screenWidth - 48}
            height={180}
            chartConfig={chartConfig}
            bezier={trendPoints.length > 2}
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        ) : (
          <View style={{ height: 180, justifyContent: 'center', alignItems: 'center' }}>
             <Activity size="small" color={theme.border} />
             <Text style={[styles.emptyText, { marginTop: 8 }]}>Awaiting more data...</Text>
          </View>
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
                width={screenWidth / 2 - 20}
                height={120}
                chartConfig={chartConfig}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
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
                  <Text style={[styles.consValue, { color: theme.primary }]}>{report?.consistency?.zero_spend_days || 0}</Text>
                  <Text style={[styles.consLabel, { color: theme.subtext }]}>Zero Days</Text>
              </View>
              <View style={[styles.consDivider, { backgroundColor: theme.border }]} />
              <View style={styles.consItem}>
                  <Text style={[styles.consValue, { color: theme.error }]}>{report?.consistency?.high_spend_days || 0}</Text>
                  <Text style={[styles.consLabel, { color: theme.subtext }]}>High Days</Text>
              </View>
              <View style={[styles.consDivider, { backgroundColor: theme.border }]} />
              <View style={styles.consItem}>
                  <Text style={[styles.consValue, { color: theme.text }]}>₹{report?.consistency?.avg_daily || 0}</Text>
                  <Text style={[styles.consLabel, { color: theme.subtext }]}>Avg Daily</Text>
              </View>
          </View>
      </View>

      {/* 4. Heavy Hitters - Impact Cards */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Heavy Hitters</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.impactScroll}>
          {report?.raw_data?.heavy_hitters?.map((h, i) => (
              <View key={i} style={[styles.impactCard, { backgroundColor: theme.card }]}>
                  <Text style={[styles.impactMerchant, { color: theme.text }]} numberOfLines={1}>{h.merchant}</Text>
                  <Text style={[styles.impactAmount, { color: theme.primary }]}>₹{h.amount}</Text>
                  <Text style={[styles.impactDate, { color: theme.subtext }]}>{h.date?.split('T')[0] || 'N/A'}</Text>
                  <View style={styles.impactBar}>
                      <View style={[styles.impactFill, { width: `${Math.min((h.amount / (report?.total_spent || 1)) * 100 * 5, 100)}%`, backgroundColor: theme.primary }]} />
                  </View>
                  <Text style={styles.impactPct}>{Math.round((h.amount / (report?.total_spent || 1)) * 100)}% of total</Text>
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
          {report?.behavioral_summary || "Analyzing your patterns..."}
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
  header: { paddingHorizontal: 24, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 1 },

  genBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, minWidth: 70, alignItems: 'center', justifyContent: 'center' },
  genBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  card: { marginHorizontal: 20, padding: 16, borderRadius: 20, marginBottom: 12, elevation: 1 },
  halfCard: { width: screenWidth / 2 - 28, marginLeft: 20, padding: 14, borderRadius: 20, marginBottom: 12, elevation: 1 },
  row: { flexDirection: 'row', marginBottom: 12 },
  
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardTitleSmall: { fontSize: 11, fontWeight: '800' },
  chart: { marginVertical: 6, borderRadius: 16, marginLeft: -16 },
  
  consistencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  consItem: { flex: 1, alignItems: 'center' },
  consValue: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  consLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  consDivider: { width: 1, height: 25 },

  impactScroll: { paddingLeft: 20, marginBottom: 20 },
  impactCard: { width: 130, padding: 14, borderRadius: 18, marginRight: 10, elevation: 1 },
  impactMerchant: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  impactAmount: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  impactDate: { fontSize: 9, marginBottom: 10 },
  impactBar: { height: 3, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, marginBottom: 4 },
  impactFill: { height: 3, borderRadius: 2 },
  impactPct: { fontSize: 8, fontWeight: '600', color: '#999' },

  summaryText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginHorizontal: 20, marginBottom: 12, letterSpacing: -0.3 },
  emptyText: { textAlign: 'center', marginVertical: 16, color: '#999', fontSize: 12 },
});
