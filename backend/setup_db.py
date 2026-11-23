import sys
from datetime import datetime, timedelta
from database import engine, Base, SessionLocal, check_db_connection
import models
from sqlalchemy import inspect, text

def setup_database():
    print("=" * 60)
    print("🚀 Antar AI — Neon Lakebase Postgres Database Setup")
    print("=" * 60)

    # 1. Test Connection
    print("\n[1/4] Checking Database Connectivity...")
    conn_info = check_db_connection()
    if conn_info.get("status") != "connected":
        print(f"❌ Connection Failed: {conn_info.get('error')}")
        sys.exit(1)
    print(f"✅ Connected to Neon Lakebase Postgres! Server Version: {conn_info.get('version')}")

    # 2. Create Schema / Tables
    print("\n[2/4] Creating Tables (DDL Migration)...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Schema created successfully!")
    except Exception as e:
        print(f"❌ Error creating schema: {e}")
        sys.exit(1)

    # 3. Verify Created Tables
    print("\n[3/4] Verifying Table Existence...")
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    expected_tables = ["users", "user_profiles", "sessions", "session_telemetry", "cognitive_insights"]

    for table in expected_tables:
        if table in existing_tables:
            print(f"  ✓ Table '{table}' verified.")
        else:
            print(f"  ⚠ Table '{table}' missing.")

    # 4. Insert Verification Sample Session
    print("\n[4/4] Testing Write/Read Operations with Seed Data...")
    db = SessionLocal()
    try:
        sample_id = "session-test-init"
        existing = db.query(models.SessionModel).filter_by(id=sample_id).first()
        if not existing:
            now = datetime.utcnow()
            demo_session = models.SessionModel(
                id=sample_id,
                started_at=now - timedelta(minutes=25),
                ended_at=now,
                duration_seconds=1500,
                sample_count=120,
                average_engagement=84.5,
                average_attention_confidence=88.2,
                average_deep_focus=91.0,
                average_interaction_score=42.0,
                average_fatigue=12.5,
                average_boredom=8.0,
                status="completed",
                notes="Initial setup verification test session"
            )
            db.add(demo_session)

            demo_insight = models.CognitiveInsight(
                session_id=sample_id,
                type="success",
                title="Optimal Flow State Maintained",
                description="User maintained high deep focus (91%) throughout the session with minimal fatigue.",
                metric_value=91.0
            )
            db.add(demo_insight)
            db.commit()
            print("  ✓ Verification session record inserted.")
        else:
            print("  ✓ Verification session already exists.")

        # Read back
        session_count = db.query(models.SessionModel).count()
        print(f"  ✓ Total Sessions in Database: {session_count}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error in verification transaction: {e}")
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("🎉 CockroachDB Setup Complete! Database is Ready for Antar AI v3")
    print("=" * 60)

if __name__ == "__main__":
    setup_database()
