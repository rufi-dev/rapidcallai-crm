const { Pool, types } = require("pg");

// Parse BIGINT as number
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

function getDbConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  const sslEnabled = String(process.env.DATABASE_SSL ?? "true").toLowerCase() !== "false";

  return {
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DATABASE_POOL_MAX || 20), // More connections for CRM
    idleTimeoutMillis: 30000,
  };
}

let pool = null;

function getPool() {
  if (pool) return pool;
  const cfg = getDbConfig();
  if (!cfg) {
    throw new Error("DATABASE_URL not set");
  }
  pool = new Pool(cfg);
  return pool;
}

module.exports = { getPool };
