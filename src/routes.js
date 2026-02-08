const express = require("express");
const adminStore = require("./store");

function createAdminRouter() {
  const r = express.Router();

  // ────────────────── Dashboard ──────────────────
  r.get("/dashboard", async (_req, res) => {
    try {
      const stats = await adminStore.getDashboardStats();
      return res.json(stats);
    } catch (e) {
      console.error("[Admin] Dashboard error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Users ──────────────────
  r.get("/users", async (req, res) => {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const users = await adminStore.listAllUsers({ search, limit, offset });
      return res.json({ users });
    } catch (e) {
      console.error("[Admin] List users error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  r.get("/users/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const detail = await adminStore.getUserDetail(id);
      if (!detail) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json(detail);
    } catch (e) {
      console.error("[Admin] Get user error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Workspaces ──────────────────
  r.get("/workspaces", async (req, res) => {
    try {
      const search = req.query.search ? String(req.query.search) : undefined;
      const isPaid = req.query.isPaid !== undefined ? req.query.isPaid === "true" : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const workspaces = await adminStore.listAllWorkspaces({ search, isPaid, limit, offset });
      return res.json({ workspaces });
    } catch (e) {
      console.error("[Admin] List workspaces error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  r.get("/workspaces/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const detail = await adminStore.getWorkspaceDetail(id);
      if (!detail) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      return res.json(detail);
    } catch (e) {
      console.error("[Admin] Get workspace error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Agents ──────────────────
  r.get("/agents", async (req, res) => {
    try {
      const workspaceId = req.query.workspace ? String(req.query.workspace) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const agents = await adminStore.listAllAgents({ workspaceId, search, limit, offset });
      return res.json({ agents });
    } catch (e) {
      console.error("[Admin] List agents error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  r.get("/agents/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const detail = await adminStore.getAgentDetail(id);
      if (!detail) {
        return res.status(404).json({ error: "Agent not found" });
      }
      return res.json(detail);
    } catch (e) {
      console.error("[Admin] Get agent error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Calls ──────────────────
  r.get("/calls", async (req, res) => {
    try {
      const workspaceId = req.query.workspace ? String(req.query.workspace) : undefined;
      const agentId = req.query.agent ? String(req.query.agent) : undefined;
      const dateFrom = req.query.from ? Number(req.query.from) : undefined;
      const dateTo = req.query.to ? Number(req.query.to) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const calls = await adminStore.listAllCalls({ workspaceId, agentId, dateFrom, dateTo, limit, offset });
      return res.json({ calls });
    } catch (e) {
      console.error("[Admin] List calls error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  r.get("/calls/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const call = await adminStore.getCallDetail(id);
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }
      return res.json({ call });
    } catch (e) {
      console.error("[Admin] Get call error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Outbound Jobs ──────────────────
  r.get("/outbound-jobs", async (req, res) => {
    try {
      const workspaceId = req.query.workspace ? String(req.query.workspace) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const jobs = await adminStore.listAllOutboundJobs({ workspaceId, status, limit, offset });
      return res.json({ jobs });
    } catch (e) {
      console.error("[Admin] List outbound jobs error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Phone Numbers ──────────────────
  r.get("/phone-numbers", async (req, res) => {
    try {
      const workspaceId = req.query.workspace ? String(req.query.workspace) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const phoneNumbers = await adminStore.listAllPhoneNumbers({ workspaceId, limit, offset });
      return res.json({ phoneNumbers });
    } catch (e) {
      console.error("[Admin] List phone numbers error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Contacts ──────────────────
  r.get("/contacts", async (req, res) => {
    try {
      const workspaceId = req.query.workspace ? String(req.query.workspace) : undefined;
      const search = req.query.search ? String(req.query.search) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      const contacts = await adminStore.listAllContacts({ workspaceId, search, limit, offset });
      return res.json({ contacts });
    } catch (e) {
      console.error("[Admin] List contacts error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ────────────────── Billing ──────────────────
  r.get("/billing", async (_req, res) => {
    try {
      const overview = await adminStore.getBillingOverview();
      return res.json(overview);
    } catch (e) {
      console.error("[Admin] Billing overview error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  return r;
}

module.exports = { createAdminRouter };
