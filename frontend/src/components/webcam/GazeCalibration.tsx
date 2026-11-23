import { useState, useEffect } from 'react';

interface Point {
  x: number;
  y: number;
}

const CALIBRATION_POINTS: Point[] = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 90, y: 10 },
  { x: 10, y: 50 },
  { x: 50, y: 50 },
  { x: 90, y: 50 },
  { x: 10, y: 90 },
  { x: 50, y: 90 },
  { x: 90, y: 90 },
];

interface GazeCalibrationProps {
  onComplete: () => void;
  onPointFocus: (point: Point, durationMs: number) => void;
}

export function GazeCalibration({ onComplete, onPointFocus }: GazeCalibrationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFocusing, setIsFocusing] = useState(false);

  useEffect(() => {
    if (currentIndex >= CALIBRATION_POINTS.length) {
      onComplete();
      return;
    }

    // Wait a brief moment before starting collection for the current point
    const preDelay = setTimeout(() => {
      setIsFocusing(true);
      const point = CALIBRATION_POINTS[currentIndex];
      const durationMs = 1500;
      onPointFocus(point, durationMs);

      // After duration, move to next point
      setTimeout(() => {
        setIsFocusing(false);
        setCurrentIndex(prev => prev + 1);
      }, durationMs);
    }, 1000); // 1 second to move eyes to the next dot

    return () => clearTimeout(preDelay);
  }, [currentIndex, onComplete, onPointFocus]);

  if (currentIndex >= CALIBRATION_POINTS.length) {
    return null;
  }

  const point = CALIBRATION_POINTS[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0">
        <div
          className={`absolute w-8 h-8 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
            isFocusing ? 'bg-emerald-500 scale-125 shadow-[0_0_20px_rgba(16,185,129,0.8)]' : 'bg-red-500 animate-pulse'
          }`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        />
      </div>
      <div className="text-white text-xl font-medium bg-slate-800/80 px-6 py-3 rounded-lg backdrop-blur border border-slate-700">
        {isFocusing ? 'Keep looking at the dot...' : 'Look at the red dot'}
        <div className="text-sm text-slate-400 text-center mt-1">
          Point {currentIndex + 1} of 9
        </div>
      </div>
    </div>
  );
}
