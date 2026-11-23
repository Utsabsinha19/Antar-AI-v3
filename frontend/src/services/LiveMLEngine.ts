import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;

export async function initializeMLModels() {
  if (faceLandmarker) return faceLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });
  return faceLandmarker;
}

export function calculateEAR(landmarks: any[]) {
  // Landmarks points for eye aspect ratio (EAR)
  // Left eye
  const p1_l = landmarks[33]; // outer corner
  const p4_l = landmarks[133]; // inner corner
  const p2_l = landmarks[159]; // upper
  const p3_l = landmarks[158]; // upper
  const p5_l = landmarks[144]; // lower
  const p6_l = landmarks[145]; // lower

  // Right eye
  const p1_r = landmarks[362];
  const p4_r = landmarks[263];
  const p2_r = landmarks[385];
  const p3_r = landmarks[386];
  const p5_r = landmarks[374];
  const p6_r = landmarks[380];

  const distVal = (pa: any, pb: any) => 
    Math.sqrt(Math.pow(pa.x - pb.x, 2) + Math.pow(pa.y - pb.y, 2) + Math.pow(pa.z - pb.z, 2));

  const calcSingleEAR = (p1: any, p2: any, p3: any, p4: any, p5: any, p6: any) => {
    const numerator = distVal(p2, p6) + distVal(p3, p5);
    const denominator = 2.0 * distVal(p1, p4);
    return numerator / denominator;
  };

  const earLeft = calcSingleEAR(p1_l, p2_l, p3_l, p4_l, p5_l, p6_l);
  const earRight = calcSingleEAR(p1_r, p2_r, p3_r, p4_r, p5_r, p6_r);

  return (earLeft + earRight) / 2.0;
}

export function calculateMAR(landmarks: any[]) {
  // Mouth Aspect Ratio for yawning/boredom
  const leftCorner = landmarks[61];
  const rightCorner = landmarks[291];
  const topLip = landmarks[13];
  const bottomLip = landmarks[14];

  const distVal = (pa: any, pb: any) => 
    Math.sqrt(Math.pow(pa.x - pb.x, 2) + Math.pow(pa.y - pb.y, 2) + Math.pow(pa.z - pb.z, 2));

  const mouthWidth = distVal(leftCorner, rightCorner);
  const mouthHeight = distVal(topLip, bottomLip);

  return mouthHeight / mouthWidth;
}
