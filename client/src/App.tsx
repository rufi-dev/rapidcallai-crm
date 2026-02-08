import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Building2, Bot, Phone, PhoneCall, Hash, DollarSign,
  LogOut, Search, ChevronRight, Calendar, Clock, TrendingUp, User, Mail, Building,
  CheckCircle, XCircle, AlertCircle, ArrowRight, RefreshCw,
} from "lucide-react";
import {
  getToken, setToken, clearToken, login as apiLogin,
  getDashboardStats, listUsers, getUserDetail, listWorkspaces, getWorkspaceDetail,
  listAgents, getAgentDetail, listCalls, getCallDetail, listOutboundJobs,
  listPhoneNumbers, listContacts, getBillingOverview,
  type DashboardStats, type User, type UserDetail, type Workspace, type WorkspaceDetail,
  type Agent, type AgentDetail, type CallRecord, type CallDetail, type OutboundJob,
  type PhoneNumber, type Contact, type BillingOverview,
} from "./api";

// ────────────────── UI Components ──────────────────

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none";
  const v = props.variant ?? "primary";
  const cls = v === "danger"
    ? "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
    : v === "secondary"
    ? "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10"
    : "bg-brand-600 text-white hover:bg-brand-500 shadow-glow";
  return <button {...props} className={`${base} ${cls} ${props.className || ""}`} />;
}

function Input(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <input
      type={props.type || "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      className={`w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${props.className || ""}`}
    />
  );
}

function Spinner() {
  return <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-400" />;
}

function Badge(props: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${props.color || "bg-brand-500/20 text-brand-200"}`}>
      {props.children}
    </span>
  );
}

function formatDate(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCurrency(usd: number | null) {
  if (usd === null) return "$0.00";
  return `$${usd.toFixed(2)}`;
}

// ────────────────── Login Page ──────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiLogin(password);
      setToken(data.token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600/20 shadow-glow">
            <LayoutDashboard size={32} className="text-brand-400" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="mt-2 text-sm text-slate-400">RapidCallAI Platform Management</p>
        </div>

        <form onSubmit={handleLogin} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Admin Password</label>
              <Input value={password} onChange={setPassword} placeholder="Enter admin password" type="password" />
            </div>
            <Button type="submit" disabled={loading || !password} className="w-full">
              {loading ? <Spinner /> : <><ArrowRight size={16} /> Sign In</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────── Main Admin App ──────────────────

type Page = "dashboard" | "users" | "workspaces" | "agents" | "calls" | "outbound-jobs" | "phone-numbers" | "contacts" | "billing";

function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState<Page>("dashboard");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Detail views
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  const navItems: Array<{ id: Page; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "users", label: "Users", icon: <Users size={18} /> },
    { id: "workspaces", label: "Workspaces", icon: <Building2 size={18} /> },
    { id: "agents", label: "Agents", icon: <Bot size={18} /> },
    { id: "calls", label: "Calls", icon: <PhoneCall size={18} /> },
    { id: "outbound-jobs", label: "Outbound Jobs", icon: <Phone size={18} /> },
    { id: "phone-numbers", label: "Phone Numbers", icon: <Hash size={18} /> },
    { id: "contacts", label: "Contacts", icon: <Users size={18} /> },
    { id: "billing", label: "Billing", icon: <DollarSign size={18} /> },
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600/20">
            <LayoutDashboard size={18} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Admin Panel</h1>
            <p className="text-xs text-slate-500">RapidCallAI Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={refreshDashboard} disabled={loading} className="px-3">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="secondary" onClick={onLogout} className="px-3">
            <LogOut size={14} />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-[240px] flex-col border-r border-white/10 bg-slate-950/40">
          <nav className="flex-1 overflow-auto p-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setPage(item.id);
                  setSelectedUserId(null);
                  setSelectedWorkspaceId(null);
                  setSelectedAgentId(null);
                  setSelectedCallId(null);
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  page === item.id
                    ? "bg-brand-600/15 text-brand-300 border border-brand-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-slate-950/20 p-6">
          {page === "dashboard" && <DashboardPage stats={stats} loading={loading} />}
          {page === "users" && <UsersPage onSelectUser={setSelectedUserId} selectedUserId={selectedUserId} />}
          {page === "workspaces" && <WorkspacesPage onSelectWorkspace={setSelectedWorkspaceId} selectedWorkspaceId={selectedWorkspaceId} />}
          {page === "agents" && <AgentsPage onSelectAgent={setSelectedAgentId} selectedAgentId={selectedAgentId} />}
          {page === "calls" && <CallsPage onSelectCall={setSelectedCallId} selectedCallId={selectedCallId} />}
          {page === "outbound-jobs" && <OutboundJobsPage />}
          {page === "phone-numbers" && <PhoneNumbersPage />}
          {page === "contacts" && <ContactsPage />}
          {page === "billing" && <BillingPage />}
        </main>
      </div>
    </div>
  );
}

// ────────────────── Dashboard Page ──────────────────

function DashboardPage({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  if (loading || !stats) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  }

  const kpiCards = [
    { label: "Total Users", value: stats.totalUsers, icon: <Users size={20} />, color: "text-blue-400" },
    { label: "Workspaces", value: stats.totalWorkspaces, icon: <Building2 size={20} />, color: "text-purple-400" },
    { label: "Agents", value: stats.totalAgents, icon: <Bot size={20} />, color: "text-green-400" },
    { label: "Total Calls", value: stats.totalCalls, icon: <PhoneCall size={20} />, color: "text-amber-400" },
    { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: <DollarSign size={20} />, color: "text-emerald-400" },
    { label: "Paid Workspaces", value: stats.paidWorkspaces, icon: <CheckCircle size={20} />, color: "text-emerald-400" },
    { label: "Trial Workspaces", value: stats.trialWorkspaces, icon: <AlertCircle size={20} />, color: "text-yellow-400" },
    { label: "Calls Today", value: stats.callsToday, icon: <TrendingUp size={20} />, color: "text-blue-400" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">{kpi.label}</p>
                <p className="mt-2 text-2xl font-bold">{kpi.value}</p>
              </div>
              <div className={`${kpi.color} opacity-60`}>{kpi.icon}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-slate-400">Calls This Week</p>
          <p className="mt-2 text-3xl font-bold">{stats.callsThisWeek}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-slate-400">Calls This Month</p>
          <p className="mt-2 text-3xl font-bold">{stats.callsThisMonth}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-slate-400">Phone Numbers</p>
          <p className="mt-2 text-3xl font-bold">{stats.totalPhoneNumbers}</p>
        </div>
      </div>
    </div>
  );
}

// ────────────────── Users Page ──────────────────

function UsersPage({ onSelectUser, selectedUserId }: { onSelectUser: (id: string) => void; selectedUserId: string | null }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    listUsers({ search: search || undefined, limit: 200 })
      .then(setUsers)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, [search]);

  if (selectedUserId) {
    return <UserDetailPage userId={selectedUserId} onBack={() => onSelectUser("")} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Users</h2>
        <div className="w-64">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={setSearch} placeholder="Search users..." className="pl-9" />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm">{u.email}</td>
                  <td className="px-4 py-3 text-sm">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => onSelectUser(u.id)} className="px-3 py-1 text-xs">
                      View <ChevronRight size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserDetailPage({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUserDetail(userId)
      .then(setDetail)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load user"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || !detail) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="secondary" onClick={onBack} className="mb-4">← Back</Button>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-bold mb-4">User: {detail.user.email}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div><span className="text-sm text-slate-400">Name:</span> <span className="ml-2">{detail.user.name || "—"}</span></div>
          <div><span className="text-sm text-slate-400">Created:</span> <span className="ml-2">{formatDate(detail.user.createdAt)}</span></div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h4 className="text-lg font-semibold mb-4">Workspaces ({detail.workspaces.length})</h4>
        <div className="space-y-2">
          {detail.workspaces.map((w) => (
            <div key={w.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {w.isPaid ? <Badge color="bg-emerald-500/20 text-emerald-300">Paid</Badge> : <Badge color="bg-yellow-500/20 text-yellow-300">Trial</Badge>}
                    {" "}· {w.agentCount} agents · {w.callCount} calls
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h4 className="text-lg font-semibold mb-4">Recent Calls ({detail.recentCalls.length})</h4>
        <div className="space-y-2">
          {detail.recentCalls.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.agentName}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(c.startedAt)} · {formatDuration(c.durationSec)} · {c.outcome}</p>
                </div>
                <Badge>{c.outcome}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────── Workspaces Page ──────────────────

function WorkspacesPage({ onSelectWorkspace, selectedWorkspaceId }: { onSelectWorkspace: (id: string) => void; selectedWorkspaceId: string | null }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    listWorkspaces({ search: search || undefined, limit: 200 })
      .then(setWorkspaces)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load workspaces"))
      .finally(() => setLoading(false));
  }, [search]);

  if (selectedWorkspaceId) {
    return <WorkspaceDetailPage workspaceId={selectedWorkspaceId} onBack={() => onSelectWorkspace("")} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Workspaces</h2>
        <div className="w-64">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={setSearch} placeholder="Search workspaces..." className="pl-9" />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Agents</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Calls</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr key={w.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{w.ownerEmail || "—"}</td>
                  <td className="px-4 py-3">
                    {w.isPaid ? <Badge color="bg-emerald-500/20 text-emerald-300">Paid</Badge> : <Badge color="bg-yellow-500/20 text-yellow-300">Trial</Badge>}
                  </td>
                  <td className="px-4 py-3 text-sm">{w.agentCount}</td>
                  <td className="px-4 py-3 text-sm">{w.callCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => onSelectWorkspace(w.id)} className="px-3 py-1 text-xs">
                      View <ChevronRight size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WorkspaceDetailPage({ workspaceId, onBack }: { workspaceId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getWorkspaceDetail(workspaceId)
      .then(setDetail)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load workspace"))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading || !detail) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="secondary" onClick={onBack} className="mb-4">← Back</Button>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-bold mb-4">{detail.workspace.name}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div><span className="text-sm text-slate-400">Owner:</span> <span className="ml-2">{detail.workspace.ownerEmail || "—"}</span></div>
          <div><span className="text-sm text-slate-400">Plan:</span> <span className="ml-2">{detail.workspace.isPaid ? "Paid" : "Trial"}</span></div>
          <div><span className="text-sm text-slate-400">Agents:</span> <span className="ml-2">{detail.agents.length}</span></div>
          <div><span className="text-sm text-slate-400">Phone Numbers:</span> <span className="ml-2">{detail.phoneNumbers.length}</span></div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h4 className="text-lg font-semibold mb-4">Agents ({detail.agents.length})</h4>
        <div className="space-y-2">
          {detail.agents.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
              <p className="font-medium">{a.name}</p>
              <p className="text-xs text-slate-400 mt-1">Model: {a.llmModel || "—"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h4 className="text-lg font-semibold mb-4">Recent Calls ({detail.recentCalls.length})</h4>
        <div className="space-y-2">
          {detail.recentCalls.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.agentName}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(c.startedAt)} · {formatDuration(c.durationSec)}</p>
                </div>
                <Badge>{c.outcome}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────── Agents Page ──────────────────

function AgentsPage({ onSelectAgent, selectedAgentId }: { onSelectAgent: (id: string) => void; selectedAgentId: string | null }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    listAgents({ search: search || undefined, limit: 200 })
      .then(setAgents)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load agents"))
      .finally(() => setLoading(false));
  }, [search]);

  if (selectedAgentId) {
    return <AgentDetailPage agentId={selectedAgentId} onBack={() => onSelectAgent("")} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Agents</h2>
        <div className="w-64">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={setSearch} placeholder="Search agents..." className="pl-9" />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Workspace</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Calls</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Last Call</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{a.workspaceName || "—"}</td>
                  <td className="px-4 py-3 text-sm">{a.llmModel || "—"}</td>
                  <td className="px-4 py-3 text-sm">{a.totalCalls}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(a.lastCallAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => onSelectAgent(a.id)} className="px-3 py-1 text-xs">
                      View <ChevronRight size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgentDetailPage({ agentId, onBack }: { agentId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAgentDetail(agentId)
      .then(setDetail)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load agent"))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading || !detail) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="secondary" onClick={onBack} className="mb-4">← Back</Button>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-bold mb-4">{detail.agent.name}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div><span className="text-sm text-slate-400">Workspace:</span> <span className="ml-2">{detail.agent.workspaceName || "—"}</span></div>
          <div><span className="text-sm text-slate-400">Model:</span> <span className="ml-2">{detail.agent.llmModel || "—"}</span></div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h4 className="text-lg font-semibold mb-4">Call History ({detail.calls.length})</h4>
        <div className="space-y-2">
          {detail.calls.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.to}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(c.startedAt)} · {formatDuration(c.durationSec)}</p>
                </div>
                <Badge>{c.outcome}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────── Calls Page ──────────────────

function CallsPage({ onSelectCall, selectedCallId }: { onSelectCall: (id: string) => void; selectedCallId: string | null }) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listCalls({ limit: 200 })
      .then(setCalls)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load calls"))
      .finally(() => setLoading(false));
  }, []);

  if (selectedCallId) {
    return <CallDetailPage callId={selectedCallId} onBack={() => onSelectCall("")} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <h2 className="text-2xl font-bold">Calls</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Workspace</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Outcome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm">{formatDate(c.startedAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{c.workspaceName || "—"}</td>
                  <td className="px-4 py-3 text-sm">{c.agentName}</td>
                  <td className="px-4 py-3 text-sm">{c.to}</td>
                  <td className="px-4 py-3 text-sm">{formatDuration(c.durationSec)}</td>
                  <td className="px-4 py-3"><Badge>{c.outcome}</Badge></td>
                  <td className="px-4 py-3 text-sm">{formatCurrency(c.costUsd)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => onSelectCall(c.id)} className="px-3 py-1 text-xs">
                      View <ChevronRight size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CallDetailPage({ callId, onBack }: { callId: string; onBack: () => void }) {
  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCallDetail(callId)
      .then(setCall)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load call"))
      .finally(() => setLoading(false));
  }, [callId]);

  if (loading || !call) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="secondary" onClick={onBack} className="mb-4">← Back</Button>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-xl font-bold mb-4">Call Details</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div><span className="text-sm text-slate-400">Agent:</span> <span className="ml-2">{call.agentName}</span></div>
          <div><span className="text-sm text-slate-400">To:</span> <span className="ml-2">{call.to}</span></div>
          <div><span className="text-sm text-slate-400">Started:</span> <span className="ml-2">{formatDate(call.startedAt)}</span></div>
          <div><span className="text-sm text-slate-400">Duration:</span> <span className="ml-2">{formatDuration(call.durationSec)}</span></div>
          <div><span className="text-sm text-slate-400">Outcome:</span> <span className="ml-2"><Badge>{call.outcome}</Badge></span></div>
          <div><span className="text-sm text-slate-400">Cost:</span> <span className="ml-2">{formatCurrency(call.costUsd)}</span></div>
        </div>
      </div>
      {call.transcript && call.transcript.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h4 className="text-lg font-semibold mb-4">Transcript</h4>
          <div className="space-y-2 text-sm">
            {call.transcript.map((t: any, i: number) => (
              <div key={i} className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                <p className="text-slate-300">{JSON.stringify(t)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────── Outbound Jobs Page ──────────────────

function OutboundJobsPage() {
  const [jobs, setJobs] = useState<OutboundJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listOutboundJobs({ limit: 200 })
      .then(setJobs)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <h2 className="text-2xl font-bold">Outbound Jobs</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Lead Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Workspace</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Attempts</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm">{j.phoneE164}</td>
                  <td className="px-4 py-3 text-sm">{j.leadName || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{j.workspaceName || "—"}</td>
                  <td className="px-4 py-3"><Badge>{j.status}</Badge></td>
                  <td className="px-4 py-3 text-sm">{j.attempts}/{j.maxAttempts}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(j.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────── Phone Numbers Page ──────────────────

function PhoneNumbersPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listPhoneNumbers({ limit: 200 })
      .then(setPhoneNumbers)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load phone numbers"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <h2 className="text-2xl font-bold">Phone Numbers</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Workspace</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {phoneNumbers.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm font-medium">{p.e164}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{p.workspaceName || "—"}</td>
                  <td className="px-4 py-3"><Badge>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────── Contacts Page ──────────────────

function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    listContacts({ search: search || undefined, limit: 200 })
      .then(setContacts)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load contacts"))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Contacts</h2>
        <div className="w-64">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={setSearch} placeholder="Search contacts..." className="pl-9" />
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Workspace</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Calls</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Last Call</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm font-medium">{c.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{c.phoneE164}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{c.workspaceName || "—"}</td>
                  <td className="px-4 py-3 text-sm">{c.totalCalls}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{formatDate(c.lastCallAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────── Billing Page ──────────────────

function BillingPage() {
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getBillingOverview()
      .then(setBilling)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load billing"))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !billing) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h2 className="text-2xl font-bold">Billing Overview</h2>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-slate-400">Paid Workspaces</p>
          <p className="mt-2 text-3xl font-bold">{billing.paidWorkspaces}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-slate-400">Trial Workspaces</p>
          <p className="mt-2 text-3xl font-bold">{billing.trialWorkspaces}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-slate-400">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold">{formatCurrency(billing.totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs text-slate-400">Stripe Subscriptions</p>
          <p className="mt-2 text-3xl font-bold">{billing.stripeSubscriptions}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Workspace</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Plan</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Trial Credit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Stripe Customer</th>
            </tr>
          </thead>
          <tbody>
            {billing.workspaceBilling.map((w) => (
              <tr key={w.workspaceId} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm font-medium">{w.workspaceName}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{w.ownerEmail || "—"}</td>
                <td className="px-4 py-3">
                  {w.isPaid ? <Badge color="bg-emerald-500/20 text-emerald-300">Paid</Badge> : <Badge color="bg-yellow-500/20 text-yellow-300">Trial</Badge>}
                </td>
                <td className="px-4 py-3 text-sm">{formatCurrency(w.trialCreditUsd)}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{w.stripeCustomerId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────── Root App ──────────────────

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken());

  function handleLogout() {
    clearToken();
    setAuthed(false);
  }

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;
  return <AdminApp onLogout={handleLogout} />;
}
