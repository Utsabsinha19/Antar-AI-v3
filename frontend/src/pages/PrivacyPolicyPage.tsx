// ==============================================================================
// PrivacyPolicyPage.tsx — Comprehensive Privacy Policy (Antar AI v2.0)
// Detailed Disclosure on Zero-Cloud Biometrics, Cryptographic Enclave, & Telemetry
// ==============================================================================

import { useApp } from '@/store/appStore';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Shield, Trash2 } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const { setCurrentPage, darkMode } = useApp();

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#090D16] text-slate-200' : 'bg-[#F1F5F9] text-slate-800'} py-12 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500/30 transition-colors duration-200`}>
      {/* Background Ambient Accents */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation / Header */}
        <div className="mb-8 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-5">
          <button
            onClick={() => setCurrentPage('login')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            <span>Back to Sign In</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={14} />
            <span>SECURITY-SPEC // PRIVACY-POLICY-2026.2</span>
          </div>
        </div>

        {/* Title Section */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono mb-3">
            <Shield size={13} />
            <span>Effective Date: November 2026 • ISO/IEC 30107-3 & GDPR/CCPA Compliant</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            Privacy Policy & Biometric Data Disclosure
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            At Antar AI, privacy is an engineering invariant, not a legal afterthought. This policy outlines our architectural commitment to Zero-Cloud Raw Video Transmission, client-side cryptographic enclaves, and single-subject bystander isolation.
          </p>
        </div>

        {/* 3 Core Security Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <EyeOff className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Zero Raw Video Cloud</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Camera frames are processed in volatile client RAM and instantly discarded. No video is ever recorded or uploaded.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Local Encrypted Enclave</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Your 128D biometric vector is protected by WebCrypto AES-GCM-256 and stored exclusively in your browser IndexedDB.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Instant One-Click Purge</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              You possess irrevocable control to overwrite and permanently purge all biometric data from your local browser with one click.
            </p>
          </div>
        </div>

        {/* Detailed Privacy Sections */}
        <div className="space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xs backdrop-blur-md">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">01.</span>
              Architectural Classification of Data
            </h2>
            <p>
              To provide total transparency, Antar AI categorizes all data processed across four distinct architectural tiers:
            </p>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-cyan-300 text-xs uppercase tracking-wider font-mono">Tier 1: Volatile Optical & Acoustic Ingestion</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-mono">Never Transmitted</span>
                </div>
                <p className="text-xs text-slate-400">
                  Includes raw camera video frames (<code className="text-slate-300 font-mono">ImageBitmap</code>), microphone audio samples, 478 MediaPipe facial landmark coordinates, and intermediate optical flow buffers. These exist strictly within client RAM Web Workers and are continuously garbage-collected after every inference cycle.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-purple-300 text-xs uppercase tracking-wider font-mono">Tier 2: Client Enclave Biometric Vectors</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">Client-Side IndexedDB Only</span>
                </div>
                <p className="text-xs text-slate-400">
                  During optional 45-frame enrollment, a 128-dimensional Procrustes-normalized canonical facial embedding is synthesized. This mathematical vector is encrypted via WebCrypto AES-GCM-256 with a PBKDF2 100k-iteration derived key and stored in browser IndexedDB (<code className="text-slate-300 font-mono">antar_biometric_vault_v2</code>). No human face image can be reconstructed from this vector.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-emerald-300 text-xs uppercase tracking-wider font-mono">Tier 3: Aggregated Focus & Attention Telemetry</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">Optional Cloud Sync</span>
                </div>
                <p className="text-xs text-slate-400">
                  Time-series metrics including attention confidence percentage, engagement index, deep focus percentage, eye aspect ratio (EAR), head yaw/pitch angles, and session duration. These contain zero biometric identifiers and can optionally sync to our secure Neon Serverless Postgres backend.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-amber-300 text-xs uppercase tracking-wider font-mono">Tier 4: Enterprise Account & Audit Artifacts</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">Cloud Encrypted</span>
                </div>
                <p className="text-xs text-slate-400">
                  User credentials handled through Neon Auth (<code className="text-slate-300 font-mono">users</code> table with Argon2id password hashing) and user-exported executive session reports saved into your tenant partition in Neon Object Storage.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">02.</span>
              Single-Subject Privacy Gating & Bystander Anonymization
            </h2>
            <p>
              Antar AI is uniquely engineered to protect not only the primary user, but also colleagues, family members, or bystanders in shared environments:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong className="text-white">Multi-Face Kalman Filter Gating:</strong> If a secondary or background individual enters the camera field, our gating filter isolates the primary operator based on the encrypted reference vector and assigns background faces as &quot;Bystanders&quot;.
              </li>
              <li>
                <strong className="text-white">Automatic Landmark Suppression:</strong> Bystanders&apos; facial landmarks and biometric features are permanently stripped before metric aggregation. Their biometric signatures are never stored, tracked, or profiled.
              </li>
              <li>
                <strong className="text-white">Standby Holding for Operator Absences:</strong> When you look away or leave your workspace, the system pauses telemetry ingestion without interrupting your session duration or logging you out.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">03.</span>
              Presentation Attack Detection (Anti-Spoofing) Verification
            </h2>
            <p>
              To satisfy ISO/IEC 30107-3 presentation attack standards, our client Web Worker measures two passive anti-spoofing markers:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong className="text-white">3D Cranial Depth Variance:</strong> Mathematical calculation of orthogonal z-variance across nasal, canthi, and chin landmarks. Flat 2D photographs or screen displays lack cranial curvature (<code className="text-cyan-300 font-mono text-xs">depthVariance &lt; 0.00003</code>) and are rejected.
              </li>
              <li>
                <strong className="text-white">Dynamic Micro-Blink Shannon Entropy:</strong> Living humans execute natural, involuntary micro-saccades and blinks. Static cutouts or still frames produce zero entropy across a 90-frame window and trigger an immediate security alert.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">04.</span>
              Cloud Infrastructure & Neon Services Disclosure
            </h2>
            <p>
              Antar AI utilizes enterprise cloud services provided by Neon (Lakebase Postgres) under SOC 2 Type II compliance:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong className="text-white">PostgreSQL Database:</strong> Stores user profiles, workspace settings, session start/end metadata, and non-biometric cognitive time-series data.
              </li>
              <li>
                <strong className="text-white">Neon Object Storage (S3-Compatible):</strong> Houses compiled PDF and JSON report exports generated at your explicit request.
              </li>
              <li>
                <strong className="text-white">Neon AI Gateway:</strong> Proxies LLM queries for session summarization and chatbot interaction using TLS 1.3 encryption. No user camera frames or biometric embeddings are ever provided to LLM endpoints.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">05.</span>
              Global Privacy Rights: GDPR, CCPA/CPRA, and BIPA
            </h2>
            <p>
              Regardless of your geographic location, Antar AI extends universal rights aligned with global data protection frameworks:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                <span className="font-semibold text-white text-xs block mb-1">Right to Complete Erasure</span>
                <span className="text-xs text-slate-400">Clicking &quot;Purge Biometrics&quot; destroys your encrypted embedding immediately without cloud remnants.</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                <span className="font-semibold text-white text-xs block mb-1">Right to Access & Portability</span>
                <span className="text-xs text-slate-400">Export your complete session timeline, focus analytics, and cognitive scores in standard JSON or PDF format.</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                <span className="font-semibold text-white text-xs block mb-1">Zero Commercial Data Sale</span>
                <span className="text-xs text-slate-400">We do not sell, rent, monetize, or broker your behavioral or biometric telemetry to any third party.</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800">
                <span className="font-semibold text-white text-xs block mb-1">Zero Cloud Training</span>
                <span className="text-xs text-slate-400">Your biometric samples are never harvested to train general AI models or facial recognition databases.</span>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">06.</span>
              Client Storage, Cookies & Local Caches
            </h2>
            <p>
              Antar AI utilizes local browser storage mechanisms strictly for operational performance:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li><strong className="text-white">IndexedDB (<code className="text-cyan-300 font-mono text-xs">antar_biometric_vault_v2</code>):</strong> Encrypted biometric embeddings and spatial gaze calibration weights.</li>
              <li><strong className="text-white">localStorage (<code className="text-cyan-300 font-mono text-xs">antar-ai.sessions</code>):</strong> Offline session history buffer and user UI theme preferences.</li>
              <li><strong className="text-white">Session Cookies / Auth Tokens:</strong> Ephemeral session tokens issued by Neon Auth for authenticating API requests.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">07.</span>
              Contact Us & Data Protection Officer
            </h2>
            <p>
              If you have inquiries regarding our zero-cloud biometric architecture, wish to request enterprise compliance documentation, or have privacy concerns, please contact our privacy and engineering team:
            </p>
            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
              <p><strong className="text-white">Antar AI Privacy Operations:</strong> privacy@antar.ai</p>
              <p><strong className="text-white">Data Protection Officer:</strong> dpo@antar.ai</p>
              <p><strong className="text-white">Security Vulnerability Disclosure:</strong> security@antar.ai</p>
            </div>
          </section>

        </div>

        {/* Footer Return Action */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Antar AI Cognitive Intelligence Platform • All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage('terms')}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
            >
              Read Terms of Service →
            </button>
            <button
              onClick={() => setCurrentPage('login')}
              className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs transition-all shadow-md"
            >
              Back to Sign In
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
