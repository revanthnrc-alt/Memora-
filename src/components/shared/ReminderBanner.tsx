import React from 'react';
import { Reminder } from '../../types';
import soundService from '../../services/soundService';
import localNotifications from '../../services/localNotifications';
import { useAppContext } from '../../context/AppContext';

const ReminderBanner: React.FC<{ reminder: Reminder; status: 'upcoming' | 'due' | 'completed' }> = ({ reminder, status }) => {
  const { dispatch } = useAppContext();

  const notifyNow = async () => {
    try {
      soundService.playReminderAlert();
    } catch (e) {
      console.warn('Failed to play reminder sound', e);
    }
    try {
      await localNotifications.schedule({ id: Date.now(), title: reminder.title, body: reminder.title });
    } catch (e) {
      console.warn('localNotifications failed', e);
    }
  };

  const dismiss = () => {
    dispatch({ type: 'MARK_REMINDER_NOTIFIED', payload: reminder.id });
  };

  const markComplete = () => {
    dispatch({ type: 'COMPLETE_REMINDER', payload: reminder.id });
    dispatch({ type: 'MARK_REMINDER_NOTIFIED', payload: reminder.id });
  };

  const snooze = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const newTime = `${hh}:${mm}`;
    dispatch({ type: 'ADD_REMINDER', payload: { ...reminder, id: new Date().toISOString(), time: newTime, notified: false, completed: false } });
    dispatch({ type: 'MARK_REMINDER_NOTIFIED', payload: reminder.id });
  };

  React.useEffect(() => {
    if (status === 'due') {
      notifyNow();
    }
  }, [status]);

  return (
    <div 
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100000] w-full max-w-lg px-4 animate-slide-down"
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-slate-800/95 border-2 border-amber-500 rounded-lg shadow-2xl p-4 flex items-start gap-3 animate-pulse-border">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="font-bold text-white text-lg">{reminder.title}</p>
                <p className="text-sm text-amber-300 font-medium">{reminder.time} — {status === 'due' ? 'Due now!' : 'Upcoming'}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button 
              onClick={markComplete} 
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition-colors shadow-md"
            >
              ✓ Complete
            </button>
            <button 
              onClick={snooze} 
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm font-semibold transition-colors shadow-md"
            >
              Snooze 5m
            </button>
            <button 
              onClick={dismiss} 
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-semibold transition-colors shadow-md"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderBanner;
