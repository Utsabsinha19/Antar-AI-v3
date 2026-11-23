// ============================================================
// TopBar — Top navigation bar with search, notifications
// ============================================================

import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/store/appStore';
import { useAnalysis } from '@/store/analysisStore';
import { useProfile } from '@/store/profileStore';
import {
  Menu, Search, Bell, MessageSquare, Sun, Moon, ShieldCheck
} from 'lucide-react';

export default function TopBar() {
  const {
    setSidebarOpen, darkMode, setDarkMode,
    chatOpen, setChatOpen,
    notificationsOpen, setNotificationsOpen,
    currentPage, setCurrentPage
  } = useApp();
  const { status, metrics, insights, completedSessions } = useAnalysis();
  const { initials, profile } = useProfile();

  const notifications = [
    ...(status === 'running'
      ? [{
          id: 'live-session',
          type: 'success',
          title: 'Live analysis running',
          message: `Current engagement is ${Math.round(metrics.engagement)}% with ${Math.round(metrics.confidence)}% signal confidence.`,
          timestamp: 'now',
          read: false,
        }]
      : [{
          id: 'idle-session',
          type: 'info',
          title: 'Analysis idle',
          message: 'Start a camera session to collect real engagement samples.',
          timestamp: 'now',
          read: false,
        }]),
    ...insights.slice(0, 3).map(insight => ({
      id: insight.id,
      type: insight.type === 'critical' ? 'error' : insight.type,
      title: insight.title,
      message: insight.description,
      timestamp: 'live',
      read: false,
    })),
    ...completedSessions.slice(0, 2).map(session => ({
      id: session.id,
      type: 'success',
      title: 'Session saved',
      message: `${Math.round(session.averageEngagement)}% average engagement captured locally.`,
      timestamp: new Date(session.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true,
    })),
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const pageTitle: Record<string, string> = {
    home: 'Home',
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    'digital-twin': 'Human Digital Twin',
    'attention-replay': 'AI Attention Replay',
    'engagement-dna': 'Engagement DNA',
    'cognitive-load': 'Cognitive Load Detection',
    reports: 'Reports',
    profile: 'Profile',
    settings: 'Settings',
    admin: 'Admin Panel',
    login: 'Login',
    register: 'Register',
  };

  return (
    <header className="h-16 glass-strong flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 border-b border-slate-200/80 dark:border-white/5">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <Menu size={20} />
        </button>
        <div>
          <h2 className="text-lg font-extrabold text-slate-950 dark:text-white tracking-tight">{pageTitle[currentPage] || 'Antar AI'}</h2>
          <p className="text-[10px] text-slate-500 dark:text-gray-400 hidden sm:block font-mono">AI-Powered Human Engagement Intelligence</p>
        </div>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search sessions, analytics, users..."
            className="w-full bg-slate-100/80 dark:bg-white/5 border border-slate-200/90 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400/50 focus:bg-white dark:focus:bg-white/[0.07] transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Edge Enclave Security Pill (Antar AI v2 Production Grade) */}
        <div
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all shadow-xs ${
            metrics.authVerified 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
              : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-800 dark:text-cyan-300'
          }`}
          title="Hardware Enclave: Edge Encrypted (WebCrypto AES-GCM-256) • Zero Cloud Egress"
        >
          <ShieldCheck size={14} className={metrics.authVerified ? "text-emerald-600 dark:text-emerald-400" : "text-cyan-600 dark:text-cyan-400"} />
          <span className="font-semibold text-[11px] tracking-wide">
            {metrics.authVerified 
              ? `Verified: ${profile.fullName || 'Operator'} (${(metrics.matchConfidence * 100).toFixed(0)}%)` 
              : 'Enclave Secured'}
          </span>
          {metrics.bystanderCount > 0 && (
            <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/20 px-1 py-0.5 rounded font-mono hidden md:inline">
              Shield: {metrics.bystanderCount} Masked
            </span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-gray-400 hidden xl:inline">
            • 🔒 AES-GCM-256
          </span>
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-xl text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-xl text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all relative"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute right-0 top-12 w-80 glass-strong rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-white/10"
              >
                <div className="p-4 border-b border-white/5">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors ${!n.read ? 'bg-cyan-400/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          n.type === 'success' ? 'bg-green-400' :
                          n.type === 'warning' ? 'bg-yellow-400' :
                          n.type === 'error' ? 'bg-red-400' : 'bg-cyan-400'
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{n.timestamp}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Chat toggle */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`p-2 rounded-xl transition-all ${
            chatOpen
              ? 'bg-cyan-400/20 text-cyan-400'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare size={18} />
        </button>

        {/* User avatar */}
        <button
          onClick={() => setCurrentPage('profile')}
          title={profile.fullName}
          className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold ml-2 overflow-hidden"
        >
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
          ) : initials}
        </button>
      </div>
    </header>
  );
}
