// ============================================================
// AutoApply AI — Career Insights (Phase 2)
// src/components/career/CareerInsights.tsx
// ============================================================

import { useState } from 'react';
import { useCareerInsights, useJobs, useApplications } from '../../hooks';
import { Profile, SkillGap, RecommendedCert, LearningPathStep } from '../../types/database';

const C = {
  bg: '#07090F', surf: '#0D1117', card: '#111827', border: '#1E293B',
  accent: '#3B82F6', cyan: '#06B6D4', green: '#10B981', amber: '#F59E0B',
  red: '#EF4444', purple: '#8B5CF6', text: '#F1F5F9', sub: '#94A3B8', muted: '#475569',
};

const Badge = ({ children, color = C.accent }: any) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33` }}>{children}</span>
);

const Btn = ({ children, onClick, variant = 'primary', loading, disabled }: any) => {
  const vs: any = {
    primary: { background: `linear-gradient(135deg,${C.accent},#2563EB)`, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: C.sub, border: `1px solid ${C.border}` },
    purple: { background: `${C.purple}18`, color: C.purple, border: `1px solid ${C.purple}44` },
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{ ...vs[variant], padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (disabled || loading) ? 'not-allowed' : 'pointer', opacity: (disabled || loading) ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'all .15s', fontFamily: 'inherit' }}>
      {loading && <span style={{ width: 13, height: 13, border: '2px solid currentColor', borderTop: '2px solid transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />}
      {children}
    </button>
  );
};

const Card = ({ children, style: sx = {} }: any) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, ...sx }}>{children}</div>
);

const importanceColor = (imp: string) => ({ critical: C.red, high: C.amber, medium: C.accent, low: C.muted }[imp] || C.muted);

// ── Skill Gap Card ─────────────────────────────────────────────
function SkillGapCard({ gap }: { gap: SkillGap }) {
  return (
    <div style={{ padding: '14px 16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: importanceColor(gap.importance), flexShrink: 0, marginTop: 6 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{gap.skill}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge color={importanceColor(gap.importance)}>{gap.importance} priority</Badge>
            <Badge color={C.muted}>{gap.jobs_requiring} jobs need this</Badge>
          </div>
        </div>
        <p style={{ fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>{gap.reason}</p>
      </div>
    </div>
  );
}

// ── Cert Card ──────────────────────────────────────────────────
function CertCard({ cert }: { cert: RecommendedCert }) {
  const providerColors: Record<string, string> = { Google: C.accent, AWS: C.amber, Microsoft: C.cyan, Coursera: C.purple, Udemy: C.green, LinkedIn: C.accent };
  const color = providerColors[cert.provider] || C.muted;
  return (
    <div style={{ padding: '16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{cert.name}</p>
        <Badge color={color}>{cert.provider}</Badge>
      </div>
      <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: 10 }}>{cert.relevance}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.muted }}>⏱ {cert.estimated_time}</span>
        {cert.url && (
          <a href={cert.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>View Course →</span>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Learning Path Step ─────────────────────────────────────────
function LearningStep({ step, isLast }: { step: LearningPathStep; isLast: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${C.accent}22`, border: `2px solid ${C.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.accent, flexShrink: 0 }}>{step.order}</div>
        {!isLast && <div style={{ width: 2, flex: 1, background: C.border, margin: '4px 0', minHeight: 20 }} />}
      </div>
      <div style={{ paddingBottom: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 4 }}>{step.title}</p>
        <p style={{ color: C.sub, fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{step.description}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {step.resources.map((r, i) => <Badge key={i} color={C.cyan}>{r}</Badge>)}
          <Badge color={C.muted}>~{step.estimated_weeks} weeks</Badge>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MAIN CAREER INSIGHTS VIEW
// ════════════════════════════════════════════════════════════
export function CareerInsightsView({ userId, profile }: { userId: string; profile: Profile }) {
  const [activeTab, setActiveTab] = useState<'gaps' | 'certs' | 'path' | 'market' | 'salary'>('gaps');
  const { insights, loading, generating, generate, refetch } = useCareerInsights(userId);
  const { jobs } = useJobs(userId);
  const { applications } = useApplications(userId);

  const tabs = [
    { id: 'gaps', label: '🎯 Skill Gaps' },
    { id: 'certs', label: '🏆 Certifications' },
    { id: 'path', label: '🗺️ Learning Path' },
    { id: 'market', label: '📊 Market Insights' },
    { id: 'salary', label: '💰 Salary' },
  ];

  const handleGenerate = () => generate(profile, jobs, applications);

  const marketData = insights?.market_insights as any;
  const salaryData = insights?.salary_insights as any;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text }}>AI Career Insights</h2>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>
            Personalized analysis based on your profile and {jobs.length} jobs in your database
          </p>
        </div>
        <Btn variant="purple" loading={generating} onClick={handleGenerate}>
          {generating ? 'Analyzing with AI…' : insights ? '🔄 Refresh Insights' : '🤖 Generate Insights'}
        </Btn>
      </div>

      {!insights && !loading && (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: C.card, borderRadius: 14, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <p style={{ fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 8 }}>No insights generated yet</p>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>
            Claude AI will analyze your skills, the jobs you're targeting, and market trends<br />to give you a personalized career development roadmap.
          </p>
          <Btn variant="primary" size="lg" loading={generating} onClick={handleGenerate}>
            🤖 Generate Career Insights
          </Btn>
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Loading insights…</div>}

      {insights && (
        <>
          {/* Last generated */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: C.muted }}>
              Generated {new Date(insights.generated_at).toLocaleString()}
            </span>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Skill Gaps Found', value: insights.skill_gaps.length, color: C.red, icon: '🎯' },
              { label: 'Certs Recommended', value: insights.recommended_certs.length, color: C.amber, icon: '🏆' },
              { label: 'Learning Steps', value: insights.learning_path.length, color: C.accent, icon: '🗺️' },
              { label: 'Career Tips', value: insights.career_suggestions.length, color: C.green, icon: '💡' },
            ].map(s => (
              <div key={s.label} style={{ flex: '1 1 130px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${s.color},transparent)` }} />
                <p style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{ padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: activeTab === t.id ? C.accent : 'transparent', color: activeTab === t.id ? '#fff' : C.muted, transition: 'all .15s' }}>{t.label}</button>
            ))}
          </div>

          {/* Skill Gaps */}
          {activeTab === 'gaps' && (
            <div>
              <div style={{ padding: '12px 16px', background: `${C.red}0A`, border: `1px solid ${C.red}33`, borderRadius: 10, marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: C.red, lineHeight: 1.6 }}>
                  🎯 These skills appear in jobs you're targeting but are missing or underrepresented in your profile.
                </p>
              </div>
              {insights.skill_gaps.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>No skill gaps detected — great job! 🎉</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {insights.skill_gaps.sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 };
                    return (order[a.importance as keyof typeof order] || 3) - (order[b.importance as keyof typeof order] || 3);
                  }).map((gap, i) => <SkillGapCard key={i} gap={gap} />)}
                </div>}
            </div>
          )}

          {/* Certifications */}
          {activeTab === 'certs' && (
            <div>
              <div style={{ padding: '12px 16px', background: `${C.amber}0A`, border: `1px solid ${C.amber}33`, borderRadius: 10, marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: C.amber }}>🏆 These certifications will strengthen your profile for the roles you're targeting.</p>
              </div>
              {insights.recommended_certs.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>No certifications to recommend right now</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {insights.recommended_certs.map((cert, i) => <CertCard key={i} cert={cert} />)}
                </div>}
            </div>
          )}

          {/* Learning Path */}
          {activeTab === 'path' && (
            <div>
              <div style={{ padding: '12px 16px', background: `${C.accent}0A`, border: `1px solid ${C.accent}33`, borderRadius: 10, marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: C.accent }}>🗺️ A personalized step-by-step plan to close your skill gaps and advance your career.</p>
              </div>
              {insights.learning_path.length === 0
                ? <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>No learning path generated yet</div>
                : <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px' }}>
                  {insights.learning_path.sort((a, b) => a.order - b.order).map((step, i) => (
                    <LearningStep key={i} step={step} isLast={i === insights.learning_path.length - 1} />
                  ))}
                </div>}

              {insights.career_suggestions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Card style={{ padding: '20px 22px' }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>💡 Career Growth Suggestions</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {insights.career_suggestions.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                          <span style={{ color: C.green, flexShrink: 0 }}>→</span>
                          <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.6 }}>{s}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Market Insights */}
          {activeTab === 'market' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {marketData && (
                <>
                  <Card style={{ padding: '20px 22px' }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>🔥 Hot Skills in Demand</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(marketData.hot_skills || []).map((s: string) => <Badge key={s} color={C.red}>{s}</Badge>)}
                    </div>
                  </Card>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <Card style={{ flex: '1 1 200px', padding: '20px 22px' }}>
                      <p style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Salary Trend</p>
                      <p style={{ fontSize: 18, fontWeight: 800, color: marketData.salary_trend === 'increasing' ? C.green : marketData.salary_trend === 'decreasing' ? C.red : C.amber }}>
                        {marketData.salary_trend === 'increasing' ? '↑ Increasing' : marketData.salary_trend === 'decreasing' ? '↓ Decreasing' : '→ Stable'}
                      </p>
                    </Card>
                    <Card style={{ flex: '1 1 200px', padding: '20px 22px' }}>
                      <p style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Competition Level</p>
                      <p style={{ fontSize: 18, fontWeight: 800, color: marketData.competition_level === 'high' ? C.red : marketData.competition_level === 'low' ? C.green : C.amber }}>
                        {(marketData.competition_level || 'unknown').charAt(0).toUpperCase() + (marketData.competition_level || '').slice(1)}
                      </p>
                    </Card>
                  </div>
                  {(marketData.top_hiring_companies || []).length > 0 && (
                    <Card style={{ padding: '20px 22px' }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 12 }}>🏢 Top Hiring Companies</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(marketData.top_hiring_companies || []).map((c: string) => <Badge key={c} color={C.accent}>{c}</Badge>)}
                      </div>
                    </Card>
                  )}
                </>
              )}
              {!marketData && <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>Generate insights to see market data</div>}
            </div>
          )}

          {/* Salary */}
          {activeTab === 'salary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {salaryData ? (
                <>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <Card style={{ flex: '1 1 180px', padding: '20px 22px' }}>
                      <p style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Estimated Min</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: C.green }}>${((salaryData.estimated_min || 0) / 1000).toFixed(0)}k</p>
                    </Card>
                    <Card style={{ flex: '1 1 180px', padding: '20px 22px' }}>
                      <p style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Estimated Max</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: C.purple }}>${((salaryData.estimated_max || 0) / 1000).toFixed(0)}k</p>
                    </Card>
                    <Card style={{ flex: '1 1 180px', padding: '20px 22px' }}>
                      <p style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Currency</p>
                      <p style={{ fontSize: 24, fontWeight: 800, color: C.text }}>{salaryData.currency || 'USD'}</p>
                    </Card>
                  </div>
                  {(salaryData.negotiation_tips || []).length > 0 && (
                    <Card style={{ padding: '20px 22px' }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 14 }}>💬 Negotiation Tips</p>
                      {(salaryData.negotiation_tips || []).map((tip: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, padding: '10px 14px', background: C.bg, borderRadius: 8 }}>
                          <span style={{ color: C.green }}>✓</span>
                          <p style={{ fontSize: 13, color: C.sub }}>{tip}</p>
                        </div>
                      ))}
                    </Card>
                  )}
                </>
              ) : <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>Generate insights to see salary data</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
