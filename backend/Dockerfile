# backend/Dockerfile
# Purpose: Production-ready backend container with optimized Python setup
# Reduces server load: Multi-stage build, minimal dependencies, efficient startup
# Test: docker build -t backend .

FROM python:3.12-slim AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (suppress PATH warnings since we copy to different location)
COPY requirements.txt .
RUN pip install --no-cache-dir --user --no-warn-script-location -r requirements.txt

FROM python:3.12-slim

# Install runtime dependencies (including PostgreSQL client for wait script)
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser appuser

# Copy installed packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local

# Set up application directory
WORKDIR /app
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/static /app/media /app/logs \
    && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Add user's local bin to PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/healthz/ || exit 1

# Expose port
EXPOSE 8000

# Copy and set permissions for entrypoint script
COPY --chown=appuser:appuser start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Use entrypoint script
ENTRYPOINT ["/app/start.sh"]