import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions 
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { PieChart as PieIcon, BarChart3, Info } from 'lucide-react-native';

const screenWidth = Dimensions.get("window").width;

export const AnalyticsScreen = () => {
  const { theme } = useTheme();
  const [report, setReport] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const id = await apiClient.getDeviceId();
    const data = await apiClient.fetchLatestReport(id);
    setReport(data);
  };

  const chartConfig = {
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    color: (opacity = 1) => theme.primary,
    labelColor: (opacity = 1) => theme.subtext,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false
  };

  const catData = report?.data?.graph_data?.categories?.map(c => ({
    name: c.category,
    population: c.total,
    color: theme.primary,
    legendFontColor: theme.subtext,
    legendFontSize: 12
  })) || [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Insights</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>AI-Generated report based on your habits.</Text>
      </View>

      {/* Summary Card */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <Info size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Executive Summary</Text>
        </View>
        <Text style={[styles.summaryText, { color: theme.text }]}>
          {report?.data?.summary || "Your first report is being prepared. It usually takes 24 hours of transaction history."}
        </Text>
      </View>

      {/* Category Breakdown */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <PieIcon size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Spending by Category</Text>
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
            absolute
          />
        ) : (
          <Text style={[styles.emptyText, { color: theme.subtext }]}>Not enough data for charts yet.</Text>
        )}
      </View>

      {/* Actionable Insights */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>AI Recommendations</Text>
      {report?.data?.insights?.map((insight, idx) => (
        <View key={idx} style={[styles.insightRow, { backgroundColor: theme.card }]}>
          <View style={[styles.dot, { backgroundColor: theme.secondary }]} />
          <Text style={[styles.insightText, { color: theme.text }]}>{insight}</Text>
        </View>
      )) || (
        <Text style={[styles.emptyText, { color: theme.subtext, marginLeft: 24 }]}>No insights yet.</Text>
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

  card: { marginHorizontal: 24, padding: 20, borderRadius: 24, marginBottom: 20, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  summaryText: { fontSize: 15, lineHeight: 22 },
  emptyText: { textAlign: 'center', marginVertical: 40, fontSize: 13 },

  sectionTitle: { fontSize: 18, fontWeight: '800', marginHorizontal: 24, marginBottom: 16, marginTop: 10 },
  insightRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, padding: 16, borderRadius: 16, marginBottom: 12, gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  insightText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
