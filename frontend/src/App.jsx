import React, { useState } from 'react';
import ConfigPage from './pages/ConfigPage';
import SessionPage from './pages/SessionPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('config');
  const [sessionId, setSessionId] = useState(null);

  const handleSessionStart = (id) => {
    setSessionId(id);
    setCurrentPage('session');
  };

  const handleBackToConfig = () => {
    setCurrentPage('config');
    setSessionId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto p-4 max-w-6xl">
        {currentPage === 'config' ? (
          <ConfigPage onSessionStart={handleSessionStart} />
        ) : (
          <SessionPage sessionId={sessionId} onBack={handleBackToConfig} />
        )}
      </div>
    </div>
  );
}
