import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Users, Plus, Upload, Search, Phone, Mail, Building, Calendar,
  LogOut, RefreshCw, Trash2, Download, ChevronRight, X, ArrowRight,
} from "lucide-react";
import {
  getToken, setToken, clearToken, login as apiLogin, setApiBase,
  listContacts, getContact, createContact, updateContact, deleteContact,
  importContacts, backfillContacts,
  type Contact, type CallRecord, type OutboundJob,
} from "./api";

// ────────────────── Tiny UI components ──────────────────

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

function Textarea(props: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      rows={props.rows || 3}
      className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
    />
  );
}

function Select(props: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
    >
      {props.options.map((o) => <option key={o.value} value={o.value} className="bg-slate-950">{o.label}</option>)}
    </select>
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

// ────────────────── Login Page ──────────────────

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiBase, setApiBaseState] = useState(() => localStorage.getItem("crm_main_api_base") || "https://api.rapidcall.ai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      localStorage.setItem("crm_main_api_base", apiBase);
      const data = await apiLogin(apiBase, email, password);
      setToken(data.token);
      setApiBase("");
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600/20 shadow-glow">
            <Users size={28} className="text-brand-400" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">RapidCall CRM</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to manage your contacts</p>
        </div>

        <form onSubmit={handleLogin} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          {error && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Email</label>
              <Input value={email} onChange={setEmail} placeholder="you@company.com" type="email" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Password</label>
              <Input value={password} onChange={setPassword} placeholder="••••••••" type="password" />
            </div>
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-slate-300">Advanced: API Base URL</summary>
              <div className="mt-2">
                <Input value={apiBase} onChange={setApiBaseState} placeholder="https://api.rapidcall.ai" />
              </div>
            </details>
            <Button type="submit" disabled={loading || !email || !password} className="w-full">
              {loading ? <Spinner /> : <><ArrowRight size={16} /> Sign In</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────── Drawer / Modal ──────────────────

function Drawer(props: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={props.onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-[520px] border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="text-sm font-semibold">{props.title}</div>
          <button onClick={props.onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
        <div className="h-[calc(100%-60px)] overflow-auto p-5">{props.children}</div>
      </div>
    </div>
  );
}

// ────────────────── Main CRM App ──────────────────

function CRMApp({ onLogout }: { onLogout: () => void }) {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ contact: Contact; calls: CallRecord[]; jobs: OutboundJob[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterSource, setFilterSource] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [csvText, setCsvText] = useState("");

  const filtered = useMemo(() => {
    let result = contacts;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phoneE164.includes(q) ||
      c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)
    );
    if (filterTag) result = result.filter((c) => c.tags.includes(filterTag));
    if (filterSource) result = result.filter((c) => c.source === filterSource);
    return result;
  }, [contacts, search, filterTag, filterSource]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    contacts.forEach((c) => c.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [contacts]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listContacts({ limit: 2000 });
      setContacts(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    getContact(selectedId)
      .then((d) => setDetail({ contact: d.contact, calls: d.calls, jobs: d.outboundJobs }))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load contact"))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  function formatDate(ts: number | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
  }
  function formatDuration(sec: number | null) {
    if (!sec) return "—";
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
  }

  async function handleCreate() {
    const phone = newPhone.trim();
    if (!phone) { toast.error("Phone number is required"); return; }
    setCreating(true);
    try {
      const tags = newTags.trim() ? newTags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      const contact = await createContact({
        phoneE164: phone.startsWith("+") ? phone : `+${phone}`,
        name: newName.trim(), email: newEmail.trim(), company: newCompany.trim(), tags, notes: newNotes.trim(),
      });
      setContacts((prev) => [contact, ...prev]);
      setSelectedId(contact.id);
      setAddOpen(false);
      setNewPhone(""); setNewName(""); setNewEmail(""); setNewCompany(""); setNewTags(""); setNewNotes("");
      toast.success("Contact created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create contact");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(patch: Parameters<typeof updateContact>[1]) {
    if (!detail) return;
    try {
      const updated = await updateContact(detail.contact.id, patch);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setDetail((prev) => prev ? { ...prev, contact: updated } : null);
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleDelete() {
    if (!detail) return;
    if (!confirm(`Delete ${detail.contact.name || detail.contact.phoneE164}?`)) return;
    try {
      await deleteContact(detail.contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== detail.contact.id));
      setSelectedId(null);
      toast.success("Contact deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  async function handleImport() {
    if (!csvText.trim()) { toast.error("CSV data is required"); return; }
    setImporting(true);
    try {
      const result = await importContacts(csvText);
      await refresh();
      setImportOpen(false);
      setCsvText("");
      toast.success(`Imported ${result.imported} of ${result.total} contacts`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleBackfill() {
    if (!confirm("Backfill contacts from existing calls?")) return;
    setBackfilling(true);
    try {
      const result = await backfillContacts();
      await refresh();
      toast.success(`Backfilled ${result.total} contacts (${result.created} new, ${result.updated} updated)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  // ── Render ──
  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600/20">
            <Users size={18} className="text-brand-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">RapidCall CRM</h1>
            <p className="text-xs text-slate-500">{contacts.length} contacts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={refresh} disabled={loading} className="px-3">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="secondary" onClick={onLogout} className="px-3">
            <LogOut size={14} />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Contact List */}
        <aside className="flex w-[340px] flex-col border-r border-white/10 bg-slate-950/40">
          {/* Search & Filters */}
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Select value={filterTag} onChange={setFilterTag} options={[{ value: "", label: "All tags" }, ...allTags.map((t) => ({ value: t, label: t }))]} />
              <Select value={filterSource} onChange={setFilterSource} options={[
                { value: "", label: "All sources" },
                { value: "manual", label: "Manual" },
                { value: "inbound", label: "Inbound" },
                { value: "outbound", label: "Outbound" },
                { value: "import", label: "Import" },
              ]} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-b border-white/10 p-3">
            <Button onClick={() => setAddOpen(true)} className="flex-1 text-xs py-2">
              <Plus size={14} /> Add
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(true)} className="text-xs py-2 px-3">
              <Upload size={14} />
            </Button>
            <Button variant="secondary" onClick={handleBackfill} disabled={backfilling} className="text-xs py-2 px-3">
              <Download size={14} />
            </Button>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-12"><Spinner /></div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl bg-slate-900/40 p-4 text-center text-sm text-slate-400">
                {contacts.length === 0 ? "No contacts yet. Add one or import a CSV." : "No matches."}
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-xl px-3 py-3 text-left transition ${
                      c.id === selectedId
                        ? "bg-brand-600/15 border border-brand-500/30"
                        : "border border-transparent hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                        {(c.name || c.phoneE164).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">{c.name || c.phoneE164}</div>
                        <div className="truncate text-xs text-slate-500">{c.phoneE164}{c.company ? ` · ${c.company}` : ""}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-500">{c.totalCalls} calls</span>
                        <ChevronRight size={12} className="text-slate-600" />
                      </div>
                    </div>
                    {c.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content - Contact Detail */}
        <main className="flex-1 overflow-auto bg-slate-950/20 p-6">
          {!selectedId ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Users size={48} className="mx-auto text-slate-700" />
                <p className="mt-4 text-sm text-slate-500">Select a contact to view details</p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex h-full items-center justify-center"><Spinner /></div>
          ) : detail ? (
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Contact Header */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600/20 text-lg font-bold text-brand-300">
                      {(detail.contact.name || detail.contact.phoneE164).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{detail.contact.name || detail.contact.phoneE164}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1"><Phone size={12} /> {detail.contact.phoneE164}</span>
                        {detail.contact.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {detail.contact.email}</span>}
                        {detail.contact.company && <span className="inline-flex items-center gap-1"><Building size={12} /> {detail.contact.company}</span>}
                        <Badge color="bg-slate-500/20 text-slate-300">{detail.contact.source}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="danger" onClick={handleDelete} className="px-3">
                    <Trash2 size={14} />
                  </Button>
                </div>
                {detail.contact.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {detail.contact.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Calendar size={12} /> {detail.contact.totalCalls} calls</span>
                  {detail.contact.lastCallAt && <span>Last: {formatDate(detail.contact.lastCallAt)}</span>}
                  <span>Created: {formatDate(detail.contact.createdAt)}</span>
                </div>
              </div>

              {/* Edit Fields */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-4 text-sm font-semibold text-slate-300">Edit Contact</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Name</label>
                    <Input value={detail.contact.name} onChange={(v) => handleUpdate({ name: v })} placeholder="Contact name" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Email</label>
                    <Input value={detail.contact.email} onChange={(v) => handleUpdate({ email: v })} placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Company</label>
                    <Input value={detail.contact.company} onChange={(v) => handleUpdate({ company: v })} placeholder="Company name" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Tags (comma-separated)</label>
                    <Input value={detail.contact.tags.join(", ")} onChange={(v) => handleUpdate({ tags: v.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="VIP, Lead" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-slate-500">Notes</label>
                    <Textarea value={detail.contact.notes} onChange={(v) => handleUpdate({ notes: v })} placeholder="Notes about this contact…" rows={3} />
                  </div>
                </div>
              </div>

              {/* Call History */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-4 text-sm font-semibold text-slate-300">Call History ({detail.calls.length})</h3>
                {detail.calls.length === 0 ? (
                  <p className="text-sm text-slate-500">No calls yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.calls.map((call) => (
                      <div key={call.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 p-3">
                        <div>
                          <div className="text-sm font-medium">{call.agentName}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {formatDate(call.startedAt)} · {formatDuration(call.durationSec)} · {call.outcome}
                          </div>
                        </div>
                        <Badge color={call.outcome === "completed" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}>
                          {call.outcome}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outbound Jobs */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-4 text-sm font-semibold text-slate-300">Outbound Jobs ({detail.jobs.length})</h3>
                {detail.jobs.length === 0 ? (
                  <p className="text-sm text-slate-500">No outbound jobs yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.jobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 p-3">
                        <div>
                          <div className="text-sm font-medium">{job.leadName || job.phoneE164}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{formatDate(job.createdAt)}</div>
                        </div>
                        <Badge color={
                          job.status === "completed" ? "bg-emerald-500/20 text-emerald-300" :
                          job.status === "failed" ? "bg-red-500/20 text-red-300" :
                          "bg-amber-500/20 text-amber-300"
                        }>{job.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {/* Add Contact Drawer */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add Contact">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Phone (E.164) *</label>
            <Input value={newPhone} onChange={setNewPhone} placeholder="+14155550123" />
          </div>
          <div><label className="mb-1 block text-xs text-slate-400">Name</label><Input value={newName} onChange={setNewName} placeholder="John Doe" /></div>
          <div><label className="mb-1 block text-xs text-slate-400">Email</label><Input value={newEmail} onChange={setNewEmail} placeholder="john@example.com" /></div>
          <div><label className="mb-1 block text-xs text-slate-400">Company</label><Input value={newCompany} onChange={setNewCompany} placeholder="Acme Corp" /></div>
          <div><label className="mb-1 block text-xs text-slate-400">Tags (comma-separated)</label><Input value={newTags} onChange={setNewTags} placeholder="VIP, Lead" /></div>
          <div><label className="mb-1 block text-xs text-slate-400">Notes</label><Textarea value={newNotes} onChange={setNewNotes} placeholder="Notes…" /></div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={!newPhone.trim() || creating} className="flex-1">
              {creating ? <Spinner /> : "Create Contact"}
            </Button>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Drawer>

      {/* Import CSV Drawer */}
      <Drawer open={importOpen} onClose={() => setImportOpen(false)} title="Import Contacts (CSV)">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-900/40 p-3 text-xs text-slate-400">
            CSV format: <code>phone,name,email,company,tags</code><br />
            Example: <code>+14155550123,John Doe,john@example.com,Acme,VIP;Lead</code>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">CSV Data</label>
            <Textarea value={csvText} onChange={setCsvText} placeholder="phone,name,email,company,tags&#10;+1415..." rows={10} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleImport} disabled={!csvText.trim() || importing} className="flex-1">
              {importing ? <Spinner /> : "Import"}
            </Button>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Drawer>
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
  return <CRMApp onLogout={handleLogout} />;
}
