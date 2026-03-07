import React, { useEffect, useRef } from 'react';

export default function LogViewer({ logs }) {
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-96 overflow-y-auto bg-slate-900 rounded-lg border border-slate-700 p-3 space-y-1 font-mono text-xs"
    >
      {logs.length === 0 ? (
        <div className="text-slate-500">Waiting for logs...</div>
      ) : (
        logs.map((log, idx) => (
          <div
            key={idx}
            className={`${getLogColor(log.type, log.level)} whitespace-pre-wrap break-words`}
          >
            {formatLogEntry(log)}
          </div>
        ))
      )}
    </div>
  );
}

function getLogColor(type, level) {
  if (type === 'connected') return 'text-green-400';
  if (type === 'session-update') return 'text-blue-400';
  if (type === 'log') {
    if (level === 'ERROR') return 'text-red-400';
    if (level === 'WARN') return 'text-yellow-400';
    if (level === 'DEBUG') return 'text-slate-400';
    return 'text-slate-300';
  }
  return 'text-slate-300';
}

function formatLogEntry(log) {
  const time = new Date(log.timestamp).toLocaleTimeString();

  if (log.type === 'connected') {
    return `[${time}] ✓ Connected`;
  }

  if (log.type === 'session-update') {
    return `[${time}] [${log.sessionId}] ${log.status.toUpperCase()}`;
  }

  if (log.type === 'log') {
    let msg = `[${time}] ${log.level}: ${log.message}`;
    if (log.data) {
      msg += ` ${JSON.stringify(log.data)}`;
    }
    return msg;
  }

  if (log.type === 'ping') {
    return `[${time}] ping`;
  }

  return JSON.stringify(log);
}
