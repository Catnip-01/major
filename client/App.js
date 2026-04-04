import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { extractTransaction } from './extractor';
import { encryptPayload, decryptPayload } from './crypto';

// Use 10.0.2.2 for Android Emulator connecting to localhost
const API_BASE_URL = 'http://10.0.2.2:3000/api';

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [tab, setTab] = useState('chat');
  const [deviceId, setDeviceId] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    // Generate a pseudo-random device ID for anonymous syncing
    AsyncStorage.getItem('DEVICE_ID').then(id => {
      if (id) {
        setDeviceId(id);
      } else {
        const newId = 'device_' + Math.random().toString(36).substr(2, 9);
        AsyncStorage.setItem('DEVICE_ID', newId);
        setDeviceId(newId);
      }
    });

    // Optionally: Fetch existing transactions and chat history from server on load
  }, []);

  const syncTransactionsToServer = async (extractedTxs) => {
    try {
      const payload = {
        deviceId,
        transactions: extractedTxs,
      };
      
      // E2EE Wrapper
      const encryptedData = encryptPayload(JSON.stringify(payload));
      
      await fetch(`${API_BASE_URL}/sync-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-e2e-enabled': 'true'
        },
        body: JSON.stringify(encryptedData)
      });
      console.log('Successfully synced transactions to server E2EE');
    } catch (e) {
      console.error('API Sync Error', e);
    }
  };

  const readSMS = async () => {
    setSmsLoading(true);
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        { title: 'SMS Permission', message: 'Palfin needs to read your SMS to extract transactions' }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        alert('SMS permission denied');
        setSmsLoading(false);
        return;
      }

      SmsAndroid.list(
        JSON.stringify({ box: 'inbox', maxCount: 200 }),
        (fail) => { console.log('SMS read failed:', fail); setSmsLoading(false); },
        (count, smsList) => {
          const messages = JSON.parse(smsList);
          setAllMessages(messages);
          const extracted = [];
          messages.forEach(msg => {
            const tx = extractTransaction(msg.body);
            // Include message ID so server ignores duplicates
            if (tx && tx.amount) extracted.push({ ...tx, id: msg._id || Math.random().toString() });
          });
          
          setTransactions(prev => [...prev, ...extracted]);
          setSmsLoading(false);
          
          // Background sync to server with PII redacted via extractor
          syncTransactionsToServer(extracted);
          
          alert(`Found & Synced ${extracted.length} transactions securely!`);
        }
      );
    } catch (e) {
      console.error(e);
      setSmsLoading(false);
    }
  };

  const pollJobStatus = async (jobId) => {
    const checkStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/chat/status/${jobId}`);
            const data = await response.json();
            
            if (data.status === 'completed') {
                setChatHistory(prev => [...prev, { from: 'finize', text: data.result.text }]);
                setLoading(false);
            } else if (data.status === 'failed') {
                setChatHistory(prev => [...prev, { from: 'finize', text: 'Sorry, the chat worker failed to process it.' }]);
                setLoading(false);
            } else {
                // Still processing, poll again in 1.5s
                setTimeout(checkStatus, 1500);
            }
        } catch (e) {
            setLoading(false);
            setChatHistory(prev => [...prev, { from: 'finize', text: 'Network Error checking status.' }]);
        }
    };
    checkStatus();
  };

  const sendMessage = async () => {
    if (!input.trim() || !deviceId) return;
    const userMsg = { from: 'user', text: input };
    setChatHistory(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Send Secure Payload (E2EE)
      const payload = { deviceId, message: userMsg.text };
      const encryptedData = encryptPayload(JSON.stringify(payload));

      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-e2e-enabled': 'true' 
        },
        body: JSON.stringify(encryptedData)
      });
      
      const data = await res.json();
      
      if (data.jobId) {
        // Start polling BullMQ for the answer
        pollJobStatus(data.jobId);
      } else {
        throw new Error('No Job ID returned');
      }

    } catch (e) {
      setChatHistory(prev => [...prev, { from: 'finize', text: `Something went wrong: ${e.message}` }]);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Palfin</Text>
        <TouchableOpacity style={styles.smsBtn} onPress={readSMS}>
          {smsLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.smsBtnText}>Read SMS (E2EE)</Text>}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'chat' && styles.activeTab]} onPress={() => setTab('chat')}>
          <Text style={[styles.tabText, tab === 'chat' && styles.activeTabText]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'transactions' && styles.activeTab]} onPress={() => setTab('transactions')}>
          <Text style={[styles.tabText, tab === 'transactions' && styles.activeTabText]}>Transactions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'settings' && styles.activeTab]} onPress={() => setTab('settings')}>
          <Text style={[styles.tabText, tab === 'settings' && styles.activeTabText]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Tab */}
      {tab === 'chat' && (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={chatHistory}
            keyExtractor={(_, i) => i.toString()}
            style={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.from === 'user' ? styles.userBubble : styles.botBubble]}>
                {item.from === 'user' ? (
                  <Text style={[styles.bubbleText, { color: '#fff' }]}>{item.text}</Text>
                ) : (
                  <Markdown style={markdownStyles}>
                    {item.text}
                  </Markdown>
                )}
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Ask Finize anything about your finances... (Secured with E2EE)</Text>
            }
          />
          {loading && <Text style={{ textAlign: 'center', marginBottom: 8, color: '#0057D9' }}>Finize is thinking in the Cloud Queue...</Text>}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ask Finize..."
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <FlatList
          data={transactions}
          keyExtractor={(item, i) => item.id || i.toString()}
          style={{ flex: 1, padding: 12 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No local transactions yet. Tap "Read SMS" to extract and sync.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.txCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.txMerchant}>{item.merchant || 'Unknown'}</Text>
                <Text style={[styles.txAmount, { color: item.type === 'credit' ? '#00b386' : '#e53935' }]}>
                  {item.type === 'credit' ? '+' : '-'}₹{item.amount}
                </Text>
              </View>
              <Text style={styles.txDate}>{item.date || 'No date'} • A/c: {item.account || 'N/A'}</Text>
            </View>
          )}
        />
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <View style={{ flex: 1, padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Device Link</Text>
          <Text style={{ color: '#666', marginBottom: 20 }}>
            Your Device ID is strictly for anonymous E2EE communication with the Palfin Servers. NO PII is transmitted in plain text.
          </Text>
          <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e6e6ee' }}>
            <Text style={{ fontWeight: '500', fontSize: 16, textAlign: 'center' }}>{deviceId}</Text>
          </View>
          <Text style={{ color: '#aaa', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            LLM logic is now safely hosted on the Backend Redis Queue!
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  header: { backgroundColor: '#0057D9', padding: 16, paddingTop: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  smsBtn: { backgroundColor: '#ffffff33', padding: 8, borderRadius: 8 },
  smsBtnText: { color: '#fff', fontWeight: '600' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e6e6ee' },
  tab: { flex: 1, padding: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#0057D9' },
  tabText: { color: '#888', fontWeight: '500' },
  activeTabText: { color: '#0057D9' },
  chatList: { flex: 1, padding: 12 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  userBubble: { backgroundColor: '#0057D9', alignSelf: 'flex-end' },
  botBubble: { backgroundColor: '#fff', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#e6e6ee' },
  bubbleText: { color: '#222', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e6e6ee' },
  textInput: { flex: 1, borderWidth: 1, borderColor: '#e6e6ee', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  sendBtn: { backgroundColor: '#0057D9', borderRadius: 20, paddingHorizontal: 20, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '600' },
  txCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#e6e6ee' },
  txMerchant: { fontWeight: '600', fontSize: 15, color: '#222' },
  txAmount: { fontWeight: '700', fontSize: 15 },
  txDate: { color: '#aaa', fontSize: 12, marginTop: 4 },
});

const markdownStyles = {
  body: { color: '#222', fontSize: 14 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  strong: { fontWeight: 'bold' },
  em: { fontStyle: 'italic' },
  heading1: { fontSize: 20, fontWeight: 'bold', marginVertical: 8 },
  heading2: { fontSize: 18, fontWeight: 'bold', marginVertical: 8 },
  heading3: { fontSize: 16, fontWeight: 'bold', marginVertical: 8 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4 }
};