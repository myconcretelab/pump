import React from 'react';

export default function ProgressBar({ status, sessionData }) {
  const getStatusInfo = () => {
    switch (status) {
      case 'starting':
        return {
          label: 'Initializing',
          color: 'bg-blue-500',
          progress: 10,
          icon: '🚀',
        };
      case 'running':
        return {
          label: 'Running',
          color: 'bg-yellow-500',
          progress: 50,
          icon: '⚙️',
        };
      case 'completed':
        return {
          label: 'Completed',
          color: 'bg-green-500',
          progress: 100,
          icon: '✓',
        };
      case 'failed':
        return {
          label: 'Failed',
          color: 'bg-red-500',
          progress: 100,
          icon: '✗',
        };
      case 'stopped':
        return {
          label: 'Stopped',
          color: 'bg-orange-500',
          progress: 50,
          icon: '⊗',
        };
      case 'stopping':
        return {
          label: 'Stopping',
          color: 'bg-orange-400',
          progress: 60,
          icon: '⊘',
        };
      case 'error':
        return {
          label: 'Error',
          color: 'bg-red-500',
          progress: 100,
          icon: '!',
        };
      default:
        return {
          label: 'Starting',
          color: 'bg-purple-500',
          progress: 5,
          icon: '...',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="bg-slate-800 rounded-lg shadow-2xl border border-purple-500/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{statusInfo.icon}</span>
          <div>
            <h3 className="text-white font-bold">{statusInfo.label}</h3>
            {sessionData && (
              <p className="text-slate-400 text-sm">
                Duration: {Math.round(sessionData.duration / 1000)}s
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          {sessionData && (
            <div className="text-sm">
              <p className="text-slate-300">
                Total Requests:{' '}
                <span className="font-bold text-purple-300">
                  {sessionData.results?.totalRequests || 0}
                </span>
              </p>
              <p className="text-slate-300">
                Responses Saved:{' '}
                <span className="font-bold text-green-300">
                  {sessionData.results?.savedResponses || 0}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${statusInfo.color}`}
          style={{ width: `${statusInfo.progress}%` }}
        />
      </div>

      {/* Error Messages */}
      {sessionData && sessionData.errors && sessionData.errors.length > 0 && (
        <div className="mt-4 space-y-2">
          {sessionData.errors.map((err, idx) => (
            <div
              key={idx}
              className="text-sm text-red-300 bg-red-900/20 border border-red-500/30 rounded p-2"
            >
              {err.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
