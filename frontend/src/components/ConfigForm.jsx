import React, { useState } from 'react';
import useStore from '../store/store';
import { sessionAPI, configAPI } from '../api/client';

export default function ConfigForm({ onSessionStart }) {
  const config = useStore((state) => state.config);
  const updateConfig = useStore((state) => state.updateConfig);

  const [testing, setTesting] = useState(false);
  const [testingScroll, setTestingScroll] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState(null);
  const [password, setPassword] = useState('');

  const handleChange = (field, value) => {
    updateConfig({ [field]: value });
  };

  const handleSave = async () => {
    try {
      await configAPI.saveConfig({ ...config, password: '' });
      setMessage({ type: 'success', text: 'Configuration saved!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to save: ${err.message}` });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const response = await sessionAPI.testConnection(config, password);
      const detail = response.data?.result?.method ? ` (${response.data.result.method})` : '';
      setMessage({ type: 'success', text: `✓ Connection successful${detail}!` });
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      setMessage({ type: 'error', text: `✗ Connection failed: ${detail}` });
    } finally {
      setTesting(false);
    }
  };

  const handleTestScroll = async () => {
    setTestingScroll(true);
    setMessage(null);
    try {
      const { data } = await sessionAPI.testScrollTarget(config, password);
      setMessage({
        type: 'success',
        text: `✓ Scroll target found! ScrollWidth: ${data.scrollInfo.scrollWidth}, ClientWidth: ${data.scrollInfo.clientWidth}`,
      });
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      setMessage({ type: 'error', text: `✗ Scroll target failed: ${detail}` });
    } finally {
      setTestingScroll(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    setMessage(null);
    try {
      const result = await sessionAPI.startSession(config, password);
      onSessionStart(result.data.sessionId);
    } catch (err) {
      const detail = err.response?.data?.error || err.message;
      setMessage({ type: 'error', text: `✗ Failed to start session: ${detail}` });
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-900/30 text-green-300 border border-green-500/50'
              : 'bg-red-900/30 text-red-300 border border-red-500/50'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* URL Section */}
      <div>
        <label className="block text-sm font-medium text-purple-300 mb-2">Website URL *</label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={(e) => handleChange('baseUrl', e.target.value)}
          placeholder="https://example.com"
          className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-purple-400"
        />
      </div>

      {/* Credentials Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">Username / Email</label>
          <input
            type="text"
            value={config.username}
            onChange={(e) => handleChange('username', e.target.value)}
            placeholder="user@example.com"
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-purple-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-purple-400"
          />
          <p className="text-xs text-slate-400 mt-1">
            {config.persistSession
              ? 'Not saved. Usually needed only once to create or refresh the persisted session.'
              : 'Not saved, entered only when starting session.'}
          </p>
        </div>
      </div>

      {/* Scroll Section */}
      <div>
        <label className="block text-sm font-medium text-purple-300 mb-2">Scroll Zone Selector (CSS class) *</label>
        <input
          type="text"
          value={config.scrollSelector}
          onChange={(e) => handleChange('scrollSelector', e.target.value)}
          placeholder=".carousel, .products-carousel"
          className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-purple-400"
        />
      </div>

      {/* Scroll Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-purple-300 mb-1">Scroll Count</label>
          <input
            type="number"
            min="1"
            value={config.scrollCount}
            onChange={(e) => handleChange('scrollCount', parseInt(e.target.value))}
            className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-purple-300 mb-1">Distance (px)</label>
          <input
            type="number"
            min="1"
            value={config.scrollDistance}
            onChange={(e) => handleChange('scrollDistance', parseInt(e.target.value))}
            className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-purple-300 mb-1">Delay (ms)</label>
          <input
            type="number"
            min="0"
            value={config.scrollDelay}
            onChange={(e) => handleChange('scrollDelay', parseInt(e.target.value))}
            className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-purple-300 mb-1">Wait Before (ms)</label>
          <input
            type="number"
            min="0"
            value={config.waitBeforeScroll}
            onChange={(e) => handleChange('waitBeforeScroll', parseInt(e.target.value))}
            className="w-full px-2 py-1 bg-slate-700 text-white rounded border border-slate-600 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        Distance and delay are used as baselines. Each automatic scroll applies a small random
        variation to feel less mechanical.
      </p>

      {config.manualScrollMode && (
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">
            Manual Scroll Duration (ms)
          </label>
          <input
            type="number"
            min="0"
            value={config.manualScrollDuration}
            onChange={(e) => handleChange('manualScrollDuration', parseInt(e.target.value))}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 placeholder-slate-400 focus:outline-none focus:border-purple-400"
          />
          <p className="text-xs text-slate-400 mt-1">
            During this time, the browser stays open and you can scroll manually while requests are
            captured.
          </p>
        </div>
      )}

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-2">Output Folder</label>
          <input
            type="text"
            value={config.outputFolder}
            onChange={(e) => handleChange('outputFolder', e.target.value)}
            placeholder="/Users/username/pump_output"
            className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 placeholder-slate-400 text-sm focus:outline-none focus:border-purple-400"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enableHAR || false}
              onChange={(e) => handleChange('enableHAR', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-purple-300 text-sm">Enable HAR Export</span>
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-700">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-medium"
        >
          💾 Save Configuration
        </button>

        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition font-medium"
        >
          {testing ? 'Testing...' : '🔗 Test Connection'}
        </button>

        <button
          onClick={handleTestScroll}
          disabled={testingScroll}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition font-medium"
        >
          {testingScroll ? 'Testing...' : '↔️ Test Scroll Zone'}
        </button>

        <button
          onClick={handleStart}
          disabled={starting || !config.baseUrl || !config.scrollSelector}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition font-medium ml-auto"
        >
          {starting ? 'Starting...' : '🚀 Launch Session'}
        </button>
      </div>
    </div>
  );
}
