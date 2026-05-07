import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import { Bot, User, ChevronRight, MessageSquare } from 'lucide-react-native';

export const ChatHistoryScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const id = await apiClient.getDeviceId();
      const data = await apiClient.fetchHistory(id);
      // Group messages into conversations (each user message + bot reply = one session)
      const userMsgs = (data || []).filter(h => h.role === 'user').reverse();
      setHistory(userMsgs);
    } catch (e) {
      setHistory([]);
    }
    setLoading(false);
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.chatCard, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('ChatDetail')}
    >
      <View style={[styles.avatarBg, { backgroundColor: theme.primary + '15' }]}>
        <MessageSquare size={20} color={theme.primary} />
      </View>
      <View style={styles.chatInfo}>
        <Text style={[styles.chatPreview, { color: theme.text }]} numberOfLines={2}>
          {item.content}
        </Text>
        <Text style={[styles.chatTime, { color: theme.subtext }]}>
          {item.created_at || 'Earlier'}
        </Text>
      </View>
      <ChevronRight size={16} color={theme.border} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Chat History</Text>
        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('ChatDetail')}
        >
          <Bot size={16} color="#fff" />
          <Text style={styles.newChatText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.card }]}>
            <Bot size={40} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Chats Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
            Start a conversation with Finize AI, your personal finance coach.
          </Text>
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ChatDetail')}
          >
            <Text style={styles.startBtnText}>Start a Conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16 },
  newChatText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  list: { paddingHorizontal: 24, paddingBottom: 40 },
  chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, elevation: 1, gap: 14 },
  avatarBg: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chatInfo: { flex: 1 },
  chatPreview: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 4 },
  chatTime: { fontSize: 11 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20, elevation: 2 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  emptySubtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 32 },
  startBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20 },
  startBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
