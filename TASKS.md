# AI Customer Service — Project Tasks & Roadmap

> Last updated: 2026-04-15  
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
| 2.1 | Restrict CORS `allow_origins` to dashboard URL only | 🔴 | ✅ Done | All 3 services — `ALLOWED_ORIGINS` env var, comma-separated, defaults to `http://127.0.0.1,http://10.0.0.11` |
| 2.2 | Add JWT auth check to WebSocket `/terminal` upgrade handler | 🔴 | ✅ Done | Completed in Phase 0 (task 0.6) — `server.js` parses `?token=<jwt>`, requires Super Admin |
| 2.3 | Sanitize file upload filenames | 🟠 | ✅ Done | `docs-agent/main.py` — strips directory components, validates path stays inside `UPLOAD_DIR` |
| 2.4 | Sanitize ClickUp description input | 🟠 | ✅ Done | `openclaw/index.js` + `bridge/index.js` — `sanitizeText()` strips HTML, escapes entities, caps at 10k chars |
| 2.5 | Add model existence validation on agent startup | 🟠 | ✅ Done | `validate_ollama_models()` added to both agents — queries Ollama `/api/tags`, exits with clear error if model missing |
| 2.6 | Add rate limiting to dashboard Express routes | 🟡 | ✅ Done | `express-rate-limit` — keyed by JWT user ID (not IP — all internal users share LAN/NAT); 20 chat req/5 min, 10 upload req/10 min; proper JSON 429 response with log |
| 2.7 | Move secrets out of docker-compose into `.env` file (git-ignored) | 🟠 | ✅ Done | All 4 services use `env_file: .env`; secret vars (`JWT_SECRET`, `AGENT_API_KEY`, `TELEGRAM_BOT_TOKEN`, `INITIAL_ADMIN_PASSWORD`, `CLICKUP_API_KEY`) have no fallback defaults — Docker fails loudly if missing. Non-secret config retains safe `:-defaults`. `.env.example` updated with ⚠️ markers and `openssl`/`node crypto` generation commands |

---

## Phase 3 — Production Hardening (Before staff-wide rollout)

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 3.1 | ~~Migrate SQLite → PostgreSQL~~ — moved to Phase 6 | — | ➡️ Moved | SQLite is correct for internal test phase. Migrate before first external customer. See 6.11 |
| 3.2 | Add retry + exponential backoff for Ollama calls | 🟠 | ⬜ Pending | `dashboard/server.js` + both agents — retry 3x with 1s/2s/4s backoff |
| 3.3 | Add periodic ChromaDB health check (not just startup) | 🟠 | ⬜ Pending | `docs-agent/main.py` — background task every 60s |
| 3.4 | Add Ollama concurrency queue (max 5 parallel requests) | 🟡 | ⬜ Pending | Simple semaphore in agents |
| 3.5 | Setup SSL/TLS termination (Nginx + Let's Encrypt or self-signed) | 🔴 | ⬜ Pending | Required before external access |
| 3.6 | Add database backup cron (daily SQLite dump → `/backup/`) | 🟠 | ⬜ Pending | Add to docker-compose as a backup service |
| 3.7 | Add session cleanup job (delete sessions inactive >30 days) | 🟡 | ⬜ Pending | Python `BackgroundScheduler` in agents |
| 3.8 | Add pagination to `/documents` and `/solutions` endpoints | 🟡 | ⬜ Pending | Add `limit` + `offset` query params |
| 3.9 | Service health polling — backend `GET /api/health/services` | 🟠 | ⬜ Pending | Single endpoint that pings Ollama, ChromaDB, Docs Agent, General Agent, Bridge in parallel and returns `{ service, status, latency_ms }[]` — polled every 30s by the frontend |
| 3.10 | Global service health context (React) | 🟠 | ⬜ Pending | `ServiceHealthContext` + `useServiceHealth()` hook — provides `{ ollama, chromadb, docsAgent, generalAgent, bridge }` status to any component; polling lives here, not in individual pages |
| 3.11 | Header service status indicator | 🟡 | ⬜ Pending | Small dot/badge in the header — green all healthy, amber 1+ degraded, red 1+ down — clicking opens a popover with the per-service breakdown |
| 3.12 | Disable pages when their required service is down | 🟠 | ⬜ Pending | Chat → needs Ollama + General Agent; Documents → needs Docs Agent + ChromaDB; Channels → needs Bridge; LLM Manager → needs Ollama. Nav link shows a warning icon and page shows a "Service unavailable" banner instead of crashing silently |
| 3.13 | Code splitting — extract server.js into route modules | 🟡 | ⬜ Pending | `dashboard/server.js` is a single 700+ line file. Split into: `routes/auth.js`, `routes/chat.js`, `routes/models.js`, `routes/users.js`, `routes/proxy.js`, `routes/config.js`. `server.js` becomes the entry point that mounts them |
| 3.14 | Code splitting — extract Python agents into modules | 🟡 | ⬜ Pending | `docs-agent/main.py` and `general-agent/main.py` are monolithic. Split into: `routes/`, `services/` (business logic), `db/` (SQLite helpers), `config.py`. FastAPI app becomes thin router only |

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
| 5.8 | Build Bot 1 (internal staff bot) — proactive push to `INTERNAL_CHANNEL_ID` when new problem arrives or AI finds a solution; commands: `/stats`, `/pending` | 🟠 | ✅ Done | `bridge/index.js` — `startTelegram()` fully rewritten; `global.tgBot` set for cross-bot use; `/stats`, `/pending`, `/help` commands; ignores non-command messages; `notifyInternalChannel()` uses this bot for all push notifications |
| 5.9 | Build Bot 2 (customer-facing bot) — receive customer messages, hit AI agent for solution, escalate to ClickUp if no solution found, notify customer of escalation | 🟠 | ✅ Done | `bridge/index.js` — `startSecondTelegram()` fully rewritten; uses `queryAgentForCustomer()` (docs first → general fallback); `found=true` → answer + low-key internal log; `found=false` → answer + escalation message + `createClickUpTask()` + `storeEscalation()` + `notifyInternalChannel()`; in-flight guard prevents duplicate AI requests; `/start`, `/help`, `/clear` commands; `global.tgBot2` set for Bot 1 `/stats` reporting |

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
| 6.10 | Replace `whatsapp-web.js` with Meta WhatsApp Cloud API | 🔴 | ⬜ Pending | **Pre-production gate** — unofficial Baileys/QR carries ban risk at scale; Meta Cloud API is free for first 1k conversations/month, webhook-based, ~50 lines changed in `bridge/index.js` only |
| 6.11 | Migrate SQLite → PostgreSQL | 🔴 | ⬜ Pending | **Pre-external-customer gate** — needed for multi-tenancy (6.1), concurrent writes, and production tooling. Use `pg` driver in dashboard, Alembic migrations in Python agents. SQLite schema is already clean so migration is straightforward. |

---

## Phase 7 — Brain Ideas on the Go

> Raw ideas captured during development. No commitment — revisit when relevant.

| # | Idea | Notes |
|---|------|-------|
| 7.1 | First-run setup wizard (auto-configure `.env` via UI) | On first boot with no `.env`, show a setup page: enter server IP, JWT secret, bot tokens, ClickUp keys → generates and writes `.env` automatically. Removes manual setup friction for self-hosted deployments. |
| 7.2 | Auto-detect server IP on first run | During setup wizard, detect LAN IP and pre-fill `ALLOWED_ORIGINS` and branding fields. User just confirms and hits save. |
| 7.3 | Health dashboard "onboarding checklist" | After setup wizard, show a checklist: Ollama connected ✅, models pulled ✅, Telegram token set ✅, etc. Green = ready to use. |
| 7.4 | Removed `scripts/manage.sh` | Script was redundant — all functionality (upload, teach, ask, status) already exists in the dashboard. start/stop are just `docker compose up/down`. Deleted to avoid confusion and the security issue of unauthenticated API calls. |

---

## Brain Dump — Logs Screen (Future Ideas)

> Raw ideas for building a proper unified logs screen into the dashboard. No commitment — pick what's worth doing when the time comes.

### Viewing & Filtering
- **Unified log stream** — single view that aggregates logs from all services (dashboard, bridge, docs-agent, general-agent) with a service filter dropdown
- **Log level filter** — toggle INFO / WARN / ERROR / DEBUG independently
- **Keyword search** — live filter across visible log lines as you type
- **Time range picker** — show logs from last 5 min / 1 hour / today / custom range
- **Auto-scroll toggle** — pin to bottom when live, pause when scrolling up to read (like a real terminal)
- **Highlight errors** — ERROR lines get a red left border, WARN gets amber, makes scanning fast

### Actions
- **One-click copy** — copy a single log line or the entire visible window to clipboard
- **Export logs** — download current filtered view as `.txt` or `.json`
- **Clear display** — wipe the visible buffer without affecting actual logs (client-side only)
- **Mark line** — bookmark a specific line to come back to (session-only)

### Smart Features
- **Error grouping** — repeated identical errors collapsed into "same error ×12" instead of flooding the view
- **Anomaly badge** — if error rate spikes above normal in the last 5 min, show a red badge on the Logs nav link
- **Correlation ID tracing** — if a request ID is in the log, clicking it filters all log lines that share that ID across all services (full request trace)
- **Parsed structured logs** — if log line is JSON, render it as an expandable tree instead of raw string

### Per-Service Tabs
- Each service gets its own tab (Dashboard · Bridge · Docs Agent · General Agent)
- Tab badge shows unread error count since you last viewed it
- Bridge tab is split: WhatsApp logs vs Telegram logs vs ClickUp logs

---

## Known Bugs (Open)

| # | Bug | File | Severity |
|---|-----|------|----------|
| B1 | ~~NavLink className broken for LLM Manager (escaped backtick)~~ | `App.jsx:163` | ✅ Fixed |
| B2 | ~~`TELEGRAM_TOKEN` referenced before declaration in `/health` — crashes if `ENABLE_TELEGRAM=true`~~ | `openclaw/index.js:209`, `bridge/index.js:209` | ✅ Fixed — uses `config.tgToken` |
| B3 | ~~ChromaDB only health-checked once at startup~~ | `docs-agent/main.py:93` | ✅ Fixed — `chroma_health_loop()` runs every 60s as async background task |
| B4 | ~~No model validation on startup — silent fail if model missing~~ | Both agents | ✅ Fixed — `validate_ollama_models()` added; exits with clear error if models missing |
| B5 | ~~`WhatsApp client.on('disconnected')` does not auto-reconnect~~ | `openclaw/index.js`, `bridge/index.js` | ✅ Fixed — exponential backoff retry (2s→4s→8s…cap 60s), calls `startWhatsApp()` |
| B6 | ~~`SECOND_TELEGRAM_TOKEN` undefined in `startSecondTelegram()`~~ | `openclaw/index.js:563`, `bridge/index.js:563` | ✅ Fixed — uses `config.secondTgToken` |
| B7 | ~~DB initialized with `verbose: console.log` — all SQL queries logged to stdout~~ | `dashboard/database.js:13` | ✅ Fixed — only logs if `DEBUG_SQL=true` env var is set |
| B8 | ~~`check_same_thread=False` in SQLite with no mutex — race condition under concurrent requests~~ | `docs-agent/main.py`, `general-agent/main.py` | ✅ Fixed — WAL journal mode + 5s busy timeout added to every connection |
| B9 | Dead code: Second Telegram bot — replaced by tasks 5.8 and 5.9 | `openclaw/index.js`, `bridge/index.js` | ✅ Closed — tracked as features |
| S1 | ~~CORS `allow_origins=["*"]` on all services~~ | `docs-agent/main.py`, `general-agent/main.py`, `dashboard/server.js` | ✅ Fixed — `ALLOWED_ORIGINS` env var, defaults to `http://127.0.0.1,http://10.0.0.11` |
| S2 | ~~ClickUp task description sent unsanitized — HTML/script injection possible~~ | `openclaw/index.js`, `bridge/index.js` | ✅ Fixed — `sanitizeText()` strips HTML tags, escapes entities, caps at 10k chars |
| S3 | ~~`JWT_SECRET` had weak hardcoded default, not enforced~~ | `dashboard/server.js:18` | ✅ Fixed — exits on startup if not set |
| S4 | ~~`AGENT_API_KEY` defaulted to weak value with no warning~~ | 5 files | ✅ Fixed — startup warning logged if using default |
| S5 | ~~File upload filename not sanitized — path traversal risk~~ | `docs-agent/main.py:434` | ✅ Fixed — strips directory components, validates resolved path stays inside `UPLOAD_DIR` |
| E1 | ~~Silent catches in proxy routes — errors swallowed, impossible to debug~~ | `dashboard/server.js` | ✅ Fixed — `proxyError()` helper logs all errors server-side across all proxy routes |
| E2 | ~~`startTelegram()` called without `await` — errors silently lost~~ | `bridge/index.js:336` | ✅ Fixed — `.catch()` added, errors now logged |
| V2 | ~~`/api/chat` accepts any model name without validating against Ollama~~ | `dashboard/server.js` | ✅ Fixed — validates against `/api/tags` before accepting user-picked model |
| C1 | ~~`stats` counters incremented from concurrent handlers — inaccurate at load~~ | `bridge/index.js` | ✅ Fixed — `inc()` helper centralises all increments |

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
| 2026-04-15 | `config` object is single source of truth for runtime secrets | Secrets seed from `.env` on startup, can be updated live via `POST /api/config` without restart — `tgToken`, `secondTgToken`, `internalChannelId`, ClickUp keys all follow this pattern |
| 2026-04-15 | Never edit `.env` directly — only `.env.example` | `.env` contains real secrets and must not be touched; `.env.example` is the template with placeholder values |
| 2026-04-15 | `JWT_SECRET` is now required (hard exit if missing) | Weak hardcoded default was a security risk — dashboard process exits on startup if env var not set |
| 2026-04-15 | `AGENT_API_KEY` warns but does not exit if using default | Internal service traffic — warning is enough to alert on first boot; crash would break local dev with no `.env` |
| 2026-04-15 | Two separate Telegram bots with distinct roles | Bot 1 (`TELEGRAM_BOT_TOKEN`) = internal staff bot, proactive push to `INTERNAL_CHANNEL_ID` when problems/solutions occur + staff commands; Bot 2 (`SECOND_TELEGRAM_BOT_TOKEN`) = customer-facing, AI agent lookup → ClickUp escalation if no solution |
| 2026-04-15 | Bot 2 is single-tenant for now | No multi-tenant isolation until a second real client exists — premature design; deferred to task 6.1 |
| 2026-04-15 | Bot 2 escalation path: AI agent → ClickUp | If AI cannot resolve customer issue, create ClickUp task for company team and notify customer of escalation — no other ticketing system needed |
| 2026-04-15 | Bot 1 uses proactive push (not command-only) | Staff should be notified automatically when events happen — commands (`/stats`, `/pending`) are a bonus, not the core value |
| 2026-04-15 | Model validation exits hard if models missing | Silent failure when a model is missing caused confusing UX — better to fail fast at startup with a clear message listing what to `ollama pull` |
| 2026-04-15 | Service health polling belongs in a shared React context, not individual pages | Each page hitting its own health check causes duplicate requests and inconsistent UI state — one poller feeds all consumers via context |
| 2026-04-15 | Pages disabled (not hidden) when their service is down | Hiding nav items when a service is down is confusing — user doesn't know why the page is gone. Show the nav item with a warning icon and a clear "service unavailable" banner on the page itself |
| 2026-04-15 | server.js split deferred to Phase 3, not doing it now | File is large but fully working — splitting mid-feature adds risk with no user-visible benefit. Do it as a dedicated refactor task before staff-wide rollout |
