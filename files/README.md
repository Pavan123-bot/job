# AutoApply AI — Phase 2: Backend + Job Discovery Foundation

Complete production backend built on **Supabase**, **Claude AI**, **TypeScript**, and **Next.js 14**.

---

## What Phase 2 Adds

| Feature | Status |
|---|---|
| Supabase PostgreSQL (replaces window.storage) | ✅ Complete |
| Supabase Auth (replaces custom auth) | ✅ Complete |
| Supabase Storage (resume file uploads) | ✅ Complete |
| Complete database schema (10 tables) | ✅ Complete |
| Row Level Security policies | ✅ Complete |
| ProfileService | ✅ Complete |
| ResumeService | ✅ Complete |
| JobService (CRUD, CSV import, bulk import) | ✅ Complete |
| ApplicationService (full lifecycle) | ✅ Complete |
| NotificationService (real-time) | ✅ Complete |
| ActivityService (audit logs) | ✅ Complete |
| EmailService (HTML templates) | ✅ Complete |
| AI Matching Engine (5 scores per job) | ✅ Complete |
| Career Insights (skill gaps, certs, path) | ✅ Complete |
| Job Discovery UI (all/recommended/saved/import) | ✅ Complete |
| Admin Panel (users, stats, AI usage, logs) | ✅ Complete |
| Dashboard Extensions (new stats widgets) | ✅ Complete |
| Data Migration (window.storage → Supabase) | ✅ Complete |
| Background Worker (cron + email) | ✅ Complete |
| Next.js API Routes | ✅ Complete |
| Integration Bridge | ✅ Complete |
| Docker + docker-compose | ✅ Complete |
| Nginx configuration | ✅ Complete |
| Environment variables template | ✅ Complete |
| Deployment Guide (Vercel/Docker/Railway) | ✅ Complete |

---

## File Index

```
autoApply-phase2/
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    ← All tables, indexes, RLS, functions
│       └── 002_storage_and_seed.sql  ← Storage buckets, views, realtime
│
├── src/
│   ├── types/
│   │   └── database.ts               ← All TypeScript types
│   │
│   ├── lib/
│   │   ├── supabase.ts               ← Supabase client
│   │   ├── migration.ts              ← window.storage → Supabase migration
│   │   └── integration.tsx           ← Bridge: Phase 1 → Phase 2
│   │
│   ├── services/
│   │   ├── ProfileService.ts         ← Profile CRUD + avatar upload
│   │   ├── ResumeService.ts          ← Resume CRUD + file storage
│   │   ├── JobService.ts             ← Jobs, matches, saved, CSV import
│   │   ├── ApplicationService.ts     ← Application lifecycle + export
│   │   ├── NotificationService.ts    ← Notifications + realtime
│   │   ├── ActivityService.ts        ← Audit logging
│   │   ├── EmailService.ts           ← HTML email templates + sender
│   │   └── AIMatchingEngine.ts       ← 5-score matching + career insights
│   │
│   ├── hooks/
│   │   └── index.ts                  ← All React hooks for all services
│   │
│   ├── components/
│   │   ├── jobs/
│   │   │   └── JobDiscovery.tsx      ← Full job discovery UI
│   │   ├── career/
│   │   │   └── CareerInsights.tsx    ← Career insights UI (5 tabs)
│   │   ├── admin/
│   │   │   └── AdminPanel.tsx        ← Admin panel (6 tabs)
│   │   └── DashboardExtensions.tsx   ← New dashboard widgets
│   │
│   ├── worker/
│   │   └── index.ts                  ← Background cron worker
│   │
│   ├── api-routes.ts                 ← All Next.js API routes (copy to app/)
│   └── api-email-cron.ts             ← Email send + cron API routes
│
├── nginx/
│   └── nginx.conf                    ← Production nginx config
│
├── Dockerfile                        ← Next.js frontend image
├── Dockerfile.worker                 ← Background worker image
├── docker-compose.yml                ← Full stack compose
├── package.json                      ← All dependencies
├── tsconfig.json                     ← TypeScript config
├── .env.example                      ← All env variables documented
└── DEPLOYMENT.md                     ← Step-by-step deployment guide
```

---

## Database Schema

### Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile, preferences, automation settings |
| `resumes` | Resume files, parsed data, ATS scores, versions |
| `jobs` | Job listings from scans, CSV import, manual entry |
| `job_matches` | AI match scores (5 dimensions) per job per user |
| `saved_jobs` | User-bookmarked jobs |
| `applications` | Full application lifecycle with submission logs |
| `cover_letters` | AI-generated and custom cover letters |
| `notifications` | Real-time notification feed |
| `activity_logs` | Audit trail for all user actions |
| `automation_tasks` | Scheduled task queue |
| `career_insights` | AI-generated career development analysis |
| `admin_settings` | System-wide configuration and feature flags |

### Key Features
- **UUID primary keys** on all tables
- **Row Level Security** on every table — users can only access their own data
- **Automatic timestamps** via triggers
- **Auto profile creation** when user signs up (trigger on auth.users)
- **Full-text search** indexes using pg_trgm
- **GIN indexes** on array columns (skills, skills_required)
- **Realtime** enabled on notifications + applications tables

---

## AI Matching Engine

For every job, Claude AI generates **5 independent scores**:

| Score | Measures |
|---|---|
| `overall_score` | Weighted composite (0–100) |
| `skill_score` | Exact + related skill overlap |
| `experience_score` | Years + seniority alignment |
| `education_score` | Degree + field relevance |
| `ats_score` | Keyword density vs job description |

Plus:
- `matched_skills` — list of skills you have that match
- `missing_skills` — skills in the JD you lack
- `strengths` — 3 specific reasons you're a fit
- `weaknesses` — gaps to address in cover letter
- `recommendations` — actionable steps to improve this application
- `verdict` — "Strong Match / Good Match / Partial Match / Weak Match"
- `should_apply` — boolean recommendation

---

## Career Insights

Generated by Claude AI based on your profile + jobs database:

- **Skill Gap Analysis** — which skills appear in jobs you can't match, ranked by importance
- **Recommended Certifications** — with provider, URL, and estimated completion time
- **Learning Path** — step-by-step curriculum to close gaps (with resources)
- **Career Suggestions** — 5 actionable growth tips
- **Market Insights** — hot skills, salary trends, competition level, top hiring companies
- **Salary Insights** — estimated range + negotiation tips

---

## Quick Integration (5 minutes)

### Option A — Full Supabase migration

```bash
# 1. Set env vars
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

# 2. Run migrations in Supabase SQL Editor
# Paste: supabase/migrations/001_initial_schema.sql → Run
# Paste: supabase/migrations/002_storage_and_seed.sql → Run

# 3. Install deps
npm install @supabase/supabase-js @supabase/ssr

# 4. Import services into your existing AutoApplyAI.jsx:
# import { ProfileService } from './src/services/ProfileService';
# Replace DB.set(`profile:${userId}`, data) → ProfileService.upsertProfile(userId, data)
# Replace DB.get(`profile:${userId}`) → ProfileService.getProfile(userId)

# 5. Add new views to your NAV_ITEMS:
# { id: 'career', label: 'Career AI', icon: '🎓' }

# 6. Import and mount new views:
# {view === 'career' && <CareerInsightsView userId={userId} profile={profile} />}
# {view === 'jobs' && <JobDiscoveryView ... />}  // Phase 2 version
# {view === 'admin' && <AdminPanelView />}        // Phase 2 version
```

### Option B — Use the StorageAdapter (zero rewrite)

```typescript
// In Root component, after user logs in:
import { StorageAdapter } from './src/lib/integration';

const db = new StorageAdapter(userId);
// Use db.get() and db.set() — same interface as before,
// but now backed by Supabase instead of window.storage
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start Supabase locally (optional — can use cloud Supabase)
npx supabase start

# Run migrations
npx supabase db push

# Start development server
npm run dev

# Start background worker (separate terminal)
npm run worker:dev

# Type check
npm run type-check
```

---

## Deployment

See `DEPLOYMENT.md` for full instructions covering:
- **Vercel + Supabase** (recommended, 15 min setup)
- **Docker + VPS** (full control)
- **Railway** (simple + affordable)

---

## Phase 3 Preview

- Playwright browser automation (Greenhouse, Lever, Workday, iCIMS)
- LinkedIn job scraping
- Email inbox parsing (auto-detect interview invitations)
- Multi-language resume support
- Stripe billing + subscription tiers
- Team/agency accounts
- Mobile app (React Native)
