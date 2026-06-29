// ============================================================
// AutoApply AI — Complete TypeScript Types
// src/types/database.ts
// ============================================================

export type ApplicationStatus = 'pending' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
export type JobType = 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship' | 'remote';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'executive';
export type AutomationMode = 'manual' | 'auto';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type NotificationType = 'application' | 'interview' | 'offer' | 'rejection' | 'scan' | 'system' | 'ai_insight';
export type ActivityType = 'login' | 'resume_upload' | 'job_scan' | 'application_submit' | 'profile_update' | 'settings_change' | 'ai_call' | 'export';

// ── Profile ──────────────────────────────────────────────────
export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  summary: string;
  skills: string[];
  experience_level: ExperienceLevel;
  years_experience: number;
  target_roles: string[];
  target_locations: string[];
  salary_min: number;
  salary_max: number;
  preferred_job_types: JobType[];
  automation_mode: AutomationMode;
  daily_target: number;
  match_threshold: number;
  prefer_remote: boolean;
  email_notifications: boolean;
  setup_complete: boolean;
  avatar_url: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'user_id' | 'created_at'>>;

// ── Resume ────────────────────────────────────────────────────
export interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  summary?: string;
  skills?: string[];
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  certifications?: string[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  duration: string;
  bullets: string[];
}

export interface EducationEntry {
  degree: string;
  school: string;
  year: string;
}

export interface Resume {
  id: string;
  user_id: string;
  name: string;
  file_url: string;
  file_name: string;
  file_size: number;
  raw_text: string;
  parsed_data: ParsedResumeData;
  ats_score: number;
  is_primary: boolean;
  version_notes: string;
  created_at: string;
  updated_at: string;
}

export type ResumeInsert = Omit<Resume, 'id' | 'created_at' | 'updated_at'>;
export type ResumeUpdate = Partial<Omit<Resume, 'id' | 'user_id' | 'created_at'>>;

// ── Job ───────────────────────────────────────────────────────
export interface Job {
  id: string;
  user_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  job_type: JobType;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  description: string;
  requirements: string;
  benefits: string;
  skills_required: string[];
  experience_level: ExperienceLevel;
  apply_url: string;
  source_url: string;
  source_name: string;
  company_logo: string;
  company_size: string;
  industry: string;
  posted_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_saved: boolean;
  scan_batch_id: string | null;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  match?: JobMatch;
}

export type JobInsert = Omit<Job, 'id' | 'created_at' | 'updated_at' | 'match'>;
export type JobUpdate = Partial<Omit<Job, 'id' | 'user_id' | 'created_at' | 'match'>>;

// ── Job Match ─────────────────────────────────────────────────
export interface JobMatch {
  id: string;
  user_id: string;
  job_id: string;
  resume_id: string | null;
  overall_score: number;
  skill_score: number;
  experience_score: number;
  education_score: number;
  ats_score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  verdict: string;
  ai_summary: string;
  should_apply: boolean;
  computed_at: string;
}

export type JobMatchInsert = Omit<JobMatch, 'id'>;

// ── Saved Job ─────────────────────────────────────────────────
export interface SavedJob {
  id: string;
  user_id: string;
  job_id: string;
  notes: string;
  saved_at: string;
  job?: Job;
}

// ── Application ───────────────────────────────────────────────
export interface ScreeningAnswers {
  [question: string]: string;
}

export interface SubmissionLog {
  validatedAt: string;
  matchCheck: string;
  duplicateCheck: string;
  eligibilityCheck: string;
  mode: string;
  coverLetterReady: boolean;
  resumeOptimized: boolean;
  screeningAnswered: number;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string | null;
  resume_id: string | null;
  title: string;
  company: string;
  location: string;
  salary: string;
  apply_url: string;
  source: string;
  match_score: number;
  status: ApplicationStatus;
  cover_letter: string;
  screening_answers: ScreeningAnswers;
  optimization_data: Record<string, unknown>;
  submission_log: SubmissionLog | Record<string, unknown>;
  notes: string;
  applied_at: string;
  responded_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
  rejected_at: string | null;
  updated_at: string;
}

export type ApplicationInsert = Omit<Application, 'id' | 'updated_at'>;
export type ApplicationUpdate = Partial<Omit<Application, 'id' | 'user_id' | 'applied_at'>>;

// ── Cover Letter ──────────────────────────────────────────────
export interface CoverLetter {
  id: string;
  user_id: string;
  job_id: string | null;
  job_title: string;
  company: string;
  content: string;
  is_template: boolean;
  template_name: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export type CoverLetterInsert = Omit<CoverLetter, 'id' | 'created_at' | 'updated_at'>;

// ── Notification ──────────────────────────────────────────────
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  is_read: boolean;
  action_url: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type NotificationInsert = Omit<Notification, 'id' | 'created_at'>;

// ── Activity Log ──────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  user_id: string;
  type: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

// ── Automation Task ───────────────────────────────────────────
export interface AutomationTask {
  id: string;
  user_id: string;
  task_type: string;
  status: TaskStatus;
  config: Record<string, unknown>;
  result: Record<string, unknown>;
  jobs_found: number;
  jobs_applied: number;
  errors: string[];
  started_at: string | null;
  completed_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

// ── Career Insights ───────────────────────────────────────────
export interface SkillGap {
  skill: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  jobs_requiring: number;
}

export interface RecommendedCert {
  name: string;
  provider: string;
  url: string;
  relevance: string;
  estimated_time: string;
}

export interface LearningPathStep {
  order: number;
  title: string;
  description: string;
  resources: string[];
  estimated_weeks: number;
}

export interface CareerInsights {
  id: string;
  user_id: string;
  skill_gaps: SkillGap[];
  recommended_certs: RecommendedCert[];
  learning_path: LearningPathStep[];
  career_suggestions: string[];
  market_insights: Record<string, unknown>;
  salary_insights: Record<string, unknown>;
  generated_at: string;
}

// ── Dashboard Stats ───────────────────────────────────────────
export interface DashboardStats {
  total_jobs: number;
  total_matches: number;
  avg_match_score: number;
  top_score: number;
  total_applied: number;
  pending_review: number;
  interviews: number;
  offers: number;
  rejections: number;
  saved_jobs: number;
  unread_notifs: number;
  response_rate: number;
}

// ── Admin Stats ───────────────────────────────────────────────
export interface AdminStats {
  total_users: number;
  active_users_today: number;
  total_applications: number;
  total_jobs: number;
  total_ai_calls: number;
  applications_today: number;
  new_users_today: number;
}

// ── API Response wrapper ──────────────────────────────────────
export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
}

// ── Job CSV Import row ────────────────────────────────────────
export interface JobCSVRow {
  title: string;
  company: string;
  location?: string;
  remote?: string;
  salary_min?: string;
  salary_max?: string;
  description?: string;
  skills?: string;
  apply_url?: string;
  job_type?: string;
}

// ── Filters ───────────────────────────────────────────────────
export interface JobFilters {
  search?: string;
  remote?: boolean;
  job_type?: JobType;
  experience_level?: ExperienceLevel;
  salary_min?: number;
  min_match_score?: number;
  skills?: string[];
  saved_only?: boolean;
  has_match?: boolean;
  sort_by?: 'posted_at' | 'match_score' | 'salary' | 'company';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface ApplicationFilters {
  status?: ApplicationStatus;
  search?: string;
  sort_by?: 'applied_at' | 'company' | 'match_score';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
