import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const PlaceholderScreen = ({ name }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.text }]}>{name} Screen</Text>
      <Text style={[styles.sub, { color: theme.subtext }]}>Coming soon as part of the overhaul.</Text>
    </View>
  );
};

export * from './DashboardScreen';
export * from './TransactionsScreen';
export * from './AnalyticsScreen';
export * from './VaultScreen';
export * from './ChatDetailScreen';

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 24, fontWeight: 'bold' },
  sub: { fontSize: 14, marginTop: 8 },
});
