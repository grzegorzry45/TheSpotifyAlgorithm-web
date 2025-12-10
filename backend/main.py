"""
FastAPI Backend for Audio Playlist Analyzer
Web version of THE ALGORITHM
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from typing import List, Optional
import os
import shutil
import json
from pathlib import Path
import uuid
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

# Import database and models for authentication
import models, database, schemas, auth

# Import analysis modules
from core.audio_processor import AudioProcessor
from core.playlist_comparator import PlaylistComparator
from core.track_comparator import TrackComparator
from core.report_generator import ReportGenerator

app = FastAPI(title="The Algorithm", description="Decode Spotify's DNA")

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database initialization
@app.on_event("startup")
def on_startup():
    models.Base.metadata.create_all(bind=database.engine)

# AUTHENTICATION ENDPOINTS
@app.post("/auth/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = auth.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/auth/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)
):
    user = auth.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Get base directories
BASE_DIR = Path(__file__).parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# Create necessary directories
UPLOAD_DIR = BASE_DIR / "uploads"
REPORTS_DIR = BASE_DIR / "reports"
UPLOAD_DIR.mkdir(exist_ok=True)
REPORTS_DIR.mkdir(exist_ok=True)

# Initialize processors
audio_processor = AudioProcessor()

# In-memory storage for session data - THIS WILL BE REMOVED/REPLACED LATER
# sessions = {}

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the frontend"""
    frontend_path = FRONTEND_DIR / "index.html"
    if frontend_path.exists():
        return FileResponse(
            frontend_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {"message": "The Algorithm API is running. Frontend not found."}


@app.post("/api/upload/playlist")
async def upload_playlist(files: List[UploadFile] = File(...), current_user: models.User = Depends(auth.get_current_user)):
    """
    Upload playlist files for analysis
    Returns session_id for tracking
    """
    if len(files) < 2 or len(files) > 30:
        raise HTTPException(
            status_code=400,
            detail="Please upload 2-30 tracks for analysis"
        )

    # Create session
    session_id = str(uuid.uuid4())
    session_dir = UPLOAD_DIR / session_id / "playlist"
    session_dir.mkdir(parents=True, exist_ok=True)

    # Save files
    saved_files = []
    for file in files:
        if not file.filename.lower().endswith(('.mp3', '.wav', '.flac')):
            continue

        file_path = session_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_files.append(str(file_path))

    # TODO: Refactor session handling to be database-backed
    # For now, just return a session ID for tracking uploads within a single transaction
    return {
        "session_id": session_id,
        "files_uploaded": len(saved_files),
        "message": "Playlist files uploaded successfully"
    }

# ... (similar changes for other endpoints)