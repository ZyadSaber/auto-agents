const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Readable } = require("stream");
const multer = require("multer");
const FormData = require("form-data");
const pty = require("node-pty");
const { WebSocketServer } = require("ws");
const http = require("http");
const app = express();
const server = http.createServer(app);
const db = require("./database");

const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 3001;
const JWT_SECRET =
  process.env.JWT_SECRET || "cs-jwt-secret-change-in-production";

app.use(cors());
app.use(express.json());

// Initialize Super Admin if none exists
const initSuperAdmin = async () => {
  const adminQuery = db.prepare(
    "SELECT * FROM users WHERE role = 'Super Admin'",
  );
  const adminCountQuery = db.prepare("SELECT COUNT(*) as count FROM users");
  const count = adminCountQuery.get().count;

  if (count === 0) {
    const username = process.env.INITIAL_ADMIN_USERNAME || "admin";
    const passwordText = process.env.INITIAL_ADMIN_PASSWORD || "changeme123";
    const hash = await bcrypt.hash(passwordText, 10);

    const insert = db.prepare(
      "INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)",
    );
    insert.run("Super Admin", username, hash, "Super Admin");
    console.log(`Created default Super Admin user: ${username}`);
  }
};

initSuperAdmin().catch(console.error);

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Check Super Admin Middleware
const requireSuperAdmin = (req, res, next) => {
  if (req.user && req.user.role === "Super Admin") {
    next();
  } else {
    res.status(403).json({ error: "Super Admin access required" });
  }
};

// Auth Routes
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
  const user = stmt.get(username);

  if (user && (await bcrypt.compare(password, user.password_hash))) {
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });
  } else {
    res.status(401).json({ error: "Invalid username or password" });
  }
});

// User Management Routes (Super Admin)
app.get("/api/users", authenticateToken, requireSuperAdmin, (req, res) => {
  const users = db
    .prepare(
      "SELECT id, name, username, email, role, mobile_number, created_at FROM users",
    )
    .all();
  res.json(users);
});

// Models route (proxy to Ollama)
app.get("/api/models", authenticateToken, async (req, res) => {
  try {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    // Note: fetch is available in Node 18+
    const response = await fetch(`${ollamaBase}/api/tags`);
    if (!response.ok) throw new Error("Failed to fetch from Ollama");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching models:", err.message);
    res.status(500).json({ error: "Could not fetch models" });
  }
});

// Helper to detect if a string is primarily Arabic
const isArabic = (text) => {
  const arabicPattern = /[\u0600-\u06FF]/;
  return arabicPattern.test(text);
};

// Proxy Chat Stream to Ollama with Language Routing
app.post("/api/chat", authenticateToken, async (req, res) => {
  const abortController = new AbortController();
  
  // Choose model based on input language if not explicitly locked by the user
  let targetModel = req.body.model;
  const lastUserMessage = req.body.messages?.[req.body.messages.length - 1]?.content || "";
  
  if (isArabic(lastUserMessage)) {
    // Priority: Qwen 2.5 (High Performance) -> Aya (Multilingual Specialist) -> Default
    targetModel = process.env.ARABIC_MODEL || "qwen2.5:72b";
  } else {
    // Priority: Llama 3 (English Specialist) -> Default
    targetModel = process.env.ENGLISH_MODEL || "llama3.3:70b";
  }

  // If user explicitly picked a model in the UI dropdown, we respect it
  if (req.body.model && req.body.model !== "auto") {
    targetModel = req.body.model;
  }

  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
      console.log(`Client disconnected, aborting ${targetModel} request.`);
    }
  });

  try {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...req.body,
        model: targetModel // Override with our routed model
      }),
      signal: abortController.signal
    });

    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);

    res.setHeader("Content-Type", "application/x-ndjson");
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log("Ollama request was aborted.");
    } else {
      console.error("Chat error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: "Ollama chat failed" });
    }
  }
});

// Proxy Pull Stream
app.post("/api/models/pull", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaBase}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body), // { name: "llama3" }
    });

    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);

    res.setHeader("Content-Type", "application/x-ndjson");
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Model pull error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Failed to pull model" });
  }
});

// Get currently running models
app.get("/api/models/ps", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaBase}/api/ps`);
    if (!response.ok) throw new Error("Failed to fetch running models");
    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a model
app.delete("/api/models/:name", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaBase}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: req.params.name })
    });
    if (!response.ok) throw new Error("Failed to delete model");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Documents Proxy ---
const DOCS_AGENT_URL = process.env.DOCS_AGENT_URL || "http://localhost:8100";
const AGENT_API_KEY = process.env.AGENT_API_KEY || "cs-internal-agent-key";

app.post("/api/docs/upload", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname);

    const response = await fetch(`${DOCS_AGENT_URL}/upload`, {
      method: "POST",
      headers: {
        "X-API-Key": AGENT_API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Upload failed");
    res.json(data);
  } catch (err) {
    console.error("Upload proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/docs", authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${DOCS_AGENT_URL}/documents`, {
      headers: { "X-API-Key": AGENT_API_KEY },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to fetch documents");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/docs/:filename", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const response = await fetch(`${DOCS_AGENT_URL}/documents/${encodeURIComponent(req.params.filename)}`, {
      method: "DELETE",
      headers: { "X-API-Key": AGENT_API_KEY },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to delete document");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Knowledge Base Proxy ---
app.post("/api/knowledge/learn", authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${DOCS_AGENT_URL}/learn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": AGENT_API_KEY,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to learn solution");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/knowledge/solutions", authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${DOCS_AGENT_URL}/solutions`, {
      headers: { "X-API-Key": AGENT_API_KEY },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Failed to fetch solutions");
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- OpenClaw Proxy ---
const OPENCLAW_URL = process.env.OPENCLAW_URL || "http://localhost:3100";

app.get("/api/openclaw/status", authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${OPENCLAW_URL}/health`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "OpenClaw service unreachable" });
  }
});

app.get("/api/openclaw/qr", authenticateToken, async (req, res) => {
  try {
    // Return the HTML content of the QR page directly
    const response = await fetch(`${OPENCLAW_URL}/qr`);
    const html = await response.text();
    res.send(html);
  } catch (err) {
    res.status(500).send("Could not load QR code");
  }
});

app.post("/api/openclaw/whatsapp/reset", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const response = await fetch(`${OPENCLAW_URL}/api/whatsapp/reset`, {
      method: "POST",
      headers: { "X-API-Key": AGENT_API_KEY }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to reset WhatsApp session" });
  }
});

app.post("/api/openclaw/config", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const response = await fetch(`${OPENCLAW_URL}/api/config`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-API-Key": AGENT_API_KEY 
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to update OpenClaw configuration" });
  }
});

// --- Customer Conversations Proxy ---
const GENERAL_AGENT_URL = process.env.GENERAL_AGENT_URL || "http://localhost:8200";

app.get("/api/customers/sessions", authenticateToken, async (req, res) => {
  try {
    const [docsRes, genRes] = await Promise.all([
      fetch(`${DOCS_AGENT_URL}/sessions`, { headers: { "X-API-Key": AGENT_API_KEY } }),
      fetch(`${GENERAL_AGENT_URL}/sessions`, { headers: { "X-API-Key": AGENT_API_KEY } })
    ]);

    const docsSessions = docsRes.ok ? await docsRes.json() : [];
    const genSessions = genRes.ok ? await genRes.json() : [];

    // Merge by session_id, taking the latest last_seen
    const sessionMap = new Map();
    [...docsSessions, ...genSessions].forEach(s => {
      const existing = sessionMap.get(s.session_id);
      if (!existing || s.last_seen > existing.last_seen) {
        sessionMap.set(s.session_id, s);
      }
    });

    res.json(Array.from(sessionMap.values()).sort((a, b) => b.last_seen - a.last_seen));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customer sessions" });
  }
});

app.get("/api/customers/history/:sessionId", authenticateToken, async (req, res) => {
  try {
    // Try docs agent first, then fallback to general
    let response = await fetch(`${DOCS_AGENT_URL}/history/${encodeURIComponent(req.params.sessionId)}`, {
      headers: { "X-API-Key": AGENT_API_KEY }
    });
    
    if (!response.ok) {
       response = await fetch(`${GENERAL_AGENT_URL}/history/${encodeURIComponent(req.params.sessionId)}`, {
        headers: { "X-API-Key": AGENT_API_KEY }
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversation history" });
  }
});

// --- Interactive Terminal (PTY) ---
let wss;
try {
  wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws) => {
    console.log("Terminal WebSocket connected");

    const shell = process.platform === "win32" ? "powershell.exe" : "bash";
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    });

    ptyProcess.onData((data) => {
      ws.send(data);
    });

    ws.on("message", (message) => {
      // message is a Buffer/String from xterm.js
      ptyProcess.write(message.toString());
    });

    ws.on("close", () => {
      ptyProcess.kill();
      console.log("Terminal WebSocket disconnected");
    });
  });
} catch (err) {
  console.error("Failed to initialize PTY/WebSocket server:", err.message);
}

// Upgrade HTTP connection to WebSocket for terminal
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/terminal" && wss) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});



// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Serve React App in production
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`CS Dashboard Backend running on port ${PORT}`);
});
