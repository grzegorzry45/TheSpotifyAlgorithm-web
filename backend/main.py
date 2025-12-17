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
from core.playlist_gatekeeper import PlaylistGatekeeper

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

# In-memory storage for session data - TODO: Move to database later
sessions = {}

# CREDIT MANAGEMENT CONSTANTS
ANALYSIS_COST = 100  # Cost per analysis in credits

# Helper functions for credit management
def check_credits(user: models.User, cost: int):
    """Check if user has enough credits"""
    if user.credits < cost:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail=f"Not enough credits. Need {cost}, have {user.credits}"
        )

def deduct_credits(user: models.User, cost: int, db: Session, description: str):
    """Deduct credits from user and log transaction"""
    user.credits -= cost

    # Log transaction
    transaction = models.CreditTransaction(
        user_id=user.id,
        amount=-cost,
        transaction_type="analysis_cost",
        description=description
    )
    db.add(transaction)
    db.commit()
    db.refresh(user)

@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the landing page for logged-out users"""
    frontend_path = FRONTEND_DIR / "landing.html"
    if frontend_path.exists():
        return FileResponse(
            frontend_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {"message": "The Algorithm API is running. Landing page not found."}


@app.get("/wizard", response_class=HTMLResponse)
async def wizard():
    """Serve the main wizard interface"""
    frontend_path = FRONTEND_DIR / "index-wizard.html"
    if frontend_path.exists():
        return FileResponse(
            frontend_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {"message": "Wizard interface not found."}


@app.get("/classic", response_class=HTMLResponse)
async def classic():
    """Serve the original 4-tab interface"""
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
    return {"message": "Classic interface not found."}


@app.post("/api/upload/playlist")
async def upload_playlist(
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
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

    # Initialize session
    sessions[session_id] = {
        "playlist_files": saved_files,
        "user_files": [],
        "playlist_profile": None
    }

    return {
        "session_id": session_id,
        "files_uploaded": len(saved_files),
        "message": "Playlist files uploaded successfully"
    }


@app.post("/api/upload/user-tracks")
async def upload_user_tracks(
    files: List[UploadFile] = File(...),
    session_id: str = Form(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Upload user tracks for comparison
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session_dir = UPLOAD_DIR / session_id / "user_tracks"
    session_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    for file in files:
        if not file.filename.lower().endswith(('.mp3', '.wav', '.flac')):
            continue

        file_path = session_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_files.append(str(file_path))

    sessions[session_id]["user_files"] = saved_files

    return {
        "files_uploaded": len(saved_files),
        "message": "User tracks uploaded successfully"
    }


@app.post("/api/analyze/playlist")
async def analyze_playlist(
    request: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Analyze uploaded playlist and create sonic profile
    Cost: 100 credits per analysis
    """
    session_id = request.get("session_id")
    additional_params = request.get("additional_params", [])

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    playlist_files = sessions[session_id]["playlist_files"]
    if not playlist_files:
        raise HTTPException(status_code=400, detail="No playlist files found")

    # Validate that parameters are selected
    if not additional_params or len(additional_params) == 0:
        raise HTTPException(
            status_code=400,
            detail="Please select at least one parameter to analyze"
        )

    # Check credits BEFORE analysis
    check_credits(current_user, ANALYSIS_COST)

    # Analyze all tracks
    results = []
    errors = []

    for i, file_path in enumerate(playlist_files):
        try:
            features = audio_processor.analyze_file(file_path, additional_params=additional_params)
            if features:
                features['filename'] = Path(file_path).name
                results.append(features)
            else:
                errors.append(f"{Path(file_path).name}: No parameters selected")
        except Exception as e:
            errors.append(f"{Path(file_path).name}: {str(e)}")

    if not results:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze any tracks. Errors: {errors}"
        )

    # Create playlist profile
    comparator = PlaylistComparator(results)
    profile = comparator.get_playlist_profile()

    # Store in session
    sessions[session_id]["playlist_profile"] = profile
    sessions[session_id]["playlist_analysis"] = results

    # Deduct credits AFTER successful analysis
    deduct_credits(
        current_user,
        ANALYSIS_COST,
        db,
        f"Playlist analysis: {len(results)} tracks"
    )

    return {
        "tracks_analyzed": len(results),
        "errors": errors,
        "profile": profile,
        "credits_remaining": current_user.credits,
        "message": "Playlist analysis complete"
    }


@app.post("/api/compare/batch")
async def compare_batch(
    request: dict,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Compare user tracks against playlist profile
    Returns recommendations for all tracks
    Cost: 100 credits per analysis
    """
    session_id = request.get("session_id")
    additional_params = request.get("additional_params", [])

    # Validate that parameters are selected
    if not additional_params or len(additional_params) == 0:
        raise HTTPException(
            status_code=400,
            detail="Please select at least one parameter to analyze"
        )

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]

    if not session.get("playlist_profile"):
        raise HTTPException(
            status_code=400,
            detail="Please analyze playlist first"
        )

    # Check credits BEFORE analysis
    check_credits(current_user, ANALYSIS_COST)

    user_files = session.get("user_files", [])
    if not user_files:
        raise HTTPException(status_code=400, detail="No user tracks uploaded")

    # Analyze user tracks with additional parameters
    user_results = []
    for file_path in user_files:
        try:
            features = audio_processor.analyze_file(file_path, additional_params=additional_params)
            if features:
                features['filename'] = Path(file_path).name
                user_results.append(features)
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")

    # Compare against playlist
    comparator = PlaylistComparator(
        session.get("playlist_analysis"),
        existing_profile=session.get("playlist_profile")
    )
    recommendations = []

    for track in user_results:
        comparison = comparator.compare_track(track)
        recommendations.append({
            "filename": track["filename"],
            "comparison": comparison,
            "recommendations": comparator.generate_recommendations(comparison)
        })

    session["recommendations"] = recommendations

    # Deduct credits AFTER successful comparison
    deduct_credits(
        current_user,
        ANALYSIS_COST,
        db,
        f"Batch comparison: {len(recommendations)} tracks"
    )

    return {
        "tracks_compared": len(recommendations),
        "recommendations": recommendations,
        "credits_remaining": current_user.credits
    }


@app.post("/api/compare/single")
async def compare_single(
    mode: str = Form(...),
    user_track: UploadFile = File(...),
    reference_track: Optional[UploadFile] = File(None),
    session_id: Optional[str] = Form(None),
    additional_params: Optional[str] = Form(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Compare single track vs playlist or vs another track
    Modes: 'playlist' or 'track'
    Cost: 100 credits per analysis
    """
    # Parse additional parameters if provided
    params_list = []
    if additional_params:
        try:
            params_list = json.loads(additional_params)
            print(f"DEBUG: Received additional_params: {additional_params}")
            print(f"DEBUG: Parsed params_list: {params_list}")
        except json.JSONDecodeError:
            print(f"DEBUG: Failed to parse additional_params: {additional_params}")
            params_list = []
    else:
        print(f"DEBUG: No additional_params received")

    # Validate that parameters are selected
    if not params_list or len(params_list) == 0:
        raise HTTPException(
            status_code=400,
            detail="Please select at least one parameter to analyze"
        )

    # Check credits BEFORE analysis
    check_credits(current_user, ANALYSIS_COST)

    # For track mode, create temporary session if needed
    if mode == "track":
        if not session_id or session_id == "null":
            session_id = str(uuid.uuid4())

    # For playlist mode, require existing session
    if mode == "playlist":
        if not session_id or session_id == "null" or session_id not in sessions:
            raise HTTPException(status_code=400, detail="Please analyze playlist first")
        session = sessions[session_id]

    # Save user track
    session_dir = UPLOAD_DIR / session_id / "single_compare"
    session_dir.mkdir(parents=True, exist_ok=True)

    user_path = session_dir / f"user_{user_track.filename}"
    with open(user_path, "wb") as buffer:
        shutil.copyfileobj(user_track.file, buffer)

    # Analyze user track with additional parameters
    user_features = audio_processor.analyze_file(str(user_path), additional_params=params_list)
    if not user_features:
        raise HTTPException(status_code=500, detail="Failed to analyze user track")

    user_features['filename'] = user_track.filename

    if mode == "playlist":
        # Compare vs playlist profile
        session = sessions.get(session_id)
        if not session or not session.get("playlist_profile"):
            raise HTTPException(
                status_code=400,
                detail="Please analyze playlist first"
            )

        try:
            comparator = PlaylistComparator(
                session.get("playlist_analysis"),
                existing_profile=session.get("playlist_profile")
            )
            comparison = comparator.compare_track(user_features)
            recommendations = comparator.generate_recommendations(comparison)

            # Deduct credits AFTER successful comparison
            deduct_credits(
                current_user,
                ANALYSIS_COST,
                db,
                f"Single comparison (playlist mode): {user_features.get('filename', 'unknown')}"
            )

            return {
                "mode": "playlist",
                "user_track": user_features,
                "playlist_profile": session["playlist_profile"],
                "comparison": comparison,
                "recommendations": recommendations,
                "credits_remaining": current_user.credits
            }
        except Exception as e:
            print(f"Error during playlist comparison: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Playlist comparison failed: {str(e)}"
            )

    elif mode == "track":
        # Compare vs reference track
        if not reference_track:
            raise HTTPException(
                status_code=400,
                detail="Reference track required for 1:1 comparison"
            )

        # Save reference track
        ref_path = session_dir / f"ref_{reference_track.filename}"
        with open(ref_path, "wb") as buffer:
            shutil.copyfileobj(reference_track.file, buffer)

        # Analyze reference track with additional parameters
        ref_features = audio_processor.analyze_file(str(ref_path), additional_params=params_list)
        if not ref_features:
            raise HTTPException(
                status_code=500,
                detail="Failed to analyze reference track"
            )

        ref_features['filename'] = reference_track.filename

        # Compare tracks (TrackComparator needs reference track in __init__)
        try:
            track_comparator = TrackComparator(ref_features)
            recommendations = track_comparator.compare_track(user_features)

            # Deduct credits AFTER successful comparison
            deduct_credits(
                current_user,
                ANALYSIS_COST,
                db,
                f"Single comparison (1:1 mode): {user_features.get('filename', 'unknown')} vs {ref_features.get('filename', 'unknown')}"
            )

            return {
                "mode": "track",
                "user_track": user_features,
                "reference_track": ref_features,
                "comparison": recommendations,  # compare_track already returns recommendations
                "recommendations": recommendations,
                "credits_remaining": current_user.credits
            }
        except Exception as e:
            print(f"Error during track comparison: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=500,
                detail=f"Track comparison failed: {str(e)}"
            )

    else:
        raise HTTPException(status_code=400, detail="Invalid mode. Use 'playlist' or 'track'")


@app.post("/api/report/generate")
async def generate_report(
    session_id: str,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Generate HTML report with all recommendations
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    recommendations = session.get("recommendations", [])

    if not recommendations:
        raise HTTPException(
            status_code=400,
            detail="No recommendations available. Run comparison first."
        )

    # Generate report
    report_gen = ReportGenerator()
    report_html = report_gen.generate_report(
        session.get("playlist_profile"),
        recommendations
    )

    # Save report
    report_path = REPORTS_DIR / f"{session_id}_report.html"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_html)

    return {
        "report_url": f"/api/report/download/{session_id}",
        "message": "Report generated successfully"
    }


@app.get("/api/report/download/{session_id}")
async def download_report(
    session_id: str,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Download generated report
    """
    report_path = REPORTS_DIR / f"{session_id}_report.html"

    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Report not found")

    return FileResponse(
        report_path,
        media_type="text/html",
        filename=f"algorithm_report_{session_id[:8]}.html"
    )


@app.post("/api/preset/load")
async def load_preset(
    request: dict,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Load preset data from frontend localStorage into backend session
    This allows comparing tracks against saved presets
    """
    profile = request.get("profile")
    analysis = request.get("analysis", [])

    if not profile:
        raise HTTPException(status_code=400, detail="No profile data provided")

    # Create new session with preset data
    session_id = "preset_" + str(uuid.uuid4())

    # Check if this is a Gatekeeper preset
    preset_mode = None
    gatekeeper_obj = None

    if isinstance(profile, dict) and profile.get("mode") == "gatekeeper":
        preset_mode = "gatekeeper"

        # Recreate Gatekeeper object from preset data
        playlist_features = profile.get("tracks", [])
        if not playlist_features:
            raise HTTPException(
                status_code=400,
                detail="Gatekeeper preset has no playlist features"
            )

        try:
            gatekeeper_obj = PlaylistGatekeeper()
            success = gatekeeper_obj.fit_playlist(playlist_features)
            if not success:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to fit Gatekeeper model from preset"
                )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Gatekeeper from preset: {str(e)}"
            )

    session_data = {
        "playlist_files": [],
        "user_files": [],
        "playlist_profile": profile,
        "playlist_analysis": analysis
    }

    # Set mode and gatekeeper object if it's a Gatekeeper preset
    if preset_mode:
        session_data["mode"] = preset_mode
        session_data["playlist_features"] = profile.get("tracks", [])
        session_data["gatekeeper"] = gatekeeper_obj

    sessions[session_id] = session_data

    return {
        "session_id": session_id,
        "message": "Preset loaded successfully"
    }


# GATEKEEPER (AI MODE) ENDPOINTS

@app.post("/api/gatekeeper/analyze-playlist")
async def gatekeeper_analyze_playlist(
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Analyze playlist using Gatekeeper (Golden 8 only)
    Cost: 100 credits per analysis
    """
    if len(files) < 2 or len(files) > 30:
        raise HTTPException(
            status_code=400,
            detail="Please upload 2-30 tracks for Gatekeeper analysis"
        )

    # Check credits BEFORE analysis
    check_credits(current_user, ANALYSIS_COST)

    # Create session
    session_id = str(uuid.uuid4())
    session_dir = UPLOAD_DIR / session_id / "gatekeeper_playlist"
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

    if not saved_files:
        raise HTTPException(status_code=400, detail="No valid audio files uploaded")

    # Extract Golden 8 from all tracks
    gatekeeper = PlaylistGatekeeper()
    playlist_features = []
    errors = []

    for file_path in saved_files:
        try:
            features = gatekeeper.extract_golden_8(file_path)
            if features:
                features['filename'] = Path(file_path).name
                playlist_features.append(features)
            else:
                errors.append(f"{Path(file_path).name}: Failed to extract features")
        except Exception as e:
            errors.append(f"{Path(file_path).name}: {str(e)}")

    if not playlist_features:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze any tracks. Errors: {errors}"
        )

    # Fit gatekeeper model
    success = gatekeeper.fit_playlist(playlist_features)
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to create playlist profile"
        )

    # Store in session
    sessions[session_id] = {
        "mode": "gatekeeper",
        "playlist_features": playlist_features,
        "gatekeeper": gatekeeper
    }

    # Deduct credits AFTER successful analysis
    deduct_credits(
        current_user,
        ANALYSIS_COST,
        db,
        f"Gatekeeper playlist analysis: {len(playlist_features)} tracks"
    )

    return {
        "session_id": session_id,
        "tracks_analyzed": len(playlist_features),
        "errors": errors,
        "playlist_features": playlist_features,
        "credits_remaining": current_user.credits,
        "message": "Gatekeeper playlist analysis complete"
    }


@app.post("/api/gatekeeper/check")
async def gatekeeper_check_track(
    user_track: UploadFile = File(...),
    session_id: str = Form(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Check user track against Gatekeeper playlist
    Returns LLM prompt for copy-paste into ChatGPT/Claude
    Cost: 100 credits per check
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]

    if session.get("mode") != "gatekeeper":
        raise HTTPException(
            status_code=400,
            detail="Session is not in Gatekeeper mode"
        )

    # Check credits BEFORE analysis
    check_credits(current_user, ANALYSIS_COST)

    # Save user track
    session_dir = UPLOAD_DIR / session_id / "user_track"
    session_dir.mkdir(parents=True, exist_ok=True)

    user_path = session_dir / user_track.filename
    with open(user_path, "wb") as buffer:
        shutil.copyfileobj(user_track.file, buffer)

    # Extract Golden 8 from user track
    gatekeeper = session["gatekeeper"]

    try:
        user_features = gatekeeper.extract_golden_8(str(user_path))
        if not user_features:
            raise HTTPException(
                status_code=500,
                detail="Failed to extract features from user track"
            )

        user_features['filename'] = user_track.filename

        # Check track against playlist
        result = gatekeeper.check_track(user_features)

        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        # Deduct credits AFTER successful check
        deduct_credits(
            current_user,
            ANALYSIS_COST,
            db,
            f"Gatekeeper track check: {user_track.filename}"
        )

        return {
            "session_id": session_id,
            "user_filename": user_track.filename,
            "user_features": result["user_features"],
            "nearest_reference": result["nearest_reference"],
            "weighted_z_scores": result["weighted_z_scores"],
            "critical_alerts": result["critical_alerts"],
            "llm_prompt": result["llm_prompt"],
            "credits_remaining": current_user.credits
        }

    except Exception as e:
        print(f"Error in gatekeeper check: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Gatekeeper check failed: {str(e)}"
        )


# CREDIT MANAGEMENT ENDPOINTS

@app.get("/api/credits/balance", response_model=schemas.CreditsBalance)
async def get_credits_balance(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get current user's credit balance"""
    return {"credits": current_user.credits}


@app.post("/api/credits/redeem", response_model=schemas.CouponRedeemResponse)
async def redeem_coupon(
    request: schemas.CouponRedeemRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Redeem a coupon code to add credits to user account
    """
    code = request.code.upper().strip()

    # Find coupon
    coupon = db.query(models.Coupon).filter(
        models.Coupon.code == code
    ).first()

    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")

    # Validate: Is active?
    if not coupon.is_active:
        raise HTTPException(status_code=400, detail="This coupon is no longer active")

    # Validate: Not expired?
    if coupon.expires_at:
        from datetime import datetime
        if coupon.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="This coupon has expired")

    # Validate: Not over max uses?
    if coupon.max_uses and coupon.current_uses >= coupon.max_uses:
        raise HTTPException(status_code=400, detail="This coupon has been fully redeemed")

    # Validate: User hasn't used this coupon before?
    existing = db.query(models.CouponRedemption).filter(
        models.CouponRedemption.coupon_id == coupon.id,
        models.CouponRedemption.user_id == current_user.id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already used this coupon"
        )

    # All checks passed - Add credits
    current_user.credits += coupon.credits
    coupon.current_uses += 1

    # Log redemption
    redemption = models.CouponRedemption(
        coupon_id=coupon.id,
        user_id=current_user.id,
        credits_added=coupon.credits
    )
    db.add(redemption)

    # Log transaction
    transaction = models.CreditTransaction(
        user_id=current_user.id,
        amount=coupon.credits,
        transaction_type="coupon_redeemed",
        description=f"Redeemed coupon: {coupon.code}"
    )
    db.add(transaction)

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "credits_added": coupon.credits,
        "new_balance": current_user.credits,
        "message": f"Success! Added {coupon.credits} credits to your account"
    }


@app.delete("/api/session/{session_id}")
async def cleanup_session(
    session_id: str,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Clean up session data
    """
    if session_id in sessions:
        # Delete uploaded files
        session_dir = UPLOAD_DIR / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir)

        # Remove from memory
        del sessions[session_id]

        return {"message": "Session cleaned up successfully"}

    raise HTTPException(status_code=404, detail="Session not found")


# PRESET MANAGEMENT ENDPOINTS

@app.post("/api/presets", response_model=schemas.Preset)
def create_preset(
    preset: schemas.PresetCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_preset = models.Preset(**preset.dict(), owner_id=current_user.id)
    db.add(db_preset)
    db.commit()
    db.refresh(db_preset)
    return db_preset

@app.get("/api/presets", response_model=List[schemas.Preset])
def read_presets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    presets = db.query(models.Preset).filter(models.Preset.owner_id == current_user.id).offset(skip).limit(limit).all()
    return presets

@app.delete("/api/presets/{preset_id}")
def delete_preset(
    preset_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_preset = db.query(models.Preset).filter(models.Preset.id == preset_id, models.Preset.owner_id == current_user.id).first()
    if not db_preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    db.delete(db_preset)
    db.commit()
    return {"message": "Preset deleted successfully"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "The Algorithm API"}


@app.get("/api/test")
async def test_endpoint():
    """Simple test endpoint - no processing"""
    return {
        "status": "success",
        "message": "Backend is working!",
        "timestamp": "2025-12-06",
        "test": "passed"
    }


@app.post("/api/test-upload")
async def test_upload(file: UploadFile = File(...)):
    """Test file upload without processing"""
    return {
        "status": "success",
        "filename": file.filename,
        "content_type": file.content_type,
        "size_kb": len(await file.read()) / 1024,
        "message": "File received successfully (not analyzed)"
    }


# Mount static files for frontend
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)