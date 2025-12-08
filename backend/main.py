"""
FastAPI Backend for Audio Playlist Analyzer
Web version of THE ALGORITHM
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from typing import List, Optional
import os
import shutil
import json
from pathlib import Path
import uuid

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

# In-memory storage for session data
sessions = {}


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
async def upload_playlist(files: List[UploadFile] = File(...)):
    """
    Upload playlist files for analysis
    Returns session_id for tracking
    """
    if len(files) < 15 or len(files) > 30:
        raise HTTPException(
            status_code=400,
            detail="Please upload 15-30 tracks for accurate analysis"
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
async def upload_user_tracks(session_id: str, files: List[UploadFile] = File(...)):
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
async def analyze_playlist(request: dict):
    """
    Analyze uploaded playlist and create sonic profile
    """
    session_id = request.get("session_id")
    additional_params = request.get("additional_params", [])

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    playlist_files = sessions[session_id]["playlist_files"]
    if not playlist_files:
        raise HTTPException(status_code=400, detail="No playlist files found")

    # Analyze all tracks
    results = []
    errors = []

    for i, file_path in enumerate(playlist_files):
        try:
            features = audio_processor.analyze_file(file_path, additional_params=additional_params)
            if features:
                features['filename'] = Path(file_path).name
                results.append(features)
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

    return {
        "tracks_analyzed": len(results),
        "errors": errors,
        "profile": profile,
        "message": "Playlist analysis complete"
    }


@app.post("/api/compare/batch")
async def compare_batch(request: dict):
    """
    Compare user tracks against playlist profile
    Returns recommendations for all tracks
    """
    session_id = request.get("session_id")
    additional_params = request.get("additional_params", [])

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]

    if not session.get("playlist_profile"):
        raise HTTPException(
            status_code=400,
            detail="Please analyze playlist first"
        )

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
    comparator = PlaylistComparator(session["playlist_analysis"])
    recommendations = []

    for track in user_results:
        comparison = comparator.compare_track(track)
        recommendations.append({
            "filename": track["filename"],
            "comparison": comparison,
            "recommendations": comparator.generate_recommendations(comparison)
        })

    session["recommendations"] = recommendations

    return {
        "tracks_compared": len(recommendations),
        "recommendations": recommendations
    }


@app.post("/api/compare/single")
async def compare_single(
    mode: str,
    user_track: UploadFile = File(...),
    reference_track: Optional[UploadFile] = File(None),
    session_id: Optional[str] = None,
    additional_params: Optional[str] = None
):
    """
    Compare single track vs playlist or vs another track
    Modes: 'playlist' or 'track'
    """
    # Parse additional parameters if provided
    params_list = []
    if additional_params:
        try:
            params_list = json.loads(additional_params)
        except json.JSONDecodeError:
            params_list = []

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

        comparator = PlaylistComparator(session["playlist_analysis"])
        comparison = comparator.compare_track(user_features)
        recommendations = comparator.generate_recommendations(comparison)

        return {
            "mode": "playlist",
            "user_track": user_features,
            "playlist_profile": session["playlist_profile"],
            "comparison": comparison,
            "recommendations": recommendations
        }

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
        track_comparator = TrackComparator(ref_features)
        recommendations = track_comparator.compare_track(user_features)

        return {
            "mode": "track",
            "user_track": user_features,
            "reference_track": ref_features,
            "comparison": recommendations,  # compare_track already returns recommendations
            "recommendations": recommendations
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid mode. Use 'playlist' or 'track'")


@app.post("/api/report/generate")
async def generate_report(session_id: str):
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
async def download_report(session_id: str):
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


@app.delete("/api/session/{session_id}")
async def cleanup_session(session_id: str):
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
