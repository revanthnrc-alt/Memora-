import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import localNotifications from '../../services/localNotifications';
import { Reminder } from '../../types';
import PillIcon from '../icons/PillIcon';
import ForkKnifeIcon from '../icons/ForkKnifeIcon';
import GlassWaterIcon from '../icons/GlassWaterIcon';
import toastService from '../../services/toastService';


const ReminderForm: React.FC = () => {
    const { dispatch } = useAppContext();
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('');
    const [icon, setIcon] = useState<'medication' | 'meal' | 'hydration'>('medication');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!title || !time) {
            toastService.show('Please fill out all fields.', 'warning');
            return;
        }

        const newReminder: Reminder = {
            id: new Date().toISOString(),
            title,
            time,
            completed: false,
            icon,
            notified: false,
        };

        dispatch({ type: 'ADD_REMINDER', payload: newReminder });
        setTitle('');
        setTime('');
        setIcon('medication');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <input
                    type="text"
                    placeholder="Reminder Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-[rgba(45,36,56,0.5)] border border-[rgba(255,255,255,0.06)] rounded-xl text-[#F5F0E8] placeholder-[#7A7582] focus:outline-none focus:border-[rgba(184,169,201,0.3)]"
                />
                <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-3 bg-[rgba(45,36,56,0.5)] border border-[rgba(255,255,255,0.06)] rounded-xl text-[#F5F0E8] placeholder-[#7A7582] focus:outline-none focus:border-[rgba(184,169,201,0.3)]"
                />
            </div>

            <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                    <button type="button" onClick={() => setIcon('medication')} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${icon === 'medication' ? 'bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white' : 'glass-card text-[#A8A0B4]'}`}><PillIcon className="w-6 h-6"/></button>
                    <button type="button" onClick={() => setIcon('meal')} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${icon === 'meal' ? 'bg-gradient-to-br from-[#E8C4A0] to-[#C9B896] text-white' : 'glass-card text-[#A8A0B4]'}`}><ForkKnifeIcon className="w-6 h-6"/></button>
                    <button type="button" onClick={() => setIcon('hydration')} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${icon === 'hydration' ? 'bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white' : 'glass-card text-[#A8A0B4]'}`}><GlassWaterIcon className="w-6 h-6"/></button>
                </div>
                <button type="submit" className="px-6 py-3 bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white font-medium rounded-xl touch-feedback">
                    Add
                </button>
            </div>
        </form>
    );
};

export default ReminderForm;
