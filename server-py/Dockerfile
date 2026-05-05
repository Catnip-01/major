# Use an official Python runtime as a parent image
FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the port the app runs on
EXPOSE 3000

# Default command to run the FastAPI server
# (This will be overridden in docker-compose for the worker)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
