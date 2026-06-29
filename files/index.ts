// ============================================================
// AutoApply AI — React Hooks (Phase 2)
// src/hooks/index.ts
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ProfileService } from '../services/ProfileService';
import { ResumeService } from '../services/ResumeService';
import { JobService } from '../services/JobService';
import { ApplicationService } from '../services/ApplicationService';
import { NotificationService, ActivityService } from '../services/NotificationService';
import { AIMatchingEngine } from '../services/AIMatchingEngine';
import {
  Profile, ProfileUpdate, Resume, Job, JobFilters, Application,
  ApplicationFilters, ApplicationStatus, Notification, JobMatch,
  CareerInsights, DashboardStats, AdminStats, SavedJob
} from '../types/database';

// ── Generic async state helper ────────────────────────────────
function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, refetch: run };
}

// ════════════════════════════════════════════════════════════
// useAuth — current Supabase session
// ════════════════════════════════════════════════════════════
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { userId, loading, signOut };
}

// ════════════════════════════════════════════════════════════
// useProfile
// ════════════════════════════════════════════════════════════
export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await ProfileService.getProfile(userId);
    setProfile(data);
    setError(error);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (updates: ProfileUpdate): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    const { data, error } = await ProfileService.updateProfile(userId, updates);
    if (data) setProfile(data);
    setError(error);
    setSaving(false);
    return !error;
  }, [userId]);

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!userId) return null;
    const { data, error } = await ProfileService.uploadAvatar(userId, file);
    if (error) setError(error);
    if (data && profile) setProfile({ ...profile, avatar_url: data });
    return data;
  }, [userId, profile]);

  return { profile, loading, error, saving, refetch: load, update, uploadAvatar };
}

// ════════════════════════════════════════════════════════════
// useResumes
// ════════════════════════════════════════════════════════════
export function useResumes(userId: string | null) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await ResumeService.listResumes(userId);
    setResumes(data || []);
    setError(error);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const upload = useCallback(async (file: File, name?: string): Promise<Resume | null> => {
    if (!userId) return null;
    setUploading(true);
    try {
      const fileResult = await ResumeService.uploadFile(userId, file);
      if (fileResult.error) { setError(fileResult.error); return null; }

      const rawText = await file.text().catch(() => '');
      const parseResult = await AIMatchingEngine.parseResume(userId, rawText);

      const resume = await ResumeService.createResume({
        user_id: userId,
        name: name || file.name.replace(/\.[^/.]+$/, ''),
        file_url: fileResult.data || '',
        file_name: file.name,
        file_size: file.size,
        raw_text: rawText,
        parsed_data: parseResult.data || {},
        ats_score: 0,
        is_primary: resumes.length === 0,
        version_notes: '',
      });

      if (resume.data) {
        setResumes(prev => [resume.data!, ...prev]);
        return resume.data;
      }
      return null;
    } finally {
      setUploading(false);
    }
  }, [userId, resumes.length]);

  const setPrimary = useCallback(async (id: string) => {
    if (!userId) return;
    const { data } = await ResumeService.setPrimary(id, userId);
    if (data) setResumes(prev => prev.map(r => ({ ...r, is_primary: r.id === id })));
  }, [userId]);

  const deleteResume = useCallback(async (id: string) => {
    if (!userId) return;
    await ResumeService.deleteResume(id, userId);
    setResumes(prev => prev.filter(r => r.id !== id));
  }, [userId]);

  const primary = resumes.find(r => r.is_primary) || resumes[0] || null;

  return { resumes, primary, loading, error, uploading, refetch: load, upload, setPrimary, deleteResume };
}

// ════════════════════════════════════════════════════════════
// useJobs
// ════════════════════════════════════════════════════════════
export function useJobs(userId: string | null, initialFilters: JobFilters = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<JobFilters>(initialFilters);
  const [scoring, setScoring] = useState(false);
  const [scoreProgress, setScoreProgress] = useState({ current: 0, total: 0 });

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await JobService.listJobs(userId, filters);
    setJobs(data?.jobs || []);
    setTotal(data?.total || 0);
    setError(error);
    setLoading(false);
  }, [userId, filters]);

  useEffect(() => { load(); }, [load]);

  const updateFilters = useCallback((updates: Partial<JobFilters>) => {
    setFilters(prev => ({ ...prev, ...updates, page: 1 }));
  }, []);

  const toggleSave = useCallback(async (jobId: string) => {
    if (!userId) return;
    const { data: isSaved } = await JobService.toggleSave(userId, jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, is_saved: isSaved ?? j.is_saved } : j));
  }, [userId]);

  const deleteJob = useCallback(async (jobId: string) => {
    if (!userId) return;
    await JobService.deleteJob(jobId, userId);
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setTotal(t => t - 1);
  }, [userId]);

  const scoreAll = useCallback(async (profile: any, resume: Resume | null) => {
    if (!userId || !profile) return;
    setScoring(true);
    await AIMatchingEngine.batchScoreUnmatched(
      userId, profile, resume,
      (current, total) => setScoreProgress({ current, total })
    );
    setScoring(false);
    setScoreProgress({ current: 0, total: 0 });
    load();
  }, [userId, load]);

  return {
    jobs, total, loading, error, filters,
    refetch: load, updateFilters,
    toggleSave, deleteJob, scoreAll,
    scoring, scoreProgress,
  };
}

// ════════════════════════════════════════════════════════════
// useSavedJobs
// ════════════════════════════════════════════════════════════
export function useSavedJobs(userId: string | null) {
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await JobService.listSavedJobs(userId);
    setSavedJobs(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { savedJobs, loading, refetch: load };
}

// ════════════════════════════════════════════════════════════
// useRecommendedJobs
// ════════════════════════════════════════════════════════════
export function useRecommendedJobs(userId: string | null) {
  const [recommended, setRecommended] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await JobService.getRecommended(userId, 12);
    setRecommended(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { recommended, loading, refetch: load };
}

// ════════════════════════════════════════════════════════════
// useJobMatch
// ════════════════════════════════════════════════════════════
export function useJobMatch(userId: string | null, jobId: string | null) {
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !jobId) return;
    setLoading(true);
    const { data } = await JobService.getMatch(userId, jobId);
    setMatch(data);
    setLoading(false);
  }, [userId, jobId]);

  useEffect(() => { load(); }, [load]);

  const score = useCallback(async (profile: any, resume: Resume | null, job: Job) => {
    if (!userId) return;
    setScoring(true);
    const { data } = await AIMatchingEngine.scoreAndSave(userId, profile, resume, job);
    if (data) setMatch(data);
    setScoring(false);
  }, [userId]);

  return { match, loading, scoring, refetch: load, score };
}

// ════════════════════════════════════════════════════════════
// useApplications
// ════════════════════════════════════════════════════════════
export function useApplications(userId: string | null, initialFilters: ApplicationFilters = {}) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ApplicationFilters>(initialFilters);
  const [stats, setStats] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const [appsResult, statsResult] = await Promise.all([
      ApplicationService.listApplications(userId, filters),
      ApplicationService.getStats(userId),
    ]);
    setApplications(appsResult.data?.applications || []);
    setTotal(appsResult.data?.total || 0);
    setStats(statsResult.data || {});
    setError(appsResult.error);
    setLoading(false);
  }, [userId, filters]);

  useEffect(() => { load(); }, [load]);

  const updateFilters = useCallback((updates: Partial<ApplicationFilters>) => {
    setFilters(prev => ({ ...prev, ...updates, page: 1 }));
  }, []);

  const updateStatus = useCallback(async (id: string, status: ApplicationStatus) => {
    if (!userId) return;
    const { data } = await ApplicationService.updateStatus(id, userId, status);
    if (data) {
      setApplications(prev => prev.map(a => a.id === id ? data : a));
      load(); // Refresh stats
    }
  }, [userId, load]);

  const updateNotes = useCallback(async (id: string, notes: string) => {
    if (!userId) return;
    setApplications(prev => prev.map(a => a.id === id ? { ...a, notes } : a));
    await ApplicationService.updateNotes(id, userId, notes);
  }, [userId]);

  const deleteApplication = useCallback(async (id: string) => {
    if (!userId) return;
    await ApplicationService.deleteApplication(id, userId);
    setApplications(prev => prev.filter(a => a.id !== id));
    setTotal(t => t - 1);
  }, [userId]);

  const exportCSV = useCallback(async () => {
    if (!userId) return;
    const csv = await ApplicationService.exportCSV(userId);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [userId]);

  return {
    applications, total, loading, error, filters, stats,
    refetch: load, updateFilters,
    updateStatus, updateNotes, deleteApplication, exportCSV,
  };
}

// ════════════════════════════════════════════════════════════
// useNotifications
// ════════════════════════════════════════════════════════════
export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await NotificationService.list(userId);
    setNotifications(data || []);
    setUnreadCount((data || []).filter(n => !n.is_read).length);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const sub = NotificationService.subscribeToNew(userId, (n) => {
      setNotifications(prev => [n, ...prev]);
      setUnreadCount(c => c + 1);
    });
    return () => { sub.unsubscribe(); };
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    if (!userId) return;
    await NotificationService.markRead(id, userId);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await NotificationService.markAllRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [userId]);

  const deleteOne = useCallback(async (id: string) => {
    if (!userId) return;
    await NotificationService.delete(id, userId);
    setNotifications(prev => {
      const n = prev.find(x => x.id === id);
      if (n && !n.is_read) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(x => x.id !== id);
    });
  }, [userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    await NotificationService.clearAll(userId);
    setNotifications([]);
    setUnreadCount(0);
  }, [userId]);

  return {
    notifications, loading, unreadCount,
    refetch: load, markRead, markAllRead, deleteOne, clearAll,
  };
}

// ════════════════════════════════════════════════════════════
// useCareerInsights
// ════════════════════════════════════════════════════════════
export function useCareerInsights(userId: string | null) {
  const [insights, setInsights] = useState<CareerInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await AIMatchingEngine.getCareerInsights(userId);
    setInsights(data);
    setError(error);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const generate = useCallback(async (profile: any, jobs: Job[], applications: any[]) => {
    if (!userId || !profile) return;
    setGenerating(true);
    const { data, error } = await AIMatchingEngine.generateCareerInsights(userId, profile, jobs, applications);
    if (data) setInsights(data);
    setError(error);
    setGenerating(false);
  }, [userId]);

  return { insights, loading, generating, error, refetch: load, generate };
}

// ════════════════════════════════════════════════════════════
// useDashboardStats
// ════════════════════════════════════════════════════════════
export function useDashboardStats(userId: string | null) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.rpc('get_dashboard_stats', { p_user_id: userId });
    setStats(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(load, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [userId, load]);

  return { stats, loading, refetch: load };
}

// ════════════════════════════════════════════════════════════
// useAdminStats
// ════════════════════════════════════════════════════════════
export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, profilesRes, logsRes] = await Promise.all([
      supabase.rpc('get_admin_stats'),
      ProfileService.listAllProfiles(1, 100),
      ActivityService.listAll(200),
    ]);
    setStats(statsRes.data);
    setAllProfiles(profilesRes.data || []);
    setActivityLogs(logsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { stats, loading, allProfiles, activityLogs, refetch: load };
}

// ════════════════════════════════════════════════════════════
// useJobImport — CSV + bulk manual import
// ════════════════════════════════════════════════════════════
export function useJobImport(userId: string | null) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importCSV = useCallback(async (file: File) => {
    if (!userId) return;
    setImporting(true);
    setError(null);
    try {
      const text = await file.text();
      const rows = JobService.parseCSV(text);
      const { data, error } = await JobService.importFromCSV(userId, rows);
      setResult(data);
      setError(error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }, [userId]);

  const importManual = useCallback(async (jobs: any[]) => {
    if (!userId) return;
    setImporting(true);
    setError(null);
    const { data, error } = await JobService.bulkCreateJobs(userId, jobs);
    setResult({ imported: data?.length || 0, skipped: 0 });
    setError(error);
    setImporting(false);
  }, [userId]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { importing, result, error, importCSV, importManual, reset };
}

// ════════════════════════════════════════════════════════════
// useJobStats — for dashboard job widget
// ════════════════════════════════════════════════════════════
export function useJobStats(userId: string | null) {
  const [jobStats, setJobStats] = useState<{
    total: number; matched: number; saved: number; avgScore: number; highMatch: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await JobService.getJobStats(userId);
    setJobStats(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { jobStats, loading, refetch: load };
}
