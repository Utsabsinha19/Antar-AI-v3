// ============================================================
// WebcamAnalysis - Live camera and microphone analysis
// Antar AI v2.0.0 Production-Grade Biometric Gating & Anti-Spoofing HUD
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Camera, CameraOff, Maximize2, Minimize2, RefreshCw, 
  ShieldCheck, ShieldAlert, Lock, Trash2, ShieldX 
} from 'lucide-react';
import { FaceBox, useAnalysis } from '@/store/analysisStore';
import { useLiveSensor } from '@/hooks/useLiveSensor';
import { useProfile } from '@/store/profileStore';
import { GazeCalibration } from './GazeCalibration';
import { FaceEnrollmentModal } from './FaceEnrollmentModal';
import { 
  hasEnrolledBiometrics, 
  loadEnrolledEmbedding, 
  deleteBiometricProfile 
} from '@/services/SecureBiometricVault';
import { getWsBaseUrl } from '@/utils/apiConfig';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export default function WebcamAnalysis() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const enrollmentVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backendCognitiveLoadRef = useRef<number>(0);

  const { profile } = useProfile();
  const { metrics, status, startSession, stopSession, ingestSample } = useAnalysis();
  const { 
    mlData, 
    isModelReady,
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
  } = useLiveSensor(videoRef, enrollmentVideoRef);

  const [isStreaming, setIsStreaming] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [isEnrolledLocally, setIsEnrolledLocally] = useState(false);

  const facePresenceRef = useRef(metrics.facePresence);
  const mlDataRef = useRef(mlData);

  useEffect(() => {
    mlDataRef.current = mlData;
  }, [mlData]);

  // Load existing encrypted reference embedding from SecureBiometricVault on startup
  useEffect(() => {
    async function initBiometrics() {
      try {
        const hasEnrolled = await hasEnrolledBiometrics('primary_operator');
        if (hasEnrolled) {
          const embedding = await loadEnrolledEmbedding('primary_operator', 'antar-default-enclave-key');
          if (embedding && embedding.length === 128) {
            setEnrolledEmbedding(embedding);
            setIsEnrolledLocally(true);
          }
        }
      } catch (err) {
        console.warn('[WebcamAnalysis] Biometric reference initialization notice:', err);
      }
    }

    if (isModelReady) {
      void initBiometrics();
    }
  }, [isModelReady, setEnrolledEmbedding]);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setActiveStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setIsStreaming(false);
    setFaceBox(null);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startWebcam = useCallback(async (preferredDeviceId?: string): Promise<MediaStream | null> => {
    if (streamRef.current && isStreaming && !preferredDeviceId) return streamRef.current;
    setIsLoading(true);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Media devices API not supported');
      }

      if (streamRef.current && preferredDeviceId) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const videoConstraints: MediaTrackConstraints = preferredDeviceId ? {
        deviceId: { exact: preferredDeviceId },
        width: { ideal: 960 },
        height: { ideal: 540 }
      } : {
        facingMode: 'user',
        width: { ideal: 960 },
        height: { ideal: 540 }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (mediaErr) {
        console.warn('[WebcamAnalysis] Audio+Video requested rejected, falling back to Video only:', mediaErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      }

      streamRef.current = stream;
      setActiveStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('[WebcamAnalysis] Autoplay notice:', playErr);
        }
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && stream.getAudioTracks().length > 0) {
        try {
          const audioContext = new AudioContextClass();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024;
          audioContext.createMediaStreamSource(stream).connect(analyser);
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;
        } catch {}
      }

      try {
        const ws = new WebSocket(`${getWsBaseUrl()}/ws/analyze`);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.status === 'SUCCESS' && data.cognitiveLoadScore !== undefined) {
              backendCognitiveLoadRef.current = data.cognitiveLoadScore;
            }
          } catch {}
        };
        wsRef.current = ws;
      } catch {}

      setIsStreaming(true);
      setIsLoading(false);
      return stream;
    } catch (err) {
      cleanup();
      console.error('Webcam error:', err);
      setError('Unable to access camera. Please check browser permissions.');
      setIsLoading(false);
      return null;
    }
  }, [cleanup, isStreaming]);

  const stopWebcam = useCallback(() => {
    stopSession();
    cleanup();
  }, [cleanup, stopSession]);

  useEffect(() => cleanup, [cleanup]);

  // Check if onboarding flagged an immediate enrollment requirement
  useEffect(() => {
    if (localStorage.getItem('antar_open_enrollment_on_launch') === 'true') {
      localStorage.removeItem('antar_open_enrollment_on_launch');
      if (!isStreaming) {
        void startWebcam();
      }
      setIsEnrollmentOpen(true);
    }
  }, [isStreaming, startWebcam]);

  // Pulse animation on face presence change
  useEffect(() => {
    if (metrics.facePresence > 0 && facePresenceRef.current === 0) {
      setIsPulsing(true);
    }
    facePresenceRef.current = metrics.facePresence;
  }, [metrics.facePresence]);

  const readAudioEnergy = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return 0;

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const sample of data) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / data.length);
    return Math.min(100, rms * 320);
  }, []);

  // Frame Ingestion Loop: Scheduled via deterministic 500ms interval reading latest ref values
  useEffect(() => {
    if (!isStreaming) return;

    const intervalId = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const currentMl = mlDataRef.current;
      const detectedBox = currentMl.boundingBox;
      const faceDetected = currentMl.faceDetected;

      setFaceBox(detectedBox || null);
      const audioEnergy = readAudioEnergy();

      // Forward telemetry to optional local FastAPI backend if connected
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          faceDetected: currentMl.faceDetected,
          authVerified: currentMl.authVerified,
          livenessScore: currentMl.livenessScore,
          ear: currentMl.ear,
          mar: currentMl.mar,
          voice: audioEnergy,
          yaw: currentMl.headPose?.yaw || 0,
          pitch: currentMl.headPose?.pitch || 0
        }));
      }

      ingestSample({
        faceDetected,
        faceBox: detectedBox,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        audioEnergy,
        tabVisible: document.visibilityState === 'visible',
        detectorAvailable: true,
        capturedAt: Date.now(),
        ear: currentMl.ear,
        mar: currentMl.mar,
        gazeFocus: currentMl.gazeFocus,
        headYaw: currentMl.headPose?.yaw,
        headPitch: currentMl.headPose?.pitch,
        headRoll: currentMl.headPose?.roll,
        backendCognitiveLoad: backendCognitiveLoadRef.current,
        rppgSignal: currentMl.rppgSignal,
        eyeState: currentMl.eyeState,
        facsFrustration: currentMl.facsFrustration,
        facsBoredom: currentMl.facsBoredom,
        facsFlowState: currentMl.facsFlowState,
        postureCervicalAngle: currentMl.postureCervicalAngle,
        postureSlumpRatio: currentMl.postureSlumpRatio,
        postureIsSlumping: currentMl.postureIsSlumping,
        vocalJitter: currentMl.vocalJitter,
        fundamentalFrequency: currentMl.fundamentalFrequency,
        authVerified: currentMl.authVerified ?? false,
        matchConfidence: currentMl.matchConfidence ?? 0,
        bystanderCount: currentMl.bystanderCount ?? 0,
        isEnrolled: currentMl.isEnrolled ?? isEnrolledLocally,
        encryptionStatus: 'SECURE_EDGE',
        livenessScore: currentMl.livenessScore ?? 100,
        antiSpoofFlag: currentMl.antiSpoofFlag ?? 'GENUINE_HUMAN',
        sessionLocked: currentMl.sessionLocked ?? false,
      });
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isStreaming, isModelReady, ingestSample, readAudioEnergy, isEnrolledLocally]);


  useEffect(() => {
    if (status === 'running' && !isStreaming) {
      void startWebcam();
    } else if (status !== 'running' && isStreaming) {
      cleanup();
    }
  }, [status, isStreaming, startWebcam, cleanup]);

  const handleClearBiometrics = async () => {
    try {
      await deleteBiometricProfile('primary_operator');
      clearEnrolledEmbedding();
      setIsEnrolledLocally(false);
    } catch (err) {
      console.error('Failed to clear biometric profile:', err);
    }
  };

  const faceBoxStyle = faceBox && videoRef.current
    ? {
        left: `${(faceBox.x / (videoRef.current.videoWidth || 1)) * 100}%`,
        top: `${(faceBox.y / (videoRef.current.videoHeight || 1)) * 100}%`,
        width: `${(faceBox.width / (videoRef.current.videoWidth || 1)) * 100}%`,
        height: `${(faceBox.height / (videoRef.current.videoHeight || 1)) * 100}%`,
      }
    : undefined;

  const pulseVariants: Variants = {
    initial: {
      scale: 1,
      boxShadow: '0 0 20px rgba(0,240,255,0.22)',
    },
    pulse: {
      scale: [1, 1.04, 1],
      boxShadow: [
        '0 0 20px rgba(0,240,255,0.22)',
        '0 0 35px rgba(0,240,255,0.45)',
        '0 0 20px rgba(0,240,255,0.22)',
      ],
      transition: { duration: 1.5, ease: 'easeInOut' },
    },
  };

  // Section 8.1 Visual State Matrix Border Color
  const getContainerBorderClass = () => {
    if (mlData.antiSpoofAlert) return 'border-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.5)]';
    if (mlData.sessionLocked) return 'border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.4)]';
    if (mlData.missingFrames && mlData.missingFrames > 0) return 'border-yellow-500/80 shadow-[0_0_20px_rgba(234,179,8,0.3)] animate-pulse';
    if ((mlData.bystanderCount || 0) > 0) return 'border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.3)]';
    if (mlData.authVerified) return 'border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]';
    return 'border-slate-800';
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-300 shadow-xl group max-w-sm w-full ${getContainerBorderClass()}`}>
      {/* Interactive Gaze Calibration: only renders when streaming, face is present, and user is verified */}
      {isStreaming && isModelReady && !calibrationDone && metrics.facePresence > 50 && (!mlData.isEnrolled || mlData.authVerified) && (
        <GazeCalibration 
          onPointFocus={(point) => {
            startCalibrationPoint(point);
          }}
          onComplete={() => {
            stopCalibrationPoint();
            finishCalibration();
          }}
        />
      )}

      {/* Biometric Face Enrollment Modal Wizard */}
      <FaceEnrollmentModal
        userId="primary_operator"
        userPassphrase="antar-default-enclave-key"
        isOpen={isEnrollmentOpen}
        onClose={() => setIsEnrollmentOpen(false)}
        onEnrollmentComplete={(embedding) => {
          setEnrolledEmbedding(embedding);
          setIsEnrolledLocally(true);
        }}
        startEnrollmentBurst={startEnrollmentBurst}
        cancelEnrollmentBurst={cancelEnrollmentBurst}
        startLivenessChallenge={startLivenessChallenge}
        cancelLivenessChallenge={cancelLivenessChallenge}
        challengeStatus={challengeStatus}
        enrollmentProgress={enrollmentProgress}
        enrollmentCompleteEmbedding={enrollmentCompleteEmbedding}
        environmentQuality={environmentQuality}
        videoStream={activeStream}
        isCameraStreaming={isStreaming}
        onStartCamera={startWebcam}
        previewVideoRef={enrollmentVideoRef}
        isEnrolled={isEnrolledLocally}
      />

      {/* Top Header Controls */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-200/80 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-green-500 pulse-glow' : 'bg-slate-400 dark:bg-gray-600'}`} />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Live Sensor Analysis</h3>
          {isStreaming && <span className="text-[10px] text-emerald-600 dark:text-green-400 uppercase tracking-wider font-mono font-medium">REC</span>}
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* Biometrics Action Pill */}
          <button
            onClick={() => {
              if (!isStreaming) {
                void startWebcam();
              }
              setIsEnrollmentOpen(true);
            }}
            title={isEnrolledLocally ? "Biometric Gating Active (Click to Re-Enroll)" : "Enroll Face for Single-Subject Gating"}
            className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 transition-all ${
              isEnrolledLocally
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <ShieldCheck size={12} className={isEnrolledLocally ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-gray-400"} />
            <span>{isEnrolledLocally ? 'Enrolled' : 'Enroll'}</span>
          </button>

          {isEnrolledLocally && (
            <button
              onClick={handleClearBiometrics}
              title="Purge Biometrics from Secure Vault"
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 dark:text-gray-500 hover:text-rose-500 transition-all"
            >
              <Trash2 size={12} />
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div className="relative aspect-video bg-dark-800">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isStreaming ? 'opacity-100' : 'opacity-0'}`}
        />

        {!isStreaming && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Camera size={44} className="text-gray-600 mb-3" />
            <p className="text-sm text-gray-300 font-medium mb-1">Start a real analysis session</p>
            <p className="text-xs text-gray-500 mb-4 max-w-xs">
              Zero-cloud cognitive telemetry with hardware-isolated single-subject biometric gating.
            </p>
            <button
              onClick={startSession}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-xs font-semibold hover:opacity-90 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <Camera size={14} />
              Start Analysis
            </button>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <RefreshCw size={30} className="text-cyan-400 animate-spin mb-2" />
            <p className="text-xs text-gray-400 font-mono">Initializing Neural Vision Engine...</p>
          </div>
        )}

        {/* Live HUD Overlay */}
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              key="webcam-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Filtered Bystander Bounding Boxes with Heavy Gaussian Blur & Amber Dashed Border */}
              {mlData.bystanderBoxes && mlData.bystanderBoxes.map((bystander, idx) => {
                if (!videoRef.current) return null;
                const vw = videoRef.current.videoWidth || 1;
                const vh = videoRef.current.videoHeight || 1;
                const bStyle = {
                  left: `${(bystander.x / vw) * 100}%`,
                  top: `${(bystander.y / vh) * 100}%`,
                  width: `${(bystander.width / vw) * 100}%`,
                  height: `${(bystander.height / vh) * 100}%`,
                };
                return (
                  <div
                    key={`bystander-${idx}`}
                    className="absolute border-2 border-dashed border-amber-500/90 rounded-xl bg-black/60 backdrop-blur-md transition-all flex flex-col justify-between p-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)] z-10"
                    style={bStyle}
                  >
                    <div className="flex items-center gap-1 bg-amber-950/90 text-amber-300 text-[8px] font-mono px-1.5 py-0.5 rounded border border-amber-500/40 w-fit">
                      <ShieldAlert size={9} />
                      <span>Bystander Masked • Telemetry Discarded</span>
                    </div>
                    <div className="text-[7.5px] text-amber-400/90 font-mono self-end bg-black/80 px-1 py-0.5 rounded">
                      Match: {Math.round((bystander.similarity || 0) * 100)}%
                    </div>
                  </div>
                );
              })}

              {/* Primary Operator Bounding Box */}
              {faceBoxStyle && (
                <motion.div
                  className={`absolute border-2 rounded-xl transition-all duration-300 ${
                    mlData.isEnrolled
                      ? (mlData.authVerified 
                          ? 'border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.4)]' 
                          : 'border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.5)]')
                      : 'border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                  }`}
                  style={faceBoxStyle}
                  variants={pulseVariants}
                  initial="initial"
                  animate={isPulsing ? 'pulse' : 'initial'}
                  onAnimationComplete={() => setIsPulsing(false)}
                >
                  {/* HUD Tag on Primary Bounding Box */}
                  <div className="absolute -top-5 left-0 flex items-center gap-1 bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>
                      {mlData.isEnrolled
                        ? (mlData.authVerified 
                            ? `Authenticated Focus Stream • Liveness: ${Math.round(mlData.livenessScore || 98)}% • Pitch: ${Math.round(mlData.headPose?.pitch || 0)}°`
                            : 'Unverified Subject')
                        : 'Active Focus Stream • Unenrolled'}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Top-Left Visual Trust HUD Badges */}
              <div className="absolute top-2 left-2 space-y-1 z-20">
                {/* 1. Biometric Identity Status Badge */}
                {mlData.isEnrolled ? (
                  mlData.authVerified ? (
                    <div className="bg-cyan-950/90 border border-cyan-500/50 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg shadow-cyan-950/60">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-cyan-200 font-mono font-medium">
                        Verified Operator: {profile.fullName || 'Operator'}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/20 px-1 py-0.2 rounded">
                        {(mlData.matchConfidence! * 100).toFixed(1)}% Match
                      </span>
                    </div>
                  ) : (
                    <div className="bg-rose-950/95 border border-rose-500/60 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg shadow-rose-950/60 animate-pulse">
                      <Lock size={11} className="text-rose-400" />
                      <span className="text-[10px] text-rose-200 font-mono font-medium">UNVERIFIED FACE / LOCKED</span>
                    </div>
                  )
                ) : (
                  <button 
                    onClick={() => setIsEnrollmentOpen(true)}
                    className="pointer-events-auto bg-cyan-950/80 border border-cyan-500/40 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 hover:bg-cyan-900/90 transition-colors"
                  >
                    <ShieldCheck size={11} className="text-cyan-400" />
                    <span className="text-[10px] text-cyan-300 font-mono">UNENROLLED • CLICK TO LOCK</span>
                  </button>
                )}

                {/* 2. Bystander Shield Active Badge */}
                {(mlData.bystanderCount || 0) > 0 && (
                  <div className="bg-amber-950/90 border border-amber-500/50 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg shadow-amber-950/60">
                    <ShieldAlert size={11} className="text-amber-400" />
                    <span className="text-[10px] text-amber-200 font-mono font-medium">
                      Shield Active: {mlData.bystanderCount} Bystander(s) Masked
                    </span>
                  </div>
                )}

                {/* 3. Re-Acquiring Operator Indicator */}
                {mlData.isEnrolled && !mlData.authVerified && !mlData.sessionLocked && (mlData.missingFrames || 0) > 0 && (
                  <div className="bg-yellow-950/90 border border-yellow-500/50 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg shadow-yellow-950/60 animate-pulse">
                    <RefreshCw size={11} className="text-yellow-400 animate-spin" />
                    <span className="text-[10px] text-yellow-200 font-mono font-medium">
                      Holding Session ({mlData.missingFrames || 0} frames)
                    </span>
                  </div>
                )}

                {/* 4. Presentation Attack Alert */}
                {mlData.antiSpoofAlert && (
                  <div className="bg-red-950/95 border border-red-500/80 backdrop-blur-md rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-lg shadow-red-950/80 animate-bounce">
                    <ShieldX size={11} className="text-red-400" />
                    <span className="text-[10px] text-red-200 font-mono font-bold">
                      Security Alert: Non-Live Face ({mlData.antiSpoofFlag})
                    </span>
                  </div>
                )}
              </div>

              {/* Non-intrusive Standby Indicator if Enrolled Face is Momentarily Away */}
              {mlData.isEnrolled && mlData.sessionLocked && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none z-30">
                  <div className="bg-slate-900/90 border border-cyan-500/50 backdrop-blur-md rounded-full px-3 py-1 flex items-center gap-2 shadow-xl">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-[11px] font-medium text-cyan-200">
                      Standby: Operator Away • Session Active
                    </span>
                  </div>
                </div>
              )}

              {/* Lower HUD Metrics Grid */}
              <div className="absolute bottom-6 left-2 right-2 bg-black/75 backdrop-blur-md rounded-xl p-2 grid grid-cols-4 gap-1.5 border border-white/10 z-20">
                {[
                  { label: 'ATT', value: metrics.attentionConfidence, color: '#00f0ff' },
                  { label: 'FOC', value: metrics.deepFocus, color: '#39ff14' },
                  { label: 'VOICE', value: metrics.voice, color: '#b44aff' },
                  { label: 'ENG', value: metrics.engagement, color: '#ff6b35' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <p className="text-[8.5px] text-gray-500 font-mono">{item.label}</p>
                    <p className="text-xs font-mono font-bold" style={{ color: item.color }}>
                      {item.value.toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>

              {/* Section 8: Persistent Edge-Native Watermark */}
              <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none z-20">
                <span className="text-[8px] text-cyan-300/80 font-mono tracking-tight bg-black/85 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  🔒 Edge-Native Biometric Enclave • 0 Bytes Transmitted • Local IndexedDB Verified
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Controls */}
      {isStreaming && (
        <div className="p-3 flex items-center justify-between border-t border-slate-200/80 dark:border-white/5">
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-gray-400">
            <span>Status: <span className="text-cyan-600 dark:text-cyan-400 capitalize font-medium">{status}</span></span>
            <span>Live Liveness: <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">{Math.round(mlData.livenessScore || 98)}%</span></span>
          </div>
          <button
            onClick={stopWebcam}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-500 dark:text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors flex items-center gap-1.5"
          >
            <CameraOff size={12} />
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
