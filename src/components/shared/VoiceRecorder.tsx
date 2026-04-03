import React, { useState, useRef, useEffect } from 'react';
import MicrophoneIcon from '../icons/MicrophoneIcon';
import toastService from '../../services/toastService';
import nativeAudioRecorder from '../../services/nativeAudioRecorder';

interface VoiceRecorderProps {
  onNewMessage: (audioUrl: string, duration: number) => void;
  disabled?: boolean;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onNewMessage, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isNativeMode, setIsNativeMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const checkNative = () => {
      const native = nativeAudioRecorder.isNative();
      setIsNativeMode(native);
      console.log('[VoiceRecorder] Native mode:', native);
    };
    checkNative();
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setRecordingTime(0);
    timerIntervalRef.current = setInterval(() => {
      setRecordingTime(prevTime => prevTime + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startNativeRecording = async () => {
    try {
      console.log('[VoiceRecorder] Starting native recording...');
      
      const permission = await nativeAudioRecorder.ensurePermission();
      console.log('[VoiceRecorder] Permission result:', permission);
      
      if (!permission.granted) {
        toastService.show('Microphone permission is required. Please allow it in app settings.', 'error', 5000);
        return;
      }

      await nativeAudioRecorder.startRecording();
      setIsRecording(true);
      startTimer();
      console.log('[VoiceRecorder] Native recording started successfully');
    } catch (error) {
      console.error('[VoiceRecorder] Native start recording error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not start recording';
      
      if (errorMessage.includes('permission')) {
        toastService.show('Microphone permission denied. Please enable it in app settings.', 'error', 5000);
      } else if (errorMessage.includes('already recording') || errorMessage.includes('MICROPHONE_IN_USE')) {
        toastService.show('Microphone is already in use. Please close other apps using the microphone.', 'error', 5000);
      } else {
        toastService.show('Could not start recording. Please try again.', 'error', 4000);
      }
    }
  };

  const stopNativeRecording = async () => {
    try {
      console.log('[VoiceRecorder] Stopping native recording...');
      stopTimer();
      
      const result = await nativeAudioRecorder.stopRecording();
      console.log('[VoiceRecorder] Native recording result:', result);
      
      setIsRecording(false);

      if (result && result.audioUrl) {
        const duration = result.duration || recordingTime;
        onNewMessage(result.audioUrl, duration);
        console.log('[VoiceRecorder] Native recording saved, duration:', duration);
      } else {
        toastService.show('Recording was too short or failed.', 'warning', 3000);
      }
    } catch (error) {
      console.error('[VoiceRecorder] Native stop recording error:', error);
      setIsRecording(false);
      toastService.show('Failed to save recording. Please try again.', 'error', 4000);
    }
  };

  const startWebRecording = async () => {
    let supportedMimeType = '';
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    
    if (typeof MediaRecorder !== 'undefined') {
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          supportedMimeType = mimeType;
          break;
        }
      }
    }

    if (!supportedMimeType) {
      toastService.show("This browser doesn't support audio recording.", 'error', 5000);
      return;
    }

    try {
      console.log('[VoiceRecorder] Starting web recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: supportedMimeType });

        if (audioBlob.size === 0) {
          console.warn('[VoiceRecorder] Empty audio blob');
          toastService.show('Recording was too short or failed.', 'warning', 3000);
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string | null;
            if (result) {
              onNewMessage(result, recordingTime);
            } else {
              try {
                const audioUrl = URL.createObjectURL(audioBlob);
                onNewMessage(audioUrl, recordingTime);
              } catch (e) {
                console.warn('[VoiceRecorder] Failed to create audio URL:', e);
                toastService.show('Failed to save recording.', 'error', 4000);
              }
            }
          };
          reader.onerror = () => {
            try {
              const audioUrl = URL.createObjectURL(audioBlob);
              onNewMessage(audioUrl, recordingTime);
            } catch (err) {
              console.warn('[VoiceRecorder] Failed to create object URL:', err);
              toastService.show('Failed to save recording.', 'error', 4000);
            }
          };
          reader.readAsDataURL(audioBlob);
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimer();
      console.log('[VoiceRecorder] Web recording started');
    } catch (error) {
      console.error('[VoiceRecorder] Web start recording error:', error);
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toastService.show('Microphone permission denied. Please allow it in browser settings.', 'error', 5000);
        } else if (error.name === 'NotFoundError') {
          toastService.show('No microphone found. Please connect a microphone.', 'error', 5000);
        } else if (error.name === 'NotReadableError') {
          toastService.show('Microphone is busy or unavailable.', 'error', 4000);
        } else {
          toastService.show('Could not start recording. Please try again.', 'error', 4000);
        }
      } else {
        toastService.show('Could not start recording. Please try again.', 'error', 4000);
      }
    }
  };

  const stopWebRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    stopTimer();
  };

  const startRecording = async () => {
    if (isNativeMode) {
      await startNativeRecording();
    } else {
      await startWebRecording();
    }
  };

  const stopRecording = async () => {
    if (isNativeMode) {
      await stopNativeRecording();
    } else {
      stopWebRecording();
    }
  };

  const handleButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex items-center justify-center w-full gap-4">
      <button
        onClick={handleButtonClick}
        disabled={disabled && !isRecording}
        className={`flex-shrink-0 w-16 h-16 rounded-full transition-all duration-200 flex items-center justify-center focus:outline-none touch-feedback ${
            isRecording 
            ? 'bg-gradient-to-br from-[#E07A7A] to-[#C87070] text-white animate-pulse shadow-[0_4px_20px_rgba(224,122,122,0.4)]' 
            : (disabled 
                ? 'glass-card text-[#7A7582] cursor-not-allowed opacity-50'
                : 'bg-gradient-to-br from-[#9A8BB5] to-[#7A6A9A] text-white')
        }`}
        aria-label={isRecording ? 'Stop recording' : (disabled ? 'Enter your name to record' : 'Start recording')}
      >
        <MicrophoneIcon className="w-8 h-8" />
      </button>
      {isRecording && (
        <div className="text-xl font-mono glass-card px-4 py-2 rounded-xl text-[#F5F0E8]">
          {formatTime(recordingTime)}
        </div>
      )}
      {!isRecording && isNativeMode && (
        <span className="text-xs text-[#7A7582]">Native</span>
      )}
    </div>
  );
};

export default VoiceRecorder;
