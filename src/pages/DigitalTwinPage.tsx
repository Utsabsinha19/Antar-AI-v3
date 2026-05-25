// ============================================================
// DigitalTwinPage - Long-term behavioral model and coaching hub
// ============================================================

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Orbit,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  Zap,
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

const scoreColor = (value: number) => {
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
          {entry.name}: {Math.round(entry.value)}
        </p>
      ))}
    </div>
  );
};

interface TwinModule {
  title: string;
  score: number;
  icon: LucideIcon;
  color: string;
  description: string;
  actions: string[];
}

export default function DigitalTwinPage() {
  const [activeMode, setActiveMode] = useState<'coach' | 'performance' | 'learning'>('coach');
  const { metrics, timeline, completedSessions, status } = useAnalysis();
  const { profile } = useProfile();

  const twin = useMemo(() => {
    const sessions = completedSessions.slice(0, 12);
    const hasHistory = sessions.length > 0;

    const historyEngagement = average(sessions.map(session => session.averageEngagement));
    const historyAttention = average(sessions.map(session => session.averageAttentionConfidence));
    const historyFocus = average(sessions.map(session => session.averageDeepFocus));
    const historyInteraction = average(sessions.map(session => session.averageInteractionScore));
    const historyFatigue = average(sessions.map(session => session.averageFatigue));
    const historyBoredom = average(sessions.map(session => session.averageBoredom));

    const engagement = hasHistory ? historyEngagement : metrics.engagement;
    const attention = hasHistory ? historyAttention : metrics.attentionConfidence;
    const focus = hasHistory ? historyFocus : metrics.deepFocus;
    const interaction = hasHistory ? historyInteraction : metrics.interactionScore;
    const fatigue = hasHistory ? historyFatigue : metrics.cognitiveFatigueIndex;
    const boredom = hasHistory ? historyBoredom : metrics.boredomIndex;

    const modelMaturity = clamp((sessions.length / 8) * 70 + Math.min(metrics.sampleCount, 60) * 0.5);
    const cognitiveReadiness = clamp(0.36 * attention + 0.34 * focus + 0.2 * engagement + 0.1 * (100 - fatigue));
    const learningVelocity = clamp(0.45 * metrics.learningRetentionPrediction + 0.25 * focus + 0.2 * engagement + 0.1 * interaction);
    const resilience = clamp(0.35 * metrics.emotionalStability + 0.25 * metrics.postureStability + 0.25 * (100 - fatigue) + 0.15 * (100 - boredom));
    const coachingFit = clamp(0.3 * engagement + 0.25 * attention + 0.2 * focus + 0.15 * interaction + 0.1 * modelMaturity);

    const trendData = hasHistory
      ? sessions.slice().reverse().map((session, index) => ({
          label: `S${index + 1}`,
          engagement: session.averageEngagement,
          readiness: clamp(0.42 * session.averageAttentionConfidence + 0.38 * session.averageDeepFocus + 0.2 * session.averageEngagement),
          fatigue: session.averageFatigue,
          learning: clamp(0.45 * session.averageEngagement + 0.35 * session.averageDeepFocus + 0.2 * session.averageInteractionScore),
        }))
      : (timeline.length ? timeline : [{
          time: '0:00',
          engagement: metrics.engagement,
          attentionConfidence: metrics.attentionConfidence,
          deepFocus: metrics.deepFocus,
          interactionScore: metrics.interactionScore,
          cognitiveFatigueIndex: metrics.cognitiveFatigueIndex,
          boredomIndex: metrics.boredomIndex,
        }]).slice(-16).map(point => ({
          label: point.time,
          engagement: point.engagement,
          readiness: clamp(0.42 * point.attentionConfidence + 0.38 * point.deepFocus + 0.2 * point.engagement),
          fatigue: point.cognitiveFatigueIndex,
          learning: clamp(0.45 * point.engagement + 0.35 * point.deepFocus + 0.2 * point.interactionScore),
        }));

    return {
      hasHistory,
      modelMaturity,
      cognitiveReadiness,
      learningVelocity,
      resilience,
      coachingFit,
      trendData,
      radarData: [
        { subject: 'Attention', value: attention },
        { subject: 'Deep Focus', value: focus },
        { subject: 'Engagement', value: engagement },
        { subject: 'Interaction', value: interaction },
        { subject: 'Recovery', value: 100 - fatigue },
        { subject: 'Curiosity', value: 100 - boredom },
      ],
    };
  }, [completedSessions, metrics, timeline]);

  const modules: TwinModule[] = [
    {
      title: 'Personal AI Coach',
      score: twin.coachingFit,
      icon: UserRoundCheck,
      color: '#00f0ff',
      description: 'Builds a guidance profile from your attention rhythms, interaction style, and engagement recovery patterns.',
      actions: [
        'Start sessions at the time of day where readiness is strongest.',
        'Use short reflective prompts after low-engagement dips.',
        'Track one behavior goal per session so coaching stays specific.',
      ],
    },
    {
      title: 'Mental Performance Optimizer',
      score: twin.cognitiveReadiness,
      icon: HeartPulse,
      color: '#39ff14',
      description: 'Estimates readiness using focus stability, fatigue pressure, posture consistency, and attention confidence.',
      actions: [
        'Schedule demanding work while readiness is above 70.',
        'Add a reset break when fatigue rises faster than engagement.',
        'Keep camera framing stable to improve confidence in the model.',
      ],
    },
    {
      title: 'Learning Optimizer',
      score: twin.learningVelocity,
      icon: GraduationCap,
      color: '#b44aff',
      description: 'Predicts when learning sessions are most likely to stick based on focus, interaction, and retention signals.',
      actions: [
        'Review difficult material during high-focus windows.',
        'Switch to recall practice when interaction drops.',
        'Use session history to find your strongest learning cadence.',
      ],
    },
  ];

  const activeModule = modules.find(module => (
    activeMode === 'coach' ? module.title === 'Personal AI Coach'
      : activeMode === 'performance' ? module.title === 'Mental Performance Optimizer'
        : module.title === 'Learning Optimizer'
  )) || modules[0];

  const readinessLabel = twin.modelMaturity >= 70 ? 'Adaptive model' : twin.modelMaturity >= 35 ? 'Learning model' : 'Early model';

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 overflow-hidden relative"
      >
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_70%_30%,rgba(0,240,255,0.12),transparent_35%),radial-gradient(circle_at_40%_80%,rgba(180,74,255,0.12),transparent_32%)]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300 mb-4">
              <Orbit size={13} />
              Human Digital Twin
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">
              {profile.fullName === 'Your Name' ? 'Your behavioral twin' : `${profile.fullName}'s behavioral twin`}
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              A long-term model that turns live engagement sessions into coaching, performance readiness, and learning optimization signals.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[260px]">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Status</p>
              <p className="text-lg font-semibold text-cyan-300 mt-1">{readinessLabel}</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Live State</p>
              <p className="text-lg font-semibold text-green-300 mt-1">{status}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Twin Maturity" value={`${Math.round(twin.modelMaturity)}%`} subtitle="history + live samples" icon={BrainCircuit} color="#00f0ff" delay={0} />
        <StatCard title="Readiness" value={`${Math.round(twin.cognitiveReadiness)}%`} subtitle="focus and fatigue balance" icon={Zap} color="#39ff14" delay={0.1} />
        <StatCard title="Learning Velocity" value={`${Math.round(twin.learningVelocity)}%`} subtitle="retention potential" icon={GraduationCap} color="#b44aff" delay={0.2} />
        <StatCard title="Resilience" value={`${Math.round(twin.resilience)}%`} subtitle="recovery capacity" icon={HeartPulse} color="#ff6b35" delay={0.3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <GlassCard delay={0.2} className="h-full">
          <h3 className="text-lg font-semibold mb-2">Twin Core</h3>
          <p className="text-xs text-gray-500 mb-6">Composite identity model from repeated behavior signals</p>
          <GaugeChart value={activeModule.score} size={210} label="Fit" color={activeModule.color} />
          <div className="mt-6 space-y-2">
            {modules.map(module => {
              const isActive = module.title === activeModule.title;
              return (
                <button
                  key={module.title}
                  onClick={() => setActiveMode(module.title === 'Personal AI Coach' ? 'coach' : module.title === 'Mental Performance Optimizer' ? 'performance' : 'learning')}
                  className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all ${
                    isActive ? 'bg-cyan-400/10 border border-cyan-400/20' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${module.color}18`, color: module.color }}>
                    <module.icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{module.title}</p>
                    <p className="text-xs text-gray-500">{Math.round(module.score)}% model fit</p>
                  </div>
                </button>
              );
            })}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard delay={0.3}>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <activeModule.icon size={20} style={{ color: activeModule.color }} />
                  <h3 className="text-lg font-semibold">{activeModule.title}</h3>
                </div>
                <p className="text-sm text-gray-400 max-w-3xl leading-relaxed">{activeModule.description}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-w-[140px]">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Current Fit</p>
                <p className="text-2xl font-display font-bold" style={{ color: scoreColor(activeModule.score) }}>
                  {Math.round(activeModule.score)}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {activeModule.actions.map((action, index) => (
                <div key={action} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={16} className="text-green-400" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Step {index + 1}</span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{action}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard delay={0.4}>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={18} className="text-cyan-400" />
                <h3 className="text-lg font-semibold">Behavior Trajectory</h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={twin.trendData}>
                  <defs>
                    <linearGradient id="twinReadiness" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="readiness" name="Readiness" stroke="#00f0ff" fill="url(#twinReadiness)" strokeWidth={2} />
                  <Line type="monotone" dataKey="learning" name="Learning" stroke="#b44aff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fatigue" name="Fatigue" stroke="#ff6b35" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard delay={0.5}>
              <div className="flex items-center gap-2 mb-6">
                <Target size={18} className="text-purple-400" />
                <h3 className="text-lg font-semibold">Behavior Signature</h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={twin.radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#888' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Twin" dataKey="value" stroke="#00f0ff" fill="#00f0ff" fillOpacity={0.22} strokeWidth={2} />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>
        </div>
      </div>

      <GlassCard delay={0.6}>
        <div className="flex items-center gap-3 mb-5">
          <Sparkles size={20} className="text-cyan-400" />
          <h3 className="text-lg font-semibold">Future Model Roadmap</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: CalendarClock,
              title: 'Longitudinal Memory',
              detail: 'Learns your best times for focus, recovery, creative work, and review as more sessions are stored.',
            },
            {
              icon: Lightbulb,
              title: 'Adaptive Coaching',
              detail: 'Turns recurring patterns into precise recommendations instead of generic productivity advice.',
            },
            {
              icon: BrainCircuit,
              title: 'Personal Simulation',
              detail: 'Projects how different routines could affect readiness, learning retention, and session quality.',
            },
          ].map(item => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <item.icon size={20} className="text-cyan-300 mb-4" />
              <h4 className="font-semibold mb-2">{item.title}</h4>
              <p className="text-sm text-gray-400 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
