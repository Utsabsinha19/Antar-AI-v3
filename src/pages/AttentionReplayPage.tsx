// ============================================================
// AttentionReplayPage - AI session replay with visual overlays
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  Brain,
  Clock3,
  Eye,
  Flame,
  Pause,
  Play,
  Radar,
  ScanFace,
  SkipBack,
  SkipForward,
  Sparkles,
  Target,
  ThermometerSun,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import StatCard from '@/components/ui/StatCard';
import { TimeSeriesPoint, useAnalysis } from '@/store/analysisStore';

interface ReplayFrame {
  index: number;
  time: string;
  engagement: number;
  attention: number;
  focus: number;
  emotion: number;
  fatigue: number;
  x: number;
  y: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

const buildFromTimeline = (timeline: TimeSeriesPoint[]) => timeline.map((point, index) => ({
  index,
  time: point.time,
  engagement: point.engagement,
  attention: point.attentionConfidence,
  focus: point.deepFocus,
  emotion: clamp(100 - point.boredomIndex * 0.72 - point.cognitiveFatigueIndex * 0.28),
  fatigue: point.cognitiveFatigueIndex,
  x: clamp(50 + Math.sin(index * 0.78) * 24 + (point.attentionConfidence - 50) * 0.16, 14, 86),
  y: clamp(50 + Math.cos(index * 0.52) * 18 - (point.deepFocus - 50) * 0.12, 16, 84),
}));

const buildSyntheticReplay = (sessionCount: number, seed = 0): ReplayFrame[] => (
  Array.from({ length: 72 }, (_, index) => {
    const wave = Math.sin((index + seed) / 7);
    const micro = Math.cos((index + seed) / 3.4);
    const fatigueRamp = index / 72;
    const attention = clamp(64 + wave * 18 + micro * 7 - fatigueRamp * 10);
    const focus = clamp(68 + Math.cos((index + seed) / 9) * 16 - fatigueRamp * 6);
    const engagement = clamp(0.45 * attention + 0.35 * focus + 12 + Math.sin(index / 5) * 8);
    const fatigue = clamp(18 + fatigueRamp * 34 + Math.max(0, -wave) * 10);

    return {
      index,
      time: formatTime(index * 5),
      engagement,
      attention,
      focus,
      emotion: clamp(82 - fatigue * 0.42 + Math.sin(index / 6) * 10),
      fatigue,
      x: clamp(50 + Math.sin(index / 4 + sessionCount) * 30, 12, 88),
      y: clamp(50 + Math.cos(index / 5 + sessionCount) * 22, 14, 86),
    };
  })
);

const colorFor = (value: number) => {
  if (value >= 80) return '#39ff14';
  if (value >= 60) return '#00f0ff';
  if (value >= 40) return '#ff6b35';
  return '#ff006e';
};

const emotionLabel = (frame: ReplayFrame) => {
  if (frame.emotion >= 78 && frame.focus >= 70) return 'Flow';
  if (frame.fatigue >= 65) return 'Fatigued';
  if (frame.attention < 45) return 'Drifting';
  if (frame.engagement >= 68) return 'Engaged';
  return 'Neutral';
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl p-3 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {Math.round(entry.value)}%
        </p>
      ))}
    </div>
  );
};

export default function AttentionReplayPage() {
  const { timeline, completedSessions, metrics, status } = useAnalysis();
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [overlay, setOverlay] = useState<'heatmap' | 'focus' | 'emotion'>('heatmap');

  const replayFrames = useMemo(() => {
    if (timeline.length > 1) return buildFromTimeline(timeline);
    const latest = completedSessions[0];
    if (!latest) return buildSyntheticReplay(0);

    const synthetic = buildSyntheticReplay(completedSessions.length, latest.sampleCount);
    return synthetic.map(frame => ({
      ...frame,
      engagement: clamp(frame.engagement * 0.35 + latest.averageEngagement * 0.65),
      attention: clamp(frame.attention * 0.35 + latest.averageAttentionConfidence * 0.65),
      focus: clamp(frame.focus * 0.35 + latest.averageDeepFocus * 0.65),
      fatigue: clamp(frame.fatigue * 0.4 + latest.averageFatigue * 0.6),
      emotion: clamp(frame.emotion * 0.4 + (100 - latest.averageBoredom) * 0.6),
    }));
  }, [completedSessions, timeline]);

  const currentFrame = replayFrames[Math.min(frameIndex, replayFrames.length - 1)] || replayFrames[0];
  const progress = replayFrames.length > 1 ? (frameIndex / (replayFrames.length - 1)) * 100 : 0;

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setFrameIndex(current => {
        if (current >= replayFrames.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [isPlaying, replayFrames.length]);

  useEffect(() => {
    setFrameIndex(current => Math.min(current, replayFrames.length - 1));
  }, [replayFrames.length]);

  const jump = (delta: number) => {
    setFrameIndex(current => clamp(current + delta, 0, replayFrames.length - 1));
  };

  const replaySource = timeline.length > 1 ? 'Live timeline' : completedSessions.length ? 'Latest saved session' : 'Demo replay model';

  const focusHotspots = replayFrames.filter((_, index) => index % 6 === 0).slice(-12);
  const emotionBands = replayFrames.filter((_, index) => index % 8 === 0).slice(0, 9);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5"
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300 mb-3">
            <ScanFace size={13} />
            AI Attention Replay
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold">Replay the attention signal</h1>
          <p className="text-sm text-gray-500 mt-2">Emotion timeline, heatmap overlays, and focus intensity reconstructed from session signals.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Source', value: replaySource },
            { label: 'Frames', value: replayFrames.length.toString() },
            { label: 'Status', value: status },
            { label: 'Signal', value: `${Math.round(metrics.confidence)}%` },
          ].map(item => (
            <div key={item.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 min-w-[120px]">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{item.label}</p>
              <p className="text-sm font-semibold text-gray-200 mt-1 truncate">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Attention" value={`${Math.round(currentFrame.attention)}%`} icon={Eye} color="#00f0ff" delay={0} />
        <StatCard title="Focus Intensity" value={`${Math.round(currentFrame.focus)}%`} icon={Target} color="#39ff14" delay={0.1} />
        <StatCard title="Emotion Signal" value={emotionLabel(currentFrame)} icon={Brain} color="#b44aff" delay={0.2} />
        <StatCard title="Fatigue Load" value={`${Math.round(currentFrame.fatigue)}%`} icon={Flame} color="#ff6b35" delay={0.3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6">
        <GlassCard delay={0.2} className="overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-semibold">Visual Replay Canvas</h3>
              <p className="text-xs text-gray-500 mt-1">Frame {currentFrame.index + 1} at {currentFrame.time}</p>
            </div>
            <div className="glass rounded-xl p-1 flex gap-1">
              {(['heatmap', 'focus', 'emotion'] as const).map(item => (
                <button
                  key={item}
                  onClick={() => setOverlay(item)}
                  className={`px-4 py-2 rounded-lg text-xs capitalize transition-all ${
                    overlay === item ? 'bg-cyan-400/15 text-cyan-300' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#070b12] border border-white/10">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,240,255,0.08),transparent_28%),radial-gradient(circle_at_20%_78%,rgba(180,74,255,0.1),transparent_30%)]" />

            <motion.div
              className="absolute rounded-full blur-3xl"
              animate={{
                left: `${currentFrame.x - 18}%`,
                top: `${currentFrame.y - 18}%`,
                width: overlay === 'focus' ? `${24 + currentFrame.focus * 0.38}%` : `${18 + currentFrame.attention * 0.32}%`,
                height: overlay === 'focus' ? `${24 + currentFrame.focus * 0.38}%` : `${18 + currentFrame.attention * 0.32}%`,
                backgroundColor: overlay === 'emotion' ? colorFor(currentFrame.emotion) : overlay === 'focus' ? '#39ff14' : '#00f0ff',
                opacity: overlay === 'emotion' ? 0.24 : 0.2,
              }}
              transition={{ duration: 0.35 }}
            />

            {focusHotspots.map((spot, index) => (
              <motion.div
                key={`${spot.index}-${index}`}
                className="absolute rounded-full border"
                style={{
                  left: `${spot.x}%`,
                  top: `${spot.y}%`,
                  width: `${12 + spot.focus * 0.14}px`,
                  height: `${12 + spot.focus * 0.14}px`,
                  borderColor: `${colorFor(spot.focus)}99`,
                  background: `${colorFor(spot.focus)}22`,
                  transform: 'translate(-50%, -50%)',
                }}
                animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.9, 0.45] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: index * 0.12 }}
              />
            ))}

            <motion.div
              className="absolute rounded-[28px] border-2 shadow-2xl"
              animate={{
                left: `${clamp(currentFrame.x - 12, 4, 72)}%`,
                top: `${clamp(currentFrame.y - 15, 4, 68)}%`,
                borderColor: `${colorFor(currentFrame.attention)}cc`,
                boxShadow: `0 0 32px ${colorFor(currentFrame.attention)}55`,
              }}
              transition={{ duration: 0.35 }}
              style={{ width: '24%', height: '30%' }}
            >
              <div className="absolute -top-8 left-0 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] text-cyan-100 font-mono">
                FOCUS LOCK {Math.round(currentFrame.focus)}%
              </div>
            </motion.div>

            <div className="absolute left-4 top-4 right-4 flex items-start justify-between gap-3">
              <div className="rounded-xl bg-black/55 backdrop-blur-sm border border-white/10 px-3 py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Emotion</p>
                <p className="text-lg font-display font-bold" style={{ color: colorFor(currentFrame.emotion) }}>{emotionLabel(currentFrame)}</p>
              </div>
              <div className="rounded-xl bg-black/55 backdrop-blur-sm border border-white/10 px-3 py-2 text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Heat</p>
                <p className="text-lg font-display font-bold text-cyan-300">{Math.round(currentFrame.engagement)}%</p>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4">
              <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 p-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'ATT', value: currentFrame.attention, color: '#00f0ff' },
                    { label: 'FOC', value: currentFrame.focus, color: '#39ff14' },
                    { label: 'EMO', value: currentFrame.emotion, color: '#b44aff' },
                    { label: 'FAT', value: currentFrame.fatigue, color: '#ff6b35' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-gray-500 font-mono">{item.label}</span>
                        <span className="text-[10px] font-mono" style={{ color: item.color }}>{Math.round(item.value)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div className="h-full rounded-full" animate={{ width: `${item.value}%` }} style={{ background: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setFrameIndex(0)} className="p-2.5 rounded-xl glass text-gray-300 hover:text-white hover:bg-white/10" title="Restart replay">
                <SkipBack size={18} />
              </button>
              <button onClick={() => jump(-5)} className="p-2.5 rounded-xl glass text-gray-300 hover:text-white hover:bg-white/10" title="Back 5 frames">
                <SkipBack size={18} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium flex items-center gap-2"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button onClick={() => jump(5)} className="p-2.5 rounded-xl glass text-gray-300 hover:text-white hover:bg-white/10" title="Forward 5 frames">
                <SkipForward size={18} />
              </button>
              <div className="flex items-center gap-2 text-xs text-gray-400 ml-auto">
                <Clock3 size={14} />
                {currentFrame.time}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, replayFrames.length - 1)}
              value={frameIndex}
              onChange={event => {
                setIsPlaying(false);
                setFrameIndex(Number(event.target.value));
              }}
              className="w-full accent-cyan-400"
            />
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full rounded-full bg-cyan-400" animate={{ width: `${progress}%` }} />
            </div>
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard delay={0.3}>
            <div className="flex items-center gap-2 mb-5">
              <ThermometerSun size={18} className="text-orange-400" />
              <h3 className="text-lg font-semibold">Emotion Timeline</h3>
            </div>
            <div className="space-y-3">
              {emotionBands.map(frame => (
                <button
                  key={frame.index}
                  onClick={() => {
                    setIsPlaying(false);
                    setFrameIndex(frame.index);
                  }}
                  className={`w-full grid grid-cols-[54px_1fr_72px] gap-3 items-center rounded-xl p-3 text-left transition-all ${
                    frame.index === currentFrame.index ? 'bg-cyan-400/10 border border-cyan-400/20' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="text-xs font-mono text-gray-400">{frame.time}</span>
                  <span>
                    <span className="block h-2 rounded-full bg-white/10 overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${frame.emotion}%`, background: colorFor(frame.emotion) }} />
                    </span>
                  </span>
                  <span className="text-xs font-medium" style={{ color: colorFor(frame.emotion) }}>{emotionLabel(frame)}</span>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard delay={0.4}>
            <div className="flex items-center gap-2 mb-5">
              <Radar size={18} className="text-cyan-400" />
              <h3 className="text-lg font-semibold">Replay Events</h3>
            </div>
            <div className="space-y-3">
              {[
                { icon: Eye, title: 'Attention peak', value: Math.max(...replayFrames.map(frame => frame.attention)), color: '#00f0ff' },
                { icon: Target, title: 'Best focus lock', value: Math.max(...replayFrames.map(frame => frame.focus)), color: '#39ff14' },
                { icon: Activity, title: 'Engagement surge', value: Math.max(...replayFrames.map(frame => frame.engagement)), color: '#b44aff' },
                { icon: Flame, title: 'Fatigue spike', value: Math.max(...replayFrames.map(frame => frame.fatigue)), color: '#ff6b35' },
              ].map(item => (
                <div key={item.title} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${item.color}18`, color: item.color }}>
                    <item.icon size={17} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-gray-500">Detected in replay stream</p>
                  </div>
                  <p className="text-lg font-display font-bold" style={{ color: item.color }}>{Math.round(item.value)}%</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard delay={0.5}>
        <div className="flex items-center gap-2 mb-6">
          <Sparkles size={18} className="text-purple-400" />
          <h3 className="text-lg font-semibold">Focus Intensity Over Time</h3>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={replayFrames}>
            <defs>
              <linearGradient id="replayFocusFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#39ff14" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#39ff14" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="replayEmotionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#b44aff" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#b44aff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="focus" name="Focus" stroke="#39ff14" fill="url(#replayFocusFill)" strokeWidth={2} />
            <Area type="monotone" dataKey="emotion" name="Emotion" stroke="#b44aff" fill="url(#replayEmotionFill)" strokeWidth={1.5} />
            <Line type="monotone" dataKey="attention" name="Attention" stroke="#00f0ff" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fatigue" name="Fatigue" stroke="#ff6b35" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  );
}
