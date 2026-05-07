import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const PlaceholderScreen = ({ name }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.text }]}>{name} Screen</Text>
    </View>
  );
};

export * from './DashboardScreen';
export * from './TransactionsScreen';
export * from './AnalyticsScreen';
export * from './VaultScreen';
export * from './ChatDetailScreen';
export * from './ChatHistoryScreen';

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 24, fontWeight: 'bold' },
});
