import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Alert, VoiceMessage, SenderRole } from '../../types';
import PillIcon from '../icons/PillIcon';
import ForkKnifeIcon from '../icons/ForkKnifeIcon';
import GlassWaterIcon from '../icons/GlassWaterIcon';
import ReminderForm from './ReminderForm';
import FallIcon from '../icons/FallIcon';
import CompanionIcon from '../icons/CompanionIcon';
import VoiceMessagePlayer from '../shared/VoiceMessagePlayer';
import VoiceRecorder from '../shared/VoiceRecorder';
import toastService from '../../services/toastService';
import MusicIcon from '../icons/MusicIcon';

function isReminderDue(reminderTime: string) {
  const now = new Date();
  const [h, m] = reminderTime.split(':');
  const reminderDate = new Date(now);
  reminderDate.setHours(Number(h), Number(m), 0, 0);
  return now >= reminderDate;
}

const ReminderIcon: React.FC<{ icon: 'medication' | 'meal' | 'hydration' | 'music'; className?: string }> = ({ icon, className }) => {
    switch (icon) {
        case 'medication': return <PillIcon className={className} />;
        case 'meal': return <ForkKnifeIcon className={className} />;
        case 'hydration': return <GlassWaterIcon className={className} />;
        case 'music': return <MusicIcon className={className} />;
        default: return null;
    }
};

const CaregiverView: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { reminders, alerts, voiceMessages } = state;

  const unacknowledgedAlerts = alerts.filter(
    a => (a.type === 'SOS' || a.type === 'FALL') && a.requiresAcknowledgement
  );

  const deleteReminder = (id: string) => {
    if (window.confirm('Are you sure you want to delete this reminder?')) {
        dispatch({ type: 'DELETE_REMINDER', payload: id });
    }
  };

  const handleSimulateFall = () => {
      dispatch({
          type: 'TRIGGER_SOS',
          payload: {
              id: new Date().toISOString(),
              message: 'Potential Fall Detected! (Simulated)',
              timestamp: new Date().toLocaleString(),
              type: 'FALL'
          }
      });
      toastService.show('Fall alert sent.', 'warning');
  };

  const handleNewVoiceMessage = (audioUrl: string, duration: number) => {
    const newMessage: VoiceMessage = {
        id: new Date().toISOString(),
        audioUrl,
        duration,
        senderRole: SenderRole.CAREGIVER,
        senderName: 'Caregiver',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    dispatch({ type: 'ADD_VOICE_MESSAGE', payload: newMessage });
  };
  
  const AlertIcon: React.FC<{ type: Alert['type'] }> = ({ type }) => {
      switch (type) {
          case 'FALL': return <FallIcon className="w-6 h-6" />;
          case 'EMOTION': return <CompanionIcon className="w-6 h-6" />;
          case 'SOS': return <span className="text-xl">🚨</span>;
          default: return <span className="text-xl">⚠️</span>;
      }
  };

  const handleAcknowledge = () => {
    dispatch({ type: 'ACKNOWLEDGE_ALERTS' });
  };

  return (
    <div className="relative space-y-4 p-4 pb-20 h-full overflow-y-auto">
      <header className="border-b border-[rgba(255,255,255,0.08)] pb-3">
        <h1 className="font-display text-[26px] font-semibold text-white">Caregiver Dashboard</h1>
        <p className="text-[#B8B0C4] text-[14px] mt-1">Manage patient schedule and alerts for Memora</p>
      </header>

      {unacknowledgedAlerts.length > 0 && (
        <div className="p-4 bg-[rgba(212,90,90,0.2)] border-2 border-[#D45A5A] rounded-xl animate-pulse">
            <h2 className="text-[17px] font-semibold text-white text-center mb-3">URGENT ALERT RECEIVED</h2>
            <button
                onClick={handleAcknowledge}
                className="w-full py-3 bg-gradient-to-br from-[#D45A5A] to-[#B04848] text-white font-medium rounded-xl touch-feedback"
            >
                Acknowledge & Silence Alarm
            </button>
        </div>
      )}
      
      {alerts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[14px] font-semibold text-[#B8B0C4]">Urgent Alerts</h2>
            {alerts.map(alert => (
                <div key={alert.id} className="p-3 rounded-xl glass-card">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <AlertIcon type={alert.type} />
                        <div>
                            <p className="font-medium text-white text-[14px]">{alert.message}</p>
                            <p className="text-[12px] text-[#6A6280]">{alert.timestamp}</p>
                        </div>
                    </div>
                    { (alert.type === 'SOS' || alert.type === 'FALL') && <span className="text-xl animate-ping">🚨</span> }
                  </div>
                </div>
            ))}
          </div>
      )}

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Voice Mailbox</h2>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-3">
            {voiceMessages.map(msg => <VoiceMessagePlayer key={msg.id} message={msg} />)}
        </div>
        <div className='border-t border-[rgba(255,255,255,0.08)] pt-3'>
            <p className='text-[12px] text-[#6A6280] mb-2 text-center'>Send a voice note to patient and family</p>
            <VoiceRecorder onNewMessage={handleNewVoiceMessage} />
        </div>
      </div>

      <div className="p-3 rounded-xl glass-card">
        <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">Add New Reminder</h2>
        <ReminderForm />
      </div>

      <div className="p-3 rounded-xl glass-card">
          <h2 className="text-[14px] font-semibold text-[#B8B0C4] mb-2">System Actions</h2>
          <button onClick={handleSimulateFall} className="w-full px-4 py-2.5 bg-gradient-to-br from-[#C49868] to-[#A89060] text-white font-medium rounded-xl touch-feedback text-[14px]">
            Simulate Fall Detection
          </button>
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
                 <div className='flex items-center space-x-3 flex-shrink-0'>
                    <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${reminder.completed ? 'bg-[rgba(184,160,120,0.25)] text-[#B8A078]' : 'bg-[rgba(212,168,120,0.25)] text-[#D4A878]'}`}>
                        {reminder.completed ? 'COMPLETED' : 'PENDING'}
                    </span>
                    <button onClick={() => deleteReminder(reminder.id)} className="text-[#6A6280] hover:text-[#D45A5A] transition-colors text-xl font-bold">&times;</button>
                 </div>
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

export default CaregiverView;
