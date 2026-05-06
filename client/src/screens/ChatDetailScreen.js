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
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { apiClient } from '../api';
import Markdown from 'react-native-markdown-display';
import { Send, ChevronLeft, Bot, User } from 'lucide-react-native';

export const ChatDetailScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const flatListRef = useRef(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const id = await apiClient.getDeviceId();
    setDeviceId(id);
    const history = await apiClient.fetchHistory(id);
    // Convert backend schema to UI schema
    const formatted = history.map(h => ({
      id: Math.random().toString(),
      role: h.role === 'assistant' ? 'bot' : 'user',
      text: h.content,
      type: h.type,
      metadata: h.metadata ? JSON.parse(h.metadata) : null
    }));
    setMessages(formatted);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.sendMessage(deviceId, userMsg.text);
      // If it's a polling API, we wait (or handle SSE if we integrated it here)
      // For now, let's assume it returns a result or we'll fetch history again
      setTimeout(async () => {
        await init(); // Refresh from DB
        setLoading(false);
      }, 3000);
    } catch (e) {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.bubbleWrap, 
      item.role === 'user' ? styles.userWrap : styles.botWrap
    ]}>
      <View style={[
        styles.bubble, 
        item.role === 'user' 
          ? [styles.userBubble, { backgroundColor: theme.primary }] 
          : [styles.botBubble, { backgroundColor: theme.card, borderColor: theme.border }]
      ]}>
        {item.role === 'bot' ? (
          <Markdown style={{ 
            body: { color: theme.text },
            strong: { color: theme.primary, fontWeight: '800' }
          }}>{item.text}</Markdown>
        ) : (
          <Text style={styles.userText}>{item.text}</Text>
        )}
        {item.metadata?.sql && (
          <Text style={[styles.sqlText, { color: theme.subtext }]}>Analysis run on your DB.</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Bot size={20} color={theme.primary} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>Finize Coach</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.primary }]}>Finize is calculating...</Text>
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
            style={[styles.sendBtn, { backgroundColor: theme.primary }]}
            onPress={sendMessage}
            disabled={!input.trim()}
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
    paddingTop: 50, 
    paddingBottom: 15, 
    paddingHorizontal: 20,
    borderBottomWidth: 1 
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700' },

  listContent: { padding: 20, paddingBottom: 40 },
  bubbleWrap: { marginVertical: 8, maxWidth: '85%' },
  userWrap: { alignSelf: 'flex-end' },
  botWrap: { alignSelf: 'flex-start' },
  bubble: { padding: 14, borderRadius: 20 },
  userBubble: { borderBottomRightRadius: 4 },
  botBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  userText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  sqlText: { fontSize: 10, marginTop: 8, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 4 },

  loading: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  loadingText: { fontSize: 12, fontWeight: '600' },

  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 100, paddingHorizontal: 16, fontSize: 15, paddingTop: 8, paddingBottom: 8 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
