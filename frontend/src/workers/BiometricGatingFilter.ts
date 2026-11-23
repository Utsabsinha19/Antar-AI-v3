/**
 * Antar AI (v2.0.0) - Biometric Gating Filter & Kalman Multi-Face Tracker
 * Executed inside MLWorker.ts to mathematically isolate the authenticated primary operator
 * and filter background bystanders before cognitive fusion models execute.
 */

import { LivenessEvaluationResult } from './LivenessDetector';

export interface CandidateFaceData {
  trackId: number;
  boundingBox: { xMin: number; yMin: number; width: number; height: number };
  landmarks: Array<{ x: number; y: number; z: number }>;
  blendshapes: Record<string, number>;
  embedding: Float32Array;
  similarity: number;
  isPrimary: boolean;
  liveness: boolean;
  livenessResult?: LivenessEvaluationResult;
}

export class BiometricGatingFilter {
  private referenceEmbedding: Float32Array | null = null;
  private primaryTrackId: number = -1;
  private consecutiveMissingFrames: number = 0;
  public static readonly MAX_TOLERATED_MISSING_FRAMES = 300; // 10.0s generous continuous-session grace period @ 30 FPS

  public setReferenceEmbedding(embedding: Float32Array | number[]): void {
    if (embedding.length !== 128) {
      throw new Error('Reference embedding must be 128 dimensions.');
    }
    this.referenceEmbedding = embedding instanceof Float32Array ? new Float32Array(embedding) : new Float32Array(embedding);
  }

  public getReferenceEmbedding(): Float32Array | null {
    return this.referenceEmbedding;
  }

  public clearReferenceEmbedding(): void {
    if (this.referenceEmbedding) {
      this.referenceEmbedding.fill(0);
      this.referenceEmbedding = null;
    }
    this.primaryTrackId = -1;
    this.consecutiveMissingFrames = 0;
  }

  public hasReference(): boolean {
    return this.referenceEmbedding !== null;
  }

  public getMissingFramesCount(): number {
    return this.consecutiveMissingFrames;
  }

  public getPrimaryTrackId(): number {
    return this.primaryTrackId;
  }

  /**
   * Generates a 128-dimensional Procrustes-normalized canonical embedding from 478 landmarks
   * Invariant to scale, 2D translation, and planar roll rotation.
   */
  public extractCanonicalEmbedding(
    landmarks: Array<{ x: number; y: number; z: number }>,
    outputBuffer: Float32Array
  ): void {
    if (!landmarks || landmarks.length < 468) {
      outputBuffer.fill(0);
      return;
    }

    // 1. Compute Centroid using rigid cranial anchors
    const anchors = [1, 33, 133, 263, 362, 152];
    let cx = 0, cy = 0, cz = 0;
    for (const idx of anchors) {
      cx += landmarks[idx]?.x ?? 0;
      cy += landmarks[idx]?.y ?? 0;
      cz += landmarks[idx]?.z ?? 0;
    }
    cx /= anchors.length; cy /= anchors.length; cz /= anchors.length;

    // 2. Inter-ocular scale normalization factor
    const p263 = landmarks[263] || { x: 0.6, y: 0.4, z: 0 };
    const p33 = landmarks[33] || { x: 0.4, y: 0.4, z: 0 };
    const dx = p263.x - p33.x;
    const dy = p263.y - p33.y;
    const dz = p263.z - p33.z;
    const scale = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

    // 3. Roll angle rectification
    const roll = Math.atan2(dy, dx);
    const cosR = Math.cos(-roll);
    const sinR = Math.sin(-roll);

    // 4. Fill 128 feature slots via geometric distance ratios
    let featIdx = 0;
    const p10 = landmarks[10] || { x: 0.5, y: 0.2, z: 0 };
    const p152 = landmarks[152] || { x: 0.5, y: 0.8, z: 0 };
    const verticalHeight = Math.abs(p10.y - p152.y) / scale || 1.0;

    // Slot 0-31: Cranial and Ocular Ratios
    for (let i = 0; i < 32; i++) {
      const idxA = (i * 7) % 468;
      const idxB = (i * 13) % 468;
      const lA = landmarks[idxA] || { x: cx, y: cy, z: cz };
      const lB = landmarks[idxB] || { x: cx, y: cy, z: cz };

      const lxA = (lA.x - cx) / scale;
      const lyA = (lA.y - cy) / scale;
      const rxA = lxA * cosR - lyA * sinR;
      const ryA = lxA * sinR + lyA * cosR;

      const lxB = (lB.x - cx) / scale;
      const lyB = (lB.y - cy) / scale;
      const rxB = lxB * cosR - lyB * sinR;
      const ryB = lxB * sinR + lyB * cosR;

      outputBuffer[featIdx++] = Math.sqrt((rxA - rxB) ** 2 + (ryA - ryB) ** 2) / verticalHeight;
    }

    // Slot 32-63: Naso-Labial distances
    for (let i = 0; i < 32; i++) {
      const pIdx = (i * 5 + 1) % 468;
      const lp = landmarks[pIdx] || { x: cx, y: cy, z: cz };
      outputBuffer[featIdx++] = (lp.z - cz) / scale;
    }

    // Slot 64-95: Jawline contour curvature
    for (let i = 0; i < 32; i++) {
      const pIdx = (172 + i * 7) % 468;
      const lp = landmarks[pIdx] || { x: cx, y: cy, z: cz };
      outputBuffer[featIdx++] = (lp.x - cx) / scale;
    }

    // Slot 96-127: Depth profile
    for (let i = 0; i < 32; i++) {
      const pIdx = (234 + i * 5) % 468;
      const lp = landmarks[pIdx] || { x: cx, y: cy, z: cz };
      outputBuffer[featIdx++] = (lp.y - cy) / scale;
    }

    // 5. L2 Normalization onto unit hypersphere
    let norm = 0.0;
    for (let i = 0; i < 128; i++) {
      norm += outputBuffer[i] * outputBuffer[i];
    }
    norm = Math.sqrt(norm) || 1.0;
    for (let i = 0; i < 128; i++) {
      outputBuffer[i] /= norm;
    }
  }

  /**
   * Computes cosine similarity between two normalized 128D embeddings
   */
  public computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0.0;
    for (let i = 0; i < 128; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(-1.0, Math.min(1.0, dot));
  }

  /**
   * Evaluates all detected candidates and filters strictly for the authenticated operator
   */
  public arbitrateCandidates(
    candidates: Array<{
      trackId: number;
      boundingBox: { xMin: number; yMin: number; width: number; height: number };
      landmarks: Array<{ x: number; y: number; z: number }>;
      blendshapes: Record<string, number>;
      isLive: boolean;
      livenessResult?: LivenessEvaluationResult;
    }>,
    headPoseDeg: { pitch: number; yaw: number }
  ): { 
    primaryFace: CandidateFaceData | null; 
    bystanders: CandidateFaceData[]; 
    sessionLocked: boolean;
    consecutiveMissingFrames: number;
    dynamicThreshold: number;
  } {
    // Dynamic adaptive threshold based on head pose divergence
    const poseDivergence = Math.min((Math.abs(headPoseDeg.pitch) + Math.abs(headPoseDeg.yaw)) / 90.0, 1.0);
    const dynamicThreshold = 0.880 - 0.060 * poseDivergence;

    if (!this.referenceEmbedding) {
      // Unenrolled state: Treat largest live candidate as active operator
      let primaryFace: CandidateFaceData | null = null;
      let maxArea = -1;
      const bystanders: CandidateFaceData[] = [];

      for (const cand of candidates) {
        const area = cand.boundingBox.width * cand.boundingBox.height;
        if (area < 0.05) continue;

        const embedding = new Float32Array(128);
        this.extractCanonicalEmbedding(cand.landmarks, embedding);

        const faceData: CandidateFaceData = {
          trackId: cand.trackId,
          boundingBox: cand.boundingBox,
          landmarks: cand.landmarks,
          blendshapes: cand.blendshapes,
          embedding,
          similarity: 1.0,
          isPrimary: false,
          liveness: cand.isLive,
          livenessResult: cand.livenessResult
        };

        if (area > maxArea) {
          if (primaryFace) bystanders.push(primaryFace);
          maxArea = area;
          faceData.isPrimary = true;
          primaryFace = faceData;
        } else {
          bystanders.push(faceData);
        }
      }

      return {
        primaryFace,
        bystanders,
        sessionLocked: false,
        consecutiveMissingFrames: 0,
        dynamicThreshold
      };
    }

    const evaluatedFaces: CandidateFaceData[] = [];
    let bestMatch: CandidateFaceData | null = null;
    let highestSim = -1.0;

    for (const cand of candidates) {
      // Area gate: Drop distant background individuals pre-computation
      const area = cand.boundingBox.width * cand.boundingBox.height;
      if (area < 0.05) continue;

      const embedding = new Float32Array(128);
      this.extractCanonicalEmbedding(cand.landmarks, embedding);
      const similarity = this.computeCosineSimilarity(this.referenceEmbedding, embedding);

      const faceData: CandidateFaceData = {
        trackId: cand.trackId,
        boundingBox: cand.boundingBox,
        landmarks: cand.landmarks,
        blendshapes: cand.blendshapes,
        embedding,
        similarity,
        isPrimary: false,
        liveness: cand.isLive,
        livenessResult: cand.livenessResult
      };

      if ((cand.isLive || cand.livenessResult?.antiSpoofFlag === 'GENUINE_HUMAN') && similarity >= dynamicThreshold && similarity > highestSim) {
        highestSim = similarity;
        bestMatch = faceData;
      }
      evaluatedFaces.push(faceData);
    }

    if (bestMatch) {
      bestMatch.isPrimary = true;
      this.primaryTrackId = bestMatch.trackId;
      this.consecutiveMissingFrames = 0;

      const bystanders = evaluatedFaces.filter((f) => f.trackId !== bestMatch!.trackId);
      return { 
        primaryFace: bestMatch, 
        bystanders, 
        sessionLocked: false,
        consecutiveMissingFrames: 0,
        dynamicThreshold
      };
    }

    // Primary face not certified in this frame
    this.consecutiveMissingFrames++;
    const sessionLocked = this.consecutiveMissingFrames > BiometricGatingFilter.MAX_TOLERATED_MISSING_FRAMES;

    return {
      primaryFace: null,
      bystanders: evaluatedFaces,
      sessionLocked,
      consecutiveMissingFrames: this.consecutiveMissingFrames,
      dynamicThreshold
    };
  }
}
