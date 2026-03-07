import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const client = axios.create({
  baseURL: API_URL || undefined,
  timeout: 30000,
});

export const configAPI = {
  getConfig: () => client.get('/api/config'),
  saveConfig: (config) => client.post('/api/config/save', config),
  validateConfig: (config) => client.post('/api/config/validate', config),
};

export const sessionAPI = {
  testConnection: (config, password) => client.post('/api/session/test-connection', { config, password }),
  testScrollTarget: (config, password) =>
    client.post('/api/session/test-scroll-target', { config, password }),
  startSession: (config, password) => client.post('/api/session/start', { config, password }),
  getSessionStatus: (sessionId) => client.get(`/api/session/${sessionId}/status`),
  stopSession: (sessionId) => client.post(`/api/session/${sessionId}/stop`),
};

export const resultsAPI = {
  listSessions: () => client.get('/api/results/sessions'),
  getMetadata: (sessionId) => client.get(`/api/results/${sessionId}/metadata`),
  getSummary: (sessionId) => client.get(`/api/results/${sessionId}/summary`),
  getReservations: (sessionId) => client.get(`/api/results/${sessionId}/reservations`),
  searchResponses: (sessionId, query, limit = 200, excludeNoise = false) =>
    client.get(`/api/results/${sessionId}/search`, {
      params: { q: query, limit, excludeNoise },
    }),
  getResponse: (sessionId, filename) =>
    client.get(`/api/results/${sessionId}/responses/${filename}`),
};

export const streamLogs = (onMessage, onError) => {
  const eventSource = new EventSource(`${API_URL}/api/logs/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('Error parsing log stream:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.error('EventSource error:', err);
    if (onError) onError(err);
  };

  return eventSource;
};

export default client;
