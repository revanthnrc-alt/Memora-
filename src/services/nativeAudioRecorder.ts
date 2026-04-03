import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';

export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface AudioRecorderPermissionStatus {
  granted: boolean;
  state: MicPermissionState;
}

export interface RecordingResult {
  audioUrl: string;
  duration: number;
  mimeType: string;
}

const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const canDeviceRecord = async (): Promise<boolean> => {
  try {
    const result = await (VoiceRecorder as any).canDeviceVoiceRecord();
    return result.value;
  } catch (error) {
    console.error('[nativeAudioRecorder] canDeviceVoiceRecord error:', error);
    return false;
  }
};

const hasPermission = async (): Promise<AudioRecorderPermissionStatus> => {
  try {
    if (!isNative()) {
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          return {
            granted: status.state === 'granted',
            state: status.state as MicPermissionState,
          };
        } catch {
          return { granted: false, state: 'unknown' };
        }
      }
      return { granted: false, state: 'unknown' };
    }

    const canRecord = await canDeviceRecord();
    if (!canRecord) {
      return { granted: false, state: 'denied' };
    }

    const result = await (VoiceRecorder as any).hasAudioRecordingPermission();
    if (result.value) {
      return { granted: true, state: 'granted' };
    }
    return { granted: false, state: 'prompt' };
  } catch (error) {
    console.error('[nativeAudioRecorder] hasPermission error:', error);
    return { granted: false, state: 'unknown' };
  }
};

const requestPermission = async (): Promise<AudioRecorderPermissionStatus> => {
  try {
    if (!isNative()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return { granted: true, state: 'granted' };
      } catch (error) {
        if (error instanceof DOMException) {
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            return { granted: false, state: 'denied' };
          }
        }
        return { granted: false, state: 'unknown' };
      }
    }

    const canRecord = await canDeviceRecord();
    if (!canRecord) {
      return { granted: false, state: 'denied' };
    }

    const result = await (VoiceRecorder as any).requestAudioRecordingPermission();
    if (result.value) {
      return { granted: true, state: 'granted' };
    }
    return { granted: false, state: 'denied' };
  } catch (error) {
    console.error('[nativeAudioRecorder] requestPermission error:', error);
    return { granted: false, state: 'unknown' };
  }
};

const ensurePermission = async (): Promise<AudioRecorderPermissionStatus> => {
  const current = await hasPermission();
  if (current.granted) {
    return current;
  }
  return requestPermission();
};

const startRecording = async (): Promise<void> => {
  try {
    if (!isNative()) {
      throw new Error('Native audio recording is only available on native platforms');
    }

    const permission = await ensurePermission();
    if (!permission.granted) {
      throw new Error('Microphone permission not granted');
    }

    await (VoiceRecorder as any).startRecording();
    console.log('[nativeAudioRecorder] Recording started');
  } catch (error) {
    console.error('[nativeAudioRecorder] startRecording error:', error);
    throw error;
  }
};

const stopRecording = async (): Promise<RecordingResult | null> => {
  try {
    if (!isNative()) {
      throw new Error('Native audio recording is only available on native platforms');
    }

    const result = await (VoiceRecorder as any).stopRecording();
    console.log('[nativeAudioRecorder] Recording stopped:', result);

    if (result.value && result.value.recordDataBase64) {
      const mimeType = result.value.mimeType || 'audio/aac';
      const audioUrl = `data:${mimeType};base64,${result.value.recordDataBase64}`;
      const duration = result.value.msDuration ? result.value.msDuration / 1000 : 0;

      return {
        audioUrl,
        duration,
        mimeType,
      };
    }

    return null;
  } catch (error) {
    console.error('[nativeAudioRecorder] stopRecording error:', error);
    throw error;
  }
};

const pauseRecording = async (): Promise<void> => {
  try {
    await (VoiceRecorder as any).pauseRecording();
  } catch (error) {
    console.error('[nativeAudioRecorder] pauseRecording error:', error);
    throw error;
  }
};

const resumeRecording = async (): Promise<void> => {
  try {
    await (VoiceRecorder as any).resumeRecording();
  } catch (error) {
    console.error('[nativeAudioRecorder] resumeRecording error:', error);
    throw error;
  }
};

const getCurrentStatus = async (): Promise<string> => {
  try {
    const result = await (VoiceRecorder as any).getCurrentStatus();
    return result.status;
  } catch (error) {
    console.error('[nativeAudioRecorder] getCurrentStatus error:', error);
    return 'UNKNOWN';
  }
};

export default {
  isNative,
  canDeviceRecord,
  hasPermission,
  requestPermission,
  ensurePermission,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  getCurrentStatus,
};
