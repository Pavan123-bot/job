// ============================================================
// AutoApply AI — ActivityService (standalone)
// src/services/ActivityService.ts
// ============================================================

import { supabase } from '../lib/supabase';
import { ActivityType } from '../types/database';

export class ActivityService {
  // ── Log an activity ─────────────────────────────────────────
  static async log(
    userId: string,
    type: ActivityType,
    description: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        type,
        description,
        metadata,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'server',
      });
    } catch {
      // Non-critical — never throw from logger
    }
  }

  // ── List activity for a user ────────────────────────────────
  static async list(
    userId: string,
    limit = 100
  ): Promise<{ data: any[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Admin: list all activity across users ───────────────────
  static async listAll(
    limit = 200
  ): Promise<{ data: any[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          profile:profiles(name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Count AI calls for a user (rate limiting) ───────────────
  static async countAICalls(userId: string, sinceMinutes = 60): Promise<number> {
    try {
      const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', 'ai_call')
        .gte('created_at', since);
      return count || 0;
    } catch {
      return 0;
    }
  }

  // ── Get activity summary for dashboard ──────────────────────
  static async getSummary(userId: string): Promise<{
    totalLogins: number;
    totalAICalls: number;
    totalScans: number;
    totalExports: number;
    lastLogin: string | null;
  }> {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const logs = data || [];
      return {
        totalLogins:  logs.filter(l => l.type === 'login').length,
        totalAICalls: logs.filter(l => l.type === 'ai_call').length,
        totalScans:   logs.filter(l => l.type === 'job_scan').length,
        totalExports: logs.filter(l => l.type === 'export').length,
        lastLogin:    logs.find(l => l.type === 'login')?.created_at || null,
      };
    } catch {
      return { totalLogins: 0, totalAICalls: 0, totalScans: 0, totalExports: 0, lastLogin: null };
    }
  }
}
