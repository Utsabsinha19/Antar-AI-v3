import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    clerk_id = Column(String(255), unique=True, nullable=True, index=True)
    full_name = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=True)
    auth_provider = Column(String(50), default="neon_auth")
    is_verified = Column(Boolean, default=False)
    avatar_url = Column(String(512), nullable=True)
    phone_number = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("SessionModel", back_populates="user")
    auth_sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")
    biometric_enclave = relationship("BiometricEnclave", back_populates="user", uselist=False, cascade="all, delete-orphan")
    reports = relationship("IntelligenceReport", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(String(100), default="Knowledge Worker")
    company = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    settings = Column(JSON, default=dict)
    baseline_metrics = Column(JSON, default=dict)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String(100), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, nullable=False, default=0)
    sample_count = Column(Integer, nullable=False, default=0)

    # Core AI Averaged Metrics
    average_engagement = Column(Float, nullable=False, default=0.0)
    average_attention_confidence = Column(Float, nullable=False, default=0.0)
    average_deep_focus = Column(Float, nullable=False, default=0.0)
    average_interaction_score = Column(Float, nullable=False, default=0.0)
    average_fatigue = Column(Float, nullable=False, default=0.0)
    average_boredom = Column(Float, nullable=False, default=0.0)

    status = Column(String(50), default="completed")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    telemetry = relationship("SessionTelemetry", back_populates="session", cascade="all, delete-orphan", order_by="SessionTelemetry.elapsed_seconds")
    insights = relationship("CognitiveInsight", back_populates="session", cascade="all, delete-orphan")
    reports = relationship("IntelligenceReport", back_populates="session", cascade="all, delete-orphan")


class SessionTelemetry(Base):
    __tablename__ = "session_telemetry"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(100), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    elapsed_seconds = Column(Integer, nullable=False, default=0)

    # Core AI Indices
    engagement = Column(Float, nullable=False, default=0.0)
    attention_confidence = Column(Float, nullable=False, default=0.0)
    deep_focus = Column(Float, nullable=False, default=0.0)
    interaction_score = Column(Float, nullable=False, default=0.0)
    cognitive_fatigue = Column(Float, nullable=False, default=0.0)
    boredom_index = Column(Float, nullable=False, default=0.0)

    # Biometric Telemetry
    ear = Column(Float, nullable=True)
    mar = Column(Float, nullable=True)
    voice_energy = Column(Float, nullable=True)
    eye_state = Column(String(50), nullable=True)
    cervical_angle = Column(Float, nullable=True)
    slump_ratio = Column(Float, nullable=True)
    is_slumping = Column(Boolean, nullable=True)
    raw_metrics = Column(JSON, default=dict)

    session = relationship("SessionModel", back_populates="telemetry")


class CognitiveInsight(Base):
    __tablename__ = "cognitive_insights"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(100), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # critical, warning, success, info
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    metric_value = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("SessionModel", back_populates="insights")


class EmailOTP(Base):
    __tablename__ = "email_otps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), nullable=False, index=True)
    otp_code = Column(String(255), nullable=False)
    otp_type = Column(String(50), nullable=False, default="SIGN_IN")  # SIGN_IN, SIGN_UP, PASSWORD_RESET
    expires_at = Column(DateTime, nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(512), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="auth_sessions")


class BiometricEnclave(Base):
    __tablename__ = "biometric_enclaves"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    encrypted_embedding = Column(Text, nullable=False)
    key_salt = Column(String(128), nullable=False)
    iv = Column(String(64), nullable=False)
    algorithm = Column(String(50), default="AES-GCM-256")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="biometric_enclave")


class IntelligenceReport(Base):
    __tablename__ = "intelligence_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(100), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    session_metadata = Column(JSON, default=dict)
    executive_summary = Column(JSON, default=dict)
    metric_summaries = Column(JSON, default=dict)
    temporal_analysis = Column(JSON, default=dict)
    key_findings = Column(JSON, default=list)
    event_timeline = Column(JSON, default=list)
    recommendations = Column(JSON, default=list)
    data_quality = Column(JSON, default=dict)
    methodology = Column(JSON, default=dict)
    version = Column(String(20), default="v2.0")
    status = Column(String(50), default="generated")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="reports")
    session = relationship("SessionModel", back_populates="reports")
