import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceBox } from '@/store/analysisStore';

export interface BystanderBox {
  x: number;
  y: number;
  width: number;
  height: number;
  similarity?: number;
}

export interface EnvironmentalQuality {
  luminance: number;             // 0-255 (mean luma)
  luxEstimate: number;          // approx ambient lux
  luminanceStatus: 'TOO_DARK' | 'OPTIMAL' | 'OVEREXPOSED';
  symmetryScore: number;         // 0-100 (100 = evenly balanced lighting)
  sharpnessScore: number;        // 0-100 (100 = crystal clear)
  isSharp: boolean;
  faceScalePercent: number;      // 0-100 (face height relative to frame)
  scaleStatus: 'TOO_FAR' | 'OPTIMAL' | 'TOO_CLOSE';
  isCentered: boolean;
  headPoseNeutral: boolean;
  compositeQualityScore: number; // 0-100
  isEnvironmentReady: boolean;
  guidanceMessage: string;
}

export interface ActiveChallengeStatus {
  active: boolean;
  challenge: 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | null;
  step: 'PERFORM_ACTION' | 'CENTER_HEAD' | 'PASSED' | 'FAILED' | 'IDLE';
  message: string;
}

export interface MLData {
  faceDetected: boolean | null;
  authVerified?: boolean;
  isEnrolled?: boolean;
  matchConfidence?: number;
  dynamicThreshold?: number;
  bystanderCount?: number;
  bystanderBoxes?: BystanderBox[];
  livenessScore?: number;
  antiSpoofFlag?: 'GENUINE_HUMAN' | 'PLANAR_SPOOF' | 'STATIC_ATTACK' | 'INDETERMINATE';
  antiSpoofAlert?: boolean;
  headPose?: { pitch: number; yaw: number; roll: number };
  sessionLocked?: boolean;
  missingFrames?: number;
  status?: string;
  boundingBox?: FaceBox;
  ear?: number;
  mar?: number;
  gazeFocus?: number;
  rppgSignal?: { r: number; g: number; b: number }[];
  eyeState?: string;
  facsFrustration?: number;
  facsBoredom?: number;
  facsFlowState?: number;
  postureCervicalAngle?: number;
  postureSlumpRatio?: number;
  postureIsSlumping?: boolean;
  vocalJitter?: number;
  fundamentalFrequency?: number;
}

export function useLiveSensor(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  secondaryVideoRef?: React.RefObject<HTMLVideoElement | null>
) {
  const [mlData, setMlData] = useState<MLData>({ 
    faceDetected: null, 
    authVerified: false, 
    bystanderCount: 0,
    bystanderBoxes: [],
    livenessScore: 100,
    antiSpoofFlag: 'GENUINE_HUMAN',
    sessionLocked: false,
    missingFrames: 0
  });
  const workerRef = useRef<Worker | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [calibrationDone, setCalibrationDone] = useState(false);

  // Biometric Enrollment State
  const [enrollmentProgress, setEnrollmentProgress] = useState<number>(0);
  const [enrollmentCompleteEmbedding, setEnrollmentCompleteEmbedding] = useState<number[] | null>(null);
  const [environmentQuality, setEnvironmentQuality] = useState<EnvironmentalQuality | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<ActiveChallengeStatus>({
    active: false,
    challenge: null,
    step: 'IDLE',
    message: ''
  });

  const startCalibrationPoint = useCallback((point: { x: number; y: number }) => {
    workerRef.current?.postMessage({ type: 'START_CALIBRATION_POINT', point });
  }, []);

  const stopCalibrationPoint = useCallback(() => {
    workerRef.current?.postMessage({ type: 'STOP_CALIBRATION_POINT' });
  }, []);

  const finishCalibration = useCallback(() => {
    workerRef.current?.postMessage({ type: 'FINISH_CALIBRATION' });
  }, []);

  const setEnrolledEmbedding = useCallback((embedding: number[]) => {
    workerRef.current?.postMessage({ type: 'SET_ENROLLED_EMBEDDING', embedding });
  }, []);

  const clearEnrolledEmbedding = useCallback(() => {
    workerRef.current?.postMessage({ type: 'CLEAR_ENROLLED_EMBEDDING' });
  }, []);

  const startLivenessChallenge = useCallback((challenge?: 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT') => {
    const selected = challenge || (Math.random() > 0.5 ? 'TURN_LEFT' : 'TURN_RIGHT');
    setChallengeStatus({
      active: true,
      challenge: selected,
      step: 'PERFORM_ACTION',
      message: selected === 'BLINK' 
        ? 'Blink eyes naturally' 
        : selected === 'TURN_LEFT' 
        ? 'Turn head slightly to the left' 
        : 'Turn head slightly to the right'
    });
    workerRef.current?.postMessage({ type: 'START_LIVENESS_CHALLENGE', challenge: selected });
  }, []);

  const cancelLivenessChallenge = useCallback(() => {
    setChallengeStatus({
      active: false,
      challenge: null,
      step: 'IDLE',
      message: ''
    });
    workerRef.current?.postMessage({ type: 'CANCEL_LIVENESS_CHALLENGE' });
  }, []);

  const cancelEnrollmentBurst = useCallback(() => {
    setEnrollmentProgress(0);
    setEnrollmentCompleteEmbedding(null);
    workerRef.current?.postMessage({ type: 'CANCEL_ENROLLMENT_BURST' });
  }, []);

  const startEnrollmentBurst = useCallback(() => {
    setEnrollmentProgress(0);
    setEnrollmentCompleteEmbedding(null);
    workerRef.current?.postMessage({ type: 'START_ENROLLMENT_BURST' });
  }, []);

  useEffect(() => {
    // Spawn Multithreaded Web Worker
    workerRef.current = new Worker(
      new URL('../workers/MLWorker.ts', import.meta.url),
      { type: 'module' }
    );

    // Audio DSP Setup using Web Audio API AudioWorklets
    async function initAudio() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;

        audioCtxRef.current = new AudioContextClass();
        await audioCtxRef.current.audioWorklet.addModule('/processors/AcousticDSP.js');

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        audioStreamRef.current = stream;

        const source = audioCtxRef.current.createMediaStreamSource(stream);
        const dspNode = new AudioWorkletNode(audioCtxRef.current, 'acoustic-dsp-processor');

        dspNode.port.onmessage = (e) => {
          if (e.data.type === 'ACOUSTIC_TELEMETRY') {
            setMlData(prev => ({
              ...prev,
              vocalJitter: e.data.jitter,
              fundamentalFrequency: e.data.f0
            }));
          }
        };

        source.connect(dspNode);
      } catch (err) {
        console.warn('AudioWorklet initialization note:', err);
      }
    }

    workerRef.current.onmessage = (e) => {
      const { type, data, progress, embedding } = e.data;

      if (type === 'INITIALIZED') {
        setInitialized(true);
        initAudio();
      } else if (type === 'METRICS') {
        if (data.faceDetected) {
          setMlData(prev => ({
            ...prev,
            faceDetected: true,
            authVerified: data.authVerified,
            isEnrolled: data.isEnrolled,
            matchConfidence: data.matchConfidence,
            dynamicThreshold: data.dynamicThreshold,
            bystanderCount: data.bystanderCount,
            bystanderBoxes: data.bystanderBoxes || [],
            livenessScore: data.livenessScore,
            antiSpoofFlag: data.antiSpoofFlag,
            antiSpoofAlert: false,
            headPose: data.headPose,
            sessionLocked: false,
            missingFrames: 0,
            boundingBox: data.boundingBox,
            ear: data.ear,
            mar: data.mar,
            gazeFocus: data.gazeFocus,
            rppgSignal: data.rppgBuffer,
            eyeState: data.eyeState,
            facsFrustration: data.facsFrustration,
            facsBoredom: data.facsBoredom,
            facsFlowState: data.facsFlowState,
            postureCervicalAngle: data.postureCervicalAngle,
            postureSlumpRatio: data.postureSlumpRatio,
            postureIsSlumping: data.postureIsSlumping
          }));
        } else {
          setMlData(prev => ({
            ...prev,
            faceDetected: false,
            authVerified: false,
            isEnrolled: data?.isEnrolled ?? prev.isEnrolled,
            matchConfidence: data?.matchConfidence ?? 0.0,
            dynamicThreshold: data?.dynamicThreshold,
            bystanderCount: data?.bystanderCount ?? 0,
            bystanderBoxes: data?.bystanderBoxes || [],
            sessionLocked: data?.sessionLocked ?? false,
            missingFrames: data?.missingFrames ?? 0,
            status: data?.status,
            antiSpoofAlert: data?.antiSpoofAlert ?? false,
            antiSpoofFlag: data?.antiSpoofFlag ?? 'GENUINE_HUMAN'
          }));
        }
      } else if (type === 'ENVIRONMENT_QUALITY') {
        setEnvironmentQuality(e.data.quality);
      } else if (type === 'CHALLENGE_PROGRESS') {
        setChallengeStatus(prev => ({
          ...prev,
          active: true,
          step: e.data.step || 'CENTER_HEAD',
          message: e.data.message || 'Action detected! Now center face.'
        }));
      } else if (type === 'CHALLENGE_COMPLETE') {
        setChallengeStatus({
          active: false,
          challenge: null,
          step: 'PASSED',
          message: e.data.message || 'Liveness confirmed.'
        });
      } else if (type === 'CHALLENGE_FAILED') {
        setChallengeStatus({
          active: false,
          challenge: null,
          step: 'FAILED',
          message: e.data.reason || 'Liveness challenge timed out.'
        });
      } else if (type === 'ENROLLMENT_PROGRESS') {
        setEnrollmentProgress(progress || 0);
      } else if (type === 'ENROLLMENT_BURST_COMPLETE') {
        setEnrollmentProgress(1.0);
        setEnrollmentCompleteEmbedding(embedding || null);
      } else if (type === 'CALIBRATION_DONE') {
        setCalibrationDone(true);
      }
    };

    workerRef.current.postMessage({ type: 'INIT' });

    return () => {
      workerRef.current?.terminate();
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // Frame Capture Loop — Continuous Multi-Modal Sensor Loop
  useEffect(() => {
    if (!initialized) return;

    let active = true;

    const streamLoop = () => {
      if (!active) return;

      // Select whichever video element is currently active and rendered
      const sec = secondaryVideoRef?.current;
      const pri = videoRef.current;
      const targetVideo = (sec && sec.readyState >= 2 && sec.videoWidth > 0 && !sec.paused) 
        ? sec 
        : (pri && pri.readyState >= 2 && pri.videoWidth > 0 && !pri.paused) 
          ? pri 
          : null;

      if (targetVideo) {
        createImageBitmap(targetVideo).then((bitmap) => {
          workerRef.current?.postMessage(
            {
              type: 'FRAME',
              bitmap,
              timestamp: performance.now()
            },
            [bitmap]
          );
        }).catch(() => {
          // Frame dropped / canvas busy
        });
      }

      if (active) {
        // Dual-driver scheduling: requestVideoFrameCallback + guaranteed setTimeout fallback
        // Prevents browser compositor throttling when a modal overlay occludes the canvas
        let frameScheduled = false;
        const triggerNext = () => {
          if (!frameScheduled && active) {
            frameScheduled = true;
            streamLoop();
          }
        };

        const fallbackTimer = setTimeout(triggerNext, 1000 / 30);
        if (targetVideo && 'requestVideoFrameCallback' in targetVideo && !targetVideo.paused) {
          (targetVideo as any).requestVideoFrameCallback(() => {
            clearTimeout(fallbackTimer);
            triggerNext();
          });
        }
      }
    };

    const handleVideoResume = () => {
      if (active) {
        streamLoop();
      }
    };

    const pri = videoRef.current;
    const sec = secondaryVideoRef?.current;
    pri?.addEventListener('play', handleVideoResume);
    pri?.addEventListener('loadedmetadata', handleVideoResume);
    sec?.addEventListener('play', handleVideoResume);
    sec?.addEventListener('loadedmetadata', handleVideoResume);

    streamLoop();

    return () => {
      active = false;
      pri?.removeEventListener('play', handleVideoResume);
      pri?.removeEventListener('loadedmetadata', handleVideoResume);
      sec?.removeEventListener('play', handleVideoResume);
      sec?.removeEventListener('loadedmetadata', handleVideoResume);
    };
  }, [initialized, videoRef, secondaryVideoRef]);

  return { 
    mlData, 
    isModelReady: initialized, 
    calibrationDone,
    enrollmentProgress,
    enrollmentCompleteEmbedding,
    environmentQuality,
    challengeStatus,
    startLivenessChallenge,
    cancelLivenessChallenge,
    startEnrollmentBurst,
    cancelEnrollmentBurst,
    setEnrolledEmbedding,
    clearEnrolledEmbedding,
    startCalibrationPoint,
    stopCalibrationPoint,
    finishCalibration
  };
}
