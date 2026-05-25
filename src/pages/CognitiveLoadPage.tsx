// ============================================================
// CognitiveLoadPage - Mental fatigue, overload, and confusion detection
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
  AlertTriangle,
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  Flame,
  Gauge,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Loader,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import GaugeChart from '@/components/ui/GaugeChart';
import StatCard from '@/components/ui/StatCard';
import { TimeSeriesPoint, useAnalysis } from '@/store/analysisStore';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const average = (values: number[]) => {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
};

const severityColor = (value: number) => {
  if (value >= 75) return '#ff006e';
  if (value >= 55) return '#ff6b35';
  if (value >= 35) return '#facc15';
  return '#39ff14';
};

const stateLabel = (value: number) => {
  if (value >= 75) return 'High risk';
  if (value >= 55) return 'Elevated';
  if (value >= 35) return 'Watch';
  return 'Stable';
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

interface LoadSignal {
  id: 'fatigue' | 'overload' | 'confusion';
  title: string;
  score: number;
  icon: LucideIcon;
  color: string;
  description: string;
  evidence: string[];
}

function buildLoadPoint(point: TimeSeriesPoint, index: number) {
  const fatigue = clamp(point.cognitiveFatigueIndex);
  const overload = clamp(0.42 * point.cognitiveFatigueIndex + 0.28 * (100 - point.deepFocus) + 0.18 * point.engagement + 0.12 * (100 - point.attentionConfidence));
  const confusion = clamp(0.36 * (100 - point.attentionConfidence) + 0.26 * point.boredomIndex + 0.22 * (100 - point.interactionScore) + 0.16 * point.cognitiveFatigueIndex);
  const load = clamp(0.36 * fatigue + 0.34 * overload + 0.3 * confusion);
  return {
    label: point.time || `${index}`,
    fatigue,
    overload,
    confusion,
    load,
    focus: point.deepFocus,
    attention: point.attentionConfidence,
  };
}

export default function CognitiveLoadPage() {
  const [mode, setMode] = useState<'detector' | 'edtech' | 'workplace'>('detector');
  const { metrics, timeline, completedSessions, status } = useAnalysis();

  const model = useMemo(() => {
    const liveSeries = timeline.length
      ? timeline.map(buildLoadPoint)
      : Array.from({ length: 18 }, (_, index) => {
          const wave = Math.sin(index / 2.3);
          const fatigue = clamp(metrics.cognitiveFatigueIndex + index * 1.4 + Math.max(0, -wave) * 12);
          const focus = clamp(metrics.deepFocus || 62 + wave * 16);
          const attention = clamp(metrics.attentionConfidence || 58 + Math.cos(index / 2.8) * 14);
          const interaction = clamp(metrics.interactionScore || 32 + Math.sin(index / 3) * 18);
          return buildLoadPoint({
            time: `${Math.floor(index / 3)}:${((index % 3) * 20).toString().padStart(2, '0')}`,
            engagement: clamp(metrics.engagement || 56 + wave * 16),
            attentionConfidence: attention,
            deepFocus: focus,
            interactionScore: interaction,
            cognitiveFatigueIndex: fatigue,
            boredomIndex: clamp(metrics.boredomIndex || 34 + Math.max(0, -wave) * 18),
          }, index);
        });

    const sessions = completedSessions.slice(0, 10);
    const sessionBaseline = sessions.length ? {
      fatigue: average(sessions.map(session => session.averageFatigue)),
      overload: average(sessions.map(session => (
        0.42 * session.averageFatigue +
        0.28 * (100 - session.averageDeepFocus) +
        0.18 * session.averageEngagement +
        0.12 * (100 - session.averageAttentionConfidence)
      ))),
      confusion: average(sessions.map(session => (
        0.36 * (100 - session.averageAttentionConfidence) +
        0.26 * session.averageBoredom +
        0.22 * (100 - session.averageInteractionScore) +
        0.16 * session.averageFatigue
      ))),
    } : null;

    const latest = liveSeries[liveSeries.length - 1];
    const fatigueRisk = clamp(sessionBaseline ? latest.fatigue * 0.72 + sessionBaseline.fatigue * 0.28 : latest.fatigue);
    const overloadRisk = clamp(sessionBaseline ? latest.overload * 0.72 + sessionBaseline.overload * 0.28 : latest.overload);
    const confusionRisk = clamp(sessionBaseline ? latest.confusion * 0.72 + sessionBaseline.confusion * 0.28 : latest.confusion);
    const loadIndex = clamp(0.36 * fatigueRisk + 0.34 * overloadRisk + 0.3 * confusionRisk);
    const capacity = clamp(100 - loadIndex + metrics.confidence * 0.12);

    return {
      liveSeries,
      fatigueRisk,
      overloadRisk,
      confusionRisk,
      loadIndex,
      capacity,
      confidence: clamp(metrics.confidence * 0.5 + Math.min(metrics.sampleCount, 80) * 0.35 + sessions.length * 5),
      sessionBaseline,
    };
  }, [completedSessions, metrics, timeline]);

  const signals: LoadSignal[] = [
    {
      id: 'fatigue',
      title: 'Mental Fatigue',
      score: model.fatigueRisk,
      icon: Flame,
      color: '#ff6b35',
      description: 'Rising tiredness inferred from cognitive fatigue, focus decay, and reduced recovery capacity.',
      evidence: [
        `${Math.round(metrics.cognitiveFatigueIndex)}% live fatigue index`,
        `${Math.round(metrics.deepFocus)}% deep focus stability`,
        `${Math.round(model.capacity)}% remaining cognitive capacity`,
      ],
    },
    {
      id: 'overload',
      title: 'Overload',
      score: model.overloadRisk,
      icon: ShieldAlert,
      color: '#ff006e',
      description: 'Task demand may be exceeding available attention and working-memory bandwidth.',
      evidence: [
        `${Math.round(model.loadIndex)}% total cognitive load`,
        `${Math.round(metrics.attentionConfidence)}% attention confidence`,
        `${Math.round(metrics.engagement)}% engagement pressure`,
      ],
    },
    {
      id: 'confusion',
      title: 'Confusion',
      score: model.confusionRisk,
      icon: HelpCircle,
      color: '#b44aff',
      description: 'Potential comprehension friction from low attention, low interaction, and boredom signals.',
      evidence: [
        `${Math.round(metrics.boredomIndex)}% boredom index`,
        `${Math.round(metrics.interactionScore)}% interaction score`,
        `${Math.round(100 - metrics.attentionConfidence)}% attention gap`,
      ],
    },
  ];

  const primaryRisk = signals.reduce((highest, signal) => signal.score > highest.score ? signal : highest, signals[0]);
  const distribution = signals.map(signal => ({ name: signal.title, value: signal.score, color: signal.color }));

  const interventions = {
    detector: [
      'Reduce new information density for 3-5 minutes.',
      'Switch from explanation to active recall if confusion is rising.',
      'Trigger a reset break when load remains elevated across multiple samples.',
    ],
    edtech: [
      'Pause lesson progression and offer a simpler worked example.',
      'Surface a quick comprehension check before continuing.',
      'Adapt difficulty downward when overload and confusion rise together.',
    ],
    workplace: [
      'Move from deep work to triage if fatigue is high.',
      'Split complex tasks into a short next-action queue.',
      'Protect meeting time by detecting overload before decision-heavy blocks.',
    ],
  };

  const useCases = [
    {
      id: 'edtech' as const,
      icon: GraduationCap,
      title: 'EdTech',
      metric: `${Math.round(model.confusionRisk)}%`,
      detail: 'Detect learners who are stuck before they disengage.',
      color: '#00f0ff',
    },
    {
      id: 'workplace' as const,
      icon: BriefcaseBusiness,
      title: 'Workplace',
      metric: `${Math.round(model.overloadRisk)}%`,
      detail: 'Spot overload during meetings, analysis, and long focus sessions.',
      color: '#39ff14',
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_70%_25%,rgba(255,0,110,0.16),transparent_30%),radial-gradient(circle_at_45%_80%,rgba(0,240,255,0.12),transparent_32%)]" />
        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-[10px] uppercase tracking-widest text-red-200 mb-4">
              <Brain size={13} />
              Cognitive Load Detection
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">Detect fatigue, overload, and confusion</h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              A real-time cognitive load layer for adaptive learning, healthier focus sessions, and workplace productivity systems.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Primary Risk</p>
              <p className="text-xl font-display font-bold mt-1" style={{ color: primaryRisk.color }}>{primaryRisk.title}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Signal State</p>
              <p className="text-xl font-display font-bold text-green-300 mt-1 capitalize">{status}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Load Index" value={`${Math.round(model.loadIndex)}%`} subtitle={stateLabel(model.loadIndex)} icon={Gauge} color={severityColor(model.loadIndex)} delay={0} />
        <StatCard title="Fatigue" value={`${Math.round(model.fatigueRisk)}%`} subtitle={stateLabel(model.fatigueRisk)} icon={Flame} color="#ff6b35" delay={0.1} />
        <StatCard title="Overload" value={`${Math.round(model.overloadRisk)}%`} subtitle={stateLabel(model.overloadRisk)} icon={ShieldAlert} color="#ff006e" delay={0.2} />
        <StatCard title="Confusion" value={`${Math.round(model.confusionRisk)}%`} subtitle={stateLabel(model.confusionRisk)} icon={HelpCircle} color="#b44aff" delay={0.3} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <GlassCard delay={0.2}>
          <h3 className="text-lg font-semibold mb-2">Cognitive Capacity</h3>
          <p className="text-xs text-gray-500 mb-6">Remaining mental bandwidth after load signals</p>
          <GaugeChart value={model.capacity} size={210} label="Capacity" color="#00f0ff" />
          <div className="mt-6 rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} style={{ color: primaryRisk.color }} />
              <p className="text-sm font-semibold">{primaryRisk.title}</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{primaryRisk.description}</p>
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard delay={0.3}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold">Live Load Timeline</h3>
                <p className="text-xs text-gray-500 mt-1">Tracks load pressure against focus and attention signals</p>
              </div>
              <div className="glass rounded-xl p-1 flex gap-1">
                {(['detector', 'edtech', 'workplace'] as const).map(item => (
                  <button
                    key={item}
                    onClick={() => setMode(item)}
                    className={`px-4 py-2 rounded-lg text-xs capitalize transition-all ${
                      mode === item ? 'bg-cyan-400/15 text-cyan-300' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={model.liveSeries}>
                <defs>
                  <linearGradient id="loadFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff006e" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#ff006e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="focusLoadFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="load" name="Load" stroke="#ff006e" fill="url(#loadFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="focus" name="Focus" stroke="#00f0ff" fill="url(#focusLoadFill)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="attention" name="Attention" stroke="#39ff14" fill="transparent" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {signals.map(signal => (
              <GlassCard key={signal.id} delay={0.4} className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${signal.color}18`, color: signal.color }}>
                    <signal.icon size={21} />
                  </div>
                  <span className="text-2xl font-display font-bold" style={{ color: severityColor(signal.score) }}>{Math.round(signal.score)}%</span>
                </div>
                <h3 className="font-semibold mb-2">{signal.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">{signal.description}</p>
                <div className="space-y-2">
                  {signal.evidence.map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-gray-300">
                      <CheckCircle2 size={12} className="text-cyan-300 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <GlassCard delay={0.5}>
          <div className="flex items-center gap-2 mb-6">
            <Loader size={18} className="text-purple-400" />
            <h3 className="text-lg font-semibold">Risk Distribution</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={distribution} cx="50%" cy="50%" innerRadius={62} outerRadius={96} paddingAngle={4} dataKey="value">
                  {distribution.map(item => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Risk" radius={[4, 4, 0, 0]}>
                  {distribution.map(item => <Cell key={item.name} fill={item.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard delay={0.6}>
          <div className="flex items-center gap-2 mb-5">
            <Lightbulb size={18} className="text-yellow-300" />
            <h3 className="text-lg font-semibold">Adaptive Interventions</h3>
          </div>
          <div className="space-y-3">
            {interventions[mode].map((item, index) => (
              <div key={item} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-400/10 text-cyan-300 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <p className="text-sm font-semibold">{mode === 'edtech' ? 'Learning response' : mode === 'workplace' ? 'Work response' : 'Detector response'}</p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {useCases.map(item => (
          <GlassCard key={item.id} delay={0.7}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${item.color}18`, color: item.color }}>
                <item.icon size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <span className="text-xl font-display font-bold" style={{ color: item.color }}>{item.metric}</span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard delay={0.8}>
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="text-cyan-300 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold mb-1">Product potential</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              In EdTech, this can adapt lesson difficulty before learners disengage. In workplace productivity, it can identify cognitive overload before errors, burnout, or low-quality decisions appear.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
