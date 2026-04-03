import { Capacitor } from '@capacitor/core';
import { OfflineSpeechRecognition } from 'capacitor-offline-speech-recognition';
import { VoiceRecorder } from 'capacitor-voice-recorder';

export type VoskPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface VoskAvailability {
  available: boolean;
  reasonCode: 'ok' | 'not_native' | 'model_not_downloaded' | 'unknown';
  modelDownloaded: boolean;
}

export interface DownloadProgress {
  progress: number;
  message: string;
}

let isInitialized = false;
let isModelReady = false;
let currentLanguage = 'en-us';
let recognitionCleanup: (() => Promise<void>) | null = null;

const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const getAvailability = async (): Promise<VoskAvailability> => {
  if (!isNativePlatform()) {
    return { available: false, reasonCode: 'not_native', modelDownloaded: false };
  }

  try {
    const { models } = await OfflineSpeechRecognition.getDownloadedLanguageModels();
    const hasEnglishModel = models.some(m => m.language === 'en-us');
    
    console.log('[voskSpeechService] Downloaded models:', models);
    
    return {
      available: hasEnglishModel,
      reasonCode: hasEnglishModel ? 'ok' : 'model_not_downloaded',
      modelDownloaded: hasEnglishModel,
    };
  } catch (error) {
    console.error('[voskSpeechService] getAvailability error:', error);
    return { available: false, reasonCode: 'unknown', modelDownloaded: false };
  }
};

const isReady = (): boolean => {
  return isInitialized && isModelReady;
};

const downloadModel = async (
  language: string = 'en-us',
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ success: boolean; error?: string }> => {
  console.log('[voskSpeechService] Downloading model for language:', language);

  let progressListener: { remove: () => void } | null = null;

  try {
    if (onProgress) {
      progressListener = await OfflineSpeechRecognition.addListener('downloadProgress', (progress) => {
        console.log('[voskSpeechService] Download progress:', progress.progress + '%', progress.message);
        onProgress(progress);
      });
    }

    const result = await OfflineSpeechRecognition.downloadLanguageModel({ language });
    console.log('[voskSpeechService] Download result:', result);

    if (result.success) {
      isModelReady = true;
      currentLanguage = language;
    }

    return { success: result.success, error: result.message };
  } catch (error) {
    console.error('[voskSpeechService] downloadModel error:', error);
    return { success: false, error: String(error) };
  } finally {
    if (progressListener) {
      progressListener.remove();
    }
  }
};

const initialize = async (
  onProgress?: (progress: DownloadProgress) => void
): Promise<{ success: boolean; needsDownload: boolean; error?: string }> => {
  if (!isNativePlatform()) {
    console.log('[voskSpeechService] Not a native platform, skipping initialization');
    return { success: false, needsDownload: false, error: 'Not a native platform' };
  }

  console.log('[voskSpeechService] Initializing...');

  try {
    const availability = await getAvailability();

    if (availability.modelDownloaded) {
      isInitialized = true;
      isModelReady = true;
      console.log('[voskSpeechService] Model already downloaded, ready to use');
      return { success: true, needsDownload: false };
    }

    console.log('[voskSpeechService] Model not downloaded, starting download...');
    const downloadResult = await downloadModel('en-us', onProgress);

    if (downloadResult.success) {
      isInitialized = true;
      isModelReady = true;
      return { success: true, needsDownload: true };
    }

    return { success: false, needsDownload: true, error: downloadResult.error };
  } catch (error) {
    console.error('[voskSpeechService] initialize error:', error);
    return { success: false, needsDownload: true, error: String(error) };
  }
};

const ensurePermission = async (): Promise<{ granted: boolean }> => {
  if (!isNativePlatform()) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return { granted: true };
    } catch (error) {
      console.error('[voskSpeechService] Web permission error:', error);
      return { granted: false };
    }
  }

  try {
    console.log('[voskSpeechService] Checking native microphone permission...');
    
    const hasResult = await VoiceRecorder.hasAudioRecordingPermission();
    console.log('[voskSpeechService] hasAudioRecordingPermission:', hasResult.value);
    
    if (hasResult.value) {
      return { granted: true };
    }

    console.log('[voskSpeechService] Requesting microphone permission...');
    const requestResult = await VoiceRecorder.requestAudioRecordingPermission();
    console.log('[voskSpeechService] requestAudioRecordingPermission:', requestResult.value);
    
    return { granted: requestResult.value };
  } catch (error) {
    console.error('[voskSpeechService] Native permission error:', error);
    return { granted: false };
  }
};

const startRecognition = async (language: string = 'en-us'): Promise<void> => {
  if (!isModelReady) {
    throw new Error('Speech model is not ready. Please download it first.');
  }

  console.log('[voskSpeechService] Starting recognition for language:', language);

  try {
    await OfflineSpeechRecognition.startRecognition({ language });
    console.log('[voskSpeechService] Recognition started');
  } catch (error) {
    console.error('[voskSpeechService] startRecognition error:', error);
    throw error;
  }
};

const stopRecognition = async (): Promise<void> => {
  console.log('[voskSpeechService] Stopping recognition');

  try {
    await OfflineSpeechRecognition.stopRecognition();
    console.log('[voskSpeechService] Recognition stopped');
  } catch (error) {
    console.error('[voskSpeechService] stopRecognition error:', error);
  }
};

const addResultListener = async (
  onResult: (text: string, isFinal: boolean) => void
): Promise<() => Promise<void>> => {
  console.log('[voskSpeechService] Adding result listener');

  try {
    const listener = await OfflineSpeechRecognition.addListener('recognitionResult', (result) => {
      console.log('[voskSpeechService] Recognition result:', result.text, 'isFinal:', result.isFinal);
      if (result.text) {
        onResult(result.text, result.isFinal);
      }
    });

    recognitionCleanup = async () => {
      try {
        listener.remove();
      } catch (e) {
        console.log('[voskSpeechService] Error removing listener:', e);
      }
    };

    return recognitionCleanup;
  } catch (error) {
    console.error('[voskSpeechService] addResultListener error:', error);
    return async () => {};
  }
};

const cleanup = async (): Promise<void> => {
  console.log('[voskSpeechService] Cleaning up');

  try {
    await stopRecognition();
  } catch {
    // ignore
  }

  try {
    await OfflineSpeechRecognition.removeAllListeners();
  } catch {
    // ignore
  }

  recognitionCleanup = null;
};

const getSupportedLanguages = async (): Promise<string[]> => {
  try {
    const { languages } = await OfflineSpeechRecognition.getSupportedLanguages();
    return languages.map(l => l.code);
  } catch (error) {
    console.error('[voskSpeechService] getSupportedLanguages error:', error);
    return [];
  }
};

export default {
  isNativePlatform,
  isReady,
  getAvailability,
  initialize,
  downloadModel,
  ensurePermission,
  startRecognition,
  stopRecognition,
  addResultListener,
  cleanup,
  getSupportedLanguages,
};
