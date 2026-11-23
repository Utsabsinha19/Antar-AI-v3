import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables
load_dotenv()

# Database connection URL resolver (Neon Lakebase Postgres & CockroachDB support)
raw_db_url = os.getenv("DATABASE_URL", "").strip('"\'')

if "cockroachlabs.cloud" in raw_db_url:
    if raw_db_url.startswith("postgresql://"):
        SQLALCHEMY_DATABASE_URL = raw_db_url.replace("postgresql://", "cockroachdb://", 1)
    else:
        SQLALCHEMY_DATABASE_URL = raw_db_url
else:
    # Standard PostgreSQL (Neon Lakebase Postgres) using psycopg2 driver
    if raw_db_url.startswith("postgresql://"):
        SQLALCHEMY_DATABASE_URL = raw_db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    else:
        SQLALCHEMY_DATABASE_URL = raw_db_url

# Ensure sslmode=require for secure cloud connections
if "sslmode=" not in SQLALCHEMY_DATABASE_URL:
    delimiter = "&" if "?" in SQLALCHEMY_DATABASE_URL else "?"
    SQLALCHEMY_DATABASE_URL += f"{delimiter}sslmode=require"

# Create Engine with connection pool
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db_connection() -> dict:
    try:
        with engine.connect() as conn:
            res = conn.execute(text("SELECT version();")).scalar()
            return {"status": "connected", "version": str(res)}
    except Exception as e:
        return {"status": "error", "error": str(e)}
