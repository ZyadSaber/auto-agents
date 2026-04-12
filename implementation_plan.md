# 🚀 CS Dashboard — Full Implementation Plan

## Goal
Replace AnythingLLM with a custom **Staff Dashboard** that is the single control plane for the entire AI customer service system.

---

## Feature Overview

| Area | Features |
|---|---|
| **💬 AI Chat** | Multi-model chat, conversation history, bilingual |
| **👥 Multi-User** | RBAC: Super Admin → Admin → Agent → Viewer |
| **🤖 LLM Manager** | Browse, pull, delete Ollama models; see loaded/running; switch defaults |
| **📱 OpenClaw Manager** | WhatsApp QR/session, Telegram bot config, enable/disable channels |
| **🖥️ Server Monitoring** | Real-time health, CPU/RAM per service, logs viewer, alerts |
| **🐳 Portainer** | Embedded iframe to Portainer (if configured via `.env`) |
| **📄 Documents** | Upload, search, delete documents for RAG |
| **🧠 Knowledge Base** | Teach problem→solution pairs visually |
| **📊 Analytics** | Message counts, response times, channel breakdown |
| **⚙️ Settings** | All configurable via `.env` + admin UI |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    CS Dashboard (Port 3001)                       │
│                                                                  │
│  ┌─────────────────────────────┐  ┌────────────────────────────┐ │
│  │     React Frontend (SPA)    │  │    Express Backend API     │ │
│  │                             │  │                            │ │
│  │  • Chat UI                  │  │  /api/auth/*    (JWT)      │ │
│  │  • LLM Manager              │  │  /api/chat/*    (proxy)    │ │
│  │  • OpenClaw Manager         │  │  /api/models/*  (Ollama)   │ │
│  │  • Server Monitor           │  │  /api/docs/*    (proxy)    │ │
│  │  • Documents                │  │  /api/openclaw/*(proxy)    │ │
│  │  • Knowledge Base           │  │  /api/monitor/* (health)   │ │
│  │  • Analytics                │  │  /api/settings/*(config)   │ │
│  │  • Portainer (iframe)       │  │  /ws            (realtime) │ │
│  │  • Admin Settings           │  │                            │ │
│  └──────────────┬──────────────┘  └─────────┬──────────────────┘ │
│                 │                            │                    │
│           ┌─────▼────────────────────────────▼──┐                │
│           │          SQLite Database             │                │
│           │  users, sessions, chat_history,      │                │
│           │  settings, audit_log                 │                │
│           └─────────────────────────────────────┘                │
└──────────────────────────┬───────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────────────┐
         │                 │                         │
    ┌────▼─────┐    ┌──────▼───────┐          ┌──────▼──────┐
    │  Ollama  │    │  Docs Agent  │          │  OpenClaw   │
    │  :11434  │    │  :8100       │          │  :3100      │
    │          │    │              │          │             │
    │ /api/tags│    │ /health      │          │ /health     │
    │ /api/pull│    │ /upload      │          │ /qr         │
    │ /api/show│    │ /ask         │          │ /send       │
    │ /api/chat│    │ /learn       │          │ /status     │
    │ /api/del │    │ /documents   │          │             │
    └──────────┘    └──────┬───────┘          └─────────────┘
                           │
                    ┌──────▼───────┐
                    │   ChromaDB   │
                    │   :8000      │
                    └──────────────┘
```

---

## User Roles (RBAC)

| Role | Chat | Docs | Knowledge | LLM Manager | OpenClaw | Monitoring | Users | Settings |
|---|---|---|---|---|---|---|---|---|
| **Super Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ View | ✅ View | ✅ View | ❌ | ❌ |
| **Agent** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Viewer** | ✅ Read | ✅ Read | ✅ Read | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Pages in Detail

### 1. 🔐 Login
- Email + password auth with JWT
- First-time setup creates super admin account
- "Remember me" with refresh tokens

### 2. 💬 AI Chat
- Real-time chat with streaming responses
- **Model selector** dropdown per conversation (lists all Ollama models)
- Route to Docs Agent or General Agent (or auto-detect)
- Conversation sidebar with search + history
- Arabic RTL support, bilingual rendering
- Copy, regenerate, rate responses

### 3. 🤖 LLM Manager (Super Admin / Admin-View)
- **Library tab**: Browse available Ollama models, one-click pull with progress bar
- **Installed tab**: List all downloaded models with size, family, parameter count, quantization
- **Running tab**: Show currently loaded models, VRAM/RAM usage, unload button
- **Pull progress**: Real-time progress bar when downloading a model (`POST /api/pull` streaming)
- **Delete model**: Remove models to free disk space
- **Set default**: Choose which model the system uses by default
- **Model info**: Show full model details (template, parameters, license)

> [!NOTE]
> Uses Ollama's API directly: `/api/tags`, `/api/show`, `/api/pull`, `/api/delete`, `/api/ps`

### 4. 📱 OpenClaw Manager (Super Admin / Admin-View)
- **WhatsApp**:
  - QR code display for linking (embedded from OpenClaw `/qr`)
  - Connection status indicator (connected/disconnected/scanning)
  - Session info (phone number, last seen)
  - Disconnect / reconnect button
- **Telegram**:
  - Bot token configuration (show masked, allow update)
  - Bot info display (@username, name)
  - Enable/disable toggle
- **Message routing**:
  - Configure which agent handles which channel
  - View routing rules
- **Channel status**: Live green/yellow/red indicators

### 5. 🖥️ Server Monitoring (Super Admin only)
- **Service health grid**: Real-time status cards for each service:
  
  | Service | Metrics Shown |
  |---|---|
  | Ollama | Status, loaded models, RAM used, GPU if available |
  | ChromaDB | Status, collections count, total embeddings |
  | Docs Agent | Status, uptime, documents ingested, request count |
  | General Agent | Status, uptime, request count |
  | OpenClaw | Status, WA connected, TG connected, messages today |
  | Nginx | Status (via self-check) |
  | CS Dashboard | Uptime, active users, memory usage |

- **Auto-refresh** every 5 seconds via WebSocket
- **Service logs viewer**: Tail last N lines of each service's health endpoint
- **Alert history**: Log of when services went down/up
- **System overview**: Total RAM, CPU, disk usage (from Docker stats if available)

### 6. 🐳 Portainer Embed (Super Admin only)
- **Conditional** — only shown if `PORTAINER_URL` is set in `.env`
- Embedded iframe pointing to the Portainer instance
- Quick-access link to open in new tab
- Falls back to "Portainer not configured" message if env var is empty

### 7. 📄 Documents
- Drag-and-drop file upload (PDF, DOCX, TXT, XLSX, CSV)
- Progress bar during upload
- Table of all ingested documents with:
  - Filename, type, size, date uploaded, chunk count
- Search within documents
- Delete documents
- Re-ingest button

### 8. 🧠 Knowledge Base
- **Add Solution**: visual form with Problem, Solution, Language (AR/EN) fields
- **Browse**: Paginated table of all solutions with search + filter by language
- **Edit/Delete** existing solutions
- **Import/Export**: Bulk import/export as JSON or CSV

### 9. 📊 Analytics Dashboard
- **Today's overview**: Messages received, responses sent, avg response time
- **Charts**: 
  - Messages per day (last 30 days)
  - Channel breakdown (WhatsApp vs Telegram vs Dashboard)
  - Top 10 queried topics
  - Model usage distribution
- **Active users**: Currently online staff
- Filterable by date range

### 10. ⚙️ Settings (Super Admin)
- **User Management**: Add/remove users, change roles, reset passwords, link mobile numbers
- **System Config**: Default model, rate limits, max upload size
- **API Keys**: View/rotate internal agent API key
- **Appearance**: Theme toggle (dark/light)
- All settings stored in DB, seeded from `.env` on first run

---

## `.env` Configuration

```env
# ── Dashboard ─────────────────────────────────────────────
DASHBOARD_PORT=3001
JWT_SECRET=change-me-in-production
INITIAL_ADMIN_EMAIL=admin@company.com
INITIAL_ADMIN_PASSWORD=changeme123

# ── Service URLs (auto-configured for Docker) ─────────────
OLLAMA_BASE_URL=http://ollama:11434
DOCS_AGENT_URL=http://docs-agent:8100
GENERAL_AGENT_URL=http://general-agent:8200
OPENCLAW_URL=http://openclaw:3100
CHROMADB_URL=http://chromadb:8000

# ── LLM ───────────────────────────────────────────────────
CHAT_MODEL=aya-expanse:32b
EMBED_MODEL=nomic-embed-text

# ── Portainer (optional) ──────────────────────────────────
PORTAINER_URL=                          # e.g. http://portainer:9000
PORTAINER_ENABLED=false

# ── OpenClaw ──────────────────────────────────────────────
ENABLE_WHATSAPP=true
ENABLE_TELEGRAM=true
TELEGRAM_BOT_TOKEN=your-token

# ── Monitoring ────────────────────────────────────────────
MONITOR_REFRESH_INTERVAL=5000           # ms between health polls
MONITOR_LOG_LINES=100                   # lines to tail per service

# ── Security ──────────────────────────────────────────────
AGENT_API_KEY=cs-internal-agent-key
RATE_LIMIT_RPM=20
SESSION_EXPIRY_HOURS=24
```

---

## Implementation Phases

### Phase 1 — Foundation ⏱️ ~2 hours
1. Project scaffolding (`dashboard/` with Vite + Express)
2. SQLite database schema (users, sessions, settings, chat_history)
3. Auth system (register/login/JWT/RBAC middleware)
4. Basic React shell with sidebar navigation + dark theme
5. Login page + first-run Super Admin setup

### Phase 2 — Chat + LLM Manager ⏱️ ~2 hours
6. Chat page with streaming responses
7. Model selector (proxy to Ollama `/api/tags`)
8. Conversation history (save/load from SQLite)
9. LLM Manager page (list/pull/delete/info models)
10. Pull progress with real-time streaming

### Phase 3 — Documents + Knowledge ⏱️ ~1 hour
11. Document upload page (proxy to Docs Agent)
12. Document list with delete
13. Knowledge Base form + table (learn/list solutions)

### Phase 4 — OpenClaw Manager ⏱️ ~1 hour
14. OpenClaw status page (WA/TG connection state)
15. WhatsApp QR embed + reconnect controls
16. Telegram bot info + enable/disable
17. Customer conversation viewer

### Phase 5 — Monitoring + Portainer ⏱️ ~1.5 hours
18. Server Monitoring page with health cards
19. WebSocket-based auto-refresh
20. Service log viewer
21. Portainer iframe (conditional on .env)
22. Alert/notification system

### Phase 6 — Analytics + Settings + Polish ⏱️ ~1.5 hours
23. Analytics dashboard with charts
24. Admin settings page (users, config, API keys)
25. Mobile-responsive polish
26. Docker integration (Dockerfile + update docker-compose.yml)
27. Final testing

---

## Docker Changes

Replace `anythingllm` in `docker-compose.yml`:

```yaml
  cs-dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    container_name: cs-dashboard
    restart: unless-stopped
    ports:
      - "${DASHBOARD_PORT:-3001}:3001"
    volumes:
      - dashboard-data:/app/data
    networks:
      - ai-net
    depends_on:
      ollama:
        condition: service_healthy
      docs-agent:
        condition: service_healthy
      general-agent:
        condition: service_healthy
    environment:
      - PORT=3001
      - OLLAMA_BASE_URL=http://ollama:11434
      - DOCS_AGENT_URL=http://docs-agent:8100
      - GENERAL_AGENT_URL=http://general-agent:8200
      - OPENCLAW_URL=http://openclaw:3100
      - CHROMADB_URL=http://chromadb:8000
      - JWT_SECRET=${JWT_SECRET:-cs-jwt-secret-change-in-production}
      - DB_PATH=/app/data/dashboard.db
      - CHAT_MODEL=${CHAT_MODEL:-aya-expanse:32b}
      - PORTAINER_URL=${PORTAINER_URL:-}
      - PORTAINER_ENABLED=${PORTAINER_ENABLED:-false}
      - INITIAL_ADMIN_EMAIL=${INITIAL_ADMIN_EMAIL:-admin@company.com}
      - INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD:-changeme123}
      - MONITOR_REFRESH_INTERVAL=${MONITOR_REFRESH_INTERVAL:-5000}
      - AGENT_API_KEY=${AGENT_API_KEY:-cs-internal-agent-key}
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:3001/api/health || exit 1"]
      interval: 20s
      timeout: 10s
      retries: 10
      start_period: 30s
```

Nginx route stays the same — `location /` now proxies to `cs-dashboard` instead of `anythingllm`.

---

## Key Decisions Needed

> [!IMPORTANT]
> Please confirm before I start building:

1. **Should I start building now?** I'll go phase by phase.
2. **Dashboard UI language** — English only for staff, or bilingual (AR + EN)?
3. **Model switching** — per-conversation or one global default?
4. **Do you need the Portainer iframe to pass through authentication**, or is your Portainer already set up with its own login?
5. **Anything else you want to add before I start coding?**
