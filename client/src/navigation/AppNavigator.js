import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LayoutGrid, Landmark, BarChart3, Shield, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import {
  DashboardScreen,
  TransactionsScreen,
  AnalyticsScreen,
  VaultScreen,
  ChatDetailScreen,
  ChatHistoryScreen,
} from '../screens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <LayoutGrid size={size} color={color} />;
          if (route.name === 'Ledger') return <Landmark size={size} color={color} />;
          if (route.name === 'Insights') return <BarChart3 size={size} color={color} />;
          if (route.name === 'Chats') return <MessageCircle size={size} color={color} />;
          if (route.name === 'Vault') return <Shield size={size} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          elevation: 0,
          shadowOpacity: 0,
          height: 62,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Ledger" component={TransactionsScreen} />
      <Tab.Screen name="Insights" component={AnalyticsScreen} />
      <Tab.Screen name="Chats" component={ChatHistoryScreen} />
      <Tab.Screen name="Vault" component={VaultScreen} />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
    </Stack.Navigator>
  );
};
