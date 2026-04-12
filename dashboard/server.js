const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Readable } = require("stream");
const app = express();
const db = require("./database");

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
    const email = process.env.INITIAL_ADMIN_EMAIL || "admin@company.com";
    const passwordText = process.env.INITIAL_ADMIN_PASSWORD || "changeme123";
    const hash = await bcrypt.hash(passwordText, 10);

    const insert = db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    );
    insert.run("Super Admin", email, hash, "Super Admin");
    console.log(`Created default Super Admin user: ${email}`);
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
  const { email, password } = req.body;
  const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  const user = stmt.get(email);

  if (user && (await bcrypt.compare(password, user.password_hash))) {
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } else {
    res.status(401).json({ error: "Invalid email or password" });
  }
});

// User Management Routes (Super Admin)
app.get("/api/users", authenticateToken, requireSuperAdmin, (req, res) => {
  const users = db
    .prepare(
      "SELECT id, name, email, role, mobile_number, created_at FROM users",
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

// Proxy Chat Stream to Ollama
app.post("/api/chat", authenticateToken, async (req, res) => {
  try {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) throw new Error(`Ollama Error: ${response.statusText}`);

    res.setHeader("Content-Type", "application/x-ndjson");
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("Chat error:", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Ollama chat failed" });
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

app.listen(PORT, () => {
  console.log(`CS Dashboard Backend running on port ${PORT}`);
});
