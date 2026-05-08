import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput 
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import { useSync } from '../context/SyncContext';
import { 
  Search, 
  CreditCard, 
  ChevronRight, 
  Download,
  Upload
} from 'lucide-react-native';

export const TransactionsScreen = () => {
  const { theme } = useTheme();
  const { 
    fetchLocalSms, 
    uploadToServer, 
    localTransactions, 
    isSyncing,
    serverTransactions,
    refreshServerTxs
  } = useSync();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [viewMode, setViewMode] = useState('transactions'); // 'transactions' | 'messages'

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    await refreshServerTxs();
    setLoading(false);
  };

  const handleFetch = async () => {
    await fetchLocalSms();
    setViewMode('messages');
  };

  const handleUpload = async () => {
    await uploadToServer(localTransactions);
    await load();
    setViewMode('transactions');
  };

  const displayData = viewMode === 'messages' ? localTransactions : serverTransactions;

  const filteredTxs = displayData.filter(t => 
    t.merchant?.toLowerCase().includes(search.toLowerCase()) || 
    t.category?.toLowerCase().includes(search.toLowerCase()) ||
    t.raw?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.txCard, { backgroundColor: theme.card }]}>
      <View style={styles.txRow}>
        <View style={[styles.iconBg, { backgroundColor: theme.primary + '10' }]}>
          <CreditCard size={20} color={theme.primary} />
        </View>
        <View style={styles.txInfo}>
          <Text style={[styles.merchant, { color: theme.text }]} numberOfLines={1}>
            {item.merchant || 'Unknown Merchant'}
          </Text>
          <Text style={[styles.meta, { color: theme.subtext }]}>
            {item.date || 'Today'} • {item.category || (item.smsId ? 'Local (Not Synced)' : 'Uncategorized')}
          </Text>
        </View>
        <View style={styles.amountWrap}>
          <Text style={[
            styles.amount, 
            { color: item.type === 'credit' ? theme.success : theme.error }
          ]}>
            {item.type === 'credit' ? '+' : '-'}₹{item.amount}
          </Text>
          <ChevronRight size={14} color={theme.border} />
        </View>
      </View>
      {item.raw && (
        <View style={[styles.rawWrap, { backgroundColor: theme.background }]}>
          <Text style={[styles.rawText, { color: theme.subtext }]} numberOfLines={3}>
            {item.raw}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Ledger</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={[styles.actionBtn, { borderColor: theme.border, backgroundColor: isSyncing ? theme.border : 'transparent' }]}
            onPress={handleFetch}
            disabled={isSyncing}
          >
            <Download size={16} color={theme.text} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Fetch</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
            onPress={handleUpload}
            disabled={isSyncing || localTransactions.length === 0}
          >
            <Upload size={16} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Sync</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Control */}
      <View style={[styles.tabWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.tab, viewMode === 'transactions' && { backgroundColor: theme.primary + '20' }]} 
          onPress={() => setViewMode('transactions')}
        >
          <Text style={[styles.tabText, { color: viewMode === 'transactions' ? theme.primary : theme.subtext }]}>
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, viewMode === 'messages' && { backgroundColor: theme.primary + '20' }]} 
          onPress={() => setViewMode('messages')}
        >
          <Text style={[styles.tabText, { color: viewMode === 'messages' ? theme.primary : theme.subtext }]}>
            Raw Messages
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Search size={18} color={theme.subtext} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search merchants, categories..."
          placeholderTextColor={theme.subtext}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredTxs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.subtext }}>No transactions found.</Text>
          </View>
        }
        refreshing={!!loading}
        onRefresh={load}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  
  tabWrap: { flexDirection: 'row', marginHorizontal: 24, marginBottom: 16, padding: 4, borderRadius: 12, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabText: { fontSize: 13, fontWeight: '700' },

  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, paddingHorizontal: 16, height: 50, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15 },

  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  txCard: { padding: 16, borderRadius: 20, marginBottom: 12, elevation: 1 },
  txRow: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, marginLeft: 16 },
  merchant: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  amountWrap: { flexDirection: 'row', alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: '800', marginRight: 8 },
  rawWrap: { marginTop: 12, padding: 10, borderRadius: 8 },
  rawText: { fontSize: 11, fontStyle: 'italic', lineHeight: 16 },
  empty: { alignItems: 'center', marginTop: 100 },
});
