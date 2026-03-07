import { useEffect, useState } from 'react';
import { streamLogs } from '../api/client';

export const useLogs = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const es = streamLogs(
      (data) => {
        if (data.type === 'ping') {
          return;
        }
        setLogs((prev) => [...prev.slice(-499), data]);
      },
      (err) => {
        console.error('Log stream error:', err);
      }
    );

    return () => {
      if (es) {
        es.close();
      }
    };
  }, []);

  const clearLogs = () => setLogs([]);

  return { logs, clearLogs };
};

export default useLogs;
