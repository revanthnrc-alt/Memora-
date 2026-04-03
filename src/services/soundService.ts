// A simple service to manage audio playback for alerts.

import sosAsset from '../assets/audio/sos_alert.mp3';
import fallAsset from '../assets/audio/fall_alert.mp3';
import reminderAsset from '../assets/audio/reminder_notification.mp3';

let sosAudio: HTMLAudioElement | null = null;
let fallAudio: HTMLAudioElement | null = null;
let reminderAudio: HTMLAudioElement | null = null;
let isUnlocked = false;
let _isSosPlaying = false;
let _isFallPlaying = false;
let _isReminderPlaying = false;

function ensureAudioElement(kind: 'sos' | 'fall' | 'reminder'): HTMLAudioElement {
  if (kind === 'sos') {
    if (sosAudio) return sosAudio;
    sosAudio = new Audio(sosAsset);
    sosAudio.loop = true;
    sosAudio.preload = 'auto';
    (sosAudio as any).playsInline = true;
    try { sosAudio.load(); } catch (e) { /* ignore */ }
    sosAudio.addEventListener('error', (ev) => console.error('[soundService] sosAudio error', ev));
    return sosAudio;
  }
  if (kind === 'fall') {
    if (fallAudio) return fallAudio;
    fallAudio = new Audio(fallAsset);
    fallAudio.loop = true;
    fallAudio.preload = 'auto';
    (fallAudio as any).playsInline = true;
    try { fallAudio.load(); } catch (e) { /* ignore */ }
    fallAudio.addEventListener('error', (ev) => console.error('[soundService] fallAudio error', ev));
    return fallAudio;
  }
  if (reminderAudio) return reminderAudio;
  reminderAudio = new Audio(reminderAsset);
  reminderAudio.loop = false;
  reminderAudio.preload = 'auto';
  (reminderAudio as any).playsInline = true;
  try { reminderAudio.load(); } catch (e) { /* ignore */ }
  reminderAudio.addEventListener('error', (ev) => console.error('[soundService] reminderAudio error', ev));
  return reminderAudio;
}

const unlockAudioElement = async (audio: HTMLAudioElement): Promise<boolean> => {
  if (isUnlocked) return true;
  
  audio.muted = true;
  const promise = audio.play();
  if (promise) {
    try {
      await promise;
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      isUnlocked = true;
      return true;
    } catch (err) {
      console.error('Audio unlock failed. Subsequent sounds may not play until another interaction.', err);
      return false;
    }
  }
  return false;
};

const soundService = {
  isUnlocked: () => isUnlocked,
  
  unlock: async (): Promise<void> => {
    if (isUnlocked) return;
    try {
      const allAudio = [
        ensureAudioElement('sos'),
        ensureAudioElement('fall'),
        ensureAudioElement('reminder'),
      ];
      
      for (const audio of allAudio) {
        const success = await unlockAudioElement(audio);
        if (success) {
          break;
        }
      }
    } catch (err) {
      console.error('Audio unlock failed synchronously', err);
    }
  },

  playSosAlert: () => {
    try {
      const audio = ensureAudioElement('sos');
      audio.muted = false;
      audio.volume = 1.0;
      audio.currentTime = 0;
      const doPlay = () => {
        if (audio.paused) audio.play().then(() => { _isSosPlaying = true; }).catch(e => console.error('Error playing SOS sound:', e));
      };

      if (!isUnlocked) {
        (soundService as any).unlock().then(() => {
          doPlay();
        }).catch(() => {
          doPlay();
        });
      } else {
        doPlay();
      }
    } catch (e) {
      console.error('Error ensuring SOS audio element:', e);
    }
  },

  stopSosAlert: () => {
    if (sosAudio) {
      try {
        if (!sosAudio.paused) {
          sosAudio.pause();
          sosAudio.currentTime = 0;
        }
        _isSosPlaying = false;
      } catch (e) {
        console.error('Error stopping SOS audio', e);
      }
    }
  },

  playFallAlert: () => {
    try {
      const audio = ensureAudioElement('fall');
      audio.muted = false;
      audio.volume = 1.0;
      audio.currentTime = 0;
      const doPlay = () => {
        if (audio.paused) audio.play().then(() => { _isFallPlaying = true; }).catch(s => console.error('Error playing Fall alert sound:', s));
      };

      if (!isUnlocked) {
        (soundService as any).unlock().then(() => {
          doPlay();
        }).catch(() => {
          doPlay();
        });
      } else {
        doPlay();
      }
    } catch (e) {
      console.error('Error ensuring Fall audio element:', e);
    }
  },

  stopFallAlert: () => {
    if (fallAudio) {
      try {
        if (!fallAudio.paused) {
          fallAudio.pause();
          fallAudio.currentTime = 0;
        }
        _isFallPlaying = false;
      } catch (e) {
        console.error('Error stopping Fall audio', e);
      }
    }
  },

  isSosPlaying: () => !!_isSosPlaying,
  isFallPlaying: () => !!_isFallPlaying,

  isReminderPlaying: () => !!_isReminderPlaying,

  playReminderAlert: (): HTMLAudioElement | null => {
    try {
      const audio = ensureAudioElement('reminder');
      audio.muted = false;
      audio.volume = 1.0;
      audio.currentTime = 0;

      const doPlay = () => {
        if (audio.paused) audio.play().then(() => { _isReminderPlaying = true; }).catch(e => console.error('Error playing reminder sound:', e));
      };

      if (!isUnlocked) {
        (soundService as any).unlock().then(() => {
          try { audio.load(); } catch (e) { /* ignore */ }
          doPlay();
        }).catch(() => {
          try { audio.load(); } catch (e) { /* ignore */ }
          doPlay();
        });
      } else {
        try { audio.load(); } catch (e) { /* ignore */ }
        doPlay();
      }
    } catch (e) {
      console.error('Error ensuring Reminder audio element:', e);
    }
    return reminderAudio;
  }
  ,
  stopReminderAlert: () => {
    if (reminderAudio) {
      try {
        if (!reminderAudio.paused) {
          reminderAudio.pause();
          reminderAudio.currentTime = 0;
        }
        _isReminderPlaying = false;
      } catch (e) {
        console.error('Error stopping reminder audio', e);
      }
    }
  }
};

export default soundService;
