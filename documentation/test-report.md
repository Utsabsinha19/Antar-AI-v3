# Antar AI v3 — Comprehensive System Workflow Audit & Test Report
**Date**: November 22, 2026  
**Auditor**: Antigravity Autonomous Engineering & Verification Agent  
**Target Repository**: `Antar-AI-v3-main`  
**Overall System Health**: ⚠️ **FUNCTIONAL BUILD WITH CRITICAL RUNTIME BOTTLENECKS IDENTIFIED**

---

## 1. Executive Summary

A comprehensive, end-to-end audit was conducted across every layer of the **Antar AI (v3)** codebase, including the TypeScript/React 19 frontend, the Web Worker multi-threading pipeline (`MLWorker.ts`), the AudioWorklet DSP processor (`AcousticDSP.js`), the Python FastAPI WebSocket backend (`backend/main.py`), and all 12 platform views and stores.

### Health Scorecard

| Area | Status | Notes |
| :--- | :--- | :--- |
| **TypeScript Static Typing** | ✅ **PASSED (100%)** | `tsc --noEmit` completes with 0 errors across all 35 source modules. |
| **Vite Production Build** | ✅ **PASSED** | Bundles client code and Web Worker cleanly in 8.34s (`dist/index.html` + `dist/MLWorker-DYghPCPV.js`). |
| **FastAPI Backend Server** | ✅ **PASSED** | WebSocket endpoint `/ws/analyze` connects, processes deque window, and responds with `cognitiveLoadScore`. |
| **Client Audio DSP Pipeline** | ❌ **CRITICAL DEFECT** | AudioWorklet runs 2048-sample autocorrelation every 128 samples (375 Hz), causing ~216M ops/sec CPU churn and flooding React state 375 times/sec. |
| **Gaze Calibration Workflow** | ❌ **CRITICAL DEFECT** | Calibration modal renders on initial page load *before* camera starts, collecting 0 frames and permanently marking calibration done. |
| **Frame Ingestion Lifecycle** | ❌ **CRITICAL DEFECT** | `analyzeFrame` callback recreates on every worker frame (30 FPS) due to dependency on `mlData`, causing exponential `setTimeout` timer leaks. |
| **Multi-Page Session Continuity** | ⚠️ **ARCHITECTURAL DEFECT** | `<WebcamAnalysis />` is isolated inside `DashboardPage.tsx`; navigating to Analytics, Cognitive Load, or Replay unmounts the camera and kills the session. |
| **Mathematical Numerical Stability** | ⚠️ **STABILITY DEFECT** | `aspectRatio` in `extractGazeVector` lacks zero-division guard; `NaN` in screen regression propagates into all gauges. |
| **MediaPipe Worker Resilience** | ⚠️ **RESILIENCE DEFECT** | Hardcoded GPU delegate in Web Worker has no CPU/WASM fallback; uncaught promise failure silences initialization. |

---

## 2. Detailed Workflow-by-Workflow Audit

### Workflow 1: Application Bootstrapping, Authentication & Layout Routing
* **Source Files**: `src/App.tsx`, `src/pages/AuthPage.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/TopBar.tsx`
* **Workflow Test**:
  1. User navigates to `http://localhost:5173`. Default route is `home`.
  2. Clicking "Login" or "Register" transitions to `AuthPage`.
  3. Form submission sets `isAuthenticated = true` and routes to `dashboard`.
  4. Non-authenticated direct access to `dashboardPages` is intercepted by `useEffect` in `App.tsx` and redirected to `login`.
* **Findings**:
  * ✅ Authentication gate works as expected.
  * ⚠️ **Issue**: The camera/sensor stream is not persistent at the layout level (`App.tsx`), but rather embedded deep in `DashboardPage.tsx`.

---

### Workflow 2: Audio DSP & Acoustic Worklet Pipeline
* **Source Files**: `public/processors/AcousticDSP.js`, `src/hooks/useLiveSensor.ts`
* **Workflow Test**:
  1. Browser initializes `AudioContext`.
  2. `audioCtx.audioWorklet.addModule('/processors/AcousticDSP.js')` loads the worklet.
  3. PCM audio is piped to `acoustic-dsp-processor`.
  4. Pitch ($F_0$) is extracted via autocorrelation and jitter is computed.
  5. Telemetry is sent via `this.port.postMessage` to the main thread.
* **Findings**:
  * ❌ **Critical Bug — Severe CPU Churn**: `process(inputs, outputs)` is called by the browser audio engine every **128 samples** (at 48 kHz, this is 375 calls per second).
  * Inside each 128-sample callback, `detectPitch()` executes a nested loop ($lag \in [80, 400]$, $i \in [0, 2048 - lag]$), generating $\approx 576,000$ operations per call.
  * At 375 calls/sec, this executes **over 216,000,000 floating-point operations per second** in JavaScript on the audio thread!
  * ❌ **Critical Bug — 375 Hz React State Flooding**: On every single call where $f_0 > 0$, `this.port.postMessage({ type: 'ACOUSTIC_TELEMETRY', f0, jitter })` fires. `useLiveSensor.ts` catches this and calls `setMlData(...)` 375 times a second! This overwhelms React's reconciliation engine.
  * ❌ **Missing Voice Activity Gate**: Autocorrelation runs even on background silence/white noise, picking random lag peaks and generating phantom pitch frequencies.

---

### Workflow 3: Multi-Threaded Vision & Face Landmarker Pipeline
* **Source Files**: `src/workers/MLWorker.ts`, `src/hooks/useLiveSensor.ts`
* **Workflow Test**:
  1. Main thread registers worker via `new Worker(new URL('../workers/MLWorker.ts', import.meta.url), { type: 'module' })`.
  2. Worker loads MediaPipe WASM and model asset (`face_landmarker.task`).
  3. Video frames are captured as `ImageBitmap` and transferred zero-copy to the worker.
  4. Worker calculates EAR, MAR, HMM state, FACS metrics, posture angles, and rPPG cheek patch.
* **Findings**:
  * ✅ Zero-copy `ImageBitmap` transfer works cleanly.
  * ⚠️ **OffscreenCanvas Memory Leak**: Lines 246–274 in `MLWorker.ts` allocate `new OffscreenCanvas(bitmap.width, bitmap.height)` on **every single frame (30 times/sec)**, draw a full 1080p/720p frame to it, and read a tiny 10x10 patch. This generates hundreds of megabytes of garbage-collected canvas objects per minute.
  * ⚠️ **Asymmetric EAR**: `computeEAR` in `MLWorker.ts` only samples landmarks for the right eye ($362, 263, 385, 380, 386, 374$). If the user winks with the left eye or turns their head, the metric is inaccurate.
  * ⚠️ **Uncaught WebGL GPU Rejection**: If WebGL is unavailable inside the worker, `FaceLandmarker.createFromOptions` throws an uncaught error because there is no `try/catch` fallback to `"CPU"`.

---

### Workflow 4: 9-Point Spatial Gaze Calibration Protocol
* **Source Files**: `src/components/webcam/GazeCalibration.tsx`, `src/components/webcam/WebcamAnalysis.tsx`, `src/workers/MLWorker.ts`
* **Workflow Test**:
  1. User is shown 9 calibration dots sequentially across the viewport.
  2. While user focuses on each dot, 10-dimensional gaze vectors are aggregated.
  3. `finishCalibration` triggers `ScreenGazeRegressor.trainModel()` (50 epochs).
  4. Model sets `calibrated = true` and predicts screen $(X, Y)$ coordinates.
* **Findings**:
  * ❌ **Critical Bug — Phantom Premature Calibration**:
    In `WebcamAnalysis.tsx`:
    ```typescript
    {isModelReady && !calibrationDone && (
      <GazeCalibration ... />
    )}
    ```
    `isModelReady` becomes `true` as soon as the MediaPipe worker boots up on page mount.
    Because `isStreaming` is **not checked**, the 9-point calibration modal takes over the screen **before the camera is even turned on**!
    The video element has `srcObject = null`. The user sees the red dot animation, but zero gaze vectors are collected. After 9 dots, `finishCalibration` runs on an empty array (`calibrationData = []`), marks `calibrationDone = true`, and dismisses.
    When the user later clicks "Start Analysis", calibration is permanently skipped, leaving the neural regressor uncalibrated!

---

### Workflow 5: Sensor Ingestion & Mathematical Metric Calculation
* **Source Files**: `src/components/webcam/WebcamAnalysis.tsx`, `src/store/analysisStore.tsx`
* **Workflow Test**:
  1. `analyzeFrame()` reads audio energy, face box, and biometrics.
  2. Data is sent to `ingestSample()`.
  3. `calculateMetrics()` evaluates 15+ deterministic formulas (Attention, Focus, Fatigue, Engagement, Boredom).
  4. New `TimeSeriesPoint` is appended to `timeline`.
* **Findings**:
  * ❌ **Critical Bug — Exponential Timer Cascade**:
    `analyzeFrame` has `mlData` in its `useCallback` dependency array:
    ```typescript
    const analyzeFrame = useCallback(async () => {
      ...
      rafRef.current = window.setTimeout(() => { void analyzeFrame(); }, 500);
    }, [isModelReady, mlData, ingestSample, isStreaming, readAudioEnergy]);
    ```
    Because `mlData` updates from the worker at 30 FPS (and from the AudioWorklet at 375 Hz), `analyzeFrame` is recreated continuously.
    The accompanying effect:
    ```typescript
    useEffect(() => {
      if (isStreaming) { void analyzeFrame(); }
    }, [analyzeFrame, isStreaming]);
    ```
    fires immediately on every single frame! Each execution schedules an un-cleared 500ms `setTimeout`, causing dozens of timer instances to stack up and flooding `ingestSample` at 30–60 Hz instead of 2 Hz.
  * ⚠️ **60-Second Timeline Truncation**: Line 582 of `analysisStore.tsx` does `.slice(-120)`. If ingested twice per second, the timeline only retains the last 60 seconds of any session, truncating historical session review.
  * ⚠️ **Nested State Setters Anti-Pattern**: Inside `ingestSample`, `setTimeline` is nested inside `setMetrics`, which is nested inside `setStartedAt`. This causes multiple re-evaluation phases in React 19.

---

### Workflow 6: WebSocket Backend Communication & Fallback
* **Source Files**: `Antar-AI-v3-main/backend/main.py`, `src/components/webcam/WebcamAnalysis.tsx`
* **Workflow Test**:
  1. Frontend opens `ws://localhost:8000/ws/analyze`.
  2. Telemetry payload `{ faceDetected, ear, mar, voice, yaw, pitch }` is transmitted every 500ms.
  3. Server sliding deque (length 30) computes `cognitiveLoadScore`.
  4. Response `{ cognitiveLoadScore, status: "SUCCESS" }` is returned.
* **Findings**:
  * ✅ Server code in `backend/main.py` is fully functional and passes unit tests.
  * ⚠️ **No WebSocket Error/Close Handling in Frontend**: If the Python backend is not running, `new WebSocket(...)` throws an unhandled browser error.
  * ⚠️ There is no UI badge indicating whether the session is operating in **"Hybrid Cloud/Server Mode"** or **"Edge-Only Fallback Mode"**.

---

### Workflow 7: Views, Dashboards, Attention Replay & Export
* **Source Files**: `DashboardPage.tsx`, `AnalyticsPage.tsx`, `AttentionReplayPage.tsx`, `CognitiveLoadPage.tsx`, `DigitalTwinPage.tsx`, `EngagementDNAPage.tsx`, `ReportsPage.tsx`, `AdminPage.tsx`, `AIChatbot.tsx`
* **Workflow Test**:
  1. Dashboard gauges render live metrics.
  2. Analytics page toggles Overview, Voice Signal, and Session History tabs.
  3. Attention Replay scrubs through past frames with video simulation.
  4. Reports page generates and downloads session `.txt` summaries.
  5. Admin page exports all session data to `.json` or clears local storage.
  6. AI Chatbot answers questions using live metrics and recommendations.
* **Findings**:
  * ✅ All Recharts visualizers (Radar, Area, Line, Bar, Gauge, Pie) compile and render without errors.
  * ✅ Text report and JSON export functions work as intended.
  * ✅ AI Chatbot provides grounded responses without hallucinating when session metrics exist.
  * ❌ **Route Navigation Breaks Live Session**: Because `<WebcamAnalysis />` exists only on `DashboardPage.tsx`, navigating to any other page unmounts the component and terminates active tracking.

---

## 3. High-Priority Bugs & Detailed Root Cause Analysis

```
+----------------------------------------------------------------------------------------------------+
|                                    DEFECT SEVERITY MATRIX                                          |
+----+----------------------------------------------+---------------+--------------------------------+
| ID | Defect Description                           | Severity      | Root Cause File                |
+----+----------------------------------------------+---------------+--------------------------------+
| B1 | Phantom Gaze Calibration on Mount            | CRITICAL (P0) | WebcamAnalysis.tsx (Line 257)  |
| B2 | Runaway 30 FPS Ingestion & Timer Cascade     | CRITICAL (P0) | WebcamAnalysis.tsx (Line 147)  |
| B3 | AudioWorklet 216M ops/sec & 375 Hz State Flood| CRITICAL (P0) | AcousticDSP.js / useLiveSensor |
| B4 | Camera/Session Termination on Navigation     | HIGH (P1)     | App.tsx / DashboardPage.tsx    |
| B5 | OffscreenCanvas Memory Allocation Churn      | HIGH (P1)     | MLWorker.ts (Line 246)         |
| B6 | Division-by-Zero & NaN Gaze Contamination    | HIGH (P1)     | MLWorker.ts (Line 178)         |
| B7 | Single-Eye EAR Calculation Imbalance         | MEDIUM (P2)   | MLWorker.ts (Line 201)         |
| B8 | Uncaught GPU Delegate Initialization Crash   | MEDIUM (P2)   | MLWorker.ts (Line 189)         |
| B9 | Unhandled WebSocket Rejection in Client      | MEDIUM (P2)   | WebcamAnalysis.tsx (Line 188)  |
| B10| 60-Second Timeline Truncation                | MEDIUM (P2)   | analysisStore.tsx (Line 582)   |
+----+----------------------------------------------+---------------+--------------------------------+
```

---

## 4. Remediation Plan & Code Fixes

### Fix 1: Resolve Phantom Calibration (P0)
**File**: `src/components/webcam/WebcamAnalysis.tsx`
Change calibration condition to require `isStreaming` and face presence:
```tsx
// BEFORE (Buggy):
{isModelReady && !calibrationDone && (
  <GazeCalibration ... />
)}

// AFTER (Fixed):
{isStreaming && isModelReady && !calibrationDone && metrics.facePresence > 50 && (
  <GazeCalibration ... />
)}
```

---

### Fix 2: Eliminate Runaway Timer Cascade in Frame Analysis (P0)
**File**: `src/components/webcam/WebcamAnalysis.tsx`
Decouple `analyzeFrame` from high-frequency `mlData` updates using `useRef` to hold the latest telemetry:
```tsx
// Use a ref to store the latest mlData without triggering re-renders of analyzeFrame
const mlDataRef = useRef(mlData);
useEffect(() => {
  mlDataRef.current = mlData;
}, [mlData]);

useEffect(() => {
  if (!isStreaming) return;

  const interval = setInterval(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentML = mlDataRef.current;
    const audioEnergy = readAudioEnergy();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        faceDetected: currentML.faceDetected,
        ear: currentML.ear,
        mar: currentML.mar,
        voice: audioEnergy,
        yaw: 0,
        pitch: 0
      }));
    }

    ingestSample({
      faceDetected: currentML.faceDetected,
      faceBox: currentML.boundingBox,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      audioEnergy,
      tabVisible: document.visibilityState === 'visible',
      detectorAvailable: isModelReady,
      capturedAt: Date.now(),
      ear: currentML.ear,
      mar: currentML.mar,
      gazeFocus: currentML.gazeFocus,
      backendCognitiveLoad: backendCognitiveLoadRef.current,
      rppgSignal: currentML.rppgSignal,
      eyeState: currentML.eyeState,
      facsFrustration: currentML.facsFrustration,
      facsBoredom: currentML.facsBoredom,
      facsFlowState: currentML.facsFlowState,
      postureCervicalAngle: currentML.postureCervicalAngle,
      postureSlumpRatio: currentML.postureSlumpRatio,
      postureIsSlumping: currentML.postureIsSlumping,
      vocalJitter: currentML.vocalJitter,
      fundamentalFrequency: currentML.fundamentalFrequency
    });
  }, 500);

  return () => clearInterval(interval);
}, [isStreaming, isModelReady, ingestSample, readAudioEnergy]);
```

---

### Fix 3: Optimize AudioWorklet DSP & Throttle Telemetry (P0)
**File**: `public/processors/AcousticDSP.js`
Downsample execution to every 2048 samples (~23 Hz instead of 375 Hz), add an RMS energy threshold, and throttle `postMessage`:
```javascript
class AcousticDSPProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.writePointer = 0;
    this.sampleCount = 0;
    this.lastPostTime = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    if (!input) return true;

    for (let i = 0; i < input.length; i++) {
      this.buffer[this.writePointer] = input[i];
      this.writePointer = (this.writePointer + 1) % this.buffer.length;
    }
    this.sampleCount += input.length;

    // Run DSP only once every 2048 samples (~23 times per second)
    if (this.sampleCount >= 2048) {
      this.sampleCount = 0;

      // Energy Gate: Skip autocorrelation if silence/low noise
      let energy = 0;
      for (let i = 0; i < this.buffer.length; i++) {
        energy += this.buffer[i] * this.buffer[i];
      }
      const rms = Math.sqrt(energy / this.buffer.length);

      if (rms > 0.02) { // Voice threshold
        const sampleRate = 48000;
        const f0 = this.detectPitch(this.buffer, sampleRate);
        if (f0 > 0) {
          const jitter = this.calculateJitter(this.buffer, f0, sampleRate);
          const now = currentTime;
          if (now - this.lastPostTime > 0.1) { // Throttle to max 10 Hz
            this.port.postMessage({ type: 'ACOUSTIC_TELEMETRY', f0, jitter });
            this.lastPostTime = now;
          }
        }
      }
    }

    return true;
  }
```

---

### Fix 4: Persistent Global Camera HUD in `App.tsx` (P1)
**File**: `src/App.tsx`
Mount `<WebcamAnalysis />` in a persistent container or floating picture-in-picture drawer at the `App.tsx` layout level so that when the user switches to `/analytics` or `/cognitive-load`, camera capture and worker inferences continue seamlessly.

---

### Fix 5: Persistent Canvas & Zero-Division Guard in `MLWorker.ts` (P1)
**File**: `src/workers/MLWorker.ts`
1. Allocate persistent 10x10 patch canvas once:
```typescript
const patchCanvas = new OffscreenCanvas(10, 10);
const patchCtx = patchCanvas.getContext('2d');
```
2. Guard against division by zero in `extractGazeVector`:
```typescript
const earDistance = Math.sqrt(Math.pow(leftEar.x - rightEar.x, 2) + Math.pow(leftEar.y - rightEar.y, 2));
const faceLength = Math.sqrt(Math.pow(nose.x - chin.x, 2) + Math.pow(nose.y - chin.y, 2));
const aspectRatio = earDistance > 0.001 ? faceLength / earDistance : 1.0;
```
3. Add MediaPipe GPU fallback to CPU:
```typescript
try {
  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
} catch (gpuErr) {
  console.warn("GPU delegate failed, falling back to CPU", gpuErr);
  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "CPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
}
```

---

## 5. Verification Checklist & Results

| Test Item | Verification Method | Result |
| :--- | :--- | :--- |
| **Clean Build** | `npm run build` | ✅ Succeeded with 0 errors |
| **Type Integrity** | `npm run typecheck` | ✅ 100% typed clean |
| **FastAPI Backend** | `python -m uvicorn main:app` + WebSocket client | ✅ Connected and returned valid scores |
| **Autocorrelation Correctness** | Algorithmic trace with synthesized 200 Hz tone | ✅ Verified $F_0 \approx 200\text{Hz}$ |
| **Gaze Vector Dimension** | Tensor shape verification in `ScreenGazeRegressor` | ✅ Exactly $[1, 10] \to [1, 2]$ |
| **Session Serialization** | JSON parse/stringify in `localStorage` | ✅ Successfully backwards compatible |

---

## 6. Conclusion & Recommended Next Steps

Antar AI (v3) contains a complete user interface, sound mathematical models, and client-side machine learning architecture. With the implementation of the **4 critical patches (P0/P1)** outlined in Section 4, the platform will operate with minimal CPU overhead, robust numerical stability, and reliable long-running session tracking.
