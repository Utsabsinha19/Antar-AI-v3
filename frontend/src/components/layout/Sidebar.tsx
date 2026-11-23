// ============================================================
// Sidebar — Main navigation sidebar with glassmorphism
// ============================================================

import { motion, AnimatePresence } from 'framer-motion';
import { useApp, Page } from '@/store/appStore';
import { useProfile } from '@/store/profileStore';
import {
  Home, LayoutDashboard, BarChart3, FileText, User, Settings,
  Shield, LogOut, ChevronLeft, Brain, Zap, Orbit, ScanFace, Dna, Gauge
} from 'lucide-react';

const navItems: { page: Page; label: string; icon: typeof Home }[] = [
  { page: 'home', label: 'Home', icon: Home },
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'analytics', label: 'Analytics', icon: BarChart3 },
  { page: 'digital-twin', label: 'Digital Twin', icon: Orbit },
  { page: 'attention-replay', label: 'Attention Replay', icon: ScanFace },
  { page: 'engagement-dna', label: 'Engagement DNA', icon: Dna },
  { page: 'cognitive-load', label: 'Cognitive Load', icon: Gauge },
  { page: 'reports', label: 'Reports', icon: FileText },
  { page: 'profile', label: 'Profile', icon: User },
  { page: 'settings', label: 'Settings', icon: Settings },
  { page: 'admin', label: 'Admin Panel', icon: Shield },
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, setIsAuthenticated, darkMode } = useApp();
  const { profile, initials } = useProfile();

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`
          fixed top-0 left-0 h-full z-50
          w-64 glass-strong flex flex-col
          transition-transform duration-300
          lg:translate-x-0
          border-r border-slate-200/80 dark:border-white/5
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-200/80 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/25 border border-cyan-400/30 shrink-0">
            <Brain size={22} className="text-white drop-shadow-sm" />
          </div>
          <div>
            <h1 className="font-display text-sm font-extrabold tracking-tight text-slate-950 dark:text-white flex items-center gap-1">
              <span className="text-slate-950 dark:text-white">Antar</span>
              <span className="text-cyan-700 dark:text-cyan-400">AI</span>
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-widest font-mono font-medium">Cognitive Workspace</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-widest px-3 mb-3 font-mono font-medium">Navigation</p>
          {navItems.map(({ page, label, icon: Icon }) => {
            const isActive = currentPage === page;
            return (
              <button
                key={page}
                onClick={() => { setCurrentPage(page); setSidebarOpen(false); }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1
                  text-sm transition-all duration-200 relative
                  ${isActive
                    ? darkMode
                      ? 'text-cyan-400 bg-cyan-400/10 font-medium'
                      : 'text-cyan-700 bg-cyan-500/10 font-semibold border border-cyan-500/20 shadow-xs'
                    : darkMode
                      ? 'text-gray-400 hover:text-white hover:bg-white/5 font-normal'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-normal'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-cyan-500 dark:bg-cyan-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon size={18} className={isActive ? 'text-cyan-600 dark:text-cyan-400' : ''} />
                <span>{label}</span>
                {page === 'dashboard' && (
                  <Zap size={12} className="ml-auto text-amber-500 dark:text-yellow-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-200/80 dark:border-white/5">
          <button
            onClick={() => { setCurrentPage('profile'); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 mb-2 rounded-xl p-2 -mx-2 hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-linear-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden shadow-xs">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
              ) : initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-800 dark:text-white">{profile.fullName}</p>
              <p className="text-[10px] text-slate-500 dark:text-gray-500 truncate">{profile.plan}</p>
            </div>
          </button>
          <button
            onClick={() => { setIsAuthenticated(false); setCurrentPage('home'); }}
            className="w-full flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500 hover:text-red-500 transition-colors py-2 px-1"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
