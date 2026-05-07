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
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const historyList = data.history || [];
      await AsyncStorage.setItem('CACHED_HISTORY', JSON.stringify(historyList));
      return historyList;
    } catch (e) {
      const cached = await AsyncStorage.getItem('CACHED_HISTORY');
      return cached ? JSON.parse(cached) : [];
    }
  },

  fetchTransactions: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/transactions?deviceId=${deviceId}`);
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      const txList = data.transactions || [];
      if (txList.length > 0) {
        await AsyncStorage.setItem('CACHED_TX', JSON.stringify(txList));
      }
      return txList;
    } catch (e) {
      const cached = await AsyncStorage.getItem('CACHED_TX');
      return cached ? JSON.parse(cached) : [];
    }
  },

  fetchLatestReport: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/latest?deviceId=${deviceId}`);
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      if (data.status === 'success' && data.report) {
        await AsyncStorage.setItem('CACHED_REPORT', JSON.stringify(data.report));
        return data.report;
      }
      return null;
    } catch (e) {
      const cached = await AsyncStorage.getItem('CACHED_REPORT');
      return cached ? JSON.parse(cached) : null;
    }
  },

  sendMessage: async (deviceId, message, isQuery = false) => {
    const endpoint = isQuery ? '/query' : '/chat';
    const payload = { deviceId, [isQuery ? 'question' : 'message']: message };
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      return { status: 'failed', error: 'Network error' };
    }
  },

  syncTransactions: async (deviceId, transactions) => {
    const res = await fetch(`${API_BASE_URL}/sync-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, transactions })
    });
    return await res.json();
  },

  triggerReportGeneration: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });
      return await res.json();
    } catch (e) {
      return { status: 'failed', error: 'Network error' };
    }
  }
};
