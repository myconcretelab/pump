import React, { useState } from 'react';
import { getStoredApiKey, setStoredApiKey } from '../api/auth';

export default function ApiKeySettings({ onSaved = null }) {
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setStoredApiKey(apiKey);
    setMessage(apiKey.trim() ? 'API key saved in this browser.' : 'API key cleared from this browser.');

    if (onSaved) {
      await onSaved();
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-amber-200">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Required only if PUMP_API_KEY is configured on the backend"
            className="w-full rounded-lg border border-amber-300/20 bg-slate-900 px-4 py-2 text-white placeholder-slate-500 focus:border-amber-300 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSave}
          className="rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-950 transition hover:bg-amber-400"
        >
          Save API Key
        </button>
      </div>

      <p className="mt-2 text-xs text-amber-100/80">
        The key is stored only in this browser and sent on API requests. Leave it empty for local
        development without backend protection.
      </p>

      {message && <p className="mt-2 text-xs text-emerald-300">{message}</p>}
    </div>
  );
}
