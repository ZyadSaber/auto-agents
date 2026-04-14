# AI Customer Service — Project Tasks & Roadmap

> Last updated: 2026-04-14  
> Owner: Zyad Ahmed  
> Goal: Deploy internally at company first → validate → launch as startup product

---

## Legend
- ✅ Done
- 🔄 In Progress
- ⬜ Pending
- 🔴 Blocked / Critical
- 🟠 High Priority
- 🟡 Medium Priority
- 🔵 Low Priority

---

## Phase 0 — Foundation Cleanup (Done)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 0.1 | Rename "OpenClaw" → "Channel Bridge" across entire codebase | 🟠 | ✅ Done | Folder: `openclaw/` → `bridge/`, service: `bridge`, route: `/channels`, env: `BRIDGE_URL`, page: `BridgeManager.jsx`, all i18n keys updated |
| 0.2 | Add env-based branding config (`SYSTEM_NAME`, `COMPANY_NAME`, `SYSTEM_TAGLINE`) | 🟠 | ✅ Done | Exposed via `GET /api/config/public` (no auth needed), consumed in `App.jsx` with `useEffect`, sets `document.title` dynamically |
| 0.3 | Add `.env.example` with branding vars + all existing vars | 🟠 | ✅ Done | `SYSTEM_NAME`, `COMPANY_NAME`, `SYSTEM_TAGLINE` at top of file |
| 0.4 | Set up shadcn/ui foundation | 🟠 | ✅ Done | Installed: `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`; Created: `src/lib/utils.js` (`cn()`), `src/components/ui/button.jsx`, `card.jsx`, `badge.jsx`, `input.jsx`, `tabs.jsx` |
| 0.5 | Add Vite `@` path alias + WS proxy for terminal | 🟠 | ✅ Done | `vite.config.js` — `@` → `./src`, `/terminal` WS proxied to dashboard backend |
| 0.6 | Secure terminal WebSocket with JWT auth (Super Admin only) | 🔴 | ✅ Done | `server.js` — parses `?token=<jwt>` on WS upgrade, verifies role = Super Admin, destroys socket otherwise |
| 0.7 | Update `Terminal.jsx` to send JWT in WS connection URL | 🔴 | ✅ Done | Reads from `localStorage.getItem('token')` |
| 0.8 | Add dedicated `TerminalPage.jsx` + `/terminal` route (Super Admin only) | 🟠 | ✅ Done | Accessible from nav sidebar under Super Admin section |
| 0.9 | Update all nav labels to use i18n keys | 🟡 | ✅ Done | `App.jsx` — all sidebar labels use `t('nav_*')` keys |

---

## Phase 1 — Channel Bridge Integration (Done)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1.1 | Add stats tracking engine to openclaw (message counters, uptime, session count, error count) | 🟠 | ✅ Done | `openclaw/index.js` — `stats` object + `logBuffer` |
| 1.2 | Add `/stats` endpoint to openclaw | 🟠 | ✅ Done | Returns uptime, messages, errors, clickup counts |
| 1.3 | Add `/api/logs` endpoint to openclaw (last 200 log lines) | 🟠 | ✅ Done | Newest-first, includes level + timestamp |
| 1.4 | Add `/api/commands` endpoint to openclaw | 🟠 | ✅ Done | Commands: `stats`, `restart-telegram`, `restart-whatsapp`, `clear-all-sessions` |
| 1.5 | Proxy `/api/openclaw/stats` through dashboard server | 🟠 | ✅ Done | `dashboard/server.js` |
| 1.6 | Proxy `/api/openclaw/logs` through dashboard server (Super Admin only) | 🟠 | ✅ Done | `dashboard/server.js` |
| 1.7 | Proxy `/api/openclaw/command` through dashboard server (Super Admin only) | 🟠 | ✅ Done | `dashboard/server.js` |
| 1.8 | Rebuild OpenClawManager console tab (stats cards + quick-command buttons + log viewer) | 🟠 | ✅ Done | `OpenClawManager.jsx` — replaced raw Terminal with management console |
| 1.9 | Wire up OpenClaw history tab to real customer sessions (WA/TG filter) | 🟠 | ✅ Done | Fetches `/api/customers/sessions`, filters `wa_*` and `tg_*` |
| 1.10 | Fix NavLink className template literal bug (LLM Manager nav highlight broken) | 🟡 | ✅ Done | `App.jsx` line 163 — `\${` → `${` |
| 1.11 | Pass `user` prop to OpenClawManager for role-based button guarding | 🟡 | ✅ Done | `App.jsx` — `<OpenClawManager token user />` |

---

## Phase 2 — Security Hardening (Before any live deployment)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 2.1 | Restrict CORS `allow_origins` to dashboard URL only | 🔴 | ⬜ Pending | `docs-agent/main.py` + `general-agent/main.py` — replace `["*"]` with env var list |
| 2.2 | Add JWT auth check to WebSocket `/terminal` upgrade handler | 🔴 | ⬜ Pending | `dashboard/server.js` — parse token from WS query param, require Super Admin |
| 2.3 | Sanitize file upload filenames | 🟠 | ⬜ Pending | `docs-agent/main.py` — strip path separators, validate extension whitelist |
| 2.4 | Sanitize ClickUp description input | 🟠 | ⬜ Pending | `openclaw/index.js` — strip HTML/script tags before sending to ClickUp API |
| 2.5 | Add model existence validation on agent startup | 🟠 | ⬜ Pending | Both agents — query Ollama `/api/tags` on boot, exit with clear error if model missing |
| 2.6 | Add rate limiting to dashboard Express routes | 🟡 | ⬜ Pending | Install `express-rate-limit`, apply to `/api/chat` and `/api/docs` |
| 2.7 | Move secrets out of docker-compose into `.env` file (git-ignored) | 🟠 | ⬜ Pending | `AGENT_API_KEY`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN` — never commit `.env` |

---

## Phase 3 — Production Hardening (Before staff-wide rollout)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.1 | Migrate SQLite → PostgreSQL | 🔴 | ⬜ Pending | Use `pg` driver in dashboard, Alembic migrations in Python agents |
| 3.2 | Add retry + exponential backoff for Ollama calls | 🟠 | ⬜ Pending | `dashboard/server.js` + both agents — retry 3x with 1s/2s/4s backoff |
| 3.3 | Add periodic ChromaDB health check (not just startup) | 🟠 | ⬜ Pending | `docs-agent/main.py` — background task every 60s |
| 3.4 | Add Ollama concurrency queue (max 5 parallel requests) | 🟡 | ⬜ Pending | Simple semaphore in agents |
| 3.5 | Setup SSL/TLS termination (Nginx + Let's Encrypt or self-signed) | 🔴 | ⬜ Pending | Required before external access |
| 3.6 | Add database backup cron (daily SQLite dump → `/backup/`) | 🟠 | ⬜ Pending | Add to docker-compose as a backup service |
| 3.7 | Add session cleanup job (delete sessions inactive >30 days) | 🟡 | ⬜ Pending | Python `BackgroundScheduler` in agents |
| 3.8 | Add pagination to `/documents` and `/solutions` endpoints | 🟡 | ⬜ Pending | Add `limit` + `offset` query params |

---

## Phase 4 — Monitoring & Observability

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 4.1 | Build System Monitoring page (replace "Coming in Phase 5" placeholder) | 🟠 | ⬜ Pending | Show CPU, RAM, Ollama model status, agent health |
| 4.2 | Add Prometheus metrics endpoints to all services | 🟡 | ⬜ Pending | `prom-client` for Node, `prometheus-fastapi-instrumentator` for Python |
| 4.3 | Set up Grafana dashboard (optional — Portainer alternative) | 🔵 | ⬜ Pending | Add to docker-compose |
| 4.4 | Centralized log aggregation (Loki or file-based) | 🟡 | ⬜ Pending | Each service currently logs independently |
| 4.5 | Set up uptime alerting (email/Telegram on service down) | 🟡 | ⬜ Pending | Can send alert via the Telegram bot itself |
| 4.6 | Add audit log table (who asked what, when, from which channel) | 🟡 | ⬜ Pending | Required for compliance |

---

## Phase 5 — Feature Completion

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 5.1 | Build Platform Settings page (replace placeholder in `/settings`) | 🟠 | ⬜ Pending | User management, system prompt config, model routing rules |
| 5.2 | Add per-department system prompts (e.g. HR bot vs IT bot) | 🟠 | ⬜ Pending | Store in DB, selectable per chat session |
| 5.3 | Add response rating/feedback (thumbs up/down per AI reply) | 🟡 | ⬜ Pending | Store in DB, show aggregate in analytics |
| 5.4 | Add conversation export (PDF/CSV per session) | 🟡 | ⬜ Pending | |
| 5.5 | Role-based document access (staff sees only their dept docs) | 🟡 | ⬜ Pending | Tag docs with department label |
| 5.6 | Admin bulk operations (delete all sessions, re-embed all docs) | 🟡 | ⬜ Pending | |
| 5.7 | API key management UI (generate/revoke agent keys from dashboard) | 🔵 | ⬜ Pending | |
| 5.8 | Complete Second Telegram bot (currently unfinished dead code) | 🟡 | ⬜ Pending | Either finish or remove from `openclaw/index.js` |

---

## Phase 6 — Startup / SaaS Readiness (Post-company validation)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 6.1 | Multi-tenancy architecture (per-company data isolation) | 🔴 | ⬜ Pending | Each company gets own DB schema + ChromaDB collection |
| 6.2 | OAuth2 / SSO authentication (Google, Microsoft, LDAP) | 🟠 | ⬜ Pending | Replace JWT-only login |
| 6.3 | Billing & metering (per-message or per-seat pricing) | 🟠 | ⬜ Pending | Stripe integration |
| 6.4 | Kubernetes deployment (replace Docker Compose) | 🟡 | ⬜ Pending | Required for auto-scaling |
| 6.5 | Redis caching layer (embedding cache, session cache) | 🟡 | ⬜ Pending | |
| 6.6 | GDPR compliance (data export, right to deletion, DPA) | 🔴 | ⬜ Pending | Required for EU customers |
| 6.7 | CI/CD pipeline (GitHub Actions — test → build → deploy) | 🟠 | ⬜ Pending | |
| 6.8 | Automated test suite (unit + integration + E2E) | 🟠 | ⬜ Pending | Zero tests currently exist |
| 6.9 | Migrate backend to TypeScript | 🔵 | ⬜ Pending | Optional but helps at scale |
| 6.10 | Replace `whatsapp-web.js` with Meta WhatsApp Cloud API | 🔴 | ⬜ Pending | **Pre-production gate** — unofficial Baileys/QR carries ban risk at scale; Meta Cloud API is free for first 1k conversations/month, webhook-based, ~50 lines changed in `openclaw/index.js` only |

---

## Known Bugs (Open)

| # | Bug | File | Severity |
|---|-----|------|----------|
| B1 | ~~NavLink className broken for LLM Manager (escaped backtick)~~ | `App.jsx:163` | ✅ Fixed |
| B2 | `TELEGRAM_TOKEN` referenced before declaration in `/health` route | `openclaw/index.js:180` | 🟠 High — crashes on startup if `ENABLE_TELEGRAM=true` but var is declared later |
| B3 | ChromaDB only health-checked once at startup | `docs-agent/main.py:93` | 🟡 Medium |
| B4 | No model validation on startup — silent fail if model missing | Both agents | 🟠 High |
| B5 | `WhatsApp client.on('disconnected')` does not auto-reconnect | `openclaw/index.js` | 🟡 Medium |

---

## Architecture Reference

```
Nginx :80
├── CS Dashboard        :3001  (Node/Express + React)
├── Docs Agent          :8100  (FastAPI + ChromaDB + RAG)
├── General Agent       :8200  (FastAPI + SQLite)
├── OpenClaw Bridge     :3100  (Node + WhatsApp + Telegram + ClickUp)
├── Ollama              :11434 (LLM runtime)
└── ChromaDB            :8000  (Vector DB)
```

**Models in use:**
- `aya-expanse:8b/32b` — bilingual Arabic/English
- `qwen2.5:72b` — Arabic specialist
- `llama3.3:70b` — English specialist
- `nomic-embed-text` — document embeddings

---

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-04-14 | Keep SQLite for internal company test phase | Lower ops overhead; migrate to PostgreSQL before SaaS |
| 2026-04-14 | Use local Ollama (no API costs) | Data stays on-prem; company requirement |
| 2026-04-14 | OpenClaw console uses API commands, not raw shell | Security — raw shell access is too dangerous for ops users |
| 2026-04-14 | Phase 1 = OpenClaw integration before security hardening | User needs the management UI to test the system first |
| 2026-04-14 | Keep `whatsapp-web.js` (unofficial/Baileys) for now | Volume is low for internal testing; official WhatsApp Cloud API migration deferred to startup pre-production (~1 year out) |
| 2026-04-14 | Renamed "OpenClaw" service → "Channel Bridge" | Better describes what it does (bridges WA/TG channels to AI agents); folder `bridge/`, route `/channels`, all i18n updated |
| 2026-04-14 | Adopted shadcn/ui component system | Stops UI fighting — use `Button`, `Card`, `Badge`, `Input`, `Tabs` from `src/components/ui/` going forward; don't write custom component CSS |
| 2026-04-14 | App branding driven by `SYSTEM_NAME` env var | Self-hosted customers set their own name; changes `document.title` + nav header dynamically |
| 2026-04-14 | Terminal WebSocket now requires JWT Super Admin token | Security hardening — previous version was completely open |
| 2026-04-14 | Do NOT switch to openclaw.ai product | openclaw.ai is a personal AI assistant platform, not a WA gateway — it uses the same Baileys/QR method underneath and would require replacing the entire AI backend |
