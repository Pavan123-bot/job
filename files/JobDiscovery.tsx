// ============================================================
// AutoApply AI — Job Discovery Module (Phase 2)
// src/components/jobs/JobDiscovery.tsx
// ============================================================
// Drop-in replacement for the JobDiscoveryView in AutoApplyAI.jsx
// Connects to Supabase instead of window.storage
// Preserves all existing UI patterns and color tokens
// ============================================================

import { useState, useRef, useCallback } from 'react';
import {
  useJobs, useSavedJobs, useRecommendedJobs,
  useJobImport, useJobMatch, useAuth
} from '../../hooks';
import { AIMatchingEngine } from '../../services/AIMatchingEngine';
import { ApplicationService } from '../../services/ApplicationService';
import { NotificationService } from '../../services/NotificationService';
import { Job, JobFilters, Profile, Resume, JobMatch } from '../../types/database';

// ── Color tokens (must match AutoApplyAI.jsx) ─────────────────
const C = {
  bg: '#07090F', surf: '#0D1117', card: '#111827', cardHov: '#161F30',
  border: '#1E293B', accent: '#3B82F6', accentD: '#2563EB',
  cyan: '#06B6D4', green: '#10B981', amber: '#F59E0B',
  red: '#EF4444', purple: '#8B5CF6', text: '#F1F5F9',
  sub: '#94A3B8', muted: '#475569',
};

// ── Shared primitives (same as AutoApplyAI.jsx) ───────────────
const Badge = ({ children, color = C.accent, dot }: any) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color, background: `${color}18`, border: `1px solid ${color}33` }}>
    {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />}
    {children}
  </span>
);

const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled, loading, style: sx = {} }: any) => {
  const pads: any = { sm: '5px 13px', md: '9px 20px', lg: '13px 28px' };
  const fss: any = { sm: 12, md: 13, lg: 15 };
  const vs: any = {
    primary: { background: `linear-gradient(135deg,${C.accent},${C.accentD})`, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: C.sub, border: `1px solid ${C.border}` },
    danger: { background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}44` },
    success: { background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}44` },
    amber: { background: `${C.amber}18`, color: C.amber, border: `1px solid ${C.amber}44` },
    cyan: { background: `${C.cyan}18`, color: C.cyan, border: `1px solid ${C.cyan}44` },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{ ...vs[variant], padding: pads[size], borderRadius: 8, fontSize: fss[size], fontWeight: 600, cursor: (disabled || loading) ? 'not-allowed' : 'pointer', opacity: (disabled || loading) ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'all .15s', fontFamily: 'inherit', ...sx }}>
      {loading && <span style={{ width: fss[size], height: fss[size], border: `2px solid currentColor`, borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />}
      {children}
    </button>
  );
};

const Prog = ({ value, max = 100, color = C.accent, h = 6 }: any) => (
  <div style={{ background: C.border, borderRadius: 99, height: h, overflow: 'hidden', flex: 1 }}>
    <div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .5s ease' }} />
  </div>
);

const Card = ({ children, style: sx = {} }: any) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, ...sx }}>{children}</div>
);

const Empty = ({ icon, title, sub, action }: any) => (
  <div style={{ padding: '52px 20px', textAlign: 'center' }}>
    <div style={{ fontSize: 38, marginBottom: 12 }}>{icon}</div>
    <p style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>{title}</p>
    <p style={{ color: C.muted, fontSize: 13, marginBottom: action ? 20 : 0 }}>{sub}</p>
    {action}
  </div>
);

const Modal = ({ open, onClose, title, children, width = 600 }: any) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000BB', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: C.surf, border: `1px solid ${C.border}`, borderRadius: 18, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e: any) => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{title}</p>
          <button onClick={onClose} style={{ background: C.border, border: 'none', color: C.sub, borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
};

// ── Score color helper ────────────────────────────────────────
const scoreColor = (s: number) => s >= 90 ? C.green : s >= 75 ? C.accent : s >= 60 ? C.amber : C.red;

// ════════════════════════════════════════════════════════════
// JOB CARD
// ════════════════════════════════════════════════════════════
function JobCard({ job, applied, onApply, onView, onSave, onScore }: {
  job: Job; applied: boolean; onApply: () => void;
  onView: () => void; onSave: () => void; onScore: () => void;
}) {
  const score = job.match?.overall_score;
  const mc = score != null ? scoreColor(score) : C.muted;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 22px', transition: 'all .15s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = `${C.accent}66`}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = C.border}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 46, height: 46, borderRadius: 11, background: C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: C.accent, flexShrink: 0 }}>
          {job.company_logo ? <img src={job.company_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 11 }} /> : job.company[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{job.title}</p>
              <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>
                {job.company} · {job.location}
                {(job.salary_min || 0) > 0 && ` · $${Math.round((job.salary_min || 0) / 1000)}k–$${Math.round((job.salary_max || 0) / 1000)}k`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {score != null && (
                <div style={{ padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, fontFamily: 'monospace', background: `${mc}18`, color: mc, border: `1px solid ${mc}33` }}>{score}%</div>
              )}
              {applied && <Badge color={C.green} dot>Applied</Badge>}
              {job.remote && <Badge color={C.cyan}>Remote</Badge>}
              {job.is_saved && <Badge color={C.amber}>⭐</Badge>}
            </div>
          </div>
          <p style={{ color: C.sub, fontSize: 13, marginTop: 8, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{job.description}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {(job.skills_required || []).slice(0, 5).map(s => (
              <span key={s} style={{ padding: '2px 8px', background: C.border, borderRadius: 5, fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{s}</span>
            ))}
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>
              {new Date(job.posted_at).toLocaleDateString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {!applied && <Btn size="sm" variant="primary" onClick={onApply}>Apply with AI ⚡</Btn>}
            <Btn size="sm" variant="ghost" onClick={onView}>Details</Btn>
            <Btn size="sm" variant={job.is_saved ? 'amber' : 'ghost'} onClick={onSave}>{job.is_saved ? '⭐ Saved' : '☆ Save'}</Btn>
            {score == null && <Btn size="sm" variant="cyan" onClick={onScore}>🤖 Score</Btn>}
            {job.apply_url && (
              <a href={job.apply_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Btn size="sm" variant="cyan">↗ Apply Direct</Btn>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MATCH SCORE DETAIL PANEL
// ════════════════════════════════════════════════════════════
function MatchScorePanel({ match }: { match: JobMatch }) {
  const scoreRows = [
    { label: 'Overall Match', value: match.overall_score, color: scoreColor(match.overall_score) },
    { label: 'Skill Match', value: match.skill_score, color: scoreColor(match.skill_score) },
    { label: 'Experience', value: match.experience_score, color: scoreColor(match.experience_score) },
    { label: 'Education', value: match.education_score, color: scoreColor(match.education_score) },
    { label: 'ATS Compatibility', value: match.ats_score, color: scoreColor(match.ats_score) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '16px 20px', background: `${scoreColor(match.overall_score)}0E`, border: `1px solid ${scoreColor(match.overall_score)}33`, borderRadius: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: scoreColor(match.overall_score), fontFamily: 'monospace' }}>{match.overall_score}%</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, color: scoreColor(match.overall_score) }}>{match.verdict}</p>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Recommendation: <strong style={{ color: C.text }}>{match.should_apply ? 'Apply Now' : 'Consider Skipping'}</strong></p>
          {match.ai_summary && <p style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{match.ai_summary}</p>}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        {scoreRows.map(row => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ width: 140, fontSize: 12, color: C.muted, flexShrink: 0 }}>{row.label}</span>
            <Prog value={row.value} color={row.color} />
            <span style={{ width: 36, fontSize: 13, fontWeight: 800, color: row.color, fontFamily: 'monospace', flexShrink: 0, textAlign: 'right' }}>{row.value}%</span>
          </div>
        ))}
      </div>

      {match.matched_skills.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>✓ Matched Skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{match.matched_skills.map(s => <Badge key={s} color={C.green}>{s}</Badge>)}</div>
        </div>
      )}
      {match.missing_skills.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>✗ Missing Skills</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{match.missing_skills.map(s => <Badge key={s} color={C.red}>{s}</Badge>)}</div>
        </div>
      )}
      {match.strengths.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Strengths</p>
          {match.strengths.map((s, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: C.sub }}><span style={{ color: C.green }}>•</span>{s}</div>)}
        </div>
      )}
      {match.recommendations.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Recommendations</p>
          {match.recommendations.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: C.sub }}><span style={{ color: C.purple }}>→</span>{r}</div>)}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// JOB IMPORT PANEL (CSV + Manual)
// ════════════════════════════════════════════════════════════
function JobImportPanel({ userId, onImported }: { userId: string; onImported: () => void }) {
  const { importing, result, error, importCSV, importManual, reset } = useJobImport(userId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'csv' | 'manual'>('csv');
  const [manualForm, setManualForm] = useState({
    title: '', company: '', location: '', remote: false,
    salary_min: '', salary_max: '', description: '', skills: '', apply_url: '', job_type: 'full_time',
  });

  const handleFile = async (file: File) => {
    await importCSV(file);
    onImported();
  };

  const handleManual = async () => {
    if (!manualForm.title || !manualForm.company) return;
    await importManual([{
      ...manualForm,
      salary_min: parseInt(manualForm.salary_min) || 0,
      salary_max: parseInt(manualForm.salary_max) || 0,
      skills_required: manualForm.skills.split(',').map(s => s.trim()).filter(Boolean),
      salary_currency: 'USD', requirements: '', benefits: '',
      experience_level: 'mid', source_name: 'manual', source_url: '',
      company_logo: '', company_size: '', industry: '',
      posted_at: new Date().toISOString(), expires_at: null,
      is_active: true, is_saved: false, scan_batch_id: null, raw_data: {},
    }]);
    onImported();
    setManualForm({ title: '', company: '', location: '', remote: false, salary_min: '', salary_max: '', description: '', skills: '', apply_url: '', job_type: 'full_time' });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['csv', 'manual'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: tab === t ? C.accent : C.card, color: tab === t ? '#fff' : C.muted, border: `1px solid ${tab === t ? C.accent : C.border}`, textTransform: 'capitalize' }}>
            {t === 'csv' ? '📄 CSV Import' : '✍️ Manual Entry'}
          </button>
        ))}
      </div>

      {tab === 'csv' && (
        <div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
            Upload a CSV file with columns: <code style={{ color: C.accent }}>title, company, location, remote, salary_min, salary_max, description, skills, apply_url, job_type</code>
          </p>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}>
            {importing ? (
              <p style={{ color: C.sub, fontSize: 13 }}>Importing…</p>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
                <p style={{ fontWeight: 700, color: C.text }}>Click to upload CSV</p>
                <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>Max 5MB · UTF-8 encoded</p>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'manual' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            {[
              { label: 'Job Title *', key: 'title', placeholder: 'Software Engineer' },
              { label: 'Company *', key: 'company', placeholder: 'Acme Corp' },
              { label: 'Location', key: 'location', placeholder: 'San Francisco, CA' },
              { label: 'Apply URL', key: 'apply_url', placeholder: 'https://careers.company.com/job/123' },
              { label: 'Salary Min', key: 'salary_min', placeholder: '120000' },
              { label: 'Salary Max', key: 'salary_max', placeholder: '160000' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>{f.label}</label>
                <input value={(manualForm as any)[f.key]} onChange={e => setManualForm(m => ({ ...m, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, width: '100%', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Skills (comma separated)</label>
            <input value={manualForm.skills} onChange={e => setManualForm(m => ({ ...m, skills: e.target.value }))} placeholder="React, TypeScript, Node.js"
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, width: '100%', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Description</label>
            <textarea value={manualForm.description} onChange={e => setManualForm(m => ({ ...m, description: e.target.value }))} rows={4} placeholder="Paste the job description…"
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, width: '100%', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Btn variant="primary" loading={importing} onClick={handleManual} disabled={!manualForm.title || !manualForm.company}>Add Job</Btn>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.sub }}>
              <input type="checkbox" checked={manualForm.remote} onChange={e => setManualForm(m => ({ ...m, remote: e.target.checked }))} style={{ accentColor: C.accent }} />
              Remote position
            </label>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: `${C.green}12`, border: `1px solid ${C.green}33`, borderRadius: 10 }}>
          <p style={{ fontSize: 13, color: C.green }}>✓ Imported {result.imported} jobs · {result.skipped} skipped (duplicates)</p>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: `${C.red}12`, border: `1px solid ${C.red}33`, borderRadius: 10 }}>
          <p style={{ fontSize: 13, color: C.red }}>Error: {error}</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN JOB DISCOVERY VIEW
// ════════════════════════════════════════════════════════════
export function JobDiscoveryView({ userId, profile, primaryResume, applications, onApply }: {
  userId: string;
  profile: Profile;
  primaryResume: Resume | null;
  applications: any[];
  onApply: (job: Job, match: JobMatch | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'recommended' | 'saved' | 'import'>('all');
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { jobs, total, loading, filters, updateFilters, toggleSave, deleteJob, scoreAll, scoring, scoreProgress, refetch: refetchJobs } = useJobs(userId, { sort_by: 'posted_at', sort_dir: 'desc' });
  const { savedJobs, loading: savedLoading, refetch: refetchSaved } = useSavedJobs(userId);
  const { recommended, loading: recLoading, refetch: refetchRec } = useRecommendedJobs(userId);
  const { match: viewJobMatch, scoring: scoreJobLoading, score: scoreJob } = useJobMatch(userId, viewJob?.id || null);

  const appliedJobIds = new Set(applications.map(a => a.job_id).filter(Boolean));
  const isApplied = (jobId: string) => appliedJobIds.has(jobId);

  const handleScoreJob = async (job: Job) => {
    await scoreJob(profile, primaryResume, job);
    refetchJobs();
  };

  const tabs = [
    { id: 'all', label: `All Jobs (${total})` },
    { id: 'recommended', label: `⭐ Recommended (${recommended.length})` },
    { id: 'saved', label: `🔖 Saved (${savedJobs.length})` },
    { id: 'import', label: '📥 Import' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text }}>Job Discovery</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{total} jobs · {recommended.length} recommended · {savedJobs.length} saved</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={() => setImportOpen(true)}>📥 Import Jobs</Btn>
          <Btn variant={scoring ? 'amber' : 'cyan'} loading={scoring} onClick={() => scoreAll(profile, primaryResume)}>
            {scoring ? `Scoring ${scoreProgress.current}/${scoreProgress.total}…` : '🤖 Score All Jobs'}
          </Btn>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{ padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === t.id ? C.accent : 'transparent', color: activeTab === t.id ? '#fff' : C.muted, transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (All Jobs tab) */}
      {activeTab === 'all' && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={filters.search || ''} onChange={e => updateFilters({ search: e.target.value })} placeholder="Search jobs, companies…"
            style={{ flex: 1, minWidth: 200, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', color: C.text, fontSize: 13, outline: 'none' }} />
          <button onClick={() => updateFilters({ remote: filters.remote ? undefined : true })} style={{ padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: filters.remote ? `${C.green}18` : C.card, color: filters.remote ? C.green : C.muted, border: `1px solid ${filters.remote ? C.green : C.border}` }}>🌐 Remote</button>
          <select value={filters.sort_by || 'posted_at'} onChange={e => updateFilters({ sort_by: e.target.value as any })}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', color: C.sub, fontSize: 12 }}>
            <option value="posted_at">Newest First</option>
            <option value="company">Company A-Z</option>
          </select>
        </div>
      )}

      {/* All Jobs */}
      {activeTab === 'all' && (
        loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading jobs…</div>
        ) : jobs.length === 0 ? (
          <Empty icon="🔍" title="No jobs yet" sub="Import jobs via CSV, add manually, or use the AI scanner" action={<Btn variant="primary" onClick={() => setImportOpen(true)}>Import Jobs</Btn>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.map(job => (
              <JobCard key={job.id} job={job} applied={isApplied(job.id)}
                onApply={() => onApply(job, job.match || null)}
                onView={() => setViewJob(job)}
                onSave={() => { toggleSave(job.id); refetchSaved(); }}
                onScore={() => handleScoreJob(job)} />
            ))}
          </div>
        )
      )}

      {/* Recommended */}
      {activeTab === 'recommended' && (
        recLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading recommendations…</div>
        ) : recommended.length === 0 ? (
          <Empty icon="⭐" title="No recommendations yet" sub="Score your jobs first using the '🤖 Score All Jobs' button" action={<Btn variant="cyan" onClick={() => scoreAll(profile, primaryResume)}>Score All Jobs</Btn>} />
        ) : (
          <div>
            <div style={{ padding: '10px 16px', background: `${C.purple}0E`, border: `1px solid ${C.purple}33`, borderRadius: 10, marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: C.purple }}>🤖 AI selected these based on your profile match score and skills. Sorted by best fit.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recommended.map(job => (
                <JobCard key={job.id} job={job} applied={isApplied(job.id)}
                  onApply={() => onApply(job, job.match || null)}
                  onView={() => setViewJob(job)}
                  onSave={() => { toggleSave(job.id); refetchSaved(); }}
                  onScore={() => handleScoreJob(job)} />
              ))}
            </div>
          </div>
        )
      )}

      {/* Saved Jobs */}
      {activeTab === 'saved' && (
        savedLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading saved jobs…</div>
        ) : savedJobs.length === 0 ? (
          <Empty icon="🔖" title="No saved jobs" sub="Click ☆ Save on any job to bookmark it here" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {savedJobs.map(sj => sj.job && (
              <JobCard key={sj.id} job={{ ...sj.job, is_saved: true }} applied={isApplied(sj.job.id)}
                onApply={() => onApply(sj.job!, sj.job!.match || null)}
                onView={() => setViewJob(sj.job!)}
                onSave={() => { toggleSave(sj.job!.id); refetchSaved(); }}
                onScore={() => handleScoreJob(sj.job!)} />
            ))}
          </div>
        )
      )}

      {/* Import */}
      {activeTab === 'import' && (
        <Card style={{ padding: '24px' }}>
          <JobImportPanel userId={userId} onImported={() => { refetchJobs(); setActiveTab('all'); }} />
        </Card>
      )}

      {/* Job Detail Modal */}
      <Modal open={!!viewJob} onClose={() => setViewJob(null)} title={viewJob?.title || ''} width={720}>
        {viewJob && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {viewJob.remote && <Badge color={C.cyan}>Remote</Badge>}
              <Badge color={C.muted}>{viewJob.job_type?.replace('_', ' ')}</Badge>
              {(viewJob.salary_min || 0) > 0 && <Badge color={C.green}>${Math.round((viewJob.salary_min || 0) / 1000)}k–${Math.round((viewJob.salary_max || 0) / 1000)}k</Badge>}
              <Badge color={C.muted}>{viewJob.company_size}</Badge>
              <Badge color={C.muted}>{viewJob.industry}</Badge>
            </div>

            {/* Match score if available */}
            {(viewJobMatch || viewJob.match) && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 12 }}>AI Match Analysis</p>
                <MatchScorePanel match={(viewJobMatch || viewJob.match)!} />
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Description</p>
              <p style={{ color: C.sub, fontSize: 14, lineHeight: 1.75 }}>{viewJob.description}</p>
            </div>

            {viewJob.requirements && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Requirements</p>
                <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.7 }}>{viewJob.requirements}</p>
              </div>
            )}

            {/* Skills */}
            {viewJob.skills_required?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Required Skills</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {viewJob.skills_required.map(s => <span key={s} style={{ padding: '3px 10px', background: C.border, borderRadius: 6, fontSize: 12, color: C.sub, fontFamily: 'monospace' }}>{s}</span>)}
                </div>
              </div>
            )}

            {viewJob.source_name && <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Source: <span style={{ color: C.accent }}>{viewJob.source_name}</span></p>}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {!isApplied(viewJob.id) && (
                <Btn variant="primary" onClick={() => { onApply(viewJob, viewJobMatch || viewJob.match || null); setViewJob(null); }}>Apply with AI ⚡</Btn>
              )}
              {!viewJobMatch && !viewJob.match && (
                <Btn variant="cyan" loading={scoreJobLoading} onClick={() => scoreJob(profile, primaryResume, viewJob)}>🤖 Get Match Score</Btn>
              )}
              <Btn variant={viewJob.is_saved ? 'amber' : 'ghost'} onClick={() => { toggleSave(viewJob.id); refetchSaved(); }}>
                {viewJob.is_saved ? '⭐ Saved' : '☆ Save Job'}
              </Btn>
              {viewJob.apply_url && (
                <a href={viewJob.apply_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <Btn variant="ghost">↗ Company Site</Btn>
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Import Modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import Jobs" width={620}>
        <JobImportPanel userId={userId} onImported={() => { refetchJobs(); setImportOpen(false); }} />
      </Modal>
    </div>
  );
}
