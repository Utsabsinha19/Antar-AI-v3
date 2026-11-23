import os
import uuid
import hmac
import hashlib
import json
import logging
import collections
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
import numpy as np

from database import engine, get_db, check_db_connection
import models
import schemas
from email_service import dispatch_otp_email
from report_service import generate_intelligence_report

app = FastAPI(
    title="Antar AI Backend API",
    description="Real-time Cognitive Load Inference & CockroachDB Persistence Service",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend")

# =====================================================================
# REST Endpoints: Health & Database Diagnostics
# =====================================================================

@app.get("/")
def read_root():
    return {
        "service": "Antar AI Live Cognitive Load & Analytics Backend",
        "version": "3.0.0",
        "database": "CockroachDB Cloud (Connected)",
        "docs": "/docs"
    }

@app.get("/api/health", response_model=schemas.HealthResponseSchema)
def health_check():
    db_status = check_db_connection()
    return {
        "status": "healthy" if db_status.get("status") == "connected" else "degraded",
        "database": db_status,
        "timestamp": datetime.utcnow()
    }

# =====================================================================
# REST Endpoints: Neon Auth & Email OTP Authentication
# =====================================================================

OTP_SECRET = os.getenv("OTP_SECRET", "antar_production_otp_secret_k8x_enclave")

def hash_otp(code: str, secret: str = OTP_SECRET) -> str:
    """Computes HMAC-SHA256 hash of the verification code."""
    return hmac.new(secret.encode(), code.strip().encode(), hashlib.sha256).hexdigest()

def verify_otp_hash(code: str, stored_hash_or_code: str, secret: str = OTP_SECRET) -> bool:
    """Safely verifies the OTP code against the stored hash or legacy plaintext."""
    if len(stored_hash_or_code) == 6 and stored_hash_or_code == code.strip():
        return True
    expected = hash_otp(code, secret)
    return hmac.compare_digest(expected, stored_hash_or_code)

@app.post("/api/auth/otp/generate", response_model=schemas.AuthResponseSchema)
async def generate_email_otp(
    payload: schemas.OTPRequestSchema,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    email = payload.email.strip().lower()
    if not email or "@" not in email or len(email) < 5:
        raise HTTPException(status_code=400, detail="Please provide a valid email address.")

    now = datetime.utcnow()

    # 1. Enforce Cooldown Protection (45 seconds)
    recent_otp = db.query(models.EmailOTP).filter(
        models.EmailOTP.email == email,
        models.EmailOTP.is_verified == False
    ).order_by(models.EmailOTP.created_at.desc()).first()

    if recent_otp and recent_otp.created_at:
        created_dt = recent_otp.created_at.replace(tzinfo=None)
        elapsed = (now - created_dt).total_seconds()
        if elapsed < 45:
            remaining = int(45 - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} second{'s' if remaining != 1 else ''} before requesting a new code."
            )

    # 2. Hourly Anti-Abuse Rate Limit (Max 5 requests per hour per email)
    one_hour_ago = now - timedelta(hours=1)
    hourly_requests = db.query(models.EmailOTP).filter(
        models.EmailOTP.email == email,
        models.EmailOTP.created_at > one_hour_ago
    ).count()

    if hourly_requests >= 5:
        raise HTTPException(
            status_code=429,
            detail="Rate limit reached: Maximum 5 verification codes per hour. Please wait before requesting another."
        )

    # 3. Invalidate prior unverified OTPs for this email to prevent replay attacks
    db.query(models.EmailOTP).filter(
        models.EmailOTP.email == email,
        models.EmailOTP.is_verified == False
    ).delete()

    # 4. Generate cryptographically secure 6-digit numeric OTP (100000 - 999999)
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    hashed_code = hash_otp(otp_code)
    expires_at = now + timedelta(minutes=5)

    otp_record = models.EmailOTP(
        email=email,
        otp_code=hashed_code,
        otp_type=payload.type or "SIGN_IN",
        expires_at=expires_at,
        is_verified=False,
        attempts=0,
        created_at=now
    )
    db.add(otp_record)
    db.commit()

    # 5. Dispatch email via transactional infrastructure
    try:
        dispatch_result = await dispatch_otp_email(email, otp_code, expiry_minutes=5)
        logger.info(f"[Auth Engine] Verification OTP dispatched to {email} via {dispatch_result.get('provider')}")
    except Exception as e:
        logger.error(f"[Auth Engine] Email dispatch failure for {email}: {e}")
        raise HTTPException(status_code=502, detail="Failed to deliver verification email. Please check your connection and retry.")

    return {
        "success": True,
        "message": f"Verification code sent to {email}. Valid for 5 minutes.",
        "email": email,
        "cooldown_seconds": 45,
        "expires_in_seconds": 300
    }

@app.post("/api/auth/otp/verify", response_model=schemas.AuthResponseSchema)
def verify_email_otp(
    payload: schemas.OTPVerifySchema,
    db: Session = Depends(get_db)
):
    email = payload.email.strip().lower()
    code = payload.otp_code.strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Verification code must be 6 numeric digits.")

    now = datetime.utcnow()

    # Fetch latest active OTP for this email
    otp_record = db.query(models.EmailOTP).filter(
        models.EmailOTP.email == email,
        models.EmailOTP.is_verified == False
    ).order_by(models.EmailOTP.created_at.desc()).first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="No active verification code found. Please request a new code.")

    # Check expiration (5 minutes)
    if otp_record.expires_at.replace(tzinfo=None) < now:
        raise HTTPException(status_code=400, detail="Your verification code has expired. Request a new one.")

    # Check maximum attempt lockout (5 attempts)
    if otp_record.attempts >= 5:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=429, detail="Too many invalid attempts. This code has been invalidated. Please request a new code.")

    # Cryptographically verify the OTP code
    if not verify_otp_hash(code, otp_record.otp_code):
        otp_record.attempts += 1
        db.commit()
        remaining = max(0, 5 - otp_record.attempts)
        if remaining == 0:
            db.delete(otp_record)
            db.commit()
            raise HTTPException(status_code=429, detail="Maximum attempts exceeded. This code has been invalidated. Please request a new code.")
        raise HTTPException(
            status_code=400,
            detail=f"The verification code is incorrect. {remaining} attempt{'s' if remaining != 1 else ''} remaining."
        )

    # Mark OTP as consumed/verified (prevents replay attack)
    otp_record.is_verified = True
    db.commit()

    # Find or create User in Neon Database
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            email=email,
            full_name=payload.full_name or email.split("@")[0].capitalize(),
            auth_provider="neon_otp",
            is_verified=True
        )
        db.add(user)
        db.flush()

        # Create corresponding UserProfile in Neon
        profile = models.UserProfile(
            user_id=user.id,
            role=payload.role or "Knowledge Worker",
            company="Self-Employed",
            bio="Cognitive worker using Antar AI workspace.",
            settings={"darkMode": True, "biometricGating": True}
        )
        db.add(profile)
    else:
        user.is_verified = True
        if payload.full_name and not user.full_name:
            user.full_name = payload.full_name

    # Create Authenticated Session Token
    session_token = secrets.token_urlsafe(48)
    auth_session = models.AuthSession(
        user_id=user.id,
        token=session_token,
        expires_at=datetime.utcnow() + timedelta(days=30),
        user_agent="Antar-AI-Workspace-Client"
    )
    db.add(auth_session)
    db.commit()
    db.refresh(user)

    logger.info(f"[Neon Auth] User {email} successfully authenticated via OTP into Neon Postgres.")

    return {
        "success": True,
        "message": "Authentication successful.",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "token": session_token
    }

# =====================================================================
# REST Endpoints: Clerk Authentication Synchronizer
# =====================================================================

@app.post("/api/auth/clerk/sync", response_model=schemas.AuthResponseSchema)
def sync_clerk_user(
    payload: schemas.ClerkUserSyncSchema,
    db: Session = Depends(get_db)
):
    clerk_id = payload.clerk_id.strip()
    email = payload.email.strip().lower()

    if not clerk_id or not email:
        raise HTTPException(status_code=400, detail="clerk_id and email are required.")

    # Check by clerk_id or email
    user = db.query(models.User).filter(
        (models.User.clerk_id == clerk_id) | (models.User.email == email)
    ).first()

    if not user:
        user = models.User(
            email=email,
            clerk_id=clerk_id,
            full_name=payload.full_name or email.split("@")[0].capitalize(),
            avatar_url=payload.avatar_url,
            auth_provider="clerk",
            is_verified=True
        )
        db.add(user)
        db.flush()

        profile = models.UserProfile(
            user_id=user.id,
            role=payload.role or "Knowledge Worker",
            company="",
            bio="",
            settings={"darkMode": True, "biometricGating": True}
        )
        db.add(profile)
    else:
        user.clerk_id = clerk_id
        user.auth_provider = "clerk"
        user.is_verified = True
        if payload.full_name:
            user.full_name = payload.full_name
        if payload.avatar_url:
            user.avatar_url = payload.avatar_url

    session_token = f"clerk_{secrets.token_urlsafe(36)}"
    auth_session = models.AuthSession(
        user_id=user.id,
        token=session_token,
        expires_at=datetime.utcnow() + timedelta(days=30),
        user_agent="Antar-AI-Clerk-Client"
    )
    db.add(auth_session)
    db.commit()
    db.refresh(user)

    logger.info(f"[Clerk Sync] Clerk user {clerk_id} ({email}) synced into Neon Postgres.")

    return {
        "success": True,
        "message": "Clerk account synchronized with Neon database.",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "token": session_token
    }

@app.get("/api/auth/me")
def get_current_user_profile(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header.")

    token = authorization.replace("Bearer ", "").strip()
    session_rec = db.query(models.AuthSession).filter(
        models.AuthSession.token == token,
        models.AuthSession.expires_at > datetime.utcnow()
    ).first()

    if not session_rec or not session_rec.user:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    u = session_rec.user
    p = u.profile
    return {
        "user_id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "auth_provider": u.auth_provider,
        "is_verified": u.is_verified,
        "avatar_url": u.avatar_url,
        "profile": {
            "role": p.role if p else "Knowledge Worker",
            "company": p.company if p else "",
            "bio": p.bio if p else "",
            "settings": p.settings if p else {}
        } if p else None
    }

# =====================================================================
# Authenticated User Resolver Helper
# =====================================================================

def get_authenticated_user_id(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> str:
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        session_rec = db.query(models.AuthSession).filter(
            models.AuthSession.token == token,
            models.AuthSession.expires_at > datetime.utcnow()
        ).first()
        if session_rec and session_rec.user_id:
            return session_rec.user_id

    # Fallback to primary operator or most recent registered user
    first_user = db.query(models.User).order_by(models.User.created_at.desc()).first()
    if first_user:
        return first_user.id

    default_user = models.User(
        email="operator@antar.ai",
        full_name="Primary Operator",
        auth_provider="neon_auth",
        is_verified=True
    )
    db.add(default_user)
    db.commit()
    db.refresh(default_user)
    return default_user.id

# =====================================================================
# REST Endpoints: Biometric Enclave Management (Neon Lakebase DB)
# =====================================================================

@app.post("/api/biometrics/enroll", response_model=schemas.BiometricStatusResponseSchema)
def enroll_biometrics(
    payload: schemas.BiometricEnrollRequestSchema,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user_id = get_authenticated_user_id(authorization, db)

    # Check if enclave entry already exists (for re-enrollment)
    enclave = db.query(models.BiometricEnclave).filter_by(user_id=user_id).first()
    if not enclave:
        enclave = models.BiometricEnclave(
            user_id=user_id,
            encrypted_embedding=payload.encrypted_embedding,
            key_salt=payload.key_salt,
            iv=payload.iv,
            algorithm=payload.algorithm or "AES-GCM-256"
        )
        db.add(enclave)
    else:
        # Re-enrollment: overwrite with fresh encrypted template
        enclave.encrypted_embedding = payload.encrypted_embedding
        enclave.key_salt = payload.key_salt
        enclave.iv = payload.iv
        enclave.algorithm = payload.algorithm or "AES-GCM-256"
        enclave.updated_at = datetime.utcnow()

    # Update profile setting to reflect active biometric gating
    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if profile:
        settings = dict(profile.settings or {})
        settings["biometricGating"] = True
        settings["biometricsEnrolledAt"] = datetime.utcnow().isoformat()
        profile.settings = settings

    db.commit()
    db.refresh(enclave)

    logger.info(f"[Biometric Enclave] Successfully sealed 45-frame biometric template into Neon DB for user {user_id}")

    return {
        "is_enrolled": True,
        "user_id": user_id,
        "enrolled_at": enclave.created_at,
        "updated_at": enclave.updated_at,
        "algorithm": enclave.algorithm,
        "model_version": payload.model_version or "MediaPipe-FaceLandmarker-478D-Manifold",
        "key_salt": enclave.key_salt,
        "iv": enclave.iv,
        "encrypted_embedding": enclave.encrypted_embedding
    }

@app.get("/api/biometrics/status", response_model=schemas.BiometricStatusResponseSchema)
def get_biometric_status(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user_id = get_authenticated_user_id(authorization, db)
    enclave = db.query(models.BiometricEnclave).filter_by(user_id=user_id).first()

    if not enclave:
        return {
            "is_enrolled": False,
            "user_id": user_id
        }

    return {
        "is_enrolled": True,
        "user_id": user_id,
        "enrolled_at": enclave.created_at,
        "updated_at": enclave.updated_at,
        "algorithm": enclave.algorithm,
        "model_version": "MediaPipe-FaceLandmarker-478D-Manifold",
        "key_salt": enclave.key_salt,
        "iv": enclave.iv,
        "encrypted_embedding": enclave.encrypted_embedding
    }

@app.delete("/api/biometrics/enrollment", response_model=schemas.BiometricDeleteResponseSchema)
def delete_biometric_enrollment(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user_id = get_authenticated_user_id(authorization, db)
    enclave = db.query(models.BiometricEnclave).filter_by(user_id=user_id).first()

    if not enclave:
        raise HTTPException(status_code=404, detail="No enrolled biometric template found for this account.")

    db.delete(enclave)

    profile = db.query(models.UserProfile).filter_by(user_id=user_id).first()
    if profile:
        settings = dict(profile.settings or {})
        settings["biometricGating"] = False
        settings.pop("biometricsEnrolledAt", None)
        profile.settings = settings

    db.commit()
    logger.info(f"[Biometric Enclave] Revoked and deleted biometric template for user {user_id}")

    return {
        "success": True,
        "message": "Biometric registration successfully deleted from Neon Lakebase database.",
        "revoked_at": datetime.utcnow()
    }

# =====================================================================
# REST Endpoints: Session Management (CockroachDB Persistence)
# =====================================================================

@app.get("/api/sessions", response_model=List[schemas.SessionResponseSchema])
def list_sessions(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    sessions = db.query(models.SessionModel).order_by(models.SessionModel.started_at.desc()).limit(limit).all()
    return sessions

@app.post("/api/sessions", response_model=schemas.SessionResponseSchema)
def create_session(
    payload: schemas.SessionCreateSchema,
    db: Session = Depends(get_db)
):
    # Check if session already exists
    existing = db.query(models.SessionModel).filter_by(id=payload.id).first()
    if existing:
        return existing

    session_obj = models.SessionModel(
        id=payload.id,
        user_id=payload.user_id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_seconds=payload.duration_seconds,
        sample_count=payload.sample_count,
        average_engagement=payload.average_engagement,
        average_attention_confidence=payload.average_attention_confidence,
        average_deep_focus=payload.average_deep_focus,
        average_interaction_score=payload.average_interaction_score,
        average_fatigue=payload.average_fatigue,
        average_boredom=payload.average_boredom,
        notes=payload.notes,
        status="completed"
    )
    db.add(session_obj)

    # Optional timeline telemetry
    if payload.timeline:
        for t in payload.timeline:
            telemetry_point = models.SessionTelemetry(
                session_id=payload.id,
                elapsed_seconds=t.elapsed_seconds,
                engagement=t.engagement,
                attention_confidence=t.attention_confidence,
                deep_focus=t.deep_focus,
                interaction_score=t.interaction_score,
                cognitive_fatigue=t.cognitive_fatigue,
                boredom_index=t.boredom_index,
                ear=t.ear,
                mar=t.mar,
                voice_energy=t.voice_energy,
                eye_state=t.eye_state,
                cervical_angle=t.cervical_angle,
                slump_ratio=t.slump_ratio,
                is_slumping=t.is_slumping,
                raw_metrics=t.raw_metrics or {}
            )
            db.add(telemetry_point)

    # Optional insights
    if payload.insights:
        for ins in payload.insights:
            insight_obj = models.CognitiveInsight(
                session_id=payload.id,
                type=ins.type,
                title=ins.title,
                description=ins.description,
                metric_value=ins.value
            )
            db.add(insight_obj)

    db.commit()
    db.refresh(session_obj)
    return session_obj

@app.get("/api/sessions/{session_id}")
def get_session_detail(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.query(models.SessionModel).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    telemetry = [
        {
            "elapsed_seconds": t.elapsed_seconds,
            "engagement": t.engagement,
            "attention_confidence": t.attention_confidence,
            "deep_focus": t.deep_focus,
            "interaction_score": t.interaction_score,
            "cognitive_fatigue": t.cognitive_fatigue,
            "boredom_index": t.boredom_index,
            "ear": t.ear,
            "mar": t.mar,
            "eye_state": t.eye_state,
            "cervical_angle": t.cervical_angle
        }
        for t in session.telemetry
    ]

    insights = [
        {
            "id": ins.id,
            "type": ins.type,
            "title": ins.title,
            "description": ins.description,
            "value": ins.metric_value
        }
        for ins in session.insights
    ]

    return {
        "session": session,
        "telemetry": telemetry,
        "insights": insights
    }

@app.delete("/api/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    session = db.query(models.SessionModel).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"message": f"Session {session_id} deleted successfully"}

@app.get("/api/stats")
def get_aggregate_stats(db: Session = Depends(get_db)):
    total_sessions = db.query(models.SessionModel).count()
    if total_sessions == 0:
        return {
            "total_sessions": 0,
            "total_duration_hours": 0.0,
            "average_engagement": 0.0,
            "average_deep_focus": 0.0
        }

    duration_sum = db.query(func.sum(models.SessionModel.duration_seconds)).scalar() or 0
    avg_eng = db.query(func.avg(models.SessionModel.average_engagement)).scalar() or 0.0
    avg_focus = db.query(func.avg(models.SessionModel.average_deep_focus)).scalar() or 0.0

    return {
        "total_sessions": total_sessions,
        "total_duration_hours": round(float(duration_sum) / 3600.0, 2),
        "average_engagement": round(float(avg_eng), 1),
        "average_deep_focus": round(float(avg_focus), 1)
    }

# =====================================================================
# REST Endpoints: Comprehensive Intelligence Reports (Antar AI v2.0)
# =====================================================================

@app.post("/api/reports/generate", response_model=schemas.ReportDetailResponseSchema)
async def create_report(
    payload: schemas.ReportGenerateRequestSchema,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(models.User).filter_by(id=user_id).first()

    report = await generate_intelligence_report(
        db=db,
        session_id=payload.session_id,
        user_id=user_id,
        title=payload.title,
        force_regenerate=payload.force_regenerate or False,
        device_info=payload.device_info
    )

    return {
        "id": report.id,
        "report_id": report.report_id,
        "user_id": report.user_id,
        "session_id": report.session_id,
        "title": report.title,
        "session_metadata": report.session_metadata or {},
        "executive_summary": report.executive_summary or {},
        "metric_summaries": report.metric_summaries or {},
        "temporal_analysis": report.temporal_analysis or {},
        "key_findings": report.key_findings or [],
        "event_timeline": report.event_timeline or [],
        "recommendations": report.recommendations or [],
        "data_quality": report.data_quality or {},
        "methodology": report.methodology or {},
        "version": report.version or "v2.0",
        "status": report.status or "generated",
        "created_at": report.created_at,
        "updated_at": report.updated_at,
        "user_name": user.full_name if user else "Verified Operator",
        "user_email": user.email if user else None
    }

@app.get("/api/reports", response_model=List[schemas.ReportListItemSchema])
def list_reports(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user_id = get_authenticated_user_id(authorization, db)
    reports = db.query(models.IntelligenceReport).filter(
        models.IntelligenceReport.user_id == user_id
    ).order_by(models.IntelligenceReport.created_at.desc()).all()

    results = []
    for r in reports:
        meta = r.session_metadata or {}
        metrics = r.metric_summaries or {}
        results.append({
            "id": r.id,
            "report_id": r.report_id,
            "session_id": r.session_id,
            "title": r.title,
            "session_date": r.created_at,
            "duration_seconds": meta.get("duration_seconds", 0),
            "overall_engagement": float(metrics.get("engagement", {}).get("mean", 0.0)),
            "overall_attention": float(metrics.get("attention", {}).get("mean", 0.0)),
            "overall_fatigue": float(metrics.get("fatigue", {}).get("mean", 0.0)),
            "status": r.status or "generated",
            "created_at": r.created_at
        })
    return results

@app.get("/api/reports/{report_id}", response_model=schemas.ReportDetailResponseSchema)
def get_report_detail(
    report_id: str,
    db: Session = Depends(get_db)
):
    report = db.query(models.IntelligenceReport).filter(
        (models.IntelligenceReport.id == report_id) | (models.IntelligenceReport.report_id == report_id)
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Intelligence report not found")

    user = db.query(models.User).filter_by(id=report.user_id).first()
    return {
        "id": report.id,
        "report_id": report.report_id,
        "user_id": report.user_id,
        "session_id": report.session_id,
        "title": report.title,
        "session_metadata": report.session_metadata or {},
        "executive_summary": report.executive_summary or {},
        "metric_summaries": report.metric_summaries or {},
        "temporal_analysis": report.temporal_analysis or {},
        "key_findings": report.key_findings or [],
        "event_timeline": report.event_timeline or [],
        "recommendations": report.recommendations or [],
        "data_quality": report.data_quality or {},
        "methodology": report.methodology or {},
        "version": report.version or "v2.0",
        "status": report.status or "generated",
        "created_at": report.created_at,
        "updated_at": report.updated_at,
        "user_name": user.full_name if user else "Verified Operator",
        "user_email": user.email if user else None
    }

@app.post("/api/reports/compare", response_model=schemas.ReportComparisonResponseSchema)
def compare_reports(
    payload: schemas.ReportCompareRequestSchema,
    db: Session = Depends(get_db)
):
    curr = db.query(models.IntelligenceReport).filter(
        (models.IntelligenceReport.id == payload.current_report_id) | (models.IntelligenceReport.report_id == payload.current_report_id)
    ).first()
    prev = db.query(models.IntelligenceReport).filter(
        (models.IntelligenceReport.id == payload.previous_report_id) | (models.IntelligenceReport.report_id == payload.previous_report_id)
    ).first()

    if not curr or not prev:
        raise HTTPException(status_code=404, detail="One or both comparison reports not found.")

    curr_metrics = curr.metric_summaries or {}
    prev_metrics = prev.metric_summaries or {}

    curr_att = float(curr_metrics.get("attention", {}).get("mean", 0.0))
    prev_att = float(prev_metrics.get("attention", {}).get("mean", 0.0))
    curr_eng = float(curr_metrics.get("engagement", {}).get("mean", 0.0))
    prev_eng = float(prev_metrics.get("engagement", {}).get("mean", 0.0))
    curr_fat = float(curr_metrics.get("fatigue", {}).get("mean", 0.0))
    prev_fat = float(prev_metrics.get("fatigue", {}).get("mean", 0.0))

    delta_metrics = {
        "attention_delta": round(curr_att - prev_att, 1),
        "engagement_delta": round(curr_eng - prev_eng, 1),
        "fatigue_delta": round(curr_fat - prev_fat, 1),
        "duration_delta_seconds": int((curr.session_metadata or {}).get("duration_seconds", 0)) - int((prev.session_metadata or {}).get("duration_seconds", 0))
    }

    trend_analysis = [
        {
            "metric": "Attention Stability",
            "previous": prev_att,
            "current": curr_att,
            "delta": delta_metrics["attention_delta"],
            "trend": "Improved" if delta_metrics["attention_delta"] > 0 else ("Declined" if delta_metrics["attention_delta"] < 0 else "Unchanged")
        },
        {
            "metric": "Engagement Score",
            "previous": prev_eng,
            "current": curr_eng,
            "delta": delta_metrics["engagement_delta"],
            "trend": "Improved" if delta_metrics["engagement_delta"] > 0 else ("Declined" if delta_metrics["engagement_delta"] < 0 else "Unchanged")
        },
        {
            "metric": "Cognitive Fatigue",
            "previous": prev_fat,
            "current": curr_fat,
            "delta": delta_metrics["fatigue_delta"],
            "trend": "Reduced" if delta_metrics["fatigue_delta"] < 0 else ("Elevated" if delta_metrics["fatigue_delta"] > 0 else "Unchanged")
        }
    ]

    summary = (
        f"Compared to session {prev.report_id}, attention shifted by {delta_metrics['attention_delta']:+0.1f}%, "
        f"engagement shifted by {delta_metrics['engagement_delta']:+0.1f}%, and cognitive fatigue shifted by {delta_metrics['fatigue_delta']:+0.1f}%."
    )

    return {
        "current_report_id": curr.report_id,
        "previous_report_id": prev.report_id,
        "delta_metrics": delta_metrics,
        "comparative_summary": summary,
        "trend_analysis": trend_analysis
    }

@app.delete("/api/reports/{report_id}")
def delete_report(
    report_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    user_id = get_authenticated_user_id(authorization, db)
    report = db.query(models.IntelligenceReport).filter(
        (models.IntelligenceReport.id == report_id) | (models.IntelligenceReport.report_id == report_id)
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to delete this report")

    db.delete(report)
    db.commit()
    return {"success": True, "message": f"Report {report_id} deleted successfully"}


# =====================================================================
# Real-Time WebSocket Endpoint: Cognitive Load Inference
# =====================================================================

@app.websocket("/ws/analyze")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New client connected for analysis")

    # Store history for temporal sliding-window features
    history = collections.deque(maxlen=30)

    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)

            face_detected = data.get("faceDetected", False)
            ear = data.get("ear", 0.0)
            voice = data.get("voice", 0.0)

            if not face_detected:
                await websocket.send_json({
                    "cognitiveLoadScore": 0.0,
                    "status": "NO_FACE"
                })
                continue

            history.append({
                "ear": ear,
                "voice": voice
            })

            # Temporal Cognitive Load Evaluation
            avg_ear = np.mean([h["ear"] for h in history]) if len(history) > 0 else ear

            cognitive_load = 0.5  # Base load

            # Eye state influence (squinting or prolonged staring)
            if avg_ear < 0.2:
                cognitive_load += 0.2
            elif avg_ear > 0.35:
                cognitive_load += 0.1

            # Voice activity influence
            if voice > 10:
                cognitive_load += (min(voice, 100) / 100.0) * 0.3

            cognitive_load = max(0.0, min(1.0, cognitive_load))

            await websocket.send_json({
                "cognitiveLoadScore": float(cognitive_load),
                "status": "SUCCESS"
            })

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error in websocket loop: {e}")
