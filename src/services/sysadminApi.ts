/**
 * SysAdmin API client.
 *
 * All requests carry the Supabase session JWT. The backend verifies the
 * token and checks the caller exists in `public.sysadmins`.
 */
import { supabase } from './supabase';

const API_BASE =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) ||
    'http://localhost:8000';

async function authHeaders(): Promise<Record<string, string>> {
    const sysadminToken = localStorage.getItem('rg_sysadmin_token');
    if (sysadminToken) {
        return { Authorization: `Bearer ${sysadminToken}`, 'Content-Type': 'application/json' };
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Not authenticated.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function get<T = any>(path: string): Promise<T> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
}

async function post<T = any>(path: string, body: any): Promise<T> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
}

export type SysAdminRole = 'owner' | 'admin' | 'support' | 'billing' | 'security';
export type Permission =
    | 'manage_sysadmins' | 'manage_companies' | 'manage_licenses'
    | 'manage_plans' | 'manage_promos' | 'manage_affiliates'
    | 'force_logout' | 'resolve_errors' | 'set_feature_flags'
    | 'view_audit_log' | 'view_usage';

export type Permissions = Partial<Record<Permission, boolean>>;

export interface VerifyResponse {
    is_sysadmin: boolean;
    sysadmin_id?: string;
    display_name: string;
    mfa_required: boolean;
    role: SysAdminRole;
    permissions: Permissions;
}

export interface TeamMember {
    id: string;
    auth_user_id: string;
    display_name: string;
    email: string;
    role: SysAdminRole;
    permissions: Permissions;
    effective_permissions: Permissions;
    is_active: boolean;
    mfa_required: boolean;
    last_login_at: string | null;
    last_login_ip: string | null;
    created_at: string;
    invited_by: string | null;
    invited_at: string;
}

export const ALL_PERMISSIONS: Permission[] = [
    'manage_sysadmins', 'manage_companies', 'manage_licenses',
    'manage_plans', 'manage_promos', 'manage_affiliates',
    'force_logout', 'resolve_errors', 'set_feature_flags',
    'view_audit_log', 'view_usage',
];

export const sysadminApi = {
    login: (email: string, password: string) => fetch(`${API_BASE}/sysadmin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    }).then(async res => {
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        const data = await res.json();
        if (data.token) {
            localStorage.setItem('rg_sysadmin_token', data.token);
        }
        return data;
    }),
    logout: async () => {
        localStorage.removeItem('rg_sysadmin_token');
    },
    verify: () => get<VerifyResponse>('/sysadmin/verify'),
    geminiUsage: (days = 30) => get<{ rows: any[] }>(`/sysadmin/usage/gemini?days=${days}`),
    scanUsage: (days = 30) => get<{ rows: any[] }>(`/sysadmin/usage/scans?days=${days}`),
    attempts: () => get<{ rows: any[] }>('/sysadmin/attempts'),
    routeVersions: () => get<{ rows: any[] }>('/sysadmin/route-versions'),
    auditLog: (days = 30) => get<{ rows: any[] }>(`/sysadmin/audit?days=${days}`),
    errorsLog: (days = 7, unresolvedOnly = false) =>
        get<{ rows: any[] }>(`/sysadmin/errors?days=${days}&unresolved_only=${unresolvedOnly}`),
    enforcement: () => get<{ rows: any[] }>('/sysadmin/enforcement'),
    sessions: () => get<{ rows: any[] }>('/sysadmin/sessions'),
    forceLogout: (authUserId: string) => post('/sysadmin/force-logout', { auth_user_id: authUserId }),
    blockUser:   (authUserId: string, block: boolean) =>
        post<{ ok: boolean; blocked: boolean; sessions_revoked: number }>(
            '/sysadmin/block-user',
            { auth_user_id: authUserId, block }
        ),
    resolveError: (errorId: string) => post('/sysadmin/errors/resolve', { error_id: errorId }),
    setFeatureFlag: (companyId: string, flagKey: string, enabled: boolean, metadata?: any) =>
        post('/sysadmin/feature-flag', { company_id: companyId, flag_key: flagKey, enabled, metadata }),

    // Team management
    teamList: () => get<{ rows: TeamMember[]; role_defaults: Record<SysAdminRole, Permissions> }>('/sysadmin/team'),
    teamInvite: (email: string, displayName: string, role: SysAdminRole, password?: string, permissions?: Permissions) =>
        post('/sysadmin/team/invite', { email, display_name: displayName, role, password, permissions }),
    teamUpdate: (sysadminId: string, body: { role?: SysAdminRole; permissions?: Permissions; is_active?: boolean; mfa_required?: boolean; display_name?: string }) =>
        request_('PATCH', `/sysadmin/team/${sysadminId}`, body),
    teamDelete: (sysadminId: string) => request_('DELETE', `/sysadmin/team/${sysadminId}`),
};

async function request_(method: string, path: string, body?: any) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
}
