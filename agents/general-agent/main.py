"""
General Agent  v2.0
===================
• Answers Windows how-to questions and general knowledge in Arabic or English
• Per-user conversation history (isolated by session_id)
• API key auth + per-user rate limiting
• Thread-safe, multi-user ready
"""

import os
import asyncio
import time
import sqlite3
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger
import ollama as ollama_sdk

# ── Config ─────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
CHAT_MODEL      = os.getenv("CHAT_MODEL",      "aya-expanse:8b")
PORT            = int(os.getenv("PORT",         "8200"))
API_KEY         = os.getenv("AGENT_API_KEY",   "cs-internal-agent-key")
RATE_LIMIT_RPM  = int(os.getenv("RATE_LIMIT_RPM", "20"))
DB_PATH         = Path(os.getenv("DB_PATH",    "/app/db/general_history.db"))

DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# ── API Key Auth ───────────────────────────────────────────────────────────────
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def require_api_key(key: str = Depends(api_key_header)):
    if key != API_KEY:
        raise HTTPException(401, "Invalid or missing API key. Set X-API-Key header.")
    return key

# ── Per-user Rate Limiter ──────────────────────────────────────────────────────
_rate_data: dict = defaultdict(lambda: {"count": 0, "window_start": time.time()})

def check_rate_limit(identifier: str):
    now  = time.time()
    data = _rate_data[identifier]
    if now - data["window_start"] > 60:
        data["count"] = 0
        data["window_start"] = now
    data["count"] += 1
    if data["count"] > RATE_LIMIT_RPM:
        raise HTTPException(429, f"Too many requests. Limit: {RATE_LIMIT_RPM}/min per user.")

# ── SQLite for per-user history ────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    con = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = get_db()
    con.executescript("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at REAL
        );
        CREATE INDEX IF NOT EXISTS idx_session ON chat_history(session_id, created_at);
    """)
    con.commit()
    con.close()
    logger.info("General agent DB ready.")

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a bilingual IT support and general knowledge assistant for customer service staff.

You specialize in:
1. WINDOWS TASKS — step-by-step guides for:
   - File management (copy, move, delete, search, zip)
   - Printer setup and troubleshooting
   - Network, Wi-Fi, VPN configuration
   - Microsoft Office: Word, Excel, Outlook, Teams
   - Windows Settings (display, sound, accounts, updates)
   - Keyboard shortcuts and productivity tips
   - Email and browser configuration
   - Software installation / uninstallation
   - Screen capture and recording

2. GENERAL KNOWLEDGE — factual questions on any topic.

3. CUSTOMER SERVICE GUIDANCE — best practices for handling customers.

RULES:
- Always respond in the SAME language the user writes in.
- For Arabic: use clear Modern Standard Arabic (فصحى).
- For Windows tasks: give numbered step-by-step instructions.
- Be concise but thorough — do not skip important steps.
- If unsure, say so clearly rather than guessing.
- Keep prior conversation context in mind when answering follow-up questions.

أنت مساعد تقني ثنائي اللغة لموظفي خدمة العملاء. تتخصص في مهام Windows والمعرفة العامة.
"""

WINDOWS_REFERENCE = """
--- Windows Quick Reference ---

SCREENSHOTS:
- Full screen: Win + PrtScn  (saves to Pictures/Screenshots)
- Active window: Alt + PrtScn  (clipboard only)
- Custom area: Win + Shift + S  (Snipping Tool)

SEARCH FILES:
- Win + S → type filename
- Inside Explorer: Ctrl + F

COMPRESS (ZIP):
- Right-click folder → Send to → Compressed (zipped) folder
- Windows 11: right-click → Compress to ZIP file

ADD PRINTER:
- Settings → Bluetooth & devices → Printers & scanners → Add device

NETWORK / VPN:
- Wi-Fi: Settings → Network & Internet → Wi-Fi
- VPN: Settings → Network & Internet → VPN → Add VPN

EXCEL:
- Sum a range: =SUM(A1:A10)
- Auto-fit column: double-click column border header
- Freeze top row: View → Freeze Panes → Freeze Top Row
- Find & Replace: Ctrl + H

OUTLOOK:
- New email: Ctrl + N
- Reply: Ctrl + R  |  Reply All: Ctrl + Shift + R
- Create signature: File → Options → Mail → Signatures
- Search mailbox: Ctrl + E

WORD:
- Find text: Ctrl + F
- Replace text: Ctrl + H
- Save as PDF: File → Save As → PDF

WINDOWS GENERAL:
- Task Manager: Ctrl + Shift + Esc
- Lock screen: Win + L
- Virtual desktops: Win + Tab
- Run dialog: Win + R
- Settings: Win + I
"""

# ── Chat function (per-user) ───────────────────────────────────────────────────
def chat(question: str, session_id: str) -> str:
    # Load this user's history
    con = get_db()
    rows = con.execute(
        """SELECT role, content FROM chat_history
           WHERE session_id=? ORDER BY created_at DESC LIMIT 10""",
        (session_id,)
    ).fetchall()
    con.close()

    messages = [{"role": "system", "content": SYSTEM_PROMPT + "\n" + WINDOWS_REFERENCE}]
    for row in reversed(rows):
        messages.append({"role": row["role"], "content": row["content"]})
    messages.append({"role": "user", "content": question})

    client = ollama_sdk.Client(host=OLLAMA_BASE_URL)
    response = client.chat(model=CHAT_MODEL, messages=messages)
    # ollama >= 0.3.x returns a typed ChatResponse object, not a dict
    answer = response.message.content

    # Save this user's turn
    con = get_db()
    now = time.time()
    con.execute(
        "INSERT INTO chat_history(session_id,role,content,created_at) VALUES(?,?,?,?)",
        (session_id, "user", question, now)
    )
    con.execute(
        "INSERT INTO chat_history(session_id,role,content,created_at) VALUES(?,?,?,?)",
        (session_id, "assistant", answer, now)
    )
    # Prune: keep last 20 messages per user
    con.execute("""
        DELETE FROM chat_history WHERE session_id=? AND id NOT IN (
            SELECT id FROM chat_history WHERE session_id=?
            ORDER BY created_at DESC LIMIT 20
        )
    """, (session_id, session_id))
    con.commit()
    con.close()

    return answer

# ── App ────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"General Agent starting. Model: {CHAT_MODEL}")
    init_db()
    try:
        ollama_sdk.Client(host=OLLAMA_BASE_URL).list()
        logger.success("Ollama connection OK.")
    except Exception as e:
        logger.warning(f"Ollama not yet ready: {e}")
    yield

app = FastAPI(title="General Agent", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ────────────────────────────────────────────────────────────
class QuestionRequest(BaseModel):
    question: str
    session_id: str = "anonymous"   # unique per user / chat session

# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "agent": "general", "model": CHAT_MODEL}

@app.get("/capabilities")
async def capabilities():
    return {
        "agent": "general",
        "languages": ["Arabic", "English"],
        "specialties": [
            "Windows step-by-step tasks",
            "Microsoft Office (Word, Excel, Outlook, Teams)",
            "Printer and network troubleshooting",
            "General knowledge",
            "Customer service best practices",
        ],
    }

@app.post("/ask", dependencies=[Depends(require_api_key)])
async def ask(req: QuestionRequest, request: Request):
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty")

    check_rate_limit(req.session_id or request.client.host)

    try:
        answer = await asyncio.get_event_loop().run_in_executor(
            None, chat, req.question, req.session_id
        )
        return {"answer": answer, "agent": "general"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"General agent error [{req.session_id}]: {e}")
        raise HTTPException(500, "Internal error — please try again")

@app.delete("/history/{session_id}", dependencies=[Depends(require_api_key)])
async def clear_history(session_id: str):
    """Clear one user's conversation history."""
    con = get_db()
    con.execute("DELETE FROM chat_history WHERE session_id=?", (session_id,))
    con.commit()
    con.close()
    return {"message": f"History cleared for '{session_id}'"}

@app.get("/sessions", dependencies=[Depends(require_api_key)])
async def get_sessions():
    """Retrieve all unique session IDs and their latest message timestamp."""
    con = get_db()
    cursor = con.cursor()
    cursor.execute("""
        SELECT session_id, MAX(created_at) as last_seen 
        FROM chat_history 
        GROUP BY session_id 
        ORDER BY last_seen DESC
    """)
    sessions = [{"session_id": r[0], "last_seen": r[1]} for r in cursor.fetchall()]
    con.close()
    return sessions

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
