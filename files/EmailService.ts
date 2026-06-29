// ============================================================
// AutoApply AI — Email Service
// src/services/EmailService.ts
// Handles: daily reports, interview alerts, offer notifications
// ============================================================

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface DailyReportData {
  userName: string;
  date: string;
  jobsFound: number;
  jobsApplied: number;
  interviews: number;
  offers: number;
  responseRate: number;
  topMatches: { title: string; company: string; score: number }[];
  pendingReview: number;
}

// ── SMTP sender (uses nodemailer on server side) ──────────────
async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error: string | null }> {
  try {
    // In Next.js API route / worker — uses nodemailer
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Email templates ───────────────────────────────────────────
function baseTemplate(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { margin: 0; padding: 0; background: #0A0F1E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #F1F5F9; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
  .header { text-align: center; margin-bottom: 32px; }
  .logo { font-size: 28px; font-weight: 900; color: #3B82F6; letter-spacing: -0.5px; }
  .logo span { color: #8B5CF6; }
  .card { background: #111827; border: 1px solid #1E293B; border-radius: 14px; padding: 24px; margin-bottom: 16px; }
  .stat-row { display: flex; gap: 12px; margin-bottom: 16px; }
  .stat { flex: 1; background: #0D1117; border-radius: 10px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 800; font-family: monospace; }
  .stat-label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: .07em; margin-top: 4px; }
  .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #3B82F6, #2563EB); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 8px; }
  .job-row { padding: 12px 0; border-bottom: 1px solid #1E293B; display: flex; justify-content: space-between; align-items: center; }
  .job-title { font-weight: 600; font-size: 14px; }
  .job-company { font-size: 12px; color: #64748B; margin-top: 2px; }
  .score { padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; font-family: monospace; }
  .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #475569; }
  h2 { font-size: 18px; font-weight: 700; margin: 0 0 16px; }
  p { margin: 0 0 12px; color: #94A3B8; line-height: 1.6; font-size: 14px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">Auto<span>Apply</span> AI</div>
    <p style="color:#475569;font-size:13px;margin-top:8px;">${title}</p>
  </div>
  ${content}
  <div class="footer">
    <p>AutoApply AI · <a href="{{unsubscribe_url}}" style="color:#3B82F6;">Unsubscribe</a></p>
    <p>You're receiving this because you enabled email notifications.</p>
  </div>
</div>
</body>
</html>`;
}

// ── Daily Report Email ────────────────────────────────────────
export function buildDailyReportEmail(data: DailyReportData, appUrl: string): EmailPayload {
  const scoreColor = (s: number) => s >= 90 ? '#10B981' : s >= 75 ? '#3B82F6' : '#F59E0B';

  const topMatchesHtml = data.topMatches.length > 0
    ? data.topMatches.map(m => `
        <div class="job-row">
          <div>
            <div class="job-title">${m.title}</div>
            <div class="job-company">${m.company}</div>
          </div>
          <span class="score" style="background:${scoreColor(m.score)}22;color:${scoreColor(m.score)};border:1px solid ${scoreColor(m.score)}44;">
            ${m.score}%
          </span>
        </div>`).join('')
    : '<p style="color:#475569;">No high-match jobs found today. Try running a scan.</p>';

  const html = baseTemplate(`
    <div class="card">
      <h2>📊 Your Daily Report — ${data.date}</h2>
      <p>Here's a summary of your job search activity, ${data.userName}.</p>
      <div class="stat-row">
        <div class="stat">
          <div class="stat-value" style="color:#3B82F6;">${data.jobsFound}</div>
          <div class="stat-label">Jobs Found</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color:#06B6D4;">${data.jobsApplied}</div>
          <div class="stat-label">Applied Today</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color:#10B981;">${data.interviews}</div>
          <div class="stat-label">Interviews</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color:#8B5CF6;">${data.offers}</div>
          <div class="stat-label">Offers</div>
        </div>
      </div>
      ${data.pendingReview > 0 ? `<p style="color:#F59E0B;">⚠️ You have <strong>${data.pendingReview} application${data.pendingReview > 1 ? 's' : ''}</strong> waiting for your review.</p>` : ''}
      <a href="${appUrl}/applications" class="btn">View Applications →</a>
    </div>
    ${data.topMatches.length > 0 ? `
    <div class="card">
      <h2>⭐ Top Matches Ready to Apply</h2>
      ${topMatchesHtml}
      <a href="${appUrl}/jobs" class="btn" style="margin-top:16px;">Apply Now →</a>
    </div>` : ''}
    <div class="card">
      <p>📈 Response rate: <strong style="color:#F1F5F9;">${data.responseRate}%</strong> (industry avg: 18%)</p>
      <p>Keep applying consistently — most responses come after 5–10 applications per company.</p>
    </div>
  `, 'Daily Report');

  return {
    to: '',  // Filled by caller
    subject: `📊 Your AutoApply Daily Report — ${data.jobsApplied} apps today`,
    html,
    text: `AutoApply AI Daily Report for ${data.date}\n\nJobs Found: ${data.jobsFound}\nApplied: ${data.jobsApplied}\nInterviews: ${data.interviews}\nOffers: ${data.offers}\nResponse Rate: ${data.responseRate}%\n\nView your dashboard: ${appUrl}`,
  };
}

// ── Interview Alert Email ─────────────────────────────────────
export function buildInterviewAlertEmail(
  userName: string,
  jobTitle: string,
  company: string,
  interviewDate: string,
  appUrl: string
): EmailPayload {
  const html = baseTemplate(`
    <div class="card" style="border-color:#10B98144;background:linear-gradient(135deg,#10B98108,#111827);">
      <h2>🎉 Interview Scheduled!</h2>
      <p>Great news, ${userName}! You have an interview coming up.</p>
      <div style="padding:20px;background:#0D1117;border-radius:10px;margin:16px 0;">
        <div style="font-size:18px;font-weight:700;color:#F1F5F9;">${jobTitle}</div>
        <div style="font-size:14px;color:#64748B;margin-top:4px;">${company}</div>
        <div style="font-size:13px;color:#10B981;margin-top:12px;font-weight:600;">📅 ${interviewDate}</div>
      </div>
      <p>Make sure to:</p>
      <p>✓ Research the company thoroughly<br>
         ✓ Prepare answers to common questions<br>
         ✓ Review the job description<br>
         ✓ Prepare questions to ask them</p>
      <a href="${appUrl}/interviews" class="btn" style="background:linear-gradient(135deg,#10B981,#059669);">
        View Interview Prep →
      </a>
    </div>
  `, 'Interview Scheduled');

  return {
    to: '',
    subject: `🎉 Interview Scheduled: ${jobTitle} at ${company}`,
    html,
    text: `Interview scheduled!\n\n${jobTitle} at ${company}\nDate: ${interviewDate}\n\nView details: ${appUrl}/interviews`,
  };
}

// ── Offer Alert Email ─────────────────────────────────────────
export function buildOfferAlertEmail(
  userName: string,
  jobTitle: string,
  company: string,
  appUrl: string
): EmailPayload {
  const html = baseTemplate(`
    <div class="card" style="border-color:#8B5CF644;background:linear-gradient(135deg,#8B5CF608,#111827);">
      <h2>🎊 You Received an Offer!</h2>
      <p>Congratulations, ${userName}! You've received a job offer.</p>
      <div style="padding:20px;background:#0D1117;border-radius:10px;margin:16px 0;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#8B5CF6;">${jobTitle}</div>
        <div style="font-size:15px;color:#94A3B8;margin-top:6px;">${company}</div>
      </div>
      <p>Before accepting, consider:</p>
      <p>✓ Negotiate salary — most offers have room<br>
         ✓ Review benefits package carefully<br>
         ✓ Check start date flexibility<br>
         ✓ Get the offer in writing</p>
      <a href="${appUrl}/applications" class="btn" style="background:linear-gradient(135deg,#8B5CF6,#7C3AED);">
        View Offer Details →
      </a>
    </div>
  `, 'Job Offer Received');

  return {
    to: '',
    subject: `🎊 Job Offer: ${jobTitle} at ${company}`,
    html,
    text: `You received a job offer!\n\n${jobTitle} at ${company}\n\nCongratulations! View details: ${appUrl}/applications`,
  };
}

// ── Email Service class ───────────────────────────────────────
export class EmailService {
  static async sendDailyReport(
    to: string,
    data: DailyReportData,
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
  ): Promise<{ success: boolean; error: string | null }> {
    const payload = buildDailyReportEmail(data, appUrl);
    return sendEmail({ ...payload, to });
  }

  static async sendInterviewAlert(
    to: string,
    userName: string,
    jobTitle: string,
    company: string,
    interviewDate: string,
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
  ): Promise<{ success: boolean; error: string | null }> {
    const payload = buildInterviewAlertEmail(userName, jobTitle, company, interviewDate, appUrl);
    return sendEmail({ ...payload, to });
  }

  static async sendOfferAlert(
    to: string,
    userName: string,
    jobTitle: string,
    company: string,
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
  ): Promise<{ success: boolean; error: string | null }> {
    const payload = buildOfferAlertEmail(userName, jobTitle, company, appUrl);
    return sendEmail({ ...payload, to });
  }

  static async sendGeneric(
    to: string,
    subject: string,
    message: string
  ): Promise<{ success: boolean; error: string | null }> {
    const html = baseTemplate(`
      <div class="card">
        <h2>${subject}</h2>
        <p>${message}</p>
      </div>
    `, subject);
    return sendEmail({ to, subject, html, text: message });
  }
}
