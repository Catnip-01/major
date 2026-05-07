import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import Markdown from 'react-native-markdown-display';
import { Send, ChevronLeft, Bot, Database } from 'lucide-react-native';

const API_BASE_URL = 'http://3.26.191.49:3000/api';

const pollJob = async (jobId, endpoint, maxAttempts = 12) => {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2500));
    try {
      const res = await fetch(`${API_BASE_URL}/${endpoint}/status/${jobId}`);
      const data = await res.json();
      if (data.status === 'completed') return data.result;
      if (data.status === 'failed') return null;
    } catch (e) {
      // continue polling
    }
  }
  return null;
};

export const ChatDetailScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [isQueryMode, setIsQueryMode] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const id = await apiClient.getDeviceId();
    setDeviceId(id);
    const history = await apiClient.fetchHistory(id);
    const formatted = (history || []).map(h => ({
      id: Math.random().toString(),
      role: h.role === 'assistant' ? 'bot' : 'user',
      text: h.content || '',
      metadata: h.metadata ? JSON.parse(h.metadata) : null,
    }));
    setMessages(formatted);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const text = input.trim();
    const userMsg = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.sendMessage(deviceId, text, isQueryMode);

      if (res?.status === 'failed' || !res?.jobId) {
        // Server down — show error inline
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'bot',
          text: '⚠️ Could not reach the server. Please try again.',
        }]);
        setLoading(false);
        return;
      }

      // Poll for the job result
      const result = await pollJob(res.jobId, isQueryMode ? 'query' : 'chat');

      if (result?.text) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'bot',
          text: result.text,
        }]);
      } else {
        // Fallback: refresh history from DB
        const history = await apiClient.fetchHistory(deviceId);
        const botReplies = (history || [])
          .filter(h => h.role === 'assistant')
          .slice(-1);
        if (botReplies.length > 0) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'bot',
            text: botReplies[0].content,
          }]);
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'bot',
        text: '⚠️ Something went wrong. Please try again later.',
      }]);
    }

    setLoading(false);
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.bubbleWrap,
      item.role === 'user' ? styles.userWrap : styles.botWrap,
    ]}>
      <View style={[
        styles.bubble,
        item.role === 'user'
          ? [styles.userBubble, { backgroundColor: theme.primary }]
          : [styles.botBubble, { backgroundColor: theme.card, borderColor: theme.border }],
      ]}>
        {item.role === 'bot' ? (
          <Markdown style={{
            body: { color: theme.text, fontSize: 15, lineHeight: 22 },
            strong: { color: theme.primary, fontWeight: '800' },
          }}>
            {item.text}
          </Markdown>
        ) : (
          <Text style={styles.userText}>{item.text}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.botAvatar, { backgroundColor: theme.primary + '15' }]}>
            <Bot size={18} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Finize Coach</Text>
            <Text style={[styles.headerStatus, { color: theme.secondary }]}>● Online</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.queryToggle, { backgroundColor: isQueryMode ? theme.primary + '20' : 'transparent' }]}
          onPress={() => setIsQueryMode(!isQueryMode)}
        >
          <Database size={18} color={isQueryMode ? theme.primary : theme.subtext} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={[styles.emptyChatIcon, { backgroundColor: theme.card }]}>
              <Bot size={32} color={theme.primary} />
            </View>
            <Text style={[styles.emptyChatTitle, { color: theme.text }]}>Ask me anything</Text>
            <Text style={[styles.emptyChatSub, { color: theme.subtext }]}>
              I can analyze your spending, find patterns, and give personalized tips.
            </Text>
          </View>
        }
      />

      {loading && (
        <View style={[styles.typing, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.typingText, { color: theme.primary }]}>Finize is thinking...</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputArea, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Ask about your spending..."
            placeholderTextColor={theme.subtext}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? theme.primary : theme.border }]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  botAvatar: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerStatus: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  queryToggle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubbleWrap: { marginVertical: 4, maxWidth: '85%' },
  userWrap: { alignSelf: 'flex-end' },
  botWrap: { alignSelf: 'flex-start' },
  bubble: { padding: 14, borderRadius: 22 },
  userBubble: { borderBottomRightRadius: 4 },
  botBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },

  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 80 },
  emptyChatIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16, elevation: 2 },
  emptyChatTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyChatSub: { fontSize: 14, lineHeight: 21, textAlign: 'center' },

  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, marginHorizontal: 16, marginBottom: 8, borderRadius: 16 },
  typingText: { fontSize: 12, fontWeight: '600' },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    borderTopWidth: 1,
    gap: 10,
  },
  input: { flex: 1, maxHeight: 100, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, backgroundColor: 'transparent' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
