// ============================================================
// EngagementDNAPage - Personalized behavioral profile builder
// ============================================================

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlarmClock,
  BatteryCharging,
  BrainCircuit,
  CalendarDays,
  Clock,
  Dna,
  Flame,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Moon,
  Sparkles,
  Sun,
  Target,
  type LucideIcon,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GaugeChart from '@/components/ui/GaugeChart';
import StatCard from '@/components/ui/StatCard';
import { useAnalysis } from '@/store/analysisStore';
import { useProfile } from '@/store/profileStore';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const average = (values: number[]) => {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
};

const colorFor = (value: number) => {
  if (value >= 80) return '#39ff14';
  if (value >= 60) return '#00f0ff';
  if (value >= 40) return '#ff6b35';
  return '#ff006e';
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

interface DnaTrait {
  label: string;
  value: string;
  score: number;
  icon: LucideIcon;
  color: string;
  detail: string;
}

export default function EngagementDNAPage() {
  const [activeView, setActiveView] = useState<'learning' | 'focus' | 'triggers' | 'cycles'>('learning');
  const { completedSessions, metrics, timeline, status } = useAnalysis();
  const { profile } = useProfile();

  const dna = useMemo(() => {
    const sessions = completedSessions.slice(0, 14);
    const hasHistory = sessions.length > 0;
    const recent = sessions.slice(0, 6);

    const avgEngagement = hasHistory ? average(sessions.map(session => session.averageEngagement)) : metrics.engagement;
    const avgAttention = hasHistory ? average(sessions.map(session => session.averageAttentionConfidence)) : metrics.attentionConfidence;
    const avgFocus = hasHistory ? average(sessions.map(session => session.averageDeepFocus)) : metrics.deepFocus;
    const avgInteraction = hasHistory ? average(sessions.map(session => session.averageInteractionScore)) : metrics.interactionScore;
    const avgFatigue = hasHistory ? average(sessions.map(session => session.averageFatigue)) : metrics.cognitiveFatigueIndex;
    const avgBoredom = hasHistory ? average(sessions.map(session => session.averageBoredom)) : metrics.boredomIndex;

    const consistency = hasHistory
      ? clamp(100 - average(sessions.map(session => Math.abs(session.averageEngagement - avgEngagement))))
      : clamp(metrics.confidence);
    const dnaConfidence = clamp(sessions.length * 8 + Math.min(metrics.sampleCount, 80) * 0.35 + metrics.confidence * 0.25);
    const focusDuration = Math.max(8, Math.round((avgFocus * 0.42 + avgAttention * 0.25 + consistency * 0.2 - avgFatigue * 0.15)));
    const learningAffinity = clamp(avgAttention * 0.36 + avgFocus * 0.34 + avgInteraction * 0.15 + (100 - avgBoredom) * 0.15);
    const recoveryNeed = clamp(avgFatigue * 0.58 + avgBoredom * 0.22 + (100 - consistency) * 0.2);

    const bestHourSeed = hasHistory
      ? average(recent.map(session => new Date(session.startedAt).getHours()))
      : new Date().getHours();
    const bestHour = Math.round(bestHourSeed || 10);
    const cycleData = Array.from({ length: 12 }, (_, index) => {
      const hour = (6 + index * 2) % 24;
      const distance = Math.min(Math.abs(hour - bestHour), 24 - Math.abs(hour - bestHour));
      const prime = clamp(92 - distance * 9 + Math.sin(index * 1.7) * 5);
      const recovery = clamp(100 - prime + avgFatigue * 0.35 + (index % 4 === 3 ? 10 : 0));
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        learning: clamp(prime * 0.48 + learningAffinity * 0.52),
        focus: clamp(prime * 0.54 + avgFocus * 0.46),
        recovery,
        productivity: clamp(prime * 0.38 + avgEngagement * 0.4 + consistency * 0.22),
      };
    });

    const peakLearning = cycleData.reduce((best, item) => item.learning > best.learning ? item : best, cycleData[0]);
    const peakProductivity = cycleData.reduce((best, item) => item.productivity > best.productivity ? item : best, cycleData[0]);

    const triggerData = [
      { name: 'Fatigue', value: recoveryNeed, color: '#ff6b35' },
      { name: 'Boredom', value: avgBoredom, color: '#ff006e' },
      { name: 'Low Voice', value: clamp(100 - avgInteraction), color: '#b44aff' },
      { name: 'Low Focus', value: clamp(100 - avgFocus), color: '#00f0ff' },
    ];

    const profileRows = [
      { axis: 'Attention', value: avgAttention },
      { axis: 'Deep Focus', value: avgFocus },
      { axis: 'Learning', value: learningAffinity },
      { axis: 'Consistency', value: consistency },
      { axis: 'Recovery', value: 100 - recoveryNeed },
      { axis: 'Interaction', value: avgInteraction },
    ];

    return {
      hasHistory,
      dnaConfidence,
      avgEngagement,
      avgAttention,
      avgFocus,
      avgInteraction,
      avgFatigue,
      avgBoredom,
      consistency,
      focusDuration,
      learningAffinity,
      recoveryNeed,
      peakLearning,
      peakProductivity,
      cycleData,
      triggerData,
      profileRows,
    };
  }, [completedSessions, metrics]);

  const traits: DnaTrait[] = [
    {
      label: 'Best Learning Hours',
      value: dna.peakLearning.hour,
      score: dna.peakLearning.learning,
      icon: GraduationCap,
      color: '#00f0ff',
      detail: 'Your strongest window for absorbing new concepts and reviewing difficult material.',
    },
    {
      label: 'Focus Duration',
      value: `${dna.focusDuration} min`,
      score: dna.avgFocus,
      icon: Clock,
      color: '#39ff14',
      detail: 'Estimated clean-focus block before attention naturally starts to taper.',
    },
    {
      label: 'Emotional Trigger Load',
      value: `${Math.round(dna.recoveryNeed)}%`,
      score: 100 - dna.recoveryNeed,
      icon: HeartPulse,
      color: '#ff6b35',
      detail: 'Pressure from fatigue, boredom, and low interaction signals.',
    },
    {
      label: 'Productivity Cycle',
      value: dna.peakProductivity.hour,
      score: dna.peakProductivity.productivity,
      icon: Activity,
      color: '#b44aff',
      detail: 'Projected peak for high-output work based on engagement and consistency.',
    },
  ];

  const activeTrait = traits.find(trait => {
    if (activeView === 'learning') return trait.label === 'Best Learning Hours';
    if (activeView === 'focus') return trait.label === 'Focus Duration';
    if (activeView === 'triggers') return trait.label === 'Emotional Trigger Load';
    return trait.label === 'Productivity Cycle';
  }) || traits[0];

  const recommendations = [
    {
      icon: Sun,
      title: 'Protect the peak window',
      detail: `Schedule difficult learning around ${dna.peakLearning.hour}, when your learning score is projected at ${Math.round(dna.peakLearning.learning)}%.`,
      color: '#00f0ff',
    },
    {
      icon: AlarmClock,
      title: 'Use focus sprints',
      detail: `Work in ${dna.focusDuration}-minute blocks, then add a short reset before fatigue starts shaping behavior.`,
      color: '#39ff14',
    },
    {
      icon: BatteryCharging,
      title: 'Reset emotional triggers',
      detail: dna.recoveryNeed > 55
        ? 'Current trigger load is elevated; add movement, voice interaction, or a context switch before deep work.'
        : 'Trigger load is manageable; keep the current rhythm and watch for boredom spikes.',
      color: '#ff6b35',
    },
  ];

  const liveSpark = timeline.length
    ? timeline.slice(-18).map((point, index) => ({
        index,
        engagement: point.engagement,
        focus: point.deepFocus,
        trigger: clamp(point.cognitiveFatigueIndex * 0.6 + point.boredomIndex * 0.4),
      }))
    : dna.cycleData.map((point, index) => ({
        index,
        engagement: point.productivity,
        focus: point.focus,
        trigger: point.recovery,
      }));
  const activeChartData: any[] = activeView === 'triggers' ? liveSpark : dna.cycleData;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_70%_25%,rgba(0,240,255,0.16),transparent_32%),radial-gradient(circle_at_45%_80%,rgba(57,255,20,0.1),transparent_30%)]" />
        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300 mb-4">
              <Dna size={13} />
              Engagement DNA
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">
              {profile.fullName === 'Your Name' ? 'Personal behavioral profile' : `${profile.fullName}'s behavioral profile`}
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              A personalized map of your learning windows, focus stamina, emotional triggers, and productivity cycles.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">DNA Confidence</p>
              <p className="text-2xl font-display font-bold text-cyan-300 mt-1">{Math.round(dna.dnaConfidence)}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Signal State</p>
              <p className="text-2xl font-display font-bold text-green-300 mt-1 capitalize">{status}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {traits.map((trait, index) => (
          <StatCard
            key={trait.label}
            title={trait.label}
            value={trait.value}
            subtitle={`${Math.round(trait.score)}% match`}
            icon={trait.icon}
            color={trait.color}
            delay={index * 0.1}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <GlassCard delay={0.2}>
          <h3 className="text-lg font-semibold mb-2">DNA Core</h3>
          <p className="text-xs text-gray-500 mb-6">Current behavioral fingerprint strength</p>
          <GaugeChart value={activeTrait.score} size={210} label="Match" color={activeTrait.color} />
          <div className="mt-6 space-y-2">
            {[
              { id: 'learning' as const, label: 'Learning Hours', icon: GraduationCap },
              { id: 'focus' as const, label: 'Focus Duration', icon: Target },
              { id: 'triggers' as const, label: 'Emotional Triggers', icon: Flame },
              { id: 'cycles' as const, label: 'Productivity Cycles', icon: CalendarDays },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all ${
                  activeView === item.id ? 'bg-cyan-400/10 border border-cyan-400/20' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-400/10 text-cyan-300 flex items-center justify-center">
                  <item.icon size={17} />
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard delay={0.3}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <activeTrait.icon size={20} style={{ color: activeTrait.color }} />
                  <h3 className="text-lg font-semibold">{activeTrait.label}</h3>
                </div>
                <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">{activeTrait.detail}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-w-[140px]">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">DNA Value</p>
                <p className="text-2xl font-display font-bold" style={{ color: colorFor(activeTrait.score) }}>{activeTrait.value}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={activeChartData}>
                <defs>
                  <linearGradient id="dnaPrimaryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeTrait.color} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={activeTrait.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey={activeView === 'triggers' ? 'index' : 'hour'} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                {activeView === 'triggers' ? (
                  <>
                    <Area type="monotone" dataKey="trigger" name="Trigger Load" stroke="#ff6b35" fill="url(#dnaPrimaryFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="focus" name="Focus" stroke="#39ff14" fill="transparent" strokeWidth={2} />
                  </>
                ) : (
                  <>
                    <Area type="monotone" dataKey={activeView === 'learning' ? 'learning' : activeView === 'focus' ? 'focus' : 'productivity'} name={activeTrait.label} stroke={activeTrait.color} fill="url(#dnaPrimaryFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="recovery" name="Recovery Need" stroke="#ff6b35" fill="transparent" strokeWidth={1.5} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard delay={0.4}>
              <div className="flex items-center gap-2 mb-6">
                <BrainCircuit size={18} className="text-cyan-400" />
                <h3 className="text-lg font-semibold">Behavior Axes</h3>
              </div>
              <div className="space-y-4">
                {dna.profileRows.map(row => (
                  <div key={row.axis}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-300">{row.axis}</span>
                      <span className="text-xs font-mono" style={{ color: colorFor(row.value) }}>{Math.round(row.value)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${row.value}%` }}
                        transition={{ duration: 0.7 }}
                        style={{ background: colorFor(row.value) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard delay={0.5}>
              <div className="flex items-center gap-2 mb-6">
                <Flame size={18} className="text-orange-400" />
                <h3 className="text-lg font-semibold">Emotional Trigger Map</h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={dna.triggerData} cx="50%" cy="50%" innerRadius={55} outerRadius={86} paddingAngle={3} dataKey="value">
                    {dna.triggerData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {dna.triggerData.map(item => (
                  <div key={item.name} className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                    {item.name}
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <GlassCard delay={0.6}>
          <div className="flex items-center gap-2 mb-6">
            <Moon size={18} className="text-purple-400" />
            <h3 className="text-lg font-semibold">Productivity Cycle Forecast</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dna.cycleData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="productivity" name="Productivity" fill="#00f0ff" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Bar dataKey="learning" name="Learning" fill="#b44aff" radius={[4, 4, 0, 0]} opacity={0.7} />
              <Bar dataKey="recovery" name="Recovery Need" fill="#ff6b35" radius={[4, 4, 0, 0]} opacity={0.55} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard delay={0.7}>
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={18} className="text-cyan-400" />
            <h3 className="text-lg font-semibold">DNA Recommendations</h3>
          </div>
          <div className="space-y-3">
            {recommendations.map(item => (
              <div key={item.title} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${item.color}18`, color: item.color }}>
                    <item.icon size={17} />
                  </div>
                  <p className="text-sm font-semibold">{item.title}</p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {!dna.hasHistory && (
        <GlassCard delay={0.8}>
          <div className="flex items-start gap-3">
            <Lightbulb size={20} className="text-yellow-300 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold mb-1">DNA is in early-learning mode</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Complete and save a few analysis sessions to make best hours, focus duration, triggers, and productivity cycles more personal.
              </p>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
