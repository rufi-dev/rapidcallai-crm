const express = require("express");
const { createCrmRouter } = require("./routes");
const { requireAuth } = require("./auth");
const { getPool } = require("./store");

const app = express();
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
