// ── Auth helpers ──
const TOKEN_KEY = "admin_auth_token";
const API_BASE = ""; // Same origin

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

// ── Fetch wrapper ──
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init?.headers || undefined);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
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
export interface DashboardStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalAgents: number;
  totalCalls: number;
  totalOutboundJobs: number;
  totalPhoneNumbers: number;
  totalContacts: number;
  totalRevenue: number;
  paidWorkspaces: number;
  trialWorkspaces: number;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserDetail {
  user: User;
  workspaces: Array<{
    id: string;
    name: string;
    userId: string;
    isTrial: boolean;
    isPaid: boolean;
    trialCreditUsd: number;
    telephonyEnabled: boolean;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    createdAt: number;
    updatedAt: number;
    agentCount: number;
    callCount: number;
  }>;
  recentCalls: CallRecord[];
}

export interface Workspace {
  id: string;
  name: string;
  userId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  isTrial: boolean;
  isPaid: boolean;
  trialCreditUsd: number;
  telephonyEnabled: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: number;
  updatedAt: number;
  agentCount: number;
  callCount: number;
}

export interface WorkspaceDetail {
  workspace: Workspace;
  agents: Array<{
    id: string;
    workspaceId: string;
    name: string;
    llmModel: string;
    createdAt: number;
    updatedAt: number;
  }>;
  phoneNumbers: Array<{
    id: string;
    workspaceId: string;
    e164: string;
    label: string;
    status: string;
    inboundAgentId: string | null;
    outboundAgentId: string | null;
  }>;
  recentCalls: CallRecord[];
}

export interface Agent {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  name: string;
  llmModel: string;
  createdAt: number;
  updatedAt: number;
  totalCalls: number;
  lastCallAt: number | null;
}

export interface AgentDetail {
  agent: {
    id: string;
    workspaceId: string;
    workspaceName: string | null;
    name: string;
    promptDraft: string;
    promptPublished: string;
    publishedAt: number | null;
    welcome: Record<string, unknown>;
    voice: Record<string, unknown>;
    llmModel: string;
    autoEvalEnabled: boolean;
    maxCallSeconds: number;
    createdAt: number;
    updatedAt: number;
  };
  calls: CallRecord[];
}

export interface CallRecord {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  agentId: string | null;
  agentName: string;
  to: string;
  roomName?: string;
  startedAt: number;
  endedAt: number | null;
  durationSec: number | null;
  outcome: string;
  costUsd: number | null;
}

export interface CallDetail extends CallRecord {
  transcript: Array<unknown>;
  recording: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
}

export interface OutboundJob {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  phoneE164: string;
  leadName: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  updatedAt: number;
}

export interface PhoneNumber {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  e164: string;
  label: string;
  status: string;
  inboundAgentId: string | null;
  outboundAgentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Contact {
  id: string;
  workspaceId: string;
  workspaceName: string | null;
  phoneE164: string;
  name: string;
  email: string;
  company: string;
  tags: string[];
  totalCalls: number;
  lastCallAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface BillingOverview {
  paidWorkspaces: number;
  trialWorkspaces: number;
  totalRevenue: number;
  stripeSubscriptions: number;
  workspaceBilling: Array<{
    workspaceId: string;
    workspaceName: string;
    ownerEmail: string | null;
    isPaid: boolean;
    isTrial: boolean;
    trialCreditUsd: number;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  }>;
}

// ── Auth API ──
export async function login(password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
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

// ── Dashboard API ──
export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await apiFetch("/api/admin/dashboard");
  if (!res.ok) throw new Error(`Failed to load dashboard: ${await readError(res)}`);
  return (await res.json()) as DashboardStats;
}

// ── Users API ──
export async function listUsers(opts?: { search?: string; limit?: number; offset?: number }): Promise<User[]> {
  const qs = new URLSearchParams();
  if (opts?.search) qs.set("search", opts.search);
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/admin/users?${qs}` : "/api/admin/users";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load users: ${await readError(res)}`);
  return ((await res.json()) as { users: User[] }).users;
}

export async function getUserDetail(id: string): Promise<UserDetail> {
  const res = await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load user: ${await readError(res)}`);
  return (await res.json()) as UserDetail;
}

// ── Workspaces API ──
export async function listWorkspaces(opts?: { search?: string; isPaid?: boolean; limit?: number; offset?: number }): Promise<Workspace[]> {
  const qs = new URLSearchParams();
  if (opts?.search) qs.set("search", opts.search);
  if (opts?.isPaid !== undefined) qs.set("isPaid", String(opts.isPaid));
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/admin/workspaces?${qs}` : "/api/admin/workspaces";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load workspaces: ${await readError(res)}`);
  return ((await res.json()) as { workspaces: Workspace[] }).workspaces;
}

export async function getWorkspaceDetail(id: string): Promise<WorkspaceDetail> {
  const res = await apiFetch(`/api/admin/workspaces/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load workspace: ${await readError(res)}`);
  return (await res.json()) as WorkspaceDetail;
}

// ── Agents API ──
export async function listAgents(opts?: { workspaceId?: string; search?: string; limit?: number; offset?: number }): Promise<Agent[]> {
  const qs = new URLSearchParams();
  if (opts?.workspaceId) qs.set("workspace", opts.workspaceId);
  if (opts?.search) qs.set("search", opts.search);
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/admin/agents?${qs}` : "/api/admin/agents";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load agents: ${await readError(res)}`);
  return ((await res.json()) as { agents: Agent[] }).agents;
}

export async function getAgentDetail(id: string): Promise<AgentDetail> {
  const res = await apiFetch(`/api/admin/agents/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load agent: ${await readError(res)}`);
  return (await res.json()) as AgentDetail;
}

// ── Calls API ──
export async function listCalls(opts?: { workspaceId?: string; agentId?: string; from?: number; to?: number; limit?: number; offset?: number }): Promise<CallRecord[]> {
  const qs = new URLSearchParams();
  if (opts?.workspaceId) qs.set("workspace", opts.workspaceId);
  if (opts?.agentId) qs.set("agent", opts.agentId);
  if (typeof opts?.from === "number") qs.set("from", String(opts.from));
  if (typeof opts?.to === "number") qs.set("to", String(opts.to));
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/admin/calls?${qs}` : "/api/admin/calls";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load calls: ${await readError(res)}`);
  return ((await res.json()) as { calls: CallRecord[] }).calls;
}

export async function getCallDetail(id: string): Promise<CallDetail> {
  const res = await apiFetch(`/api/admin/calls/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load call: ${await readError(res)}`);
  return ((await res.json()) as { call: CallDetail }).call;
}

// ── Outbound Jobs API ──
export async function listOutboundJobs(opts?: { workspaceId?: string; status?: string; limit?: number; offset?: number }): Promise<OutboundJob[]> {
  const qs = new URLSearchParams();
  if (opts?.workspaceId) qs.set("workspace", opts.workspaceId);
  if (opts?.status) qs.set("status", opts.status);
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/admin/outbound-jobs?${qs}` : "/api/admin/outbound-jobs";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load outbound jobs: ${await readError(res)}`);
  return ((await res.json()) as { jobs: OutboundJob[] }).jobs;
}

// ── Phone Numbers API ──
export async function listPhoneNumbers(opts?: { workspaceId?: string; limit?: number; offset?: number }): Promise<PhoneNumber[]> {
  const qs = new URLSearchParams();
  if (opts?.workspaceId) qs.set("workspace", opts.workspaceId);
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/admin/phone-numbers?${qs}` : "/api/admin/phone-numbers";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load phone numbers: ${await readError(res)}`);
  return ((await res.json()) as { phoneNumbers: PhoneNumber[] }).phoneNumbers;
}

// ── Contacts API ──
export async function listContacts(opts?: { workspaceId?: string; search?: string; limit?: number; offset?: number }): Promise<Contact[]> {
  const qs = new URLSearchParams();
  if (opts?.workspaceId) qs.set("workspace", opts.workspaceId);
  if (opts?.search) qs.set("search", opts.search);
  if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
  if (typeof opts?.offset === "number") qs.set("offset", String(opts.offset));
  const path = qs.toString() ? `/api/admin/contacts?${qs}` : "/api/admin/contacts";
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`Failed to load contacts: ${await readError(res)}`);
  return ((await res.json()) as { contacts: Contact[] }).contacts;
}

// ── Billing API ──
export async function getBillingOverview(): Promise<BillingOverview> {
  const res = await apiFetch("/api/admin/billing");
  if (!res.ok) throw new Error(`Failed to load billing: ${await readError(res)}`);
  return (await res.json()) as BillingOverview;
}
