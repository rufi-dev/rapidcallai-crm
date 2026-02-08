const { getPool } = require("./store");

// Shared authentication with main API
// Validates tokens against same sessions table
async function requireAuth(req, res, next) {
  const token = getAuthToken(req);
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id, expires_at FROM sessions WHERE token = $1`,
    [token]
  );

  if (rows.length === 0) return res.status(401).json({ error: "Invalid session" });
  
  const session = rows[0];
  if (session.expires_at && session.expires_at < Date.now()) {
    await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
    return res.status(401).json({ error: "Session expired" });
  }

  // Get user and workspace
  const { rows: userRows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [session.user_id]);
  if (userRows.length === 0) return res.status(401).json({ error: "User not found" });

  const user = userRows[0];
  const { rows: workspaceRows } = await pool.query(
    `SELECT * FROM workspaces WHERE user_id = $1 LIMIT 1`,
    [user.id]
  );

  if (workspaceRows.length === 0) {
    return res.status(401).json({ error: "Workspace not found" });
  }

  req.user = { id: user.id, email: user.email, name: user.name };
  req.workspace = workspaceRows[0];
  req.sessionToken = token;
  return next();
}

function getAuthToken(req) {
  const h = String(req.headers.authorization || "").trim();
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  
  // Also check cookie (for browser requests)
  const cookies = String(req.headers.cookie || "");
  const match = cookies.match(/auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = { requireAuth };
