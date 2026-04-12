"""
Docs RAG Agent  v2.1
====================
Fixes:
  - chromadb >= 0.4.x: HttpClient now requires tenant + database params
  - chromadb: heartbeat check before creating collections
  - retry loop on startup so ChromaDB has time to fully boot
  - thread-safe SQLite, per-user session isolation, API key auth
"""

import os
import asyncio
import hashlib
import time
import sqlite3
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager
from collections import defaultdict

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends, Request
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger
import chromadb
import ollama as ollama_sdk
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ── Config ─────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL",     "http://ollama:11434")
CHROMA_HOST     = os.getenv("CHROMA_HOST",          "chromadb")
CHROMA_PORT     = int(os.getenv("CHROMA_PORT",      "8000"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME",      "customer_docs")
SOL_COLLECTION  = os.getenv("SOLUTIONS_COLLECTION", "known_solutions")
EMBED_MODEL     = os.getenv("EMBED_MODEL",          "nomic-embed-text")
CHAT_MODEL      = os.getenv("CHAT_MODEL",           "aya-expanse:8b")
UPLOAD_DIR      = Path(os.getenv("UPLOAD_DIR",      "/app/uploads"))
DB_PATH         = Path(os.getenv("DB_PATH",         "/app/db/solutions.db"))
PORT            = int(os.getenv("PORT",              "8100"))
API_KEY         = os.getenv("AGENT_API_KEY",        "cs-internal-agent-key")
RATE_LIMIT_RPM  = int(os.getenv("RATE_LIMIT_RPM",  "20"))

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# ── Auth ───────────────────────────────────────────────────────────────────────
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def require_api_key(key: str = Depends(api_key_header)):
    if key != API_KEY:
        raise HTTPException(401, "Invalid or missing API key.")
    return key

# ── Rate limiter ───────────────────────────────────────────────────────────────
_rate_data: dict = defaultdict(lambda: {"count": 0, "window_start": time.time()})

def check_rate_limit(identifier: str):
    now  = time.time()
    data = _rate_data[identifier]
    if now - data["window_start"] > 60:
        data["count"] = 0
        data["window_start"] = now
    data["count"] += 1
    if data["count"] > RATE_LIMIT_RPM:
        raise HTTPException(429, f"Rate limit: max {RATE_LIMIT_RPM} requests/min per user.")

# ── ChromaDB ───────────────────────────────────────────────────────────────────
chroma_client   = None
docs_collection = None
sol_collection  = None

def init_chroma(retries: int = 10, delay: int = 5):
    """
    Connect to ChromaDB with retry loop.
    chromadb >= 0.4.x requires tenant and database to be passed explicitly.
    """
    global chroma_client, docs_collection, sol_collection

    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Connecting to ChromaDB (attempt {attempt}/{retries})...")
            chroma_client = chromadb.HttpClient(
                host=CHROMA_HOST,
                port=CHROMA_PORT,
                # tenant/database kwargs were removed in chromadb 0.5.x;
                # the server uses the default tenant/database automatically.
            )
            # Verify the server is alive before creating collections
            chroma_client.heartbeat()

            docs_collection = chroma_client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
            sol_collection = chroma_client.get_or_create_collection(
                name=SOL_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
            logger.success(
                f"ChromaDB ready — docs: {docs_collection.count()}, "
                f"solutions: {sol_collection.count()}"
            )
            return  # success

        except Exception as e:
            logger.warning(f"ChromaDB not ready yet: {e}")
            if attempt < retries:
                logger.info(f"Retrying in {delay}s...")
                time.sleep(delay)
            else:
                raise RuntimeError(
                    f"Could not connect to ChromaDB after {retries} attempts. "
                    "Make sure the chromadb service is healthy."
                ) from e

# ── SQLite ─────────────────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    con = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = get_db()
    con.executescript("""
        CREATE TABLE IF NOT EXISTS ingested_files (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT UNIQUE,
            file_hash   TEXT,
            chunks      INTEGER DEFAULT 0,
            ingested_at REAL
        );
        CREATE TABLE IF NOT EXISTS solutions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            problem    TEXT NOT NULL,
            solution   TEXT NOT NULL,
            language   TEXT DEFAULT 'auto',
            created_at REAL,
            use_count  INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS chat_history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at REAL
        );
        CREATE INDEX IF NOT EXISTS idx_chat ON chat_history(session_id, created_at);
    """)
    con.commit()
    con.close()
    logger.info("SQLite DB ready.")

# ── Text extraction ────────────────────────────────────────────────────────────
def extract_text(path: Path) -> list[str]:
    suffix = path.suffix.lower()
    chunks: list[str] = []
    try:
        if suffix == ".pdf":
            from pypdf import PdfReader
            for page in PdfReader(str(path)).pages:
                text = page.extract_text() or ""
                for para in text.split("\n\n"):
                    if len(para.strip()) > 50:
                        chunks.append(para.strip())

        elif suffix == ".docx":
            from docx import Document
            buf: list[str] = []
            for para in Document(str(path)).paragraphs:
                if para.text.strip():
                    buf.append(para.text.strip())
                    if len("\n".join(buf)) > 500:
                        chunks.append("\n".join(buf))
                        buf = []
            if buf:
                chunks.append("\n".join(buf))

        elif suffix == ".txt":
            for para in path.read_text(encoding="utf-8", errors="ignore").split("\n\n"):
                if len(para.strip()) > 30:
                    chunks.append(para.strip())

        elif suffix in (".xlsx", ".xls", ".csv"):
            import openpyxl
            wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
            for ws in wb.worksheets:
                rows = [
                    " | ".join(str(c) for c in row if c is not None)
                    for row in ws.iter_rows(values_only=True)
                ]
                rows = [r for r in rows if r.strip()]
                if rows:
                    chunks.append(f"[Sheet: {ws.title}]\n" + "\n".join(rows))

    except Exception as e:
        logger.error(f"Extraction error for {path.name}: {e}")

    return chunks

# ── Embedding ──────────────────────────────────────────────────────────────────
def embed(texts: list[str]) -> list[list[float]]:
    client = ollama_sdk.Client(host=OLLAMA_BASE_URL)
    # ollama >= 0.3.x returns a typed EmbeddingsResponse object, not a dict
    return [client.embeddings(model=EMBED_MODEL, prompt=t).embedding for t in texts]

# ── File ingestion ─────────────────────────────────────────────────────────────
def ingest_file(path: Path):
    file_hash = hashlib.md5(path.read_bytes()).hexdigest()

    con = get_db()
    row = con.execute(
        "SELECT file_hash FROM ingested_files WHERE filename=?", (path.name,)
    ).fetchone()
    con.close()

    if row and row["file_hash"] == file_hash:
        logger.info(f"Unchanged, skipping: {path.name}")
        return

    chunks = extract_text(path)
    if not chunks:
        logger.warning(f"No content from {path.name}")
        return

    embeddings = embed(chunks)
    ids  = [f"{path.stem}_{i}_{file_hash[:8]}" for i in range(len(chunks))]
    meta = [{"source": path.name, "chunk": i} for i in range(len(chunks))]
    docs_collection.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=meta)

    con = get_db()
    con.execute(
        "INSERT OR REPLACE INTO ingested_files(filename,file_hash,chunks,ingested_at) VALUES(?,?,?,?)",
        (path.name, file_hash, len(chunks), time.time()),
    )
    con.commit()
    con.close()
    logger.success(f"Ingested {path.name} → {len(chunks)} chunks")

def ingest_all_uploads():
    supported = {".pdf", ".docx", ".txt", ".xlsx", ".xls", ".csv"}
    for f in UPLOAD_DIR.iterdir():
        if f.suffix.lower() in supported:
            try:
                ingest_file(f)
            except Exception as e:
                logger.error(f"Failed {f.name}: {e}")

# ── File watcher ───────────────────────────────────────────────────────────────
class UploadWatcher(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            time.sleep(1)
            try:
                ingest_file(Path(event.src_path))
            except Exception as e:
                logger.error(f"Watcher error: {e}")

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a bilingual customer service AI assistant.
Help staff resolve customer problems related to documents.

RULES:
1. Respond in the SAME language the user writes in (Arabic or English).
2. Base your answer ONLY on the provided context. Never guess.
3. If the answer is not in the context, say so clearly.
4. Be concise, professional, and empathetic.
5. Mention the source document name when referencing it.
6. For Arabic: use Modern Standard Arabic (فصحى).

أنت مساعد خدمة عملاء ثنائي اللغة. أجب بناءً على السياق المقدم فقط.
"""

# ── RAG query ──────────────────────────────────────────────────────────────────
def rag_query(question: str, session_id: str) -> dict:
    q_embed = embed([question])[0]

    # Search documents
    doc_context = ""
    sources: list[str] = []
    if docs_collection.count() > 0:
        results = docs_collection.query(
            query_embeddings=[q_embed],
            n_results=min(5, docs_collection.count()),
            include=["documents", "metadatas", "distances"],
        )
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            if dist < 0.6:
                doc_context += f"\n[Source: {meta.get('source','?')}]\n{doc}\n"
                src = meta.get("source", "?")
                if src not in sources:
                    sources.append(src)

    # Search learned solutions
    sol_context = ""
    if sol_collection.count() > 0:
        sol_res = sol_collection.query(
            query_embeddings=[q_embed],
            n_results=min(3, sol_collection.count()),
            include=["documents", "distances"],
        )
        for doc, dist in zip(sol_res["documents"][0], sol_res["distances"][0]):
            if dist < 0.4:
                sol_context += f"\n{doc}\n"

    parts = []
    if doc_context:
        parts.append("--- Document Knowledge ---\n" + doc_context)
    if sol_context:
        parts.append("--- Known Solutions ---\n" + sol_context)
    full_context = "\n".join(parts) if parts else "No relevant documents found."

    # Load this user's conversation history
    con = get_db()
    history_rows = con.execute(
        "SELECT role, content FROM chat_history WHERE session_id=? ORDER BY created_at DESC LIMIT 8",
        (session_id,)
    ).fetchall()
    con.close()

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for row in reversed(history_rows):
        messages.append({"role": row["role"], "content": row["content"]})
    messages.append({"role": "user", "content": f"Context:\n{full_context}\n\nQuestion: {question}"})

    client = ollama_sdk.Client(host=OLLAMA_BASE_URL)
    response = client.chat(model=CHAT_MODEL, messages=messages)
    # ollama >= 0.3.x returns a typed ChatResponse object, not a dict
    answer = response.message.content

    # Save to this user's history
    con = get_db()
    now = time.time()
    con.execute("INSERT INTO chat_history(session_id,role,content,created_at) VALUES(?,?,?,?)",
                (session_id, "user", question, now))
    con.execute("INSERT INTO chat_history(session_id,role,content,created_at) VALUES(?,?,?,?)",
                (session_id, "assistant", answer, now))
    con.execute("""DELETE FROM chat_history WHERE session_id=? AND id NOT IN (
        SELECT id FROM chat_history WHERE session_id=? ORDER BY created_at DESC LIMIT 20
    )""", (session_id, session_id))
    con.commit()
    con.close()

    return {"answer": answer, "sources": sources}

# ── FastAPI ────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Docs Agent starting...")
    init_db()
    init_chroma()       # retries built-in
    ingest_all_uploads()
    observer = Observer()
    observer.schedule(UploadWatcher(), str(UPLOAD_DIR), recursive=False)
    observer.start()
    logger.success("Docs Agent ready.")
    yield
    observer.stop()
    observer.join()

app = FastAPI(title="Docs RAG Agent", version="2.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Pydantic models ────────────────────────────────────────────────────────────
class QuestionRequest(BaseModel):
    question: str
    session_id: str = "anonymous"

class LearnRequest(BaseModel):
    problem: str
    solution: str
    language: Optional[str] = "auto"

# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "agent": "docs-rag", "model": CHAT_MODEL}

@app.get("/stats", dependencies=[Depends(require_api_key)])
async def stats():
    con = get_db()
    files = con.execute("SELECT COUNT(*), SUM(chunks) FROM ingested_files").fetchone()
    sols  = con.execute("SELECT COUNT(*) FROM solutions").fetchone()
    con.close()
    return {
        "ingested_files":   files[0] or 0,
        "total_chunks":     files[1] or 0,
        "known_solutions":  sols[0]  or 0,
        "chroma_docs":      docs_collection.count(),
        "chroma_solutions": sol_collection.count(),
    }

@app.post("/ask", dependencies=[Depends(require_api_key)])
async def ask(req: QuestionRequest, request: Request):
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty")
    check_rate_limit(req.session_id or request.client.host)
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, rag_query, req.question, req.session_id
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ask error [{req.session_id}]: {e}")
        raise HTTPException(500, "Internal error — please try again")

@app.post("/upload", dependencies=[Depends(require_api_key)])
async def upload_doc(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    allowed = {".pdf", ".docx", ".txt", ".xlsx", ".xls", ".csv"}
    suffix  = Path(file.filename).suffix.lower()
    if suffix not in allowed:
        raise HTTPException(400, f"Unsupported type '{suffix}'. Allowed: {sorted(allowed)}")
    dest = UPLOAD_DIR / file.filename
    dest.write_bytes(await file.read())
    background_tasks.add_task(ingest_file, dest)
    return {"message": f"'{file.filename}' received. Ingesting in background.", "filename": file.filename}

@app.get("/documents", dependencies=[Depends(require_api_key)])
async def list_documents():
    con  = get_db()
    rows = con.execute(
        "SELECT filename, chunks, ingested_at FROM ingested_files ORDER BY ingested_at DESC"
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.delete("/documents/{filename}", dependencies=[Depends(require_api_key)])
async def delete_document(filename: str):
    path = UPLOAD_DIR / filename
    if path.exists():
        path.unlink()
    results = docs_collection.get(where={"source": filename})
    if results["ids"]:
        docs_collection.delete(ids=results["ids"])
    con = get_db()
    con.execute("DELETE FROM ingested_files WHERE filename=?", (filename,))
    con.commit()
    con.close()
    return {"message": f"Deleted '{filename}' ({len(results.get('ids', []))} chunks)."}

@app.post("/learn", dependencies=[Depends(require_api_key)])
async def learn_solution(req: LearnRequest, background_tasks: BackgroundTasks):
    if not req.problem.strip() or not req.solution.strip():
        raise HTTPException(400, "Both 'problem' and 'solution' required")
    doc_text = f"Problem: {req.problem}\nSolution: {req.solution}"
    doc_id   = hashlib.md5(req.problem.encode()).hexdigest()

    def _save():
        vec = embed([doc_text])[0]
        sol_collection.upsert(
            ids=[doc_id], embeddings=[vec], documents=[doc_text],
            metadatas=[{"problem": req.problem[:200], "language": req.language}],
        )
        con = get_db()
        con.execute(
            "INSERT OR REPLACE INTO solutions(problem,solution,language,created_at) VALUES(?,?,?,?)",
            (req.problem, req.solution, req.language, time.time()),
        )
        con.commit()
        con.close()
        logger.success(f"Learned: {req.problem[:60]}")

    background_tasks.add_task(_save)
    return {"message": "Solution saved. Will be used in future answers."}

@app.get("/solutions", dependencies=[Depends(require_api_key)])
async def list_solutions(limit: int = 50):
    con  = get_db()
    rows = con.execute(
        "SELECT problem, solution, language, created_at, use_count FROM solutions ORDER BY created_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]

@app.delete("/history/{session_id}", dependencies=[Depends(require_api_key)])
async def clear_history(session_id: str):
    con = get_db()
    cursor = con.cursor()
    cursor.execute("DELETE FROM chat_history WHERE session_id=?", (session_id,))
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
