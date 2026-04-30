# Use official Python runtime as base image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for spaCy
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better Docker caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download German spaCy model
RUN python -m spacy download de_core_news_sm

# Copy application code
COPY . .

# Expose port (Render will override this with $PORT)
EXPOSE 8000

# Run the application
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
