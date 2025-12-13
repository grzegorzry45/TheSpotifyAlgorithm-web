import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use DATABASE_URL from environment if available, otherwise use SQLite
# For Railway deployment, set DATABASE_URL to PostgreSQL or use /tmp for SQLite
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # PostgreSQL or other database from environment
    if DATABASE_URL.startswith("postgres://"):
        # Fix for SQLAlchemy 1.4+ which requires postgresql:// instead of postgres://
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL)
else:
    # Local SQLite - store in /tmp for Railway ephemeral storage
    # This ensures write permissions work in containerized environments
    db_path = os.environ.get("DB_PATH", "./sql_app.db")
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"
    # connect_args is needed only for SQLite
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
