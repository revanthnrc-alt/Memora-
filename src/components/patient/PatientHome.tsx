import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { PatientScreen } from '../../types';
import NavigationIcon from '../icons/NavigationIcon';
import RemindersIcon from '../icons/RemindersIcon';
import CompanionIcon from '../icons/CompanionIcon';
import BrainIcon from '../icons/BrainIcon';
import ImageIcon from '../icons/ImageIcon';
import VoicemailIcon from '../icons/VoicemailIcon';
import SOSSlider from './SOSSlider';
import toastService from '../../services/toastService';

interface PatientHomeProps {
  setScreen: (screen: PatientScreen) => void;
}

interface MenuItemConfig {
  name: string;
  icon: React.ReactNode;
  screen: PatientScreen;
  gradient: string;
}

const MenuItem: React.FC<{
  name: string;
  icon: React.ReactNode;
  onClick: () => void;
  gradient: string;
  index: number;
}> = ({ name, icon, onClick, gradient, index }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-xl touch-feedback glass-card relative overflow-hidden"
    style={{ animationDelay: `${0.3 + index * 0.05}s` }}
  >
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${gradient}`}>
      {icon}
    </div>
    <span className="font-body text-[14px] font-medium text-white flex-1 text-left">
      {name}
    </span>
    <span className="text-[#B8B0C4] text-lg flex-shrink-0">→</span>
  </button>
);

const PatientHome: React.FC<PatientHomeProps> = ({ setScreen }) => {
  const { dispatch } = useAppContext();
  const { sharedQuote } = useAppContext().state;

  const handleSOS = () => {
    const newAlert = {
      id: new Date().toISOString(),
      message: 'SOS button pressed by patient!',
      timestamp: new Date().toLocaleString(),
      type: 'SOS' as const,
    };
    dispatch({ type: 'TRIGGER_SOS', payload: newAlert });
    toastService.show('Caregiver and Family have been notified.', 'success');
  };

  const menuItems: MenuItemConfig[] = [
    {
      name: 'Navigate Home',
      icon: <NavigationIcon className="w-5 h-5 text-[#A495B8]" />,
      screen: PatientScreen.NAVIGATION,
      gradient: 'bg-gradient-to-br from-[rgba(164,149,184,0.35)] to-[rgba(138,122,154,0.25)]',
    },
    {
      name: 'My Reminders',
      icon: <RemindersIcon className="w-5 h-5 text-[#C98B8B]" />,
      screen: PatientScreen.REMINDERS,
      gradient: 'bg-gradient-to-br from-[rgba(201,139,139,0.35)] to-[rgba(180,110,110,0.25)]',
    },
    {
      name: 'AI Companion',
      icon: <CompanionIcon className="w-5 h-5 text-[#D4A878]" />,
      screen: PatientScreen.AI_COMPANION,
      gradient: 'bg-gradient-to-br from-[rgba(212,168,120,0.35)] to-[rgba(184,140,90,0.25)]',
    },
    {
      name: 'Voice Messages',
      icon: <VoicemailIcon className="w-5 h-5 text-[#A495B8]" />,
      screen: PatientScreen.VOICE_MESSAGES,
      gradient: 'bg-gradient-to-br from-[rgba(164,149,184,0.35)] to-[rgba(138,122,154,0.25)]',
    },
    {
      name: 'Memory Game',
      icon: <BrainIcon className="w-5 h-5 text-[#C98B8B]" />,
      screen: PatientScreen.COGNITIVE_GAMES,
      gradient: 'bg-gradient-to-br from-[rgba(201,139,139,0.35)] to-[rgba(200,160,120,0.25)]',
    },
    {
      name: 'Photo Album',
      icon: <ImageIcon className="w-5 h-5 text-[#B8A078]" />,
      screen: PatientScreen.MEMORY_ALBUM,
      gradient: 'bg-gradient-to-br from-[rgba(184,160,120,0.35)] to-[rgba(164,149,184,0.25)]',
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex flex-col px-4 pt-5 pb-32 overflow-y-auto flex-1 relative z-[2]">
        <header className="flex items-center justify-between mb-6 animate-fade-down">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#D4A878] to-[#A495B8] shadow-[0_6px_20px_rgba(180,130,140,0.4)]">
              <span className="text-lg text-white font-bold">✦</span>
            </div>
            <h1 className="font-display text-[22px] font-semibold text-white tracking-[-0.3px]">
              Memora
            </h1>
          </div>
          <button
            onClick={() => (window as any).openLoginModal?.()}
            className="px-4 py-2 rounded-lg text-[12px] font-medium text-[#B8B0C4] glass-card touch-feedback"
          >
            Login
          </button>
        </header>

        <div className="mb-5 animate-fade-down" style={{ animationDelay: '0.1s' }}>
          <h2 className="font-display text-[26px] font-medium text-white leading-tight">
            {getGreeting()}
          </h2>
          <p className="font-body text-[14px] text-[#B8B0C4] mt-1 font-light">
            How can I help you today?
          </p>
        </div>

        {sharedQuote && (
          <div
            className="mb-5 px-4 py-3 rounded-xl glass-card animate-fade-down"
            style={{ animationDelay: '0.2s' }}
          >
            <p className="text-[10px] font-semibold text-[#C98B8B] uppercase tracking-[1.5px]">
              From your family
            </p>
            <p className="font-display text-[15px] text-white italic mt-1.5 leading-snug">
              "{sharedQuote.text}"
            </p>
          </div>
        )}

        <main className="flex flex-col gap-2.5 flex-1">
          {menuItems.map((item, index) => (
            <MenuItem
              key={item.name}
              name={item.name}
              icon={item.icon}
              onClick={() => setScreen(item.screen)}
              gradient={item.gradient}
              index={index}
            />
          ))}
        </main>
      </div>

      <SOSSlider onActivate={handleSOS} />
    </div>
  );
};

export default PatientHome;
