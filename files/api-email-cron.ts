// ============================================================
// AutoApply AI — Email Send API Route
// Save as: app/api/email/send/route.ts
// ============================================================

// ── app/api/email/send/route.ts ────────────────────────────────
export const emailSendRoute = `
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Rate limit: track per-IP sends (simple in-memory, use Redis in production)
const sendCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = sendCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    sendCounts.set(ip, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (entry.count >= 20) return false; // 20 emails/hour per IP
  entry.count++;
  return true;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }

  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
}

export async function POST(req: NextRequest) {
  // Get client IP
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from: \`"\${process.env.SMTP_FROM_NAME || 'AutoApply AI'}" <\${process.env.SMTP_FROM || process.env.SMTP_USER}>\`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, '').trim(),
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (e: any) {
    console.error('Email send error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
`;

// ── app/api/cron/daily-report/route.ts ────────────────────────
export const cronDailyReportRoute = `
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EmailService } from '@/src/services/EmailService';

// Vercel Cron Job handler
// Secured by CRON_SECRET header
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, email')
    .eq('email_notifications', true);

  let sent = 0;
  let failed = 0;

  for (const profile of profiles || []) {
    try {
      const [appsRes, jobsRes, matchesRes] = await Promise.all([
        supabase.from('applications').select('status').eq('user_id', profile.user_id).gte('applied_at', today.toISOString()),
        supabase.from('jobs').select('id', { count: 'exact' }).eq('user_id', profile.user_id),
        supabase.from('job_matches').select('overall_score, job:jobs(title,company)').eq('user_id', profile.user_id).gte('overall_score', 80).order('overall_score', { ascending: false }).limit(3),
      ]);

      const apps = appsRes.data || [];
      const pendingRes = await supabase.from('applications').select('id', { count: 'exact' }).eq('user_id', profile.user_id).eq('status', 'pending');

      const reportData = {
        userName: profile.name || 'there',
        date: today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        jobsFound: jobsRes.count || 0,
        jobsApplied: apps.length,
        interviews: apps.filter((a: any) => a.status === 'interview').length,
        offers: apps.filter((a: any) => a.status === 'offer').length,
        responseRate: apps.length > 0 ? Math.round((apps.filter((a: any) => ['interview','offer'].includes(a.status)).length / apps.length) * 100) : 0,
        topMatches: (matchesRes.data || []).map((m: any) => ({ title: m.job?.title || '', company: m.job?.company || '', score: m.overall_score })),
        pendingReview: pendingRes.count || 0,
      };

      const { success } = await EmailService.sendDailyReport(profile.email, reportData);
      if (success) sent++; else failed++;

      await new Promise(r => setTimeout(r, 150));
    } catch { failed++; }
  }

  return NextResponse.json({ sent, failed, total: (profiles || []).length });
}
`;

// ── app/api/cron/cleanup/route.ts ─────────────────────────────
export const cronCleanupRoute = `
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabase.rpc('cleanup_old_data');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ran_at: new Date().toISOString() });
}
`;

export const CRON_ROUTES_README = `
# Cron Routes — Save to:

app/api/email/send/route.ts        ← emailSendRoute
app/api/cron/daily-report/route.ts ← cronDailyReportRoute
app/api/cron/cleanup/route.ts      ← cronCleanupRoute

Add CRON_SECRET to .env for security:
  CRON_SECRET=your-random-secret-here
`;
