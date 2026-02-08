const express = require("express");
const { z } = require("zod");
const contactStore = require("./store");
const { getPool } = require("./store");

function createCrmRouter({ USE_DB }) {
  const r = express.Router();

  r.get("/contacts", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });
    const search = req.query.search ? String(req.query.search) : undefined;
    const tag = req.query.tag ? String(req.query.tag) : undefined;
    const source = req.query.source ? String(req.query.source) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const contacts = await contactStore.listContacts(req.workspace.id, { search, tag, source, limit, offset });
    return res.json({ contacts });
  });

  r.get("/contacts/:id", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });
    const id = String(req.params.id || "");
    const contact = await contactStore.getContact(id);
    if (!contact || contact.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Fetch recent calls for this contact (query DB directly)
    const pool = getPool();
    const { rows: callRows } = await pool.query(
      `SELECT * FROM calls WHERE workspace_id=$1 AND "to"=$2 ORDER BY started_at DESC LIMIT 20`,
      [req.workspace.id, contact.phoneE164]
    );
    const contactCalls = callRows.map((r) => ({
      id: r.id,
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
      recording: r.recording,
    }));

    // Fetch outbound jobs for this contact
    const { rows: jobRows } = await pool.query(
      `SELECT * FROM outbound_jobs WHERE workspace_id=$1 AND phone_e164=$2 ORDER BY created_at DESC LIMIT 20`,
      [req.workspace.id, contact.phoneE164]
    );
    const contactJobs = jobRows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      agentId: r.agent_id,
      phoneE164: r.phone_e164,
      leadName: r.lead_name,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return res.json({ contact, calls: contactCalls, outboundJobs: contactJobs });
  });

  r.post("/contacts", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });
    const schema = z.object({
      phoneE164: z.string().min(6).max(20),
      name: z.string().max(200).optional(),
      email: z.string().email().max(200).optional(),
      company: z.string().max(200).optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().max(5000).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const phone = String(parsed.data.phoneE164 || "").trim();
    if (!/^\+?[1-9]\d{6,14}$/.test(phone)) {
      return res.status(400).json({ error: "phoneE164 must be in E.164 format" });
    }

    const contact = await contactStore.createContact({
      workspaceId: req.workspace.id,
      phoneE164: phone,
      name: parsed.data.name ?? "",
      email: parsed.data.email ?? "",
      company: parsed.data.company ?? "",
      tags: parsed.data.tags ?? [],
      notes: parsed.data.notes ?? "",
      source: "manual",
      metadata: parsed.data.metadata ?? {},
    });

    return res.status(201).json({ contact });
  });

  r.put("/contacts/:id", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });
    const id = String(req.params.id || "");
    const contact = await contactStore.getContact(id);
    if (!contact || contact.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const schema = z.object({
      name: z.string().max(200).optional(),
      email: z.string().email().max(200).optional(),
      company: z.string().max(200).optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().max(5000).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const updated = await contactStore.updateContact(id, {
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company,
      tags: parsed.data.tags,
      notes: parsed.data.notes,
      metadata: parsed.data.metadata,
    });

    return res.json({ contact: updated });
  });

  r.delete("/contacts/:id", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });
    const id = String(req.params.id || "");
    const contact = await contactStore.getContact(id);
    if (!contact || contact.workspaceId !== req.workspace.id) {
      return res.status(404).json({ error: "Contact not found" });
    }

    await contactStore.deleteContact(id);
    return res.json({ ok: true });
  });

  r.post("/contacts/import", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });

    const csvText = String(req.body.csv || "").trim();
    if (!csvText) {
      return res.status(400).json({ error: "Missing CSV data" });
    }

    // Parse CSV (simple parser - assumes header row)
    const lines = csvText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const phoneIdx = headers.findIndex((h) => h === "phone" || h === "phone_e164" || h === "phonee164");
    if (phoneIdx === -1) {
      return res.status(400).json({ error: "CSV must have a 'phone' or 'phone_e164' column" });
    }

    const nameIdx = headers.findIndex((h) => h === "name");
    const emailIdx = headers.findIndex((h) => h === "email");
    const companyIdx = headers.findIndex((h) => h === "company");
    const tagsIdx = headers.findIndex((h) => h === "tags");

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length <= phoneIdx || !values[phoneIdx]) continue; // Skip rows without phone

      const phone = values[phoneIdx].replace(/[^\d+]/g, ""); // Clean phone number
      if (!/^\+?[1-9]\d{6,14}$/.test(phone)) continue; // Skip invalid phones

      const tagsStr = tagsIdx >= 0 && values[tagsIdx] ? values[tagsIdx] : "";
      const tags = tagsStr ? tagsStr.split(";").map((t) => t.trim()).filter((t) => t) : [];

      rows.push({
        phoneE164: phone.startsWith("+") ? phone : `+${phone}`,
        name: nameIdx >= 0 ? values[nameIdx] ?? "" : "",
        email: emailIdx >= 0 ? values[emailIdx] ?? "" : "",
        company: companyIdx >= 0 ? values[companyIdx] ?? "" : "",
        tags,
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: "No valid rows found in CSV" });
    }

    const created = await contactStore.bulkCreateContacts(req.workspace.id, rows);
    return res.status(201).json({ contacts: created, imported: created.length, total: rows.length });
  });

  r.post("/contacts/backfill", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });

    const workspaceId = req.workspace.id;
    let created = 0;
    let updated = 0;

    // Backfill from calls (query DB directly)
    const pool = getPool();
    const { rows: callRows } = await pool.query(`SELECT * FROM calls WHERE workspace_id=$1`, [workspaceId]);
    const calls = callRows.map((r) => ({
      id: r.id,
      to: r.to,
      outcome: r.outcome,
      startedAt: r.started_at,
    }));

    const phoneToName = new Map();

    // Also check outbound_jobs for names
    const { rows: jobRows } = await pool.query(
      `SELECT phone_e164, lead_name FROM outbound_jobs WHERE workspace_id=$1 LIMIT 10000`,
      [workspaceId]
    );
    for (const job of jobRows) {
      if (job.phone_e164 && job.lead_name) {
        const existing = phoneToName.get(job.phone_e164);
        if (!existing || existing.length < job.lead_name.length) {
          phoneToName.set(job.phone_e164, job.lead_name);
        }
      }
    }

    for (const call of calls) {
      if (!call.to || call.to === "webtest" || !/^\+?[1-9]\d{6,14}$/.test(call.to)) continue;

      const phone = call.to.startsWith("+") ? call.to : `+${call.to}`;
      const name = phoneToName.get(phone) ?? "";

      const existing = await contactStore.getContactByPhone(workspaceId, phone);
      if (existing) {
        updated++;
      } else {
        await contactStore.upsertContactFromCall(workspaceId, phone, name, call.outcome === "in_progress" ? "inbound" : "inbound");
        created++;
      }
    }

    // Update total_calls and last_call_at for existing contacts
    for (const call of calls) {
      if (!call.to || call.to === "webtest" || !/^\+?[1-9]\d{6,14}$/.test(call.to)) continue;
      const phone = call.to.startsWith("+") ? call.to : `+${call.to}`;
      const contact = await contactStore.getContactByPhone(workspaceId, phone);
      if (contact) {
        await contactStore.updateContact(contact.id, {
          totalCalls: contact.totalCalls + 1,
          lastCallAt: call.startedAt,
          lastCallOutcome: call.outcome,
        });
      }
    }

    return res.json({ created, updated, total: created + updated });
  });

  // Endpoint for main API to call (for auto-create from calls)
  r.post("/contacts/upsert-from-call", async (req, res) => {
    if (!USE_DB) return res.status(400).json({ error: "Contacts require Postgres mode" });
    const { workspaceId, phoneE164, name, source } = req.body;
    if (!workspaceId || !phoneE164) {
      return res.status(400).json({ error: "Missing workspaceId or phoneE164" });
    }
    const contact = await contactStore.upsertContactFromCall(workspaceId, phoneE164, name || "", source || "inbound");
    return res.json({ contact });
  });

  return r;
}

module.exports = { createCrmRouter };
