// ============================================================
// Antar AI - Main Application Entry Point
// Routes, layout, state management, and page rendering
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppContext, Page } from '@/store/appStore';
import { AnalysisProvider } from '@/store/analysisStore';
import { ProfileProvider } from '@/store/profileStore';

// Layout Components
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import AIChatbot from '@/components/chat/AIChatbot';

// Pages
import HomePage from '@/pages/HomePage';
import DashboardPage from '@/pages/DashboardPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import DigitalTwinPage from '@/pages/DigitalTwinPage';
import AttentionReplayPage from '@/pages/AttentionReplayPage';
import EngagementDNAPage from '@/pages/EngagementDNAPage';
import CognitiveLoadPage from '@/pages/CognitiveLoadPage';
import ReportsPage from '@/pages/ReportsPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import AdminPage from '@/pages/AdminPage';
import AuthPage from '@/pages/AuthPage';
import TermsPage from '@/pages/TermsPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';

const dashboardPages: Page[] = ['dashboard', 'analytics', 'digital-twin', 'attention-replay', 'engagement-dna', 'cognitive-load', 'reports', 'profile', 'settings', 'admin'];

export default function App() {
  // Global state
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('antar_theme');
    return saved ? saved === 'dark' : false;
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('antar_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('antar_theme', 'light');
    }
  }, [darkMode]);

  // Pages that use the dashboard layout (sidebar + topbar)
  const isDashboardLayout = dashboardPages.includes(currentPage);

  // Pages that are full-screen (no layout chrome)
  const isFullScreen = currentPage === 'home' || currentPage === 'login' || currentPage === 'register' || currentPage === 'terms' || currentPage === 'privacy';

  useEffect(() => {
    if (dashboardPages.includes(currentPage) && !isAuthenticated) {
      setCurrentPage('login');
    }
  }, [currentPage, isAuthenticated]);

  const renderPage = useCallback(() => {
    switch (currentPage) {
      case 'home': return <HomePage />;
      case 'dashboard': return <DashboardPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'digital-twin': return <DigitalTwinPage />;
      case 'attention-replay': return <AttentionReplayPage />;
      case 'engagement-dna': return <EngagementDNAPage />;
      case 'cognitive-load': return <CognitiveLoadPage />;
      case 'reports': return <ReportsPage />;
      case 'profile': return <ProfilePage />;
      case 'settings': return <SettingsPage />;
      case 'admin': return <AdminPage />;
      case 'login':
      case 'register': return <AuthPage />;
      case 'terms': return <TermsPage />;
      case 'privacy': return <PrivacyPolicyPage />;
      default: return <HomePage />;
    }
  }, [currentPage]);

  return (
    <AppContext.Provider
      value={{
        currentPage, setCurrentPage,
        isAuthenticated, setIsAuthenticated,
        sidebarOpen, setSidebarOpen,
        darkMode, setDarkMode,
        chatOpen, setChatOpen,
        notificationsOpen, setNotificationsOpen,
        webcamActive, setWebcamActive,
      }}
    >
      <AnalysisProvider>
        <ProfileProvider>
          <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-[#0A0A0F] text-gray-100' : 'bg-[#F1F5F9] text-slate-900'}`}>
          {/* Dashboard Layout: Sidebar + TopBar + Content */}
          {isDashboardLayout && isAuthenticated ? (
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                <TopBar />
                <main className="flex-1 p-4 sm:p-6 lg:p-7 overflow-auto max-w-[1600px] w-full mx-auto">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPage}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      {renderPage()}
                    </motion.div>
                  </AnimatePresence>
                </main>
              </div>
              <AIChatbot />
            </div>
          ) : isFullScreen ? (
            // Full-screen pages (landing, auth)
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          ) : null}
          </div>
        </ProfileProvider>
      </AnalysisProvider>
    </AppContext.Provider>
  );
}
