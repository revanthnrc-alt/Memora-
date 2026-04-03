import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getAICompanionChatResponse, isGeminiConfigured, missingApiKeyError } from '../../services/geminiService';
import MicrophoneIcon from '../icons/MicrophoneIcon';
import voskSpeechService from '../../services/voskSpeechService';
import { useAppContext } from '../../context/AppContext';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>> & {
    [index: number]: ArrayLike<{ transcript: string }> & { isFinal?: boolean };
  };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface AICompanionProps {
  onBack: () => void;
}

interface Message {
  text: string;
  sender: 'user' | 'ai';
}

type VoiceMode = 'native' | 'speech' | 'unsupported' | 'downloading';
type VoiceEngine = 'native' | 'web-speech' | 'text-only';
type VoiceReasonCode =
  | 'ok'
  | 'model_not_downloaded'
  | 'downloading'
  | 'native_permission_denied'
  | 'speech_api_unavailable'
  | 'insecure_context'
  | 'media_devices_unavailable'
  | 'microphone_permission_denied'
  | 'unknown';

type MicPermissionState = PermissionState | 'unsupported' | 'unknown';

interface VoiceDiagnostics {
  nativePlatform: boolean;
  modelDownloaded: boolean;
  microphonePermission: MicPermissionState;
  speechApiSupported: boolean;
  secureContext: boolean;
  mediaDevicesSupported: boolean;
  engine: VoiceEngine;
  reasonCode: VoiceReasonCode;
  reasonMessage: string;
  recommendedAction: string;
  diagnosticsTimestamp: string;
  buildChannel: 'web' | 'android';
}

interface MicReadyResult {
  ok: boolean;
  message?: string;
}

interface VoiceSelfTestResult {
  ok: boolean;
  transcript?: string;
  error?: string;
}

interface DownloadProgress {
  progress: number;
  message: string;
}

const MAX_NATIVE_LISTEN_MS = 30000;
const SELF_TEST_TIMEOUT_MS = 6000;

const isLikelySecureForMic = (): boolean => {
  if (voskSpeechService.isNativePlatform()) return true;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
};

const getSpeechRecognitionAPI = (): SpeechRecognitionConstructor | null =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const toMicPermissionState = (value: unknown): MicPermissionState => {
  const normalized = `${value || ''}`.toLowerCase();
  if (normalized === 'granted') return 'granted';
  if (normalized === 'denied') return 'denied';
  if (normalized === 'prompt') return 'prompt';
  return 'unknown';
};

const getReasonDetails = (reasonCode: VoiceReasonCode): { message: string; action: string } => {
  switch (reasonCode) {
    case 'model_not_downloaded':
      return {
        message: 'Speech recognition model needs to be downloaded.',
        action: 'The model will download automatically. Please wait or check your internet connection.',
      };
    case 'downloading':
      return {
        message: 'Speech recognition model is downloading.',
        action: 'Please wait for the download to complete.',
      };
    case 'native_permission_denied':
      return {
        message: 'Microphone permission is denied.',
        action: 'Enable microphone permission in app settings and reopen the app.',
      };
    case 'speech_api_unavailable':
      return {
        message: 'Web Speech API is unavailable in this browser.',
        action: 'Use Chrome desktop for web voice mode or the Android app for native voice mode.',
      };
    case 'insecure_context':
      return {
        message: 'Voice input requires a secure context.',
        action: 'Use HTTPS or localhost when running the web app.',
      };
    case 'media_devices_unavailable':
      return {
        message: 'Microphone APIs are unavailable in this browser.',
        action: 'Switch to a browser with media device support (Chrome recommended).',
      };
    case 'microphone_permission_denied':
      return {
        message: 'Microphone permission is blocked.',
        action: 'Allow microphone for this app and reload.',
      };
    case 'unknown':
      return {
        message: 'Voice input is unavailable in this environment.',
        action: 'Check diagnostics below for platform and permission details.',
      };
    default:
      return { message: '', action: '' };
  }
};

const collectVoiceDiagnostics = async (): Promise<VoiceDiagnostics> => {
  try {
    let microphonePermission: MicPermissionState = 'unknown';

    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        microphonePermission = status.state;
      } catch {
        microphonePermission = 'unsupported';
      }
    }

    let nativePlatform = false;
    try {
      nativePlatform = voskSpeechService.isNativePlatform();
    } catch {
      nativePlatform = false;
    }

    let modelDownloaded = false;

    if (nativePlatform) {
      try {
        const availability = await voskSpeechService.getAvailability();
        modelDownloaded = availability.modelDownloaded;
      } catch (e) {
        console.error('[AICompanion] Error getting Vosk availability:', e);
        modelDownloaded = false;
      }
    }

    const speechApiSupported = !!getSpeechRecognitionAPI();
    const secureContext = isLikelySecureForMic();
    const mediaDevicesSupported = !!navigator.mediaDevices?.getUserMedia;

    let engine: VoiceEngine = 'text-only';
    let reasonCode: VoiceReasonCode = 'unknown';

    if (nativePlatform) {
      if (modelDownloaded) {
        engine = 'native';
        reasonCode = 'ok';
      } else {
        engine = 'native';
        reasonCode = 'model_not_downloaded';
      }
    } else if (!speechApiSupported) {
      reasonCode = 'speech_api_unavailable';
    } else if (!secureContext) {
      reasonCode = 'insecure_context';
    } else if (!mediaDevicesSupported) {
      reasonCode = 'media_devices_unavailable';
    } else if (microphonePermission === 'denied') {
      reasonCode = 'microphone_permission_denied';
    } else {
      engine = 'web-speech';
      reasonCode = 'ok';
    }

    const reasonDetails = getReasonDetails(reasonCode);

    return {
      nativePlatform,
      modelDownloaded,
      microphonePermission,
      speechApiSupported,
      secureContext,
      mediaDevicesSupported,
      engine,
      reasonCode,
      reasonMessage: reasonDetails.message,
      recommendedAction: reasonDetails.action,
      diagnosticsTimestamp: new Date().toISOString(),
      buildChannel: nativePlatform ? 'android' : 'web',
    };
  } catch (error) {
    console.error('[AICompanion] collectVoiceDiagnostics crashed:', error);
    return createFallbackDiagnostics(
      'Voice diagnostics collection crashed unexpectedly.',
      'Reopen the app. If this continues, rebuild and reinstall the Android app.'
    );
  }
};

const diagnosticsReason = (d: VoiceDiagnostics): string => {
  if (d.reasonCode === 'ok') return '';
  if (d.recommendedAction) return `${d.reasonMessage} ${d.recommendedAction}`;
  return d.reasonMessage || 'Voice input is unavailable in this environment.';
};

const createFallbackDiagnostics = (reasonMessage: string, recommendedAction: string): VoiceDiagnostics => ({
  nativePlatform: false,
  modelDownloaded: false,
  microphonePermission: 'unknown',
  speechApiSupported: false,
  secureContext: isLikelySecureForMic(),
  mediaDevicesSupported: !!navigator.mediaDevices?.getUserMedia,
  engine: 'text-only',
  reasonCode: 'unknown',
  reasonMessage,
  recommendedAction,
  diagnosticsTimestamp: new Date().toISOString(),
  buildChannel: 'web',
});

const AICompanion: React.FC<AICompanionProps> = ({ onBack }) => {
  const { state } = useAppContext();
  const devMode = state.devMode;
  const [messages, setMessages] = useState<Message[]>(() => [
    { sender: 'ai', text: isGeminiConfigured ? "Hello! I'm Digi, your friendly companion. How are you feeling today?" : missingApiKeyError }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceSelfTesting, setIsVoiceSelfTesting] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('unsupported');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [voiceSelfTestMessage, setVoiceSelfTestMessage] = useState<string | null>(null);
  const [voiceDiagnostics, setVoiceDiagnostics] = useState<VoiceDiagnostics | null>(null);
  const [copyDiagnosticsMessage, setCopyDiagnosticsMessage] = useState<string | null>(null);

  const diagnosticsPayload = voiceDiagnostics
    ? JSON.stringify({
      engine: voiceDiagnostics.engine,
      reasonCode: voiceDiagnostics.reasonCode,
      nativePlatform: voiceDiagnostics.nativePlatform,
      modelDownloaded: voiceDiagnostics.modelDownloaded,
      microphonePermission: voiceDiagnostics.microphonePermission,
      speechApiSupported: voiceDiagnostics.speechApiSupported,
      secureContext: voiceDiagnostics.secureContext,
      mediaDevicesSupported: voiceDiagnostics.mediaDevicesSupported,
      diagnosticsTimestamp: voiceDiagnostics.diagnosticsTimestamp,
      buildChannel: voiceDiagnostics.buildChannel,
    })
    : '';

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');
  const isLoadingRef = useRef(false);
  const startInFlightRef = useRef(false);
  const stopInFlightRef = useRef(false);
  const abortRetryTimerRef = useRef<number | null>(null);
  const abortRetryCountRef = useRef(0);
  const userStopRequestedRef = useRef(false);
  const heardSpeechRef = useRef(false);
  const sessionStartedAtRef = useRef<number>(0);
  const nativeStopTimerRef = useRef<number | null>(null);
  const nativeStopInFlightRef = useRef(false);
  const nativeListenerCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const nativeErrorCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const handleSendText = useCallback(async (rawText: string) => {
    const textToSend = rawText.trim();
    if (textToSend === '' || isLoadingRef.current) return;

    const userMessage: Message = { text: textToSend, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setSpeechError(null);
    setIsLoading(true);
    setInput('');
    try {
      const aiResponseText = await getAICompanionChatResponse(textToSend);
      const aiMessage: Message = { text: aiResponseText, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    await handleSendText(input);
  }, [handleSendText, input]);

  const refreshVoiceDiagnostics = useCallback(async (): Promise<VoiceDiagnostics> => {
    try {
      const diagnostics = await collectVoiceDiagnostics();
      setVoiceDiagnostics(diagnostics);
      return diagnostics;
    } catch (error) {
      console.error('Voice diagnostics collection failed:', error);
      const fallback = createFallbackDiagnostics(
        'Voice diagnostics could not be initialized.',
        'Reopen the app. If this continues, rebuild and reinstall the Android app.'
      );
      setVoiceDiagnostics(fallback);
      return fallback;
    }
  }, []);

  const clearAbortRetryTimer = () => {
    if (abortRetryTimerRef.current) {
      window.clearTimeout(abortRetryTimerRef.current);
      abortRetryTimerRef.current = null;
    }
  };

  const clearNativeStopTimer = () => {
    if (nativeStopTimerRef.current) {
      window.clearTimeout(nativeStopTimerRef.current);
      nativeStopTimerRef.current = null;
    }
  };

  const clearNativeSessionResources = useCallback(async () => {
    clearNativeStopTimer();
    if (nativeListenerCleanupRef.current) {
      try {
        await nativeListenerCleanupRef.current();
      } catch {
        // no-op
      }
      nativeListenerCleanupRef.current = null;
    }
    if (nativeErrorCleanupRef.current) {
      try {
        await nativeErrorCleanupRef.current();
      } catch {
        // no-op
      }
      nativeErrorCleanupRef.current = null;
    }
  }, []);

  const ensureMicrophoneReady = useCallback(async (): Promise<MicReadyResult> => {
    const diagnostics = await refreshVoiceDiagnostics();
    if (!diagnostics.secureContext) {
      return { ok: false, message: 'Voice input requires HTTPS (or localhost).' };
    }
    if (!diagnostics.mediaDevicesSupported) {
      return { ok: false, message: 'Microphone APIs are not available in this browser.' };
    }

    if (diagnostics.microphonePermission === 'denied') {
      return { ok: false, message: 'Microphone permission denied. Allow it in browser settings and reload.' };
    }

    if (diagnostics.microphonePermission === 'granted') {
      return { ok: true };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      await refreshVoiceDiagnostics();
      return { ok: true };
    } catch (error) {
      await refreshVoiceDiagnostics();
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          return { ok: false, message: 'Microphone permission denied. Allow it in browser settings and reload.' };
        }
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          return { ok: false, message: 'No microphone device was found.' };
        }
        if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          return { ok: false, message: 'Microphone is busy or unavailable to the browser.' };
        }
        if (error.name === 'AbortError') {
          return { ok: false, message: 'Microphone permission prompt was interrupted. Please try again.' };
        }
      }
      return { ok: false, message: 'Could not access microphone. Please try again.' };
    }
  }, [refreshVoiceDiagnostics]);

  const runNativeVoiceSelfTest = useCallback(async (): Promise<VoiceSelfTestResult> => {
    const diagnostics = await refreshVoiceDiagnostics();
    if (!diagnostics.modelDownloaded) {
      return { ok: false, error: 'Speech model is not downloaded. Please wait for download to complete.' };
    }

    const permission = await voskSpeechService.ensurePermission();
    if (!permission.granted) {
      return { ok: false, error: 'Microphone permission was denied.' };
    }

    let removeListener: (() => Promise<void>) | null = null;
    let timeoutId: number | null = null;
    let resolved = false;
    let heardText = '';

    const resolveOnce = (value: VoiceSelfTestResult, resolve: (result: VoiceSelfTestResult) => void) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    try {
      await voskSpeechService.cleanup();
      
      const capture = new Promise<VoiceSelfTestResult>((resolve) => {
        const start = async () => {
          removeListener = await voskSpeechService.addResultListener((text: string, isFinal: boolean) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            heardText = trimmed;
            if (isFinal) {
              resolveOnce({ ok: true, transcript: trimmed }, resolve);
            }
          });

          await voskSpeechService.startRecognition('en-us');

          timeoutId = window.setTimeout(() => {
            resolveOnce({ ok: false, error: 'No transcript received before timeout.' }, resolve);
          }, SELF_TEST_TIMEOUT_MS);
        };

        void start().catch((error) => {
          resolveOnce(
            { ok: false, error: `Native self-test failed to start: ${(error as Error)?.message || 'unknown error'}` },
            resolve
          );
        });
      });

      const result = await capture;
      await voskSpeechService.stopRecognition();
      
      const transcript = result.transcript || heardText;
      if (transcript) {
        return { ok: true, transcript };
      }
      return result.ok ? { ok: false, error: 'Self-test finished without transcript.' } : result;
    } catch (error) {
      return { ok: false, error: `Native self-test failed: ${(error as Error)?.message || 'unknown error'}` };
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      try {
        await voskSpeechService.stopRecognition();
      } catch {
        // no-op
      }
      if (removeListener) {
        try {
          await (removeListener as () => Promise<void>)();
        } catch {
          // no-op
        }
      }
    }
  }, [refreshVoiceDiagnostics]);

  const runWebVoiceSelfTest = useCallback(async (): Promise<VoiceSelfTestResult> => {
    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI) {
      return { ok: false, error: 'Browser speech recognition is unavailable.' };
    }

    const micReady = await ensureMicrophoneReady();
    if (!micReady.ok) {
      return { ok: false, error: micReady.message || 'Microphone is not ready.' };
    }

    return new Promise<VoiceSelfTestResult>((resolve) => {
      const recognition = new SpeechRecognitionAPI();
      let completed = false;
      let heardText = '';

      const finish = (result: VoiceSelfTestResult) => {
        if (completed) return;
        completed = true;
        window.clearTimeout(timeoutId);
        try {
          recognition.stop();
        } catch {
          // no-op
        }
        resolve(result);
      };

      const timeoutId = window.setTimeout(() => {
        finish({ ok: false, error: 'No transcript received before timeout.' });
      }, SELF_TEST_TIMEOUT_MS);

      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const start = event.resultIndex ?? 0;
        let latest = '';
        for (let i = start; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result && result[0]) {
            const chunk = result[0].transcript?.trim() || '';
            if (!chunk) continue;
            latest = chunk;
          }
        }
        if (latest) {
          heardText = latest;
          finish({ ok: true, transcript: latest });
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        finish({ ok: false, error: `Browser self-test failed (${event.error || 'unknown'}).` });
      };

      recognition.onend = () => {
        if (!completed) {
          finish(heardText ? { ok: true, transcript: heardText } : { ok: false, error: 'Speech session ended without transcript.' });
        }
      };

      try {
        recognition.start();
      } catch (error) {
        finish({ ok: false, error: `Could not start browser self-test: ${(error as Error)?.message || 'unknown error'}` });
      }
    });
  }, [ensureMicrophoneReady]);

  const finalizeTranscript = useCallback(async (
    manualStop: boolean,
    source: 'native' | 'web',
    extraTranscript?: string
  ) => {
    const base = transcriptRef.current.trim();
    const extra = (extraTranscript || '').trim();
    const transcript = [extra, base].sort((a, b) => b.length - a.length).find(Boolean) || '';
    const sessionDurationMs = sessionStartedAtRef.current ? Date.now() - sessionStartedAtRef.current : 0;

    transcriptRef.current = '';
    setIsListening(false);

    if (transcript) {
      await handleSendText(transcript);
      return;
    }

    if (!manualStop) return;

    if (!heardSpeechRef.current && sessionDurationMs >= 2000) {
      const message = source === 'native'
        ? 'No transcript was returned by native speech. Check device speech language settings and Google speech services.'
        : 'No transcript was returned by this browser. Try Chrome, or keep speaking and wait for words to appear before stopping.';
      setSpeechError(message);
      return;
    }

    setSpeechError('No speech captured. Try speaking a bit longer before tapping stop.');
  }, [handleSendText]);

  const stopNativeListening = useCallback(async (manualStop: boolean) => {
    console.log('[AICompanion] stopNativeListening called, manualStop:', manualStop, 'inFlight:', nativeStopInFlightRef.current);
    if (nativeStopInFlightRef.current) {
      console.log('[AICompanion] stopNativeListening blocked - already in flight');
      return;
    }
    nativeStopInFlightRef.current = true;
    try {
      clearAbortRetryTimer();
      clearNativeStopTimer();
      startInFlightRef.current = false;
      setIsListening(false);

      console.log('[AICompanion] Calling voskSpeechService.stopRecognition()');
      try {
        await voskSpeechService.stopRecognition();
        console.log('[AICompanion] stopRecognition completed');
      } catch (e) {
        console.error('[AICompanion] stopRecognition error:', e);
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 200);
      });

      await clearNativeSessionResources();
      await finalizeTranscript(manualStop, 'native', '');
    } catch (e) {
      console.error('[AICompanion] stopNativeListening error:', e);
    } finally {
      nativeStopInFlightRef.current = false;
      console.log('[AICompanion] stopNativeListening completed');
    }
  }, [clearNativeSessionResources, finalizeTranscript]);

  const startNativeListening = useCallback(async () => {
    console.log('[AICompanion] startNativeListening called');
    if (startInFlightRef.current || isLoadingRef.current) {
      console.log('[AICompanion] startNativeListening blocked - startInFlight:', startInFlightRef.current, 'isLoading:', isLoadingRef.current);
      return;
    }
    startInFlightRef.current = true;

    try {
      const diagnostics = await refreshVoiceDiagnostics();
      if (diagnostics.engine !== 'native') {
        setSpeechError(diagnosticsReason(diagnostics) || 'Native speech is unavailable in this app build.');
        setVoiceMode('unsupported');
        return;
      }

      if (!diagnostics.modelDownloaded) {
        setSpeechError('Speech model is not downloaded. Please wait for download to complete.');
        setVoiceMode('downloading');
        return;
      }

      const permission = await voskSpeechService.ensurePermission();
      if (!permission.granted) {
        setSpeechError('Microphone permission is required. Please allow it and try again.');
        return;
      }

      await clearNativeSessionResources();
      await voskSpeechService.cleanup();
      
      transcriptRef.current = '';
      heardSpeechRef.current = false;
      userStopRequestedRef.current = false;
      sessionStartedAtRef.current = Date.now();
      setSpeechError(null);
      setInput('');

      console.log('[AICompanion] Setting up result listener');
      nativeListenerCleanupRef.current = await voskSpeechService.addResultListener(
        (text: string, isFinal: boolean) => {
          console.log('[AICompanion] Result received:', text, 'isFinal:', isFinal);
          if (!text) return;
          heardSpeechRef.current = true;
          transcriptRef.current = text;
          setInput(text);
        }
      );

      console.log('[AICompanion] Calling startRecognition');
      await voskSpeechService.startRecognition('en-us');
      
      console.log('[AICompanion] startRecognition completed, setting isListening=true');
      setIsListening(true);

      nativeStopTimerRef.current = window.setTimeout(() => {
        console.log('[AICompanion] Max listen time reached, auto-stopping');
        void stopNativeListening(false);
      }, MAX_NATIVE_LISTEN_MS);
    } catch (error) {
      console.error('Failed to start native speech recognition:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSpeechError(`Could not start speech recognition: ${errorMessage}. Please try again.`);
      await clearNativeSessionResources();
      setIsListening(false);
    } finally {
      startInFlightRef.current = false;
    }
  }, [clearNativeSessionResources, refreshVoiceDiagnostics, stopNativeListening]);

  useEffect(() => {
    let active = true;

    const initVoice = async () => {
      try {
        const diagnostics = await refreshVoiceDiagnostics();
        if (!active) return;

        if (diagnostics.engine === 'native') {
          if (diagnostics.reasonCode === 'model_not_downloaded') {
            setVoiceMode('downloading');
            setSpeechError('Downloading speech model... This may take a moment.');
          } else if (diagnostics.reasonCode === 'native_permission_denied') {
            setVoiceMode('native');
            setSpeechError(diagnosticsReason(diagnostics));
          } else {
            setVoiceMode('native');
            setSpeechError(null);
          }
          return;
        }

        if (diagnostics.engine === 'text-only') {
          setVoiceMode('unsupported');
          setSpeechError(diagnosticsReason(diagnostics));
          return;
        }

        setVoiceMode('speech');
        if (diagnostics.reasonCode !== 'ok') {
          setSpeechError(diagnosticsReason(diagnostics));
        } else {
          setSpeechError(null);
        }

        const SpeechRecognitionAPI = getSpeechRecognitionAPI();
        if (!SpeechRecognitionAPI) {
          setVoiceMode('unsupported');
          setSpeechError(diagnosticsReason(diagnostics));
          return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = true;

        recognition.onstart = () => {
          startInFlightRef.current = false;
          stopInFlightRef.current = false;
          clearAbortRetryTimer();
          abortRetryCountRef.current = 0;
          userStopRequestedRef.current = false;
          heardSpeechRef.current = false;
          sessionStartedAtRef.current = Date.now();
          transcriptRef.current = '';
          setSpeechError(null);
          setIsListening(true);
        };

        recognition.onend = () => {
          startInFlightRef.current = false;
          stopInFlightRef.current = false;
          const wasManualStop = userStopRequestedRef.current;
          userStopRequestedRef.current = false;
          void finalizeTranscript(wasManualStop, 'web');
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          const start = event.resultIndex ?? 0;
          const finalChunks: string[] = [];
          let interimLatest = '';
          for (let i = start; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (result && result[0]) {
              const chunk = result[0].transcript?.trim() || '';
              if (!chunk) continue;
              if ((result as any).isFinal) {
                finalChunks.push(chunk);
              } else {
                interimLatest = chunk;
              }
            }
          }
          const latest = finalChunks.join(' ').trim() || interimLatest;
          if (latest) {
            heardSpeechRef.current = true;
            transcriptRef.current = latest;
            setInput(latest);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          const error = event.error || '';
          startInFlightRef.current = false;
          stopInFlightRef.current = false;
          if (error === 'aborted' && userStopRequestedRef.current) {
            clearAbortRetryTimer();
            setIsListening(false);
            return;
          }
          if (error === 'not-allowed' || error === 'service-not-allowed') {
            setSpeechError('Microphone access was denied. Allow microphone in browser site settings, then reload.');
          } else if (error === 'audio-capture') {
            setSpeechError('No working microphone was detected by the browser.');
          } else if (error === 'network') {
            setSpeechError('Speech recognition network error. Check internet connection and try again.');
          } else if (error === 'aborted') {
            if (abortRetryCountRef.current < 1 && recognitionRef.current && !isLoadingRef.current) {
              abortRetryCountRef.current += 1;
              setSpeechError('Voice input was interrupted. Retrying once...');
              clearAbortRetryTimer();
              abortRetryTimerRef.current = window.setTimeout(() => {
                if (!recognitionRef.current || isLoadingRef.current) return;
                try {
                  startInFlightRef.current = true;
                  recognitionRef.current.start();
                } catch {
                  startInFlightRef.current = false;
                  setSpeechError('Voice input failed (aborted). Tap mic and try again after permission prompt closes.');
                }
              }, 300);
            } else {
              setSpeechError('Voice input failed (aborted). Tap mic and try again after permission prompt closes.');
            }
          } else if (error === 'no-speech') {
            setSpeechError('No speech detected. Speak clearly and try again.');
          } else if (error === 'language-not-supported') {
            setSpeechError('Selected language is not supported by browser speech recognition.');
          } else {
            setSpeechError(`Voice input failed${error ? ` (${error})` : ''}. Please try again.`);
          }
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (error) {
        console.error('Voice initialization failed:', error);
        const fallback = createFallbackDiagnostics(
          'Voice initialization crashed before diagnostics completed.',
          'Rebuild/reinstall the app and ensure you are opening the native Android app, not browser dev URL.'
        );
        setVoiceDiagnostics(fallback);
        setVoiceMode('unsupported');
        setSpeechError(diagnosticsReason(fallback));
      }
    };

    void initVoice();

    return () => {
      active = false;
      clearAbortRetryTimer();
      stopInFlightRef.current = false;
      userStopRequestedRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      void clearNativeSessionResources().catch(() => {});
      void voskSpeechService.stopRecognition().catch(() => {});
    };
  }, [clearNativeSessionResources, finalizeTranscript, refreshVoiceDiagnostics]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden' || !isListening) return;
      if (voiceMode === 'native') {
        void stopNativeListening(false);
      } else if (voiceMode === 'speech' && recognitionRef.current) {
        userStopRequestedRef.current = false;
        try {
          recognitionRef.current.stop();
        } catch {
          // no-op
        }
      }
      setSpeechError('Voice session was interrupted because the app was backgrounded. Tap mic to try again.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isListening, stopNativeListening, voiceMode]);

  const handleListen = async () => {
    if (isVoiceSelfTesting) return;

    if (voiceMode === 'native') {
      if (isListening) {
        await stopNativeListening(true);
      } else {
        await startNativeListening();
      }
      return;
    }

    if (voiceMode === 'unsupported' || !recognitionRef.current) {
      if (voiceDiagnostics) {
        setSpeechError(diagnosticsReason(voiceDiagnostics));
      } else {
        setSpeechError('Voice input is unavailable in this browser.');
      }
      return;
    }

    if (isListening) {
      if (stopInFlightRef.current) return;
      stopInFlightRef.current = true;
      userStopRequestedRef.current = true;
      clearAbortRetryTimer();
      recognitionRef.current.stop();
      return;
    }

    if (startInFlightRef.current) {
      return;
    }

    const micReady = await ensureMicrophoneReady();
    if (!micReady.ok) {
      setSpeechError(micReady.message || 'Microphone is not ready for voice input.');
      return;
    }

    transcriptRef.current = '';
    setInput('');
    setSpeechError(null);

    try {
      startInFlightRef.current = true;
      recognitionRef.current.start();
    } catch (error) {
      startInFlightRef.current = false;
      console.error('Failed to start speech recognition:', error);
      setSpeechError('Could not start speech recognition. Try reloading and allowing microphone access.');
    }
  };

  const handleRunVoiceSelfTest = useCallback(async () => {
    if (isLoading || isListening || isVoiceSelfTesting) return;

    setVoiceSelfTestMessage('Running voice self-test... speak now.');
    setSpeechError(null);
    setIsVoiceSelfTesting(true);

    try {
      const diagnostics = await refreshVoiceDiagnostics();
      let result: VoiceSelfTestResult;

      if (diagnostics.engine === 'native') {
        result = await runNativeVoiceSelfTest();
      } else if (diagnostics.engine === 'web-speech') {
        result = await runWebVoiceSelfTest();
      } else {
        result = { ok: false, error: diagnosticsReason(diagnostics) };
      }

      if (result.ok) {
        const transcript = (result.transcript || '').trim();
        setVoiceSelfTestMessage(
          transcript
            ? `Voice self-test passed. Heard: "${transcript}".`
            : 'Voice self-test passed.'
        );
      } else {
        setVoiceSelfTestMessage(`Voice self-test failed. ${result.error || 'No transcript returned.'}`);
      }
    } finally {
      setIsVoiceSelfTesting(false);
    }
  }, [
    isLoading,
    isListening,
    isVoiceSelfTesting,
    refreshVoiceDiagnostics,
    runNativeVoiceSelfTest,
    runWebVoiceSelfTest,
  ]);

  const handleCopyDiagnostics = useCallback(async () => {
    if (!diagnosticsPayload) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(diagnosticsPayload);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      setCopyDiagnosticsMessage('Diagnostics copied.');
    } catch {
      setCopyDiagnosticsMessage('Copy failed. Select diagnostics text manually.');
    }
  }, [diagnosticsPayload]);

  return (
    <div className="relative p-4 sm:p-6 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-hidden flex flex-col glass-card rounded-3xl">
      <header className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center">
          <button onClick={onBack} className="text-[#A8A0B4] text-sm p-2 rounded-xl touch-feedback flex items-center gap-1">
            <span className="text-lg">&larr;</span> Back
          </button>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#E8C4A0] to-[#C9B896] ml-2 text-xl">
            ❤️
          </div>
          <div className="ml-3">
            <h2 className="font-display text-xl font-semibold text-[#F5F0E8]">Your Companion, Digi</h2>
            <p className={`text-xs font-medium ${isGeminiConfigured ? 'text-[#C9B896]' : 'text-[#E8C4A0]'}`}>
              {isGeminiConfigured ? 'Online' : 'Limited'}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-grow min-h-0 my-2 overflow-y-auto pr-2">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-md ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-br from-[rgba(184,169,201,0.4)] to-[rgba(157,138,165,0.3)] text-[#F5F0E8]' 
                    : 'glass-card text-[#A8A0B4]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="glass-card rounded-2xl p-3">
                <div className="flex items-center space-x-1">
                  <span className="h-2 w-2 bg-[#B8A9C9] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-2 w-2 bg-[#B8A9C9] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-2 w-2 bg-[#B8A9C9] rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="mt-auto flex items-center border-t border-[rgba(255,255,255,0.06)] pt-4 gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isListening ? 'Listening...' : 'Type a message...'}
          className="flex-grow px-4 py-3 bg-[rgba(45,36,56,0.5)] border border-[rgba(255,255,255,0.06)] rounded-full text-[#F5F0E8] placeholder-[#7A7582] focus:outline-none focus:border-[rgba(184,169,201,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !isGeminiConfigured}
        />
        <button
          type="button"
          onClick={handleListen}
          disabled={isLoading || isVoiceSelfTesting || !isGeminiConfigured || voiceMode === 'unsupported'}
          className={`flex-shrink-0 w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center focus:outline-none touch-feedback ${
            isListening
              ? 'bg-[#E07A7A] text-white animate-pulse shadow-[0_4px_20px_rgba(224,122,122,0.4)]'
              : 'glass-card text-[#B8A9C9]'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
          title={voiceMode === 'native' ? 'Start native speech recognition' : 'Start browser speech recognition'}
        >
          <MicrophoneIcon className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || isVoiceSelfTesting || input.trim() === '' || !isGeminiConfigured}
          className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white font-bold rounded-full disabled:opacity-50 disabled:cursor-not-allowed touch-feedback flex items-center justify-center"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
        </button>
      </div>

      {speechError && (
        <p className="mt-2 text-sm text-[#E8C4A0]">{speechError}</p>
      )}

      {devMode && (
        <button
          type="button"
          onClick={handleRunVoiceSelfTest}
          disabled={isLoading || isListening || isVoiceSelfTesting}
          className="mt-2 text-left text-xs text-[#A8A0B4] underline underline-offset-2 hover:text-[#F5F0E8] disabled:text-[#7A7582] disabled:no-underline"
        >
          {isVoiceSelfTesting ? 'Running voice self-test...' : 'Run voice self-test'}
        </button>
      )}

      {devMode && voiceSelfTestMessage && (
        <p className="mt-1 text-xs text-[#B8A9C9]">{voiceSelfTestMessage}</p>
      )}
      {devMode && copyDiagnosticsMessage && (
        <p className="mt-1 text-xs text-[#B8A9C9]">{copyDiagnosticsMessage}</p>
      )}

      {devMode && (
        <p className="mt-2 text-xs text-[#7A7582]">
          Voice mode: {voiceMode === 'native' ? 'Native speech recognition' : voiceMode === 'speech' ? 'Browser speech recognition' : 'Unavailable (text only)'}
        </p>
      )}

      {devMode && voiceDiagnostics && (
        <details open className="mt-1 rounded-xl glass-card p-3">
          <summary className="cursor-pointer select-none text-xs text-[#F5F0E8]">Diagnostics</summary>
          <p className="text-xs text-[#A8A0B4]">
            Voice status: {voiceDiagnostics.engine === 'native' ? 'native' : voiceDiagnostics.engine === 'web-speech' ? 'web-speech' : 'text-only'} ({voiceDiagnostics.reasonCode})
          </p>
          {voiceDiagnostics.reasonCode !== 'ok' && (
            <p className="mt-1 text-xs text-[#E8C4A0]">
              {voiceDiagnostics.reasonMessage} {voiceDiagnostics.recommendedAction}
            </p>
          )}
          <button
            type="button"
            onClick={handleCopyDiagnostics}
            className="mt-2 rounded-lg bg-[rgba(45,36,56,0.5)] px-3 py-1.5 text-[10px] text-[#F5F0E8] hover:bg-[rgba(45,36,56,0.7)] transition-colors"
          >
            Copy diagnostics
          </button>
          <textarea
            className="mt-2 h-16 w-full resize-none rounded-lg bg-[rgba(26,20,35,0.8)] p-2 text-[10px] text-[#A8A0B4] border border-[rgba(255,255,255,0.06)]"
            readOnly
            value={diagnosticsPayload}
            aria-label="Voice diagnostics"
          />
        </details>
      )}
    </div>
  );
};

export default AICompanion;
