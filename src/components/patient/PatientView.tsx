// ReminderNotification removed: persistent ReminderBanner in App.tsx handles due reminders for Patient view
import React, { useState, useEffect, useRef } from 'react';
import PatientHome from './PatientHome';
import ARNavigation from './ARNavigation';
import AICompanion from './AICompanion';
import RemindersList from './RemindersList';
import CognitiveGames from './CognitiveGames';
import MemoryAlbumView from './MemoryAlbumView';
import VoiceMessages from './VoiceMessages';
import { PatientScreen } from '../../types';
import { useAppContext } from '../../context/AppContext';

const PatientView: React.FC = () => {
  const { dispatch } = useAppContext();
  const [screen, setScreen] = useState<PatientScreen>(PatientScreen.HOME);
  const lastFallAlertAtRef = useRef(0);
  const pendingFallWindowRef = useRef<{ confirmed: boolean } | null>(null);
  const pendingFallTimerRef = useRef<number | null>(null);

  // Fall Detection Logic
  useEffect(() => {
    const FALL_THRESHOLD = 25; // m/s^2
    const FALL_CONFIRMATION_THRESHOLD = 18; // m/s^2
    const FALL_CONFIRM_WINDOW_MS = 1200;
    const FALL_ALERT_COOLDOWN_MS = 45000;
    let lastReadingTime = Date.now();

    const clearPendingFallWindow = () => {
      if (pendingFallTimerRef.current) {
        window.clearTimeout(pendingFallTimerRef.current);
        pendingFallTimerRef.current = null;
      }
      pendingFallWindowRef.current = null;
    };

    const dispatchFallAlert = () => {
      const now = Date.now();
      if (now - lastFallAlertAtRef.current < FALL_ALERT_COOLDOWN_MS) return;
      lastFallAlertAtRef.current = now;
      dispatch({
        type: 'TRIGGER_SOS',
        payload: {
          id: new Date().toISOString(),
          message: 'Potential Fall Detected!',
          timestamp: new Date().toLocaleString(),
          type: 'FALL',
        },
      });
    };

    const handleMotionEvent = (event: DeviceMotionEvent) => {
      if (Date.now() - lastReadingTime < 100) return; // Throttle readings
      lastReadingTime = Date.now();

      const acc = event.accelerationIncludingGravity;
      if (acc && acc.x != null && acc.y != null && acc.z != null) {
        const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);

        if (magnitude > FALL_THRESHOLD && !pendingFallWindowRef.current) {
          pendingFallWindowRef.current = { confirmed: magnitude > FALL_THRESHOLD * 1.6 };
          pendingFallTimerRef.current = window.setTimeout(() => {
            const pending = pendingFallWindowRef.current;
            clearPendingFallWindow();
            if (pending?.confirmed) {
              dispatchFallAlert();
            }
          }, FALL_CONFIRM_WINDOW_MS);
          return;
        }

        if (pendingFallWindowRef.current && magnitude > FALL_CONFIRMATION_THRESHOLD) {
          pendingFallWindowRef.current.confirmed = true;
        }
      }
    };

    // Note: In a production app, iOS 13+ requires explicit user permission for motion events,
    // usually triggered by a button click. For this demo, we assume permission is granted.
    window.addEventListener('devicemotion', handleMotionEvent);

    return () => {
      window.removeEventListener('devicemotion', handleMotionEvent);
      clearPendingFallWindow();
    };
  }, [dispatch]);


  const renderScreen = () => {
    switch (screen) {
      case PatientScreen.HOME:
        return <PatientHome setScreen={setScreen} />;
      case PatientScreen.NAVIGATION:
        return <ARNavigation onBack={() => setScreen(PatientScreen.HOME)} />;
      case PatientScreen.AI_COMPANION:
        return <AICompanion onBack={() => setScreen(PatientScreen.HOME)} />;
      case PatientScreen.REMINDERS:
        return <RemindersList onBack={() => setScreen(PatientScreen.HOME)} />;
      case PatientScreen.COGNITIVE_GAMES:
        return <CognitiveGames onBack={() => setScreen(PatientScreen.HOME)} />;
      case PatientScreen.MEMORY_ALBUM:
        return <MemoryAlbumView onBack={() => setScreen(PatientScreen.HOME)} />;
      case PatientScreen.VOICE_MESSAGES:
        return <VoiceMessages onBack={() => setScreen(PatientScreen.HOME)} />;
      default:
        return <PatientHome setScreen={setScreen} />;
    }
  };

  return (
    <div className="w-full h-full max-w-[420px] mx-auto relative">
      {renderScreen()}
    </div>
  );
};

export default PatientView;
