# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:20-slim AS frontend-builder

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
# libgomp1 is the OpenMP runtime LightGBM needs; curl is for the health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Run as an unprivileged user (uid 1000 is also what hosting platforms expect)
RUN useradd -m -u 1000 app

# Copy backend code, models, and reference data; the JSON stores in backend/data must be writable
COPY --chown=app:app backend/ /app/backend/

# Copy synthetic telemetry sample dataset (only small files permitted by .dockerignore)
COPY --chown=app:app dataset/ /app/dataset/

# Copy compiled frontend from builder
COPY --chown=app:app --from=frontend-builder /frontend/dist /app/frontend/dist

# Ensure /app/backend/data is writable by user app (uid 1000) in the image
RUN chmod -R u+rwX,g+rwX /app/backend/data

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

# Launch FastAPI via Uvicorn (shell form so that $PORT is expanded).
# --forwarded-allow-ips='*' was removed to prevent header spoofing.
# --proxy-headers is kept so Uvicorn honors X-Forwarded-Proto and X-Forwarded-For behind reverse proxies.
CMD uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers
