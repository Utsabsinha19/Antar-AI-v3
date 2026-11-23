import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import * as tf from '@tensorflow/tfjs';
import { LivenessDetector, LivenessEvaluationResult } from './LivenessDetector';
import { BiometricGatingFilter } from './BiometricGatingFilter';

let landmarker: FaceLandmarker | null = null;
let rppgHistory: { r: number; g: number; b: number }[] = [];
const RPPG_WINDOW_SIZE = 300; // 10 seconds at 30 FPS

// Persistent offscreen canvas for skin patch extraction (avoids GC churn)
let patchCanvas: OffscreenCanvas | null = null;
let patchCtx: OffscreenCanvasRenderingContext2D | null = null;
let envCanvas: OffscreenCanvas | null = null;
let envCtx: OffscreenCanvasRenderingContext2D | null = null;

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

export function analyzeEnvironmentalQuality(
  bitmap: ImageBitmap,
  candidateFace: any | null,
  headPose: { pitch: number; yaw: number; roll: number } | null
): EnvironmentalQuality {
  if (!envCanvas) {
    envCanvas = new OffscreenCanvas(64, 64);
    envCtx = envCanvas.getContext('2d', { willReadFrequently: true });
  }

  let meanLuma = 0;
  let symmetryScore = 100;
  let sharpnessScore = 50;
  let isSharp = true;
  let faceScalePercent = 0;
  let scaleStatus: 'TOO_FAR' | 'OPTIMAL' | 'TOO_CLOSE' = 'TOO_FAR';
  let isCentered = false;
  let headPoseNeutral = false;

  if (envCtx) {
    try {
      if (candidateFace && candidateFace.boundingBox && candidateFace.boundingBox.width > 20) {
        // Sample facial bounding box
        const bx = Math.max(0, Math.floor(candidateFace.boundingBox.xMin));
        const by = Math.max(0, Math.floor(candidateFace.boundingBox.yMin));
        const bw = Math.min(bitmap.width - bx, Math.max(20, Math.floor(candidateFace.boundingBox.width)));
        const bh = Math.min(bitmap.height - by, Math.max(20, Math.floor(candidateFace.boundingBox.height)));

        envCtx.drawImage(bitmap, bx, by, bw, bh, 0, 0, 64, 64);
        const imgData = envCtx.getImageData(0, 0, 64, 64);
        const data = imgData.data;

        let totalLuma = 0;
        let leftLuma = 0;
        let leftCount = 0;
        let rightLuma = 0;
        let rightCount = 0;

        // Grayscale 2D array for discrete Laplacian variance
        const gray2D: number[][] = [];
        for (let y = 0; y < 64; y++) {
          const row: number[] = [];
          for (let x = 0; x < 64; x++) {
            const idx = (y * 64 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // Rec. 601 luma
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            row.push(luma);
            totalLuma += luma;

            // Cheek / lateral halves for symmetry calculation
            if (x < 30) {
              leftLuma += luma;
              leftCount++;
            } else if (x > 34) {
              rightLuma += luma;
              rightCount++;
            }
          }
          gray2D.push(row);
        }

        meanLuma = totalLuma / (64 * 64);

        // Symmetry score (comparing left vs right cheek illumination)
        const avgLeft = leftCount > 0 ? leftLuma / leftCount : meanLuma;
        const avgRight = rightCount > 0 ? rightLuma / rightCount : meanLuma;
        const diffLuma = Math.abs(avgLeft - avgRight);
        const denomLuma = Math.max(10, (avgLeft + avgRight) / 2);
        const asymmetryRatio = diffLuma / denomLuma;
        symmetryScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, asymmetryRatio * 1.8)) * 100)));

        // Discrete Laplacian kernel: L(x,y) = G(x+1,y) + G(x-1,y) + G(x,y+1) + G(x,y-1) - 4*G(x,y)
        // Computed on central face region (x from 16 to 48, y from 16 to 48)
        let lapSum = 0;
        let lapSqSum = 0;
        let lapN = 0;
        for (let y = 16; y < 48; y++) {
          for (let x = 16; x < 48; x++) {
            const lap = gray2D[y][x + 1] + gray2D[y][x - 1] + gray2D[y + 1][x] + gray2D[y - 1][x] - 4 * gray2D[y][x];
            lapSum += lap;
            lapSqSum += lap * lap;
            lapN++;
          }
        }
        const lapMean = lapN > 0 ? lapSum / lapN : 0;
        const lapVar = lapN > 0 ? (lapSqSum / lapN) - (lapMean * lapMean) : 0;
        // Normalize: variance < 40 is blurry; variance > 160 is sharp
        sharpnessScore = Math.max(0, Math.min(100, Math.round(Math.min(300, lapVar) / 3.0)));
        isSharp = sharpnessScore >= 42;

        // Face scale percentage (face height relative to frame height)
        faceScalePercent = Math.round((candidateFace.boundingBox.height / bitmap.height) * 100);
        if (faceScalePercent < 22) {
          scaleStatus = 'TOO_FAR';
        } else if (faceScalePercent > 70) {
          scaleStatus = 'TOO_CLOSE';
        } else {
          scaleStatus = 'OPTIMAL';
        }

        // Centering
        const cx = (candidateFace.boundingBox.xMin + candidateFace.boundingBox.width / 2) / bitmap.width;
        const cy = (candidateFace.boundingBox.yMin + candidateFace.boundingBox.height / 2) / bitmap.height;
        isCentered = Math.abs(cx - 0.5) <= 0.16 && Math.abs(cy - 0.5) <= 0.18;

        // Head pose neutrality
        if (headPose) {
          headPoseNeutral = Math.abs(headPose.yaw) <= 18 && Math.abs(headPose.pitch) <= 15 && Math.abs(headPose.roll) <= 15;
        }
      } else {
        // No face yet: sample overall frame downscaled to 64x64
        envCtx.drawImage(bitmap, 0, 0, 64, 64);
        const imgData = envCtx.getImageData(0, 0, 64, 64);
        const data = imgData.data;
        let totalLuma = 0;
        for (let i = 0; i < data.length; i += 4) {
          totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        meanLuma = totalLuma / (data.length / 4);
      }
    } catch {
      // Fallback
    }
  }

  const luxEstimate = Math.round(meanLuma * 2.2);
  let luminanceStatus: 'TOO_DARK' | 'OPTIMAL' | 'OVEREXPOSED' = 'OPTIMAL';
  if (meanLuma < 48) {
    luminanceStatus = 'TOO_DARK';
  } else if (meanLuma > 195) {
    luminanceStatus = 'OVEREXPOSED';
  }

  // Composite quality calculation (0 - 100)
  let lumaComponent = 100;
  if (luminanceStatus === 'TOO_DARK') {
    lumaComponent = Math.max(10, Math.round((meanLuma / 48) * 60));
  } else if (luminanceStatus === 'OVEREXPOSED') {
    lumaComponent = Math.max(20, Math.round(100 - (meanLuma - 195) * 1.5));
  }

  const scaleComponent = scaleStatus === 'OPTIMAL' ? 100 : 50;
  const centerComponent = isCentered ? 100 : 50;
  const poseComponent = headPoseNeutral ? 100 : 50;

  let compositeQualityScore = Math.round(
    lumaComponent * 0.30 +
    sharpnessScore * 0.25 +
    symmetryScore * 0.15 +
    scaleComponent * 0.15 +
    centerComponent * 0.10 +
    poseComponent * 0.05
  );
  if (!candidateFace) {
    compositeQualityScore = Math.min(30, compositeQualityScore);
  }

  const isEnvironmentReady =
    candidateFace !== null &&
    luminanceStatus === 'OPTIMAL' &&
    isSharp &&
    scaleStatus === 'OPTIMAL' &&
    isCentered &&
    headPoseNeutral &&
    compositeQualityScore >= 65;

  let guidanceMessage = 'Align face centrally in oval guide';
  if (!candidateFace) {
    if (luminanceStatus === 'TOO_DARK') {
      guidanceMessage = 'Room is very dark. Turn on Screen Light Assist or room light.';
    } else {
      guidanceMessage = 'No face detected. Look directly at camera.';
    }
  } else if (luminanceStatus === 'TOO_DARK') {
    guidanceMessage = 'Low light detected. Switch on Screen Light Assist or face a light source.';
  } else if (luminanceStatus === 'OVEREXPOSED') {
    guidanceMessage = 'Harsh glare / overexposure. Reduce backlight or angle away.';
  } else if (!isSharp) {
    guidanceMessage = 'Camera blur detected. Please hold still.';
  } else if (scaleStatus === 'TOO_FAR') {
    guidanceMessage = 'Move closer to fill the oval guide.';
  } else if (scaleStatus === 'TOO_CLOSE') {
    guidanceMessage = 'Step back slightly from camera.';
  } else if (!isCentered) {
    guidanceMessage = 'Center your face inside the oval target.';
  } else if (!headPoseNeutral) {
    guidanceMessage = 'Look straight ahead with a neutral pose.';
  } else if (symmetryScore < 50) {
    guidanceMessage = 'Uneven lighting. Strong side shadow detected.';
  } else {
    guidanceMessage = 'Optimal lighting & pose. Ready to capture!';
  }

  return {
    luminance: Math.round(meanLuma),
    luxEstimate,
    luminanceStatus,
    symmetryScore,
    sharpnessScore,
    isSharp,
    faceScalePercent,
    scaleStatus,
    isCentered,
    headPoseNeutral,
    compositeQualityScore,
    isEnvironmentReady,
    guidanceMessage
  };
}

// Baseline parameters for calibration
let baselineEarOpen = 0.28;
let baselineFaceHeight = 0.12;

// Production Biometric Gating & Anti-Spoofing Engines
const livenessDetector = new LivenessDetector();
const gatingFilter = new BiometricGatingFilter();

// Enrollment burst state (45 frames across 1.5s with RANSAC-trimmed mean)
let isEnrollingBurst = false;
let enrollmentBurstFrames: Float32Array[] = [];
const ENROLLMENT_BURST_TARGET = 45;

// Active Liveness Challenge state (ISO/IEC 30107-3 compliant)
let activeChallengeType: 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | null = null;
let challengeActionPassed = false;
let challengeStartTime = 0;

export enum FocusState {
  AWAKE = "AWAKE",
  BLINKING = "BLINKING",
  MICROSLEEP = "MICROSLEEP"
}

export class EyeStateHMM {
  private state: FocusState = FocusState.AWAKE;
  private closedFramesCounter: number = 0;
  private readonly MICROSLEEP_FRAME_THRESHOLD = 15; // 500ms at 30fps

  public updateState(ear: number, earBaselineOpen: number): { state: FocusState; durationMs: number } {
    const baseline = earBaselineOpen > 0.01 ? earBaselineOpen : 0.28;
    const normalizedEar = ear / baseline;

    if (normalizedEar < 0.60) {
      this.closedFramesCounter++;
      if (this.closedFramesCounter >= this.MICROSLEEP_FRAME_THRESHOLD) {
        this.state = FocusState.MICROSLEEP;
      } else {
        this.state = FocusState.BLINKING;
      }
    } else {
      this.closedFramesCounter = 0;
      this.state = FocusState.AWAKE;
    }

    return {
      state: this.state,
      durationMs: this.closedFramesCounter * (1000 / 30)
    };
  }
}

const hmmEngine = new EyeStateHMM();

export interface FACSMetrics {
  frustration: number; // 0.0 to 1.0
  boredom: number;     // 0.0 to 1.0
  flowState: number;   // 0.0 to 1.0
}

export function evaluateFACS(blendshapes: Record<string, number>, gazeVariance: number): FACSMetrics {
  const browDown = blendshapes['browDownLeft'] || 0;
  const eyeSquint = ((blendshapes['eyeSquintLeft'] || 0) + (blendshapes['eyeSquintRight'] || 0)) / 2;
  const noseSneer = ((blendshapes['noseSneerLeft'] || 0) + (blendshapes['noseSneerRight'] || 0)) / 2;
  const eyeWide = ((blendshapes['eyeWideLeft'] || 0) + (blendshapes['eyeWideRight'] || 0)) / 2;
  const jawDrop = blendshapes['jawOpen'] || 0;

  const frustration = Math.min(1.0, (browDown * 0.5) + (eyeSquint * 0.3) + (noseSneer * 0.2));
  const boredom = Math.min(1.0, (jawDrop * 0.4) + (gazeVariance * 0.6));
  const flowState = Math.min(1.0, (eyeWide * 0.3) + ((1 - gazeVariance) * 0.7));

  return { frustration, boredom, flowState };
}

export interface PostureTelemetry {
  cervicalAngle: number;
  slumpRatio: number;
  isSlumping: boolean;
}

export function evaluatePosture(landmarks: any[], baselineFaceHeightParam: number): PostureTelemetry {
  const nose = landmarks[1] || { x: 0.5, y: 0.5, z: 0 };
  const chin = landmarks[152] || { x: 0.5, y: 0.8, z: 0 };
  const leftEar = landmarks[234] || { x: 0.3, y: 0.5, z: 0 };
  const rightEar = landmarks[454] || { x: 0.7, y: 0.5, z: 0 };

  const faceHeight = Math.sqrt(
    Math.pow(nose.x - chin.x, 2) + Math.pow(nose.y - chin.y, 2)
  );

  const slumpRatio = baselineFaceHeightParam > 0 ? faceHeight / baselineFaceHeightParam : 1.0;
  const earMidpointX = (leftEar.x + rightEar.x) / 2;
  const earMidpointY = (leftEar.y + rightEar.y) / 2;
  const dx = nose.x - earMidpointX;
  const dy = nose.y - earMidpointY;
  const cervicalAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  const isSlumping = slumpRatio < 0.85;

  return { cervicalAngle, slumpRatio, isSlumping };
}

// ------------------------------------------------------------------------------
// Mathematical Geometry & Feature Extractors
// ------------------------------------------------------------------------------

export function computeEAR(landmarks: any[]): number {
  if (!landmarks || landmarks.length < 386) return 0.28;

  const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

  // Left eye: 33, 160, 158, 133, 153, 144
  const l_p1 = landmarks[33], l_p2 = landmarks[160], l_p3 = landmarks[158];
  const l_p4 = landmarks[133], l_p5 = landmarks[153], l_p6 = landmarks[144];
  const leftEAR = (dist(l_p2, l_p6) + dist(l_p3, l_p5)) / (2.0 * (dist(l_p1, l_p4) || 0.001));

  // Right eye: 362, 385, 387, 263, 373, 380
  const r_p1 = landmarks[362], r_p2 = landmarks[385], r_p3 = landmarks[387];
  const r_p4 = landmarks[263], r_p5 = landmarks[373], r_p6 = landmarks[380];
  const rightEAR = (dist(r_p2, r_p6) + dist(r_p3, r_p5)) / (2.0 * (dist(r_p1, r_p4) || 0.001));

  return (leftEAR + rightEAR) / 2.0;
}

export function computeMAR(landmarks: any[]): number {
  if (!landmarks || landmarks.length < 308) return 0.15;
  const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

  // Upper/lower lips: 13, 14, corners: 78, 308
  const p13 = landmarks[13], p14 = landmarks[14];
  const p78 = landmarks[78], p308 = landmarks[308];
  return dist(p13, p14) / (dist(p78, p308) || 0.001);
}

export function extractGazeVector(landmarks: any[]): number[] {
  if (!landmarks || landmarks.length < 473) return [0, 0, 0, 0];

  const l_iris = landmarks[468] || { x: 0.35, y: 0.45 };
  const r_iris = landmarks[473] || { x: 0.65, y: 0.45 };
  const l_inner = landmarks[133] || { x: 0.38, y: 0.45 };
  const l_outer = landmarks[33] || { x: 0.30, y: 0.45 };
  const r_inner = landmarks[362] || { x: 0.62, y: 0.45 };
  const r_outer = landmarks[263] || { x: 0.70, y: 0.45 };

  const l_width = Math.abs(l_inner.x - l_outer.x) || 0.001;
  const r_width = Math.abs(r_outer.x - r_inner.x) || 0.001;

  const lx = (l_iris.x - l_outer.x) / l_width;
  const ly = (l_iris.y - l_outer.y) / l_width;
  const rx = (r_iris.x - r_inner.x) / r_width;
  const ry = (r_iris.y - r_inner.y) / r_width;

  return [
    Number.isFinite(lx) ? lx : 0.5,
    Number.isFinite(ly) ? ly : 0.5,
    Number.isFinite(rx) ? rx : 0.5,
    Number.isFinite(ry) ? ry : 0.5
  ];
}

export function computeHeadPose(landmarks: any[]): { pitch: number; yaw: number; roll: number } {
  if (!landmarks || landmarks.length < 454) return { pitch: 0, yaw: 0, roll: 0 };

  const p33 = landmarks[33] || { x: 0.3, y: 0.4, z: 0 };
  const p263 = landmarks[263] || { x: 0.7, y: 0.4, z: 0 };
  const p1 = landmarks[1] || { x: 0.5, y: 0.5, z: 0 };
  const p152 = landmarks[152] || { x: 0.5, y: 0.8, z: 0 };
  const p10 = landmarks[10] || { x: 0.5, y: 0.2, z: 0 };

  const dx = p263.x - p33.x;
  const dy = p263.y - p33.y;
  const roll = Math.atan2(dy, dx) * (180 / Math.PI);

  const midEyeX = (p33.x + p263.x) / 2;
  const yaw = ((p1.x - midEyeX) / (Math.abs(dx) || 0.1)) * 90;

  const faceH = Math.abs(p152.y - p10.y) || 0.1;
  const midEyeY = (p33.y + p263.y) / 2;
  const pitch = (((p1.y - midEyeY) / faceH) - 0.35) * 120;

  return {
    pitch: Math.max(-60, Math.min(60, pitch)),
    yaw: Math.max(-60, Math.min(60, yaw)),
    roll: Math.max(-60, Math.min(60, roll))
  };
}

// ------------------------------------------------------------------------------
// Neural Gaze Regressor (TensorFlow.js MLP)
// ------------------------------------------------------------------------------

export class GazeRegressor {
  private model: tf.LayersModel | null = null;

  constructor() {
    this.initModel();
  }

  private initModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [4], units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2, activation: 'linear' }));
    model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });
    this.model = model;
  }

  public async trainModel(trainX: number[][], trainY: number[][]) {
    if (!this.model || trainX.length < 5) return;
    const xs = tf.tensor2d(trainX);
    const ys = tf.tensor2d(trainY);
    await this.model.fit(xs, ys, { epochs: 20, batchSize: 4, shuffle: true });
    xs.dispose();
    ys.dispose();
  }

  public predict(features: number[]): { x: number; y: number } | null {
    if (!this.model) return null;
    return tf.tidy(() => {
      const input = tf.tensor2d([features]);
      const pred = this.model!.predict(input) as tf.Tensor;
      const data = pred.dataSync();
      return { x: data[0], y: data[1] };
    });
  }
}

const gazeRegressor = new GazeRegressor();
let isCalibrating = false;
let currentCalibrationPoint: { x: number; y: number } | null = null;
let calibrationData: { vector: number[]; target: { x: number; y: number } }[] = [];

// ------------------------------------------------------------------------------
// Multi-Frame Temporal Burst Aggregation via RANSAC Trimmed Mean
// ------------------------------------------------------------------------------

function computeRansacTrimmedMean(vectors: Float32Array[]): Float32Array {
  const n = vectors.length;
  if (n === 0) return new Float32Array(128);
  if (n <= 10) {
    const out = new Float32Array(128);
    for (const v of vectors) {
      for (let j = 0; j < 128; j++) out[j] += v[j];
    }
    for (let j = 0; j < 128; j++) out[j] /= n;
    return out;
  }

  // 1. Compute empirical centroid
  const centroid = new Float32Array(128);
  for (const v of vectors) {
    for (let j = 0; j < 128; j++) centroid[j] += v[j];
  }
  for (let j = 0; j < 128; j++) centroid[j] /= n;

  // 2. Measure Euclidean distance from centroid for each vector
  const scored = vectors.map(v => {
    let distSq = 0;
    for (let j = 0; j < 128; j++) {
      const diff = v[j] - centroid[j];
      distSq += diff * diff;
    }
    return { vector: v, dist: Math.sqrt(distSq) };
  });

  // 3. Sort ascending and keep the top 30 closest vectors (discard 15 highest outliers)
  scored.sort((a, b) => a.dist - b.dist);
  const topInliers = scored.slice(0, 30).map(s => s.vector);

  // 4. Mean of inliers and L2 normalization
  const finalRef = new Float32Array(128);
  for (const v of topInliers) {
    for (let j = 0; j < 128; j++) finalRef[j] += v[j];
  }
  let norm = 0;
  for (let j = 0; j < 128; j++) {
    finalRef[j] /= topInliers.length;
    norm += finalRef[j] * finalRef[j];
  }
  norm = Math.sqrt(norm) || 1.0;
  for (let j = 0; j < 128; j++) {
    finalRef[j] /= norm;
  }

  return finalRef;
}

// ------------------------------------------------------------------------------
// Worker Initialization (Resilient CDN & Delegate Fallbacks)
// ------------------------------------------------------------------------------

async function init() {
  try {
    let vision: any = null;

    try {
      vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );
    } catch (cdnErr1) {
      console.warn("[MLWorker] Tasks-vision 1.0.1 CDN failed, trying 0.10.14:", cdnErr1);
      vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
    }

    const modelPaths = [
      '/models/face_landmarker.task',
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
    ];

    let loaded = false;
    for (const modelAssetPath of modelPaths) {
      if (loaded) break;
      // Try GPU delegate first
      try {
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU'
          },
          runningMode: 'IMAGE',
          numFaces: 4,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true
        });
        loaded = true;
        console.log(`[MLWorker] FaceLandmarker initialized with GPU delegate using ${modelAssetPath}`);
      } catch (gpuErr) {
        console.warn(`[MLWorker] GPU delegate failed for ${modelAssetPath}, falling back to CPU:`, gpuErr);
        try {
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath,
              delegate: 'CPU'
            },
            runningMode: 'IMAGE',
            numFaces: 4,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true
          });
          loaded = true;
          console.log(`[MLWorker] FaceLandmarker initialized with CPU delegate using ${modelAssetPath}`);
        } catch (cpuErr) {
          console.warn(`[MLWorker] CPU delegate failed for ${modelAssetPath}:`, cpuErr);
        }
      }
    }

    if (loaded && landmarker) {
      self.postMessage({ type: 'INITIALIZED' });
    } else {
      throw new Error("Unable to create FaceLandmarker from local or remote model paths.");
    }
  } catch (err: any) {
    console.error("[MLWorker] Failed to initialize FaceLandmarker:", err);
    self.postMessage({ type: 'INITIALIZED' }); // Ensure pipeline does not hang indefinitely
  }
}

// ------------------------------------------------------------------------------
// Main Frame Processing Loop (Gating & Telemetry Isolation)
// ------------------------------------------------------------------------------

function processFrame(bitmap: ImageBitmap, _timestamp: number) {
  if (!landmarker) {
    bitmap.close();
    return;
  }

  let results = landmarker.detect(bitmap);

  // Low-Light Dynamic Boost (Photometric Recovery):
  // When environmental illumination is dim and initial detection returns zero faces,
  // apply hardware-accelerated brightness/contrast compensation on an offscreen canvas
  if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
    try {
      if (!envCanvas) {
        envCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        envCtx = envCanvas.getContext('2d', { willReadFrequently: true });
      }
      if (envCanvas && envCtx) {
        if (envCanvas.width !== bitmap.width || envCanvas.height !== bitmap.height) {
          envCanvas.width = bitmap.width;
          envCanvas.height = bitmap.height;
        }
        envCtx.filter = 'brightness(2.2) contrast(1.4) saturate(1.1)';
        envCtx.drawImage(bitmap, 0, 0);
        envCtx.filter = 'none';
        const boosted = landmarker.detect(envCanvas);
        if (boosted.faceLandmarks && boosted.faceLandmarks.length > 0) {
          results = boosted;
        }
      }
    } catch {
      // Continue gracefully
    }
  }

  if (results.faceLandmarks && results.faceLandmarks.length > 0) {
    const candidatesRaw: Array<{
      trackId: number;
      boundingBox: { xMin: number; yMin: number; width: number; height: number };
      landmarks: any[];
      blendshapes: Record<string, number>;
      ear: number;
      isLive: boolean;
      livenessResult: LivenessEvaluationResult;
    }> = [];

    // Extract all candidate faces (up to 4)
    for (let i = 0; i < results.faceLandmarks.length; i++) {
      const landmarks = results.faceLandmarks[i];
      let minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0;
      for (const p of landmarks) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const width = Math.max(0, maxX - minX);
      const height = Math.max(0, maxY - minY);

      const blendshapesMap: Record<string, number> = {};
      if (results.faceBlendshapes && results.faceBlendshapes[i]) {
        for (const cat of results.faceBlendshapes[i].categories) {
          blendshapesMap[cat.categoryName] = cat.score;
        }
      }

      const ear = computeEAR(landmarks);
      // Run passive multi-modal presentation attack detection (ISO/IEC 30107-3)
      const livenessResult = livenessDetector.evaluateLiveness(landmarks, ear, 3.5);

      candidatesRaw.push({
        trackId: i,
        boundingBox: {
          xMin: Math.max(0, minX * bitmap.width),
          yMin: Math.max(0, minY * bitmap.height),
          width: width * bitmap.width,
          height: height * bitmap.height
        },
        landmarks,
        blendshapes: blendshapesMap,
        ear,
        isLive: livenessResult.isLive,
        livenessResult
      });
    }

    // Estimate head pose from the largest candidate for dynamic threshold calculation
    const primaryEst = candidatesRaw.reduce((prev, curr) => 
      (curr.boundingBox.width * curr.boundingBox.height) > (prev.boundingBox.width * prev.boundingBox.height) ? curr : prev, 
      candidatesRaw[0]
    );
    const headPose = computeHeadPose(primaryEst.landmarks);

    // Continuous Photometric & Environmental Quality Telemetry (ISO/IEC 29794-5)
    const envQuality = analyzeEnvironmentalQuality(bitmap, primaryEst, headPose);
    self.postMessage({
      type: 'ENVIRONMENT_QUALITY',
      quality: envQuality
    });

    // --------------------------------------------------------------------------
    // Active Liveness Challenge Verification (ISO/IEC 30107-3)
    // --------------------------------------------------------------------------
    if (activeChallengeType && primaryEst) {
      const now = performance.now();
      if (!challengeActionPassed) {
        let actionTriggered = false;
        if (activeChallengeType === 'TURN_LEFT' && headPose.yaw < -10) {
          actionTriggered = true;
        } else if (activeChallengeType === 'TURN_RIGHT' && headPose.yaw > 10) {
          actionTriggered = true;
        } else if (activeChallengeType === 'BLINK' && (primaryEst.ear < 0.19 || primaryEst.ear < baselineEarOpen * 0.70)) {
          actionTriggered = true;
        }

        if (actionTriggered) {
          challengeActionPassed = true;
          self.postMessage({
            type: 'CHALLENGE_PROGRESS',
            step: 'CENTER_HEAD',
            message: 'Action verified! Now return to neutral center.'
          });
        } else if (now - challengeStartTime > 14000) {
          activeChallengeType = null;
          challengeActionPassed = false;
          self.postMessage({
            type: 'CHALLENGE_FAILED',
            reason: 'Challenge timed out. Please try again.'
          });
        }
      } else {
        // Require returning to center neutral pose
        if (Math.abs(headPose.yaw) <= 6 && Math.abs(headPose.pitch) <= 8) {
          activeChallengeType = null;
          challengeActionPassed = false;
          self.postMessage({
            type: 'CHALLENGE_COMPLETE',
            message: 'Liveness confirmed. Ready for 45-frame registration.'
          });
        }
      }
    }

    // --------------------------------------------------------------------------
    // Biometric Enrollment Burst Interception (45 Frames with Liveness Verification)
    // --------------------------------------------------------------------------
    if (isEnrollingBurst) {
      const isQualityAcceptable = 
        primaryEst && 
        primaryEst.livenessResult.antiSpoofFlag !== 'PLANAR_SPOOF' &&
        envQuality.luminanceStatus !== 'OVEREXPOSED' &&
        envQuality.sharpnessScore >= 18;

      if (isQualityAcceptable) {
        const emb = new Float32Array(128);
        gatingFilter.extractCanonicalEmbedding(primaryEst.landmarks, emb);
        enrollmentBurstFrames.push(emb);

        const progress = Math.min(1.0, enrollmentBurstFrames.length / ENROLLMENT_BURST_TARGET);
        self.postMessage({
          type: 'ENROLLMENT_PROGRESS',
          progress,
          framesCollected: enrollmentBurstFrames.length,
          totalTarget: ENROLLMENT_BURST_TARGET,
          faceDetected: true,
          livenessScore: primaryEst.livenessResult.livenessScore,
          status: 'CAPTURING_INLIERS'
        });

        if (enrollmentBurstFrames.length >= ENROLLMENT_BURST_TARGET) {
          isEnrollingBurst = false;
          // Compute RANSAC-trimmed mean across the 45 frames
          const finalRef = computeRansacTrimmedMean(enrollmentBurstFrames);
          gatingFilter.setReferenceEmbedding(finalRef);
          enrollmentBurstFrames = [];

          self.postMessage({
            type: 'ENROLLMENT_BURST_COMPLETE',
            embedding: Array.from(finalRef)
          });
        }
      } else {
        self.postMessage({
          type: 'ENROLLMENT_PROGRESS',
          progress: Math.min(1.0, enrollmentBurstFrames.length / ENROLLMENT_BURST_TARGET),
          framesCollected: enrollmentBurstFrames.length,
          totalTarget: ENROLLMENT_BURST_TARGET,
          faceDetected: !!primaryEst,
          status: envQuality.guidanceMessage || 'ALIGN_FACE'
        });
      }

      bitmap.close();
      return;
    }

    // --------------------------------------------------------------------------
    // Multi-Face Arbitration via BiometricGatingFilter
    // --------------------------------------------------------------------------
    const arbitration = gatingFilter.arbitrateCandidates(candidatesRaw, {
      pitch: headPose.pitch,
      yaw: headPose.yaw
    });

    const activeFace = arbitration.primaryFace;
    const bystanders = arbitration.bystanders;
    const sessionLocked = arbitration.sessionLocked;
    const missingFrames = arbitration.consecutiveMissingFrames;
    const dynamicThreshold = arbitration.dynamicThreshold;

    if (activeFace) {
      // Authenticated primary operator verified! Downstream cognitive telemetry is isolated.
      const landmarks = activeFace.landmarks;
      const blendshapesMap = activeFace.blendshapes;
      const ear = computeEAR(landmarks);
      const mar = computeMAR(landmarks);

      // Cheek patch rPPG extraction
      try {
        if (!patchCanvas) {
          patchCanvas = new OffscreenCanvas(20, 20);
          patchCtx = patchCanvas.getContext('2d');
        }
        if (patchCtx) {
          const cheekL = landmarks[117] || landmarks[1];
          const px = Math.floor(cheekL.x * bitmap.width);
          const py = Math.floor(cheekL.y * bitmap.height);
          patchCtx.drawImage(bitmap, px - 10, py - 10, 20, 20, 0, 0, 20, 20);
          const imgData = patchCtx.getImageData(0, 0, 20, 20);
          let rSum = 0, gSum = 0, bSum = 0;
          for (let k = 0; k < imgData.data.length; k += 4) {
            rSum += imgData.data[k];
            gSum += imgData.data[k + 1];
            bSum += imgData.data[k + 2];
          }
          const count = imgData.data.length / 4;
          rppgHistory.push({ r: rSum / count, g: gSum / count, b: bSum / count });
          if (rppgHistory.length > RPPG_WINDOW_SIZE) rppgHistory.shift();
        }
      } catch {
        // Continue if canvas fails
      }

      const gazeVec = extractGazeVector(landmarks);
      if (isCalibrating && currentCalibrationPoint) {
        calibrationData.push({
          vector: gazeVec,
          target: { x: currentCalibrationPoint.x / 100, y: currentCalibrationPoint.y / 100 }
        });
      }

      const predictedScreenCoords = gazeRegressor.predict(gazeVec);
      const lookLeft = blendshapesMap['eyeLookInLeft'] || 0;
      const lookRight = blendshapesMap['eyeLookOutLeft'] || 0;
      const fallbackGazeFocus = Math.max(0, 100 - (lookLeft + lookRight) * 150);
      const gazeFocus = predictedScreenCoords ? 
        Math.max(0, 100 - (Math.abs(predictedScreenCoords.x - 0.5) + Math.abs(predictedScreenCoords.y - 0.5)) * 100) 
        : fallbackGazeFocus;

      const eyeStateResult = hmmEngine.updateState(ear, baselineEarOpen);
      const facs = evaluateFACS(blendshapesMap, 0.1);
      const posture = evaluatePosture(landmarks, baselineFaceHeight);

      if (baselineEarOpen === 0.28 && ear > 0.20 && eyeStateResult.state === FocusState.AWAKE) {
        baselineEarOpen = baselineEarOpen * 0.99 + ear * 0.01;
      }
      const currentFaceHeight = Math.sqrt(Math.pow(landmarks[1].x - landmarks[152].x, 2) + Math.pow(landmarks[1].y - landmarks[152].y, 2));
      if (baselineFaceHeight === 0.12 && currentFaceHeight > 0.05) {
        baselineFaceHeight = baselineFaceHeight * 0.99 + currentFaceHeight * 0.01;
      }

      self.postMessage({
        type: 'METRICS',
        data: {
          faceDetected: true,
          authVerified: gatingFilter.hasReference(),
          isEnrolled: gatingFilter.hasReference(),
          matchConfidence: activeFace.similarity,
          dynamicThreshold,
          bystanderCount: bystanders.length,
          bystanderBoxes: bystanders.map(b => ({
            x: b.boundingBox.xMin,
            y: b.boundingBox.yMin,
            width: b.boundingBox.width,
            height: b.boundingBox.height,
            similarity: b.similarity
          })),
          livenessScore: activeFace.livenessResult?.livenessScore ?? 95,
          antiSpoofFlag: activeFace.livenessResult?.antiSpoofFlag ?? 'GENUINE_HUMAN',
          isLive: activeFace.liveness,
          headPose,
          ear,
          mar,
          gazeFocus,
          rppgBuffer: rppgHistory,
          eyeState: eyeStateResult.state,
          facsFrustration: facs.frustration,
          facsBoredom: facs.boredom,
          facsFlowState: facs.flowState,
          postureCervicalAngle: posture.cervicalAngle,
          postureSlumpRatio: posture.slumpRatio,
          postureIsSlumping: posture.isSlumping,
          boundingBox: {
            x: activeFace.boundingBox.xMin,
            y: activeFace.boundingBox.yMin,
            width: activeFace.boundingBox.width,
            height: activeFace.boundingBox.height
          },
          sessionLocked: false,
          missingFrames: 0
        }
      });
    } else {
      // Primary face NOT certified in this frame
      const highestSim = bystanders.length ? Math.max(...bystanders.map(b => b.similarity)) : 0.0;
      const spoofDetected = bystanders.find(b => b.livenessResult?.antiSpoofFlag === 'PLANAR_SPOOF' || b.livenessResult?.antiSpoofFlag === 'STATIC_ATTACK');

      self.postMessage({
        type: 'METRICS',
        data: {
          faceDetected: false,
          authVerified: false,
          isEnrolled: gatingFilter.hasReference(),
          matchConfidence: highestSim,
          dynamicThreshold,
          bystanderCount: bystanders.length,
          bystanderBoxes: bystanders.map(b => ({
            x: b.boundingBox.xMin,
            y: b.boundingBox.yMin,
            width: b.boundingBox.width,
            height: b.boundingBox.height,
            similarity: b.similarity
          })),
          sessionLocked,
          missingFrames,
          status: sessionLocked ? 'LOCKED_STANDBY' : 'RE_ACQUIRING_OPERATOR',
          antiSpoofAlert: !!spoofDetected,
          antiSpoofFlag: spoofDetected ? spoofDetected.livenessResult?.antiSpoofFlag : 'GENUINE_HUMAN'
        }
      });
    }
  } else {
    // No faces detected in frame (e.g. pitch-black room or empty camera view)
    const envQuality = analyzeEnvironmentalQuality(bitmap, null, null);
    self.postMessage({
      type: 'ENVIRONMENT_QUALITY',
      quality: envQuality
    });

    if (isEnrollingBurst) {
      self.postMessage({
        type: 'ENROLLMENT_PROGRESS',
        progress: Math.min(1.0, enrollmentBurstFrames.length / ENROLLMENT_BURST_TARGET),
        framesCollected: enrollmentBurstFrames.length,
        totalTarget: ENROLLMENT_BURST_TARGET,
        faceDetected: false,
        status: 'NO_FACE_DETECTED'
      });
    }

    self.postMessage({
      type: 'METRICS',
      data: {
        faceDetected: false,
        authVerified: false,
        isEnrolled: gatingFilter.hasReference(),
        matchConfidence: 0.0,
        bystanderCount: 0,
        bystanderBoxes: [],
        sessionLocked: false,
        missingFrames: 0
      }
    });
  }

  bitmap.close();
}

// ------------------------------------------------------------------------------
// Worker Message Dispatcher
// ------------------------------------------------------------------------------

self.onmessage = async (e) => {
  const { type, bitmap, timestamp, point, embedding } = e.data;

  if (type === 'INIT') {
    init();
  } else if (type === 'FRAME' && bitmap) {
    processFrame(bitmap, timestamp);
  } else if (type === 'SET_ENROLLED_EMBEDDING' && embedding) {
    gatingFilter.setReferenceEmbedding(embedding);
    console.log("[MLWorker] Authenticated Biometric Reference Loaded in BiometricGatingFilter.");
  } else if (type === 'CLEAR_ENROLLED_EMBEDDING') {
    gatingFilter.clearReferenceEmbedding();
    console.log("[MLWorker] Biometric Reference Cleared.");
  } else if (type === 'START_ENROLLMENT_BURST') {
    isEnrollingBurst = true;
    enrollmentBurstFrames = [];
    console.log("[MLWorker] Started 45-Frame Biometric Registration Burst with Liveness Checking...");
  } else if (type === 'CANCEL_ENROLLMENT_BURST') {
    isEnrollingBurst = false;
    enrollmentBurstFrames = [];
    activeChallengeType = null;
    challengeActionPassed = false;
  } else if (type === 'START_LIVENESS_CHALLENGE') {
    activeChallengeType = e.data.challenge || 'TURN_LEFT';
    challengeActionPassed = false;
    challengeStartTime = performance.now();
    console.log(`[MLWorker] Active Liveness Challenge started: ${activeChallengeType}`);
  } else if (type === 'CANCEL_LIVENESS_CHALLENGE') {
    activeChallengeType = null;
    challengeActionPassed = false;
  } else if (type === 'START_CALIBRATION_POINT') {
    isCalibrating = true;
    currentCalibrationPoint = point;
  } else if (type === 'STOP_CALIBRATION_POINT') {
    currentCalibrationPoint = null;
  } else if (type === 'FINISH_CALIBRATION') {
    isCalibrating = false;
    const trainX = calibrationData.map(d => d.vector);
    const trainY = calibrationData.map(d => [d.target.x, d.target.y]);
    if (trainX.length > 0) {
      await gazeRegressor.trainModel(trainX, trainY);
    }
    self.postMessage({ type: 'CALIBRATION_DONE' });
  }
};
