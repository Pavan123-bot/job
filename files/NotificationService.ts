// ============================================================
// AutoApply AI — NotificationService
// src/services/NotificationService.ts
// ============================================================

import { supabase } from '../lib/supabase';
import { Notification, NotificationInsert, NotificationType, ServiceResult } from '../types/database';

export class NotificationService {
  // ── List notifications ──────────────────────────────────────
  static async list(userId: string, limit = 50): Promise<ServiceResult<Notification[]>> {
    try {
      const { data, error } = await supabase
        .from('notifications')
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

  // ── Unread count ────────────────────────────────────────────
  static async unreadCount(userId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_read', false);
      return count || 0;
    } catch {
      return 0;
    }
  }

  // ── Create notification ─────────────────────────────────────
  static async create(notification: NotificationInsert): Promise<ServiceResult<Notification>> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Mark single as read ─────────────────────────────────────
  static async markRead(id: string, userId: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Mark all as read ────────────────────────────────────────
  static async markAllRead(userId: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Delete notification ─────────────────────────────────────
  static async delete(id: string, userId: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Clear all ───────────────────────────────────────────────
  static async clearAll(userId: string): Promise<ServiceResult<null>> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Subscribe to real-time notifications ────────────────────
  static subscribeToNew(userId: string, onNew: (n: Notification) => void) {
    return supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => onNew(payload.new as Notification)
      )
      .subscribe();
  }
}


// ============================================================
// AutoApply AI — ActivityService
// src/services/ActivityService.ts (exported from same file)
// ============================================================

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
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      });
    } catch {
      // Non-critical — never throw
    }
  }

  // ── List activity logs ──────────────────────────────────────
  static async list(userId: string, limit = 100): Promise<{ data: any[] | null; error: string | null }> {
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

  // ── Admin: list all activity ────────────────────────────────
  static async listAll(limit = 200): Promise<{ data: any[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profile:profiles(name, email)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }
}
