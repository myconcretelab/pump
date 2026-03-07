import { useEffect, useState, useRef } from 'react';
import { sessionAPI } from '../api/client';

export const useSession = (sessionId) => {
  const [status, setStatus] = useState('starting');
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;

    const pollStatus = async () => {
      try {
        const response = await sessionAPI.getSessionStatus(sessionId);
        const data = response.data;

        setStatus(data.status);
        setSessionData({
          duration: data.duration,
          errors: data.errors,
          results: data.results,
        });

        if (['completed', 'failed', 'stopped'].includes(data.status)) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to get session status:', err);
        setStatus('error');
        setLoading(false);
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [sessionId]);

  return { status, sessionData, loading };
};

export default useSession;
