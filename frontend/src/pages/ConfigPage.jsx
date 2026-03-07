import React, { useState } from 'react';
import useStore from '../store/store';
import ConfigForm from '../components/ConfigForm';
import FilterRules from '../components/FilterRules';
import useConfig from '../hooks/useConfig';

export default function ConfigPage({ onSessionStart }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { loading, error } = useConfig();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🚀 Pump</h1>
        <p className="text-purple-300">Web Automation & API Capture Tool</p>
      </div>

      {/* Main Config Form */}
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-purple-500/30 p-8">
        {loading && <p className="text-sm text-slate-300 mb-4">Loading saved configuration...</p>}
        {error && <p className="text-sm text-red-300 mb-4">Failed to load saved configuration: {error}</p>}
        <ConfigForm onSessionStart={onSessionStart} />
      </div>

      {/* Advanced Settings Toggle */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
        >
          {showAdvanced ? '✕ Hide Advanced' : '⚙️ Advanced Settings'}
        </button>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
        >
          {showFilters ? '✕ Hide Filters' : '🔍 Filter Rules'}
        </button>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="bg-slate-800 rounded-lg shadow-2xl border border-purple-500/30 p-8">
          <h2 className="text-xl font-bold text-white mb-6">Advanced Settings</h2>
          <AdvancedSettings />
        </div>
      )}

      {/* Filter Rules */}
      {showFilters && (
        <div className="bg-slate-800 rounded-lg shadow-2xl border border-purple-500/30 p-8">
          <FilterRules />
        </div>
      )}
    </div>
  );
}

function AdvancedSettings() {
  const config = useStore((state) => state.config);
  const updateConfig = useStore((state) => state.updateConfig);
  const selectors = config.advancedSelectors || {};

  const updateSelector = (field, value) =>
    updateConfig({
      advancedSelectors: {
        ...selectors,
        [field]: value,
      },
    });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-purple-300 mb-1">
          Login Strategy
        </label>
        <select
          value={config.loginStrategy || 'simple'}
          onChange={(e) => updateConfig({ loginStrategy: e.target.value })}
          className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
        >
          <option value="simple">Simple (username/password)</option>
          <option value="multi-step">Multi-step</option>
        </select>
        <p className="text-xs text-slate-400 mt-2">
          Use `multi-step` for flows like Airbnb: `Continue with email`, then email, then
          continue, then password.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-3 text-sm font-medium text-purple-300">
          <input
            type="checkbox"
            checked={config.hasOTP || false}
            onChange={(e) => updateConfig({ hasOTP: e.target.checked })}
            className="w-4 h-4"
          />
          <span>Has OTP/2FA</span>
        </label>
        <p className="text-xs text-slate-400 mt-2">
          Keep the browser open after password submit and wait for SMS / email verification.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-3 text-sm font-medium text-purple-300">
          <input
            type="checkbox"
            checked={config.persistSession !== false}
            onChange={(e) => updateConfig({ persistSession: e.target.checked })}
            className="w-4 h-4"
          />
          <span>Reuse Persisted Session</span>
        </label>
        <p className="text-xs text-slate-400 mt-2">
          Save and reuse Playwright session cookies/local storage to avoid logging in every run.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-3 text-sm font-medium text-purple-300">
          <input
            type="checkbox"
            checked={config.manualScrollMode || false}
            onChange={(e) => updateConfig({ manualScrollMode: e.target.checked })}
            className="w-4 h-4"
          />
          <span>Manual Scroll Mode</span>
        </label>
        <p className="text-xs text-slate-400 mt-2">
          Skip automatic scrolling and keep the browser open so you can scroll manually while Pump
          captures requests.
        </p>
      </div>

      {config.manualScrollMode && (
        <div>
          <label className="block text-sm font-medium text-purple-300 mb-1">
            Manual Scroll Duration (ms)
          </label>
          <input
            type="number"
            min="0"
            value={config.manualScrollDuration || 20000}
            onChange={(e) => updateConfig({ manualScrollDuration: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
          />
          <p className="text-xs text-slate-400 mt-2">
            Example: `20000` leaves 20 seconds for manual scrolling before the session finalizes.
          </p>
        </div>
      )}

      <div className="pt-2 border-t border-slate-700">
        <h3 className="text-sm font-semibold text-white mb-3">Login Selectors</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-purple-300 mb-1">
              Email-First Button Selector
            </label>
            <input
              type="text"
              value={selectors.emailFirstButton || ''}
              onChange={(e) => updateSelector('emailFirstButton', e.target.value)}
              placeholder='button:has-text("Continuer avec un email")'
              className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
            />
            <p className="text-xs text-slate-400 mt-2">
              First screen button that opens the email login flow.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-300 mb-1">
              Username / Email Input Selector
            </label>
            <input
              type="text"
              value={selectors.usernameInput || ''}
              onChange={(e) => updateSelector('usernameInput', e.target.value)}
              placeholder="input[type='email']"
              className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-300 mb-1">
              Continue After Email Selector
            </label>
            <input
              type="text"
              value={selectors.continueAfterUsernameButton || ''}
              onChange={(e) => updateSelector('continueAfterUsernameButton', e.target.value)}
              placeholder='button:has-text("Continuer")'
              className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
            />
            <p className="text-xs text-slate-400 mt-2">
              Button clicked after entering the email to reveal the password step.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-300 mb-1">
              Password Input Selector
            </label>
            <input
              type="text"
              value={selectors.passwordInput || ''}
              onChange={(e) => updateSelector('passwordInput', e.target.value)}
              placeholder="input[type='password']"
              className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-300 mb-1">
              Final Submit Selector
            </label>
            <input
              type="text"
              value={selectors.finalSubmitButton || selectors.submitButton || ''}
              onChange={(e) => updateSelector('finalSubmitButton', e.target.value)}
              placeholder='button:has-text("Connexion")'
              className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
            />
            <p className="text-xs text-slate-400 mt-2">
              Final button used after the password step.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-300 mb-1">
              Generic Submit Selector
            </label>
            <input
              type="text"
              value={selectors.submitButton || ''}
              onChange={(e) => updateSelector('submitButton', e.target.value)}
              placeholder="button[type='submit']"
              className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
            />
            <p className="text-xs text-slate-400 mt-2">
              Legacy fallback selector used when the specific step selectors are not enough.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
