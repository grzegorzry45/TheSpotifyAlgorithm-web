FROM python:3.13-slim

# Install ffmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create necessary directories
RUN mkdir -p backend/uploads backend/reports

# Expose port (Fly.io will set PORT env var)
EXPOSE 8080

# Run the application
CMD cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
