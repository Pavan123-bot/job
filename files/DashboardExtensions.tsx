// ============================================================
// AutoApply AI — Dashboard Phase 2 Extensions
// src/components/DashboardExtensions.tsx
// Drop these widgets into the existing DashboardView
// ============================================================

import { useState, useEffect } from 'react';
import { useDashboardStats, useJobStats, useRecommendedJobs, useCareerInsights } from '../hooks';
import { Profile, DashboardStats } from '../types/database';

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

const Prog = ({ value, max = 100, color = C.accent, h = 6 }: any) => (
  <div style={{ background: C.border, borderRadius: 99, height: h, overflow: 'hidden', flex: 1 }}>
    <div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s ease' }} />
  </div>
);

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

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color = C.accent, icon, delta }: any) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 22px', flex: 1, minWidth: 130, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>{label}</p>
          <p style={{ color, fontSize: 30, fontWeight: 800, lineHeight: 1, fontFamily: 'monospace' }}>{value ?? '—'}</p>
          {sub && <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{sub}</p>}
          {delta !== undefined && (
            <p style={{ fontSize: 11, color: delta >= 0 ? C.green : C.red, marginTop: 4 }}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} from last week
            </p>
          )}
        </div>
        {icon && <div style={{ fontSize: 22, opacity: .45 }}>{icon}</div>}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// JOB DISCOVERY STATS WIDGET
// Replaces the simple "Jobs Found" stat in the old dashboard
// ════════════════════════════════════════════════════════════
export function JobDiscoveryStatsWidget({ userId }: { userId: string }) {
  const { jobStats, loading } = useJobStats(userId);

  if (loading) return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: 1, minWidth: 130, height: 100, background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, opacity: 0.5 }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <StatCard label="Jobs Found" value={jobStats?.total ?? 0} sub="in your database" color={C.accent} icon="🔍" />
      <StatCard label="Jobs Matched" value={jobStats?.matched ?? 0} sub="AI scored" color={C.cyan} icon="🤖" />
      <StatCard label="Avg Match Score" value={jobStats?.avgScore ? `${jobStats.avgScore}%` : '—'} sub="across all jobs" color={C.purple} icon="📊" />
      <StatCard label="High Matches" value={jobStats?.highMatch ?? 0} sub="score ≥ 80%" color={C.green} icon="⭐" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// FULL DASHBOARD STATS (replaces the stats row in DashboardView)
// ════════════════════════════════════════════════════════════
export function DashboardStatsRow({ userId }: { userId: string }) {
  const { stats, loading } = useDashboardStats(userId);

  if (loading || !stats) return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{ flex: 1, minWidth: 110, height: 100, background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, opacity: 0.4 }} />
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <StatCard label="Jobs Found" value={stats.total_jobs} sub={`${stats.total_matches} matched`} color={C.accent} icon="🔍" />
      <StatCard label="Avg Match" value={`${stats.avg_match_score}%`} sub={`Best: ${stats.top_score}%`} color={C.cyan} icon="🎯" />
      <StatCard label="Applied" value={stats.total_applied} sub={`${stats.pending_review} pending review`} color={C.purple} icon="📤" />
      <StatCard label="Interviews" value={stats.interviews} sub={`${stats.offers} offers`} color={C.green} icon="🗓️" />
      <StatCard label="Response Rate" value={`${stats.response_rate}%`} sub="industry avg 18%" color={C.amber} icon="📊" />
      <StatCard label="Saved Jobs" value={stats.saved_jobs} color={C.text} icon="⭐" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TOP RECOMMENDED JOBS WIDGET
// Replaces the basic "Top Matches" card in old dashboard
// ════════════════════════════════════════════════════════════
export function TopRecommendedWidget({ userId, onViewAll, onApply }: {
  userId: string; onViewAll: () => void; onApply: (job: any) => void;
}) {
  const { recommended, loading } = useRecommendedJobs(userId);

  const scoreColor = (s: number) => s >= 90 ? C.green : s >= 75 ? C.accent : C.amber;

  return (
    <Card style={{ flex: '1 1 260px' }}>
      <CardHeader title="Top Recommended" sub="AI-matched, not yet applied"
        right={<button onClick={onViewAll} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>View all →</button>} />
      {loading
        ? <div style={{ padding: '24px 22px', color: C.muted, fontSize: 13 }}>Loading…</div>
        : recommended.length === 0
          ? <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
            <p style={{ color: C.muted, fontSize: 13 }}>No recommendations yet</p>
            <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Import jobs and run AI scoring</p>
          </div>
          : recommended.slice(0, 5).map((job) => (
            <div key={job.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.border}`, transition: 'background .15s', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.cardHov}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              onClick={() => onApply(job)}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: C.accent, flexShrink: 0 }}>
                {job.company?.[0] ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</p>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{job.company}{job.remote ? ' · Remote' : ''}</p>
              </div>
              <div style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 800, fontFamily: 'monospace', background: `${scoreColor(job.match?.overall_score || 0)}18`, color: scoreColor(job.match?.overall_score || 0), flexShrink: 0 }}>
                {job.match?.overall_score || '?'}%
              </div>
            </div>
          ))
      }
    </Card>
  );
}

// ════════════════════════════════════════════════════════════
// CAREER INSIGHTS SNAPSHOT (for dashboard)
// ════════════════════════════════════════════════════════════
export function CareerInsightsSnapshotWidget({ userId, onViewFull }: {
  userId: string; onViewFull: () => void;
}) {
  const { insights, loading, generating } = useCareerInsights(userId);

  if (loading) return null;

  if (!insights) return (
    <Card style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, color: C.text }}>🤖 Career Insights</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>AI-powered career development analysis not generated yet</p>
        </div>
        <button onClick={onViewFull} style={{ background: `${C.purple}18`, border: `1px solid ${C.purple}44`, color: C.purple, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Generate →</button>
      </div>
    </Card>
  );

  const criticalGaps = insights.skill_gaps.filter(g => g.importance === 'critical' || g.importance === 'high').slice(0, 3);

  return (
    <Card>
      <CardHeader title="Career Insights Snapshot" sub={`Last updated ${new Date(insights.generated_at).toLocaleDateString()}`}
        right={<button onClick={onViewFull} style={{ background: 'none', border: 'none', color: C.purple, fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Full report →</button>} />
      <div style={{ padding: '16px 22px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Skill gaps */}
        <div style={{ flex: '1 1 200px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Top Skill Gaps</p>
          {criticalGaps.length === 0
            ? <p style={{ fontSize: 12, color: C.muted }}>No critical gaps found 🎉</p>
            : criticalGaps.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.importance === 'critical' ? C.red : C.amber, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.text }}>{g.skill}</span>
                <Badge color={g.importance === 'critical' ? C.red : C.amber}>{g.importance}</Badge>
              </div>
            ))
          }
        </div>
        {/* Learning path preview */}
        <div style={{ flex: '1 1 200px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Learning Path</p>
          {insights.learning_path.slice(0, 3).map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, color: C.accent, fontWeight: 800, fontFamily: 'monospace', flexShrink: 0, marginTop: 1 }}>{step.order}.</span>
              <span style={{ fontSize: 12, color: C.sub }}>{step.title}</span>
            </div>
          ))}
          {insights.learning_path.length > 3 && (
            <p style={{ fontSize: 11, color: C.muted }}>+{insights.learning_path.length - 3} more steps</p>
          )}
        </div>
        {/* Career suggestions */}
        <div style={{ flex: '1 1 200px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Top Suggestion</p>
          {insights.career_suggestions.slice(0, 1).map((s, i) => (
            <p key={i} style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{s}</p>
          ))}
          {(insights.recommended_certs || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Recommended cert:</p>
              <Badge color={C.amber}>{insights.recommended_certs[0]?.name}</Badge>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════
// MIGRATION BANNER — shown when legacy data detected
// ════════════════════════════════════════════════════════════
export function MigrationBanner({ onMigrate, migrating, result }: {
  onMigrate: () => void; migrating: boolean; result: any;
}) {
  if (result?.success) return (
    <div style={{ padding: '14px 22px', background: `${C.green}12`, border: `1px solid ${C.green}33`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ fontSize: 20 }}>✅</span>
      <div>
        <p style={{ fontWeight: 700, fontSize: 14, color: C.green }}>Migration complete!</p>
        <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          Profile · {result.applications} applications · {result.jobs} jobs · {result.notifications} notifications migrated to Supabase
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '16px 22px', background: `${C.amber}12`, border: `1px solid ${C.amber}44`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>📦</span>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, color: C.amber }}>Local data detected — migrate to Supabase</p>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            Your existing profile, applications, and jobs will be securely moved to the cloud database.
          </p>
        </div>
      </div>
      <button onClick={onMigrate} disabled={migrating} style={{ background: `${C.amber}22`, border: `1px solid ${C.amber}55`, color: C.amber, padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: migrating ? 'not-allowed' : 'pointer', opacity: migrating ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', flexShrink: 0 }}>
        {migrating && <span style={{ width: 13, height: 13, border: '2px solid currentColor', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />}
        {migrating ? 'Migrating…' : '⚡ Migrate Now'}
      </button>
    </div>
  );
}
