// ============================================================
// AutoApply AI — ResumeService
// src/services/ResumeService.ts
// ============================================================

import { supabase } from '../lib/supabase';
import { Resume, ResumeInsert, ResumeUpdate, ParsedResumeData, ServiceResult } from '../types/database';
import { ActivityService } from './ActivityService';

export class ResumeService {
  // ── List all resumes for user ───────────────────────────────
  static async listResumes(userId: string): Promise<ServiceResult<Resume[]>> {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return { data: null, error: error.message };
      return { data: data || [], error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Get primary resume ──────────────────────────────────────
  static async getPrimaryResume(userId: string): Promise<ServiceResult<Resume>> {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
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

  // ── Get single resume ───────────────────────────────────────
  static async getResume(id: string, userId: string): Promise<ServiceResult<Resume>> {
    try {
      const { data, error } = await supabase
        .from('resumes')
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

  // ── Upload file to Supabase Storage ────────────────────────
  static async uploadFile(userId: string, file: File): Promise<ServiceResult<string>> {
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${timestamp}_${safeName}`;

      const { error } = await supabase.storage
        .from('resumes')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) return { data: null, error: error.message };

      const { data } = await supabase.storage.from('resumes').createSignedUrl(path, 3600 * 24 * 365);
      return { data: data?.signedUrl || path, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Create resume record ────────────────────────────────────
  static async createResume(resume: ResumeInsert): Promise<ServiceResult<Resume>> {
    try {
      // If first resume, make it primary
      const { data: existing } = await supabase
        .from('resumes')
        .select('id')
        .eq('user_id', resume.user_id)
        .limit(1);

      const isPrimary = !existing || existing.length === 0;

      const { data, error } = await supabase
        .from('resumes')
        .insert({ ...resume, is_primary: isPrimary })
        .select()
        .single();

      if (error) return { data: null, error: error.message };

      await ActivityService.log(resume.user_id, 'resume_upload', `Resume uploaded: ${resume.name}`);
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Update resume ───────────────────────────────────────────
  static async updateResume(id: string, userId: string, updates: ResumeUpdate): Promise<ServiceResult<Resume>> {
    try {
      const { data, error } = await supabase
        .from('resumes')
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

  // ── Set as primary ──────────────────────────────────────────
  static async setPrimary(id: string, userId: string): Promise<ServiceResult<Resume>> {
    try {
      // Unset all primary
      await supabase
        .from('resumes')
        .update({ is_primary: false })
        .eq('user_id', userId);

      // Set new primary
      const { data, error } = await supabase
        .from('resumes')
        .update({ is_primary: true, updated_at: new Date().toISOString() })
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

  // ── Delete resume ───────────────────────────────────────────
  static async deleteResume(id: string, userId: string): Promise<ServiceResult<null>> {
    try {
      const { data: resume } = await ResumeService.getResume(id, userId);

      // Delete from storage if has file
      if (resume?.file_url) {
        const path = resume.file_url.split('/').slice(-2).join('/');
        await supabase.storage.from('resumes').remove([`${userId}/${path}`]);
      }

      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) return { data: null, error: error.message };
      return { data: null, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }

  // ── Save parsed data ────────────────────────────────────────
  static async saveParsedData(
    id: string,
    userId: string,
    parsedData: ParsedResumeData,
    rawText: string,
    atsScore: number
  ): Promise<ServiceResult<Resume>> {
    return ResumeService.updateResume(id, userId, {
      parsed_data: parsedData,
      raw_text: rawText,
      ats_score: atsScore,
    });
  }

  // ── Get signed download URL ─────────────────────────────────
  static async getDownloadUrl(userId: string, fileName: string): Promise<ServiceResult<string>> {
    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .createSignedUrl(`${userId}/${fileName}`, 3600);

      if (error) return { data: null, error: error.message };
      return { data: data.signedUrl, error: null };
    } catch (e: any) {
      return { data: null, error: e.message };
    }
  }
}
