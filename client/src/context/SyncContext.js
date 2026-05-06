import React, { createContext, useContext, useState, useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { apiClient } from '../api';

const SyncContext = createContext();

export const SyncProvider = ({ children }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const extractTransaction = (body) => {
    // Basic regex for Indian banking SMS (covers most common banks)
    const spentMatch = body.match(/(?:spent|debited|paid|transaction|txn)\s+(?:of\s+)?(?:rs\.?|inr|₹)\s*([\d,.]+)/i);
    const merchantMatch = body.match(/(?:at|to|on)\s+([A-Za-z0-9\s.*]+?)(?:\s+using|\s+on|\s+at|\s+via|\.|$)/i);

    if (spentMatch) {
      return {
        amount: parseFloat(spentMatch[1].replace(/,/g, '')),
        merchant: merchantMatch ? merchantMatch[1].trim() : 'General Spend',
        type: 'debit',
        raw: body
      };
    }
    return null;
  };

  const syncSms = async () => {
    if (Platform.OS !== 'android') return;
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
        return;
      }
      const deviceId = await apiClient.getDeviceId();
      if (!SmsAndroid || !SmsAndroid.list) {
        console.warn("SMS library not found. Skipping sync (Expected in Expo Go).");
        setIsSyncing(false);
        return;
      }

      try {
        SmsAndroid.list(
          JSON.stringify({ box: 'inbox', maxCount: 50 }),
          (fail) => {
            console.error('Failed to list SMS:', fail);
            setIsSyncing(false);
          },
          async (count, smsList) => {
            const messages = JSON.parse(smsList);
            const transactions = [];

            messages.forEach((msg) => {
              const tx = extractTransaction(msg.body);
              if (tx) {
                transactions.push({
                  ...tx,
                  smsId: msg._id.toString(),
                  date: new Date(msg.date).toISOString(),
                  bank: msg.address,
                });
              }
            });

            if (transactions.length > 0) {
              await apiClient.syncTransactions(deviceId, transactions);
            }

            setLastSync(new Date());
            setIsSyncing(false);
          }
        );
      } catch (nativeErr) {
        console.error('Native SMS Error:', nativeErr);
        setIsSyncing(false);
      }
    } catch (err) {
      console.error('Sync Error:', err);
      setIsSyncing(false);
    }
  };

  // Initial sync on app load
  useEffect(() => {
    syncSms();
  }, []);

  return (
    <SyncContext.Provider value={{ isSyncing, lastSync, syncSms }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
