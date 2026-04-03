import React, { useState, useEffect } from 'react';
import realtimeService from '../../services/realtimeService';
import { useAppContext } from '../../context/AppContext';
import DashboardSelectorModal from './DashboardSelectorModal';

// Simple DemoLogin that also dispatches LOGIN_SUCCESS into AppContext

const DemoLogin: React.FC = () => {
  const [url, setUrl] = useState<string>('ws://localhost:8081');
  const [username, setUsername] = useState<string>('demo');
  const [password, setPassword] = useState<string>('demo');
  const [role, setRole] = useState<string>('FAMILY');
  const [connected, setConnected] = useState(false);
  const { dispatch } = useAppContext();
  const [devMode, setDevMode] = useState(false);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    // initialize from service state
    setConnected(realtimeService.isConnected());
    const unsub = realtimeService.onStatusChange((c) => setConnected(c));
    return () => unsub();
  }, []);

  const handleConnect = () => {
    try {
      // make it available globally so AppContext picks it up
      (window as any).__DEMO_REALTIME_URL = url;
    realtimeService.connect(url);
    realtimeService.login(username, password, 'demo', role as any);
      setConnected(true);
      // Dispatch a local login success for demo purposes
  dispatch({ type: 'LOGIN_SUCCESS', payload: { username, role } });
  // Instead of auto-switching the view, show the dashboard selector so the user
  // can pick which dashboard to open on this device.
  setShowSelector(true);
    } catch (e) {
      console.error('Failed to connect to demo server', e);
      setConnected(false);
    }
  };

  const handleDisconnect = () => {
    realtimeService.disconnect();
    setConnected(false);
    (window as any).__DEMO_REALTIME_URL = undefined;
    dispatch({ type: 'LOGOUT' });
  };

  const toggleDevMode = () => {
    const next = !devMode;
    setDevMode(next);
    dispatch({ type: 'SET_DEV_MODE', payload: next });
  };

  return (
    <div className="relative p-3 glass-card rounded-xl">
      <div className="flex gap-2 items-center">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-[#C9B896]' : 'bg-[#E07A7A]'}`} title={connected ? 'Connected' : 'Disconnected'} />
        <input className="px-3 py-2 bg-[rgba(45,36,56,0.5)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#F5F0E8] placeholder-[#7A7582] text-sm focus:outline-none focus:border-[rgba(184,169,201,0.3)]" value={url} onChange={e => setUrl(e.target.value)} placeholder="ws://server:8081" />
        <input className="px-3 py-2 bg-[rgba(45,36,56,0.5)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#F5F0E8] placeholder-[#7A7582] text-sm focus:outline-none focus:border-[rgba(184,169,201,0.3)]" value={username} onChange={e => setUsername(e.target.value)} placeholder="username" />
        <select className="px-3 py-2 bg-[rgba(45,36,56,0.5)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#F5F0E8] text-sm focus:outline-none focus:border-[rgba(184,169,201,0.3)]" value={role} onChange={e => setRole(e.target.value)}>
          <option value="PATIENT">Patient</option>
          <option value="CAREGIVER">Caregiver</option>
          <option value="FAMILY">Family</option>
        </select>
        <input className="px-3 py-2 bg-[rgba(45,36,56,0.5)] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#F5F0E8] placeholder-[#7A7582] text-sm focus:outline-none focus:border-[rgba(184,169,201,0.3)]" value={password} onChange={e => setPassword(e.target.value)} placeholder="password" />
        {!connected ? (
          <button className="px-4 py-2 bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white font-medium rounded-lg text-sm touch-feedback" onClick={handleConnect}>Connect</button>
        ) : (
          <button className="px-4 py-2 bg-gradient-to-br from-[#E07A7A] to-[#C87070] text-white font-medium rounded-lg text-sm touch-feedback" onClick={handleDisconnect}>Disconnect</button>
        )}
      </div>
      <button onClick={toggleDevMode} className="absolute top-2 right-2 text-xs px-3 py-1.5 rounded-lg glass-card text-[#A8A0B4] touch-feedback">Dev</button>
      {showSelector && <DashboardSelectorModal onClose={() => setShowSelector(false)} />}
    </div>
  );
};

export default DemoLogin;
