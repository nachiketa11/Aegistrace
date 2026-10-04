import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, ArrowRight, BarChart3, Bell, FileText, Gauge, Lock, LogOut, Radar, Shield, ShieldAlert, Users, Wrench } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'ANALYST' | 'ADMIN';
};

type ApiResponse<T> = { data: T };

type OverviewData = {
  totalEvents: number;
  activeThreats: number;
  criticalHighThreats: number;
  openIncidents: number;
  resolvedIncidents: number;
  recentThreats: Array<{ id: string; severity: string; rule: { code: string; name: string } }>;
};

type TimelinePoint = { label: string; events: number; threats: number };

type ThreatRow = {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  riskScore: number;
  sourceIp: string;
  endpoint: string;
  rule: { code: string; name: string };
  createdAt: string;
};

type IncidentRow = {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED';
  createdAt: string;
  createdBy: { name: string };
};

const colors = ['#8b5cf6', '#ef4444', '#f59e0b', '#10b981'];
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${input}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Request failed');
  }

  return payload as T;
}

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  login: (values: { email: string; password: string }) => Promise<void>;
  register: (values: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
} | null>(null);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
          <Route path="/dashboard" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/events" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/threats" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/incidents" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/simulator" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/rules" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/audit" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const result = await fetchJson<{ data: { id: string; name: string; email: string; role: string } }>(`/api/auth/me`);
      setUser({
        id: result.data.id,
        name: result.data.name,
        email: result.data.email,
        role: result.data.role as User['role'],
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (values: { email: string; password: string }) => {
    await fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    await refresh();
  };

  const register = async (values: { name: string; email: string; password: string }) => {
    await fetchJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(values),
    });
  };

  const logout = async () => {
    await fetchJson('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Auth context not found');
  return context;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: Gauge },
    { label: 'Events', to: '/events', icon: Activity },
    { label: 'Threats', to: '/threats', icon: ShieldAlert },
    { label: 'Incidents', to: '/incidents', icon: Bell },
    { label: 'Simulator', to: '/simulator', icon: Radar },
    { label: 'Rules', to: '/rules', icon: Wrench },
    { label: 'Audit', to: '/audit', icon: FileText },
    { label: 'Settings', to: '/settings', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 w-72 border-r border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="rounded-xl bg-violet-500/20 p-2 text-violet-300"><Shield className="h-5 w-5" /></div>
          <div>
            <div className="text-lg font-semibold">AegisTrace</div>
            <div className="text-xs text-slate-400">See the signal. Trace the threat.</div>
          </div>
        </div>
        <nav className="space-y-2 p-4">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }: { isActive: boolean }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-violet-500/20 text-violet-200' : 'text-slate-300 hover:bg-slate-900'}`}>
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 p-4">
          <div className="mb-3 text-sm text-slate-400">Signed in as {user?.name}</div>
          <button type="button" onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
      <main className="ml-72 p-8">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/threats" element={<ThreatsPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.18),_transparent_45%),linear-gradient(180deg,#020617,#0f172a)] text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/20 p-2 text-violet-300"><Shield className="h-5 w-5" /></div>
          <div>
            <div className="text-lg font-semibold">AegisTrace</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Login</Link>
          <Link to="/signup" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Create account</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              <Activity className="h-3.5 w-3.5" /> Defensive SOC workspace
            </div>
            <h1 className="max-w-xl text-5xl font-bold tracking-tight text-white">See the signal. Trace the threat.</h1>
            <p className="mt-5 max-w-lg text-lg text-slate-300">A working security operations platform for validating event ingestion, threat detection, incident handling, and security visibility.</p>
            <div className="mt-8 flex items-center gap-4">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-500">Get started <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/login" className="rounded-xl border border-slate-700 px-5 py-3 font-medium text-slate-100">Sign in</Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-violet-950/30">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><Radar className="h-4 w-4 text-violet-300" /> Security summary</div>
              <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300">Live pipeline</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Events ingested', value: '24,890', icon: Activity },
                { label: 'Open threats', value: '18', icon: AlertTriangle },
                { label: 'Critical incidents', value: '4', icon: ShieldAlert },
                { label: 'Mean risk', value: '72', icon: Gauge },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <item.icon className="h-4 w-4 text-violet-300" />
                    <span className="text-xs text-slate-400">updated</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{item.value}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError('');
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-950/30">
        <div className="mb-6 flex items-center gap-3 text-violet-300"><Lock className="h-5 w-5" /> <span className="font-semibold">AegisTrace sign in</span></div>
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-400">Use your analyst or admin credentials to access the SOC workspace.</p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm text-slate-300">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-violet-500" placeholder="analyst@example.com" />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input value={password} type="password" onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-violet-500" placeholder="••••••••••••" />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

        <button type="submit" disabled={loading} className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 font-medium text-white hover:bg-violet-500 disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in'}</button>
        <div className="mt-4 text-center text-sm text-slate-400">Need access? <Link to="/signup" className="text-violet-300">Create an account</Link></div>
      </form>
    </div>
  );
}

function SignupPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError('');
      setLoading(true);
      await register(state);
      await login({ email: state.email, password: state.password });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-950/30">
        <div className="mb-6 flex items-center gap-3 text-violet-300"><Users className="h-5 w-5" /> <span className="font-semibold">Create account</span></div>
        <h1 className="text-2xl font-bold text-white">Register for AegisTrace</h1>

        <div className="mt-6 space-y-4">
          <label className="block text-sm text-slate-300">
            Full name
            <input value={state.name} onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-violet-500" placeholder="Alex Morgan" />
          </label>
          <label className="block text-sm text-slate-300">
            Email
            <input value={state.email} onChange={(e) => setState((prev) => ({ ...prev, email: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-violet-500" placeholder="alex@aegistrace.io" />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input value={state.password} type="password" onChange={(e) => setState((prev) => ({ ...prev, password: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-violet-500" placeholder="Minimum 12 characters" />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

        <button type="submit" disabled={loading} className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 font-medium text-white hover:bg-violet-500 disabled:opacity-60">{loading ? 'Creating account…' : 'Create account'}</button>
        <div className="mt-4 text-center text-sm text-slate-400">Already have an account? <Link to="/login" className="text-violet-300">Sign in</Link></div>
      </form>
    </div>
  );
}

function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [distribution, setDistribution] = useState<Array<{ severity: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [overviewData, timelineData, distData] = await Promise.all([
          fetchJson<ApiResponse<OverviewData>>('/api/dashboard/overview'),
          fetchJson<ApiResponse<TimelinePoint[]>>('/api/dashboard/timeline'),
          fetchJson<ApiResponse<Array<{ severity: string; count: number }>>>('/api/dashboard/threat-distribution'),
        ]);
        setOverview(overviewData.data ?? overviewData as unknown as OverviewData);
        setTimeline(Array.isArray(timelineData) ? timelineData : timelineData.data ?? []);
        setDistribution(Array.isArray(distData) ? distData : distData.data ?? []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const summaryCards = useMemo(() => [
    { label: 'Total events', value: overview?.totalEvents ?? 0, icon: Activity },
    { label: 'Active threats', value: overview?.activeThreats ?? 0, icon: AlertTriangle },
    { label: 'Critical/high', value: overview?.criticalHighThreats ?? 0, icon: ShieldAlert },
    { label: 'Open incidents', value: overview?.openIncidents ?? 0, icon: Bell },
  ], [overview]);

  if (loading) return <div className="text-slate-200">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-violet-300">Overview</div>
          <h1 className="mt-2 text-3xl font-bold text-white">Executive dashboard</h1>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><Icon className="h-4 w-4 text-violet-300" /></div>
            <div className="mt-4 text-3xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200"><BarChart3 className="h-4 w-4 text-violet-300" /> Threat timeline</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="events" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="threats" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200"><Shield className="h-4 w-4 text-violet-300" /> Threat distribution</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="count" nameKey="severity" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {distribution.map((entry, index) => <Cell key={entry.severity} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {distribution.map((entry, index) => (
              <div key={entry.severity} className="flex items-center justify-between text-sm text-slate-300">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /> {entry.severity}</div>
                <span>{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-200"><AlertTriangle className="h-4 w-4 text-violet-300" /> Recent detections</div>
        <div className="space-y-3">
          {(overview?.recentThreats ?? []).map((threat) => (
            <div key={threat.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <div>
                <div className="font-medium text-white">{threat.rule.code} · {threat.rule.name}</div>
                <div className="text-xs text-slate-400">{threat.rule.name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-violet-200">{threat.severity}</div>
              </div>
            </div>
          ))}
          {!overview?.recentThreats?.length && <div className="text-sm text-slate-400">No detections yet.</div>}
        </div>
      </div>
    </div>
  );
}

function EventsPage() {
  const [events, setEvents] = useState<Array<{ id: string; sourceIp: string; path: string; userAgent?: string; statusCode: number; occurredAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchJson<ApiResponse<Array<{ id: string; sourceIp: string; path: string; userAgent?: string; statusCode: number; occurredAt: string }>>>('/api/events?page=1&limit=10');
        setEvents(result.data ?? []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-white">Events</h1>
      {loading ? <div className="text-slate-300">Loading events…</div> : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-950 text-slate-300">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">{new Date(event.occurredAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{event.sourceIp}</td>
                  <td className="px-4 py-3">{event.path}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-800 px-2 py-1 text-xs">{event.statusCode}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ThreatsPage() {
  const [rows, setRows] = useState<ThreatRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const result = await fetchJson<ApiResponse<ThreatRow[]>>('/api/threats?page=1&limit=10');
      setRows(result.data ?? []);
    };
    void load();
  }, []);

  const updateStatus = async (id: string, status: ThreatRow['status']) => {
    const result = await fetchJson<{ id: string }>(`/api/threats/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setRows((current) => current.map((row) => row.id === id ? { ...row, status: status, id: result.id ?? row.id } : row));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-white">Threats</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full text-left text-sm text-slate-200">
          <thead className="bg-slate-950 text-slate-300">
            <tr><th className="px-4 py-3">Rule</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{row.rule.code}</td>
                <td className="px-4 py-3">{row.sourceIp}</td>
                <td className="px-4 py-3">{row.riskScore}</td>
                <td className="px-4 py-3"><select value={row.status} onChange={(event) => void updateStatus(row.id, event.target.value as ThreatRow['status'])} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"><option value="OPEN">OPEN</option><option value="INVESTIGATING">INVESTIGATING</option><option value="RESOLVED">RESOLVED</option><option value="FALSE_POSITIVE">FALSE_POSITIVE</option></select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await fetchJson<ApiResponse<IncidentRow[]>>('/api/incidents');
        setIncidents(result.data ?? []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-white">Incidents</h1>
      {loading ? <div className="text-slate-300">Loading incidents…</div> : (
        <div className="space-y-4">
          {incidents.map((incident) => (
            <div key={incident.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">{incident.title}</div>
                  <div className="mt-1 text-sm text-slate-400">Created by {incident.createdBy.name}</div>
                </div>
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-200">{incident.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{incident.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SimulatorPage() {
  const [scenario, setScenario] = useState('BRUTE_FORCE');
  const [count, setCount] = useState(5);
  const [result, setResult] = useState<{ scenario: string; generated: number; persistedThreats: number } | null>(null);

  const run = async () => {
    const payload = await fetchJson<{ data: { scenario: string; generated: number; persistedThreats: number } }>('/api/simulator/generate', {
      method: 'POST',
      body: JSON.stringify({ scenario, count }),
    });
    setResult(payload.data ?? payload as unknown as { scenario: string; generated: number; persistedThreats: number });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Security-event simulator</h1>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <label className="text-sm text-slate-300">
            Scenario
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white">
              <option value="NORMAL">Normal Traffic</option>
              <option value="BRUTE_FORCE">Brute Force</option>
              <option value="SQL_INJECTION">Potential SQL Injection</option>
              <option value="XSS">Potential XSS</option>
              <option value="SCANNER">Scanner</option>
              <option value="MIXED">Mixed Attack</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Count
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-white" />
          </label>
          <button type="button" onClick={() => void run()} className="rounded-xl bg-violet-600 px-4 py-3 font-medium text-white">Generate</button>
        </div>
      </div>

      {result ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="text-lg font-semibold text-white">Simulation result</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <div>Scenario: {result.scenario}</div>
            <div>Generated events: {result.generated}</div>
            <div>Persisted threats: {result.persistedThreats}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RulesPage() {
  const [rules, setRules] = useState<Array<{ id: string; code: string; name: string; enabled: boolean }>>([]);
  useEffect(() => {
    const load = async () => {
      const result = await fetchJson<ApiResponse<Array<{ id: string; code: string; name: string; enabled: boolean }>>>('/api/rules');
      setRules(result.data ?? []);
    };
    void load();
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    const result = await fetchJson<{ id: string; enabled: boolean }>(`/api/rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, enabled: result.enabled ?? enabled } : rule)));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-white">Detection rules</h1>
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div>
              <div className="text-white font-medium">{rule.code} · {rule.name}</div>
            </div>
            <button type="button" onClick={() => void toggle(rule.id, !rule.enabled)} className={`rounded-full px-3 py-1 text-xs font-medium ${rule.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-200'}`}>{rule.enabled ? 'Enabled' : 'Disabled'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditPage() {
  const [logs, setLogs] = useState<Array<{ id: string; action: string; createdAt: string }>>([]);
  useEffect(() => {
    const load = async () => {
      const result = await fetchJson<ApiResponse<Array<{ id: string; action: string; createdAt: string }>>>('/api/audit');
      setLogs(result.data ?? []);
    };
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-white">Audit log</h1>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            <div className="font-medium text-white">{log.action}</div>
            <div className="mt-1 text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-white">Settings</h1>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="text-sm text-slate-400">User</div>
        <div className="mt-2 text-xl font-semibold text-white">{user?.name}</div>
        <div className="mt-1 text-sm text-slate-300">{user?.email}</div>
        <div className="mt-4 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-200">{user?.role}</div>
      </div>
    </div>
  );
}

export default App;
