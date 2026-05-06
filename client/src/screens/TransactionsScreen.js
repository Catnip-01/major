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
import { 
  Search, 
  CreditCard, 
  ChevronRight, 
  Filter 
} from 'lucide-react-native';

export const TransactionsScreen = () => {
  const { theme } = useTheme();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const id = await apiClient.getDeviceId();
    const data = await apiClient.fetchTransactions(id);
    setTxs(data);
    setLoading(false);
  };

  const filteredTxs = txs.filter(t => 
    t.merchant?.toLowerCase().includes(search.toLowerCase()) || 
    t.category?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.txCard, { backgroundColor: theme.card }]}>
      <View style={[styles.iconBg, { backgroundColor: theme.primary + '10' }]}>
        <CreditCard size={20} color={theme.primary} />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.merchant, { color: theme.text }]} numberOfLines={1}>
          {item.merchant || 'Unknown Merchant'}
        </Text>
        <Text style={[styles.meta, { color: theme.subtext }]}>
          {item.date || 'Today'} • {item.category || 'Uncategorized'}
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
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Ledger</Text>
        <TouchableOpacity style={[styles.filterBtn, { borderColor: theme.border }]}>
          <Filter size={18} color={theme.subtext} />
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
        refreshing={loading}
        onRefresh={load}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800' },
  filterBtn: { padding: 10, borderRadius: 12, borderWidth: 1 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, paddingHorizontal: 16, height: 50, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15 },

  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  txCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, elevation: 1 },
  iconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, marginLeft: 16 },
  merchant: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  amountWrap: { flexDirection: 'row', alignItems: 'center' },
  amount: { fontSize: 16, fontWeight: '800', marginRight: 8 },
  empty: { alignItems: 'center', marginTop: 100 },
});
