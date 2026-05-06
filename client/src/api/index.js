import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://13.239.4.192:3000/api';

export const apiClient = {
  getDeviceId: async () => {
    let id = await AsyncStorage.getItem('DEVICE_ID');
    if (!id) {
      id = 'device_' + Math.random().toString(36).substr(2, 9);
      await AsyncStorage.setItem('DEVICE_ID', id);
    }
    return id;
  },

  fetchHistory: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/history?deviceId=${deviceId}`);
      const data = await res.json();
      if (data.history) {
        await AsyncStorage.setItem('CACHED_HISTORY', JSON.stringify(data.history));
        return data.history;
      }
    } catch (e) {
      const cached = await AsyncStorage.getItem('CACHED_HISTORY');
      return cached ? JSON.parse(cached) : [];
    }
  },

  fetchTransactions: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/transactions?deviceId=${deviceId}`);
      const data = await res.json();
      if (data.transactions) {
        await AsyncStorage.setItem('CACHED_TX', JSON.stringify(data.transactions));
        return data.transactions;
      }
    } catch (e) {
      const cached = await AsyncStorage.getItem('CACHED_TX');
      return cached ? JSON.parse(cached) : [];
    }
  },

  fetchLatestReport: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/latest?deviceId=${deviceId}`);
      const data = await res.json();
      if (data.status === 'success') {
        await AsyncStorage.setItem('CACHED_REPORT', JSON.stringify(data.report));
        return data.report;
      }
    } catch (e) {
      const cached = await AsyncStorage.getItem('CACHED_REPORT');
      return cached ? JSON.parse(cached) : null;
    }
  },

  sendMessage: async (deviceId, message, isQuery = false) => {
    const endpoint = isQuery ? '/query' : '/chat';
    const payload = { deviceId, [isQuery ? 'question' : 'message']: message };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  syncTransactions: async (deviceId, transactions) => {
    const res = await fetch(`${API_BASE_URL}/sync-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, transactions })
    });
    return await res.json();
  }
};
