import React, { useState } from 'react';
import useStore from '../store/store';

const FILTER_TYPES = [
  { value: 'url-contains', label: 'URL Contains' },
  { value: 'url-starts-with', label: 'URL Starts With' },
  { value: 'method', label: 'HTTP Method' },
  { value: 'content-type', label: 'Content Type' },
  { value: 'status-code', label: 'Status Code' },
  { value: 'status-range', label: 'Status Range (e.g. 200-299)' },
  { value: 'response-contains', label: 'Response Contains' },
  { value: 'json-only', label: 'JSON Only' },
  { value: 'exclude-assets', label: 'Exclude Assets (CSS, Images, etc)' },
  { value: 'exclude-tracking', label: 'Exclude Tracking' },
];

export default function FilterRules() {
  const config = useStore((state) => state.config);
  const updateFilterRules = useStore((state) => state.updateFilterRules);

  const [newInclusiveType, setNewInclusiveType] = useState('url-contains');
  const [newInclusivePattern, setNewInclusivePattern] = useState('');
  const [newExclusiveType, setNewExclusiveType] = useState('exclude-assets');
  const [newExclusivePattern, setNewExclusivePattern] = useState('');

  const addInclusiveRule = () => {
    if (!newInclusivePattern && !['json-only', 'exclude-assets', 'exclude-tracking'].includes(newInclusiveType)) {
      alert('Pattern is required');
      return;
    }

    const rules = {
      ...config.filterRules,
      inclusive: [
        ...config.filterRules.inclusive,
        {
          type: newInclusiveType,
          pattern: newInclusivePattern,
          negate: false,
        },
      ],
    };

    updateFilterRules(rules);
    setNewInclusivePattern('');
  };

  const addExclusiveRule = () => {
    if (!newExclusivePattern && !['json-only', 'exclude-assets', 'exclude-tracking'].includes(newExclusiveType)) {
      alert('Pattern is required');
      return;
    }

    const rules = {
      ...config.filterRules,
      exclusive: [
        ...config.filterRules.exclusive,
        {
          type: newExclusiveType,
          pattern: newExclusivePattern,
          negate: false,
        },
      ],
    };

    updateFilterRules(rules);
    setNewExclusivePattern('');
  };

  const removeInclusiveRule = (index) => {
    const rules = {
      ...config.filterRules,
      inclusive: config.filterRules.inclusive.filter((_, i) => i !== index),
    };
    updateFilterRules(rules);
  };

  const removeExclusiveRule = (index) => {
    const rules = {
      ...config.filterRules,
      exclusive: config.filterRules.exclusive.filter((_, i) => i !== index),
    };
    updateFilterRules(rules);
  };

  const clearAllRules = () => {
    updateFilterRules({ inclusive: [], exclusive: [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-300 text-sm">
          Define which API responses to keep. No rules = keep all responses.
        </p>
        {(config.filterRules.inclusive.length > 0 || config.filterRules.exclusive.length > 0) && (
          <button
            onClick={clearAllRules}
            className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Inclusive Rules */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">✓ Keep (Inclusive Rules)</h3>

        <div className="bg-slate-700 rounded-lg p-4 mb-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <select
                value={newInclusiveType}
                onChange={(e) => setNewInclusiveType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 text-sm"
              >
                {FILTER_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>

            {!['json-only', 'exclude-assets', 'exclude-tracking'].includes(newInclusiveType) && (
              <input
                type="text"
                value={newInclusivePattern}
                onChange={(e) => setNewInclusivePattern(e.target.value)}
                placeholder="Pattern/Value"
                className="px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 text-sm"
              />
            )}

            <button
              onClick={addInclusiveRule}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition font-medium text-sm"
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {config.filterRules.inclusive.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No inclusive rules (all responses allowed by default)</p>
          ) : (
            config.filterRules.inclusive.map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-700 p-3 rounded">
                <span className="text-sm text-slate-300">
                  <strong>{FILTER_TYPES.find((ft) => ft.value === rule.type)?.label}</strong>:
                  {rule.pattern && ` "${rule.pattern}"`}
                </span>
                <button
                  onClick={() => removeInclusiveRule(idx)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  ✕ Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Exclusive Rules */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">✗ Exclude (Exclusive Rules)</h3>

        <div className="bg-slate-700 rounded-lg p-4 mb-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <select
                value={newExclusiveType}
                onChange={(e) => setNewExclusiveType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 text-sm"
              >
                {FILTER_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>
                    {ft.label}
                  </option>
                ))}
              </select>
            </div>

            {!['json-only', 'exclude-assets', 'exclude-tracking'].includes(newExclusiveType) && (
              <input
                type="text"
                value={newExclusivePattern}
                onChange={(e) => setNewExclusivePattern(e.target.value)}
                placeholder="Pattern/Value"
                className="px-3 py-2 bg-slate-600 text-white rounded border border-slate-500 text-sm"
              />
            )}

            <button
              onClick={addExclusiveRule}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition font-medium text-sm"
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {config.filterRules.exclusive.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No exclusive rules</p>
          ) : (
            config.filterRules.exclusive.map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-700 p-3 rounded">
                <span className="text-sm text-slate-300">
                  <strong>{FILTER_TYPES.find((ft) => ft.value === rule.type)?.label}</strong>:
                  {rule.pattern && ` "${rule.pattern}"`}
                </span>
                <button
                  onClick={() => removeExclusiveRule(idx)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  ✕ Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
        <p className="text-sm text-slate-300 mb-3 font-medium">Quick Presets:</p>
        <button
          onClick={() => {
            updateFilterRules({
              inclusive: [
                { type: 'content-type', pattern: 'application/json', negate: false },
                { type: 'exclude-tracking', pattern: '', negate: false },
              ],
              exclusive: [
                { type: 'url-contains', pattern: 'analytics', negate: false },
              ],
            });
          }}
          className="text-sm px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded transition mr-2"
        >
          JSON + No Analytics
        </button>
        <button
          onClick={() => {
            updateFilterRules({
              inclusive: [{ type: 'url-contains', pattern: '/api/', negate: false }],
              exclusive: [],
            });
          }}
          className="text-sm px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded transition"
        >
          /api/ Only
        </button>
      </div>
    </div>
  );
}
