import React, { useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getAIComfortingQuote, isGeminiConfigured, missingApiKeyError } from '../../services/geminiService';
import { Memory, SharedQuote, EventLogItem, VoiceMessage, SenderRole } from '../../types';
import PillIcon from '../icons/PillIcon';
import ForkKnifeIcon from '../icons/ForkKnifeIcon';
import GlassWaterIcon from '../icons/GlassWaterIcon';
import CompanionIcon from '../icons/CompanionIcon';
import FallIcon from '../icons/FallIcon';
import RemindersIcon from '../icons/RemindersIcon';
import ImageIcon from '../icons/ImageIcon';
import VoiceMessagePlayer from '../shared/VoiceMessagePlayer';
import VoiceRecorder from '../shared/VoiceRecorder';
import MusicIcon from '../icons/MusicIcon';
import UploadProgress from '../shared/UploadProgress';
import toastService from '../../services/toastService';

const isDev = import.meta.env.DEV;

const ReminderIcon: React.FC<{ icon: 'medication' | 'meal' | 'hydration' | 'music'; className?: string }> = ({ icon, className }) => {
  switch (icon) {
    case 'medication': return <PillIcon className={className} />;
    case 'meal': return <ForkKnifeIcon className={className} />;
    case 'hydration': return <GlassWaterIcon className={className} />;
    case 'music': return <MusicIcon className={className} />;
    default: return null;
  }
};

const EventIcon: React.FC<{ icon: EventLogItem['icon'] }> = ({ icon }) => {
  switch (icon) {
    case 'sos': return <span className="text-[#D45A5A]">🚨</span>;
    case 'fall': return <FallIcon className="w-4 h-4 text-[#D4A878]"/>;
    case 'emotion': return <CompanionIcon className="w-4 h-4 text-[#A495B8]"/>;
    case 'reminder': return <RemindersIcon className="w-4 h-4 text-[#B8A078]"/>;
    case 'task': return <RemindersIcon className="w-4 h-4 text-[#6A6280]"/>;
    case 'memory': return <ImageIcon className="w-4 h-4 text-[#C98B8B]"/>;
    default: return null;
  }
};

const FamilyView: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { reminders, alerts, eventLog, voiceMessages } = state;

  const [imageUrl, setImageUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [lastUploadName, setLastUploadName] = useState<string | null>(null);
  const [lastUploadVerified, setLastUploadVerified] = useState<boolean | null>(null);
  
  const [caption, setCaption] = useState('');
  const [sharedBy, setSharedBy] = useState('');
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [customThought, setCustomThought] = useState('');

  const unacknowledgedAlerts = alerts.filter(a => (a.type === 'SOS' || a.type === 'FALL') && a.requiresAcknowledgement);

  const handleAcknowledge = () => dispatch({ type: 'ACKNOWLEDGE_ALERTS' });

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption || !sharedBy) { toastService.show('Please fill out your name and a caption before sharing.', 'warning'); return; }
    if (!lastUploadName || lastUploadVerified !== true) {
      console.warn('[FamilyView] Attempted to submit before upload verification', { lastUploadName, lastUploadVerified, imageUrl });
      toastService.show('Image upload is not yet verified. Please wait until verification completes.', 'warning');
      return;
    }
    if (!imageUrl) { toastService.show('No image available to share. Please upload an image first.', 'warning'); return; }
    const newMemory: Memory = { id: new Date().toISOString(), imageUrl, caption, sharedBy };
    dispatch({ type: 'ADD_MEMORY', payload: newMemory });
    setCaption('');
    clearUpload();
  };

  const clearUpload = () => {
    try {
      if (imageUrl && imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageUrl);
      }
    } catch { /* ignore */ }
    setImageUrl('');
    setLastUploadName(null);
    setLastUploadVerified(null);
    setUploadProgress(null);
    setUploadToast(null);
    try { const inp = document.getElementById('family-image-input') as HTMLInputElement | null; if (inp) inp.value = ''; } catch { /* ignore */ }
  };

  const handleSendAIQuote = async () => {
    if (!isGeminiConfigured) { toastService.show(missingApiKeyError, 'error', 5000); return; }
    setIsSendingQuote(true);
    try {
      const quoteText = await getAIComfortingQuote();
      if (quoteText === missingApiKeyError) { toastService.show(quoteText, 'error', 5000); return; }
      const newQuote: SharedQuote = { id: new Date().toISOString(), text: quoteText, timestamp: new Date().toLocaleString() };
      dispatch({ type: 'ADD_QUOTE', payload: newQuote });
    } catch { toastService.show('Could not send a thought at this time.', 'error'); }
    finally { setIsSendingQuote(false); }
  };

  const handleSendCustomQuote = () => {
    if (!customThought.trim()) return;
    const newQuote: SharedQuote = { id: new Date().toISOString(), text: customThought.trim(), timestamp: new Date().toLocaleString() };
    dispatch({ type: 'ADD_QUOTE', payload: newQuote });
    setCustomThought('');
    toastService.show('Your thought has been sent!', 'success');
  };

  const handleNewVoiceMessage = (audioUrl: string, duration: number) => {
    const newMessage: VoiceMessage = {
      id: new Date().toISOString(),
      audioUrl,
      duration,
      senderRole: SenderRole.FAMILY,
      senderName: sharedBy.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    dispatch({ type: 'ADD_VOICE_MESSAGE', payload: newMessage });
  };

  return (
    <div className="relative space-y-4 p-4 pb-20 h-full overflow-y-auto">
      <header className="border-b border-[rgba(255,255,255,0.08)] pb-3">
        <h1 className="font-display text-[26px] font-semibold text-white">Family Dashboard</h1>
        <p className="text-[#B8B0C4] text-[14px] mt-1">Stay connected with your loved one</p>
      </header>

      {unacknowledgedAlerts.length > 0 && (
        <div className="p-4 bg-[rgba(212,90,90,0.2)] border-2 border-[#D45A5A] rounded-xl animate-pulse">
          <h2 className="text-[17px] font-semibold text-white text-center mb-3">URGENT ALERT RECEIVED</h2>
          <button onClick={handleAcknowledge} className="w-full py-3 bg-gradient-to-br from-[#D45A5A] to-[#B04848] text-white font-medium rounded-xl touch-feedback">
            Acknowledge & Silence Alarm
          </button>
        </div>
      )}

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Your Details</h2>
        <input
          type="text"
          placeholder="Your Name (e.g., Daughter, Jane)"
          value={sharedBy}
          onChange={e => setSharedBy(e.target.value)}
          className="w-full px-3 py-2.5 bg-[rgba(30,26,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-lg text-white placeholder-[#6A6280] focus:outline-none focus:border-[rgba(164,149,184,0.4)] text-[14px]"
        />
        <p className="text-[11px] text-[#6A6280] mt-1.5">Please fill this in to share memories or voice messages.</p>
      </div>

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Voice Messages</h2>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-3">
          {voiceMessages.map(msg => <VoiceMessagePlayer key={msg.id} message={msg} />)}
        </div>
        <div className='border-t border-[rgba(255,255,255,0.08)] pt-3'>
          <p className='text-[12px] text-[#6A6280] mb-2 text-center'>Send a voice note to your loved one</p>
          <VoiceRecorder onNewMessage={handleNewVoiceMessage} disabled={!sharedBy.trim()} />
        </div>
      </div>

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Share a Memory</h2>
        <form onSubmit={handleAddMemory} className="space-y-3">
          <div className="w-full">
            <div className="flex items-center justify-between">
              <div className="text-[12px] text-[#6A6280]">Upload an image to share</div>
              <button
                type="button"
                onClick={() => document.getElementById('family-image-input')?.click()}
                className="inline-flex items-center gap-2 px-3 py-1.5 glass-card text-white rounded-lg touch-feedback text-[12px]"
              >
                <ImageIcon className="w-4 h-4" /> Choose file
              </button>
            </div>
            <input
              id="family-image-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                if (isDev) console.debug('[FamilyView] file selected', { name: f.name, size: f.size, type: f.type });
                const demoUrl = (window as any).__DEMO_REALTIME_URL as string | undefined;
                if (demoUrl) {
                  try {
                    const httpBase = demoUrl.replace(/^wss?:\/\//, (m) => (m.startsWith('wss') ? 'https://' : 'http://'));
                    const uploadEndpoint = `${httpBase.replace(/\/$/, '')}/upload`;
                    const form = new FormData();
                    form.append('file', f, f.name);
                    await new Promise<void>((resolve) => {
                      const xhr = new XMLHttpRequest();
                      xhrRef.current = xhr;
                      xhr.open('POST', uploadEndpoint, true);
                      try { xhr.setRequestHeader('ngrok-skip-browser-warning', '1'); } catch { /* ignore */ }
                      xhr.onload = () => {
                        xhrRef.current = null;
                        if (xhr.status >= 200 && xhr.status < 300) {
                          try {
                            const body = JSON.parse(xhr.responseText || '{}');
                            const remoteUrl = body.url || '';
                            if (!remoteUrl) {
                              setImageUrl('');
                              setUploadToast('Upload returned no URL');
                              setTimeout(() => setUploadToast(null), 3000);
                              resolve();
                              return;
                            }
                            setLastUploadName(body.filename || null);
                            setLastUploadVerified(typeof body.verified === 'boolean' ? body.verified : null);
                            if (body.verified === true) {
                              setLastUploadVerified(true);
                              setImageUrl(remoteUrl);
                              setUploadToast('Upload complete');
                              setTimeout(() => setUploadToast(null), 2500);
                              resolve();
                            } else {
                              const verifier = new Image();
                              let verified = false;
                              const verifyTimeout = setTimeout(() => {
                                if (!verified) {
                                  setLastUploadVerified(false);
                                  setUploadToast('Upload succeeded but verification timed out');
                                  setTimeout(() => setUploadToast(null), 3500);
                                  resolve();
                                }
                              }, 5000);
                              verifier.onload = () => {
                                verified = true;
                                clearTimeout(verifyTimeout);
                                setLastUploadVerified(true);
                                setImageUrl(remoteUrl);
                                setUploadToast('Upload complete');
                                setTimeout(() => setUploadToast(null), 2500);
                                resolve();
                              };
                              verifier.onerror = () => {
                                verified = false;
                                clearTimeout(verifyTimeout);
                                setLastUploadVerified(false);
                                setUploadToast('Upload succeeded but remote image unreachable');
                                setTimeout(() => setUploadToast(null), 4000);
                                resolve();
                              };
                              verifier.src = remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + 'ts=' + Date.now();
                            }
                          } catch { resolve(); }
                        } else if (xhr.status === 413) {
                          setImageUrl('');
                          setUploadToast('File too large (max 5MB)');
                          setTimeout(() => setUploadToast(null), 3000);
                          resolve();
                        } else if (xhr.status === 415) {
                          setImageUrl('');
                          setUploadToast('Unsupported file type');
                          setTimeout(() => setUploadToast(null), 3000);
                          resolve();
                        } else {
                          setImageUrl('');
                          setUploadToast('Upload failed');
                          setTimeout(() => setUploadToast(null), 2500);
                          resolve();
                        }
                      };
                      xhr.onerror = () => {
                        xhrRef.current = null;
                        setImageUrl('');
                        setUploadToast('Upload error');
                        setTimeout(() => setUploadToast(null), 2500);
                        resolve();
                      };
                      xhr.upload.onprogress = (ev) => {
                        if (ev.lengthComputable) {
                          setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
                        }
                      };
                      xhr.onloadend = () => {
                        setUploadProgress(null);
                        xhrRef.current = null;
                      };
                      xhr.send(form);
                    });
                    try { e.currentTarget.value = ''; } catch { /* ignore */ }
                    return;
                  } catch { /* fallback */ }
                }
                setImageUrl(URL.createObjectURL(f));
                try { e.currentTarget.value = ''; } catch { /* ignore */ }
              }}
            />
          </div>

          <div>
            {imageUrl ? (
              <div className="w-full rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)]">
                <img src={imageUrl} alt="preview" className="w-full object-cover" />
              </div>
            ) : (
              <div className="text-[12px] text-[#6A6280]">No image chosen yet.</div>
            )}
            {lastUploadName && (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[#B8B0C4] flex-wrap">
                <div className="truncate px-2 py-1 glass-card rounded-lg max-w-[50%]">File: {lastUploadName}</div>
                <div className={`px-2 py-1 rounded-lg ${lastUploadVerified ? 'bg-[rgba(184,160,120,0.25)] text-[#B8A078]' : 'bg-[rgba(212,168,120,0.25)] text-[#D4A878]'}`}>{lastUploadVerified ? 'verified' : 'unverified'}</div>
                <button type="button" onClick={clearUpload} title="Clear upload" className="w-6 h-6 flex items-center justify-center glass-card text-[#B8B0C4] rounded-full text-xs touch-feedback">✕</button>
              </div>
            )}
          </div>

          <UploadProgress progress={uploadProgress} message={uploadToast} onCancel={() => {
            if (xhrRef.current) {
              try { xhrRef.current.abort(); } catch { /* ignore */ }
              xhrRef.current = null;
              setUploadProgress(null);
              setUploadToast('Upload cancelled');
              setTimeout(() => setUploadToast(null), 2000);
            }
          }} />

          <textarea
            placeholder="Caption for the memory"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 bg-[rgba(30,26,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-lg text-white placeholder-[#6A6280] focus:outline-none focus:border-[rgba(164,149,184,0.4)] resize-none text-[14px]"
          />
          <button
            type="submit"
            disabled={!sharedBy.trim() || lastUploadVerified !== true}
            className="w-full py-2.5 bg-gradient-to-br from-[#A495B8] to-[#8A7A9A] text-white font-medium rounded-xl touch-feedback disabled:opacity-50 disabled:cursor-not-allowed text-[14px]"
          >
            Share Memory
          </button>
        </form>
      </div>

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Send a Comforting Thought</h2>
        <p className='text-[12px] text-[#6A6280] mb-3'>Send a short, positive message to your loved one's home screen.</p>
        <div className="space-y-3">
          <button
            onClick={handleSendAIQuote}
            disabled={isSendingQuote || !isGeminiConfigured}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-br from-[#C49868] to-[#A89060] text-white font-medium rounded-xl touch-feedback disabled:opacity-50 disabled:cursor-not-allowed text-[14px]"
          >
            {isSendingQuote ? 'Generating...' : <> <MusicIcon className="w-4 h-4"/> Generate & Send Thought </>}
          </button>
          <div className="flex flex-col gap-2 border-t border-[rgba(255,255,255,0.08)] pt-3">
            <input
              type="text"
              placeholder="Or write a personal message..."
              value={customThought}
              onChange={(e) => setCustomThought(e.target.value)}
              className="w-full px-3 py-2.5 bg-[rgba(30,26,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-lg text-white placeholder-[#6A6280] focus:outline-none focus:border-[rgba(164,149,184,0.4)] text-[14px]"
            />
            <button
              onClick={handleSendCustomQuote}
              disabled={!customThought.trim()}
className="w-full py-2.5 bg-gradient-to-br from-[#8A7AA8] to-[#6A5A88] text-white font-medium rounded-xl touch-feedback disabled:opacity-50 disabled:cursor-not-allowed text-[14px]"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Patient Activity Timeline</h2>
        <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {eventLog.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(event => (
            <li key={event.id} className="text-[12px] text-[#B8B0C4] flex items-start gap-2">
              <div className='mt-0.5'><EventIcon icon={event.icon} /></div>
              <div>
                <p className="font-medium text-white">{event.text}</p>
                <p className='text-[11px] text-[#6A6280]'>{event.timestamp}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Patient's Daily Schedule</h2>
        {reminders.length > 0 ? (
          <ul className="space-y-2">
            {reminders.map(reminder => (
              <li key={reminder.id} className="p-2.5 rounded-xl glass-card flex items-center justify-between">
                <div className="flex items-center min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[rgba(164,149,184,0.35)] to-[rgba(138,122,154,0.25)] mr-3 flex-shrink-0">
                    <ReminderIcon icon={reminder.icon} className="w-5 h-5 text-[#B8B0C4]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white text-[14px] truncate">{reminder.title}</p>
                    <p className="text-[12px] text-[#6A6280]">{reminder.time}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-[10px] font-semibold rounded-full flex-shrink-0 ml-2 ${reminder.completed ? 'bg-[rgba(184,160,120,0.25)] text-[#B8A078]' : 'bg-[rgba(212,168,120,0.25)] text-[#D4A878]'}`}>
                  {reminder.completed ? 'COMPLETED' : 'PENDING'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#6A6280] text-center py-3 text-[13px]">No reminders scheduled for today.</p>
        )}
      </div>
    </div>
  );
};

export default FamilyView;
