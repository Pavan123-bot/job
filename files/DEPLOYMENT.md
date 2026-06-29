# AutoApply AI — Phase 2 Deployment Guide
# Production-Ready SaaS Deployment

---

## Architecture Overview

```
Browser → Nginx (SSL/Rate-limit) → Next.js Frontend
                                 → Supabase (PostgreSQL + Auth + Storage + Realtime)
                                 → Claude AI API
                                 → Redis (queues/cache)
                                 → Background Worker (cron + email)
```

---

## OPTION A — Vercel + Supabase (Recommended, Fastest)

### 1. Create Supabase Project

1. Go to https://supabase.com → New Project
2. Choose region closest to your users
3. Note: `Project URL`, `anon key`, `service_role key`
4. Go to **SQL Editor** → paste `supabase/migrations/001_initial_schema.sql` → Run

### 2. Configure Supabase Storage

In Supabase dashboard → Storage → Create buckets:

```sql
-- Run in SQL Editor after creating buckets manually:
CREATE POLICY "Users upload own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
```

### 3. Configure Supabase Auth

Dashboard → Authentication → Settings:
- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/auth/callback`
- Email confirmations: Optional (disable for faster onboarding)

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# In your project root
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add NEXT_PUBLIC_APP_URL
vercel env add SMTP_HOST
vercel env add SMTP_PASS
vercel env add ADMIN_EMAILS

# Deploy to production
vercel --prod
```

### 5. Configure Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/job-scan",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/daily-report",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

---

## OPTION B — Docker + VPS (Full Control)

### 1. Prepare VPS

```bash
# Ubuntu 22.04 recommended
# Minimum specs: 2 vCPU, 4GB RAM, 40GB SSD

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Certbot for SSL
sudo apt install certbot -y
```

### 2. Clone and Configure

```bash
git clone https://github.com/your-org/autoapply-ai.git
cd autoapply-ai

# Copy env file
cp .env.example .env.local

# Edit with your values
nano .env.local
```

### 3. SSL Certificate

```bash
# Point your domain DNS to the VPS IP first, then:
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certs to nginx directory
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/fullchain.pem
sudo chmod 600 nginx/ssl/privkey.pem

# Auto-renew
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 4. Update nginx.conf

```bash
# Replace 'your-domain.com' in nginx/nginx.conf
sed -i 's/your-domain.com/youractualdomain.com/g' nginx/nginx.conf
```

### 5. Build and Launch

```bash
# Set env vars for build args
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
export NEXT_PUBLIC_APP_URL=https://your-domain.com

# Build images
docker compose build

# Launch all services
docker compose up -d

# Check logs
docker compose logs -f frontend
docker compose logs -f worker

# Verify health
curl https://your-domain.com/api/health
```

### 6. Run Database Migration

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Push migration
supabase db push

# Or run SQL directly:
supabase db execute --file supabase/migrations/001_initial_schema.sql
```

---

## OPTION C — Railway (Simple + Affordable)

```bash
# Install Railway CLI
npm i -g @railway/cli

railway login
railway new

# Add services
railway add postgresql  # Not needed — use Supabase
railway add redis

# Set env vars in Railway dashboard or:
railway variables set NEXT_PUBLIC_SUPABASE_URL=...
railway variables set ANTHROPIC_API_KEY=...

# Deploy
railway up
```

---

## Post-Deployment Checklist

### Verify Core Services

```bash
# Health check
curl https://your-domain.com/api/health

# Expected response:
# {"status":"ok","database":"ok","ai":"configured","timestamp":"..."}
```

### Test Authentication

1. Go to `https://your-domain.com`
2. Create a test account
3. Complete the setup wizard
4. Verify profile saved in Supabase dashboard → Table Editor → profiles

### Test AI Features

1. Upload a resume → check it parses
2. Go to Job Discovery → Import a test job manually
3. Click "🤖 Score All Jobs" → verify match scores appear
4. Generate a cover letter → verify Claude API responds

### Test Notifications

1. Submit a test application
2. Check Supabase → notifications table for new rows
3. Verify they appear in the Notifications view

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server only) |
| `ANTHROPIC_API_KEY` | ✅ | Claude AI API key |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your app's public URL |
| `REDIS_URL` | ⚠️ | Redis connection URL (for queues) |
| `SMTP_HOST` | ⚠️ | Email SMTP host |
| `SMTP_PASS` | ⚠️ | Email SMTP password/key |
| `ADMIN_EMAILS` | ⚠️ | Comma-separated admin emails |
| `MAX_DAILY_APPLICATIONS` | ❌ | Max apps per user/day (default: 50) |

---

## Monitoring & Maintenance

### View Logs

```bash
# Docker
docker compose logs -f

# Vercel
vercel logs

# Railway
railway logs
```

### Database Backups

Supabase automatically backs up your database daily on paid plans.
For extra safety:

```bash
# Manual backup
supabase db dump --file backup_$(date +%Y%m%d).sql
```

### Scaling

For high traffic (>1000 users):
- Upgrade Supabase plan for more connections
- Add Redis cluster for job queues
- Use Vercel Edge Functions for AI calls
- Enable Supabase connection pooling (PgBouncer)

### Security Hardening

```bash
# Rotate Supabase keys periodically
# Dashboard → Settings → API → Rotate keys

# Enable 2FA on Supabase account
# Dashboard → Account → Security

# Set up Supabase audit logs
# Dashboard → Settings → Audit Logs
```

---

## Troubleshooting

### "Unauthorized" errors
- Check Supabase RLS policies are enabled
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set for server-side routes
- Check auth token is being sent in requests

### AI calls failing
- Verify `ANTHROPIC_API_KEY` is set and valid
- Check rate limits: 20 calls/minute per user
- Look at activity_logs table for ai_call entries

### File uploads failing
- Verify Supabase Storage buckets exist: `resumes`, `avatars`
- Check storage RLS policies are configured
- Verify file size < 6MB

### Migration issues
- Re-run SQL migration from scratch: `supabase db reset`
- Check for enum conflicts if re-running
- Verify all extensions are enabled: `uuid-ossp`, `pgcrypto`, `pg_trgm`

---

## Phase 3 Roadmap

After Phase 2 is deployed, Phase 3 will add:

- [ ] Playwright browser automation (auto-fill Greenhouse, Lever, Workday)
- [ ] Email parsing (auto-detect interview invitations)
- [ ] LinkedIn job scraping
- [ ] Multi-language resume support
- [ ] Team/agency accounts
- [ ] Stripe billing + subscription tiers
- [ ] Mobile app (React Native)
- [ ] Webhook integrations (Zapier, Make)
