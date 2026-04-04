import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  MessageCircle, 
  CreditCard, 
  Settings as SettingsIcon, 
  Send, 
  Smartphone, 
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react-native';
import SmsAndroid from 'react-native-get-sms-android';
import { extractTransaction } from './extractor';


// --- CONFIGURATION ---
// IMPORTANT: Update this with your EC2 Public IP!
const API_BASE_URL = 'http://56.228.15.189/api'; 

const COLORS = {
  primary: '#0057D9',
  secondary: '#00b386',
  accent: '#6366f1',
  background: '#F0F2F5',
  card: '#FFFFFF',
  text: '#1E293B',
  subtext: '#64748B',
  border: '#E2E8F0',
  userBubble: '#0057D9',
  botBubble: '#FFFFFF',
};

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [tab, setTab] = useState('chat');
  const [deviceId, setDeviceId] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('DEVICE_ID').then(id => {
      if (id) {
        setDeviceId(id);
      } else {
        const newId = 'device_' + Math.random().toString(36).substr(2, 9);
        AsyncStorage.setItem('DEVICE_ID', newId);
        setDeviceId(newId);
      }
    });
  }, []);

  const syncTransactionsToServer = async (extractedTxs) => {
    try {
      const payload = { deviceId, transactions: extractedTxs };
      await fetch(`${API_BASE_URL}/sync-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error('Sync Error', e);
    }
  };

  const readSMS = async () => {
    setSmsLoading(true);
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        { title: 'SMS Permission', message: 'Palfin needs to read your SMS to extract transactions securely.' }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        alert('Permission Denied');
        setSmsLoading(false);
        return;
      }

      SmsAndroid.list(
        JSON.stringify({ box: 'inbox', maxCount: 200 }),
        (fail) => { console.log('Fail:', fail); setSmsLoading(false); },
        (count, smsList) => {
          const messages = JSON.parse(smsList);
          const extracted = [];
          messages.forEach(msg => {
            const tx = extractTransaction(msg.body);
            if (tx && tx.amount) extracted.push({ ...tx, id: msg._id || Math.random().toString() });
          });
          
          setTransactions(extracted);
          setSmsLoading(false);
          syncTransactionsToServer(extracted);
          alert(`${extracted.length} Transactions Synced!`);
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
                setChatHistory(prev => [...prev, { from: 'finize', text: 'Finize is taking a break. Please try again soon!' }]);
                setLoading(false);
            } else {
                setTimeout(checkStatus, 1500);
            }
        } catch (e) {
            setLoading(false);
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
      const payload = { deviceId, message: userMsg.text };
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.jobId) pollJobStatus(data.jobId);
    } catch (e) {
      setChatHistory(prev => [...prev, { from: 'finize', text: `Connection Error: ${e.message}` }]);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0047AB', '#0057D9']} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Palfin 2.3</Text>
            <Text style={styles.headerSubtitle}>AI Financial Coach</Text>
          </View>
          <TouchableOpacity style={styles.syncBtn} onPress={readSMS} disabled={smsLoading}>
            {smsLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <RefreshCw color="#fff" size={20} />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Modern Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('chat')}>
          <View style={[styles.tabIconBg, tab === 'chat' && styles.tabActiveBg]}>
            <MessageCircle size={22} color={tab === 'chat' ? COLORS.primary : COLORS.subtext} />
          </View>
          <Text style={[styles.tabLabel, tab === 'chat' && styles.tabLabelActive]}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('transactions')}>
          <View style={[styles.tabIconBg, tab === 'transactions' && styles.tabActiveBg]}>
            <CreditCard size={22} color={tab === 'transactions' ? COLORS.primary : COLORS.subtext} />
          </View>
          <Text style={[styles.tabLabel, tab === 'transactions' && styles.tabLabelActive]}>Finance</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => setTab('settings')}>
          <View style={[styles.tabIconBg, tab === 'settings' && styles.tabActiveBg]}>
            <SettingsIcon size={22} color={tab === 'settings' ? COLORS.primary : COLORS.subtext} />
          </View>
          <Text style={[styles.tabLabel, tab === 'settings' && styles.tabLabelActive]}>Safe</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.content} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {tab === 'chat' && (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={chatHistory}
              keyExtractor={(_, i) => i.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              renderItem={({ item }) => (
                <View style={[styles.bubbleWrap, item.from === 'user' ? styles.userWrap : styles.botWrap]}>
                  <View style={[styles.bubble, item.from === 'user' ? styles.userBubble : styles.botBubble]}>
                    {item.from === 'user' ? (
                      <Text style={styles.userText}>{item.text}</Text>
                    ) : (
                      <Markdown style={markdownStyles}>{item.text}</Markdown>
                    )}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIcon}>
                    <ShieldCheck size={40} color={COLORS.primary} opacity={0.5} />
                  </View>
                  <Text style={styles.emptyTitle}>Secure Workspace</Text>
                  <Text style={styles.emptySub}>Ask Finize about your spending or budgets. Fast and secure.</Text>
                </View>
              }
            />
            {loading && (
              <View style={styles.typingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.typingText}>Finize is analyzing...</Text>
              </View>
            )}
            <View style={styles.inputContainer}>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#94A3B8"
                  onSubmitEditing={sendMessage}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={!input.trim()}>
                  <LinearGradient colors={['#0057D9', '#0047AB']} style={styles.sendIconBg}>
                    <Send size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {tab === 'transactions' && (
          <FlatList
            data={transactions}
            keyExtractor={(item, i) => item.id || i.toString()}
            contentContainerStyle={{ padding: 16 }}
            ListHeaderComponent={() => (
              <View style={styles.statsHeader}>
                <Text style={styles.statsTitle}>Recent Activity</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.txCard}>
                <View style={styles.txIconBg}>
                  <CreditCard size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.txMerchant} numberOfLines={1}>{item.merchant || 'Unknown'}</Text>
                  <Text style={styles.txMeta}>{item.date || 'Today'} • {item.account || 'Wallet'}</Text>
                </View>
                <Text style={[styles.txAmount, { color: item.type === 'credit' ? COLORS.secondary : '#EF4444' }]}>
                  {item.type === 'credit' ? '+' : '-'}₹{item.amount}
                </Text>
                <ChevronRight size={16} color="#CBD5E1" />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptySub}>No transactions found locally. Tap Sync in the header.</Text>
              </View>
            }
          />
        )}

        {tab === 'settings' && (
          <View style={styles.settingsPage}>
            <View style={styles.settingHero}>
                <Smartphone size={48} color={COLORS.primary} />
                <Text style={styles.heroTitle}>Secure Connection</Text>
                <Text style={styles.heroSub}>Your device ID is the only identifier we store.</Text>
            </View>
            
            <View style={styles.idCard}>
              <Text style={styles.idLabel}>ANONYMOUS DEVICE IDENTIFIER</Text>
              <Text style={styles.idValue}>{deviceId}</Text>
            </View>

            <View style={styles.securityHint}>
                <ShieldCheck size={20} color={COLORS.secondary} />
                <Text style={styles.securityText}>All PII (Account numbers, Phone numbers) is redacted locally before syncing.</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  syncBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, marginTop: -25, borderRadius: 20, padding: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { height: 5, width: 0 } },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIconBg: { padding: 10, borderRadius: 14, marginBottom: 4 },
  tabActiveBg: { backgroundColor: 'rgba(0,87,217,0.1)' },
  tabLabel: { fontSize: 11, fontWeight: '600', color: COLORS.subtext },
  tabLabelActive: { color: COLORS.primary },

  content: { flex: 1, marginTop: 10 },
  chatList: { flex: 1 },
  bubbleWrap: { marginVertical: 4, width: '100%', flexDirection: 'row' },
  userWrap: { justifyContent: 'flex-end' },
  botWrap: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 22 },
  userBubble: { backgroundColor: COLORS.userBubble, borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: COLORS.botBubble, borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  userText: { color: '#fff', fontSize: 15, fontWeight: '500', lineHeight: 22 },

  inputContainer: { padding: 16, backgroundColor: 'transparent' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 30, paddingHorizontal: 6, paddingVertical: 6, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  textInput: { flex: 1, paddingHorizontal: 16, fontSize: 16, color: COLORS.text, height: 44 },
  sendIconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,87,217,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', lineHeight: 20 },

  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 8 },
  typingText: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginLeft: 8 },

  txCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8 },
  txIconBg: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,87,217,0.05)', alignItems: 'center', justifyContent: 'center' },
  txMerchant: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  txMeta: { fontSize: 12, color: COLORS.subtext, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '800', marginRight: 10 },
  statsTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 16 },

  settingsPage: { flex: 1, padding: 24, alignItems: 'center' },
  settingHero: { alignItems: 'center', marginVertical: 32 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 16 },
  heroSub: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', marginTop: 8 },
  idCard: { backgroundColor: '#fff', width: '100%', padding: 20, borderRadius: 24, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
  idLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1, marginBottom: 8 },
  idValue: { fontSize: 18, fontWeight: '600', color: COLORS.text, letterSpacing: 0.5 },
  securityHint: { flexDirection: 'row', alignItems: 'center', marginTop: 32, paddingHorizontal: 20 },
  securityText: { fontSize: 12, color: COLORS.subtext, marginLeft: 12, lineHeight: 18, flex: 1 },
});

const markdownStyles = {
  body: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  paragraph: { marginVertical: 4 },
  strong: { fontWeight: '800', color: COLORS.primary },
  list_item: { marginVertical: 2 },
  heading1: { fontSize: 22, fontWeight: '800', marginVertical: 10 },
  heading2: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
};