import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { SenderRole, VoiceMessage } from '../../types';
import VoiceRecorder from '../shared/VoiceRecorder';
import VoiceMessagePlayer from '../shared/VoiceMessagePlayer';

interface VoiceMessagesProps {
    onBack: () => void;
}

const VoiceMessages: React.FC<VoiceMessagesProps> = ({ onBack }) => {
    const { state, dispatch } = useAppContext();
    const { voiceMessages } = state;

    const handleNewMessage = (audioUrl: string, duration: number) => {
        const newMessage: VoiceMessage = {
            id: new Date().toISOString(),
            audioUrl,
            duration,
            senderRole: SenderRole.PATIENT,
            senderName: 'Me',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        dispatch({ type: 'ADD_VOICE_MESSAGE', payload: newMessage });
    };

    return (
        <div className="relative p-4 sm:p-6 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex flex-col glass-card rounded-3xl">
            <header className="flex items-center mb-6 border-b border-[rgba(255,255,255,0.06)] pb-4">
                <button onClick={onBack} className="text-[#A8A0B4] text-sm p-2 rounded-xl touch-feedback flex items-center gap-1">
                    <span className='text-lg'>&larr;</span> Back
                </button>
                <h2 className="font-display text-2xl font-semibold text-[#F5F0E8] ml-2">Voice Messages</h2>
            </header>
            
            <div className="flex-grow space-y-3 overflow-y-auto pr-2 mb-4">
                {voiceMessages.length > 0 ? (
                    voiceMessages.map(msg => <VoiceMessagePlayer key={msg.id} message={msg} />)
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center h-full">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#E8C4A0] to-[#C9B896] mb-4 text-3xl">
                          🎙️
                        </div>
                        <h3 className="font-display text-xl text-[#A8A0B4]">No voice messages yet.</h3>
                        <p className="text-[#7A7582] mt-2">Tap the microphone below to send one.</p>
                    </div>
                )}
            </div>

            <footer className="mt-auto border-t border-[rgba(255,255,255,0.06)] pt-4">
                <VoiceRecorder onNewMessage={handleNewMessage} />
            </footer>
        </div>
    );
};

export default VoiceMessages;
