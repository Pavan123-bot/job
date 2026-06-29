// ============================================================
// AutoApply AI — Supabase Client
// src/lib/supabase.ts
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// Server-side admin client (never expose to browser)
export const createAdminClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

// Helper: get current user id or throw
export const getAuthUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return user.id;
};

// Helper: get current session
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
};
