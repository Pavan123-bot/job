// ============================================================
// AutoApply AI — ProfileService
// src/services/ProfileService.ts
// ============================================================

import { supabase } from '../lib/supabase';
import { Profile, ProfileInsert, ProfileUpdate, ServiceResult } from '../types/database';

export class ProfileService {
  // ── Get profile by user id ──────────────────────────────────
  static async getProfile(userId: string): Promise<ServiceResult<Profile>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return { data: null, error: null }; // Not found is ok
        return { data: null, error: error.message };
      }
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Create profile ──────────────────────────────────────────
  static async createProfile(profile: ProfileInsert): Promise<ServiceResult<Profile>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert(profile)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Upsert profile ──────────────────────────────────────────
  static async upsertProfile(userId: string, updates: ProfileUpdate): Promise<ServiceResult<Profile>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Update profile ──────────────────────────────────────────
  static async updateProfile(userId: string, updates: ProfileUpdate): Promise<ServiceResult<Profile>> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      await ActivityService.log(userId, 'profile_update', 'Profile updated');
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Update skills only ──────────────────────────────────────
  static async updateSkills(userId: string, skills: string[]): Promise<ServiceResult<Profile>> {
    return ProfileService.updateProfile(userId, { skills });
  }

  // ── Update automation settings ──────────────────────────────
  static async updateAutomationSettings(
    userId: string,
    settings: Pick<Profile, 'automation_mode' | 'daily_target' | 'match_threshold' | 'prefer_remote'>
  ): Promise<ServiceResult<Profile>> {
    return ProfileService.updateProfile(userId, settings);
  }

  // ── Mark setup complete ─────────────────────────────────────
  static async markSetupComplete(userId: string): Promise<ServiceResult<Profile>> {
    return ProfileService.updateProfile(userId, { setup_complete: true });
  }

  // ── Upload avatar ───────────────────────────────────────────
  static async uploadAvatar(userId: string, file: File): Promise<ServiceResult<string>> {
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) return { data: null, error: uploadError.message };

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await ProfileService.updateProfile(userId, { avatar_url: data.publicUrl });

      return { data: data.publicUrl, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Admin: list all profiles (paginated) ────────────────────
  static async listAllProfiles(page = 1, perPage = 50): Promise<ServiceResult<Profile[]>> {
    try {
      const from = (page - 1) * perPage;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + perPage - 1);

      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }
}

// ── Import ActivityService inline to avoid circular deps ──────
import { ActivityService } from './ActivityService';
