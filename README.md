# Antar AI (v3.0.0) — Cognitive Engagement & Analytical Intelligence Platform

[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Neon Database](https://img.shields.io/badge/Neon-Lakebase_Postgres-00E599?style=flat&logo=postgresql&logoColor=black)](https://neon.tech/)
[![Security](https://img.shields.io/badge/Biometric_Vault-AES--256--GCM-06B6D4?style=flat)](https://w3c.github.io/webcrypto/)

Antar AI is an edge-native cognitive intelligence workspace that transforms multimodal facial telemetry, ocular dynamics, cervical ergonomics, and behavioral data into actionable analytics and comprehensive intelligence reports.

---

## Architecture Overview

```text
├── frontend/                  # React 19 + TypeScript + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── components/        # Biometric HUD, Gaze Calibration, Audio/Webcam Analysis
│   │   ├── pages/             # Dashboard, Analytics, Reports, Digital Twin, Auth
│   │   ├── services/          # Neon Services, Vault, Report Engine, Crypto
│   │   └── workers/           # Multi-threaded MediaPipe & Liveness Detection Web Workers
│   └── public/
├── backend/                   # FastAPI + SQLAlchemy + Neon Lakebase PostgreSQL
│   ├── main.py                # REST Endpoints (Auth, Biometrics, Sessions, Reports)
│   ├── models.py              # PostgreSQL Relational Schemas
│   ├── schemas.py             # Pydantic v2 Contract Validation
│   ├── database.py            # Connection Pool & Neon Engine Config
│   └── report_service.py      # Statistical Distributions & Cognitive Synthesis Engine
└── documentation/             # System Architecture, Security & Governance Specs
```

---

## Key Features

1. **Production-Ready Biometric Face Enrollment (v2.0)**:
   - 45-frame RANSAC geometric manifold aggregation across cranial sub-manifolds.
   - Dual-threshold Kalman-gated liveness detection (blink micro-dynamics, 3D head pose stability, high-frequency Laplacian texture analysis).
   - Single-subject isolation: Automatically identifies the authenticated operator and masks background bystanders.
   - Client-side WebCrypto AES-GCM-256 encrypted hardware enclave stored in IndexedDB.

2. **Comprehensive Intelligence Reporting System**:
   - 18 structured analytical sections transforming actual session telemetry into actionable executive briefings.
   - Statistical distribution analysis (mean, median, variance, standard deviation, stability index, linear regression trend slope).
   - Temporal epoch segmentation (Early, Mid, and Late session intervals).
   - Multi-session comparison with delta calculations and trend trajectories.
   - Clean native print/PDF export styling with non-clinical ergonomic guardrails.

3. **Authentication & Identity**:
   - Multi-provider authentication supporting Email OTP via Neon Lakebase Postgres, Clerk SSO synchronization, and password authentication.
   - HMAC-SHA256 salted token protection with rate limiting and brute-force mitigation.

4. **Optimized Theming & Accessibility**:
   - Adaptive high-contrast Light and Dark palettes designed for optimal visibility and zero eye strain.

---

## Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # Configure your NEON_DATABASE_URL
python -m uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env       # Configure your VITE_NEON_DATABASE_URL
npm run dev
```

Visit `http://localhost:5173` to launch the application.

---

## License & Privacy
Antar AI operates with a Zero-Cloud Raw Video Transmission guarantee. Video streams are processed exclusively in real time on the client device through local WebAssembly/WebGL workers.
