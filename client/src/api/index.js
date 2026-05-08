import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://3.26.191.49:3000/api';

export const apiClient = {
  getDeviceId: async () => {
    let id = await AsyncStorage.getItem('DEVICE_ID');
    if (!id) {
      id = 'device_' + Math.random().toString(36).substr(2, 9);
      await AsyncStorage.setItem('DEVICE_ID', id);
    }
    return id;
  },

  fetchHistory: async (deviceId, sessionId = "default") => {
    try {
      const res = await fetch(`${API_BASE_URL}/history?deviceId=${deviceId}&sessionId=${sessionId}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      return data.history || [];
    } catch (e) {
      return [];
    }
  },

  fetchSessions: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions?deviceId=${deviceId}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      return data.sessions || [];
    } catch (e) {
      return [];
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
      return cached ? parseJSON(cached, []) : [];
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
      return cached ? parseJSON(cached, null) : null;
    }
  },

  fetchAnalytics: async (deviceId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/analytics?deviceId=${deviceId}`);
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      return data.status === 'success' ? data.data : null;
    } catch (e) {
      return null;
    }
  },

  sendMessage: async (deviceId, message, isQuery = false, sessionId = "default") => {
    const endpoint = isQuery ? '/query' : '/chat';
    const payload = { deviceId, message, sessionId };
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
