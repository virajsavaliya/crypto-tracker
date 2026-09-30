# VoluSignal — System Documentation

**Last Updated:** 2026-05-26

**Purpose:** This document provides a concise, practical reference for developers and operators working with the VoluSignal crypto trading dashboard repository.

**How to use this document**
- Read **Overview** to understand components and responsibilities.
- Follow **Local development** to run the stack locally.
- See **Deployment** for Docker-based production instructions.
- Use **References** to quickly locate important source files.

**Overview**
- **What it is:** A full-stack crypto dashboard: Django backend (REST + WebSockets) and Next.js frontend.
- **Primary responsibilities:** ingest live market data, compute alerts and metrics, serve realtime updates to the dashboard and notify via Telegram/Email.

**Architecture**
- **Backend**: Django project in [backend/](backend/). Provides REST API, WebSocket consumers, Celery tasks, and integration with Redis and Postgres.
- **Frontend**: Next.js application in [frontend/](frontend/). UI for charts, alerts, and account management.
- **Realtime**: Binance websocket client and rate-limiter live in [core/](core/) inside the backend.
- **Queue & cache**: Redis is used for Celery broker and caching/streams.
- **DB**: PostgreSQL for persistent data and Django migrations.
- **Reverse proxy**: Nginx config in [nginx/](nginx/) for SSL and routing.

**Key Components & Files**
- **Backend entry point**: [backend/manage.py](backend/manage.py)
- **Backend settings & WSGI/ASGI**: [project_config/settings.py](project_config/settings.py), [project_config/asgi.py](project_config/asgi.py)
- **WebSocket / Realtime logic**: [core/binance_ws_client.py](core/binance_ws_client.py), [core/binance_realtime.py](core/binance_realtime.py)
- **API routing & views**: [core/routing.py](core/routing.py), [core/views.py](core/views.py)
- **Serializers & models**: [core/serializers.py](core/serializers.py), [core/models.py](core/models.py)
- **Celery config**: [project_config/celery.py](project_config/celery.py)
- **Frontend app root**: [frontend/src/app](frontend/src/app)
- **Docker compose**: [docker-compose.yml](docker-compose.yml)

**Environment & Secrets**
- Sensitive values must never be committed. Use an env file or secret management.
- Example `.env` keys (DO NOT commit actual values):

```bash
DEBUG=True
SECRET_KEY=your-secret-key
DB_HOST=db
DB_PORT=5432
DB_NAME=crypto_tracker_db
DB_USER=postgres
DB_PASSWORD=postgres_password_here
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
ALLOWED_HOSTS=yourdomain.com,localhost
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
EMAIL_HOST_USER=you@example.com
EMAIL_HOST_PASSWORD=supersecret
TELEGRAM_BOT_TOKEN=telegram_bot_token_here
```

- For local development copy `backend/.env` into `backend/.env.local` (or similar) and replace secrets with safe values.

**Local Development**
- Prerequisites: `docker`, `docker-compose`, Node >= 18, Python 3.11+ recommended.

- Start full stack with Docker (recommended):

```bash
docker-compose up -d
docker-compose ps
docker-compose logs -f
```

- Backend development (without Docker):

```bash
# from repo root
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# set environment variables (use a .env file loader or export)
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

- Run Celery worker and beat (local):

```bash
# from backend/
celery -A project_config worker -l info
celery -A project_config beat -l info
```

- Frontend development:

```bash
cd frontend
npm install
npm run dev
# or with Docker compose the service is named `frontend`
```

**Running tests & migrations**
- Django migrations are in [backend/core/migrations/](backend/core/migrations/).
- Run tests with Django test runner:

```bash
cd backend
python manage.py test
```

**Deployment**
- The repo includes Dockerfiles for backend and frontend, plus `docker-compose.yml` and `docker-compose.local.yml` for local vs production composition.
- Typical deployment flow:
  - Build images: `docker-compose build`
  - Start services: `docker-compose up -d`
  - Run DB migrations: `docker-compose exec backend python manage.py migrate`
- Nginx config for SSL: [nginx/ssl_nginx.conf](nginx/ssl_nginx.conf)

**Operational Notes**
- Auto-repair and maintenance scripts are in [scripts/](scripts/). See `scripts/auto-repair.sh` and `AUTOMATION_GUIDE.md`.
- Logs: use `docker-compose logs -f` or per-service `docker-compose logs -f backend`.
- Health checks and monitoring: the project uses self-healing routines (see `AUTOMATION_GUIDE.md`).

**Security & Privacy**
- Regenerate `SECRET_KEY` for production; never use the dev key in production.
- Rotate `TELEGRAM_BOT_TOKEN` and email passwords if exposed.
- Use a secrets manager (Vault, AWS Secrets Manager, or Docker secrets) in production.

**Troubleshooting**
- Redis connection errors: ensure `REDIS_URL` points to the right host/port and Redis container is healthy.
- Celery tasks not executing: confirm broker URL and that a worker process is running.
- Websocket disconnects: inspect `core/binance_ws_client.py` and check rate-limiter logs in `core/rate_limiter.py`.

**Where to look next (quick links)**
- App entry: [backend/manage.py](backend/manage.py)
- Backend settings: [project_config/settings.py](project_config/settings.py)
- Websocket code: [core/binance_ws_client.py](core/binance_ws_client.py)
- Frontend app: [frontend/src/app/page.tsx](frontend/src/app/page.tsx)
- Docs folder: [docs/](docs/README.md)

**Contributing**
- Fork the repo, create a branch, and open a PR with tests for changes.
- Keep secrets out of PRs. Use environment variables for configuration.

---
**Features**

- **Realtime market ingestion**: continuous Binance websocket ingest with a rate-limiter to ensure stability and low-latency updates.
- **Hybrid API + WebSockets**: REST endpoints for CRUD and WebSocket channels for live updates to the UI.
- **Alerting engine**: configurable alert rules, top-100 alerts, and telegram/email delivery hooks.
- **Extensible Celery tasks**: background jobs for data processing, enrichment, and scheduled checks.
- **Self-healing automation**: scripts and monitors in `scripts/` automatically detect and recover common failures.
- **Container-first deployment**: Dockerfiles and `docker-compose.yml` for reproducible local and production environments.

**How VoluSignal Differs (Unique Differentiators)**

- **Stream-first architecture**: instead of polling exchanges, VoluSignal prioritizes websocket streams and server-side streams (Redis) to minimize latency and bandwidth.
- **Operational automation built-in**: many projects provide deploy docs—this repo includes automated repair and monitoring scripts as first-class assets.
- **Focused alerting UX**: the backend implements optimized Top-100 alert types and efficient delta calculations to reduce noise and improve signal-to-noise for traders.
- **Optimized rate limiting**: custom rate-limiter logic in `core/rate_limiter.py` tuned for Binance and high-throughput market data.
- **Full-stack reproducibility**: both frontend and backend ship Dockerfiles and compose configs so local/dev setups mirror production closely.

**Benefits / Why choose VoluSignal**

- **Lower latency updates**: websocket-first design provides near-real-time market data for faster decision making.
- **Resilient operations**: self-healing scripts and robust Celery + Redis architecture reduce downtime and manual intervention.
- **Easier onboarding**: clear compose-based setup and developer-friendly docs speed up getting contributors and operators ready.
- **Scalable processing**: Celery workers and Redis streams allow horizontal scaling for higher throughput needs.
- **Extensible platform**: modular `core/` components make it straightforward to add new exchanges, alerting strategies, or notification channels.

If you want, I can also:
- Add a `backend/.env.example` file with placeholder values.
- Update the top-level `README.md` to link this document and add a shortened quick start.
- Generate an automated checklist for release/deploy steps.

