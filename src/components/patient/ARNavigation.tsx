import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDeviceSensors } from '../../hooks/useDeviceSensors';
import { useBeaconScanner } from '../../hooks/useBeaconScanner';
import { normalizeAngle } from '../../utils/navigation';
import CalibrationModal from './ARNavigation/CalibrationModal';
import NavigationArrow from './ARNavigation/NavigationArrow';
import DebugOverlay from './ARNavigation/DebugOverlay';

// --- Configuration ---
const DESTINATION_BEARING = 296; // Target bearing in degrees (e.g., 296° NW)
const TOTAL_STEPS = 10;
const ARRIVAL_THRESHOLD_STEPS = 0.5;
// PDR (Step Detection) Config
const STEP_THRESHOLD = 1.8; // Linear acceleration magnitude threshold in m/s^2.
const STEP_LOCKOUT_MS = 400; // Cooldown to prevent double counting a single step
// Beacon Checkpoint Config
const BEACON_CHECKPOINTS = [
    { name: 'Memora-Hallway', step_checkpoint: 5, proximity_m: 1.5 }
];


interface ARNavigationProps {
  onBack: () => void;
}

type NavState = 'REQUESTING_PERMISSIONS' | 'CALIBRATING' | 'NAVIGATING' | 'ARRIVED';

const ARNavigation: React.FC<ARNavigationProps> = ({ onBack }) => {
  const [navState, setNavState] = useState<NavState>('REQUESTING_PERMISSIONS');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Sensor and Navigation State ---
  const { heading, linearAcceleration, permissionState, requestPermissions } = useDeviceSensors();
  const { beacons, isScanning, startScan } = useBeaconScanner();
  const [steps, setSteps] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isSteppingAnimation, setIsSteppingAnimation] = useState(false);


  // --- Dev Mode ---
  const [devMode, setDevMode] = useState(false);
  const [simulatedHeading, setSimulatedHeading] = useState(296);

  const effectiveHeading = devMode ? simulatedHeading : heading;

  // --- Step Detection Logic ---
  const lastStepTimeRef = useRef(0);
  const isPotentialStepRef = useRef(false);

  useEffect(() => {
    if (navState !== 'NAVIGATING' || !linearAcceleration) return;

    const { x, y, z } = linearAcceleration;
    const magnitude = Math.sqrt(x * x + y * y + z * z); // Magnitude is in m/s^2

    const now = Date.now();
    if (now - lastStepTimeRef.current < STEP_LOCKOUT_MS) return;

    // A simple peak-detection logic: step is counted when acceleration rises above
    // a threshold and then drops below it, indicating a complete motion.
    if (magnitude > STEP_THRESHOLD && !isPotentialStepRef.current) {
        isPotentialStepRef.current = true; // We've started a potential step
    } else if (magnitude < (STEP_THRESHOLD * 0.7) && isPotentialStepRef.current) {
        // We've crossed the threshold and now dropped significantly, confirming the step
        isPotentialStepRef.current = false;
        lastStepTimeRef.current = now;
        setSteps(s => {
            const newSteps = s + 1;
            // Trigger animation for visual feedback
            setIsSteppingAnimation(true);
            setTimeout(() => setIsSteppingAnimation(false), 300); // Animation duration
            return Math.min(newSteps, TOTAL_STEPS);
        });
    }
  }, [linearAcceleration, navState]);
  
  // --- Beacon Drift Correction ---
  useEffect(() => {
    if (navState !== 'NAVIGATING' || beacons.length === 0) return;

    for (const beacon of beacons) {
        const checkpoint = BEACON_CHECKPOINTS.find(cp => cp.name === beacon.name);
        if (checkpoint && beacon.distance < checkpoint.proximity_m) {
            // Correct the step count if we are closer to a known checkpoint
            // and our current step count is lower than the checkpoint's value.
            setSteps(currentSteps => {
                if(currentSteps < checkpoint.step_checkpoint) {
                    if (import.meta.env.DEV) {
                      console.debug(`Drift corrected by ${checkpoint.name}. Steps updated to ${checkpoint.step_checkpoint}`);
                    }
                    return checkpoint.step_checkpoint;
                }
                return currentSteps;
            });
        }
    }
  }, [beacons, navState]);

  // --- State Machine and Permissions ---
  useEffect(() => {
    if (navState === 'REQUESTING_PERMISSIONS' && permissionState === 'granted') {
      setNavState('CALIBRATING');
    }
  }, [permissionState, navState]);

  // --- Stream Cleanup ---
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // --- Attach stream to video element when navigating ---
  useEffect(() => {
    if (navState === 'NAVIGATING' && videoRef.current && streamRef.current) {
        if(videoRef.current.srcObject !== streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }
  }, [navState]);


  // --- Arrival Logic ---
  useEffect(() => {
    if (steps >= TOTAL_STEPS - ARRIVAL_THRESHOLD_STEPS) {
      setNavState('ARRIVED');
    }
  }, [steps]);

  // --- UI Event Handlers ---
  const handleStart = async () => {
    setPermissionError(null);
    let motionGranted = false;
    if (permissionState === 'granted') {
        motionGranted = true;
    } else {
        motionGranted = await requestPermissions();
    }
    
    if (!motionGranted) {
        setPermissionError("Motion sensor access is required. Please enable it in your browser settings.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        setNavState('CALIBRATING');
    } catch (err) {
        console.error("Permission error:", err);
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
             setPermissionError("Camera access was denied. Please enable it in your browser settings.");
        } else {
             setPermissionError("Could not access camera. It may be in use by another app.");
        }
    }
  };


  const handleCalibrationComplete = () => {
    setIsCalibrated(true);
    setNavState('NAVIGATING');
  };

  const handleFinish = () => {
    // Proactively stop the camera stream before telling the parent to unmount.
    // This prevents race conditions where the component unmounts before cleanup effects run.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Now, trigger the navigation back to the home screen.
    onBack();
  };
  
  const relativeBearing = useMemo(() => {
    if (effectiveHeading === null) return 0;
    return normalizeAngle(DESTINATION_BEARING - effectiveHeading);
  }, [effectiveHeading]);

  const stepsRemaining = Math.max(0, TOTAL_STEPS - steps);

  const renderContent = () => {
    switch (navState) {
      case 'REQUESTING_PERMISSIONS':
        return (
          <div className="flex flex-col items-center justify-center text-center h-full text-[#F5F0E8] p-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] mb-6 text-3xl">
              🧭
            </div>
            <h2 className="font-display text-3xl font-semibold">AR Navigation</h2>
            <p className="mt-3 text-[#A8A0B4] max-w-xs">This feature requires access to your camera and motion sensors.</p>
            <button
              onClick={handleStart}
              className="mt-8 px-8 py-4 bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white font-semibold text-lg rounded-full shadow-lg touch-feedback disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Grant Permissions
            </button>
            {permissionError && <p className="text-sm text-[#E07A7A] mt-4 max-w-xs">{permissionError}</p>}
          </div>
        );

      case 'CALIBRATING':
        return <CalibrationModal onComplete={handleCalibrationComplete} />;

      case 'NAVIGATING':
        return (
          <>
            <NavigationArrow relativeBearing={relativeBearing} />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full px-4 text-center">
                <p className="text-[#F5F0E8] text-5xl font-bold drop-shadow-2xl">{stepsRemaining.toFixed(0)}</p>
                <p className="text-[#A8A0B4] text-xl font-medium drop-shadow-lg">steps remaining</p>
            </div>
          </>
        );

      case 'ARRIVED':
        return (
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
                <div className="relative overflow-hidden rounded-2xl glass-card p-6 text-center shadow-2xl">
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="text-5xl mb-4">🎉</div>
                        <h2 className="font-display text-3xl font-semibold text-[#F5F0E8]">You have arrived!</h2>
                        <p className="text-[#A8A0B4] mt-1">You've reached your destination.</p>
                        <button
                          onClick={handleFinish}
                          className="mt-6 w-full px-8 py-3 bg-gradient-to-br from-[#C9B896] to-[#B8A9C9] text-white font-semibold text-lg rounded-full shadow-lg touch-feedback"
                        >
                          Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1423] overflow-hidden flex flex-col justify-between">
      <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/30"></div>
      
      <header className="relative p-4 flex justify-between items-center glass-card z-10 rounded-none border-b border-[rgba(255,255,255,0.06)]">
        <button onClick={handleFinish} className="text-[#F5F0E8] text-sm p-2 rounded-xl glass-card touch-feedback flex items-center gap-1">
            <span className='text-lg'>&larr;</span> Back
        </button>
        <div className="flex items-center gap-2 text-xs text-[#A8A0B4]">
            <label htmlFor="devModeToggle">Dev Mode</label>
            <input
                type="checkbox"
                id="devModeToggle"
                checked={devMode}
                onChange={() => setDevMode(!devMode)}
                className="toggle-checkbox"
            />
        </div>
      </header>

      <main className={`relative flex-grow flex flex-col items-center justify-center text-[#F5F0E8] p-4 transition-transform duration-300 ${isSteppingAnimation ? 'animate-step-bump' : ''}`}>
        {renderContent()}
      </main>

      {devMode && navState === 'NAVIGATING' && (
        <DebugOverlay
            deviceHeading={heading}
            destinationBearing={DESTINATION_BEARING}
            relativeBearing={relativeBearing}
            steps={steps}
            simulatedHeading={simulatedHeading}
            setSimulatedHeading={setSimulatedHeading}
            beacons={beacons}
            isScanning={isScanning}
            startScan={startScan}
        />
      )}
      
      <style>{`
        .toggle-checkbox {
            appearance: none;
            width: 32px;
            height: 18px;
            background-color: rgba(45, 36, 56, 0.6);
            border-radius: 9px;
            position: relative;
            cursor: pointer;
            transition: background-color 0.2s;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .toggle-checkbox:checked {
            background-color: #C9B896;
        }
        .toggle-checkbox::before {
            content: '';
            position: absolute;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background-color: #F5F0E8;
            top: 1px;
            left: 1px;
            transition: transform 0.2s;
        }
        .toggle-checkbox:checked::before {
            transform: translateX(14px);
        }
        @keyframes step-bump {
            0% { transform: scale(1); }
            50% { transform: scale(1.03); }
            100% { transform: scale(1); }
        }
        .animate-step-bump {
            animation: step-bump 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ARNavigation;
