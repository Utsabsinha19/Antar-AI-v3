// ============================================================
// AIChatbot — AI-powered assistant chatbot panel
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/store/appStore';
import { useAnalysis } from '@/store/analysisStore';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';
import { sendAIGatewayMessage } from '@/services/neonService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIChatbot() {
  const { chatOpen, setChatOpen } = useApp();
  const { status, metrics, insights, recommendations, completedSessions } = useAnalysis();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm the Antar AI Assistant. I can help you analyze engagement data, provide insights, and answer questions about your sessions. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildResponse = (question: string) => {
    const normalized = question.toLowerCase();
    if (!metrics.sampleCount) {
      return "I do not have live samples yet. Start Analysis in the dashboard and allow camera or microphone access, then I can summarize real attention, focus, voice activity, confidence, and recommendations.";
    }

    if (normalized.includes('recommend') || normalized.includes('improve') || normalized.includes('fix')) {
      return recommendations.map(item => `${item.title}: ${item.description}`).join(' ');
    }

    if (normalized.includes('history') || normalized.includes('session')) {
      if (!completedSessions.length) {
        return `The current session is ${status}. Engagement is ${Math.round(metrics.engagement)}%, attention confidence is ${Math.round(metrics.attentionConfidence)}%, deep focus is ${Math.round(metrics.deepFocus)}%, and voice activity is ${Math.round(metrics.voice)}%. No completed sessions are stored yet.`;
      }
      const latest = completedSessions[0];
      return `Latest saved session averaged ${Math.round(latest.averageEngagement)}% engagement over ${Math.round(latest.durationSeconds / 60)} minutes with ${latest.sampleCount} real samples. Current live engagement is ${Math.round(metrics.engagement)}%.`;
    }

    if (normalized.includes('formula') || normalized.includes('calculate') || normalized.includes('score')) {
      return `The score is calculated from measurable signals including attention confidence, facial engagement, interaction score, and cognitive fatigue. Current values are ${Math.round(metrics.attentionConfidence)}% attention confidence, ${Math.round(metrics.deepFocus)}% deep focus, ${Math.round(metrics.voice)}% voice, producing ${Math.round(metrics.engagement)}% engagement with ${Math.round(metrics.confidence)}% confidence.`;
    }

    const topInsight = insights[0];
    return topInsight
      ? `${topInsight.title}: ${topInsight.description} Current engagement is ${Math.round(metrics.engagement)}%, attention confidence ${Math.round(metrics.attentionConfidence)}%, deep focus ${Math.round(metrics.deepFocus)}%, and voice activity ${Math.round(metrics.voice)}%.`
      : `Current engagement is ${Math.round(metrics.engagement)}%, attention confidence ${Math.round(metrics.attentionConfidence)}%, deep focus ${Math.round(metrics.deepFocus)}%, and voice activity ${Math.round(metrics.voice)}%.`;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const queryText = input.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const liveContext = `Current cognitive metrics: engagement ${Math.round(metrics.engagement)}%, attention confidence ${Math.round(metrics.attentionConfidence)}%, deep focus ${Math.round(metrics.deepFocus)}%, voice ${Math.round(metrics.voice)}%, liveness ${Math.round(metrics.livenessScore)}%.`;
      const aiReply = await sendAIGatewayMessage([
        { role: 'system', content: `You are the Antar AI cognitive assistant powered by the Neon AI Gateway. Keep responses concise, helpful, and grounded in user engagement metrics. ${liveContext}` },
        { role: 'user', content: queryText }
      ]);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiReply,
        timestamp: new Date()
      }]);
    } catch {
      // Graceful local heuristic fallback
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: buildResponse(queryText),
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          key="chatbot-panel"
          initial={{ opacity: 0, x: 300, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed right-4 bottom-4 top-20 w-[380px] max-w-[calc(100vw-2rem)] glass-strong rounded-2xl flex flex-col z-50 shadow-2xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200/80 dark:border-white/5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 border border-cyan-400/30 shrink-0">
              <Bot size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold tracking-tight text-slate-950 dark:text-white flex items-center gap-1">
                <span className="text-slate-950 dark:text-white">Antar</span>
                <span className="text-cyan-700 dark:text-cyan-400">AI</span>
              </h3>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-slate-500 dark:text-gray-400">Online • Cognitive Copilot</span>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant'
                    ? 'bg-cyan-400/20 text-cyan-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {msg.role === 'assistant' ? <Sparkles size={14} /> : <User size={14} />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'assistant'
                    ? 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-gray-200 border border-slate-200/80 dark:border-transparent'
                    : 'bg-cyan-500/15 dark:bg-cyan-400/15 text-cyan-900 dark:text-cyan-50 border border-cyan-500/20'
                }`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-400/20 text-cyan-400 flex items-center justify-center">
                  <Sparkles size={14} />
                </div>
                <div className="bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-transparent rounded-2xl px-4 py-3 flex gap-1">
                  <div className="w-2 h-2 bg-cyan-500 dark:bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-cyan-500 dark:bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-cyan-500 dark:bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200/80 dark:border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask about your analytics..."
                className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all shadow-xs"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-30 shadow-xs"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
