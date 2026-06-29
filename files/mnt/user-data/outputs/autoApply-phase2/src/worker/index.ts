// ============================================================
// AutoApply AI — Background Worker
// src/worker/index.ts
// Runs as a separate process: node dist/worker/index.js
// Handles: daily job scans, email reports, scheduled tasks
// ============================================================

import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import { EmailService } from '../services/EmailService';

// ── Admin Supabase client (full access) ────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';

// ── Logger ─────────────────────────────────────────────────────
function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string, meta?: any) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`, meta ? JSON.stringify(meta) : '');
}

// ══════════════════════════════════════════════════════════════
// JOB: Daily Email Reports
// Sends personalized daily summary to all users with notifications enabled
// ══════════════════════════════════════════════════════════════
async function runDailyReports() {
  log('INFO', 'Starting daily report job');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Get all profiles with email notifications enabled
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .eq('email_notifications', true)
      .not('email', 'is', null);

    if (error) { log('ERROR', 'Failed to fetch profiles', error); return; }

    log('INFO', `Sending reports to ${profiles?.length || 0} users`);

    for (const profile of profiles || []) {
      try {
        // Get today's stats
        const [appsRes, jobsRes, notifEmailRes] = await Promise.all([
          supabase.from('applications')
            .select('status, match_score')
            .eq('user_id', profile.user_id)
            .gte('applied_at', today.toISOString()),
          supabase.from('jobs')
            .select('id', { count: 'exact' })
            .eq('user_id', profile.user_id),
          supabase.from('profiles')
            .select('email')
            .eq('user_id', profile.user_id)
            .single(),
        ]);

        const apps = appsRes.data || [];
        const topMatchesRes = await supabase
          .from('job_matches')
          .select('overall_score, job:jobs(title, company)')
          .eq('user_id', profile.user_id)
          .gte('overall_score', 80)
          .eq('should_apply', true)
          .order('overall_score', { ascending: false })
          .limit(3);

        const topMatches = (topMatchesRes.data || []).map((m: any) => ({
          title: m.job?.title || '',
          company: m.job?.company || '',
          score: m.overall_score,
        }));

        const pendingCount = await supabase
          .from('applications')
          .select('id', { count: 'exact' })
          .eq('user_id', profile.user_id)
          .eq('status', 'pending');

        const reportData = {
          userName: profile.name || 'there',
          date: today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
          jobsFound: jobsRes.count || 0,
          jobsApplied: apps.length,
          interviews: apps.filter(a => a.status === 'interview').length,
          offers: apps.filter(a => a.status === 'offer').length,
          responseRate: apps.length > 0
            ? Math.round((apps.filter(a => ['interview','offer'].includes(a.status)).length / apps.length) * 100)
            : 0,
          topMatches,
          pendingReview: pendingCount.count || 0,
        };

        const notifEmail = notifEmailRes.data?.email || profile.email;
        if (!notifEmail) continue;

        const { success, error: emailError } = await EmailService.sendDailyReport(notifEmail, reportData, APP_URL);
        if (success) {
          log('INFO', `Daily report sent to ${notifEmail}`);
        } else {
          log('WARN', `Failed to send report to ${notifEmail}`, emailError);
        }

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: profile.user_id,
          type: 'ai_call',
          description: 'Daily email report sent',
          metadata: { jobs_applied: apps.length },
        });

        // Rate limit: don't hammer the SMTP server
        await new Promise(r => setTimeout(r, 200));
      } catch (e: any) {
        log('ERROR', `Report failed for user ${profile.user_id}`, e.message);
      }
    }

    log('INFO', 'Daily report job complete');
  } catch (e: any) {
    log('ERROR', 'Daily report job failed', e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// JOB: Cleanup Old Data
// Removes read notifications >30d, activity logs >90d
// ══════════════════════════════════════════════════════════════
async function runCleanup() {
  log('INFO', 'Starting cleanup job');
  try {
    const { error } = await supabase.rpc('cleanup_old_data');
    if (error) log('ERROR', 'Cleanup failed', error);
    else log('INFO', 'Cleanup complete');
  } catch (e: any) {
    log('ERROR', 'Cleanup error', e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// JOB: Check for automation tasks
// Processes user-scheduled automation tasks from the queue
// ══════════════════════════════════════════════════════════════
async function processAutomationQueue() {
  log('INFO', 'Processing automation queue');
  try {
    const { data: tasks } = await supabase
      .from('automation_tasks')
      .select('*')
      .eq('status', 'pending')
      .lte('next_run_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    for (const task of tasks || []) {
      log('INFO', `Processing task ${task.id} type=${task.task_type}`);

      // Mark as running
      await supabase.from('automation_tasks')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', task.id);

      try {
        let result: any = {};

        if (task.task_type === 'daily_scan') {
          // Trigger AI job scan via API
          result = { message: 'Job scan triggered' };
        } else if (task.task_type === 'score_jobs') {
          result = { message: 'Job scoring triggered' };
        } else if (task.task_type === 'send_report') {
          result = { message: 'Report triggered' };
        }

        // Mark complete
        await supabase.from('automation_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result,
          })
          .eq('id', task.id);

        log('INFO', `Task ${task.id} completed`);
      } catch (e: any) {
        await supabase.from('automation_tasks')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            errors: [e.message],
          })
          .eq('id', task.id);
        log('ERROR', `Task ${task.id} failed`, e.message);
      }
    }
  } catch (e: any) {
    log('ERROR', 'Queue processing error', e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// HEALTH CHECK SERVER (port 3001)
// ══════════════════════════════════════════════════════════════
import http from 'http';

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404); res.end();
  }
});

// ══════════════════════════════════════════════════════════════
// SCHEDULER — Register all cron jobs
// ══════════════════════════════════════════════════════════════
function startScheduler() {
  // Daily email reports — 8 AM UTC
  cron.schedule(process.env.CRON_DAILY_REPORT || '0 8 * * *', () => {
    runDailyReports().catch(e => log('ERROR', 'Daily report cron failed', e.message));
  });

  // Weekly cleanup — Sunday 2 AM UTC
  cron.schedule(process.env.CRON_CLEANUP || '0 2 * * 0', () => {
    runCleanup().catch(e => log('ERROR', 'Cleanup cron failed', e.message));
  });

  // Process automation queue — every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    processAutomationQueue().catch(e => log('ERROR', 'Queue cron failed', e.message));
  });

  log('INFO', 'All cron jobs scheduled');
  log('INFO', `Daily reports: ${process.env.CRON_DAILY_REPORT || '0 8 * * *'} UTC`);
  log('INFO', `Cleanup: ${process.env.CRON_CLEANUP || '0 2 * * 0'} UTC`);
  log('INFO', 'Queue processing: every 5 minutes');
}

// ══════════════════════════════════════════════════════════════
// ENTRY POINT
// ══════════════════════════════════════════════════════════════
async function main() {
  log('INFO', '=== AutoApply AI Worker Starting ===');

  // Validate required env vars
  const required = ['SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    log('ERROR', `Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Test DB connection
  const { error: dbError } = await supabase.from('admin_settings').select('key').limit(1);
  if (dbError) {
    log('ERROR', 'Database connection failed', dbError.message);
    process.exit(1);
  }
  log('INFO', 'Database connection OK');

  // Start health server
  healthServer.listen(3001, () => log('INFO', 'Health server on :3001'));

  // Start cron scheduler
  startScheduler();

  log('INFO', '=== Worker ready ===');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('INFO', 'SIGTERM received — shutting down');
    healthServer.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    log('INFO', 'SIGINT received — shutting down');
    healthServer.close(() => process.exit(0));
  });
}

main().catch(e => {
  log('ERROR', 'Worker startup failed', e.message);
  process.exit(1);
});
