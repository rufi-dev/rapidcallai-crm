const express = require("express");
const { createCrmRouter } = require("./routes");
const { requireAuth } = require("./auth");
const { getPool } = require("./store");

const app = express();

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.CLIENT_ORIGIN || "https://dashboard.rapidcall.ai",
    "http://localhost:5173", // Vite dev server
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
    console.log(`[CRM] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get("/health", async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "crm", db: "connected" });
  } catch (e) {
    res.status(503).json({ ok: false, service: "crm", error: e.message });
  }
});

// CRM routes
app.use("/api/crm", requireAuth, createCrmRouter({ USE_DB: true }));

const PORT = process.env.PORT || 8788;
app.listen(PORT, () => {
  console.log(`[CRM Service] Listening on port ${PORT}`);
});
