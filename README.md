# 🤖 AI Customer Service System
### Bilingual (Arabic + English) — Docker — Ollama — AnythingLLM — WhatsApp/Telegram

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ENTRY POINTS                            │
│                                                                 │
│  Staff:     http://localhost      (AnythingLLM UI)              │
│  Customers: WhatsApp / Telegram   (OpenClaw Bridge)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │      NGINX          │  (Reverse Proxy :80)
              └──────────┬──────────┘
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼──────┐ ┌──────▼──────┐ ┌────▼───────┐
│  AnythingLLM  │ │ Docs Agent  │ │  OpenClaw  │
│  :3001        │ │  :8100      │ │  :3100     │
│               │ │             │ └────┬───────┘
│ Main chat UI  │ │ RAG + Learn │      │ WhatsApp
│ for staff     │ │ PDF/DOCX/TXT│      │ Telegram
└───────┬───────┘ └──────┬──────┘      │
        │                │        ┌────▼───────┐
        │         ┌──────▼──────┐ │  General   │
        │         │  ChromaDB   │ │  Agent     │
        │         │  :8000      │ │  :8200     │
        │         │             │ │            │
        │         │ Vector store│ │ Windows    │
        │         │ for docs +  │ │ tasks &    │
        │         │ solutions   │ │ knowledge  │
        └────┬────┴──────┬──────┴─┴────┬───────┘
             │           │             │
             └───────────▼─────────────┘
                    ┌────────────┐
                    │   OLLAMA   │
                    │   :11434   │
                    │            │
                    │ aya-expanse│ ← Arabic + English
                    │ nomic-embed│ ← Embeddings
                    └────────────┘
```

---

## Services

| Service | Port | Purpose |
|---------|------|---------|
| **Nginx** | 80 | Reverse proxy, single entry point |
| **AnythingLLM** | 3001 | Staff chat UI, workspace management |
| **Docs Agent** | 8100 | RAG pipeline: upload docs, ask, learn |
| **General Agent** | 8200 | Windows how-to + general knowledge |
| **OpenClaw** | 3100 | WhatsApp & Telegram bridge |
| **Ollama** | 11434 | Local LLM runtime |
| **ChromaDB** | 8000 | Vector database |

---

## Quick Start

### 1. Prerequisites
- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- **RAM**: 16GB minimum (for CPU inference) or 8GB VRAM for GPU
- **Disk**: ~15GB for models

### 2. Clone and configure
```bash
git clone <this-repo>
cd ai-customer-service

cp .env.example .env
# Edit .env — at minimum set TELEGRAM_BOT_TOKEN if using Telegram
```

### 3. Start everything
```bash
docker compose up -d
```

First run takes **10–20 minutes** to download models. Monitor with:
```bash
docker compose logs -f ollama-init
```

### 4. Access the Staff UI
Open **http://localhost** in your browser.

**AnythingLLM first-time setup:**
1. Create an admin account
2. Go to Settings → LLM Provider → Ollama → set model to `aya-expanse:8b`
3. Create a workspace named **"Customer Service"**
4. Add a custom agent connection (optional, for routing to specific agents)

---

## Document Upload (for Docs Agent)

### Method 1: Drop files into the uploads folder
```bash
# Just copy PDF/DOCX/TXT files here — auto-ingested within seconds
cp your-document.pdf ./uploads/
```

### Method 2: API upload
```bash
curl -X POST http://localhost/api/docs/upload \
  -F "file=@your-document.pdf"
```

### Method 3: AnythingLLM UI
Use the workspace document upload panel (uploads to AnythingLLM's own vector store).

### Supported formats
- PDF, DOCX, TXT, XLSX, XLS, CSV

---

## Teaching the Agent New Solutions

When a customer brings a new problem and you solve it, teach the agent so it handles it automatically next time:

```bash
curl -X POST http://localhost/api/docs/learn \
  -H "Content-Type: application/json" \
  -d '{
    "problem": "Customer cannot open the signed PDF form",
    "solution": "The form requires Adobe Acrobat Reader DC (not browser). Download from adobe.com/reader. If still failing, ask for the form version number and check compatibility table in the internal wiki.",
    "language": "en"
  }'
```

Or in Arabic:
```bash
curl -X POST http://localhost/api/docs/learn \
  -H "Content-Type: application/json" \
  -d '{
    "problem": "العميل لا يستطيع فتح نموذج PDF الموقّع",
    "solution": "النموذج يتطلب Adobe Acrobat Reader DC وليس المتصفح. يمكن تحميله من adobe.com/reader",
    "language": "ar"
  }'
```

---

## WhatsApp Setup

1. Start the containers: `docker compose up -d`
2. Visit **http://localhost/qr** in your browser
3. Scan the QR code with WhatsApp (Linked Devices → Link a Device)
4. Session is saved — no re-scan needed unless session expires

**Customers can now message your WhatsApp number and get AI responses!**

---

## Telegram Setup

1. Message **@BotFather** on Telegram
2. Send `/newbot`, follow prompts, copy the token
3. Add to `.env`: `TELEGRAM_BOT_TOKEN=your-token`
4. Restart: `docker compose restart openclaw`

**Bot commands customers can use:**
- `/start` — Welcome message in Arabic + English
- `/help` — Show available commands
- `/clear` — Reset conversation history

---

## API Reference

### Docs Agent (http://localhost/api/docs/)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/stats` | Ingested docs + solutions count |
| POST | `/upload` | Upload a document |
| GET | `/documents` | List all ingested documents |
| DELETE | `/documents/{filename}` | Remove a document |
| POST | `/ask` | Ask a question (RAG) |
| POST | `/learn` | Teach a new solution |
| GET | `/solutions` | List all learned solutions |

### General Agent (http://localhost/api/general/)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/ask` | Ask Windows/general question |
| GET | `/capabilities` | List capabilities |

### OpenClaw Bridge (http://localhost/bridge/)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service + channel status |
| GET | `/qr` | WhatsApp QR code page |
| POST | `/send` | Send a message programmatically |

---

## Useful Commands

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f docs-agent

# Restart a service
docker compose restart docs-agent

# Stop everything
docker compose down

# Stop and delete all data (clean slate)
docker compose down -v

# Check Ollama models
docker exec ollama ollama list

# Pull a different model (e.g., lighter model for low-RAM machines)
docker exec ollama ollama pull aya:8b
```

---

## Model Recommendations

| Scenario | Model | RAM Needed |
|----------|-------|------------|
| Best Arabic+English quality | `aya-expanse:8b` (default) | 16GB |
| Lower RAM machine | `aya:8b` | 10GB |
| English only, very fast | `mistral:7b` | 8GB |
| Highest quality (slow) | `aya-expanse:32b` | 32GB |

Change the model in `.env`:
```
CHAT_MODEL=aya:8b
```
Then restart: `docker compose up -d`

---

## Troubleshooting

**Ollama taking too long to respond**
→ You're running on CPU. Normal for first request (cold start). Subsequent requests are faster.

**"No relevant documents found"**
→ Documents not yet ingested. Check `docker compose logs docs-agent`. Also verify the upload folder contains your files.

**WhatsApp disconnects frequently**
→ Keep the container running 24/7. Use a dedicated phone number for the bot.

**ChromaDB connection refused**
→ Wait 30 seconds after startup. ChromaDB takes time to initialize.
