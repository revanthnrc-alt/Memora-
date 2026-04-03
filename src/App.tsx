import React, { useState, useEffect, useRef } from 'react';
import PatientView from './components/patient/PatientView';
import CaregiverView from './components/caregiver/CaregiverView';
import FamilyView from './components/family/FamilyView';
import { ViewMode } from './types';
import { useAppContext } from './context/AppContext';
import soundService from './services/soundService';
import localNotifications from './services/localNotifications';
import LoginPage from './components/shared/LoginPage';
import DashboardSelectorModal from './components/shared/DashboardSelectorModal';
import AcknowledgeModal from './components/shared/AcknowledgeModal';
import ReminderBanner from './components/shared/ReminderBanner';
import ToastViewport from './components/shared/ToastViewport';
import toastService from './services/toastService';
import { getNextReminderTrigger, isReminderDue } from './utils/reminders';
import voskSpeechService from './services/voskSpeechService';

const App: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const viewMode = state.currentView || ViewMode.PATIENT;
  const currentViewRef = useRef(viewMode);
  const [voskDownloadProgress, setVoskDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    currentViewRef.current = state.currentView || ViewMode.PATIENT;
  }, [state.currentView]);

  useEffect(() => {
    const initVosk = async () => {
      if (!voskSpeechService.isNativePlatform()) {
        console.log('[App] Not native platform, skipping Vosk initialization');
        return;
      }

      console.log('[App] Initializing Vosk speech recognition...');
      
      try {
        const result = await voskSpeechService.initialize((progress) => {
          console.log('[App] Vosk download progress:', progress.progress + '%');
          setVoskDownloadProgress(progress.progress);
        });

        if (result.success) {
          console.log('[App] Vosk initialized successfully, model downloaded:', result.needsDownload);
          if (result.needsDownload) {
            toastService.show('Speech recognition ready!', 'success', 3000);
          }
        } else {
          console.error('[App] Vosk initialization failed:', result.error);
          toastService.show('Speech recognition unavailable: ' + result.error, 'warning', 5000);
        }
      } catch (error) {
        console.error('[App] Vosk initialization error:', error);
      } finally {
        setVoskDownloadProgress(null);
      }
    };

    initVosk();
  }, []);

  const realtimeDotClass = (user: any) => {
    if (state.devMode) return 'bg-yellow-400';
    return user ? 'bg-green-400' : 'bg-red-500';
  };

  // Effect to unlock audio on the first user interaction
  useEffect(() => {
    const unlockAudioPlayback = () => {
      soundService.unlock();
      // This handler should only run once.
      document.removeEventListener('click', unlockAudioPlayback);
      document.removeEventListener('touchstart', unlockAudioPlayback);
    };

    document.addEventListener('click', unlockAudioPlayback);
    document.addEventListener('touchstart', unlockAudioPlayback);

    return () => {
      document.removeEventListener('click', unlockAudioPlayback);
      document.removeEventListener('touchstart', unlockAudioPlayback);
    };
  }, []);

  // Expose a global helper so PatientHome can open the login modal without prop drilling
  // Expose a global helper so PatientHome can open the login modal without prop drilling
  // NOTE: this effect is defined after the `showLogin` state is declared further down to
  // avoid referencing the setter before it's initialized (which would cause a runtime crash).

  const [showDashboardSelector, setShowDashboardSelector] = useState(false);
  // Expose a global opener so login page can close and then open the selector (ensures selector is on top)
  useEffect(() => {
    (window as any).openDashboardSelector = () => setShowDashboardSelector(true);
    return () => { (window as any).openDashboardSelector = undefined; };
  }, []);

  // Centralized alert sound control: only play alerts for caregiver/family or when in devMode.
  useEffect(() => {
    const unack = state.alerts.filter(a => (a.type === 'SOS' || a.type === 'FALL') && a.requiresAcknowledgement);
    // Determine effective role used for alert audio. Make the master-switch (`state.currentView`)
    // authoritative for whether alerts should play. Only fall back to the logged-in user's role
    // when the view is the default PATIENT view. This ensures switching the dashboard via the
    // master switch immediately updates audio behaviour.
  // Use the currently selected dashboard view as the authoritative role for alert audio.
  // This ensures switching the dashboard to PATIENT immediately silences caregiver/family alerts.
  const loggedRole = state.currentUser?.role?.toUpperCase?.();
  const viewRole = state.currentView === 'CAREGIVER' ? 'CAREGIVER' : state.currentView === 'FAMILY' ? 'FAMILY' : 'PATIENT';
  const effectiveRole = viewRole; // view is authoritative
  const canHear = effectiveRole === 'CAREGIVER' || effectiveRole === 'FAMILY';

    if (!canHear) {
      soundService.stopSosAlert();
      soundService.stopFallAlert();
      return;
    }

    if (unack.length > 0) {
      if (unack.some(a => a.type === 'SOS')) {
        soundService.stopFallAlert();
        soundService.playSosAlert();
      } else if (unack.some(a => a.type === 'FALL')) {
        soundService.stopSosAlert();
        soundService.playFallAlert();
      }
    } else {
      soundService.stopSosAlert();
      soundService.stopFallAlert();
    }

    return () => {
      soundService.stopSosAlert();
      soundService.stopFallAlert();
    };
  }, [state.alerts, state.currentUser, state.devMode, state.currentView]);

  // Request notification permission when a user logs in.
  // Feature-specific permissions (camera/mic) are requested where they are actually used.
  useEffect(() => {
    if (state.currentUser) {
      // Request notification permission (web) and Local Notifications on native.
      (async () => {
        try {
          await localNotifications.requestPermission();
        } catch (e) {
          console.warn('Notification permission request failed', e);
        }
      })();
    }
  }, [state.currentUser]);

  // Global handler for native notification actions (registered by localNotifications)
  useEffect(() => {
    (window as any).__ON_NOTIFICATION_ACTION = ({ actionId, data }: any) => {
      try {
        const reminderId = data?.reminderId;
        if (!reminderId) return;
        
        if (actionId === 'COMPLETE') {
          dispatch({ type: 'COMPLETE_REMINDER', payload: reminderId });
          dispatch({ type: 'MARK_REMINDER_NOTIFIED', payload: reminderId });
          soundService.stopReminderAlert();
        } else if (actionId === 'SNOOZE') {
          const now = new Date();
          now.setMinutes(now.getMinutes() + 5);
          const hh = now.getHours().toString().padStart(2, '0');
          const mm = now.getMinutes().toString().padStart(2, '0');
          const newTime = `${hh}:${mm}`;
          dispatch({ 
            type: 'UPDATE_REMINDER', 
            payload: { 
              id: reminderId, 
              time: newTime, 
              notified: false, 
              completed: false 
            } 
          });
          soundService.stopReminderAlert();
        } else if (actionId === 'DISMISS') {
          dispatch({ type: 'MARK_REMINDER_NOTIFIED', payload: reminderId });
          soundService.stopReminderAlert();
        }
      } catch (e) {
        console.warn('Error handling notification action in app', e);
      }
    };
    return () => {
      (window as any).__ON_NOTIFICATION_ACTION = undefined;
      localNotifications.teardown().catch(() => { /* ignore */ });
    };
  }, [dispatch]);


  // Effect for checking reminders
  useEffect(() => {
    // Maintain a map of active timers so we can clear them on update/unmount
    const timers: Array<{ id: string; timerId: number }> = [];

    const scheduleForReminder = (reminder: any) => {
      if (reminder.completed || reminder.notified) return;
      try {
        const target = getNextReminderTrigger(reminder.time);
        if (!target) return;
        const ms = target.getTime() - Date.now();
        const tid = window.setTimeout(async () => {
          try {
            dispatch({ type: 'MARK_REMINDER_NOTIFIED', payload: reminder.id });

            const audioEl = soundService.playReminderAlert();

            const handleComplete = () => {
              dispatch({ type: 'COMPLETE_REMINDER', payload: reminder.id });
              soundService.stopReminderAlert();
            };

            const handleSnooze = () => {
              const now = new Date();
              now.setMinutes(now.getMinutes() + 5);
              const hh = now.getHours().toString().padStart(2, '0');
              const mm = now.getMinutes().toString().padStart(2, '0');
              const newTime = `${hh}:${mm}`;
              dispatch({ 
                type: 'UPDATE_REMINDER', 
                payload: { 
                  id: reminder.id,
                  time: newTime, 
                  notified: false, 
                  completed: false 
                } 
              });
              soundService.stopReminderAlert();
            };

            const handleDismiss = () => {
              soundService.stopReminderAlert();
            };

            toastService.show(
              `Reminder: ${reminder.title}`, 
              'warning', 
              15000,
              [
                { label: '✓ Complete', onClick: handleComplete },
                { label: '⏰ Snooze 5m', onClick: handleSnooze },
                { label: '✕ Dismiss', onClick: handleDismiss },
              ]
            );

            const isPatientView = (currentViewRef.current === ViewMode.PATIENT);
            console.log('[App] Reminder triggered, isPatientView:', isPatientView, 'isNative:', localNotifications.isNative);
            if (isPatientView) {
              let webNotification: any = null;
              try {
                const perm = await localNotifications.requestPermission();
                console.log('[App] Notification permission:', perm);
                if (perm !== 'granted') {
                  console.warn('[App] notification permission not granted, skipping visible notification');
                } else {
                  const res = await localNotifications.schedule({ 
                    id: Date.now(), 
                    title: reminder.title, 
                    body: reminder.title,
                    extra: { reminderId: reminder.id, title: reminder.title }
                  });
                  console.log('[App] Notification schedule result:', res, 'typeof:', typeof res);
                  if (res && typeof (res as any).close === 'function') {
                    webNotification = res;
                  }
                }
              } catch (e) {
                console.warn('Error requesting permission or scheduling notification', e);
              }

              if (audioEl && webNotification) {
                const onEnded = () => {
                  try { webNotification.close && webNotification.close(); } catch (e) { /* ignore */ }
                  audioEl.removeEventListener('ended', onEnded);
                };
                const minDisplayMs = 5000;
                let closed = false;
                const closeOnce = () => {
                  if (closed) return;
                  closed = true;
                  try { webNotification.close && webNotification.close(); } catch (e) { /* ignore */ }
                  audioEl.removeEventListener('ended', onEnded);
                };
                setTimeout(closeOnce, minDisplayMs);
                audioEl.addEventListener('ended', () => {
                  setTimeout(closeOnce, Math.max(0, minDisplayMs - (audioEl.duration * 1000 || 0)));
                });
                try { webNotification.onclick = () => { closeOnce(); }; } catch (e) { /* ignore */ }
              }
            }
          } catch (e) {
            console.error('Error in reminder timer handler', e);
          }
        }, ms);
        timers.push({ id: reminder.id, timerId: tid });
      } catch (e) {
        console.warn('Failed to schedule reminder', e);
      }
    };

    // Schedule timers for all reminders that are not completed/notified
    state.reminders.forEach(scheduleForReminder);

    return () => {
      timers.forEach(t => clearTimeout(t.timerId));
    };
  }, [state.reminders, dispatch]);

  // No banner logic: notifications and sounds should only occur at exact scheduled time


  const handleSwitchView = () => {
    let next = ViewMode.PATIENT;
    if (viewMode === ViewMode.PATIENT) next = ViewMode.CAREGIVER;
    else if (viewMode === ViewMode.CAREGIVER) next = ViewMode.FAMILY;
    else next = ViewMode.PATIENT;
    dispatch({ type: 'SET_VIEW_MODE', payload: next });
  };

  const getNextViewName = () => {
    if (viewMode === ViewMode.PATIENT) return 'Caregiver';
    if (viewMode === ViewMode.CAREGIVER) return 'Family';
    return 'Patient';
  };

  const renderView = () => {
    switch(viewMode) {
      case ViewMode.PATIENT:
        return <PatientView />;
      case ViewMode.CAREGIVER:
        return <CaregiverView />;
      case ViewMode.FAMILY:
        return <FamilyView />;
      default:
        return <PatientView />;
    }
  }

  // Master switch should only be visible in dev mode (explicitly enabled).
  const canShowMasterSwitch = !!state.devMode;

  const [showLogin, setShowLogin] = React.useState(false);
  const [showAckForAlertId, setShowAckForAlertId] = React.useState<string | null>(null);

  // Expose a global helper so PatientHome can open the login modal without prop drilling
  useEffect(() => {
    (window as any).openLoginModal = () => setShowLogin(true);
    return () => { (window as any).openLoginModal = undefined; };
  }, []);

  useEffect(() => {
    const role = state.currentUser?.role?.toUpperCase?.();
    const canSeeAck = role === 'CAREGIVER' || role === 'FAMILY';
    if (!canSeeAck) {
      setShowAckForAlertId(null);
      return;
    }

    const current = showAckForAlertId
      ? state.alerts.find((a) => a.id === showAckForAlertId && (a.type === 'SOS' || a.type === 'FALL') && a.requiresAcknowledgement)
      : null;
    if (current) return;

    const nextCritical = state.alerts.find((a) => (a.type === 'SOS' || a.type === 'FALL') && a.requiresAcknowledgement);
    setShowAckForAlertId(nextCritical ? nextCritical.id : null);
  }, [state.alerts, state.currentUser, showAckForAlertId]);

  return (
    <div className="min-h-screen font-body antialiased text-[#A8A0B4] relative z-10">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        {/* Connection status dot */}
        <div className={`w-3 h-3 rounded-full ${realtimeDotClass(state.currentUser)} ${state.devMode ? 'ring-2 ring-[#E8C4A0]' : ''}`} title={state.currentUser ? 'Connected' : 'Not connected'} />
        {/* Use the full LoginPage modal (opened via openLoginModal) for demo login UX */}
        {canShowMasterSwitch && (
          <button
            onClick={handleSwitchView}
            className="px-4 py-2 glass-card text-xs text-[#A8A0B4] rounded-full touch-feedback"
          >
            {getNextViewName()}
          </button>
        )}
      </div>
      {showLogin && <LoginPage onClose={() => setShowLogin(false)} />}

      {showAckForAlertId && (() => {
        const a = state.alerts.find(x => x.id === showAckForAlertId);
        if (!a) return null;
        const viewRole = state.currentView === 'CAREGIVER' ? 'CAREGIVER' : state.currentView === 'FAMILY' ? 'FAMILY' : 'PATIENT';
        if (viewRole === 'PATIENT') return null;
        return (
          <AcknowledgeModal
            alertId={a.id}
            alertType={a.type === 'FALL' ? 'FALL' : 'SOS'}
            onClose={() => setShowAckForAlertId(null)}
          />
        );
      })()}
      {/* No bannerReminder UI; notifications only fire at exact time */}
      {showDashboardSelector && (
        <div style={{ zIndex: 200000 }}>
          <DashboardSelectorModal onClose={() => setShowDashboardSelector(false)} />
        </div>
      )}
      {/* Show in-app persistent banner on Patient view when a reminder is due */}
      {viewMode === ViewMode.PATIENT && (() => {
        const due = state.reminders.find((r: any) => !r.completed && !r.notified && isReminderDue(r.time));
        if (due) {
          return <ReminderBanner reminder={due} status="due" />;
        }
        return null;
      })()}
      
      <div className="container mx-auto max-w-lg p-2 sm:p-4 h-screen">
        {renderView()}
      </div>
      <ToastViewport />
    </div>
  );
};

export default App;
