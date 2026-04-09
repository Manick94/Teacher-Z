FROM python:3.11-slim

# Install system dependencies for Pillow, SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the full application
COPY . .

# Create data directories
RUN mkdir -p data/datasets models

# Expose port (Render/Fly override via $PORT)
ENV PORT=8000
EXPOSE 8000

# Pre-download models at build time (optional — comment out to keep image small)
# RUN python scripts/download_models.py

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
