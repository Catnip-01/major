import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Activity } from 'lucide-react-native';
import EventSource from 'react-native-sse';

export const PulseBar = ({ deviceId }) => {
  const { theme } = useTheme();
  const [event, setEvent] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!deviceId) return;

    const url = `http://3.26.191.49:3000/api/events/${deviceId}`;
    const es = new EventSource(url);

    es.addEventListener('message', (e) => {
      if (e.data) {
        try {
          const data = JSON.parse(e.data);
          setEvent(data);

          Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.delay(4000),
            Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true })
          ]).start();
        } catch (err) {
          console.error("SSE Parse Error:", err);
        }
      }
    });

    es.addEventListener('error', (e) => {
      console.warn("SSE Connection Error. Retrying...");
    });

    return () => es.close();
  }, [deviceId]);

  if (!event) return null;

  return (
    <Animated.View style={[
      styles.container,
      { backgroundColor: theme.primary, opacity: fadeAnim }
    ]}>
      <Activity size={14} color="#fff" style={{ marginRight: 8 }} />
      <Text style={styles.text}>{event.message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
