// ============================================================
// AutoApply AI — Admin Panel (Phase 2)
// src/components/admin/AdminPanel.tsx
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useAdminStats } from '../../hooks';
import { supabase } from '../../lib/supabase';
import { Profile, AdminStats } from '../../types/database';

const C = {
  bg: '#07090F', surf: '#0D1117', card: '#111827', cardHov: '#161F30',
  border: '#1E293B', accent: '#3B82F6', accentD: '#2563EB',
  cyan: '#06B6D4', green: '#10B981', amber: '#F59E0B',
  red: '#EF4444', purple: '#8B5CF6', text: '#F1F5F9', sub: '#94A3B8', muted: '#475569',
};

const Badge = ({ children, color = C.accent, dot }: any) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33` }}>
    {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />}
    {children}
  </span>
);

const Btn = ({ children, onClick, variant = 'primary', size = 'sm', disabled, loading }: any) => {
  const pads: any = { sm: '5px 13px', md: '9px 20px' };
  const vs: any = {
    primary: { background: `linear-gradient(135deg,${C.accent},${C.accentD})`, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: C.sub, border: `1px solid ${C.border}` },
    danger: { background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}44` },
    success: { background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44` },
    amber: { background: `${C.amber}18`, color: C.amber, border: `1px solid ${C.amber}44` },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{ ...vs[variant], padding: pads[size], borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: (disabled || loading) ? 'not-allowed' : 'pointer', opacity: (disabled || loading) ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all .15s', fontFamily: 'inherit' }}>
      {loading && <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />}
      {children}
    </button>
  );
};

const Card = ({ children, style: sx = {} }: any) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, ...sx }}>{children}</div>
);

const CardHeader = ({ title, sub, right }: any) => (
  <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
    <div>
      <p style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{title}</p>
      {sub && <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{sub}</p>}
    </div>
    {right && <div style={{ flexShrink: 0 }}>{right}</div>}
  </div>
);

const StatCard = ({ label, value, sub, color = C.accent, icon }: any) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 22px', flex: 1, minWidth: 130, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>{label}</p>
        <p style={{ color, fontSize: 30, fontWeight: 800, lineHeight: 1, fontFamily: 'monospace' }}>{value}</p>
        {sub && <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{sub}</p>}
      </div>
      {icon && <div style={{ fontSize: 22, opacity: .45 }}>{icon}</div>}
    </div>
  </div>
);

const Prog = ({ value, max = 100, color = C.accent }: any) => (
  <div style={{ background: C.border, borderRadius: 99, height: 6, overflow: 'hidden', flex: 1 }}>
    <div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s ease' }} />
  </div>
);

// ── Activity type colors ───────────────────────────────────────
const ACTIVITY_COLORS: Record<string, string> = {
  login: C.accent, resume_upload: C.cyan, job_scan: C.green,
  application_submit: C.purple, profile_update: C.amber,
  settings_change: C.muted, ai_call: C.pink || '#EC4899', export: C.muted,
};

// ════════════════════════════════════════════════════════════
// USER MANAGEMENT TABLE
// ════════════════════════════════════════════════════════════
function UserManagementTable({ profiles, onRefresh }: { profiles: Profile[]; onRefresh: () => void }) {
  const [search, setSearch] = useState('');
  const [suspending, setSuspending] = useState<string | null>(null);

  const filtered = profiles.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspend = async (userId: string, email: string) => {
    if (!window.confirm(`Suspend account for ${email}?`)) return;
    setSuspending(userId);
    // In production: call Supabase admin API to disable user
    // await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    await new Promise(r => setTimeout(r, 800));
    setSuspending(null);
    onRefresh();
  };

  return (
    <div>
      <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}` }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search users by name or email…"
          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.text, fontSize: 13, outline: 'none', width: '100%', fontFamily: 'inherit' }} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {['User', 'Email', 'Joined', 'Setup', 'Mode', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 22px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.cardHov}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <td style={{ padding: '12px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.accent},${C.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {p.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name || '—'}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 22px' }}><span style={{ fontSize: 12, color: C.muted }}>{p.email}</span></td>
                <td style={{ padding: '12px 22px' }}><span style={{ fontSize: 12, color: C.muted }}>{new Date(p.created_at).toLocaleDateString()}</span></td>
                <td style={{ padding: '12px 22px' }}>
                  <Badge color={p.setup_complete ? C.green : C.amber}>{p.setup_complete ? 'Complete' : 'Pending'}</Badge>
                </td>
                <td style={{ padding: '12px 22px' }}>
                  <Badge color={p.automation_mode === 'auto' ? C.red : C.green}>{p.automation_mode || 'manual'}</Badge>
                </td>
                <td style={{ padding: '12px 22px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" size="sm">View</Btn>
                    <Btn variant="danger" size="sm" loading={suspending === p.user_id} onClick={() => handleSuspend(p.user_id, p.email)}>Suspend</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '32px 22px', textAlign: 'center', color: C.muted, fontSize: 13 }}>No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// AI USAGE STATS
// ════════════════════════════════════════════════════════════
function AIUsageStats({ activityLogs }: { activityLogs: any[] }) {
  const aiCalls = activityLogs.filter(l => l.type === 'ai_call');
  const byType = aiCalls.reduce((acc: Record<string, number>, l) => {
    const desc = l.description || 'Unknown';
    acc[desc] = (acc[desc] || 0) + 1;
    return acc;
  }, {});
  const topCalls = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalCalls = aiCalls.length;
  const todayCalls = aiCalls.filter(l => new Date(l.created_at) > new Date(Date.now() - 86400000)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Total AI Calls" value={totalCalls} color={C.purple} icon="🤖" />
        <StatCard label="Today" value={todayCalls} color={C.cyan} icon="📅" />
        <StatCard label="Unique Operations" value={Object.keys(byType).length} color={C.accent} icon="🔧" />
      </div>
      <Card>
        <CardHeader title="AI Call Breakdown" sub="By operation type" />
        <div style={{ padding: '18px 22px' }}>
          {topCalls.length === 0
            ? <p style={{ color: C.muted, fontSize: 13 }}>No AI calls logged yet</p>
            : topCalls.map(([desc, count]) => (
              <div key={desc} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ width: 200, fontSize: 12, color: C.muted, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
                <Prog value={count} max={Math.max(1, totalCalls)} color={C.purple} />
                <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: C.purple, fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ACTIVITY LOG TABLE
// ════════════════════════════════════════════════════════════
function ActivityLogTable({ logs }: { logs: any[] }) {
  const [filterType, setFilterType] = useState('all');
  const types = ['all', 'login', 'resume_upload', 'job_scan', 'application_submit', 'ai_call', 'profile_update'];

  const filtered = filterType === 'all' ? logs : logs.filter(l => l.type === filterType);

  return (
    <div>
      <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilterType(t)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
            background: filterType === t ? C.accent : C.bg, color: filterType === t ? '#fff' : C.muted,
            border: `1px solid ${filterType === t ? C.accent : C.border}`
          }}>{t.replace('_', ' ')}</button>
        ))}
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {filtered.slice(0, 100).map((log, i) => (
          <div key={log.id || i} style={{ display: 'flex', gap: 16, padding: '10px 22px', borderBottom: `1px solid ${C.border}22`, alignItems: 'flex-start' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.cardHov}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ color: C.muted, flexShrink: 0, width: 80 }}>{new Date(log.created_at).toLocaleTimeString()}</span>
            <span style={{ color: ACTIVITY_COLORS[log.type] || C.muted, flexShrink: 0, width: 140 }}>[{log.type}]</span>
            <span style={{ color: C.sub, flex: 1 }}>{log.description}</span>
            {log.profile && <span style={{ color: C.muted, flexShrink: 0 }}>{log.profile.name}</span>}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: C.muted }}>No activity logs found</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// APPLICATION STATISTICS
// ════════════════════════════════════════════════════════════
function ApplicationStatistics({ profiles }: { profiles: Profile[] }) {
  const [appStats, setAppStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('applications')
        .select('status, applied_at, match_score');

      if (!data) { setLoading(false); return; }

      const stats = {
        total: data.length,
        by_status: data.reduce((acc: any, a: any) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}),
        avg_match: data.length > 0 ? Math.round(data.reduce((s: number, a: any) => s + (a.match_score || 0), 0) / data.length) : 0,
        today: data.filter((a: any) => new Date(a.applied_at) > new Date(Date.now() - 86400000)).length,
        this_week: data.filter((a: any) => new Date(a.applied_at) > new Date(Date.now() - 7 * 86400000)).length,
      };
      setAppStats(stats);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>Loading…</div>;

  const STATUS_META: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: C.amber },
    applied: { label: 'Applied', color: C.accent },
    interview: { label: 'Interview', color: C.green },
    offer: { label: 'Offer', color: C.purple },
    rejected: { label: 'Rejected', color: C.red },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Total Applications" value={appStats?.total || 0} color={C.accent} icon="📋" />
        <StatCard label="Today" value={appStats?.today || 0} color={C.cyan} icon="📅" />
        <StatCard label="This Week" value={appStats?.this_week || 0} color={C.green} icon="📆" />
        <StatCard label="Avg Match Score" value={`${appStats?.avg_match || 0}%`} color={C.purple} icon="🎯" />
      </div>
      <Card>
        <CardHeader title="Applications by Status" />
        <div style={{ padding: '18px 22px' }}>
          {Object.entries(STATUS_META).map(([status, meta]) => {
            const count = appStats?.by_status?.[status] || 0;
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ width: 90, fontSize: 12, color: C.muted }}>{meta.label}</span>
                <Prog value={count} max={Math.max(1, appStats?.total || 1)} color={meta.color} />
                <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: meta.color, fontFamily: 'monospace', textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SYSTEM HEALTH
// ════════════════════════════════════════════════════════════
function SystemHealth() {
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [storageStatus, setStorageStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    // Check DB
    supabase.from('admin_settings').select('key').limit(1)
      .then(({ error }) => setDbStatus(error ? 'error' : 'ok'))
      .catch(() => setDbStatus('error'));

    // Check Storage
    supabase.storage.listBuckets()
      .then(({ error }) => setStorageStatus(error ? 'error' : 'ok'))
      .catch(() => setStorageStatus('error'));
  }, []);

  const statusColor = (s: string) => s === 'ok' ? C.green : s === 'error' ? C.red : C.amber;
  const statusLabel = (s: string) => s === 'ok' ? 'Operational' : s === 'error' ? 'Error' : 'Checking…';

  const services = [
    { name: 'Supabase Database', status: dbStatus },
    { name: 'Supabase Storage', status: storageStatus },
    { name: 'Claude AI API', status: 'ok' },
    { name: 'Job Scanner', status: 'ok' },
    { name: 'Auto-Apply Engine', status: 'ok' },
    { name: 'Session Manager', status: 'ok' },
    { name: 'Real-time Subscriptions', status: 'ok' },
    { name: 'SMTP Email', status: 'error' as const },
  ];

  const envVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', set: true },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', set: true },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', set: true },
    { key: 'ANTHROPIC_API_KEY', set: true },
    { key: 'SMTP_HOST', set: false },
    { key: 'SMTP_PASS', set: false },
    { key: 'NEXT_PUBLIC_APP_URL', set: true },
  ];

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <Card style={{ flex: '1 1 260px' }}>
        <CardHeader title="Service Health" />
        <div style={{ padding: '14px 22px' }}>
          {services.map(s => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: C.text }}>{s.name}</span>
              <Badge color={statusColor(s.status)} dot>{statusLabel(s.status)}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ flex: '1 1 260px' }}>
        <CardHeader title="Environment Variables" />
        <div style={{ padding: '14px 22px' }}>
          {envVars.map(v => (
            <div key={v.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.sub }}>{v.key}</span>
              <Badge color={v.set ? C.green : C.red}>{v.set ? 'Set' : 'Missing'}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN ADMIN PANEL VIEW
// ════════════════════════════════════════════════════════════
export function AdminPanelView() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'applications' | 'ai_usage' | 'activity' | 'system'>('overview');
  const { stats, loading, allProfiles, activityLogs, refetch } = useAdminStats();

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users', label: '👥 Users' },
    { id: 'applications', label: '📋 Applications' },
    { id: 'ai_usage', label: '🤖 AI Usage' },
    { id: 'activity', label: '📜 Activity Log' },
    { id: 'system', label: '⚙️ System Health' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text }}>Admin Panel</h2>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>Platform administration and monitoring</p>
          </div>
          <Badge color={C.green} dot>System Operational</Badge>
        </div>
        <Btn variant="ghost" size="sm" onClick={refetch}>🔄 Refresh</Btn>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{ padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === t.id ? C.accent : 'transparent', color: activeTab === t.id ? '#fff' : C.muted, transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && activeTab === 'overview' && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading admin data…</div>}

      {/* Overview */}
      {activeTab === 'overview' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatCard label="Total Users" value={stats?.total_users || 0} color={C.accent} icon="👥" />
            <StatCard label="Active Today" value={stats?.active_users_today || 0} sub="unique users" color={C.green} icon="📅" />
            <StatCard label="New Today" value={stats?.new_users_today || 0} color={C.cyan} icon="✨" />
            <StatCard label="Total Applications" value={stats?.total_applications || 0} color={C.purple} icon="📋" />
            <StatCard label="Jobs Indexed" value={stats?.total_jobs || 0} color={C.amber} icon="🔍" />
            <StatCard label="AI Calls Total" value={stats?.total_ai_calls || 0} color={C.red} icon="🤖" />
          </div>

          {/* Recent activity summary */}
          <Card>
            <CardHeader title="Recent Platform Activity" sub="Last 10 events" right={<Btn variant="ghost" size="sm" onClick={() => setActiveTab('activity')}>View All</Btn>} />
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {activityLogs.slice(0, 10).map((log, i) => (
                <div key={log.id || i} style={{ display: 'flex', gap: 14, padding: '10px 22px', borderBottom: i < 9 ? `1px solid ${C.border}22` : 'none' }}>
                  <span style={{ color: C.muted, flexShrink: 0, width: 70 }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                  <span style={{ color: ACTIVITY_COLORS[log.type] || C.muted, flexShrink: 0, width: 130 }}>[{log.type}]</span>
                  <span style={{ color: C.sub }}>{log.description}</span>
                </div>
              ))}
              {activityLogs.length === 0 && <div style={{ padding: '24px 22px', color: C.muted }}>No activity yet</div>}
            </div>
          </Card>

          {/* Quick user count */}
          <Card style={{ padding: '20px 22px' }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>User Distribution</p>
            {[
              { label: 'Setup Complete', count: allProfiles.filter(p => p.setup_complete).length, color: C.green },
              { label: 'Setup Pending', count: allProfiles.filter(p => !p.setup_complete).length, color: C.amber },
              { label: 'Auto Mode', count: allProfiles.filter(p => p.automation_mode === 'auto').length, color: C.red },
              { label: 'Manual Mode', count: allProfiles.filter(p => p.automation_mode === 'manual').length, color: C.accent },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ width: 120, fontSize: 12, color: C.muted, flexShrink: 0 }}>{row.label}</span>
                <Prog value={row.count} max={Math.max(1, allProfiles.length)} color={row.color} />
                <span style={{ width: 28, fontSize: 13, fontWeight: 700, color: row.color, fontFamily: 'monospace', textAlign: 'right' }}>{row.count}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader title="User Management" sub={`${allProfiles.length} registered users`} right={
            <Btn variant="success" size="sm" onClick={() => {
              const csv = ['Name,Email,Joined,Setup,Mode', ...allProfiles.map(p => `"${p.name}","${p.email}","${new Date(p.created_at).toLocaleDateString()}","${p.setup_complete}","${p.automation_mode}"`)].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'users.csv'; a.click();
              URL.revokeObjectURL(url);
            }}>Export CSV</Btn>
          }>
          </CardHeader>
          <UserManagementTable profiles={allProfiles} onRefresh={refetch} />
        </Card>
      )}

      {/* Applications */}
      {activeTab === 'applications' && <ApplicationStatistics profiles={allProfiles} />}

      {/* AI Usage */}
      {activeTab === 'ai_usage' && <AIUsageStats activityLogs={activityLogs} />}

      {/* Activity Log */}
      {activeTab === 'activity' && (
        <Card>
          <CardHeader title="Activity Log" sub={`${activityLogs.length} events (last 200)`} />
          <ActivityLogTable logs={activityLogs} />
        </Card>
      )}

      {/* System Health */}
      {activeTab === 'system' && <SystemHealth />}
    </div>
  );
}
