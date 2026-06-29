-- ============================================================
-- AutoApply AI — Migration 002: Storage + Admin Seed
-- supabase/migrations/002_storage_and_seed.sql
-- Run after 001_initial_schema.sql
-- ============================================================

-- ── Storage buckets ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('resumes', 'resumes', false, 6291456,
   ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']),
  ('avatars', 'avatars', true, 2097152,
   ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS Policies ───────────────────────────────────────

-- Resumes: private per-user
CREATE POLICY "Users upload own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own resumes"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own resumes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Avatars: public read, private write
CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Views for admin dashboard ──────────────────────────────────

-- User overview (safe — no passwords)
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT
  p.user_id,
  p.name,
  p.email,
  p.setup_complete,
  p.automation_mode,
  p.daily_target,
  p.match_threshold,
  p.skills,
  p.target_roles,
  p.created_at,
  p.updated_at,
  (SELECT COUNT(*) FROM applications a WHERE a.user_id = p.user_id) AS total_applications,
  (SELECT COUNT(*) FROM jobs j WHERE j.user_id = p.user_id) AS total_jobs,
  (SELECT COUNT(*) FROM resumes r WHERE r.user_id = p.user_id) AS total_resumes,
  (SELECT COUNT(*) FROM job_matches m WHERE m.user_id = p.user_id) AS total_matches,
  (SELECT ROUND(AVG(m.overall_score)) FROM job_matches m WHERE m.user_id = p.user_id) AS avg_match_score,
  (SELECT MAX(al.created_at) FROM activity_logs al WHERE al.user_id = p.user_id) AS last_active
FROM profiles p;

-- Daily application counts
CREATE OR REPLACE VIEW daily_application_stats AS
SELECT
  DATE(applied_at) AS date,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'applied') AS applied,
  COUNT(*) FILTER (WHERE status = 'interview') AS interviews,
  COUNT(*) FILTER (WHERE status = 'offer') AS offers,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
  ROUND(AVG(match_score)) AS avg_match_score
FROM applications
GROUP BY DATE(applied_at)
ORDER BY date DESC;

-- ── Realtime subscriptions setup ──────────────────────────────
-- Enable realtime for notifications table (for instant alerts)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE applications;

-- ── Additional indexes for performance ────────────────────────
CREATE INDEX IF NOT EXISTS idx_applications_company_trgm
  ON applications USING GIN(company gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_applications_title_trgm
  ON applications USING GIN(title gin_trgm_ops);

-- ── Cleanup function (run weekly) ─────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM notifications
  WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';

  -- Delete activity logs older than 90 days
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Deactivate expired jobs
  UPDATE jobs
  SET is_active = false
  WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
