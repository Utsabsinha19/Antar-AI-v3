// ============================================================
// ReportsPage - Antar AI Comprehensive Intelligence Reporting System
// Full-spectrum, evidence-backed multi-section analytical intelligence reports
// ============================================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Printer, 
  ArrowLeft, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Brain, 
  Activity, 
  Zap, 
  BarChart3, 
  Layers, 
  Cpu, 
  FileCheck, 
  Trash2,
  RefreshCw,
  GitCompare
} from 'lucide-react';
import { 
  fetchReports, 
  fetchReportDetail, 
  generateSessionReport, 
  compareReports, 
  deleteReport,
  ReportListItem, 
  ReportDetail, 
  ReportComparison 
} from '@/services/reportService';
import { useAnalysis } from '@/store/analysisStore';
import GlassCard from '@/components/ui/GlassCard';

type ViewMode = 'list' | 'detail' | 'compare';

export default function ReportsPage() {
  const { completedSessions } = useAnalysis();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [reportsList, setReportsList] = useState<ReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [comparisonData, setComparisonData] = useState<ReportComparison | null>(null);
  const [comparePrevId, setComparePrevId] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'high-engagement' | 'needs-focus'>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Load existing reports on mount
  useEffect(() => {
    void loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const items = await fetchReports();
      setReportsList(items);
    } catch (err) {
      console.error('[Reports] Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReport = async (reportId: string) => {
    setLoading(true);
    try {
      const detail = await fetchReportDetail(reportId);
      setSelectedReport(detail);
      setViewMode('detail');
    } catch (err) {
      console.error('[Reports] Error opening report:', err);
      setActionNotice('Failed to open the selected intelligence report.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReportFromSession = async (sessionId: string, force = false) => {
    setGenerating(true);
    setActionNotice('Synthesizing session telemetry and calculating statistical distributions...');
    try {
      const newReport = await generateSessionReport(sessionId, undefined, force);
      setSelectedReport(newReport);
      setViewMode('detail');
      await loadReports();
      setActionNotice('Intelligence Report generated and persisted successfully.');
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      console.error('[Reports] Generation error:', err);
      setActionNotice(err.message || 'Error generating report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this intelligence report?')) return;
    try {
      await deleteReport(reportId);
      if (selectedReport?.id === reportId || selectedReport?.report_id === reportId) {
        setSelectedReport(null);
        setViewMode('list');
      }
      await loadReports();
      setActionNotice('Report deleted.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      console.error('[Reports] Delete error:', err);
    }
  };

  const handleRunComparison = async (prevId: string) => {
    if (!selectedReport || !prevId) return;
    setLoading(true);
    try {
      const comparison = await compareReports(selectedReport.report_id, prevId);
      setComparisonData(comparison);
      setViewMode('compare');
    } catch (err) {
      console.error('[Reports] Comparison error:', err);
      setActionNotice('Could not compare selected reports.');
    } finally {
      setLoading(false);
    }
  };

  // Professional Native Print / PDF Generation
  const handlePrintPdf = () => {
    window.print();
  };

  // Export Raw Structured Report JSON
  const handleExportJson = () => {
    if (!selectedReport) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedReport, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `${selectedReport.report_id}.json`);
    dlAnchor.click();
  };

  // Filtered reports list
  const filteredReports = useMemo(() => {
    return reportsList.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.report_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.session_id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === 'high-engagement') return item.overall_engagement >= 75;
      if (statusFilter === 'needs-focus') return item.overall_attention < 65;
      return true;
    });
  }, [reportsList, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 pb-12 print:p-0 print:m-0 print:space-y-4">
      {/* Print Stylesheet Overrides */}
      <style>{`
        @media print {
          body {
            background-color: #FFFFFF !important;
            color: #0F172A !important;
          }
          nav, aside, header, footer, .no-print {
            display: none !important;
          }
          .glass, .glass-strong {
            background: #FFFFFF !important;
            border: 1px solid #E2E8F0 !important;
            box-shadow: none !important;
            color: #0F172A !important;
          }
          .print-break {
            page-break-before: always;
          }
          .text-white {
            color: #0F172A !important;
          }
          .text-slate-400, .text-gray-400 {
            color: #64748B !important;
          }
        }
      `}</style>

      {/* Top Banner & Status Feedback */}
      {actionNotice && (
        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-xs flex items-center justify-between no-print shadow-xs">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-xs hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 1: REPORT LIST & DASHBOARD */}
      {/* ==================================================================== */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-800 dark:text-cyan-400 text-xs font-mono font-medium mb-1.5">
                <ShieldCheck size={13} />
                <span>INTELLIGENCE-REPORTS // V2.0</span>
              </div>
              <h2 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
                Cognitive Analysis Reports
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-2xl">
                Transform real-time multi-modal telemetry into evidence-backed, structured intelligence briefings with statistical trend analysis and AI synthesis.
              </p>
            </div>

            {/* Quick Action: Generate report for most recent completed session */}
            {completedSessions.length > 0 && (
              <button
                onClick={() => handleGenerateReportFromSession(completedSessions[0].id)}
                disabled={generating}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Generate Latest Session Report</span>
              </button>
            )}
          </div>

          {/* Aggregate KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Persisted Reports', value: reportsList.length.toString(), icon: FileText, color: '#06B6D4' },
              { label: 'Completed Analysis Sessions', value: completedSessions.length.toString(), icon: Activity, color: '#3B82F6' },
              { label: 'Average Focus Stability', value: reportsList.length > 0 ? `${Math.round(reportsList.reduce((acc, r) => acc + r.overall_attention, 0) / reportsList.length)}%` : '82%', icon: Brain, color: '#8B5CF6' },
              { label: 'Verification Standard', value: 'Evidence-Backed', icon: FileCheck, color: '#10B981' }
            ].map((kpi, idx) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass rounded-2xl p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${kpi.color}15`, border: `1px solid ${kpi.color}30` }}>
                    <kpi.icon size={18} style={{ color: kpi.color }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-gray-400 uppercase">{kpi.label}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{kpi.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: 'All Reports' },
                { id: 'high-engagement', label: 'High Engagement (>75%)' },
                { id: 'needs-focus', label: 'Requires Focus Review' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-800 dark:text-cyan-300 font-semibold'
                      : 'glass text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search reports by ID or date..."
              className="bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/80"
            />
          </div>

          {/* Reports Table */}
          <GlassCard delay={0.1}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-slate-500 dark:text-gray-400 uppercase tracking-wider font-mono text-[11px]">
                    <th className="py-3.5 px-4">Report Identifier</th>
                    <th className="py-3.5 px-4">Session Date & Time</th>
                    <th className="py-3.5 px-4">Duration</th>
                    <th className="py-3.5 px-4">Attention Index</th>
                    <th className="py-3.5 px-4">Engagement</th>
                    <th className="py-3.5 px-4">Fatigue Index</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw size={18} className="animate-spin inline mr-2 text-cyan-500" />
                        <span>Loading intelligence reports...</span>
                      </td>
                    </tr>
                  ) : filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 space-y-2">
                        <FileText size={28} className="mx-auto text-slate-500 opacity-60" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No reports found matching your criteria</p>
                        <p className="text-xs text-slate-400">Complete an analysis session in the workspace to automatically generate a report.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map(report => (
                      <tr
                        key={report.id}
                        onClick={() => handleOpenReport(report.id)}
                        className="hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-mono font-medium text-cyan-700 dark:text-cyan-400">
                          {report.report_id}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                          {new Date(report.session_date).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          {Math.round(report.duration_seconds / 60)} min
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          <span className={report.overall_attention >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                            {Math.round(report.overall_attention)}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {Math.round(report.overall_engagement)}%
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {Math.round(report.overall_fatigue)}%
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleOpenReport(report.id)}
                              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-medium transition-colors"
                            >
                              View Report
                            </button>
                            <button
                              onClick={(e) => handleDeleteReport(report.id, e)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                              title="Delete Report"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 2: COMPREHENSIVE INTELLIGENCE REPORT DETAIL VIEWER */}
      {/* ==================================================================== */}
      {viewMode === 'detail' && selectedReport && (
        <div ref={reportContainerRef} className="space-y-6">
          {/* Action Navigation Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print border-b border-slate-200 dark:border-white/10 pb-4">
            <button
              onClick={() => setViewMode('list')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Reports Library</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Compare Dropdown */}
              {reportsList.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={comparePrevId}
                    onChange={e => setComparePrevId(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="">Select report to compare...</option>
                    {reportsList
                      .filter(r => r.report_id !== selectedReport.report_id)
                      .map(r => (
                        <option key={r.report_id} value={r.report_id}>
                          {r.report_id} ({new Date(r.session_date).toLocaleDateString()})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleRunComparison(comparePrevId)}
                    disabled={!comparePrevId}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium flex items-center gap-1 hover:bg-purple-500/25 transition-all disabled:opacity-40 cursor-pointer"
                  >
                    <GitCompare size={14} />
                    <span>Compare</span>
                  </button>
                </div>
              )}

              <button
                onClick={handlePrintPdf}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-all cursor-pointer"
              >
                <Printer size={14} />
                <span>Print / Save as PDF</span>
              </button>

              <button
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-xl glass text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download size={14} />
                <span>Export JSON</span>
              </button>

              <button
                onClick={() => handleGenerateReportFromSession(selectedReport.session_id, true)}
                disabled={generating}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-xs font-medium flex items-center gap-1.5 hover:bg-cyan-500/20 transition-all cursor-pointer"
              >
                <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                <span>Regenerate AI</span>
              </button>
            </div>
          </div>

          {/* ================================================================ */}
          {/* SECTION 1: REPORT COVER & IDENTITY HEADER */}
          {/* ================================================================ */}
          <div className="glass rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 border border-cyan-400/30 shrink-0">
                  <Brain size={26} className="text-white drop-shadow-sm" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                      Antar <span className="text-cyan-700 dark:text-cyan-400">AI</span>
                    </h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-semibold">
                      OFFICIAL INTELLIGENCE BRIEFING
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Cognitive & Behavioral Telemetry Analysis Report</p>
                </div>
              </div>

              <div className="text-left sm:text-right font-mono text-xs space-y-0.5">
                <p className="font-bold text-slate-900 dark:text-white">{selectedReport.report_id}</p>
                <p className="text-slate-500 dark:text-gray-400">Generated: {new Date(selectedReport.created_at).toLocaleString()}</p>
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">Status: Sealed to Neon Postgres</p>
              </div>
            </div>

            {/* Session Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-gray-400 block text-[10px]">OPERATOR IDENTITY</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedReport.user_name || 'Primary Operator'}</span>
                <span className="text-[10px] text-slate-500 block truncate">{selectedReport.user_email || 'operator@antar.ai'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-gray-400 block text-[10px]">SESSION TIME RANGE</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {new Date(selectedReport.session_metadata.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedReport.session_metadata.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] text-slate-500 block">{new Date(selectedReport.session_metadata.started_at).toLocaleDateString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-gray-400 block text-[10px]">DURATION & SAMPLES</span>
                <span className="font-bold text-slate-900 dark:text-white">{Math.round(selectedReport.session_metadata.duration_seconds / 60)} minutes</span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 block">{selectedReport.session_metadata.sample_count} continuous frames</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                <span className="text-slate-500 dark:text-gray-400 block text-[10px]">TELEMETRY PIPELINE</span>
                <span className="font-bold text-slate-900 dark:text-white">478D Landmarker</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">Single-Subject Gating Active</span>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* SECTION 2: EXECUTIVE SUMMARY */}
          {/* ================================================================ */}
          <GlassCard delay={0.05}>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white">Executive Summary</h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {selectedReport.executive_summary.overview}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                    <CheckCircle2 size={14} />
                    <span>Primary Positive Observation</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{selectedReport.executive_summary.primary_positive}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    <AlertTriangle size={14} />
                    <span>Focus Variation & Area of Concern</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">{selectedReport.executive_summary.areas_of_concern}</p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* ================================================================ */}
          {/* SECTION 3: SESSION PERFORMANCE OVERVIEW & KPI CARDS */}
          {/* ================================================================ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                title: 'Attention Index',
                value: `${Math.round(selectedReport.metric_summaries.attention.mean)}%`,
                sub: `Stability: ${selectedReport.metric_summaries.attention.stability_index}%`,
                color: '#06B6D4'
              },
              {
                title: 'Engagement Score',
                value: `${Math.round(selectedReport.metric_summaries.engagement.mean)}%`,
                sub: `Median: ${selectedReport.metric_summaries.engagement.median}%`,
                color: '#3B82F6'
              },
              {
                title: 'Deep Focus Duration',
                value: `${Math.round(selectedReport.metric_summaries.deep_focus.mean)}%`,
                sub: `Peak: ${selectedReport.metric_summaries.deep_focus.max}%`,
                color: '#8B5CF6'
              },
              {
                title: 'Cognitive Fatigue',
                value: `${Math.round(selectedReport.metric_summaries.fatigue.mean)}%`,
                sub: `Trend: ${selectedReport.metric_summaries.fatigue.trend_slope > 0 ? '+' : ''}${selectedReport.metric_summaries.fatigue.trend_slope}/m`,
                color: selectedReport.metric_summaries.fatigue.mean > 40 ? '#F59E0B' : '#10B981'
              },
              {
                title: 'PERCLOS Index',
                value: `${selectedReport.metric_summaries.facial.perclos_pct}%`,
                sub: `${selectedReport.metric_summaries.facial.blink_count} Blinks`,
                color: '#EC4899'
              },
              {
                title: 'Ergonomic Posture',
                value: `${selectedReport.metric_summaries.posture.nominal_posture_pct}%`,
                sub: 'Aligned Pose',
                color: '#10B981'
              }
            ].map(card => (
              <div key={card.title} className="glass rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 block truncate">{card.title}</span>
                <p className="text-xl font-bold font-display" style={{ color: card.color }}>{card.value}</p>
                <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 block">{card.sub}</span>
              </div>
            ))}
          </div>

          {/* ================================================================ */}
          {/* SECTION 4 & 5: DETAILED TEMPORAL INTERVAL ANALYSIS */}
          {/* ================================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Temporal Epoch Table */}
            <GlassCard delay={0.1}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-cyan-600 dark:text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">Temporal Epoch Progression</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Chronological Slices</span>
                </div>

                <div className="space-y-3">
                  {selectedReport.temporal_analysis.intervals.map(epoch => (
                    <div key={epoch.name} className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
                        <span>{epoch.name}</span>
                        <span className="font-mono text-slate-500 text-[11px]">{epoch.time_range}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Attention</span>
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">{epoch.mean_attention}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Engagement</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{epoch.mean_engagement}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Fatigue</span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{epoch.mean_fatigue}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-500 dark:text-gray-400 italic">
                  {selectedReport.temporal_analysis.narrative}
                </p>
              </div>
            </GlassCard>

            {/* Statistical Distributions Table */}
            <GlassCard delay={0.15}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-purple-600 dark:text-purple-400" />
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">Mathematical Metric Distributions</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Variance & Stability</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 text-[10px]">
                        <th className="py-2">Metric</th>
                        <th className="py-2">Mean</th>
                        <th className="py-2">Median</th>
                        <th className="py-2">Min - Max</th>
                        <th className="py-2">Std Dev</th>
                        <th className="py-2">Stability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                      {[
                        { name: 'Attention', stats: selectedReport.metric_summaries.attention },
                        { name: 'Engagement', stats: selectedReport.metric_summaries.engagement },
                        { name: 'Deep Focus', stats: selectedReport.metric_summaries.deep_focus },
                        { name: 'Fatigue', stats: selectedReport.metric_summaries.fatigue },
                        { name: 'Cognitive Load', stats: selectedReport.metric_summaries.cognitive_load }
                      ].map(row => (
                        <tr key={row.name}>
                          <td className="py-2 font-bold text-slate-900 dark:text-slate-200">{row.name}</td>
                          <td className="py-2 text-cyan-600 dark:text-cyan-400 font-semibold">{row.stats.mean}</td>
                          <td className="py-2 text-slate-600 dark:text-slate-400">{row.stats.median}</td>
                          <td className="py-2 text-slate-500">{row.stats.min} - {row.stats.max}</td>
                          <td className="py-2 text-slate-500">±{row.stats.std_dev}</td>
                          <td className="py-2 font-semibold text-emerald-600 dark:text-emerald-400">{row.stats.stability_index}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* ================================================================ */}
          {/* SECTION 6: KEY EVIDENCE-BACKED FINDINGS */}
          {/* ================================================================ */}
          <GlassCard delay={0.2}>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white">Evidence-Backed Key Findings</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedReport.key_findings.map(finding => (
                  <div
                    key={finding.id}
                    className="p-4 rounded-xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{finding.id}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                        {finding.significance}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{finding.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{finding.description}</p>
                    <div className="pt-1 text-[11px] font-mono space-y-1 text-slate-500 border-t border-slate-200/60 dark:border-white/5">
                      <div><strong className="text-slate-700 dark:text-slate-300">Evidence:</strong> {finding.supporting_metric}</div>
                      <div><strong className="text-slate-700 dark:text-slate-300">Span:</strong> {finding.time_range}</div>
                      <div><strong className="text-slate-700 dark:text-slate-300">Action:</strong> {finding.action}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* ================================================================ */}
          {/* SECTION 7: CHRONOLOGICAL EVENT TIMELINE */}
          {/* ================================================================ */}
          <GlassCard delay={0.25}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Chronological Event Timeline</h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">Real-Time Ingestion Logs</span>
              </div>

              <div className="relative pl-6 space-y-4 border-l border-cyan-500/30">
                {selectedReport.event_timeline.map((event, idx) => (
                  <div key={idx} className="relative group">
                    <div className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                      event.severity === 'warning' ? 'bg-amber-400' : (event.severity === 'success' ? 'bg-emerald-400' : 'bg-cyan-400')
                    }`} />
                    <div className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{event.relative_time}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{event.event_type}</span>
                        <span className="text-[10px] text-slate-400">({event.timestamp})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{event.description}</p>
                      <span className="text-[10px] font-mono text-slate-500 block">{event.metric}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* ================================================================ */}
          {/* SECTION 8: PERSONALIZED ACTIONABLE RECOMMENDATIONS */}
          {/* ================================================================ */}
          <GlassCard delay={0.3}>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-500" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white">Personalized Actionable Recommendations</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedReport.recommendations.map(rec => (
                  <div key={rec.id} className="p-4 rounded-xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 uppercase">{rec.category}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold">
                        Priority: {rec.priority}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{rec.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{rec.reason}</p>
                    <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/15 text-xs text-slate-800 dark:text-slate-200">
                      <strong>Prescribed Action:</strong> {rec.action}
                    </div>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 block">
                      Benefit: {rec.expected_benefit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* ================================================================ */}
          {/* SECTION 9 & 10: DATA QUALITY, METHODOLOGY & DISCLAIMER */}
          {/* ================================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break">
            {/* Data Quality & Reliability */}
            <GlassCard delay={0.35}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">Data Quality & Telemetry Confidence</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/[0.02]">
                    <span className="text-slate-500 block text-[10px]">COMPLETENESS</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{selectedReport.data_quality.completeness_pct}%</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/[0.02]">
                    <span className="text-slate-500 block text-[10px]">PROCESSED FRAMES</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedReport.data_quality.valid_frames} / {selectedReport.data_quality.total_frames}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/[0.02]">
                    <span className="text-slate-500 block text-[10px]">TRACKING COVERAGE</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 text-sm">{selectedReport.data_quality.face_coverage_pct}%</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/[0.02]">
                    <span className="text-slate-500 block text-[10px]">OVERALL CONFIDENCE</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{selectedReport.data_quality.confidence_score}%</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-gray-400 space-y-1">
                  <p>• Single-subject Kalman spatial gating isolated primary operator telemetry.</p>
                  <p>• Zero raw video frames transmitted to external networks.</p>
                </div>
              </div>
            </GlassCard>

            {/* Methodology & Non-Clinical Disclaimer */}
            <GlassCard delay={0.4}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu size={18} className="text-cyan-600 dark:text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-950 dark:text-white">Analysis Methodology & Governance</h3>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                  <p>
                    <strong>Trained Inference Models:</strong> MediaPipe FaceLandmarker (0.10.14), Kalman Multi-Face Bounding Tracker, rPPG Micro-Pulse Estimator.
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-gray-400">
                    <strong>IMPORTANT NON-CLINICAL NOTICE:</strong> This report is intended exclusively for workplace productivity, focus architecture, and ergonomic awareness. It does NOT diagnose ADHD, clinical depression, cognitive impairment, or neurological disorders.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-[10px] font-mono text-slate-500">
                  Document Hash: {selectedReport.id} • Antar AI v2.0 • Sealed to Neon Lakebase Postgres
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VIEW 3: REPORT COMPARISON MODAL / VIEW */}
      {/* ==================================================================== */}
      {viewMode === 'compare' && comparisonData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
            <button
              onClick={() => setViewMode('detail')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Current Report</span>
            </button>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session Comparison Briefing</h3>
          </div>

          <GlassCard delay={0.05}>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <GitCompare size={18} className="text-purple-600 dark:text-purple-400" />
                <h3 className="text-base font-bold text-slate-950 dark:text-white">Comparative Performance Synthesis</h3>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {comparisonData.comparative_summary}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {comparisonData.trend_analysis.map(t => (
                  <div key={t.metric} className="p-4 rounded-xl bg-slate-100/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 space-y-1 text-xs">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{t.metric}</span>
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-500">{t.previous}% &rarr; {t.current}%</span>
                      <span className={t.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : (t.delta < 0 ? 'text-rose-500' : 'text-slate-400')}>
                        {t.delta > 0 ? `+${t.delta}%` : `${t.delta}%`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold block">Trend: {t.trend}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
