// ── Auth helpers ──
const TOKEN_KEY = "crm_auth_token";
const API_BASE_KEY = "crm_api_base";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
export function getApiBase(): string {
  return localStorage.getItem(API_BASE_KEY) || "";
}
export function setApiBase(base: string) {
  localStorage.setItem(API_BASE_KEY, base);
}

// ── Fetch wrapper ──
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers || undefined);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, { ...init, headers, credentials: "include" });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
  }
  return res;
}

async function readError(res: Response): Promise<string> {
  try { const t = await res.text(); return t || `${res.status}`; } catch { return `${res.status}`; }
}

// ── Types ──
export interface Contact {
  id: string;
  workspaceId: string;
  phoneE164: string;
  name: string;
  email: string;
  company: string;
  tags: string[];
  notes: string;
  source: string;
  totalCalls: number;
  lastCallAt: number | null;
  lastCallOutcome: string;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface CallRecord {
  id: string;
  agentName: string;
  startedAt: number;
  durationSec: number;
  outcome: string;
}

export interface OutboundJob {
  id: string;
  phoneE164: string;
  leadName: string;
  status: string;
  createdAt: number;
}

// ── Auth API (calls main API) ──
export async function login(mainApiBase: string, email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${mainApiBase}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await readError(res);
    try {
      const j = JSON.parse(txt);
      throw new Error(j.error || txt);
    } catch (e) {
      if (e instanceof Error && e.message !== txt) throw e;
      throw new Error(txt);
    }
  }
  return (await res.json()) as { token: string };
}

// ── Contacts API ──
export async function listContacts(opts?: {
  search?: string; tag?: string; source?: string; limit?: number; offset?: number;
}): Promise<Contact[]> {
  const qs = new URLSearchParams();
  if (opts?.search) qs.set("search", opts.search);
  if (opts?.tag) qs.set("tag", opts.tag);
  if (opts?.source) qs.set("source", opts.source);
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/crm/contacts?${qs}` : "/api/crm/contacts";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load contacts: ${await readError(res)}`);
  return ((await res.json()) as { contacts: Contact[] }).contacts;
}

export async function getContact(id: string): Promise<{ contact: Contact; calls: CallRecord[]; outboundJobs: OutboundJob[] }> {
  const res = await apiFetch(`/api/crm/contacts/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load contact: ${await readError(res)}`);
  return (await res.json()) as { contact: Contact; calls: CallRecord[]; outboundJobs: OutboundJob[] };
}

export async function createContact(input: {
  phoneE164: string; name?: string; email?: string; company?: string; tags?: string[]; notes?: string;
}): Promise<Contact> {
  const res = await apiFetch("/api/crm/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create contact: ${await readError(res)}`);
  return ((await res.json()) as { contact: Contact }).contact;
}

export async function updateContact(id: string, input: {
  name?: string; email?: string; company?: string; tags?: string[]; notes?: string;
}): Promise<Contact> {
  const res = await apiFetch(`/api/crm/contacts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update contact: ${await readError(res)}`);
  return ((await res.json()) as { contact: Contact }).contact;
}

export async function deleteContact(id: string): Promise<void> {
  const res = await apiFetch(`/api/crm/contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete contact: ${await readError(res)}`);
}

export async function importContacts(csv: string): Promise<{ imported: number; total: number }> {
  const res = await apiFetch("/api/crm/contacts/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv }),
  });
  if (!res.ok) throw new Error(`Import failed: ${await readError(res)}`);
  return (await res.json()) as { imported: number; total: number };
}

export async function backfillContacts(): Promise<{ created: number; updated: number; total: number }> {
  const res = await apiFetch("/api/crm/contacts/backfill", { method: "POST" });
  if (!res.ok) throw new Error(`Backfill failed: ${await readError(res)}`);
  return (await res.json()) as { created: number; updated: number; total: number };
}
