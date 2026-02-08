const { getPool } = require("./db");

// ────────────────── Dashboard Stats ──────────────────

async function getDashboardStats() {
  const pool = getPool();
  
  // Aggregate counts
  const [
    { rows: userRows },
    { rows: workspaceRows },
    { rows: agentRows },
    { rows: callRows },
    { rows: jobRows },
    { rows: phoneRows },
    { rows: contactRows },
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM users`),
    pool.query(`SELECT COUNT(*) as count FROM workspaces`),
    pool.query(`SELECT COUNT(*) as count FROM agents`),
    pool.query(`SELECT COUNT(*) as count FROM calls`),
    pool.query(`SELECT COUNT(*) as count FROM outbound_jobs`),
    pool.query(`SELECT COUNT(*) as count FROM phone_numbers`),
    pool.query(`SELECT COUNT(*) as count FROM contacts`),
  ]);

  // Revenue (sum of cost_usd from calls)
  const { rows: revenueRows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) as total FROM calls WHERE cost_usd IS NOT NULL`
  );

  // Paid vs trial workspaces
  const { rows: paidRows } = await pool.query(
    `SELECT COUNT(*) as count FROM workspaces WHERE is_paid = true`
  );
  const { rows: trialRows } = await pool.query(
    `SELECT COUNT(*) as count FROM workspaces WHERE is_trial = true`
  );

  // Calls by time period
  const now = Date.now();
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const monthStart = now - 30 * 24 * 60 * 60 * 1000;

  const [
    { rows: callsTodayRows },
    { rows: callsWeekRows },
    { rows: callsMonthRows },
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM calls WHERE started_at >= $1`, [todayStart]),
    pool.query(`SELECT COUNT(*) as count FROM calls WHERE started_at >= $1`, [weekStart]),
    pool.query(`SELECT COUNT(*) as count FROM calls WHERE started_at >= $1`, [monthStart]),
  ]);

  return {
    totalUsers: Number(userRows[0]?.count || 0),
    totalWorkspaces: Number(workspaceRows[0]?.count || 0),
    totalAgents: Number(agentRows[0]?.count || 0),
    totalCalls: Number(callRows[0]?.count || 0),
    totalOutboundJobs: Number(jobRows[0]?.count || 0),
    totalPhoneNumbers: Number(phoneRows[0]?.count || 0),
    totalContacts: Number(contactRows[0]?.count || 0),
    totalRevenue: Number(revenueRows[0]?.total || 0),
    paidWorkspaces: Number(paidRows[0]?.count || 0),
    trialWorkspaces: Number(trialRows[0]?.count || 0),
    callsToday: Number(callsTodayRows[0]?.count || 0),
    callsThisWeek: Number(callsWeekRows[0]?.count || 0),
    callsThisMonth: Number(callsMonthRows[0]?.count || 0),
  };
}

// ────────────────── Users ──────────────────

function rowToUser(r) {
  return {
    id: r.id,
    email: r.email,
    name: r.name || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function listAllUsers({ search, limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  let query = `SELECT u.* FROM users u`;
  const params = [];
  let paramIdx = 1;

  if (search) {
    const searchLower = `%${String(search).toLowerCase()}%`;
    query += ` WHERE (LOWER(u.email) LIKE $${paramIdx} OR LOWER(u.name) LIKE $${paramIdx})`;
    params.push(searchLower);
    paramIdx++;
  }

  query += ` ORDER BY u.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(query, params);
  return rows.map(rowToUser);
}

async function getUserDetail(id) {
  const pool = getPool();
  
  // Get user
  const { rows: userRows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (userRows.length === 0) return null;
  const user = rowToUser(userRows[0]);

  // Get workspaces for this user
  const { rows: workspaceRows } = await pool.query(
    `SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  // Get agent counts per workspace
  const workspaceIds = workspaceRows.map((w) => w.id);
  let agentCounts = {};
  if (workspaceIds.length > 0) {
    const placeholders = workspaceIds.map((_, i) => `$${i + 1}`).join(",");
    const { rows: agentCountRows } = await pool.query(
      `SELECT workspace_id, COUNT(*) as count FROM agents WHERE workspace_id IN (${placeholders}) GROUP BY workspace_id`,
      workspaceIds
    );
    agentCountRows.forEach((r) => {
      agentCounts[r.workspace_id] = Number(r.count || 0);
    });
  }

  // Get call counts per workspace
  let callCounts = {};
  if (workspaceIds.length > 0) {
    const placeholders = workspaceIds.map((_, i) => `$${i + 1}`).join(",");
    const { rows: callCountRows } = await pool.query(
      `SELECT workspace_id, COUNT(*) as count FROM calls WHERE workspace_id IN (${placeholders}) GROUP BY workspace_id`,
      workspaceIds
    );
    callCountRows.forEach((r) => {
      callCounts[r.workspace_id] = Number(r.count || 0);
    });
  }

  // Get recent calls (across all user's workspaces)
  const { rows: recentCallRows } = await pool.query(
    `SELECT * FROM calls WHERE workspace_id IN (${workspaceIds.length > 0 ? workspaceIds.map((_, i) => `$${i + 1}`).join(",") : "NULL"}) ORDER BY started_at DESC LIMIT 20`,
    workspaceIds.length > 0 ? workspaceIds : []
  );

  return {
    user,
    workspaces: workspaceRows.map((w) => ({
      id: w.id,
      name: w.name,
      userId: w.user_id,
      isTrial: w.is_trial,
      isPaid: w.is_paid,
      trialCreditUsd: Number(w.trial_credit_usd || 0),
      telephonyEnabled: w.telephony_enabled,
      stripeCustomerId: w.stripe_customer_id,
      stripeSubscriptionId: w.stripe_subscription_id,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      agentCount: agentCounts[w.id] || 0,
      callCount: callCounts[w.id] || 0,
    })),
    recentCalls: recentCallRows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      agentId: r.agent_id,
      agentName: r.agent_name || "Unknown",
      to: r.to,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      durationSec: r.duration_sec,
      outcome: r.outcome,
      costUsd: r.cost_usd,
    })),
  };
}

// ────────────────── Workspaces ──────────────────

function rowToWorkspace(r) {
  return {
    id: r.id,
    name: r.name,
    userId: r.user_id,
    isTrial: r.is_trial,
    isPaid: r.is_paid,
    trialCreditUsd: Number(r.trial_credit_usd || 0),
    telephonyEnabled: r.telephony_enabled,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function listAllWorkspaces({ search, isPaid, limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  let query = `
    SELECT w.*, u.email as owner_email, u.name as owner_name
    FROM workspaces w
    LEFT JOIN users u ON w.user_id = u.id
  `;
  const params = [];
  let paramIdx = 1;
  const conditions = [];

  if (search) {
    const searchLower = `%${String(search).toLowerCase()}%`;
    conditions.push(`(LOWER(w.name) LIKE $${paramIdx} OR LOWER(u.email) LIKE $${paramIdx})`);
    params.push(searchLower);
    paramIdx++;
  }

  if (isPaid !== undefined) {
    conditions.push(`w.is_paid = $${paramIdx}`);
    params.push(Boolean(isPaid));
    paramIdx++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY w.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(query, params);

  // Get agent and call counts
  const workspaceIds = rows.map((r) => r.id);
  let agentCounts = {};
  let callCounts = {};
  if (workspaceIds.length > 0) {
    const placeholders = workspaceIds.map((_, i) => `$${i + 1}`).join(",");
    const [agentCountRows, callCountRows] = await Promise.all([
      pool.query(`SELECT workspace_id, COUNT(*) as count FROM agents WHERE workspace_id IN (${placeholders}) GROUP BY workspace_id`, workspaceIds),
      pool.query(`SELECT workspace_id, COUNT(*) as count FROM calls WHERE workspace_id IN (${placeholders}) GROUP BY workspace_id`, workspaceIds),
    ]);
    agentCountRows.rows.forEach((r) => {
      agentCounts[r.workspace_id] = Number(r.count || 0);
    });
    callCountRows.rows.forEach((r) => {
      callCounts[r.workspace_id] = Number(r.count || 0);
    });
  }

  return rows.map((r) => ({
    ...rowToWorkspace(r),
    ownerEmail: r.owner_email || null,
    ownerName: r.owner_name || null,
    agentCount: agentCounts[r.id] || 0,
    callCount: callCounts[r.id] || 0,
  }));
}

async function getWorkspaceDetail(id) {
  const pool = getPool();
  
  const { rows: workspaceRows } = await pool.query(
    `SELECT w.*, u.email as owner_email, u.name as owner_name FROM workspaces w LEFT JOIN users u ON w.user_id = u.id WHERE w.id = $1`,
    [id]
  );
  if (workspaceRows.length === 0) return null;
  const w = workspaceRows[0];
  const workspace = {
    ...rowToWorkspace(w),
    ownerEmail: w.owner_email || null,
    ownerName: w.owner_name || null,
  };

  // Get agents
  const { rows: agentRows } = await pool.query(
    `SELECT * FROM agents WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  // Get phone numbers
  const { rows: phoneRows } = await pool.query(
    `SELECT * FROM phone_numbers WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  // Get recent calls
  const { rows: callRows } = await pool.query(
    `SELECT * FROM calls WHERE workspace_id = $1 ORDER BY started_at DESC LIMIT 50`,
    [id]
  );

  return {
    workspace,
    agents: agentRows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      llmModel: r.llm_model || "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    phoneNumbers: phoneRows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      e164: r.e164,
      label: r.label || "",
      status: r.status || "unconfigured",
      inboundAgentId: r.inbound_agent_id,
      outboundAgentId: r.outbound_agent_id,
    })),
    recentCalls: callRows.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      agentName: r.agent_name || "Unknown",
      to: r.to,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      durationSec: r.duration_sec,
      outcome: r.outcome,
      costUsd: r.cost_usd,
    })),
  };
}

// ────────────────── Agents ──────────────────

async function listAllAgents({ workspaceId, search, limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  let query = `
    SELECT a.*, w.name as workspace_name
    FROM agents a
    LEFT JOIN workspaces w ON a.workspace_id = w.id
  `;
  const params = [];
  let paramIdx = 1;
  const conditions = [];

  if (workspaceId) {
    conditions.push(`a.workspace_id = $${paramIdx}`);
    params.push(workspaceId);
    paramIdx++;
  }

  if (search) {
    const searchLower = `%${String(search).toLowerCase()}%`;
    conditions.push(`(LOWER(a.name) LIKE $${paramIdx} OR LOWER(w.name) LIKE $${paramIdx})`);
    params.push(searchLower);
    paramIdx++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY a.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(query, params);

  // Get call counts
  const agentIds = rows.map((r) => r.id);
  let callCounts = {};
  let lastCallTimes = {};
  if (agentIds.length > 0) {
    const placeholders = agentIds.map((_, i) => `$${i + 1}`).join(",");
    const { rows: callCountRows } = await pool.query(
      `SELECT agent_id, COUNT(*) as count, MAX(started_at) as last_call FROM calls WHERE agent_id IN (${placeholders}) GROUP BY agent_id`,
      agentIds
    );
    callCountRows.forEach((r) => {
      callCounts[r.agent_id] = Number(r.count || 0);
      lastCallTimes[r.agent_id] = r.last_call || null;
    });
  }

  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name || null,
    name: r.name,
    llmModel: r.llm_model || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    totalCalls: callCounts[r.id] || 0,
    lastCallAt: lastCallTimes[r.id] || null,
  }));
}

async function getAgentDetail(id) {
  const pool = getPool();
  
  const { rows: agentRows } = await pool.query(
    `SELECT a.*, w.name as workspace_name FROM agents a LEFT JOIN workspaces w ON a.workspace_id = w.id WHERE a.id = $1`,
    [id]
  );
  if (agentRows.length === 0) return null;
  const r = agentRows[0];
  const agent = {
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name || null,
    name: r.name,
    promptDraft: r.prompt_draft || "",
    promptPublished: r.prompt_published || "",
    publishedAt: r.published_at,
    welcome: r.welcome || {},
    voice: r.voice || {},
    llmModel: r.llm_model || "",
    autoEvalEnabled: r.auto_eval_enabled,
    maxCallSeconds: r.max_call_seconds || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

  // Get call history
  const { rows: callRows } = await pool.query(
    `SELECT * FROM calls WHERE agent_id = $1 ORDER BY started_at DESC LIMIT 100`,
    [id]
  );

  return {
    agent,
    calls: callRows.map((c) => ({
      id: c.id,
      workspaceId: c.workspace_id,
      to: c.to,
      startedAt: c.started_at,
      endedAt: c.ended_at,
      durationSec: c.duration_sec,
      outcome: c.outcome,
      costUsd: c.cost_usd,
    })),
  };
}

// ────────────────── Calls ──────────────────

async function listAllCalls({ workspaceId, agentId, dateFrom, dateTo, limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  let query = `
    SELECT c.*, w.name as workspace_name, a.name as agent_name
    FROM calls c
    LEFT JOIN workspaces w ON c.workspace_id = w.id
    LEFT JOIN agents a ON c.agent_id = a.id
  `;
  const params = [];
  let paramIdx = 1;
  const conditions = [];

  if (workspaceId) {
    conditions.push(`c.workspace_id = $${paramIdx}`);
    params.push(workspaceId);
    paramIdx++;
  }

  if (agentId) {
    conditions.push(`c.agent_id = $${paramIdx}`);
    params.push(agentId);
    paramIdx++;
  }

  if (dateFrom) {
    conditions.push(`c.started_at >= $${paramIdx}`);
    params.push(Number(dateFrom));
    paramIdx++;
  }

  if (dateTo) {
    conditions.push(`c.started_at <= $${paramIdx}`);
    params.push(Number(dateTo));
    paramIdx++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY c.started_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name || null,
    agentId: r.agent_id,
    agentName: r.agent_name || r.agent_name || "Unknown",
    to: r.to,
    roomName: r.room_name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSec: r.duration_sec,
    outcome: r.outcome,
    costUsd: r.cost_usd,
  }));
}

async function getCallDetail(id) {
  const pool = getPool();
  
  const { rows: callRows } = await pool.query(
    `SELECT c.*, w.name as workspace_name FROM calls c LEFT JOIN workspaces w ON c.workspace_id = w.id WHERE c.id = $1`,
    [id]
  );
  if (callRows.length === 0) return null;
  const r = callRows[0];
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name || null,
    agentId: r.agent_id,
    agentName: r.agent_name || "Unknown",
    to: r.to,
    roomName: r.room_name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSec: r.duration_sec,
    outcome: r.outcome,
    costUsd: r.cost_usd,
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
    recording: r.recording || null,
    metrics: r.metrics || null,
  };
}

// ────────────────── Outbound Jobs ──────────────────

async function listAllOutboundJobs({ workspaceId, status, limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  let query = `
    SELECT j.*, w.name as workspace_name
    FROM outbound_jobs j
    LEFT JOIN workspaces w ON j.workspace_id = w.id
  `;
  const params = [];
  let paramIdx = 1;
  const conditions = [];

  if (workspaceId) {
    conditions.push(`j.workspace_id = $${paramIdx}`);
    params.push(workspaceId);
    paramIdx++;
  }

  if (status) {
    conditions.push(`j.status = $${paramIdx}`);
    params.push(String(status));
    paramIdx++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY j.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name || null,
    phoneE164: r.phone_e164,
    leadName: r.lead_name || "",
    status: r.status,
    attempts: r.attempts || 0,
    maxAttempts: r.max_attempts || 3,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ────────────────── Phone Numbers ──────────────────

async function listAllPhoneNumbers({ workspaceId, limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  let query = `
    SELECT p.*, w.name as workspace_name
    FROM phone_numbers p
    LEFT JOIN workspaces w ON p.workspace_id = w.id
  `;
  const params = [];
  let paramIdx = 1;
  const conditions = [];

  if (workspaceId) {
    conditions.push(`p.workspace_id = $${paramIdx}`);
    params.push(workspaceId);
    paramIdx++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY p.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name || null,
    e164: r.e164,
    label: r.label || "",
    status: r.status || "unconfigured",
    inboundAgentId: r.inbound_agent_id,
    outboundAgentId: r.outbound_agent_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ────────────────── Contacts ──────────────────

async function listAllContacts({ workspaceId, search, limit = 100, offset = 0 } = {}) {
  const pool = getPool();
  let query = `
    SELECT c.*, w.name as workspace_name
    FROM contacts c
    LEFT JOIN workspaces w ON c.workspace_id = w.id
  `;
  const params = [];
  let paramIdx = 1;
  const conditions = [];

  if (workspaceId) {
    conditions.push(`c.workspace_id = $${paramIdx}`);
    params.push(workspaceId);
    paramIdx++;
  }

  if (search) {
    const searchLower = `%${String(search).toLowerCase()}%`;
    conditions.push(`(LOWER(c.name) LIKE $${paramIdx} OR LOWER(c.phone_e164) LIKE $${paramIdx} OR LOWER(c.email) LIKE $${paramIdx})`);
    params.push(searchLower);
    paramIdx++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY c.last_call_at DESC NULLS LAST, c.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name || null,
    phoneE164: r.phone_e164,
    name: r.name || "",
    email: r.email || "",
    company: r.company || "",
    tags: Array.isArray(r.tags) ? r.tags : [],
    totalCalls: Number(r.total_calls || 0),
    lastCallAt: r.last_call_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

// ────────────────── Billing Overview ──────────────────

async function getBillingOverview() {
  const pool = getPool();
  
  // Paid vs trial breakdown
  const { rows: paidRows } = await pool.query(`SELECT COUNT(*) as count FROM workspaces WHERE is_paid = true`);
  const { rows: trialRows } = await pool.query(`SELECT COUNT(*) as count FROM workspaces WHERE is_trial = true`);
  
  // Total revenue
  const { rows: revenueRows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) as total FROM calls WHERE cost_usd IS NOT NULL`
  );

  // Workspaces with Stripe subscriptions
  const { rows: stripeRows } = await pool.query(
    `SELECT COUNT(*) as count FROM workspaces WHERE stripe_subscription_id IS NOT NULL`
  );

  // Per-workspace billing status
  const { rows: workspaceBillingRows } = await pool.query(
    `SELECT 
      w.id, w.name, w.is_paid, w.is_trial, w.trial_credit_usd, w.stripe_customer_id, w.stripe_subscription_id,
      u.email as owner_email
    FROM workspaces w
    LEFT JOIN users u ON w.user_id = u.id
    ORDER BY w.created_at DESC
    LIMIT 100`
  );

  return {
    paidWorkspaces: Number(paidRows[0]?.count || 0),
    trialWorkspaces: Number(trialRows[0]?.count || 0),
    totalRevenue: Number(revenueRows[0]?.total || 0),
    stripeSubscriptions: Number(stripeRows[0]?.count || 0),
    workspaceBilling: workspaceBillingRows.map((r) => ({
      workspaceId: r.id,
      workspaceName: r.name,
      ownerEmail: r.owner_email || null,
      isPaid: r.is_paid,
      isTrial: r.is_trial,
      trialCreditUsd: Number(r.trial_credit_usd || 0),
      stripeCustomerId: r.stripe_customer_id,
      stripeSubscriptionId: r.stripe_subscription_id,
    })),
  };
}

module.exports = {
  getPool,
  getDashboardStats,
  listAllUsers,
  getUserDetail,
  listAllWorkspaces,
  getWorkspaceDetail,
  listAllAgents,
  getAgentDetail,
  listAllCalls,
  getCallDetail,
  listAllOutboundJobs,
  listAllPhoneNumbers,
  listAllContacts,
  getBillingOverview,
};
