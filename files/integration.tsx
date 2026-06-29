// ============================================================
// AutoApply AI — Phase 2 Integration Bridge
// src/lib/integration.tsx
//
// HOW TO WIRE PHASE 2 INTO YOUR EXISTING AutoApplyAI.jsx
// Copy this file into your project and follow the steps.
// ============================================================

/**
 * STEP 1 — Install dependencies
 *
 *   npm install @supabase/supabase-js @supabase/ssr
 *
 * STEP 2 — Create .env.local
 *
 *   Copy .env.example → .env.local and fill in all values
 *
 * STEP 3 — Run Supabase migration
 *
 *   supabase db push  (if using Supabase CLI)
 *   — OR —
 *   Paste supabase/migrations/001_initial_schema.sql into
 *   the Supabase SQL editor and click Run
 *
 * STEP 4 — Replace the Root component in AutoApplyAI.jsx
 *   with the SupabaseRoot below (or wrap it).
 *
 * STEP 5 — Replace individual views using the mapping below.
 */

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useMigration } from './migration';
import { useAuth, useProfile, useResumes, useApplications, useNotifications, useDashboardStats, useJobStats } from '../hooks';

// ── Phase 2 view imports ──────────────────────────────────────
// import { JobDiscoveryView }       from '../components/jobs/JobDiscovery';
// import { CareerInsightsView }     from '../components/career/CareerInsights';
// import { AdminPanelView }         from '../components/admin/AdminPanel';
// import { DashboardStatsRow,
//          TopRecommendedWidget,
//          CareerInsightsSnapshotWidget,
//          MigrationBanner }        from '../components/DashboardExtensions';

// ════════════════════════════════════════════════════════════
// SUPABASE AUTH WRAPPER
// Replace the existing AuthScreen and session logic with this
// ════════════════════════════════════════════════════════════
export function SupabaseAuthBridge({ children, onAuthChange }: {
  children: React.ReactNode;
  onAuthChange: (userId: string | null) => void;
}) {
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      onAuthChange(session?.user?.id ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      onAuthChange(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, [onAuthChange]);

  return <>{children}</>;
}

// ════════════════════════════════════════════════════════════
// SUPABASE LOGIN/SIGNUP
// Drop-in replacement for the auth forms in AutoApplyAI.jsx
// ════════════════════════════════════════════════════════════
export async function supabaseSignUp(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  return { user: data.user, error: error?.message || null };
}

export async function supabaseSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data.user, session: data.session, error: error?.message || null };
}

export async function supabaseSignOut() {
  await supabase.auth.signOut();
}

export async function supabaseResetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });
  return { error: error?.message || null };
}

// ════════════════════════════════════════════════════════════
// CONTEXT BRIDGE
// Wraps your existing AppCtx with Supabase-backed data
// ════════════════════════════════════════════════════════════
export function usePhase2Context(userId: string | null) {
  const { profile, loading: profileLoading, update: updateProfile } = useProfile(userId);
  const { resumes, primary: primaryResume, upload: uploadResume } = useResumes(userId);
  const { applications, updateStatus, updateNotes, deleteApplication, stats: appStats } = useApplications(userId);
  const { notifications, unreadCount, markRead, markAllRead, deleteOne: deleteNotif, clearAll: clearAllNotifs } = useNotifications(userId);
  const { stats: dashStats } = useDashboardStats(userId);
  const { jobStats } = useJobStats(userId);

  // Migration
  const { migrating, migrationResult, needsMigration, checkMigration, runMigration } = useMigration(
    userId, profile?.email || ''
  );

  useEffect(() => {
    if (userId) checkMigration();
  }, [userId, checkMigration]);

  return {
    // Profile
    profile,
    profileLoading,
    updateProfile,

    // Resumes
    resumes,
    primaryResume,
    uploadResume,

    // Applications
    applications,
    appStats,
    updateStatus,
    updateNotes,
    deleteApplication,

    // Notifications
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotif,
    clearAllNotifs,

    // Dashboard stats (from Supabase RPC)
    dashStats,
    jobStats,

    // Migration
    migrating,
    migrationResult,
    needsMigration,
    runMigration,
  };
}

// ════════════════════════════════════════════════════════════
// VIEW REPLACEMENT MAP
// Shows which Phase 2 component replaces which existing view
// ════════════════════════════════════════════════════════════
export const VIEW_REPLACEMENT_MAP = {
  /**
   * EXISTING VIEW          → PHASE 2 REPLACEMENT
   * ─────────────────────────────────────────────
   * DashboardView          → Keep existing + add:
   *                            <DashboardStatsRow userId={userId} />
   *                            <TopRecommendedWidget ... />
   *                            <CareerInsightsSnapshotWidget ... />
   *                            <MigrationBanner ... /> (if needed)
   *
   * JobDiscoveryView       → <JobDiscoveryView userId={...} profile={...}
   *                            primaryResume={...} applications={...}
   *                            onApply={...} />
   *
   * AdminView              → <AdminPanelView />
   *
   * (new) Career Insights  → <CareerInsightsView userId={...} profile={...} />
   *       Add "career" to NAV_ITEMS: { id:'career', label:'Career AI', icon:'🎓' }
   *
   * Auth (login/signup)    → Replace DB.get/set calls with:
   *                            supabaseSignIn / supabaseSignUp / supabaseSignOut
   *
   * Notifications          → Replace window.storage with useNotifications hook
   *
   * Applications           → Replace window.storage with useApplications hook
   *
   * Resume Upload          → Replace DB.set with uploadResume() from useResumes
   */
};

// ════════════════════════════════════════════════════════════
// QUICK INTEGRATION — Minimal changes to AutoApplyAI.jsx
// ════════════════════════════════════════════════════════════
/**
 * MINIMAL INTEGRATION STEPS (keep existing UI, just swap data layer):
 *
 * 1. In Root component, add Supabase session check:
 *
 *    useEffect(() => {
 *      supabase.auth.getSession().then(({ data: { session } }) => {
 *        if (session?.user) {
 *          // Load user data from Supabase instead of window.storage
 *          loadFromSupabase(session.user.id);
 *        }
 *      });
 *    }, []);
 *
 * 2. Replace every DB.set(...) call with the equivalent service:
 *
 *    DB.set(`profile:${userId}`, data)
 *    → ProfileService.upsertProfile(userId, data)
 *
 *    DB.set(`applications:${userId}`, apps)
 *    → ApplicationService.createApplication(app) for new ones
 *    → ApplicationService.updateApplication(id, userId, updates) for updates
 *
 *    DB.set(`jobs:${userId}`, jobs)
 *    → JobService.bulkCreateJobs(userId, jobs)
 *
 *    DB.set(`notifications:${userId}`, notifs)
 *    → NotificationService.create(notif)
 *
 * 3. Replace DB.get(...) with service reads:
 *
 *    DB.get(`profile:${userId}`)
 *    → ProfileService.getProfile(userId)
 *
 *    DB.get(`applications:${userId}`)
 *    → ApplicationService.listApplications(userId)
 *
 * 4. In App() export, add SupabaseAuthBridge:
 *
 *    export default function App() {
 *      return (
 *        <ToastProvider>
 *          <SupabaseAuthBridge onAuthChange={...}>
 *            <style>{globalCSS}</style>
 *            <Root />
 *          </SupabaseAuthBridge>
 *        </ToastProvider>
 *      );
 *    }
 *
 * 5. Add new NAV items in AutoApplyAI.jsx:
 *
 *    { id: 'career', label: 'Career AI', icon: '🎓' },
 *
 *    And in the view switcher:
 *    {view === 'career' && <CareerInsightsView userId={userId} profile={profile} />}
 */

// ════════════════════════════════════════════════════════════
// STORAGE ADAPTER
// Backward-compatible adapter that routes calls to Supabase
// Use this to incrementally migrate without rewriting everything
// ════════════════════════════════════════════════════════════
export class StorageAdapter {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async get(key: string): Promise<any> {
    const uid = this.userId;

    if (key === `profile:${uid}`) {
      const { ProfileService } = await import('../services/ProfileService');
      const { data } = await ProfileService.getProfile(uid);
      return data;
    }

    if (key === `applications:${uid}`) {
      const { ApplicationService } = await import('../services/ApplicationService');
      const { data } = await ApplicationService.listApplications(uid, { per_page: 500 });
      return data?.applications || [];
    }

    if (key === `jobs:${uid}`) {
      const { JobService } = await import('../services/JobService');
      const { data } = await JobService.listJobs(uid, { per_page: 200 });
      return data?.jobs || [];
    }

    if (key === `notifications:${uid}`) {
      const { NotificationService } = await import('../services/NotificationService');
      const { data } = await NotificationService.list(uid);
      return data || [];
    }

    if (key.startsWith(`resume:${uid}`)) {
      const { ResumeService } = await import('../services/ResumeService');
      const { data } = await ResumeService.getPrimaryResume(uid);
      return data;
    }

    // Fall back to window.storage for unknown keys
    try {
      const r = await (window as any).storage?.get(key);
      return r ? JSON.parse(r.value) : null;
    } catch { return null; }
  }

  async set(key: string, value: any): Promise<boolean> {
    const uid = this.userId;

    if (key === `profile:${uid}`) {
      const { ProfileService } = await import('../services/ProfileService');
      const { error } = await ProfileService.upsertProfile(uid, value);
      return !error;
    }

    if (key === `preferences:${uid}`) {
      const { ProfileService } = await import('../services/ProfileService');
      const { error } = await ProfileService.updateProfile(uid, {
        automation_mode: value.autoMode,
        daily_target: value.dailyTarget,
        match_threshold: value.matchThreshold,
        prefer_remote: value.preferRemote,
        target_roles: value.targetRoles,
        target_locations: value.targetLocations,
        email_notifications: value.emailNotifications,
      });
      return !error;
    }

    if (key === `notifications:${uid}`) {
      // Notifications are written individually, not as arrays
      return true;
    }

    // Fall back to window.storage
    try {
      await (window as any).storage?.set(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }
}
