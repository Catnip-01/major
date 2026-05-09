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
import { Zap, TrendingUp } from 'lucide-react-native';

const screenWidth = Dimensions.get("window").width;

const ChartWrapper = ({ title, subtitle, children, theme }) => (
  <View style={[styles.card, { backgroundColor: theme.card }]}>
    <View style={styles.cardHeader}>
      <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.cardSubtitle, { color: theme.subtext }]}>{subtitle}</Text>}
    </View>
    {children}
  </View>
);

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
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: { r: "4", strokeWidth: "2", stroke: theme.primary }
  };

  // 1. 7-Day Trend
  const dailyTrend = report?.analytics?.daily_trend || [];
  const trendPoints = dailyTrend.length > 0 
    ? dailyTrend.slice(-7).map(d => Number(d?.total) || 0) 
    : [0, 0, 0, 0, 0, 0, 0];
  const trendLabels = dailyTrend.length > 0
    ? dailyTrend.slice(-7).map(d => (d?.day?.split('-')[2] || '..'))
    : ["-", "-", "-", "-", "-", "-", "-"];
  const trendData = { labels: trendLabels, datasets: [{ data: trendPoints }] };

  // 2. Needs vs Wants (Flattened Access)
  const split = report?.needs_wants_split || { needs: 50, wants: 50 };
  const splitData = [
    { name: 'Needs', population: split.needs, color: theme.primary, legendFontColor: theme.subtext, legendFontSize: 12 },
    { name: 'Wants', population: split.wants, color: '#EC4899', legendFontColor: theme.subtext, legendFontSize: 12 }
  ];

  // 3. Day of Week Distribution (Flattened Access)
  const dow = report?.raw_data?.dow || [];
  const dowData = {
    labels: ["S", "M", "T", "W", "T", "F", "S"],
    datasets: [{
      data: [0, 1, 2, 3, 4, 5, 6].map(i => {
        const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
        return Number(dow.find(d => d.day === day)?.total) || 0;
      })
    }]
  };

  // 4. Time of Day
  const timeSlots = report?.analytics?.time_slots || {};
  const timeData = {
    labels: ["Morn", "Aft", "Eve", "Nit"],
    datasets: [{
      data: [
        Number(timeSlots.Morning || 0) || 0,
        Number(timeSlots.Afternoon || 0) || 0,
        Number(timeSlots.Evening || 0) || 0,
        Number(timeSlots.Night || 0) || 0
      ]
    }]
  };

  const consistency = report?.consistency?.[0] || report?.analytics?.consistency?.[0] || {};
  const heavyHitters = report?.analytics?.heavy_hitters || [];
  const totalSpent = Number(report?.analytics?.total_spent) || 1;

  if (!report && !isGenerating) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <TouchableOpacity onPress={handleGenerate} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>Generate First Audit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Behavioral Audit</Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>Deep-dive into your spending psychology.</Text>
        </View>
        <TouchableOpacity 
          style={[styles.genBtn, { backgroundColor: isGenerating ? theme.border : theme.primary }]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.genBtnText}>Refresh</Text>}
        </TouchableOpacity>
      </View>

      {/* Hero: Needs vs Wants & Loyalty */}
      <View style={styles.row}>
        <View style={[styles.halfCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitleSmall, { color: theme.text }]}>Needs vs Wants</Text>
          <PieChart
            data={splitData}
            width={screenWidth / 2 - 20}
            height={100}
            chartConfig={chartConfig}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            hasLegend={false}
          />
          <View style={styles.miniLegend}>
             <View style={styles.legendDotSmall}><View style={[styles.dot, {backgroundColor: theme.primary}]} /><Text style={styles.dotText}>{split.needs}% Needs</Text></View>
             <View style={styles.legendDotSmall}><View style={[styles.dot, {backgroundColor: '#EC4899'}]} /><Text style={styles.dotText}>{split.wants}% Wants</Text></View>
          </View>
        </View>
        <View style={[styles.halfCard, { backgroundColor: theme.card, justifyContent: 'center' }]}>
           <Zap size={20} color={theme.primary} style={{marginBottom: 8}} />
           <Text style={[styles.cardTitleSmall, { color: theme.text }]}>Top Loyalty</Text>
           <Text style={[styles.loyaltyValue, { color: theme.primary }]}>{report?.top_loyalty || 'N/A'}</Text>
           <Text style={[styles.loyaltySub, { color: theme.subtext }]}>Most frequent merchant</Text>
        </View>
      </View>

      <ChartWrapper title="7-Day Trend" subtitle="Recent spending velocity" theme={theme}>
        <LineChart
          data={trendData}
          width={screenWidth - 48}
          height={160}
          chartConfig={chartConfig}
          bezier={trendPoints.length > 2}
          style={styles.chart}
          withInnerLines={false}
        />
      </ChartWrapper>

      <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 16 }]}>Consistency Matrix</Text>
          <View style={styles.matrix}>
              <View style={styles.matrixItem}>
                  <Text style={[styles.matrixVal, { color: theme.primary }]}>{consistency.zero_spend_days || 0}</Text>
                  <Text style={styles.matrixLabel}>Zero Days</Text>
              </View>
              <View style={styles.matrixItem}>
                  <Text style={[styles.matrixVal, { color: '#3B82F6' }]}>{consistency.low_spend_days || 0}</Text>
                  <Text style={styles.matrixLabel}>Low Days</Text>
              </View>
              <View style={styles.matrixItem}>
                  <Text style={[styles.matrixVal, { color: theme.error }]}>{consistency.high_spend_days || 0}</Text>
                  <Text style={styles.matrixLabel}>High Days</Text>
              </View>
              <View style={styles.matrixItem}>
                  <Text style={[styles.matrixVal, { color: theme.text }]}>₹{Math.round(consistency.avg_daily || 0)}</Text>
                  <Text style={styles.matrixLabel}>Daily Avg</Text>
              </View>
          </View>
      </View>

      <View style={styles.row}>
         <View style={[styles.halfCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitleSmall, { color: theme.text, marginBottom: 10 }]}>Weekly Cycle</Text>
            <BarChart
              data={dowData}
              width={screenWidth / 2 - 30}
              height={120}
              chartConfig={{...chartConfig, barPercentage: 0.3}}
              withHorizontalLabels={false}
              fromZero
              style={{ marginLeft: -15 }}
            />
         </View>
         <View style={[styles.halfCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitleSmall, { color: theme.text, marginBottom: 10 }]}>Time Rhythm</Text>
            <BarChart
              data={timeData}
              width={screenWidth / 2 - 30}
              height={120}
              chartConfig={{...chartConfig, barPercentage: 0.3}}
              withHorizontalLabels={false}
              fromZero
              style={{ marginLeft: -15 }}
            />
         </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>High Impact Outflows</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.impactScroll}>
          {heavyHitters.map((h, i) => (
              <View key={i} style={[styles.impactCard, { backgroundColor: theme.card }]}>
                  <Text style={[styles.impactMerchant, { color: theme.text }]} numberOfLines={1}>{h.merchant}</Text>
                  <Text style={[styles.impactAmount, { color: theme.primary }]}>₹{h.amount}</Text>
                  <View style={styles.impactBar}>
                      <View style={[styles.impactFill, { width: `${Math.min((h.amount / totalSpent) * 100 * 5, 100)}%`, backgroundColor: theme.primary }]} />
                  </View>
                  <Text style={styles.impactPct}>{Math.round((h.amount / totalSpent) * 100)}% of total</Text>
              </View>
          ))}
      </ScrollView>

      <View style={[styles.card, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: theme.primary }]}>
        <View style={styles.cardHeader}>
          <Zap size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>AI Strategic Insight</Text>
        </View>
        <Text style={[styles.summaryText, { color: theme.text }]}>
          {report?.analytics?.behavioral_summary || report?.behavioral_summary || "Analyzing your patterns..."}
        </Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 24, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { fontSize: 12, marginTop: 2 },
  emptyBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#3B82F6', borderRadius: 16 },
  emptyBtnText: { color: '#fff', fontWeight: '800' },
  genBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, minWidth: 70, alignItems: 'center' },
  genBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  card: { marginHorizontal: 20, padding: 18, borderRadius: 24, marginBottom: 12, elevation: 1 },
  halfCard: { width: screenWidth / 2 - 26, marginLeft: 20, padding: 16, borderRadius: 24, marginBottom: 12, elevation: 1 },
  row: { flexDirection: 'row', marginBottom: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardSubtitle: { fontSize: 11, marginTop: 2 },
  cardTitleSmall: { fontSize: 12, fontWeight: '800' },
  chart: { marginVertical: 8, borderRadius: 16, marginLeft: -12 },
  matrix: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  matrixItem: { width: '47%', padding: 12, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.02)', alignItems: 'center' },
  matrixVal: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  matrixLabel: { fontSize: 9, fontWeight: '700', color: '#999', textTransform: 'uppercase' },
  miniLegend: { marginTop: 10, gap: 4 },
  legendDotSmall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotText: { fontSize: 10, fontWeight: '600', color: '#666' },
  loyaltyValue: { fontSize: 18, fontWeight: '900', marginVertical: 4 },
  loyaltySub: { fontSize: 9, fontWeight: '600' },
  impactScroll: { paddingLeft: 20, marginBottom: 24 },
  impactCard: { width: 140, padding: 16, borderRadius: 20, marginRight: 12, elevation: 1 },
  impactMerchant: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  impactAmount: { fontSize: 16, fontWeight: '900', marginBottom: 8 },
  impactBar: { height: 4, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, marginBottom: 6 },
  impactFill: { height: 4, borderRadius: 2 },
  impactPct: { fontSize: 9, fontWeight: '600', color: '#999' },
  summaryText: { fontSize: 13, lineHeight: 21, fontWeight: '500' },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginHorizontal: 20, marginBottom: 14, letterSpacing: -0.4 },
});
