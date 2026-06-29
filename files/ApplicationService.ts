// ============================================================
// AutoApply AI — ApplicationService
// src/services/ApplicationService.ts
// ============================================================

import { supabase } from '../lib/supabase';
import {
  Application, ApplicationInsert, ApplicationUpdate,
  ApplicationFilters, ApplicationStatus, ServiceResult
} from '../types/database';
import { ActivityService } from './ActivityService';
import { NotificationService } from './NotificationService';

const PAGE_SIZE = 25;

export class ApplicationService {
  // ── List applications with filters ──────────────────────────
  static async listApplications(
    userId: string,
    filters: ApplicationFilters = {}
  ): Promise<ServiceResult<{ applications: Application[]; total: number }>> {
    try {
      const page = filters.page || 1;
      const perPage = filters.per_page || PAGE_SIZE;
      const from = (page - 1) * perPage;

      let query = supabase
        .from('applications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
      }

      const sortCol = filters.sort_by || 'applied_at';
      const sortDir = filters.sort_dir || 'desc';
      query = query.order(sortCol, { ascending: sortDir === 'asc' }).range(from, from + perPage - 1);

      const { data, error, count } = await query;
      if (error) return { data: null, error: error.message };
      return { data: { applications: data || [], total: count || 0 }, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get single application ──────────────────────────────────
  static async getApplication(id: string, userId: string): Promise<ServiceResult<Application>> {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Check duplicate ─────────────────────────────────────────
  static async isDuplicate(userId: string, jobId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('applications')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .single();
      return !!data;
    } catch {
      return false;
    }
  }

  // ── Create application ──────────────────────────────────────
  static async createApplication(application: ApplicationInsert): Promise<ServiceResult<Application>> {
    try {
      // Duplicate check
      if (application.job_id) {
        const isDup = await ApplicationService.isDuplicate(application.user_id, application.job_id);
        if (isDup) return { data: null, error: 'Already applied to this job' };
      }

      const { data, error } = await supabase
        .from('applications')
        .insert({
          ...application,
          submission_log: {
            ...((application.submission_log as any) || {}),
            created_at: new Date().toISOString(),
            duplicate_check: 'passed',
          }
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };

      // Log activity
      await ActivityService.log(
        application.user_id,
        'application_submit',
        `Applied to ${application.title} at ${application.company}`,
        { application_id: data.id, match_score: application.match_score }
      );

      // Send notification
      await NotificationService.create({
        user_id: application.user_id,
        type: 'application',
        title: 'Application Submitted',
        message: `Applied to ${application.title} at ${application.company}`,
        icon: '✅',
        is_read: false,
        action_url: `/applications/${data.id}`,
        metadata: { application_id: data.id },
      });

      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Update application ──────────────────────────────────────
  static async updateApplication(id: string, userId: string, updates: ApplicationUpdate): Promise<ServiceResult<Application>> {
    try {
      const statusTimestamps: Partial<Application> = {};

      if (updates.status === 'interview') statusTimestamps.interview_at = new Date().toISOString();
      if (updates.status === 'offer') statusTimestamps.offer_at = new Date().toISOString();
      if (updates.status === 'rejected') {
        statusTimestamps.rejected_at = new Date().toISOString();
        statusTimestamps.responded_at = new Date().toISOString();
      }
      if (updates.status === 'applied') statusTimestamps.responded_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('applications')
        .update({ ...updates, ...statusTimestamps, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) return { data: null, error: error.message };

      // Send status-based notifications
      if (updates.status === 'interview') {
        await NotificationService.create({
          user_id: userId,
          type: 'interview',
          title: '🎉 Interview Scheduled!',
          message: `You have an interview for ${data.title} at ${data.company}`,
          icon: '🗓️',
          is_read: false,
          action_url: `/interviews`,
          metadata: { application_id: id },
        });
      } else if (updates.status === 'offer') {
        await NotificationService.create({
          user_id: userId,
          type: 'offer',
          title: '🎉 Offer Received!',
          message: `You received an offer for ${data.title} at ${data.company}`,
          icon: '🎉',
          is_read: false,
          action_url: `/applications/${id}`,
          metadata: { application_id: id },
        });
      } else if (updates.status === 'rejected') {
        await NotificationService.create({
          user_id: userId,
          type: 'rejection',
          title: 'Application Update',
          message: `${data.company} has moved forward with other candidates`,
          icon: '📋',
          is_read: false,
          action_url: `/applications/${id}`,
          metadata: { application_id: id },
        });
      }

      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Update notes ─────────────────────────────────────────────
  static async updateNotes(id: string, userId: string, notes: string): Promise<ServiceResult<Application>> {
    return ApplicationService.updateApplication(id, userId, { notes });
  }

  // ── Update status ────────────────────────────────────────────
  static async updateStatus(id: string, userId: string, status: ApplicationStatus): Promise<ServiceResult<Application>> {
    return ApplicationService.updateApplication(id, userId, { status });
  }

  // ── Delete application ───────────────────────────────────────
  static async deleteApplication(id: string, userId: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get stats for analytics ──────────────────────────────────
  static async getStats(userId: string, since?: string): Promise<ServiceResult<Record<string, number>>> {
    try {
      let query = supabase
        .from('applications')
        .select('status')
        .eq('user_id', userId);

      if (since) query = query.gte('applied_at', since);

      const { data, error } = await query;
      if (error) return { data: null, error: error.message };

      const stats: Record<string, number> = {
        total: 0, pending: 0, applied: 0, interview: 0, offer: 0, rejected: 0, withdrawn: 0
      };

      (data || []).forEach((a: any) => {
        stats.total++;
        stats[a.status] = (stats[a.status] || 0) + 1;
      });

      const submitted = stats.applied + stats.interview + stats.offer + stats.rejected;
      stats.response_rate = submitted > 0
        ? Math.round(((stats.interview + stats.offer) / submitted) * 100)
        : 0;

      return { data: stats, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Count today's applications ───────────────────────────────
  static async getTodayCount(userId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('applications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('applied_at', today.toISOString());
      return count || 0;
    } catch {
      return 0;
    }
  }

  // ── Export as CSV ────────────────────────────────────────────
  static async exportCSV(userId: string): Promise<string> {
    const { data } = await ApplicationService.listApplications(userId, { per_page: 10000 });
    const apps = data?.applications || [];

    const headers = ['Title', 'Company', 'Location', 'Status', 'Match Score', 'Applied At', 'Notes', 'URL'];
    const rows = apps.map(a => [
      a.title, a.company, a.location, a.status,
      a.match_score, new Date(a.applied_at).toLocaleDateString(),
      a.notes.replace(/,/g, ';'), a.apply_url,
    ]);

    return [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  }
}
