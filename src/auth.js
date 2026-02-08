const jwt = require("jsonwebtoken");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

if (!ADMIN_PASSWORD) {
  console.warn("[WARN] ADMIN_PASSWORD not set - admin login will fail");
}

// Admin login endpoint handler
function handleAdminLogin(req, res) {
  const { password } = req.body;
  
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // Generate JWT token (expires in 24 hours)
  const token = jwt.sign(
    { admin: true, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  return res.json({ token });
}

// Middleware to require admin authentication
function requireAdmin(req, res, next) {
  const token = getAuthToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.admin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.admin = decoded;
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

function getAuthToken(req) {
  const h = String(req.headers.authorization || "").trim();
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  
  // Also check cookie (for browser requests)
  const cookies = String(req.headers.cookie || "");
  const match = cookies.match(/admin_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = { handleAdminLogin, requireAdmin };
