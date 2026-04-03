import React from 'react';
import { useAppContext } from '../../context/AppContext';
import PillIcon from '../icons/PillIcon';
import ForkKnifeIcon from '../icons/ForkKnifeIcon';
import GlassWaterIcon from '../icons/GlassWaterIcon';
import MusicIcon from '../icons/MusicIcon';

interface RemindersListProps {
    onBack: () => void;
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

const getIconGradient = (icon: 'medication' | 'meal' | 'hydration' | 'music') => {
  switch (icon) {
    case 'medication': return 'bg-gradient-to-br from-[rgba(212,165,165,0.3)] to-[rgba(224,122,122,0.2)]';
    case 'meal': return 'bg-gradient-to-br from-[rgba(232,196,160,0.3)] to-[rgba(201,184,150,0.2)]';
    case 'hydration': return 'bg-gradient-to-br from-[rgba(184,169,201,0.3)] to-[rgba(157,138,165,0.2)]';
    case 'music': return 'bg-gradient-to-br from-[rgba(201,184,150,0.3)] to-[rgba(184,169,201,0.2)]';
    default: return 'bg-gradient-to-br from-[rgba(157,138,165,0.3)] to-[rgba(184,169,201,0.2)]';
  }
};

const RemindersList: React.FC<RemindersListProps> = ({ onBack }) => {
  const { state, dispatch } = useAppContext();
  const { reminders } = state;

  const handleComplete = (id: string) => {
    dispatch({ type: 'COMPLETE_REMINDER', payload: id });
  };

  const pendingReminders = reminders.filter(r => !r.completed);

  return (
    <div className="relative p-4 sm:p-6 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex flex-col glass-card rounded-3xl">
      <header className="flex items-center mb-6 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <button onClick={onBack} className="text-[#A8A0B4] text-sm p-2 rounded-xl touch-feedback flex items-center gap-1">
            <span className='text-lg'>&larr;</span> Back
        </button>
        <h2 className="font-display text-2xl font-semibold text-[#F5F0E8] ml-2">Today's Reminders</h2>
      </header>
      
      {pendingReminders.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#C9B896] to-[#B8A9C9] mb-4 text-3xl">
              🎉
            </div>
            <h3 className="font-display text-2xl font-medium text-[#C9B896]">All Done for Today!</h3>
            <p className="text-[#7A7582] mt-2">Great job!</p>
        </div>
      ) : (
        <ul className="space-y-3 overflow-y-auto pr-2">
            {pendingReminders.map((reminder) => (
            <li key={reminder.id} className="p-4 rounded-2xl glass-card flex items-center justify-between touch-feedback">
                <div className="flex items-center">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${getIconGradient(reminder.icon)}`}>
                        <ReminderIcon icon={reminder.icon} className="w-6 h-6 text-[#A8A0B4]"/>
                    </div>
                    <div className="ml-4">
                        <p className="font-body text-lg font-medium text-[#F5F0E8]">{reminder.title}</p>
                        <p className="text-sm text-[#7A7582]">{reminder.time}</p>
                    </div>
                </div>
                <button
                    onClick={() => handleComplete(reminder.id)}
                    className="px-5 py-2.5 bg-gradient-to-br from-[#C9B896] to-[#B8A9C9] text-white font-medium text-sm rounded-full touch-feedback"
                >
                    Done
                </button>
            </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default RemindersList;
