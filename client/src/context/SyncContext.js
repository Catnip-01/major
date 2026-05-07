import React, { createContext, useContext, useState, useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { apiClient } from '../api';
import { usePulse } from './usePulse';

const SyncContext = createContext();

export const SyncProvider = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [localTransactions, setLocalTransactions] = useState([]);
  const [serverTransactions, setServerTransactions] = useState([]);

  useEffect(() => {
    apiClient.getDeviceId().then(setDeviceId);
  }, []);

  const refreshServerTxs = async () => {
    if (!deviceId) return;
    const data = await apiClient.fetchTransactions(deviceId);
    setServerTransactions(data || []);
  };

  // Listen for background events
  usePulse(deviceId, (event) => {
    if (event.event === 'classify_complete' || event.event === 'query_complete') {
      refreshServerTxs();
    }
  });

  const extractTransaction = (body) => {
    if (!body) return null;
    const raw = body.trim();
    
    // Find amount anywhere in the string
    let amountMatch = raw.match(/(?:INR|Rs\.?|₹)\s?([0-9,]+(?:\.[0-9]+)?)/i);
    if (!amountMatch) return null;
    
    let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    
    let type = 'debit';
    if (raw.match(/(credited|received|added|deposited|reversed)/i)) {
      type = 'credit';
    }
    
    let merchant = '';
    const upiMatch = raw.match(/UPI[/-].+?[/-].+?[/-]([^\s\n/]+)/i) || raw.match(/to\s+([A-Za-z0-9@\s]+?)(?:\s+on|\s+ref|\.|$)/i);
    if (upiMatch && upiMatch[1] && upiMatch[1].length < 30) {
      merchant = upiMatch[1].trim();
    }
    
    return {
      amount,
      merchant: merchant || 'Unknown Merchant',
      type,
      raw: body
    };
  };

  const fetchLocalSms = async () => {
    if (Platform.OS !== 'android') return [];
    setIsSyncing(true);

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'Palfin needs access to your SMS to extract transactions.',
          buttonPositive: 'OK',
        }
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('SMS permission denied');
        setIsSyncing(false);
        return [];
      }

      if (!SmsAndroid || !SmsAndroid.list) {
        console.warn("SMS library not found. Skipping sync (Expected in Expo Go).");
        setIsSyncing(false);
        return [];
      }

      return new Promise((resolve) => {
        SmsAndroid.list(
          JSON.stringify({ box: 'inbox', maxCount: 200 }),
          (fail) => {
            console.error('Failed to list SMS:', fail);
            setIsSyncing(false);
            resolve([]);
          },
          (count, smsList) => {
            const messages = JSON.parse(smsList);
            const extracted = [];

            messages.forEach((msg) => {
              const tx = extractTransaction(msg.body);
              if (tx) {
                extracted.push({
                  ...tx,
                  smsId: msg._id.toString(),
                  date: new Date(msg.date).toISOString(),
                  bank: msg.address,
                });
              }
            });

            setLocalTransactions(extracted);
            setLastSync(new Date());
            setIsSyncing(false);
            resolve(extracted);
          }
        );
      });
    } catch (err) {
      console.error('Sync Error:', err);
      setIsSyncing(false);
      return [];
    }
  };

  const uploadToServer = async (transactionsToUpload) => {
    if (!transactionsToUpload || transactionsToUpload.length === 0) return;
    setIsSyncing(true);
    try {
      const deviceId = await apiClient.getDeviceId();
      await apiClient.syncTransactions(deviceId, transactionsToUpload);
    } catch (e) {
      console.error('Upload Error:', e);
    }
    setIsSyncing(false);
  };

  // Keep legacy syncSms for any existing calls, but change to use the separated flow
  const syncSms = async () => {
    const extracted = await fetchLocalSms();
    if (extracted.length > 0) {
      await uploadToServer(extracted);
    }
  };

  return (
    <SyncContext.Provider value={{ 
      isSyncing, 
      lastSync, 
      syncSms, 
      fetchLocalSms, 
      uploadToServer, 
      localTransactions,
      serverTransactions,
      refreshServerTxs
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
