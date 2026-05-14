/**
 * Secure Authentication Service for Reach AI
 * 
 * This module provides Supabase Auth integration to replace
 * the legacy plaintext password authentication.
 * 
 * Usage:
 * 1. Run db/migration_auth.sql in Supabase
 * 2. Run db/rls_policies.sql in Supabase  
 * 3. Import and use these functions instead of legacy auth
 */

import { supabase } from './supabase';
import { User, UserRole } from '../types';

// ==========================================
// AUTH STATE MANAGEMENT
// ==========================================

export interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribe to auth state changes
 * Use this in App.tsx to handle login/logout state
 */
export const onAuthStateChange = (callback: (state: AuthState) => void) => {
  // Initial state
  callback({ user: null, session: null, loading: true, error: null });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session?.user) {
        try {
          // Fetch user profile from app_users
          const profile = await getUserProfile();
          callback({
            user: profile,
            session,
            loading: false,
            error: null
          });
        } catch (err: any) {
          callback({
            user: null,
            session,
            loading: false,
            error: err.message
          });
        }
      } else {
        callback({
          user: null,
          session: null,
          loading: false,
          error: null
        });
      }
    }
  );

  return () => subscription.unsubscribe();
};

// ==========================================
// AUTHENTICATION METHODS
// ==========================================

/**
 * Sign in with email and password
 * Replaces the legacy plaintext password check
 */
export const signIn = async (email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Login failed - no user returned');
  }

  // Get user profile from app_users
  const profile = await getUserProfile();

  if (!profile) {
    throw new Error('User profile not found');
  }

  if (!profile.isActive) {
    await supabase.auth.signOut();
    throw new Error('Account is deactivated. Contact admin.');
  }

  return profile;
};

/**
 * Sign up new user
 * Creates auth account and triggers profile creation
 */
export const signUp = async (
  email: string,
  password: string,
  metadata?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    country?: string;
    role?: string;
    companyName?: string;
  }
): Promise<{ user: User | null; needsEmailConfirmation: boolean }> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata // Stored in auth.users.raw_user_meta_data
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  // Check if email confirmation is required
  if (data.user && !data.session) {
    return { user: null, needsEmailConfirmation: true };
  }

  // If auto-confirmed, get the profile
  if (data.user && data.session) {
    const profile = await getUserProfile();
    return { user: profile, needsEmailConfirmation: false };
  }

  return { user: null, needsEmailConfirmation: true };
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }

  // Clear any legacy localStorage items
  localStorage.removeItem('rg_v2_user');
  localStorage.removeItem('rg_v2_company');
  localStorage.removeItem('rg_v2_view');
};

/**
 * Get current session
 */
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session;
};

/**
 * Get current auth user
 */
export const getAuthUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }
  return data.user;
};

// ==========================================
// PROFILE METHODS
// ==========================================

/**
 * Get current user's profile from app_users
 */
export const getUserProfile = async (): Promise<User | null> => {
  const { data: authUser } = await supabase.auth.getUser();

  if (!authUser.user) {
    return null;
  }

  let user: User | null = null;

  // Try the RPC function first (more secure)
  const { data: profileData, error: rpcError } = await supabase
    .rpc('get_user_profile');

  if (!rpcError && profileData) {
    user = mapProfileToUser(profileData);
  } else {
    // Fallback to direct query
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('auth_user_id', authUser.user.id)
      .single();

    if (!error && data) {
      user = mapRowToUser(data);
    }
  }

  // Merge with Auth Metadata if fields are missing in app_users
  if (user && authUser.user.user_metadata) {
    const meta = authUser.user.user_metadata;
    return {
      ...user,
      firstName: user.firstName || meta.firstName,
      lastName: user.lastName || meta.lastName,
      phone: user.phone || meta.phone,
      email: user.email || meta.email || authUser.user.email
    };
  }

  return user;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (updates: Partial<User>): Promise<User> => {
  const { data: authUser } = await supabase.auth.getUser();

  if (!authUser.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('app_users')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      phone: updates.phone,
      branch_ids: updates.branchIds,
      route_ids: updates.routeIds,
      region_ids: updates.regionIds,
      rep_codes: updates.repCodes
    })
    .eq('auth_user_id', authUser.user.id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRowToUser(data);
};

// ==========================================
// PASSWORD MANAGEMENT
// ==========================================

/**
 * Update password (for authenticated users)
 */
export const updatePassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw new Error(error.message);
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  if (error) {
    throw new Error(error.message);
  }
};

// ==========================================
// HELPERS
// ==========================================

const mapProfileToUser = (profile: any): User => ({
  id: profile.id,
  username: profile.username,
  password: '', // Never expose password
  role: profile.role as UserRole || UserRole.USER,
  isActive: profile.isActive ?? true,
  companyId: profile.companyId,
  branchIds: profile.branchIds || [],
  routeIds: profile.routeIds || [],
  regionIds: profile.regionIds || [],
  repCodes: profile.repCodes || [],
  lastLogin: profile.lastLogin,
  firstName: profile.firstName,
  lastName: profile.lastName,
  email: profile.email,
  phone: profile.phone
});

const mapRowToUser = (row: any): User => ({
  id: row.id,
  username: row.username,
  password: '', // Never expose password
  role: row.role as UserRole || UserRole.USER,
  isActive: row.is_active ?? true,
  companyId: row.company_id,
  branchIds: row.branch_ids || [],
  routeIds: row.route_ids || [],
  regionIds: row.region_ids || [],
  repCodes: row.rep_codes || [],
  lastLogin: row.last_login,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  phone: row.phone
});

// ==========================================
// LEGACY SUPPORT (Deprecated)
// ==========================================

/**
 * @deprecated Use signIn() instead
 * Legacy login function for backward compatibility during migration
 */
export const legacyLogin = async (username: string, password: string): Promise<User | null> => {
  console.warn('legacyLogin is deprecated. Please migrate to Supabase Auth.');

  // Check if user has been migrated to auth
  const { data: users } = await supabase
    .from('app_users')
    .select('*')
    .eq('username', username);

  if (!users || users.length === 0) {
    return null;
  }

  const user = users[0];

  // If user has auth_user_id, they've been migrated - use Supabase Auth
  if (user.auth_user_id) {
    const authUser = await signIn(user.email || username, password);
    return authUser;
  }

  // Legacy plaintext check (will be removed after full migration)
  if (user.password === password) {
    return mapRowToUser(user);
  }

  return null;
};

// ==========================================
// EMAIL NOTIFICATIONS (SIMULATED)
// ==========================================

export const sendLicenseRequestEmail = async (requestData: any) => {
  // In a real implementation, this would call a Supabase Edge Function
  // used to trigger transactional emails via Resend, SendGrid, or AWS SES.

  // For now, we Simulate logging and alerting.
  console.log("---------------------------------------------------------");
  console.log("📨 SIMULATING EMAIL TO: info@algoraxco.com");
  console.log("SUBJECT: New License Request - " + requestData.companyName);
  console.log("BODY:", JSON.stringify(requestData, null, 2));
  console.log("---------------------------------------------------------");

  // We can also trigger a browser notification if supported/allowed, 
  // but console log is sufficient for 'simulation'.
  return true;
};
