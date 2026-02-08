const express = require("express");
const path = require("path");
const { createAdminRouter } = require("./routes");
const { handleAdminLogin, requireAdmin } = require("./auth");
const { getPool } = require("./store");

const app = express();

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.CLIENT_ORIGIN || "https://crm.rapidcall.ai",
    "http://localhost:5174", // Vite dev server for CRM
    "http://localhost:3000",
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-csrf-token");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[Admin Panel] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get("/health", async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "admin-panel", db: "connected" });
  } catch (e) {
    res.status(503).json({ ok: false, service: "admin-panel", error: e.message });
  }
});

// Admin login (public endpoint)
app.post("/api/admin/login", handleAdminLogin);

// Admin routes (protected)
app.use("/api/admin", requireAdmin, createAdminRouter());

// Serve frontend static files (built by Vite)
const STATIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(STATIC_DIR));
// SPA fallback: serve index.html for any non-API route
app.get("*", (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

const PORT = process.env.PORT || 8788;
app.listen(PORT, () => {
  console.log(`[Admin Panel] Listening on port ${PORT}`);
  console.log(`[Admin Panel] Serving frontend from ${STATIC_DIR}`);
});
