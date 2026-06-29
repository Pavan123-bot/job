-- ============================================================
-- AutoApply AI — Complete Database Schema
-- Migration: 001_initial_schema.sql
-- Run in Supabase SQL Editor or via supabase db push
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE application_status AS ENUM (
  'pending', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'
);

CREATE TYPE job_type AS ENUM (
  'full_time', 'part_time', 'contract', 'freelance', 'internship', 'remote'
);

CREATE TYPE experience_level AS ENUM (
  'entry', 'mid', 'senior', 'lead', 'manager', 'director', 'executive'
);

CREATE TYPE automation_mode AS ENUM ('manual', 'auto');

CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TYPE notification_type AS ENUM (
  'application', 'interview', 'offer', 'rejection', 'scan', 'system', 'ai_insight'
);

CREATE TYPE activity_type AS ENUM (
  'login', 'resume_upload', 'job_scan', 'application_submit',
  'profile_update', 'settings_change', 'ai_call', 'export'
);

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL DEFAULT '',
  phone             TEXT DEFAULT '',
  location          TEXT DEFAULT '',
  linkedin_url      TEXT DEFAULT '',
  github_url        TEXT DEFAULT '',
  portfolio_url     TEXT DEFAULT '',
  summary           TEXT DEFAULT '',
  skills            TEXT[] DEFAULT '{}',
  experience_level  experience_level DEFAULT 'mid',
  years_experience  INTEGER DEFAULT 0,
  target_roles      TEXT[] DEFAULT '{}',
  target_locations  TEXT[] DEFAULT '{}',
  salary_min        INTEGER DEFAULT 0,
  salary_max        INTEGER DEFAULT 0,
  preferred_job_types job_type[] DEFAULT '{}',
  automation_mode   automation_mode DEFAULT 'manual',
  daily_target      INTEGER DEFAULT 20,
  match_threshold   INTEGER DEFAULT 75,
  prefer_remote     BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  setup_complete    BOOLEAN DEFAULT false,
  avatar_url        TEXT DEFAULT '',
  timezone          TEXT DEFAULT 'UTC',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- TABLE: resumes
-- ============================================================
CREATE TABLE resumes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'My Resume',
  file_url        TEXT DEFAULT '',
  file_name       TEXT DEFAULT '',
  file_size       INTEGER DEFAULT 0,
  raw_text        TEXT DEFAULT '',
  parsed_data     JSONB DEFAULT '{}',
  ats_score       INTEGER DEFAULT 0,
  is_primary      BOOLEAN DEFAULT false,
  version_notes   TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: jobs
-- ============================================================
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  location        TEXT DEFAULT '',
  remote          BOOLEAN DEFAULT false,
  job_type        job_type DEFAULT 'full_time',
  salary_min      INTEGER DEFAULT 0,
  salary_max      INTEGER DEFAULT 0,
  salary_currency TEXT DEFAULT 'USD',
  description     TEXT DEFAULT '',
  requirements    TEXT DEFAULT '',
  benefits        TEXT DEFAULT '',
  skills_required TEXT[] DEFAULT '{}',
  experience_level experience_level DEFAULT 'mid',
  apply_url       TEXT DEFAULT '',
  source_url      TEXT DEFAULT '',
  source_name     TEXT DEFAULT '',
  company_logo    TEXT DEFAULT '',
  company_size    TEXT DEFAULT '',
  industry        TEXT DEFAULT '',
  posted_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT true,
  is_saved        BOOLEAN DEFAULT false,
  scan_batch_id   UUID,
  raw_data        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: job_matches
-- ============================================================
CREATE TABLE job_matches (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id                UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id             UUID REFERENCES resumes(id) ON DELETE SET NULL,
  overall_score         INTEGER DEFAULT 0,
  skill_score           INTEGER DEFAULT 0,
  experience_score      INTEGER DEFAULT 0,
  education_score       INTEGER DEFAULT 0,
  ats_score             INTEGER DEFAULT 0,
  matched_skills        TEXT[] DEFAULT '{}',
  missing_skills        TEXT[] DEFAULT '{}',
  strengths             TEXT[] DEFAULT '{}',
  weaknesses            TEXT[] DEFAULT '{}',
  recommendations       TEXT[] DEFAULT '{}',
  verdict               TEXT DEFAULT '',
  ai_summary            TEXT DEFAULT '',
  should_apply          BOOLEAN DEFAULT false,
  computed_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ============================================================
-- TABLE: saved_jobs
-- ============================================================
CREATE TABLE saved_jobs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  notes       TEXT DEFAULT '',
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- ============================================================
-- TABLE: applications
-- ============================================================
CREATE TABLE applications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,
  resume_id           UUID REFERENCES resumes(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  company             TEXT NOT NULL,
  location            TEXT DEFAULT '',
  salary              TEXT DEFAULT '',
  apply_url           TEXT DEFAULT '',
  source              TEXT DEFAULT '',
  match_score         INTEGER DEFAULT 0,
  status              application_status DEFAULT 'pending',
  cover_letter        TEXT DEFAULT '',
  screening_answers   JSONB DEFAULT '{}',
  optimization_data   JSONB DEFAULT '{}',
  submission_log      JSONB DEFAULT '{}',
  notes               TEXT DEFAULT '',
  applied_at          TIMESTAMPTZ DEFAULT NOW(),
  responded_at        TIMESTAMPTZ,
  interview_at        TIMESTAMPTZ,
  offer_at            TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: cover_letters
-- ============================================================
CREATE TABLE cover_letters (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id      UUID REFERENCES jobs(id) ON DELETE SET NULL,
  job_title   TEXT NOT NULL DEFAULT '',
  company     TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  is_template BOOLEAN DEFAULT false,
  template_name TEXT DEFAULT '',
  word_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        notification_type DEFAULT 'system',
  title       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL DEFAULT '',
  icon        TEXT DEFAULT '🔔',
  is_read     BOOLEAN DEFAULT false,
  action_url  TEXT DEFAULT '',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: activity_logs
-- ============================================================
CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        activity_type NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata    JSONB DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: automation_tasks
-- ============================================================
CREATE TABLE automation_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type       TEXT NOT NULL,
  status          task_status DEFAULT 'pending',
  config          JSONB DEFAULT '{}',
  result          JSONB DEFAULT '{}',
  jobs_found      INTEGER DEFAULT 0,
  jobs_applied    INTEGER DEFAULT 0,
  errors          TEXT[] DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: career_insights
-- ============================================================
CREATE TABLE career_insights (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_gaps            JSONB DEFAULT '[]',
  recommended_certs     JSONB DEFAULT '[]',
  learning_path         JSONB DEFAULT '[]',
  career_suggestions    JSONB DEFAULT '[]',
  market_insights       JSONB DEFAULT '{}',
  salary_insights       JSONB DEFAULT '{}',
  generated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- TABLE: admin_settings (system-wide)
-- ============================================================
CREATE TABLE admin_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed admin settings
INSERT INTO admin_settings (key, value, description) VALUES
  ('ai_rate_limit', '{"calls_per_minute": 20, "calls_per_day": 500}', 'Claude AI rate limits per user'),
  ('max_daily_applications', '{"limit": 50}', 'Maximum applications per user per day'),
  ('scan_interval_hours', '{"interval": 24}', 'How often to scan for new jobs'),
  ('features', '{"job_scanner": true, "ai_matching": true, "auto_apply": true}', 'Feature flags');

-- ============================================================
-- INDEXES
-- ============================================================
-- profiles
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_skills ON profiles USING GIN(skills);

-- resumes
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_is_primary ON resumes(user_id, is_primary);

-- jobs
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_title_trgm ON jobs USING GIN(title gin_trgm_ops);
CREATE INDEX idx_jobs_company_trgm ON jobs USING GIN(company gin_trgm_ops);
CREATE INDEX idx_jobs_skills ON jobs USING GIN(skills_required);
CREATE INDEX idx_jobs_remote ON jobs(remote);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_is_active ON jobs(is_active);

-- job_matches
CREATE INDEX idx_job_matches_user_id ON job_matches(user_id);
CREATE INDEX idx_job_matches_job_id ON job_matches(job_id);
CREATE INDEX idx_job_matches_score ON job_matches(user_id, overall_score DESC);
CREATE INDEX idx_job_matches_should_apply ON job_matches(user_id, should_apply);

-- saved_jobs
CREATE INDEX idx_saved_jobs_user_id ON saved_jobs(user_id);

-- applications
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(user_id, status);
CREATE INDEX idx_applications_applied_at ON applications(applied_at DESC);
CREATE INDEX idx_applications_company ON applications(company);

-- cover_letters
CREATE INDEX idx_cover_letters_user_id ON cover_letters(user_id);

-- notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- activity_logs
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_type ON activity_logs(type);

-- automation_tasks
CREATE INDEX idx_automation_tasks_user_id ON automation_tasks(user_id);
CREATE INDEX idx_automation_tasks_status ON automation_tasks(status);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_insights ENABLE ROW LEVEL SECURITY;

-- profiles RLS
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = user_id);

-- resumes RLS
CREATE POLICY "Users can manage own resumes" ON resumes FOR ALL USING (auth.uid() = user_id);

-- jobs RLS
CREATE POLICY "Users can manage own jobs" ON jobs FOR ALL USING (auth.uid() = user_id);

-- job_matches RLS
CREATE POLICY "Users can manage own matches" ON job_matches FOR ALL USING (auth.uid() = user_id);

-- saved_jobs RLS
CREATE POLICY "Users can manage own saved jobs" ON saved_jobs FOR ALL USING (auth.uid() = user_id);

-- applications RLS
CREATE POLICY "Users can manage own applications" ON applications FOR ALL USING (auth.uid() = user_id);

-- cover_letters RLS
CREATE POLICY "Users can manage own cover letters" ON cover_letters FOR ALL USING (auth.uid() = user_id);

-- notifications RLS
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- activity_logs RLS
CREATE POLICY "Users can view own activity" ON activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert activity" ON activity_logs FOR INSERT WITH CHECK (true);

-- automation_tasks RLS
CREATE POLICY "Users can manage own tasks" ON automation_tasks FOR ALL USING (auth.uid() = user_id);

-- career_insights RLS
CREATE POLICY "Users can manage own insights" ON career_insights FOR ALL USING (auth.uid() = user_id);

-- admin_settings: readable by all authenticated users
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read settings" ON admin_settings FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_resumes_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_cover_letters_updated_at BEFORE UPDATE ON cover_letters FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function: get user dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_jobs',       (SELECT COUNT(*) FROM jobs WHERE user_id = p_user_id),
    'total_matches',    (SELECT COUNT(*) FROM job_matches WHERE user_id = p_user_id),
    'avg_match_score',  (SELECT COALESCE(ROUND(AVG(overall_score)), 0) FROM job_matches WHERE user_id = p_user_id),
    'top_score',        (SELECT COALESCE(MAX(overall_score), 0) FROM job_matches WHERE user_id = p_user_id),
    'total_applied',    (SELECT COUNT(*) FROM applications WHERE user_id = p_user_id AND status != 'pending'),
    'pending_review',   (SELECT COUNT(*) FROM applications WHERE user_id = p_user_id AND status = 'pending'),
    'interviews',       (SELECT COUNT(*) FROM applications WHERE user_id = p_user_id AND status = 'interview'),
    'offers',           (SELECT COUNT(*) FROM applications WHERE user_id = p_user_id AND status = 'offer'),
    'rejections',       (SELECT COUNT(*) FROM applications WHERE user_id = p_user_id AND status = 'rejected'),
    'saved_jobs',       (SELECT COUNT(*) FROM saved_jobs WHERE user_id = p_user_id),
    'unread_notifs',    (SELECT COUNT(*) FROM notifications WHERE user_id = p_user_id AND is_read = false),
    'response_rate',    (
      SELECT CASE
        WHEN COUNT(*) FILTER (WHERE status != 'pending') = 0 THEN 0
        ELSE ROUND(
          COUNT(*) FILTER (WHERE status IN ('interview','offer'))::NUMERIC /
          NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0) * 100
        )
      END
      FROM applications WHERE user_id = p_user_id
    )
  ) INTO result
  FROM applications WHERE user_id = p_user_id;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get admin overview stats (for admin panel)
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users',        (SELECT COUNT(*) FROM auth.users),
    'active_users_today', (SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at > NOW() - INTERVAL '24 hours'),
    'total_applications', (SELECT COUNT(*) FROM applications),
    'total_jobs',         (SELECT COUNT(*) FROM jobs),
    'total_ai_calls',     (SELECT COUNT(*) FROM activity_logs WHERE type = 'ai_call'),
    'applications_today', (SELECT COUNT(*) FROM applications WHERE applied_at > NOW() - INTERVAL '24 hours'),
    'new_users_today',    (SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '24 hours')
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORAGE BUCKETS (run separately in Supabase dashboard or via API)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage RLS policies (run after bucket creation):
-- CREATE POLICY "Users can upload own resumes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can read own resumes" ON storage.objects FOR SELECT USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can delete own resumes" ON storage.objects FOR DELETE USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Avatars are public" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
