# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci --silent

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python Backend & Production Image
# ==========================================
FROM python:3.10-slim AS runner

WORKDIR /app

# Install curl for Docker healthcheck and essential tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Run as an unprivileged user (uid 1000 is also what hosting platforms expect)
RUN useradd -m -u 1000 app

# Copy backend code, models, and reference data; the JSON stores in backend/data must be writable
COPY --chown=app:app backend/ /app/backend/

# Copy compiled frontend from builder
COPY --chown=app:app --from=frontend-builder /frontend/dist /app/frontend/dist

USER app

# Environment configuration
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
# Hosting platforms (Render and similar) pass the port in $PORT; locally it is 8000.
ENV PORT=8000

EXPOSE 8000

# Health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Launch FastAPI via Uvicorn (shell form so that $PORT is expanded)
CMD uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}
