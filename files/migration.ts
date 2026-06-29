// ============================================================
// AutoApply AI — Data Migration Script
// src/lib/migration.ts
// Migrates all window.storage data → Supabase
// Run once per user after they log in with Supabase auth
// ============================================================

import { supabase } from './supabase';
import { ProfileService } from '../services/ProfileService';
import { ResumeService } from '../services/ResumeService';
import { ApplicationService } from '../services/ApplicationService';
import { NotificationService } from '../services/NotificationService';
import { JobService } from '../services/JobService';

// ── Storage bridge (same as AutoApplyAI.jsx DB object) ────────
const legacyDB = {
  async get(key: string): Promise<any> {
    try {
      const r = await (window as any).storage?.get(key);
      return r ? JSON.parse(r.value) : null;
    } catch { return null; }
  },
  async list(prefix: string): Promise<string[]> {
    try {
      const r = await (window as any).storage?.list(prefix);
      return r?.keys || [];
    } catch { return []; }
  }
};

export interface MigrationResult {
  success: boolean;
  profile: boolean;
  resumes: boolean;
  applications: number;
  jobs: number;
  notifications: number;
  coverLetters: number;
  errors: string[];
}

// ── Main migration function ────────────────────────────────────
export async function migrateUserData(userId: string, userEmail: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false, profile: false, resumes: false,
    applications: 0, jobs: 0, notifications: 0, coverLetters: 0, errors: []
  };

  try {
    // ── 1. Migrate Profile ───────────────────────────────────
    const legacyProfile = await legacyDB.get(`profile:${userId}`);
    const legacyPrefs = await legacyDB.get(`preferences:${userId}`);

    if (legacyProfile || legacyPrefs) {
      const profileData = {
        user_id: userId,
        name: legacyProfile?.name || '',
        email: legacyProfile?.email || userEmail,
        phone: legacyProfile?.phone || '',
        location: legacyProfile?.location || '',
        linkedin_url: legacyProfile?.linkedin || '',
        github_url: legacyProfile?.github || '',
        portfolio_url: legacyProfile?.portfolio || '',
        summary: legacyProfile?.summary || '',
        skills: legacyProfile?.skills || [],
        target_roles: legacyPrefs?.targetRoles || [],
        target_locations: legacyPrefs?.targetLocations || [],
        salary_min: legacyPrefs?.salaryMin || 0,
        salary_max: legacyPrefs?.salaryMax || 0,
        automation_mode: (legacyPrefs?.autoMode || 'manual') as 'manual' | 'auto',
        daily_target: legacyPrefs?.dailyTarget || 20,
        match_threshold: legacyPrefs?.matchThreshold || 75,
        prefer_remote: legacyPrefs?.preferRemote ?? true,
        email_notifications: legacyPrefs?.emailNotifications ?? true,
        setup_complete: true,
      };

      const { error } = await ProfileService.upsertProfile(userId, profileData);
      if (error) result.errors.push(`Profile: ${error}`);
      else result.profile = true;
    }

    // ── 2. Migrate Resume ────────────────────────────────────
    const legacyResume = await legacyDB.get(`resume:${userId}:original`);
    if (legacyResume) {
      const { error } = await ResumeService.createResume({
        user_id: userId,
        name: legacyResume.name || 'Imported Resume',
        file_url: '',
        file_name: legacyResume.name || 'resume.pdf',
        file_size: 0,
        raw_text: legacyResume.text || '',
        parsed_data: legacyResume.parsed || {},
        ats_score: 0,
        is_primary: true,
        version_notes: 'Migrated from local storage',
      });
      if (error) result.errors.push(`Resume: ${error}`);
      else result.resumes = true;
    }

    // Migrate resume versions
    const legacyVersions = await legacyDB.get(`resumeVersions:${userId}`);
    if (Array.isArray(legacyVersions)) {
      for (const version of legacyVersions) {
        const p = version.profile;
        if (!p) continue;
        await ResumeService.createResume({
          user_id: userId,
          name: version.name || 'Resume Version',
          file_url: '',
          file_name: `${version.name}.txt`,
          file_size: 0,
          raw_text: [
            p.summary || '',
            'Skills: ' + (p.skills || []).join(', '),
            ...(p.experience || []).map((e: any) => `${e.title} at ${e.company} (${e.duration})`),
          ].join('\n'),
          parsed_data: {
            name: p.name, email: p.email, skills: p.skills,
            experience: p.experience, education: p.education,
          },
          ats_score: 0,
          is_primary: false,
          version_notes: `Migrated version from ${new Date(version.createdAt).toLocaleDateString()}`,
        });
      }
    }

    // ── 3. Migrate Applications ──────────────────────────────
    const legacyApps = await legacyDB.get(`applications:${userId}`);
    if (Array.isArray(legacyApps)) {
      for (const app of legacyApps) {
        try {
          const statusMap: Record<string, string> = {
            pending: 'pending', applied: 'applied', interview: 'interview',
            offer: 'offer', rejected: 'rejected', withdrawn: 'withdrawn',
          };
          const { error } = await supabase.from('applications').insert({
            user_id: userId,
            job_id: null,
            resume_id: null,
            title: app.title || '',
            company: app.company || '',
            location: app.location || '',
            salary: app.salary || '',
            apply_url: app.url || '',
            source: app.source || '',
            match_score: app.matchScore || 0,
            status: statusMap[app.status] || 'applied',
            cover_letter: app.coverLetter || '',
            screening_answers: app.screeningAnswers || {},
            optimization_data: app.optimization || {},
            submission_log: app.submissionLog || {},
            notes: app.notes || '',
            applied_at: app.appliedAt || new Date().toISOString(),
          });
          if (!error) result.applications++;
        } catch (e: any) {
          result.errors.push(`App ${app.title}: ${e.message}`);
        }
      }
    }

    // ── 4. Migrate Jobs ──────────────────────────────────────
    const legacyJobs = await legacyDB.get(`jobs:${userId}`);
    if (Array.isArray(legacyJobs)) {
      const jobsToInsert = legacyJobs.map((j: any) => ({
        user_id: userId,
        title: j.title || '',
        company: j.company || '',
        location: j.location || '',
        remote: j.remote || false,
        job_type: 'full_time' as const,
        salary_min: 0,
        salary_max: 0,
        salary_currency: 'USD',
        description: j.description || '',
        requirements: '',
        benefits: '',
        skills_required: j.skills || [],
        experience_level: 'mid' as const,
        apply_url: j.url || '',
        source_url: j.url || '',
        source_name: j.source || 'imported',
        company_logo: '',
        company_size: '',
        industry: '',
        posted_at: j.scannedAt || new Date().toISOString(),
        expires_at: null,
        is_active: true,
        is_saved: false,
        scan_batch_id: null,
        raw_data: { legacy: j },
      }));

      if (jobsToInsert.length > 0) {
        const { data, error } = await supabase.from('jobs').insert(jobsToInsert).select('id');
        if (error) result.errors.push(`Jobs: ${error.message}`);
        else result.jobs = data?.length || 0;
      }
    }

    // ── 5. Migrate Notifications ─────────────────────────────
    const legacyNotifs = await legacyDB.get(`notifications:${userId}`);
    if (Array.isArray(legacyNotifs)) {
      for (const n of legacyNotifs.slice(0, 50)) { // Cap at 50
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: n.type || 'system',
            title: n.message?.slice(0, 60) || 'Notification',
            message: n.message || '',
            icon: n.icon || '🔔',
            is_read: n.read || false,
            action_url: '',
            metadata: {},
            created_at: n.createdAt || new Date().toISOString(),
          });
          result.notifications++;
        } catch { /* skip invalid */ }
      }
    }

    // ── 6. Migrate Cover Letters ─────────────────────────────
    const legacyCLs = await legacyDB.get(`coverLetters:${userId}`);
    if (Array.isArray(legacyCLs)) {
      for (const cl of legacyCLs) {
        try {
          await supabase.from('cover_letters').insert({
            user_id: userId,
            job_id: null,
            job_title: cl.jobTitle || '',
            company: cl.company || '',
            content: cl.letter || '',
            is_template: false,
            template_name: '',
            word_count: (cl.letter || '').split(/\s+/).length,
          });
          result.coverLetters++;
        } catch { /* skip */ }
      }
    }

    result.success = true;
    return result;

  } catch (e: any) {
    result.errors.push(`Fatal: ${e.message}`);
    return result;
  }
}

// ── Migration status check ────────────────────────────────────
export async function isMigrationNeeded(userId: string): Promise<boolean> {
  try {
    // Check if user already has data in Supabase
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (data) return false; // Already migrated

    // Check if legacy data exists
    const legacyProfile = await legacyDB.get(`profile:${userId}`);
    return !!legacyProfile;
  } catch {
    return false;
  }
}

// ── Migration UI hook ─────────────────────────────────────────
import { useState, useCallback } from 'react';

export function useMigration(userId: string | null, userEmail: string) {
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [needsMigration, setNeedsMigration] = useState<boolean | null>(null);

  const checkMigration = useCallback(async () => {
    if (!userId) return;
    const needed = await isMigrationNeeded(userId);
    setNeedsMigration(needed);
  }, [userId]);

  const runMigration = useCallback(async () => {
    if (!userId) return;
    setMigrating(true);
    const result = await migrateUserData(userId, userEmail);
    setMigrationResult(result);
    setNeedsMigration(false);
    setMigrating(false);
  }, [userId, userEmail]);

  return { migrating, migrationResult, needsMigration, checkMigration, runMigration };
}
