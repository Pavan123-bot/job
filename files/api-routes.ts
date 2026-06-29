// ============================================================
// AutoApply AI — Next.js API Routes (Phase 2)
// ============================================================

// ── app/api/health/route.ts ───────────────────────────────────
export const healthRoute = `
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const checks: Record<string, string> = { status: 'ok', timestamp: new Date().toISOString() };
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from('admin_settings').select('key').limit(1);
    checks.database = error ? 'error' : 'ok';
  } catch { checks.database = 'error'; }
  checks.ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';
  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'configured' || v.includes('-'));
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
`;

// ── app/api/profile/route.ts ──────────────────────────────────
export const profileRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ProfileService } from '@/src/services/ProfileService';

function createSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
}

export async function GET() {
  const supabase = createSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await ProfileService.getProfile(user.id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { data, error } = await ProfileService.updateProfile(user.id, body);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}
`;

// ── app/api/jobs/route.ts ─────────────────────────────────────
export const jobsRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { JobService } from '@/src/services/JobService';

function createSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
}

export async function GET(req: NextRequest) {
  const supabase = createSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filters = {
    search: searchParams.get('search') || undefined,
    remote: searchParams.get('remote') === 'true' ? true : undefined,
    page: parseInt(searchParams.get('page') || '1'),
    per_page: parseInt(searchParams.get('per_page') || '20'),
    sort_by: (searchParams.get('sort_by') as any) || 'posted_at',
    min_match_score: parseInt(searchParams.get('min_score') || '0'),
  };

  const { data, error } = await JobService.listJobs(user.id, filters);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { data, error } = await JobService.createJob({ ...body, user_id: user.id });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
`;

// ── app/api/jobs/import/route.ts ──────────────────────────────
export const jobsImportRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { JobService } from '@/src/services/JobService';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const text = await file.text();
  const rows = JobService.parseCSV(text);
  const { data, error } = await JobService.importFromCSV(user.id, rows);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}
`;

// ── app/api/jobs/[id]/match/route.ts ─────────────────────────
export const jobMatchRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { JobService } from '@/src/services/JobService';
import { ProfileService } from '@/src/services/ProfileService';
import { ResumeService } from '@/src/services/ResumeService';
import { AIMatchingEngine } from '@/src/services/AIMatchingEngine';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [jobRes, profileRes, resumeRes] = await Promise.all([
    JobService.getJob(params.id, user.id),
    ProfileService.getProfile(user.id),
    ResumeService.getPrimaryResume(user.id),
  ]);

  if (!jobRes.data || !profileRes.data)
    return NextResponse.json({ error: 'Job or profile not found' }, { status: 404 });

  const { data, error } = await AIMatchingEngine.scoreAndSave(
    user.id, profileRes.data, resumeRes.data, jobRes.data
  );
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}
`;

// ── app/api/applications/route.ts ────────────────────────────
export const applicationsRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ApplicationService } from '@/src/services/ApplicationService';

function createSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
}

export async function GET(req: NextRequest) {
  const supabase = createSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filters = {
    status: (searchParams.get('status') as any) || undefined,
    search: searchParams.get('search') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    per_page: parseInt(searchParams.get('per_page') || '25'),
    sort_by: (searchParams.get('sort_by') as any) || 'applied_at',
    sort_dir: (searchParams.get('sort_dir') as any) || 'desc',
  };

  const { data, error } = await ApplicationService.listApplications(user.id, filters);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Validate required fields
  if (!body.title || !body.company) {
    return NextResponse.json({ error: 'title and company are required' }, { status: 400 });
  }

  // Check daily limit
  const todayCount = await ApplicationService.getTodayCount(user.id);
  const limit = parseInt(process.env.MAX_DAILY_APPLICATIONS || '50');
  if (todayCount >= limit) {
    return NextResponse.json({ error: \`Daily limit of \${limit} applications reached\` }, { status: 429 });
  }

  const { data, error } = await ApplicationService.createApplication({ ...body, user_id: user.id });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
`;

// ── app/api/applications/[id]/route.ts ───────────────────────
export const applicationByIdRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ApplicationService } from '@/src/services/ApplicationService';

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { data, error } = await ApplicationService.updateApplication(params.id, user.id, body);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { error } = await ApplicationService.deleteApplication(params.id, user.id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ success: true });
}
`;

// ── app/api/ai/cover-letter/route.ts ─────────────────────────
export const coverLetterRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ProfileService } from '@/src/services/ProfileService';
import { AIMatchingEngine } from '@/src/services/AIMatchingEngine';
import { JobService } from '@/src/services/JobService';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { job_id } = await req.json();
  const [profileRes, jobRes] = await Promise.all([
    ProfileService.getProfile(user.id),
    JobService.getJob(job_id, user.id),
  ]);

  if (!profileRes.data || !jobRes.data)
    return NextResponse.json({ error: 'Profile or job not found' }, { status: 404 });

  const { data, error } = await AIMatchingEngine.generateCoverLetter(profileRes.data, jobRes.data);
  if (error) return NextResponse.json({ error }, { status: 500 });

  // Save to DB
  await supabase.from('cover_letters').insert({
    user_id: user.id, job_id,
    job_title: jobRes.data.title, company: jobRes.data.company,
    content: data, word_count: data?.split(/\\s+/).length || 0,
  });

  return NextResponse.json({ data });
}
`;

// ── app/api/ai/career-insights/route.ts ──────────────────────
export const careerInsightsRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ProfileService } from '@/src/services/ProfileService';
import { JobService } from '@/src/services/JobService';
import { ApplicationService } from '@/src/services/ApplicationService';
import { AIMatchingEngine } from '@/src/services/AIMatchingEngine';

export async function POST(_req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profileRes, jobsRes, appsRes] = await Promise.all([
    ProfileService.getProfile(user.id),
    JobService.listJobs(user.id, { per_page: 100 }),
    ApplicationService.listApplications(user.id, { per_page: 200 }),
  ]);

  if (!profileRes.data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data, error } = await AIMatchingEngine.generateCareerInsights(
    user.id, profileRes.data,
    jobsRes.data?.jobs || [],
    appsRes.data?.applications || []
  );
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}
`;

// ── app/api/notifications/route.ts ───────────────────────────
export const notificationsRoute = `
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NotificationService } from '@/src/services/NotificationService';

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await NotificationService.list(user.id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { action, id } = await req.json();
  if (action === 'mark_all_read') {
    await NotificationService.markAllRead(user.id);
  } else if (action === 'mark_read' && id) {
    await NotificationService.markRead(id, user.id);
  } else if (action === 'clear_all') {
    await NotificationService.clearAll(user.id);
  }
  return NextResponse.json({ success: true });
}
`;

// ── app/api/admin/stats/route.ts ─────────────────────────────
export const adminStatsRoute = `
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  const { data: profile } = await supabase.from('profiles').select('email').eq('user_id', user.id).single();
  if (!adminEmails.includes(profile?.email || ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
`;

export const API_ROUTES_README = `
# AutoApply AI — API Routes

Save each exported string to the corresponding file path in your Next.js app:

app/
  api/
    health/route.ts          ← healthRoute
    profile/route.ts         ← profileRoute
    jobs/
      route.ts               ← jobsRoute
      import/route.ts        ← jobsImportRoute
      [id]/
        match/route.ts       ← jobMatchRoute
    applications/
      route.ts               ← applicationsRoute
      [id]/route.ts          ← applicationByIdRoute
    ai/
      cover-letter/route.ts  ← coverLetterRoute
      career-insights/route.ts ← careerInsightsRoute
    notifications/route.ts   ← notificationsRoute
    admin/
      stats/route.ts         ← adminStatsRoute
`;
