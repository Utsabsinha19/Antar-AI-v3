// ==============================================================================
// TermsPage.tsx — Enterprise Terms of Service (Antar AI v2.0)
// Detailed Legal Agreement for Edge Cognitive Intelligence & Biometric Gating
// ==============================================================================

import { useApp } from '@/store/appStore';
import { ArrowLeft, Lock, FileText, Scale, Database, Cpu } from 'lucide-react';

export default function TermsPage() {
  const { setCurrentPage, darkMode } = useApp();

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#090D16] text-slate-200' : 'bg-[#F1F5F9] text-slate-800'} py-12 px-4 sm:px-6 lg:px-8 selection:bg-cyan-500/30 transition-colors duration-200`}>
      {/* Background Ambient Accents */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full" />
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

          <div className="flex items-center gap-2 text-xs font-mono text-cyan-600 dark:text-cyan-400">
            <Scale size={14} />
            <span>LEGAL-SPEC // TERMS-OF-SERVICE-2026.2</span>
          </div>
        </div>

        {/* Title Section */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-xs font-mono mb-3">
            <FileText size={13} />
            <span>Effective Date: November 2026 • Version 2.0.4</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            Terms of Service & Enterprise Agreement
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            Please review these comprehensive terms governing your access to and utilization of the Antar AI edge-native cognitive intelligence workspace, single-subject biometric gating systems, neural telemetry models, and cloud synchronization services.
          </p>
        </div>

        {/* Key Tenet Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Edge-First Processing</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Raw sensor feeds (camera, mic) run entirely in volatile client memory and are never uploaded to cloud servers.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Cryptographic Vault</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Biometric reference vectors are sealed with AES-GCM-256 keys derived locally via PBKDF2 in browser IndexedDB.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-md">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-2" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Continuous Session Rights</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Operators possess unrestricted continuous session durations without artificial cutoffs or timeout lockouts.
            </p>
          </div>
        </div>

        {/* In-Depth Agreement Content */}
        <div className="space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xs backdrop-blur-md">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">01.</span>
              Acceptance of Terms & Enterprise Scope
            </h2>
            <p>
              By accessing, registering for, initializing, or interacting with Antar AI (&quot;the Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you (&quot;User&quot;, &quot;Operator&quot;, or &quot;Subscriber&quot;) enter into a legally binding agreement governed by these Terms of Service. If you are accessing the Platform on behalf of an entity, corporation, or research institution, you represent and warrant that you hold full legal authority to bind that entity to these provisions.
            </p>
            <p>
              These Terms apply to all deployment architectures, including standalone client-side WebAssembly runtimes, multithreaded browser Web Workers, local FastAPI/CockroachDB integrations, and cloud infrastructure provisioned through Neon Serverless Postgres, Neon Auth, and Neon Object Storage.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">02.</span>
              Architecture: Edge-Native Processing & Zero Cloud Video Transmission
            </h2>
            <p>
              Antar AI operates under a strict Zero-Cloud Biometric Raw Video Architecture. By utilizing our webcam and acoustic sensors, you acknowledge and agree to the following operational parameters:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong className="text-white">Volatile Local Memory:</strong> All optical video frames obtained via <code className="text-cyan-300 font-mono text-xs">navigator.mediaDevices.getUserMedia</code> are decoded and processed in isolated browser memory. Raw pixels, video streams, and audio buffers are never serialized, uploaded, or transmitted to any remote cloud endpoint.
              </li>
              <li>
                <strong className="text-white">Transient Geometric Invariants:</strong> Facial mesh landmarks (478 3D vertices), remote photoplethysmography (rPPG) green-channel chrominance signals, and Facial Action Coding System (FACS) blendshapes are computed on-device in Web Workers and discarded continuously every cycle.
              </li>
              <li>
                <strong className="text-white">Local Enclave Encryption:</strong> If the Operator elects to enroll for Single-Subject Biometric Gating, the resulting 128-dimensional Procrustes canonical vector is encrypted using client-side WebCrypto AES-GCM-256 with PBKDF2 (100,000 rounds) key derivation and sealed exclusively within the user&apos;s local browser IndexedDB (<code className="text-cyan-300 font-mono text-xs">antar_biometric_vault_v2</code>).
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">03.</span>
              Continuous Session Duration & Analysis Availability
            </h2>
            <p>
              Operators are entitled to maintain live sensor analysis sessions for as long as they choose without artificial duration ceilings, forced session expiration, or abrupt automated timeouts:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong className="text-white">Indefinite Analysis Continuity:</strong> The platform supports continuous monitoring for sustained focus sessions, deep work sprints, coding workflows, and lectures across multiple consecutive hours.
              </li>
              <li>
                <strong className="text-white">Non-Intrusive Operator Standby:</strong> If the primary verified operator momentarily turns away to write, stretch, review secondary displays, or step away, the platform smoothly enters Standby Mode. The session timer remains active, time-series continuity is preserved, and telemetry intake resumes without locking out the user or canceling the session.
              </li>
              <li>
                <strong className="text-white">Device Capability Disclaimers:</strong> Extended multi-hour analysis relies on client hardware capabilities. While WebAssembly and Web Worker pipelines are optimized for efficiency, the User acknowledges responsibility for device power management and hardware cooling during prolonged continuous sessions.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">04.</span>
              Single-Subject Gating & Bystander Privacy Protection
            </h2>
            <p>
              Antar AI incorporates ISO/IEC 30107-3 compliant presentation attack detection (PAD) and dynamic multi-face Kalman tracking to preserve privacy in collaborative, office, and open-space environments:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong className="text-white">Automatic Bystander Suppression:</strong> When secondary individuals enter the optical field of view, the system automatically tags and masks secondary faces, filtering their facial landmarks to prevent background contamination of your cognitive metrics.
              </li>
              <li>
                <strong className="text-white">Anti-Spoofing Protocols:</strong> The platform monitors 3D cranial depth variance and involuntary micro-blink Shannon entropy. Planar attacks (photographs or 2D screen projections) are rejected to ensure genuine operator presence.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">05.</span>
              Cloud Services & Data Synchronization
            </h2>
            <p>
              Where cloud synchronization is enabled by the User, Antar AI leverages Neon Serverless Postgres, Neon Auth, and S3-compatible Object Storage under the following terms:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong className="text-white">Telemetry Persistence:</strong> Only aggregate, high-level numerical time-series metrics (e.g., attention confidence percentage, engagement index, deep focus percentage, sample counts, and session timestamps) are transmitted to Lakebase Postgres tables (<code className="text-cyan-300 font-mono text-xs">sessions</code>, <code className="text-cyan-300 font-mono text-xs">session_telemetry</code>).
              </li>
              <li>
                <strong className="text-white">Report Archives:</strong> Explicitly exported PDF or JSON audit reports generated by the User are uploaded to your isolated tenant bucket in Neon Object Storage (<code className="text-cyan-300 font-mono text-xs">assets/reports</code>).
              </li>
              <li>
                <strong className="text-white">AI Copilot Inquiries:</strong> Interactive prompts submitted to the AI Chatbot are securely routed through the Neon AI Gateway to frontier model providers (e.g. OpenAI, Anthropic, Google Gemini) solely for generating synthesis reports and productivity insights.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">06.</span>
              Acceptable Use Policy
            </h2>
            <p>You agree not to misuse the Platform, including but not limited to:</p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>Employing Antar AI for covert surveillance or non-consensual biometric monitoring of individuals without their explicit knowledge and authorization.</li>
              <li>Attempting to reverse-engineer, decompile, or extract the underlying MediaPipe models or cryptographic primitives through illicit vector interception.</li>
              <li>Circumventing, spoofing, or tampering with biometric authentication barriers or anti-spoofing verification modules.</li>
              <li>Utilizing the cognitive telemetry metrics for discriminatory employment decisions, credit underwriting, or punitive surveillance.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">07.</span>
              Medical & Diagnostic Disclaimer
            </h2>
            <p className="text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl">
              <strong>IMPORTANT NOTICE:</strong> Antar AI is an edge-native cognitive analytics, focus optimization, and workflow productivity platform. <strong>It is NOT a medical device, certified diagnostic tool, or clinical health monitor.</strong> Metrics such as attention confidence, eye aspect ratio, fatigue index, and rPPG pulse estimate are mathematical approximations intended solely for productivity feedback. They must never be used as a substitute for professional medical advice, diagnosis, or clinical intervention.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">08.</span>
              Data Deletion & User Sovereignty
            </h2>
            <p>
              You maintain uncompromised sovereignty over your personal data. At any time, you may purge your biometric profile directly from the client application by clicking the &quot;Purge Biometrics&quot; button in the camera HUD or navigating to Settings. Purging permanently zeroes and deletes the AES-GCM-256 encrypted vector from local IndexedDB with immediate effect.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3 pt-4 border-t border-slate-800/60">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">09.</span>
              Governing Law & Amendments
            </h2>
            <p>
              These Terms shall be interpreted in accordance with applicable laws governing digital privacy, biometric information privacy acts (such as BIPA, GDPR, and CCPA/CPRA), and commercial software agreements. We reserve the right to amend these Terms with notice displayed on the platform upon revision.
            </p>
          </section>

        </div>

        {/* Footer Return Action */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Antar AI Cognitive Intelligence Platform • All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage('privacy')}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
            >
              Read Privacy Policy →
            </button>
            <button
              onClick={() => setCurrentPage('login')}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs transition-all shadow-md"
            >
              Back to Sign In
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
