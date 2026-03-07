import React, { useState } from 'react';
import useSession from '../hooks/useSession';
import useLogs from '../hooks/useLogs';
import LogViewer from '../components/LogViewer';
import ResultsPanel from '../components/ResultsPanel';
import ProgressBar from '../components/ProgressBar';

export default function SessionPage({ sessionId, onBack }) {
  const { status, sessionData, loading } = useSession(sessionId);
  const { logs } = useLogs();
  const [logsOpen, setLogsOpen] = useState(false);
  const statusInfo = getSessionStatusInfo(status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">{statusInfo.title}</h1>
          <p className="text-purple-300 text-sm">
            Session ID: <code className="bg-slate-700 px-2 py-1 rounded">{sessionId}</code>
          </p>
          <p className="text-slate-400 text-sm mt-1">{statusInfo.subtitle}</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
        >
          ← Back to Config
        </button>
      </div>

      {/* Progress */}
      <ProgressBar status={status} sessionData={sessionData} />

      <div className="bg-slate-800 rounded-lg shadow-2xl border border-purple-500/30 p-6 overflow-hidden">
        <h2 className="text-xl font-bold text-white mb-4">📊 Results</h2>
        {loading ? (
          <div className="text-purple-300 text-sm">Session in progress...</div>
        ) : (
          <ResultsPanel sessionId={sessionId} sessionData={sessionData} status={status} />
        )}
      </div>

      <div className="bg-slate-800 rounded-lg shadow-2xl border border-purple-500/30 overflow-hidden">
        <button
          onClick={() => setLogsOpen((current) => !current)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-slate-700/60"
        >
          <span className="text-lg font-bold text-white">📋 Live Logs</span>
          <span className="text-sm text-slate-300">{logsOpen ? 'Hide' : 'Show'}</span>
        </button>

        {logsOpen && (
          <div className="border-t border-slate-700 px-6 py-6">
            <LogViewer logs={logs} />
          </div>
        )}
      </div>
    </div>
  );
}

function getSessionStatusInfo(status) {
  switch (status) {
    case 'completed':
      return {
        title: 'Session Completed',
        subtitle: 'Capture and scrolling finished successfully.',
      };
    case 'failed':
      return {
        title: 'Session Failed',
        subtitle: 'The run stopped with an error. Partial results may still be available.',
      };
    case 'stopped':
      return {
        title: 'Session Stopped',
        subtitle: 'The run was stopped before completion.',
      };
    case 'stopping':
      return {
        title: 'Stopping Session',
        subtitle: 'Waiting for the browser and capture pipeline to shut down.',
      };
    case 'running':
      return {
        title: 'Session in Progress',
        subtitle: 'The browser is active and Pump is capturing responses.',
      };
    case 'error':
      return {
        title: 'Session Error',
        subtitle: 'The UI could not retrieve the current session state.',
      };
    default:
      return {
        title: 'Starting Session',
        subtitle: 'Pump is initializing the browser and loading the target page.',
      };
  }
}
