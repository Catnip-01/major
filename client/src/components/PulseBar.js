import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Activity } from 'lucide-react-native';

export const PulseBar = ({ deviceId }) => {
  const { theme } = useTheme();
  const [event, setEvent] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!deviceId) return;
    
    const eventSource = new EventSource(`http://13.239.4.192:3000/api/events/${deviceId}`);
    
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setEvent(data);
      
      // Show and then hide after 3 seconds
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true })
      ]).start();
    };

    return () => eventSource.close();
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

// Polyfill for EventSource if needed in React Native
// Usually requires react-native-sse or similar, but let's assume it's available or we'll add it.
