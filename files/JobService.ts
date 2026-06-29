// ============================================================
// AutoApply AI — JobService
// src/services/JobService.ts
// ============================================================

import { supabase } from '../lib/supabase';
import {
  Job, JobInsert, JobUpdate, JobFilters, SavedJob,
  JobMatch, JobMatchInsert, ServiceResult, JobCSVRow, JobType
} from '../types/database';
import { ActivityService } from './ActivityService';

const PAGE_SIZE = 20;

export class JobService {
  // ── List jobs with filters ──────────────────────────────────
  static async listJobs(userId: string, filters: JobFilters = {}): Promise<ServiceResult<{ jobs: Job[]; total: number }>> {
    try {
      const page = filters.page || 1;
      const perPage = filters.per_page || PAGE_SIZE;
      const from = (page - 1) * perPage;

      let query = supabase
        .from('jobs')
        .select('*, match:job_matches!job_matches_job_id_fkey(*)', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters.remote !== undefined) query = query.eq('remote', filters.remote);
      if (filters.job_type) query = query.eq('job_type', filters.job_type);
      if (filters.experience_level) query = query.eq('experience_level', filters.experience_level);
      if (filters.salary_min) query = query.gte('salary_min', filters.salary_min);
      if (filters.saved_only) {
        const { data: saved } = await supabase.from('saved_jobs').select('job_id').eq('user_id', userId);
        const ids = (saved || []).map(s => s.job_id);
        if (ids.length === 0) return { data: { jobs: [], total: 0 }, error: null };
        query = query.in('id', ids);
      }

      const sortCol = filters.sort_by === 'match_score' ? 'created_at' : (filters.sort_by || 'posted_at');
      const sortDir = filters.sort_dir || 'desc';
      query = query.order(sortCol, { ascending: sortDir === 'asc' }).range(from, from + perPage - 1);

      const { data, error, count } = await query;
      if (error) return { data: null, error: error.message };

      let jobs: Job[] = (data || []).map((j: any) => ({
        ...j,
        match: Array.isArray(j.match) ? j.match.find((m: JobMatch) => m.user_id === userId) : j.match,
      }));

      // Filter by min match score if needed
      if (filters.min_match_score && filters.min_match_score > 0) {
        jobs = jobs.filter(j => (j.match?.overall_score || 0) >= filters.min_match_score!);
      }

      return { data: { jobs, total: count || 0 }, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get single job ──────────────────────────────────────────
  static async getJob(id: string, userId: string): Promise<ServiceResult<Job>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, match:job_matches(*)')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Create single job ───────────────────────────────────────
  static async createJob(job: JobInsert): Promise<ServiceResult<Job>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert(job)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Bulk create jobs (AI scan result) ──────────────────────
  static async bulkCreateJobs(userId: string, jobs: Omit<JobInsert, 'user_id'>[]): Promise<ServiceResult<Job[]>> {
    try {
      const batchId = crypto.randomUUID();
      const toInsert: JobInsert[] = jobs.map(j => ({
        ...j,
        user_id: userId,
        scan_batch_id: batchId,
      }));

      // Deduplicate by title+company
      const existing = await supabase
        .from('jobs')
        .select('title, company')
        .eq('user_id', userId);

      const existingSet = new Set((existing.data || []).map((j: any) => `${j.title}::${j.company}`));
      const fresh = toInsert.filter(j => !existingSet.has(`${j.title}::${j.company}`));

      if (fresh.length === 0) return { data: [], error: null };

      const { data, error } = await supabase
        .from('jobs')
        .insert(fresh)
        .select();

      if (error) return { data: null, error: error.message };

      await ActivityService.log(userId, 'job_scan', `Scan complete: ${fresh.length} new jobs added`, { batch_id: batchId });
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Import from CSV data ────────────────────────────────────
  static async importFromCSV(userId: string, rows: JobCSVRow[]): Promise<ServiceResult<{ imported: number; skipped: number }>> {
    try {
      const jobs: Omit<JobInsert, 'user_id'>[] = rows
        .filter(r => r.title && r.company)
        .map(r => ({
          title: r.title.trim(),
          company: r.company.trim(),
          location: r.location?.trim() || '',
          remote: r.remote?.toLowerCase() === 'true' || r.remote?.toLowerCase() === 'yes' || r.location?.toLowerCase().includes('remote') || false,
          job_type: (r.job_type?.toLowerCase().replace(' ', '_') as JobType) || 'full_time',
          salary_min: parseInt(r.salary_min || '0', 10),
          salary_max: parseInt(r.salary_max || '0', 10),
          salary_currency: 'USD',
          description: r.description || '',
          requirements: '',
          benefits: '',
          skills_required: r.skills ? r.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
          experience_level: 'mid' as const,
          apply_url: r.apply_url || '',
          source_url: '',
          source_name: 'csv_import',
          company_logo: '',
          company_size: '',
          industry: '',
          posted_at: new Date().toISOString(),
          expires_at: null,
          is_active: true,
          is_saved: false,
          scan_batch_id: null,
          raw_data: { csv_row: r },
        }));

      const result = await JobService.bulkCreateJobs(userId, jobs);
      if (result.error) return { data: null, error: result.error };

      const imported = result.data?.length || 0;
      const skipped = rows.length - imported;
      return { data: { imported, skipped }, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Parse CSV text ──────────────────────────────────────────
  static parseCSV(csvText: string): JobCSVRow[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row as JobCSVRow;
    });
  }

  // ── Update job ──────────────────────────────────────────────
  static async updateJob(id: string, userId: string, updates: JobUpdate): Promise<ServiceResult<Job>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Delete job ──────────────────────────────────────────────
  static async deleteJob(id: string, userId: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Save / unsave job ───────────────────────────────────────
  static async toggleSave(userId: string, jobId: string, notes = ''): Promise<ServiceResult<boolean>> {
    try {
      const { data: existing } = await supabase
        .from('saved_jobs')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .single();

      if (existing) {
        await supabase.from('saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId);
        await supabase.from('jobs').update({ is_saved: false }).eq('id', jobId).eq('user_id', userId);
        return { data: false, error: null };
      } else {
        await supabase.from('saved_jobs').insert({ user_id: userId, job_id: jobId, notes });
        await supabase.from('jobs').update({ is_saved: true }).eq('id', jobId).eq('user_id', userId);
        return { data: true, error: null };
      }
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── List saved jobs ─────────────────────────────────────────
  static async listSavedJobs(userId: string): Promise<ServiceResult<SavedJob[]>> {
    try {
      const { data, error } = await supabase
        .from('saved_jobs')
        .select('*, job:jobs(*)')
        .eq('user_id', userId)
        .order('saved_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get recommended (top match score, not yet applied) ──────
  static async getRecommended(userId: string, limit = 10): Promise<ServiceResult<Job[]>> {
    try {
      const { data, error } = await supabase
        .from('job_matches')
        .select('*, job:jobs(*)')
        .eq('user_id', userId)
        .eq('should_apply', true)
        .order('overall_score', { ascending: false })
        .limit(limit);

      if (error) return { data: null, error: error.message };

      // Filter out already applied
      const { data: applied } = await supabase
        .from('applications')
        .select('job_id')
        .eq('user_id', userId);
      const appliedIds = new Set((applied || []).map((a: any) => a.job_id));

      const jobs = (data || [])
        .map((m: any) => ({ ...m.job, match: m }))
        .filter((j: Job) => j && !appliedIds.has(j.id));

      return { data: jobs, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Upsert match score ──────────────────────────────────────
  static async upsertMatch(match: JobMatchInsert): Promise<ServiceResult<JobMatch>> {
    try {
      const { data, error } = await supabase
        .from('job_matches')
        .upsert(match, { onConflict: 'user_id,job_id' })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get match for job ───────────────────────────────────────
  static async getMatch(userId: string, jobId: string): Promise<ServiceResult<JobMatch>> {
    try {
      const { data, error } = await supabase
        .from('job_matches')
        .select('*')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return { data: null, error: null };
        return { data: null, error: error.message };
      }
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get all matches for user ────────────────────────────────
  static async listMatches(userId: string, minScore = 0): Promise<ServiceResult<JobMatch[]>> {
    try {
      let query = supabase
        .from('job_matches')
        .select('*')
        .eq('user_id', userId)
        .order('overall_score', { ascending: false });

      if (minScore > 0) query = query.gte('overall_score', minScore);

      const { data, error } = await query;
      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get jobs without match (needs scoring) ──────────────────
  static async getUnmatchedJobs(userId: string): Promise<ServiceResult<Job[]>> {
    try {
      const { data: matched } = await supabase
        .from('job_matches')
        .select('job_id')
        .eq('user_id', userId);

      const matchedIds = (matched || []).map((m: any) => m.job_id);

      let query = supabase
        .from('jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (matchedIds.length > 0) query = query.not('id', 'in', `(${matchedIds.join(',')})`);

      const { data, error } = await query.limit(50);
      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Dashboard job stats ─────────────────────────────────────
  static async getJobStats(userId: string): Promise<ServiceResult<{
    total: number; matched: number; saved: number; avgScore: number; highMatch: number;
  }>> {
    try {
      const [jobsRes, matchesRes, savedRes] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact' }).eq('user_id', userId),
        supabase.from('job_matches').select('overall_score').eq('user_id', userId),
        supabase.from('saved_jobs').select('id', { count: 'exact' }).eq('user_id', userId),
      ]);

      const scores = (matchesRes.data || []).map((m: any) => m.overall_score);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
      const highMatch = scores.filter((s: number) => s >= 80).length;

      return {
        data: {
          total: jobsRes.count || 0,
          matched: scores.length,
          saved: savedRes.count || 0,
          avgScore,
          highMatch,
        },
        error: null,
      };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }
}
