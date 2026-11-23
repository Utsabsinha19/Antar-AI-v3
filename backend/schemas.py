from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# Telemetry Data Point
class TelemetryPointSchema(BaseModel):
    elapsed_seconds: int = 0
    engagement: float = 0.0
    attention_confidence: float = 0.0
    deep_focus: float = 0.0
    interaction_score: float = 0.0
    cognitive_fatigue: float = 0.0
    boredom_index: float = 0.0
    ear: Optional[float] = None
    mar: Optional[float] = None
    voice_energy: Optional[float] = None
    eye_state: Optional[str] = None
    cervical_angle: Optional[float] = None
    slump_ratio: Optional[float] = None
    is_slumping: Optional[bool] = None
    raw_metrics: Optional[Dict[str, Any]] = None

# Insight Schema
class InsightSchema(BaseModel):
    id: Optional[str] = None
    type: str  # critical, warning, success, info
    title: str
    description: str
    value: Optional[float] = None

# Session Ingestion Request
class SessionCreateSchema(BaseModel):
    id: str
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    sample_count: int
    average_engagement: float
    average_attention_confidence: float
    average_deep_focus: float
    average_interaction_score: float
    average_fatigue: float
    average_boredom: float
    user_id: Optional[str] = None
    notes: Optional[str] = None
    timeline: Optional[List[TelemetryPointSchema]] = None
    insights: Optional[List[InsightSchema]] = None

# Session Response
class SessionResponseSchema(BaseModel):
    id: str
    user_id: Optional[str]
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    sample_count: int
    average_engagement: float
    average_attention_confidence: float
    average_deep_focus: float
    average_interaction_score: float
    average_fatigue: float
    average_boredom: float
    status: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Health Response
class HealthResponseSchema(BaseModel):
    status: str
    database: Dict[str, Any]
    timestamp: datetime

# OTP & Authentication Schemas
class OTPRequestSchema(BaseModel):
    email: str
    type: Optional[str] = "SIGN_IN"

class OTPVerifySchema(BaseModel):
    email: str
    otp_code: str
    full_name: Optional[str] = None
    role: Optional[str] = "Knowledge Worker"

class ClerkUserSyncSchema(BaseModel):
    clerk_id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = "Knowledge Worker"

class PasswordAuthSchema(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class AuthResponseSchema(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    token: Optional[str] = None
    cooldown_seconds: Optional[int] = None
    expires_in_seconds: Optional[int] = None

# =====================================================================
# Biometric Enclave Schemas (ISO/IEC 19794 & 30107 Standards Compliant)
# =====================================================================

class BiometricEnrollRequestSchema(BaseModel):
    model_config = {"protected_namespaces": ()}
    encrypted_embedding: str
    key_salt: str
    iv: str
    algorithm: Optional[str] = "AES-GCM-256"
    model_version: Optional[str] = "MediaPipe-FaceLandmarker-478D-Manifold"
    quality_score: Optional[float] = None
    liveness_score: Optional[float] = None
    sample_count: Optional[int] = 45

class BiometricStatusResponseSchema(BaseModel):
    model_config = {"protected_namespaces": ()}
    is_enrolled: bool
    user_id: Optional[str] = None
    enrolled_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    algorithm: Optional[str] = None
    model_version: Optional[str] = None
    key_salt: Optional[str] = None
    iv: Optional[str] = None
    encrypted_embedding: Optional[str] = None

class BiometricVerifyRequestSchema(BaseModel):
    candidate_embedding: List[float]
    threshold: Optional[float] = 0.72

class BiometricVerifyResponseSchema(BaseModel):
    verified: bool
    similarity_score: float
    threshold: float
    user_id: Optional[str] = None
    timestamp: datetime

class BiometricDeleteResponseSchema(BaseModel):
    success: bool


# =====================================================================
# Comprehensive Intelligence Report Schemas (Antar AI v2.0)
# =====================================================================

class ReportGenerateRequestSchema(BaseModel):
    session_id: str
    title: Optional[str] = None
    force_regenerate: Optional[bool] = False
    device_info: Optional[Dict[str, Any]] = None

class ReportListItemSchema(BaseModel):
    id: str
    report_id: str
    session_id: str
    title: str
    session_date: datetime
    duration_seconds: int
    overall_engagement: float
    overall_attention: float
    overall_fatigue: float
    status: str
    created_at: datetime

class ReportDetailResponseSchema(BaseModel):
    id: str
    report_id: str
    user_id: str
    session_id: str
    title: str
    session_metadata: Dict[str, Any]
    executive_summary: Dict[str, Any]
    metric_summaries: Dict[str, Any]
    temporal_analysis: Dict[str, Any]
    key_findings: List[Dict[str, Any]]
    event_timeline: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    data_quality: Dict[str, Any]
    methodology: Dict[str, Any]
    version: str
    status: str
    created_at: datetime
    updated_at: datetime
    user_name: Optional[str] = None
    user_email: Optional[str] = None

class ReportCompareRequestSchema(BaseModel):
    current_report_id: str
    previous_report_id: str

class ReportComparisonResponseSchema(BaseModel):
    current_report_id: str
    previous_report_id: str
    delta_metrics: Dict[str, Any]
    comparative_summary: str
    trend_analysis: List[Dict[str, Any]]
