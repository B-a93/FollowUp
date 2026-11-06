import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  Clock,
  Edit3,
  History,
  KanbanSquare,
  ListTodo,
  LogOut,
  MessageSquare,
  Plus,
  RotateCcw,
  UserPlus,
} from "lucide-react";
type Priority = "low" | "normal" | "high" | "urgent";
type Status = "upcoming" | "completed";
type F = {
  id: number;
  client_label: string;
  task: string;
  notes: string;
  priority: Priority;
  status: Status;
  due_at: string;
  completed_at?: string;
};
type Activity = { event_type: string; detail: string; created_at: string };
type LeadStatus = "new" | "contacted" | "interested" | "won" | "lost";
type Lead = {
  id: number;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source: string;
  status: LeadStatus;
  estimated_value?: string | number;
  currency: string;
  notes?: string;
  next_follow_up?: string;
  updated_at: string;
};
const API = import.meta.env.VITE_API_URL || "";
const auth = () => localStorage.getItem("followup_token") || "";
async function call(path: string, init: RequestInit = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(auth() ? { Authorization: "Bearer " + auth() } : {}),
      ...(init.headers || {}),
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
export default function App() {
  const [token, setToken] = useState(auth());
  if (!token)
    return (
      <Auth
        onAuth={(t) => {
          localStorage.setItem("followup_token", t);
          setToken(t);
        }}
      />
    );
  return (
    <Dashboard
      logout={() => {
        localStorage.removeItem("followup_token");
        setToken("");
      }}
    />
  );
}
function Auth({ onAuth }: { onAuth: (t: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const j = await call("/api/auth/" + mode, {
        method: "POST",
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : {
                displayName: name,
                email,
                password,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              },
        ),
      });
      onAuth(j.token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <div className="authCard">
        <span className="eyebrow">LEADFLOW</span>
        <h1>Move every lead towards a clear next step.</h1>
        <p className="muted">
          {mode === "login"
            ? "Sign in to your follow-up workspace."
            : "Create your private pilot workspace."}
        </p>
        <ul className="authBenefits" aria-label="LeadFlow features">
          <li>Manage leads from new enquiry to won or lost</li>
          <li>Record calls, email, WhatsApp and meeting activity</li>
          <li>Schedule reminders and never miss the next step</li>
        </ul>
        {mode === "register" && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ characters"
          />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary wide" disabled={busy} onClick={submit}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
        <button
          className="link"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login"
            ? "Create an account"
            : "Already have an account? Sign in"}
        </button>
        <aside>
          Privacy: use client/company labels and generic actions only. Never
          store account numbers, balances, IDs, transaction details, passwords
          or other confidential banking data.
        </aside>
      </div>
    </main>
  );
}
function Dashboard({ logout }: { logout: () => void }) {
  const [items, setItems] = useState<F[]>([]),
    [view, setView] = useState<"leads" | "followups">("leads"),
    [loading, setLoading] = useState(true),
    [err, setErr] = useState(""),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<F | null>(null),
    [activity, setActivity] = useState<{ item: F; rows: Activity[] } | null>(
      null,
    ),
    [nextFor, setNextFor] = useState<F | null>(null),
    [snoozeFor, setSnoozeFor] = useState<F | null>(null),
    [snoozeNotice, setSnoozeNotice] = useState<{
      item: F;
      originalDue: string;
      newDue: string;
    } | null>(null),
    [settings, setSettings] = useState(false);
  async function load() {
    try {
      const j = await call("/api/followups");
      setItems(j.data || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const now = new Date();
  const groups = useMemo(
    () => ({
      overdue: items.filter(
        (x) => x.status === "upcoming" && new Date(x.due_at) < now,
      ),
      today: items.filter(
        (x) =>
          x.status === "upcoming" &&
          new Date(x.due_at) >= now &&
          new Date(x.due_at).toDateString() === now.toDateString(),
      ),
      upcoming: items.filter(
        (x) =>
          x.status === "upcoming" &&
          new Date(x.due_at) > now &&
          new Date(x.due_at).toDateString() !== now.toDateString(),
      ),
      completed: items.filter((x) => x.status === "completed"),
    }),
    [items],
  );
  async function done(x: F) {
    await call("/api/followups/" + x.id + "/complete", { method: "POST" });
    await load();
    setNextFor(x);
  }
  async function snooze(id: number, minutes: number) {
    if (!snoozeFor) return;
    const originalDue = snoozeFor.due_at;
    const result = await call("/api/followups/" + id + "/snooze", {
      method: "POST",
      body: JSON.stringify({ minutes }),
    });
    await load();
    setSnoozeNotice({
      item: snoozeFor,
      originalDue,
      newDue: result.data.due_at,
    });
    setSnoozeFor(null);
  }
  async function undoSnooze() {
    if (!snoozeNotice) return;
    await call("/api/followups/" + snoozeNotice.item.id, {
      method: "PATCH",
      body: JSON.stringify({ dueAt: snoozeNotice.originalDue }),
    });
    await load();
    setSnoozeNotice(null);
  }
  async function showActivity(x: F) {
    const j = await call("/api/followups/" + x.id + "/activity");
    setActivity({ item: x, rows: j.data || [] });
  }
  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">LEADFLOW</span>
          <h1>{view === "leads" ? "Turn every enquiry into a clear next step." : "Never miss the next conversation."}</h1>
          {view === "followups" && <p>{groups.today.length} today · {groups.overdue.length} overdue</p>}
        </div>
        <div className="headerActions">
          <button className="ghost" onClick={() => setSettings(true)}>
            <Bell /> Reminders
          </button>
          <button className="ghost" onClick={logout}>
            <LogOut /> Sign out
          </button>
          {view === "followups" && <button
            className="primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Add follow-up
          </button>}
        </div>
      </header>
      <aside>
        Privacy: keep client notes generic. Do not enter confidential banking or
        account information.
      </aside>
      <nav className="workspaceTabs" aria-label="Workspace">
        <button className={view === "leads" ? "active" : ""} onClick={() => setView("leads")}><KanbanSquare /> Leads</button>
        <button className={view === "followups" ? "active" : ""} onClick={() => setView("followups")}><ListTodo /> Follow-ups</button>
      </nav>
      {snoozeNotice && (
        <div className="success snoozeNotice">
          <span>
            Snoozed until {new Date(snoozeNotice.newDue).toLocaleString()}.
          </span>
          <button onClick={undoSnooze}>Undo</button>
        </div>
      )}
      {err && <p className="error">{err}</p>}
      {view === "leads" ? <LeadBoard /> : loading ? (
        <div className="empty">Loading follow-ups…</div>
      ) : (
        <>
          <Section
            title="Needs attention"
            items={groups.overdue}
            empty="Nothing overdue."
            done={done}
            snooze={setSnoozeFor}
            edit={(x) => {
              setEditing(x);
              setOpen(true);
            }}
            activity={showActivity}
          />
          <Section
            title="Today"
            items={groups.today}
            empty="No follow-ups due today."
            done={done}
            snooze={setSnoozeFor}
            edit={(x) => {
              setEditing(x);
              setOpen(true);
            }}
            activity={showActivity}
          />
          <Section
            title="Upcoming"
            items={groups.upcoming}
            empty="Nothing upcoming yet."
            done={done}
            snooze={setSnoozeFor}
            edit={(x) => {
              setEditing(x);
              setOpen(true);
            }}
            activity={showActivity}
          />
          <Section
            title="Completed"
            items={groups.completed}
            empty="Completed follow-ups will appear here."
            done={done}
            snooze={setSnoozeFor}
            edit={(x) => {
              setEditing(x);
              setOpen(true);
            }}
            activity={showActivity}
          />
        </>
      )}
      {open && (
        <FollowupForm
          initial={editing}
          close={() => setOpen(false)}
          saved={async () => {
            setOpen(false);
            await load();
          }}
        />
      )}
      {nextFor && (
        <NextPrompt
          item={nextFor}
          close={() => setNextFor(null)}
          saved={async () => {
            setNextFor(null);
            await load();
          }}
        />
      )}
      {activity && (
        <ActivityModal data={activity} close={() => setActivity(null)} />
      )}
      {snoozeFor && (
        <SnoozePrompt
          item={snoozeFor}
          close={() => setSnoozeFor(null)}
          snooze={(minutes) => snooze(snoozeFor.id, minutes)}
        />
      )}{" "}
      {settings && <ReminderSettings close={() => setSettings(false)} />}
    </main>
  );
}
const leadStages: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];
function LeadBoard() {
  const [leads, setLeads] = useState<Lead[]>([]),
    [loading, setLoading] = useState(true),
    [err, setErr] = useState(""),
    [form, setForm] = useState(false),
    [editing, setEditing] = useState<Lead | null>(null),
    [activityFor, setActivityFor] = useState<Lead | null>(null),
    [followupFor, setFollowupFor] = useState<Lead | null>(null);
  async function load() {
    try {
      const j = await call("/api/leads");
      setLeads(j.data || []);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  async function changeStatus(lead: Lead, status: LeadStatus) {
    try {
      await call(`/api/leads/${lead.id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Status update failed"); }
  }
  const totalValue = leads.filter((lead) => !["won", "lost"].includes(lead.status)).reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  return <section className="leadWorkspace">
    <div className="pipelineSummary">
      <div><span>Active leads</span><strong>{leads.filter((lead) => !["won", "lost"].includes(lead.status)).length}</strong></div>
      <div><span>Pipeline value</span><strong>${totalValue.toLocaleString()}</strong></div>
      <button className="primary" onClick={() => { setEditing(null); setForm(true); }}><UserPlus /> Add lead</button>
    </div>
    {err && <p className="error">{err}</p>}
    {loading ? <div className="empty">Loading leads…</div> : <div className="pipeline">
      {leadStages.map((stage) => <div className={`pipelineColumn stage-${stage.id}`} key={stage.id}>
        <div className="pipelineTitle"><h2>{stage.label}</h2><span>{leads.filter((lead) => lead.status === stage.id).length}</span></div>
        <div className="leadList">
          {leads.filter((lead) => lead.status === stage.id).map((lead) => <article className="leadCard" key={lead.id}>
            <div className="leadCardTop"><span className="source">{lead.source.replaceAll("_", " ")}</span><button className="iconButton" aria-label={`Edit ${lead.company_name}`} onClick={() => { setEditing(lead); setForm(true); }}><Edit3 /></button></div>
            <h3>{lead.company_name}</h3>
            {lead.contact_name && <p>{lead.contact_name}</p>}
            {lead.estimated_value && <strong className="leadValue">{lead.currency} {Number(lead.estimated_value).toLocaleString()}</strong>}
            {lead.next_follow_up && <small><Clock /> {new Date(lead.next_follow_up).toLocaleString()}</small>}
            <div className="leadActions">
              <select aria-label={`Status for ${lead.company_name}`} value={lead.status} onChange={(e) => changeStatus(lead, e.target.value as LeadStatus)}>{leadStages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
              <button onClick={() => setActivityFor(lead)}><MessageSquare /> Activity</button>
              <button className="scheduleLead" onClick={() => setFollowupFor(lead)}><Clock /> Follow-up</button>
            </div>
          </article>)}
          {!leads.some((lead) => lead.status === stage.id) && <div className="columnEmpty">No leads</div>}
        </div>
      </div>)}
    </div>}
    {form && <LeadForm initial={editing} close={() => setForm(false)} saved={async () => { setForm(false); await load(); }} />}
    {activityFor && <LeadActivity lead={activityFor} close={() => setActivityFor(null)} />}
    {followupFor && <LeadFollowupForm lead={followupFor} close={() => setFollowupFor(null)} saved={async () => { setFollowupFor(null); await load(); }} />}
  </section>;
}
function LeadForm({ initial, close, saved }: { initial: Lead | null; close: () => void; saved: () => void }) {
  const [company, setCompany] = useState(initial?.company_name || ""),
    [contact, setContact] = useState(initial?.contact_name || ""),
    [email, setEmail] = useState(initial?.email || ""),
    [phone, setPhone] = useState(initial?.phone || ""),
    [source, setSource] = useState(initial?.source || "manual"),
    [value, setValue] = useState(String(initial?.estimated_value || "")),
    [currency, setCurrency] = useState(initial?.currency || "USD"),
    [notes, setNotes] = useState(initial?.notes || ""),
    [err, setErr] = useState("");
  async function submit() {
    try {
      await call(initial ? `/api/leads/${initial.id}` : "/api/leads", { method: initial ? "PATCH" : "POST", body: JSON.stringify({ companyName: company, contactName: contact, email, phone, source, estimatedValue: value, currency, notes }) });
      await saved();
    } catch (e) { setErr(e instanceof Error ? e.message : "Unable to save lead"); }
  }
  return <div className="modal"><div className="sheet"><button className="close" onClick={close}>×</button><span className="eyebrow">{initial ? "EDIT LEAD" : "NEW LEAD"}</span><h2>{initial ? "Update opportunity" : "Add a potential customer"}</h2>
    <div className="formGrid"><label>Company or client *<input value={company} onChange={(e) => setCompany(e.target.value)} /></label><label>Contact name<input value={contact} onChange={(e) => setContact(e.target.value)} /></label><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Phone / WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label>Lead source<select value={source} onChange={(e) => setSource(e.target.value)}><option value="manual">Manual</option><option value="quote_builder">Quote Builder</option><option value="website">Website</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="referral">Referral</option><option value="social">Social media</option><option value="other">Other</option></select></label><label>Estimated value<div className="valueFields"><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option>USD</option><option>AED</option><option>GMD</option><option>GBP</option><option>EUR</option></select><input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} /></div></label></div>
    <label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Keep notes useful and non-confidential." /></label>{err && <p className="error">{err}</p>}<button className="primary wide" onClick={submit}>{initial ? "Save lead" : "Add lead"}</button>
  </div></div>;
}
function LeadActivity({ lead, close }: { lead: Lead; close: () => void }) {
  const [rows, setRows] = useState<{ activity_type: string; detail: string; created_at: string }[]>([]), [type, setType] = useState("note"), [detail, setDetail] = useState(""), [err, setErr] = useState("");
  async function load() { try { const j = await call(`/api/leads/${lead.id}/activity`); setRows(j.data || []); } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load activity"); } }
  useEffect(() => { void load(); }, [lead.id]);
  async function add() { try { await call(`/api/leads/${lead.id}/activity`, { method: "POST", body: JSON.stringify({ type, detail }) }); setDetail(""); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Unable to add activity"); } }
  return <div className="modal"><div className="sheet"><button className="close" onClick={close}>×</button><span className="eyebrow">LEAD ACTIVITY</span><h2>{lead.company_name}</h2><div className="activityComposer"><select value={type} onChange={(e) => setType(e.target.value)}><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="meeting">Meeting</option></select><textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What happened and what is the next step?"/><button className="primary" disabled={!detail.trim()} onClick={add}>Add activity</button></div>{err && <p className="error">{err}</p>}<div className="timeline">{rows.map((row, index) => <div className="event" key={index}><b>{row.activity_type.replaceAll("_", " ")}</b><small>{new Date(row.created_at).toLocaleString()}</small>{row.detail && <p>{row.detail}</p>}</div>)}{!rows.length && <div className="empty">No activity recorded yet.</div>}</div></div></div>;
}
function LeadFollowupForm({ lead, close, saved }: { lead: Lead; close: () => void; saved: () => void }) {
  const [task, setTask] = useState("Follow up with lead"), [due, setDue] = useState(toLocal(new Date(Date.now() + 86400000).toISOString())), [priority, setPriority] = useState<Priority>("normal"), [err, setErr] = useState("");
  async function submit() { try { await call("/api/followups", { method: "POST", body: JSON.stringify({ leadId: lead.id, clientLabel: lead.company_name, task, priority, dueAt: new Date(due).toISOString() }) }); await saved(); } catch (e) { setErr(e instanceof Error ? e.message : "Unable to schedule follow-up"); } }
  return <div className="modal"><div className="sheet compact"><button className="close" onClick={close}>×</button><span className="eyebrow">SCHEDULE FOLLOW-UP</span><h2>{lead.company_name}</h2><label>Next action<textarea value={task} onChange={(e) => setTask(e.target.value)} /></label><label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Due date &amp; time<input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></label>{err && <p className="error">{err}</p>}<button className="primary wide" onClick={submit}>Schedule reminder</button></div></div>;
}
function FollowupForm({
  initial,
  close,
  saved,
}: {
  initial: F | null;
  close: () => void;
  saved: () => void;
}) {
  const [client, setClient] = useState(initial?.client_label || ""),
    [task, setTask] = useState(initial?.task || ""),
    [notes, setNotes] = useState(initial?.notes || ""),
    [priority, setPriority] = useState<Priority>(initial?.priority || "normal"),
    [due, setDue] = useState(initial ? toLocal(initial.due_at) : ""),
    [err, setErr] = useState("");
  async function submit() {
    try {
      const body = {
        clientLabel: client,
        task,
        notes,
        priority,
        dueAt: new Date(due).toISOString(),
      };
      await call(initial ? "/api/followups/" + initial.id : "/api/followups", {
        method: initial ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await saved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }
  return (
    <div className="modal">
      <div className="sheet">
        <button className="close" onClick={close}>
          ×
        </button>
        <span className="eyebrow">
          {initial ? "EDIT FOLLOW-UP" : "NEW FOLLOW-UP"}
        </span>
        <h2>{initial ? "Update follow-up" : "Add in under 20 seconds"}</h2>
        <label>
          Client or company
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. ABC Trading"
          />
        </label>
        <label>
          Follow-up action
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Use a generic action; do not include confidential information."
          />
        </label>
        <label>
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Generic context only."
          />
        </label>
        <label>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label>
          Due date & time
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary wide" onClick={submit}>
          {initial ? "Save changes" : "Save follow-up"}
        </button>
      </div>
    </div>
  );
}
function NextPrompt({
  item,
  close,
  saved,
}: {
  item: F;
  close: () => void;
  saved: () => void;
}) {
  async function create(days: number) {
    await call("/api/followups", {
      method: "POST",
      body: JSON.stringify({
        clientLabel: item.client_label,
        task: "Follow up again",
        notes: "",
        priority: item.priority,
        dueAt: new Date(Date.now() + days * 86400000).toISOString(),
      }),
    });
    await saved();
  }
  return (
    <div className="modal">
      <div className="sheet compact">
        <button className="close" onClick={close}>
          ×
        </button>
        <span className="eyebrow">COMPLETED</span>
        <h2>Does {item.client_label} need another follow-up?</h2>
        <div className="choiceGrid">
          <button onClick={() => create(1)}>Tomorrow</button>
          <button onClick={() => create(3)}>In 3 days</button>
          <button onClick={() => create(7)}>In 1 week</button>
          <button onClick={close}>No follow-up</button>
        </div>
      </div>
    </div>
  );
}
function SnoozePrompt({
  item,
  close,
  snooze,
}: {
  item: F;
  close: () => void;
  snooze: (minutes: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function choose(minutes: number) {
    if (busy) return;
    setBusy(true);
    try {
      await snooze(minutes);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal">
      <div className="sheet compact">
        <button className="close" onClick={close}>
          ×
        </button>
        <span className="eyebrow">SNOOZE</span>
        <h2>Remind me about {item.client_label}</h2>
        <div className="choiceGrid">
          <button disabled={busy} onClick={() => choose(30)}>
            In 30 minutes
          </button>
          <button disabled={busy} onClick={() => choose(60)}>
            In 1 hour
          </button>
          <button disabled={busy} onClick={() => choose(1440)}>
            Tomorrow
          </button>
          <button disabled={busy} onClick={() => choose(4320)}>
            In 3 days
          </button>
          <button disabled={busy} onClick={() => choose(10080)}>
            In 1 week
          </button>
        </div>
      </div>
    </div>
  );
}
function ActivityModal({
  data,
  close,
}: {
  data: { item: F; rows: Activity[] };
  close: () => void;
}) {
  return (
    <div className="modal">
      <div className="sheet">
        <button className="close" onClick={close}>
          ×
        </button>
        <span className="eyebrow">ACTIVITY</span>
        <h2>{data.item.client_label}</h2>
        <div className="timeline">
          {data.rows.length ? (
            data.rows.map((a, i) => (
              <div className="event" key={i}>
                <b>{a.event_type.replaceAll("_", " ")}</b>
                <small>{new Date(a.created_at).toLocaleString()}</small>
                {a.detail && <p>{formatActivityDetail(a)}</p>}
              </div>
            ))
          ) : (
            <div className="empty">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
function Section({
  title,
  items,
  empty,
  done,
  snooze,
  edit,
  activity,
}: {
  title: string;
  items: F[];
  empty: string;
  done: (x: F) => void;
  snooze: (x: F) => void;
  edit: (x: F) => void;
  activity: (x: F) => void;
}) {
  return (
    <section>
      <div className="sectionTitle">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      {!items.length ? (
        <div className="empty">{empty}</div>
      ) : (
        items.map((x) => (
          <article key={x.id}>
            <div>
              <span className={"priority " + x.priority}>{x.priority}</span>
              <h3>{x.client_label}</h3>
              <p>{x.task}</p>
              <small>
                <Clock /> {new Date(x.due_at).toLocaleString()}
              </small>
            </div>
            <div className="actions">
              {x.status !== "completed" && (
                <>
                  <button onClick={() => done(x)}>
                    <Check /> Done
                  </button>
                  <button onClick={() => snooze(x)}>
                    <RotateCcw /> Snooze
                  </button>
                  <button onClick={() => edit(x)}>
                    <Edit3 /> Edit
                  </button>
                </>
              )}
              <button onClick={() => activity(x)}>
                <History /> History
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
function formatActivityDetail(activity: Activity) {
  if (activity.event_type !== "snoozed") return activity.detail;
  const minutes = Number(activity.detail);
  if (minutes === 30) return "Snoozed for 30 minutes";
  if (minutes === 60) return "Snoozed for 1 hour";
  if (minutes === 1440) return "Snoozed for 1 day";
  if (minutes === 4320) return "Snoozed for 3 days";
  if (minutes === 10080) return "Snoozed for 1 week";
  return `Snoozed for ${minutes} minutes`;
}
function toLocal(iso: string) {
  const d = new Date(iso),
    off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

type Prefs = {
  email_enabled: boolean;
  due_reminders: boolean;
  overdue_reminders: boolean;
  morning_digest: boolean;
  morning_hour: number;
  end_of_day_digest: boolean;
  end_of_day_hour: number;
  due_lead_minutes: number;
};
function ReminderSettings({ close }: { close: () => void }) {
  const [p, setP] = useState<Prefs | null>(null),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState("");
  useEffect(() => {
    void call("/api/reminder-preferences")
      .then((j) => setP(j.data))
      .catch((e) =>
        setErr(e instanceof Error ? e.message : "Failed to load settings"),
      );
  }, []);
  async function save() {
    if (!p) return;
    try {
      const j = await call("/api/reminder-preferences", {
        method: "PATCH",
        body: JSON.stringify(p),
      });
      setP(j.data);
      setMsg("Reminder settings saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }
  async function test() {
    try {
      await call("/api/reminders/test", { method: "POST" });
      setMsg("Test reminder sent to your account email.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Test reminder failed");
    }
  }
  if (!p)
    return (
      <div className="modal">
        <div className="sheet">
          <button className="close" onClick={close}>
            ×
          </button>
          <div className="empty">Loading reminder settings…</div>
        </div>
      </div>
    );
  const toggle = (k: keyof Prefs) => (
    <input
      type="checkbox"
      checked={Boolean(p[k])}
      onChange={(e) => setP({ ...p, [k]: e.target.checked })}
    />
  );
  return (
    <div className="modal">
      <div className="sheet">
        <button className="close" onClick={close}>
          ×
        </button>
        <span className="eyebrow">REMINDERS</span>
        <h2>Reminder preferences</h2>
        <div className="settings">
          <label className="toggle">
            {toggle("email_enabled")}
            <span>Email reminders enabled</span>
          </label>
          <label className="toggle">
            {toggle("due_reminders")}
            <span>Due-soon reminders</span>
          </label>
          <label>
            Remind me before due
            <select
              value={p.due_lead_minutes}
              onChange={(e) =>
                setP({ ...p, due_lead_minutes: Number(e.target.value) })
              }
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={1440}>1 day</option>
            </select>
          </label>
          <label className="toggle">
            {toggle("overdue_reminders")}
            <span>Overdue reminders</span>
          </label>
          <label className="toggle">
            {toggle("morning_digest")}
            <span>Morning summary</span>
          </label>
          <label>
            Morning summary hour
            <input
              type="number"
              min="0"
              max="23"
              value={p.morning_hour}
              onChange={(e) =>
                setP({ ...p, morning_hour: Number(e.target.value) })
              }
            />
          </label>
          <label className="toggle">
            {toggle("end_of_day_digest")}
            <span>End-of-day unfinished summary</span>
          </label>
          <label>
            End-of-day hour
            <input
              type="number"
              min="0"
              max="23"
              value={p.end_of_day_hour}
              onChange={(e) =>
                setP({ ...p, end_of_day_hour: Number(e.target.value) })
              }
            />
          </label>
        </div>
        {err && <p className="error">{err}</p>}
        {msg && <p className="success">{msg}</p>}
        <div className="choiceGrid">
          <button onClick={test}>Send test email</button>
          <button className="primary" onClick={save}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
