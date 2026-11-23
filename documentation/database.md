# CockroachDB / PostgreSQL Setup & Integration Guide

## 1. Database Connection & Credentials

* **Cluster**: `huge-worm-37148` (CockroachDB Cloud Serverless)
* **Region**: AWS `ap-south-1` (Mumbai)
* **Port**: `26257`
* **Database**: `defaultdb`
* **User**: `utsab`
* **SSL Mode**: `verify-full` (Enabled with root CA certificate at `$env:appdata\postgresql\root.crt`)

### Connection Strings

```env
# Full Strict TLS Verification URL (Configured & Verified)
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<PORT>/<DB_NAME>?sslmode=require

# Fallback require mode
DATABASE_URL_REQUIRE=postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<PORT>/<DB_NAME>?sslmode=require
```

---

## 2. Relational Schema Architecture

The database contains 5 core tables supporting user profiles, live analysis sessions, time-series telemetry, and cognitive insights:

```
+---------------------------------------------------------------------------------------------------+
|                                  COCKROACHDB SCHEMA DIAGRAM                                       |
+---------------------------------------------------------------------------------------------------+

     +-----------------------+                    +---------------------------+
     |         users         |                    |       user_profiles       |
     +-----------------------+                    +---------------------------+
     | id (UUID, PK)         |<-------------------| user_id (UUID, PK, FK)    |
     | email (VARCHAR, UQ)   |                    | role (VARCHAR)            |
     | full_name (VARCHAR)   |                    | company (VARCHAR)         |
     | password_hash (VARCHAR|                    | settings (JSONB)          |
     | created_at, updated_at|                    | baseline_metrics (JSONB)  |
     +-----------------------+                    +---------------------------+
                 │
                 │ 1:N
                 ▼
     +-------------------------------------------------------------+
     |                          sessions                           |
     +-------------------------------------------------------------+
     | id (VARCHAR, PK)                                            |
     | user_id (UUID, FK, Nullable)                                |
     | started_at, ended_at (TIMESTAMPTZ)                          |
     | duration_seconds, sample_count (INT)                        |
     | average_engagement, average_attention_confidence (FLOAT)    |
     | average_deep_focus, average_interaction_score (FLOAT)       |
     | average_fatigue, average_boredom (FLOAT)                    |
     | status (VARCHAR), notes (TEXT), created_at (TIMESTAMPTZ)    |
     +-------------------------------------------------------------+
                 │                                   │
                 │ 1:N                               │ 1:N
                 ▼                                   ▼
+---------------------------------+  +---------------------------------+
|        session_telemetry        |  |       cognitive_insights        |
+---------------------------------+  +---------------------------------+
| id (UUID, PK)                   |  | id (UUID, PK)                   |
| session_id (VARCHAR, FK)        |  | session_id (VARCHAR, FK)        |
| timestamp, elapsed_seconds      |  | type (critical/warning/success) |
| engagement, attention_confidence|  | title (VARCHAR)                 |
| deep_focus, interaction_score   |  | description (TEXT)              |
| cognitive_fatigue, boredom_index|  | metric_value (FLOAT)            |
| ear, mar, voice_energy          |  | created_at (TIMESTAMPTZ)        |
| cervical_angle, slump_ratio     |  +---------------------------------+
| eye_state, raw_metrics (JSONB)  |
+---------------------------------+
```

---

## 3. Database Migration Script (`backend/setup_db.py`)

To initialize or re-verify all tables:
```bash
cd backend
python setup_db.py
```

Output:
```
============================================================
🚀 Antar AI — CockroachDB / PostgreSQL Database Setup
============================================================

[1/4] Checking Database Connectivity...
✅ Connected to CockroachDB! Server Version: CockroachDB CCL v26.2.11

[2/4] Creating Tables (DDL Migration)...
✅ Schema created successfully!

[3/4] Verifying Table Existence...
  ✓ Table 'users' verified.
  ✓ Table 'user_profiles' verified.
  ✓ Table 'sessions' verified.
  ✓ Table 'session_telemetry' verified.
  ✓ Table 'cognitive_insights' verified.

[4/4] Testing Write/Read Operations with Seed Data...
  ✓ Total Sessions in Database: verified.
============================================================
🎉 CockroachDB Setup Complete! Database is Ready for Antar AI v3
============================================================
```

---

## 4. Backend REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Verifies CockroachDB connectivity, server version, and ping. |
| `GET` | `/api/stats` | Aggregates KPIs (total sessions, total focus hours, averages). |
| `GET` | `/api/sessions` | Lists past sessions sorted chronologically (`started_at DESC`). |
| `POST` | `/api/sessions` | Persists a completed session with optional telemetry & insights. |
| `GET` | `/api/sessions/{id}` | Fetches detailed session with full telemetry history and insights. |
| `DELETE` | `/api/sessions/{id}` | Deletes a session and cascades deletes to telemetry & insights. |
| `WS` | `/ws/analyze` | High-frequency streaming WebSocket for real-time cognitive inference. |
