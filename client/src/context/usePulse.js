import { useEffect, useState } from 'react';
import EventSource from 'react-native-sse';

const API_BASE_URL = 'http://3.26.191.49:3000/api';

export const usePulse = (deviceId, onEvent) => {
  const [status, setStatus] = useState('disconnected');

  useEffect(() => {
    if (!deviceId) return;

    const es = new EventSource(`${API_BASE_URL}/events/${deviceId}`);

    es.addEventListener('open', () => {
      setStatus('connected');
    });

    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onEvent) onEvent(data);
      } catch (e) {
        console.error('Pulse Parse Error:', e);
      }
    });

    es.addEventListener('error', (err) => {
      setStatus('error');
      console.error('Pulse Error:', err);
    });

    return () => {
      es.close();
      setStatus('disconnected');
    };
  }, [deviceId]);

  return { status };
};
