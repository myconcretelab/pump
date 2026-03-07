import { useEffect, useState } from 'react';
import { configAPI } from '../api/client';
import useStore from '../store/store';

export const useConfig = () => {
  const config = useStore((state) => state.config);
  const setConfig = useStore((state) => state.setConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await configAPI.getConfig();
      setConfig(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      await configAPI.saveConfig(newConfig);
      setConfig(newConfig);
      return { success: true };
    } catch (err) {
      console.error('Failed to save config:', err);
      return { success: false, error: err.message };
    }
  };

  return { config, loading, error, saveConfig, reloadConfig: loadConfig };
};

export default useConfig;
