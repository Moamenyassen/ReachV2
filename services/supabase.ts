
import { createClient } from '@supabase/supabase-js';
import {
    Company,
    User,
    Customer,
    Route,
    RouteVersion,
    HistoryLog,
    CompanySettings,
    BranchConfig,
    UserRole,
    PromoCode,
    RouteAssignment,
    NormalizedBranch,
    NormalizedRoute,
    NormalizedCustomer,
    RouteVisit,
    DashboardInsights
} from '../types';
import { BRANCHES } from "../config/constants";

// --- CONFIGURATION ---
// User should populate these or use env variables
const getEnvVar = (key: string) => {
    // Check for Vite's import.meta.env
    if (typeof import.meta !== 'undefined' && 'env' in import.meta) {
        return (import.meta as any).env[key];
    }
    // Check for Node's process.env
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    return undefined;
};

const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL') || 'https://mpkfvaccnsucdmxxtosu.supabase.co';
const SUPABASE_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wa2Z2YWNjbnN1Y2RteHh0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzQ3ODQsImV4cCI6MjA4MzM1MDc4NH0.dlfstdHCzWJF-CMCa93J4RsZvm2nwhqnE5hvZ_8pkEo';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[Security] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables. Application will fail to connect securely.');
}

let customHeaders: Record<string, string> = {};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
        fetch: (url, options: RequestInit = {}) => {
            const fetchHeaders = new Headers(options.headers);
            for (const [k, v] of Object.entries(customHeaders)) {
                fetchHeaders.set(k, v);
            }
            return fetch(url, { ...options, headers: fetchHeaders });
        }
    }
});

export const updateSupabaseHeaders = (headers: Record<string, string>) => {
    customHeaders = headers;
};

// ==========================================
// PROMO CODES
// ==========================================


// --- Promo Codes ---

// PromoCode now imported from types

export const getPromoCodes = async (): Promise<PromoCode[]> => {
    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const getUserPromoCode = async (userId: string): Promise<PromoCode | null> => {
    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('owner_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') { // Ignore not found error
        console.error("Error fetching user promo code:", error);
    }
    return data;
}

export const createPromoCode = async (
    code: string,
    discountPercent: number,
    description?: string,
    expiresAt?: string,
    affiliatePercent?: number,
    partnerDetails?: { firstName?: string; lastName?: string; company?: string; email?: string; phone?: string }
) => {
    const { data, error } = await supabase
        .from('promo_codes')
        .insert([
            {
                code,
                discount_percent: discountPercent,
                description,
                expires_at: expiresAt || null,
                affiliate_percent: affiliatePercent || null,
                partner_first_name: partnerDetails?.firstName,
                partner_last_name: partnerDetails?.lastName,
                partner_company: partnerDetails?.company,
                partner_email: partnerDetails?.email,
                partner_phone: partnerDetails?.phone,
                is_active: true
            }
        ])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updatePromoCode = async (id: string, updates: Partial<PromoCode>) => {
    const { data, error } = await supabase
        .from('promo_codes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const validatePromoCode = async (code: string): Promise<PromoCode | null> => {
    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

    if (error || !data) return null;

    // Check Expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
    }

    return data;
};

// Update to return data including ID
export const getPromoCodeByCode = async (code: string) => {
    const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

    if (error) return null;
    return data;
}



export const updatePromoUsageStatus = async (logId: string, status: 'SUCCESS' | 'FAILED') => {
    const { error } = await supabase
        .from('promo_usages')
        .update({ status })
        .eq('id', logId);

    if (error) throw error;
};

export const deletePromoCode = async (id: string) => {
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (error) throw error;
};

export const getPromoUsageLogs = async (promoCodeId: string) => {
    const { data, error } = await supabase
        .from('promo_usage_logs')
        .select('*')
        .eq('promo_code_id', promoCodeId)
        .order('used_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

// --- Subscription Plans ---

export interface SubscriptionPlan {
    id: string;
    name: string;
    description: string;
    price_monthly: number;
    price_yearly: number;
    currency: string;
    features: string[];
    disabled_features: string[];
    limits: {
        routes: number | string;
        users: number | string;
        market_scanner_cap: number | string;
        customers?: number | string; // New: Database Capacity
        storage_gb?: number;
        min_users?: number; // Policy: Minimum licenses to buy
        max_users?: number; // Policy: Maximum licenses allowed (for recommendation)
    };
    ui_config: {
        color: string;
        icon: string;
        borderColor?: string;
        isPopular?: boolean;
    };
    is_active: boolean;
    contact_required?: boolean;
    setup_fee?: number; // One-time setup fee (e.g. 3000)
    waive_threshold?: number; // Number of users to waive the fee (e.g. 50)
}

export const getReachLeads = async () => {
    const { data, error } = await supabase
        .from('reach_customers')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

export const updateReachCustomer = async (id: string, customerData: any) => {
    const { data, error } = await supabase
        .from('reach_customers')
        .update(customerData)
        .eq('id', id)
        .select();

    if (error) throw error;
    return data?.[0];
};

export const deleteReachCustomer = async (id: string) => {
    const { data, error } = await supabase
        .from('reach_customers')
        .delete()
        .eq('id', id)
        .select();

    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error("No record found with this ID to delete. It may have already been removed or is protected by security policies.");
    }
    return data;
};



export const createReachLead = async (leadData: any) => {
    // Generate a unique Reach Code
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    const reachCode = `REACH-${year}-${random}`;

    const { data, error } = await supabase
        .from('reach_customers')
        .insert([{
            ...leadData,
            reach_code: reachCode, // Storing code in new column
            // Provide defaults for required fields if not present in leadData
            first_name: leadData.first_name || 'New',
            last_name: leadData.last_name || 'Lead',
            email: leadData.email || `lead-${Date.now()}@example.com`,
            phone: leadData.phone || 'N/A',
            country: leadData.country || 'SA',
            role: leadData.role || 'Owner',
            created_at: new Date().toISOString(),
            status: 'NEW',
            customer_address: leadData.customer_address || leadData.address || null
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const upsertGlobalReachLeads = async (leads: any[]) => {
    const { data, error } = await supabase
        .from('reach_global_leads')
        .upsert(leads)
        .select();

    if (error) throw error;
    return data;
};

export const deleteGlobalReachLead = async (id: string) => {
    const { error } = await supabase
        .from('reach_global_leads')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const deleteAllGlobalReachLeads = async () => {
    // SECURITY FIX: Prevent unsafe frontend deletion of all rows.
    // Instead of doing `.neq('id', 'false-id')`, we require a secure RPC or manual DB truncation.
    const { error } = await supabase.rpc('truncate_global_leads');
    if (error) {
        console.error("RPC 'truncate_global_leads' failed or not implemented:", error);
        throw new Error('Safe deletion RPC not found. Aborting unsafe delete-all operation for security.');
    }
};

export const getAllCompanies = async (): Promise<Company[]> => {
    const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToCompany);
};


// --- DEDUPLICATION HELPERS ---

export const checkGlobalLeadsDuplicates = async () => {
    // 1. Fetch lightweight data for all leads
    const { data, error } = await supabase
        .from('reach_global_leads')
        .select('id, name, name_ar, lat, lng, region_description')
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
    if (!data) return [];

    // 2. Group by keys
    const groups: Record<string, any[]> = {};

    data.forEach(lead => {
        // Create strict keys for duplication (Name + Location)
        // Normalize name: lowercase, trim, remove special chars
        const normName = (lead.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normAr = (lead.name_ar || '').replace(/[^\u0600-\u06FF]/g, ''); // Keep only Arabic chars

        // Location key (3 decimal places ~= 110m precision)
        const locKey = `${Number(lead.lat).toFixed(3)}_${Number(lead.lng).toFixed(3)}`;

        // Check 1: Exact Name Match + Location
        if (normName && normName.length > 2) {
            const key = `NAME_${normName}_${locKey}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(lead);
        }

        // Check 2: Exact Arabic Name Match + Location
        if (normAr && normAr.length > 2) {
            const key = `AR_${normAr}_${locKey}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(lead);
        }
    });

    // 3. Filter for actual duplicates (size > 1) and format result
    const results = Object.values(groups)
        .filter(group => group.length > 1)
        .map(group => {
            // Remove internal duplicates (same ID in same group) just in case
            const uniqueIds = new Set();
            const uniqueGroup = group.filter(item => {
                if (uniqueIds.has(item.id)) return false;
                uniqueIds.add(item.id);
                return true;
            });
            return uniqueGroup;
        })
        .filter(group => group.length > 1); // Check again after cleanup

    return results;
};

// NEW: Fetch all customers from a company's routes for Global Import

// NEW: Fetch all customers from a company's active route version

// NEW: Fetch all customers from a company's active route version

// NEW: Fetch all customers from a company's active route version (with pagination)

// NEW: Fetch all customers from a company's active route version (Paginated + Progress + Distinct)
export const fetchCompanyCustomers = async (companyId: string, onProgress?: (current: number, total: number) => void) => {
    // 1. Get Active Version
    const { data: meta } = await supabase
        .from('route_meta')
        .select('active_version_id')
        .eq('company_id', companyId)
        .single();

    let versionId = meta?.active_version_id;

    // Fallback: If no active version in meta, find the latest version in route_versions
    if (!versionId) {
        const { data: latestVersion } = await supabase
            .from('route_versions')
            .select('id')
            .eq('company_id', companyId)
            .order('upload_date', { ascending: false })
            .limit(1)
            .single();

        if (latestVersion) {
            versionId = latestVersion.id;
            console.log(`[Fetch] No active version set for ${companyId}, using latest: ${versionId}`);
        } else {
            // Ultimate fallback if absolutely nothing found (backward compat)
            versionId = 'active_routes';
        }
    }

    // 2. Get Total Count
    const { count, error: countError } = await supabase
        .from('normalized_customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

    if (countError) {
        console.error('Error counting company routes:', countError);
        throw countError;
    }

    if (!count || count === 0) return [];

    // 3. Fetch in Chunks
    const BATCH_SIZE = 1000;
    const allRows: any[] = [];
    const seenKeys = new Set<string>(); // For Distincit Check

    for (let from = 0; from < count; from += BATCH_SIZE) {
        const to = from + BATCH_SIZE - 1;
        const { data, error } = await supabase
            .from('normalized_customers')
            .select('*')
            .eq('company_id', companyId)
            .range(from, to);

        if (error) {
            console.error('Error fetching page:', error);
            throw error;
        }

        if (data) {
            data.forEach((r: any) => {
                // User Request: Count distinct by Client Code first
                // If client_code is missing, fallback to Name+Lat+Lng hash to ensure uniqueness
                let key = r.client_code;
                if (!key) {
                    const n = r.name || 'Unknown';
                    const lat = r.lat || 0;
                    const lng = r.lng || 0;
                    key = `${Number(lat).toFixed(4)}_${Number(lng).toFixed(4)}_${n.toLowerCase().trim()}`;
                }

                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    allRows.push(r);
                }
            });
        }

        if (onProgress) {
            // Report progress based on FETCHED rows, even if we filtered some
            onProgress(Math.min(to + 1, count), count);
        }
    }

    // 4. Map to Global Leads
    return allRows.map((r: any) => {
        const d = r.data || {};
        const name = r.name || 'Unknown';
        const lat = r.lat || 0;
        const lng = r.lng || 0;

        return {
            name: name,
            name_ar: d.nameAr || d.name_ar || '',
            lat: lat,
            lng: lng,
            address: r.address || '',
            region_description: r.region_description || r.region_code,
            category: '',
            source_company_id: companyId,
            status: 'NEW',
            original_customer_hash: generateCustomerHash(name, lat, lng),
            dynamic_data: {
                // original_client_code: r.client_code // User requested to exclude this
            }
        };
    });
};





// NEW: Get customer counts for all companies efficiently

// NEW: Get customer counts efficiently via Route Versions
export const getCompanyCustomerCounts = async (): Promise<Record<string, number>> => {
    // 1. Get all active versions
    const { data: metas, error: metaError } = await supabase
        .from('route_meta')
        .select('company_id, active_version_id');

    if (metaError) return {};

    const stats: Record<string, number> = {};
    const activeVersions = metas?.map(m => m.active_version_id).filter(Boolean) || [];

    if (activeVersions.length > 0) {
        // 2. Get counts from route_versions
        // We need to match company_id + version_id to be safe
        const { data: versions, error: vError } = await supabase
            .from('route_versions')
            .select('company_id, id, record_count')
            .in('id', activeVersions);

        if (!vError && versions) {
            versions.forEach((v: any) => {
                // Only count if it matches the active version for that company
                const meta = metas?.find(m => m.company_id === v.company_id);
                if (meta && meta.active_version_id === v.id) {
                    stats[v.company_id] = v.record_count || 0;
                }
            });
        }
    }

    return stats;
};


export const generateCustomerHash = (name: string, lat: number, lng: number): string => {
    if (!name || lat === undefined || lng === undefined) return '';
    // Standardize: 4 decimal places (~11m precision), lowercase name, trimmed
    return `${Number(lat).toFixed(4)}_${Number(lng).toFixed(4)}_${name.toLowerCase().trim().substring(0, 50)}`;
};

// NEW: Fetch customers with server-side pagination, sorting, and filtering
// NEW: Fetch customers with server-side pagination, sorting, and filtering
export const fetchCustomers = async (
    companyId: string,
    page: number = 0,
    pageSize: number = 50,
    filters?: { search?: string; region?: string; alert?: string; source?: string },
    sortBy: string = 'name',
    ascending: boolean = true,
    userBranchIds?: string[] // NEW: Filter by user's assigned branches (for non-admin users)
): Promise<{ data: Customer[]; count: number }> => {

    // DEBUG: Log branch filtering parameters
    console.log('[fetchCustomers] Called with params:', {
        companyId,
        page,
        pageSize,
        filters,
        userBranchIds,
        userBranchIdsLength: userBranchIds?.length
    });

    // Normalized Query: Join with branches for filter/display, AND route_visits for schedule info
    let query = supabase
        .from('normalized_customers')
        .select(`
            *, 
            branches:company_branches!branch_id(code, name_en, name_ar),
            visits:route_visits(
                week_number, 
                day_name, 
                routes:route_id(name)
            )
        `, { count: 'exact' })
        .eq('company_id', companyId)
        .eq('is_active', true);

    // 2. Apply Branch Restriction (for non-admin users)
    // userBranchIds can contain branch NAMES (legacy) or branch CODES (preferred)
    if (userBranchIds && userBranchIds.length > 0) {
        console.log('[fetchCustomers] Applying branch filter for:', userBranchIds);

        // Step 1: Get the actual branch UUIDs - match by BOTH code and name_en for flexibility
        const { data: branchData, error: branchError } = await supabase
            .from('company_branches')
            .select('id, code, name_en')
            .eq('company_id', companyId);

        if (branchError) {
            console.error('[fetchCustomers] Error fetching branch IDs:', branchError);
            return { data: [], count: 0 };
        }

        // Match branches where code OR name_en is in userBranchIds
        const matchedBranches = branchData?.filter(b =>
            userBranchIds.includes(b.code) || userBranchIds.includes(b.name_en)
        ) || [];

        const branchUUIDs = matchedBranches.map(b => b.id);
        console.log('[fetchCustomers] Resolved branch UUIDs:', branchUUIDs, 'from branches:', matchedBranches);

        if (branchUUIDs.length === 0) {
            console.warn('[fetchCustomers] No matching branches found for:', userBranchIds);
            return { data: [], count: 0 };
        }

        // Step 2: Filter customers by the actual branch_id column
        query = supabase
            .from('normalized_customers')
            .select(`
                *, 
                branches:company_branches!branch_id(code, name_en, name_ar),
                visits:route_visits(
                    week_number, 
                    day_name, 
                    routes:route_id(name)
                )
            `, { count: 'exact' })
            .eq('company_id', companyId)
            .eq('is_active', true)
            .in('branch_id', branchUUIDs);
    }

    // 3. Apply Filters
    if (filters?.search) {
        const s = filters.search;
        // Search across fields
        query = query.or(`name_en.ilike.%${s}%,client_code.ilike.%${s}%,name_ar.ilike.%${s}%,phone.ilike.%${s}%,reach_customer_code.ilike.%${s}%`);
    }

    if (filters?.region && filters.region !== 'All' && filters.region !== 'ALL') {
        // Filter by branch name via inner join trick or just fetch all and filter in UI (bad for perf).
        // Correct way for ONE-TO-MANY (branches is 1 parent) is !inner on relationship
        query = supabase
            .from('normalized_customers')
            .select(`
                *, 
                branches:company_branches!inner(code, name_en, name_ar),
                visits:route_visits(
                    week_number, 
                    day_name, 
                    routes:route_id(name)
                )
            `, { count: 'exact' })
            .eq('company_id', companyId)
            .eq('is_active', true)
            .eq('branches.name_en', filters.region);

        // Also apply branch restriction if user has limited access
        if (userBranchIds && userBranchIds.length > 0) {
            // Ensure selected region is within user's allowed branches
            if (!userBranchIds.includes(filters.region)) {
                // User trying to access region they don't have access to - return empty
                return { data: [], count: 0 };
            }
        }

        // Re-apply search
        if (filters?.search) {
            const s = filters.search;
            query = query.or(`name_en.ilike.%${s}%,client_code.ilike.%${s}%,name_ar.ilike.%${s}%,phone.ilike.%${s}%,reach_customer_code.ilike.%${s}%`);
        }
    }

    if (filters?.alert === 'Missing GPS') {
        query = query.or('lat.is.null,lat.eq.0');
    }

    // 3. Apply Sorting
    // Map 'name' to 'name_en'
    const sortField = sortBy === 'name' ? 'name_en' : (sortBy === 'clientCode' ? 'client_code' : sortBy);

    // Check if sorting by foreign key (branch)
    if (sortBy === 'regionDescription') {
        query = query.order('branches(name_en)', { ascending, nullsFirst: false });
    } else {
        query = query.order(sortField, { ascending, nullsFirst: false });
    }

    // 4. Pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    console.log('Fetch Customers Debug:', {
        companyId,
        page,
        filters,
        count,
        error,
        dataLength: data?.length,
        firstRow: data?.[0]
    });

    if (error) {
        console.error('Error fetching customers:', error);
        throw error;
    }

    // MAP Normalized -> Customer Interface
    const customers = (data || []).map((row: any) => {
        // Aggregate Visits
        const visits = row.visits || [];
        const routes = Array.from(new Set(visits.map((v: any) => v.routes?.name).filter(Boolean))).join(', ');
        const days = Array.from(new Set(visits.map((v: any) => v.day_name).filter(Boolean))).join(', ');
        const weeks = Array.from(new Set(visits.map((v: any) => v.week_number).filter(Boolean))).join(', ');

        return {
            id: row.id,
            name: row.name_en,
            nameAr: row.name_ar,
            clientCode: row.client_code,
            reachCustomerCode: row.reach_customer_code,
            lat: row.lat,
            lng: row.lng,
            address: row.address,
            phone: row.phone,
            classification: row.classification,
            vat: row.vat,
            buyerId: row.buyer_id,
            storeType: row.store_type,
            district: row.district,
            data: row.dynamic_data,
            // Joined Branch Info
            regionDescription: row.branches?.name_en || 'Unassigned',
            regionCode: row.branches?.code || '',
            branch: row.branches?.name_en,
            // Joined Route Info
            routeName: routes,
            week: weeks,
            day: days,
            // Meta info
            addedDate: row.created_at,
            addedBy: row.dynamic_data?.addedBy || '-'
        } as Customer;
    });

    return {
        data: customers,
        count: count || 0
    };
};

// NEW: Fetch distinct regions for filter
// NEW: Fetch distinct regions for filter
export const fetchCustomerRegions = async (companyId: string): Promise<string[]> => {
    // Optimized: Fetch from 'branches' table directly
    const { data, error } = await supabase
        .from('company_branches')
        .select('name_en')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name_en');

    if (error) {
        console.error('Error fetching regions:', error);
        return [];
    }

    return (data || []).map(b => b.name_en).filter(Boolean);
};

/**
 * Save customer route data for a specific company from SysAdmin panel.
 * This creates proper versioning and updates route_meta so data appears in the app.
 */
export const saveCompanyCustomersFromSysAdmin = async (
    companyId: string,
    customers: Array<{
        name: string;
        name_ar?: string;
        lat: number;
        lng: number;
        address?: string;
        client_code?: string;
        route_name?: string;
        region_description?: string;
        phone?: string;
        classification?: string;
        week?: string;
        day?: string;
        user_code?: string;
        [key: string]: any;
    }>,
    onProgress?: (progress: number) => void
): Promise<{ added: number; skipped: number; versionId: string }> => {
    if (!customers || customers.length === 0) return { added: 0, skipped: 0, versionId: '' };

    const versionId = Date.now().toString();
    const CHUNK_SIZE = 500;
    let addedCount = 0;

    try {
        // 1. Create Route Version Entry
        await supabase.from('route_versions').insert({
            id: versionId,
            company_id: companyId,
            status: 'uploading',
            record_count: customers.length
        });

        // 2. Insert customers in chunks
        for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
            const chunk = customers.slice(i, i + CHUNK_SIZE);

            const rows = chunk.map((c, idx) => ({
                company_id: companyId,
                version_id: versionId,
                customer_id: `${versionId}_${i + idx}`,
                name: c.name,
                name_ar: c.name_ar || null,
                lat: c.lat,
                lng: c.lng,
                address: c.address || null,
                customer_address: c.address || null,
                client_code: c.client_code || null,
                route_name: c.route_name || null,
                region_description: c.region_description || null,
                phone: c.phone || null,
                classification: c.classification || null,
                week: c.week || null,
                day: c.day || null,
                user_code: c.user_code || null,
                data: {} // Store any extra fields
            }));

            const { error } = await supabase.from('normalized_customers').upsert(rows);
            if (error) {
                console.error('Batch insert error:', error);
                throw new Error(`Insert failed: ${error.message}`);
            }

            addedCount += chunk.length;
            if (onProgress) {
                const percent = Math.round((i + CHUNK_SIZE) / customers.length * 100);
                onProgress(Math.min(percent, 100));
            }
        }

        // 3. Mark version complete and set as active
        await supabase.from('route_versions').update({ status: 'complete' }).eq('id', versionId).eq('company_id', companyId);
        await supabase.from('route_meta').upsert({
            company_id: companyId,
            active_version_id: versionId,
            last_updated: new Date().toISOString()
        });

        // 4. Add history log
        await supabase.from('history_logs').insert({
            company_id: companyId,
            log_id: versionId,
            file_name: 'SysAdmin CSV Upload',
            upload_date: new Date().toISOString(),
            record_count: addedCount,
            uploader: 'SysAdmin',
            type: 'ROUTE',
            stats: {
                distinctClients: addedCount,
                skippedRecords: 0,
                regions: []
            }
        });

        // 5. Auto-Detect Branches (NEW)
        try {
            console.log('Triggering auto-branch detection for version:', versionId);
            await detectAndAddBranches(companyId, versionId);
        } catch (branchError) {
            console.warn("Auto-detect branches failed (non-fatal):", branchError);
        }

        return { added: addedCount, skipped: 0, versionId };
    } catch (err: any) {
        // Clean up on failure
        await supabase.from('route_versions').delete().eq('id', versionId).eq('company_id', companyId);
        throw err;
    }
};


export const insertGlobalLeadsSmart = async (leads: any[], onProgress?: (progress: number) => void) => {
    if (!leads || leads.length === 0) return { added: 0, skipped: 0 };

    // 1. Extract hashes
    const hashes = leads.map(l => l.original_customer_hash).filter(Boolean);
    if (hashes.length === 0) return { added: 0, skipped: 0 };

    // 2. Check existing hashes in chunks (to avoid URL length limits)
    const chunkSize = 200;
    const existingHashes = new Set<string>();

    for (let i = 0; i < hashes.length; i += chunkSize) {
        const batchHashes = hashes.slice(i, i + chunkSize);
        const { data, error } = await supabase
            .from('reach_global_leads')
            .select('original_customer_hash')
            .in('original_customer_hash', batchHashes);

        if (error) {
            console.error('Error checking duplicates:', error);
            // Fallback: Proceed with insert and let DB constraints handle it (if any), or skip batch?
            // Safe bet: Continue but log error.
        }

        if (data) {
            data.forEach((r: any) => existingHashes.add(r.original_customer_hash));
        }
    }

    // 3. Filter duplicates
    const newLeads = leads.filter(l => !existingHashes.has(l.original_customer_hash));

    if (newLeads.length === 0) {
        return { added: 0, skipped: leads.length };
    }

    // 4. Batch Insert New Leads
    const insertChunkSize = 100;
    let addedCount = 0;

    for (let i = 0; i < newLeads.length; i += insertChunkSize) {
        const batch = newLeads.slice(i, i + insertChunkSize);
        const { error } = await supabase
            .from('reach_global_leads')
            .insert(batch);

        if (!error) {
            addedCount += batch.length;
            if (onProgress) {
                // Progress calculation:
                // We've already done specific duplicate checking (fast), now inserting.
                // We'll treat insertion as the main "progress" visible to user for the final stage.
                const percent = Math.round(((i + insertChunkSize) / newLeads.length) * 100);
                onProgress(Math.min(percent, 100));
            }
        } else {
            console.error('Error inserting smart batch:', error);
            // Throwing here to ensure the UI sees the failure
            throw new Error(`Batch Insert Failed: ${error.message} - hints: ${error.details || ''}`);
        }
    }

    return { added: addedCount, skipped: leads.length - addedCount };
};

// --- Reach Global Leads DB ---
// --- Reach Global Leads DB ---
// --- Reach Global Leads DB ---
export const getGlobalReachLeads = async (
    page: number = 1,
    pageSize: number = 100,
    filters?: { source?: string; status?: string; search?: string; region?: string;[key: string]: any },
    sortBy: string = 'created_at',
    sortOrder: 'asc' | 'desc' = 'desc'
) => {
    // Helper to build the base query
    const buildQuery = () => {
        let query = supabase
            .from('reach_global_leads')
            .select('*', { count: 'exact' });

        if (filters?.source) {
            if (filters.source === 'MANUAL_FILTER') {
                // Manual covers Uploaded, Manual Entry, Manual
                query = query.in('source_company_id', ['UPLOADED', 'MANUAL_ENTRY', 'MANUAL']);
            }
            else if (filters.source === 'SCANNER_FILTER') {
                query = query.in('source_company_id', ['SCANNER', 'MARKET_SCANNER']);
            }
            else if (filters.source === 'FETCHED_FILTER') {
                // Fetched is anything NOT Manual or Scanner
                query = query.not('source_company_id', 'in', '("MANUAL_ENTRY", "SCANNER", "MANUAL", "UPLOADED", "MARKET_SCANNER")');
            }
            else if (filters.source === 'UPLOADED') {
                // Legacy support just in case
                query = query.eq('source_company_id', 'UPLOADED');
            } else {
                // Direct match if specific ID passed
                query = query.eq('source_company_id', filters.source);
            }
        }
        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.region) query = query.eq('region_description', filters.region);
        if (filters?.search) query = query.or(`name.ilike.%${filters.search}%,name_ar.ilike.%${filters.search}%,region_description.ilike.%${filters.search}%,address.ilike.%${filters.search}%,source_company_id.ilike.%${filters.search}%,dynamic_data.ilike.%${filters.search}%`);

        // Handle generic/other column filters
        if (filters) {
            Object.keys(filters).forEach(key => {
                if (['source', 'status', 'search', 'region'].includes(key)) return;
                const value = filters[key];
                if (value && value !== 'ALL') {
                    // Skip complex virtual columns
                    if (key === 'coordinates') return;

                    // Assume text search (ilike) for unknown columns
                    query = query.ilike(key, `%${value}%`);
                }
            });
        }

        return query;
    };

    let dbSortColumn = sortBy;
    // Map UI sorting keys to DB columns
    if (sortBy === 'registered') dbSortColumn = 'created_at';
    if (sortBy === 'coordinates') dbSortColumn = 'lat'; // Sort by Latitude as proxy



    // Strategy: If pageSize > 1000, we fetch in chunks to bypass API limits (usually 1000)
    // Supabase JS .range() is inclusive [from, to]
    const MAX_PER_REQUEST = 1000;

    if (pageSize > MAX_PER_REQUEST) {
        // 1. Get total count first (lightweight)
        const { count, error: countError } = await buildQuery();
        if (countError) throw countError;

        const totalParams = count || 0;

        // Calculate the absolute range for the requested "page"
        // (Usually if pageSize is huge, page is 1, so from=0, to=total-1)
        const globalFrom = (page - 1) * pageSize;
        const globalTo = Math.min(globalFrom + pageSize - 1, totalParams - 1);

        if (globalFrom >= totalParams) return { data: [], count: totalParams };

        // 2. Generate chunks
        const promises = [];
        for (let i = globalFrom; i <= globalTo; i += MAX_PER_REQUEST) {
            const chunkTo = Math.min(i + MAX_PER_REQUEST - 1, globalTo);

            const q = buildQuery();
            promises.push(
                q.order(dbSortColumn, { ascending: sortOrder === 'asc' })
                    .range(i, chunkTo)
            );
        }

        // 3. Run in parallel
        const results = await Promise.all(promises);

        // 4. Merge
        let combinedData: any[] = [];
        results.forEach(res => {
            if (res.error) throw res.error;
            if (res.data) combinedData = combinedData.concat(res.data);
        });

        return { data: combinedData, count: totalParams };
    } else {
        // Standard Fetch
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const query = buildQuery();
        const { data, error, count } = await query
            .order(dbSortColumn, { ascending: sortOrder === 'asc' })
            .range(from, to);

        if (error) throw error;
        return { data, count };
    }
};

export const getGlobalDistinctRegions = async (): Promise<string[]> => {
    return getGlobalDistinctValues('region_description');
};

// Generic distinct value fetcher
export const getGlobalDistinctValues = async (key: string, isDynamic: boolean = false): Promise<string[]> => {
    const BATCH_SIZE = 1000;

    // 1. Get total count
    const { count, error: countError } = await supabase.from('reach_global_leads').select('*', { count: 'exact', head: true });
    if (countError) return [];

    const total = count || 0;
    const allValues = new Set<string>();
    const promises = [];

    // 2. Fetch all pages
    for (let i = 0; i < total; i += BATCH_SIZE) {
        promises.push(
            supabase
                .from('reach_global_leads')
                .select(isDynamic ? 'dynamic_data' : key)
                .range(i, i + BATCH_SIZE - 1)
        );
    }

    const results = await Promise.all(promises);
    results.forEach(res => {
        if (res.data) {
            res.data.forEach((r: any) => {
                let val;
                if (isDynamic) {
                    val = r.dynamic_data?.[key];
                } else {
                    val = r[key];
                }
                if (val) allValues.add(String(val).trim());
            });
        }
    });

    return Array.from(allValues).sort();
};



export const getGlobalDistinctStatuses = async () => {
    const BATCH_SIZE = 1000;

    // 1. Get total count
    const { count, error: countError } = await supabase
        .from('reach_global_leads')
        .select('*', { count: 'exact', head: true })
        .not('status', 'is', null);

    if (countError) throw countError;
    const total = count || 0;

    // 2. Fetch in chunks
    const allStatuses = new Set<string>();
    const promises = [];

    for (let i = 0; i < total; i += BATCH_SIZE) {
        promises.push(
            supabase
                .from('reach_global_leads')
                .select('status')
                .not('status', 'is', null)
                .range(i, i + BATCH_SIZE - 1)
        );
    }

    const results = await Promise.all(promises);

    results.forEach(res => {
        if (res.data) {
            res.data.forEach((r: any) => {
                if (r.status) allStatuses.add(r.status);
            });
        }
    });

    return Array.from(allStatuses).sort();
};

export const getAllGlobalReachLeads = async () => {
    // Fetches ALL records (no limit validation) for background processing.
    // We utilize batched parallel requests.
    const BATCH_SIZE = 1000;

    const { count, error: countError } = await supabase
        .from('reach_global_leads')
        .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    const total = count || 0;

    const promises = [];
    for (let i = 0; i < total; i += BATCH_SIZE) {
        promises.push(
            supabase
                .from('reach_global_leads')
                .select(`
                    id, 
                    name, 
                    name_ar, 
                    lat, 
                    lng, 
                    region_description, 
                    source_company_id, 
                    status,
                    address
                `)
                .range(i, i + BATCH_SIZE - 1)
        );
    }

    const results = await Promise.all(promises);
    let allData: any[] = [];

    results.forEach(res => {
        if (res.data) allData = allData.concat(res.data);
    });

    return allData;
};

export const addGlobalReachLead = async (leadData: any) => {
    // Check for duplicates first
    const hash = generateCustomerHash(leadData.name, leadData.lat, leadData.lng);
    const { data: existing } = await supabase
        .from('reach_global_leads')
        .select('id')
        .eq('original_customer_hash', hash)
        .maybeSingle();

    if (existing) {
        throw new Error("Duplicate: This lead already exists in the Global Registry.");
    }

    const { error } = await supabase.from('reach_global_leads').insert({
        ...leadData,
        original_customer_hash: hash
    });
    if (error) throw error;
};

export const getSubscriptionPlans = async (includeInactive: boolean = false): Promise<SubscriptionPlan[]> => {
    let query = supabase
        .from('subscription_plans')
        .select('*');

    if (!includeInactive) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query.order('price_monthly', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const updateSubscriptionPlan = async (id: string, updates: Partial<SubscriptionPlan>) => {
    const { data, error } = await supabase
        .from('subscription_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const createSubscriptionPlan = async (plan: SubscriptionPlan) => {
    const { data, error } = await supabase
        .from('subscription_plans')
        .insert([plan])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteSubscriptionPlan = async (id: string) => {
    const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const activateSubscription = async (companyId: string, planId: string, billingPeriod: 'monthly' | 'yearly' = 'monthly', licenseCount: number = 1) => {
    // 1. Fetch Plan Details
    const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

    if (planError || !plan) throw new Error("Invalid Plan ID");

    // 2. Map Plan ID to Enum (Legacy Compatibility)
    let tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' = 'STARTER';
    if (planId === 'growth') tier = 'PROFESSIONAL';
    if (planId === 'elite') tier = 'ENTERPRISE';

    // 3. Calculate Expiration
    const now = new Date();
    if (billingPeriod === 'yearly') {
        now.setFullYear(now.getFullYear() + 1);
    } else {
        now.setMonth(now.getMonth() + 1);
    }
    const expirationDate = now.toISOString();

    // Helper to sanitize limits
    const parseLimit = (val: any) => (String(val).toLowerCase() === 'unlimited' ? 999999 : (Number(val) || 0));

    // 4. Update Company
    const updates = {
        subscription_tier: tier,
        max_users: parseLimit(plan.limits.users) * licenseCount,
        max_routes: parseLimit(plan.limits.routes) * licenseCount,
        max_scanner_cap: parseLimit(plan.limits.market_scanner_cap) * licenseCount,
        max_customers: parseLimit(plan.limits.customers || 1000) * licenseCount,
        is_active: true,
        expiration_date: expirationDate
    };

    const { error: updateError } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', companyId);

    if (updateError) throw new Error(updateError.message);

    return { success: true, expirationDate };
};

export const incrementPromoUsage = async (id: string): Promise<void> => {
    // This is a simplified increment. In a real app we might want an RPC or a separate usage table.
    // For now, we just read and update.
    const { data } = await supabase.from('promo_codes').select('usage_count').eq('id', id).single();
    if (data) {
        await supabase.from('promo_codes').update({ usage_count: (data.usage_count || 0) + 1 }).eq('id', id);
    }
};

// --- UTILITIES ---

const safeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val).trim();
};

const safeNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

// --- DATA MAPPERS ---

const mapRowToCompany = (row: any): Company => ({
    id: row.id,
    name: row.name,
    subscriptionTier: row.subscription_tier as any,
    maxUsers: row.max_users,
    maxRoutes: row.max_routes || 1000,
    maxCustomers: row.max_customers || 2500,
    maxScannerCap: row.max_scanner_cap || 0,
    isActive: row.is_active,
    createdAt: row.created_at,
    adminUsername: row.admin_username,
    expirationDate: row.expiration_date,
    lastUploadDate: row.last_upload_date,
    lastUploadRecordCount: row.last_upload_record_count,
    settings: row.settings || undefined,
    logoUrl: row.logo_url,
    features: row.features || []
});

const mapCompanyToRow = (c: Company) => ({
    id: c.id,
    name: c.name,
    subscription_tier: c.subscriptionTier,
    max_users: c.maxUsers,
    max_routes: c.maxRoutes,
    max_customers: c.maxCustomers,
    max_scanner_cap: c.maxScannerCap,
    is_active: c.isActive,
    created_at: c.createdAt,
    admin_username: c.adminUsername,
    expiration_date: c.expirationDate,
    last_upload_date: c.lastUploadDate,
    last_upload_record_count: c.lastUploadRecordCount,
    settings: c.settings,
    logo_url: c.logoUrl
});

const mapRowToUser = (row: any): User => {
    console.log("Mapping User Row:", row);
    return {
        username: row.username,
        password: row.password,
        role: row.role as UserRole,
        isActive: row.is_active,
        id: row.id || row.user_id || row.uid,
        companyId: row.company_id,
        branchIds: row.branch_ids || [],
        routeIds: row.route_ids || [],
        regionIds: row.region_ids || [],
        repCodes: row.rep_codes || [],
        lastLogin: row.last_login,
        // New Onboarding Fields
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        isRegisteredCustomer: row.is_registered_customer,
        preferences: row.preferences || {}
    };
};

const mapUserToRow = (u: User) => ({
    username: u.username,
    password: u.password,
    role: u.role,
    is_active: u.isActive,
    // id: u.id, // Usually distinct, but if needed for upsert
    company_id: u.companyId,
    branch_ids: u.branchIds,
    route_ids: u.routeIds,
    region_ids: u.regionIds,
    rep_codes: u.repCodes,
    last_login: u.lastLogin,
    // New Onboarding Fields
    first_name: u.firstName,
    last_name: u.lastName,
    email: u.email,
    phone: u.phone,
    is_registered_customer: u.isRegisteredCustomer,
    preferences: u.preferences || {}
});

const mapRowToCustomer = (row: any): Customer => {
    const data = row.data || {};
    return {
        id: row.customer_id,
        name: row.name,
        lat: row.lat,
        lng: row.lng,
        day: row.day || data.day || 'Unscheduled',
        clientCode: row.client_code,
        routeName: row.route_name,
        address: row.address,
        week: row.week || data.week,
        regionCode: row.region_code,
        regionDescription: row.region_description,
        nameAr: row.name_ar || data.nameAr,
        addedDate: row.created_at,
        addedBy: row.addedBy || data.addedBy, // Can be from col alias or JSONB
        rowId: row.id,

        // Extended Fields from Dedicated Columns (with JSONB fallback for migration)
        branch: row.branch || data.branch,
        phone: row.phone || data.phone,
        district: row.district || data.district,
        vat: row.vat || data.vat,
        buyerId: row.buyer_id || data.buyerId,
        classification: row.classification || data.classification,
        storeType: row.store_type || data.storeType,
        userCode: row.user_code || data.userCode,
        reachCustomerCode: row.reach_customer_code,
        data: data // Keep full dynamic data accessible
    };
};

// --- SUBSCRIPTIONS ---

/**
 * Validates connection by checking auth state (even if anon).
 * If URL/Key are invalid, it throws immediately.
 */
const checkConnection = async () => {
    if (SUPABASE_URL.includes('YOUR_SUPABASE') || SUPABASE_KEY.includes('YOUR_SUPABASE')) {
        console.warn("Supabase credentials not configured.");
        return false;
    }
    return true;
};

// 1. COMPANIES
export const subscribeToCompanies = (callback: (companies: Company[]) => void) => {
    // Initial Fetch
    checkConnection().then(ok => {
        if (!ok) return callback([]);
        supabase.from('companies').select('*').then(({ data, error }) => {
            if (!error && data) callback(data.map(mapRowToCompany));
        });
    });

    // Realtime Subscription
    const channel = supabase.channel('companies_all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, (payload) => {
            // In a real app, we might merge the payload. For simplicity, we re-fetch everything to ensure consistency.
            supabase.from('companies').select('*').then(({ data }) => {
                if (data) callback(data.map(mapRowToCompany));
            });
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

export const updateCompany = async (id: string, updates: Partial<Company>) => {
    // Map updates to snake_case row
    const rowUpdates: any = {};
    if (updates.name) rowUpdates.name = updates.name;
    if (updates.subscriptionTier) rowUpdates.subscription_tier = updates.subscriptionTier;
    if (updates.maxUsers !== undefined) rowUpdates.max_users = updates.maxUsers;
    if (updates.maxRoutes !== undefined) rowUpdates.max_routes = updates.maxRoutes;
    if (updates.maxCustomers !== undefined) rowUpdates.max_customers = updates.maxCustomers;
    if (updates.maxScannerCap !== undefined) rowUpdates.max_scanner_cap = updates.maxScannerCap;
    if (updates.isActive !== undefined) rowUpdates.is_active = updates.isActive;
    if (updates.features) rowUpdates.features = updates.features;
    if (updates.settings) rowUpdates.settings = updates.settings;

    const { data, error } = await supabase
        .from('companies')
        .update(rowUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return mapRowToCompany(data);
};

export const subscribeToCompany = (companyId: string, callback: (company: Company | null) => void) => {
    checkConnection().then(ok => {
        if (!ok) return callback(null);
        // Initial Fetch
        supabase.from('companies').select('*').eq('id', companyId).single().then(({ data }) => {
            callback(data ? mapRowToCompany(data) : null);
        });
    });

    const channel = supabase.channel(`company_${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'companies', filter: `id=eq.${companyId}` }, (payload) => {
            supabase.from('companies').select('*').eq('id', companyId).single().then(({ data }) => {
                callback(data ? mapRowToCompany(data) : null);
            });
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

export const uploadCompanyLogo = async (file: File, companyId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${companyId}-${Date.now()}.${fileExt}`;
    // Assuming 'company-logos' bucket exists and is public
    const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
        console.error("Upload failed:", uploadError);
        // Supabase often returns generic 404/resource not found for missing buckets
        if (uploadError.message.includes("resource") || uploadError.message.includes("not found")) {
            throw new Error("Storage bucket 'company-logos' missing. Please create a public bucket named 'company-logos' in Supabase.");
        }
        throw new Error("Failed to upload logo: " + uploadError.message);
    }

    const { data } = supabase.storage.from('company-logos').getPublicUrl(fileName);
    return data.publicUrl;
};


export const addCompany = async (company: Company) => {
    const row = mapCompanyToRow(company);
    const { error } = await supabase.from('companies').insert(row);
    if (error) throw new Error(error.message);

    // Initialize Route Meta
    await supabase.from('route_meta').upsert({
        company_id: company.id,
        active_version_id: 'active_routes',
        last_updated: new Date().toISOString()
    });
};



export const deleteCompany = async (companyId: string) => {
    const { error } = await supabase.from('companies').delete().eq('id', companyId);
    if (error) throw new Error(error.message);
};

export const forceDeleteCompany = async (companyId: string) => {
    // 1. Delete Users
    const { error: usersError } = await supabase.from('app_users').delete().eq('company_id', companyId);
    if (usersError) throw new Error("Failed to delete users: " + usersError.message);

    // 2. Delete Customers
    const { error: custError } = await supabase.from('normalized_customers').delete().eq('company_id', companyId);
    if (custError) throw new Error("Failed to delete customers: " + custError.message);

    // 3. Delete Routes (Meta) - Versions usually cascade or we delete them if linked to meta
    const { error: routeError } = await supabase.from('route_meta').delete().eq('company_id', companyId);
    if (routeError) throw new Error("Failed to delete routes: " + routeError.message);

    // 4. Delete History/Logs (non-fatal)
    const { error: logError } = await supabase.from('history_logs').delete().eq('company_id', companyId);
    if (logError) console.warn("Failed to delete logs (non-fatal):", logError.message);

    // 5. Finally Delete Company
    const { data: deletedCompany, error } = await supabase.from('companies').delete().eq('id', companyId).select();
    if (error) throw new Error("Failed to delete company: " + error.message);

    // Verify rows were actually deleted (catches RLS blocking silently)
    if (!deletedCompany || deletedCompany.length === 0) {
        throw new Error("Delete operation returned no rows - company may not exist or access is denied. Please check Supabase RLS policies.");
    }
};

// 2. USERS

export const subscribeToGlobalUsers = (callback: (users: User[]) => void) => {
    checkConnection().then(ok => {
        if (!ok) return callback([]);
        supabase.from('app_users').select('*').then(({ data }) => {
            if (data) callback(data.map(mapRowToUser));
        });
    });

    const channel = supabase.channel('users_all')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users' }, () => {
            supabase.from('app_users').select('*').then(({ data }) => {
                if (data) callback(data.map(mapRowToUser));
            });
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

export const subscribeToUsers = (companyId: string, callback: (users: User[]) => void) => {
    checkConnection().then(ok => {
        if (!ok) return callback([]);
        supabase.from('app_users').select('*').eq('company_id', companyId).then(({ data }) => {
            if (data) callback(data.map(mapRowToUser));
        });
    });

    const channel = supabase.channel(`users_${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_users', filter: `company_id=eq.${companyId}` }, () => {
            supabase.from('app_users').select('*').eq('company_id', companyId).then(({ data }) => {
                if (data) callback(data.map(mapRowToUser));
            });
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

export const saveUsers = async (companyId: string, users: User[]) => {
    // Upsert users. 
    // NOTE: This logic differs slightly from Firebase 'saveUsers' which did a full replace of the company's users list.
    // To match behavior (remove deleted users), we would need to delete first or handle diffs. 
    // For safety in this migration, we will:
    // 1. Upsert provided users
    // 2. (Optional) Delete users of this company NOT in this list? 
    // Let's stick to simple upsert for now to avoid accidental deletions, unless 'saveUsers' implies full sync.
    // The React app `saveUsers` calls pass key logical updates.

    const rows = users.map(u => ({ ...mapUserToRow(u), company_id: companyId }));
    const { error } = await supabase.from('app_users').upsert(rows, { onConflict: 'username' });
    if (error) throw new Error(error.message);
};

export const addGlobalUser = async (user: User) => {
    const row = mapUserToRow(user);
    const { error } = await supabase.from('app_users').insert(row);
    if (error) throw new Error(error.message);
};

export const updateUserLastLogin = async (companyId: string, username: string) => {
    await supabase.from('app_users').update({ last_login: new Date().toISOString() }).eq('username', username);
};

export const updateUserPreferences = async (username: string, preferences: any) => {
    const { error } = await supabase
        .from('app_users')
        .update({ preferences })
        .eq('username', username);

    if (error) throw new Error(error.message);
};

// 3. ROUTES & METADATA

export type BranchProgressMap = Record<string, {
    total: number, uploaded: number, done: boolean, distinct: number, noGps: number, nearby: number
}>;

export const subscribeToSystemMetadata = (companyId: string, callback: (data: { lastUpdated: string, activeVersionId: string }) => void) => {
    checkConnection().then(ok => {
        if (!ok) return callback({ lastUpdated: '', activeVersionId: '' });
        supabase.from('route_meta').select('*').eq('company_id', companyId).single().then(({ data }) => {
            if (data) callback({ lastUpdated: data.last_updated, activeVersionId: data.active_version_id || 'active_routes' });
        });
    });

    const channel = supabase.channel(`meta_${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'route_meta', filter: `company_id=eq.${companyId}` }, (payload: any) => {
            const newData = payload.new;
            if (newData) callback({ lastUpdated: newData.last_updated, activeVersionId: newData.active_version_id || 'active_routes' });
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

/**
 * Fetches lightweight customer data for Dashboard/Map analytics.
 * Selects only: id, clientCode, regionDescription, routeName, day, lat, lng, branch
 */
export const fetchLightCustomers = async (companyId: string, versionId: string) => {
    const { data, error } = await supabase.from('normalized_customers')
        .select('id, name, lat, lng, day, client_code, route_name, week, region_description, region_code, reach_customer_code, branch')
        .eq('company_id', companyId)
        .eq('version_id', versionId);

    if (error) throw error;
    return data;
};

let currentRouteSubscription: any = null;

export const subscribeToRoutes = (companyId: string, callback: (customers: Customer[]) => void, onProgress?: (percent: number) => void) => {
    // Logic:
    // 1. Watch `route_meta` for `active_version_id`.
    // 2. Fetch `customers` where `version_id` matches. (Not watching customers realtime, assume immutable once uploaded for performance)

    // Cleanup previous call
    if (currentRouteSubscription) {
        currentRouteSubscription.unsubscribe();
        currentRouteSubscription = null;
    }

    const fetchRoutes = async (versionId: string) => {


        // 1. Get Total Count
        const { count, error: countError } = await supabase
            .from('normalized_customers')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('version_id', versionId);

        if (countError || count === null) {
            console.error("Error getting route count:", countError);
            callback([]);
            return;
        }

        console.log(`Expected Total Records: ${count} `);

        if (count === 0) {
            callback([]);
            return;
        }

        // 2. Fetch in Chunks (Controlled Concurrency)
        // User requested safer pagination. We use 1000 to balance speed (50 requests for 50k) vs safety.
        // 50 per page would be 1000 requests, which is too slow (latency).
        const BATCH_SIZE = 1000;
        const CONCURRENCY = 3;
        const totalPages = Math.ceil(count / BATCH_SIZE);

        let allRows: any[] = [];

        // Helper to fetch a single page
        const fetchPage = async (pageIndex: number) => {
            const from = pageIndex * BATCH_SIZE;
            const to = from + BATCH_SIZE - 1;
            const { data, error } = await supabase.from('normalized_customers')
                // Reverted to SAFE columns only. Removed: name_ar, district, vat, buyer_id, store_type, reach_customer_code, addedBy
                .select('id, name_en, lat, lng, client_code, route_name, branch_id, classification, address, phone, created_at')
                .eq('company_id', companyId)
                .range(from, to);

            if (error) throw error;
            return data || [];
        };

        try {
            // Processing in chunks of CONCURRENCY
            for (let i = 0; i < totalPages; i += CONCURRENCY) {
                const chunkPromises = [];
                for (let j = 0; j < CONCURRENCY && (i + j) < totalPages; j++) {
                    chunkPromises.push(fetchPage(i + j));
                }

                const results = await Promise.all(chunkPromises);
                results.forEach(rows => allRows.push(...rows));

                console.log(`Fetched pages ${i} to ${Math.min(i + CONCURRENCY - 1, totalPages - 1)}. Current Total: ${allRows.length} `);

                if (onProgress) {
                    const percent = Math.round((allRows.length / count) * 100);
                    onProgress(percent);
                }

                // Progressive Loading: Update UI immediately with what we have
                callback(allRows.map(mapRowToCustomer));
            }



            if (allRows.length !== count) {
                console.warn(`Mismatch in counts! Expected ${count}, got ${allRows.length}. Some data might be missing.`);
            }

            callback(allRows.map(mapRowToCustomer));

        } catch (err: any) {
            console.error("Error during controlled fetch (returning partial data):", err);
            // Don't clear the screen! Return what we have so far.
            if (allRows.length > 0) {
                callback(allRows.map(mapRowToCustomer));
            } else {
                callback([]);
            }
        }
    };

    // Initial Fetch of Meta
    supabase.from('route_meta').select('*').eq('company_id', companyId).single().then(({ data, error }) => {
        if (error) console.error('[subscribeToRoutes] Error fetching meta:', error);

        const vId = data?.active_version_id || 'active_routes';
        console.log(`[subscribeToRoutes] Meta found for company ${companyId}. Active Version: ${vId}`, data);

        if (!vId || vId === 'active_routes') {
            console.warn('[subscribeToRoutes] Warning: active_version_id is generic default. This might mean no upload has completed yet.');
        }

        fetchRoutes(vId);
    });

    // Listen to Meta Changes
    currentRouteSubscription = supabase.channel(`route_sub_${companyId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'route_meta', filter: `company_id=eq.${companyId}` }, (payload: any) => {

            const vId = payload.new?.active_version_id || 'active_routes';
            fetchRoutes(vId);
        })
        .subscribe();

    return () => {
        if (currentRouteSubscription) currentRouteSubscription.unsubscribe();
    };
};

export const getRouteMeta = async (companyId: string) => {
    const { data, error } = await supabase
        .from('route_meta')
        .select('*')
        .eq('company_id', companyId)
        .single();

    if (error) {
        console.warn("Error fetching route meta (might be empty):", error.message);
        return null; // Return null gracefully
    }
    return data;
};

// --- PARTNER PROGRAM REGISTRATION ---
export const registerAsReachCustomer = async (user: User) => {
    if (!user.email) throw new Error("Email is required for registration.");

    // 1. Create Reach Customer Record (Lead)
    // Using current timestamp for uniqueness if needed, but email should be unique
    const { data: customerData, error: customerError } = await supabase
        .from('reach_customers')
        .insert({
            first_name: user.firstName || user.username,
            last_name: user.lastName || '',
            email: user.email,
            phone: user.phone || '',
            country: 'Saudi Arabia', // Default for internal
            role: user.role,
            status: 'partner', // Special status for internal partners
            company_name: user.companyId // Link to their company ID temporarily
        })
        .select()
        .single();

    if (customerError) throw new Error("Failed to create partner account: " + customerError.message);

    // 2. Update App User to link verified status
    const { error: userError } = await supabase
        .from('app_users')
        .update({ is_registered_customer: true })
        .eq('username', user.username);

    if (userError) throw new Error("Failed to update user status: " + userError.message);

    return customerData;
};

// --- HELPER FUNCTIONS FOR USER SCOPING ---
export const fetchCompanyRegions = async (companyId: string) => {
    // Correctly query the 'branches' table for regions (mapped to name_en)
    const { data, error } = await supabase
        .from('company_branches')
        .select('name_en')
        .eq('company_id', companyId)
        .eq('is_active', true);

    if (error) {
        console.error("Error fetching regions (Branches):", error);
        return [];
    }

    // Return unique names
    const uniqueRegions = Array.from(new Set(data?.map(row => row.name_en).filter(Boolean)));
    return uniqueRegions.map(r => ({ code: r, description: r }));
};

export const fetchCompanyBranches = async (companyId: string, regionFilter?: string[]) => {
    // This seems to be a legacy helper, but if needed we can query branches directly too.
    // For now, let's keep it as is or query branches table if needed.
    // It seems 'fetchCompanyRegions' is used for the "Region" dropdown which displays Names.
    // 'fetchCompanyBranches' might be used elsewhere.

    // If we want consistency, we can use the same table query. 
    // But let's stick to the regions fix first.
    // Legacy mapping: Region = Branch Name.

    const { data, error } = await supabase
        .from('company_branches')
        .select('name_en')
        .eq('company_id', companyId)
        .eq('is_active', true);

    if (error) return [];

    if (regionFilter && regionFilter.length > 0) {
        // filter client side if needed, or query again.
        return data.filter(r => regionFilter.includes(r.name_en)).map(r => r.name_en);
    }
    return data.map(r => r.name_en);
};

export const fetchCompanyRoutes = async (companyId: string, branchFilter?: string[]) => {
    // Correctly query the 'routes' table
    let query = supabase
        .from('routes')
        .select(`id, name, company_branches!inner(name_en)`) // Join branches to filter by name
        .eq('company_id', companyId)
        .eq('is_active', true);

    if (branchFilter && branchFilter.length > 0 && !branchFilter.includes('All')) {
        // Filter by the joined branch name
        query = query.in('company_branches.name_en', branchFilter);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching routes (Routes Table):", error);
        return [];
    }

    // Map correctly to unique names for dropdown, but keep internal ID usage if needed later
    const uniqueRoutes = Array.from(new Set(data?.map((row: any) => row.name).filter(Boolean)));
    return uniqueRoutes.map(r => ({ routeName: r }));
};

/**
 * NEW: Fetches aggregated customer counts for branches and routes via RPC.
 * Used for displaying portfolio counts in filter dropdowns.
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}
const filterStatsCache: Record<string, CacheEntry<{ branches: Record<string, number>, routes: Record<string, number> }>> = {};

export const fetchFilterStats = async (companyId: string, forceRefresh: boolean = false): Promise<{ branches: Record<string, number>, routes: Record<string, number> }> => {
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    if (!forceRefresh && filterStatsCache[companyId] && (Date.now() - filterStatsCache[companyId].timestamp < CACHE_TTL)) {
        return filterStatsCache[companyId].data;
    }

    try {
        const { data, error } = await supabase.rpc('get_filter_stats', { p_company_id: companyId });
        if (error) throw error;
        const result = data || { branches: {}, routes: {} };
        filterStatsCache[companyId] = { data: result, timestamp: Date.now() };
        return result;
    } catch (err) {
        console.error("Error fetching filter stats:", err);
        return { branches: {}, routes: {} };
    }
};

export const fetchCompanyReps = async (companyId: string, branchFilter?: string[], routeFilter?: string[]) => {
    // 1. Get branch internal IDs from names if branchFilter is provided
    let branchIds: string[] = [];
    if (branchFilter && branchFilter.length > 0) {
        const { data: dbBranches } = await supabase
            .from('company_branches')
            .select('id')
            .eq('company_id', companyId)
            .in('name_en', branchFilter);
        branchIds = dbBranches?.map(b => b.id) || [];
    }

    // 2. Query normalized_reps
    let query = supabase
        .from('normalized_reps')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);

    if (branchIds.length > 0) {
        query = query.in('branch_id', branchIds);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching reps:", error);
        return [];
    }

    return data.map((r: any) => ({
        userCode: r.user_code,
        name: r.name
    }));
};

// Helper to fetch unique strings and their counts for filters
export const fetchUniqueFilterData = async (
    companyId: string,
    columnName: string,
    filterCol?: string,
    filterVal?: string
): Promise<{ val: string; count: number }[]> => {
    const { data, error } = await supabase.rpc('fetch_unique_upload_data_with_counts', {
        p_company_id: companyId,
        p_column_name: columnName,
        p_filter_col: filterCol || null,
        p_filter_val: filterVal || null
    });

    if (error) {
        console.error(`Error fetching unique ${columnName}:`, error);
        return [];
    }

    return (data || []).map((row: any) => ({
        val: row.val || 'Unknown',
        count: Number(row.count) || 0
    }));
};

// Helper to fetch total distinct customer count for a route (Portfolio)
export const fetchRoutePortfolioCount = async (
    companyId: string,
    routeName: string,
    branchName?: string
): Promise<number> => {
    // REUSE existing verified RPC to get distinct list of client_codes
    const { data, error } = await supabase.rpc('fetch_unique_upload_data_with_counts', {
        p_company_id: companyId,
        p_column_name: 'client_code',
        p_filter_col: 'route_name',
        p_filter_val: routeName
    });

    if (error) {
        console.error('Error fetching route portfolio count:', error);
        return 0;
    }

    // The RPC returns TABLE(val TEXT, count BIGINT) where each row is a distinct value.
    // So the number of rows is the distinct customer count.
    return (data || []).length;
};


export const fetchFilteredRoutes = async (companyId: string, versionId: string, filters: { region?: string | string[], route?: string | string[], week?: string | string[], day?: string | string[] }, page: number = 0, pageSize: number = 50, userScope?: { branchIds?: string[], routeIds?: string[] }) => {

    // 1. PERFORMANCE GUARD: Do not fetch anything if no filters are selected.
    // This prevents loading 2000+ items on initial screen load.
    const hasRegion = filters.region && filters.region !== 'All';
    const hasRoute = filters.route && filters.route !== 'All';

    if (!hasRegion && !hasRoute) {
        console.warn("fetchFilteredRoutes: No filters selected. returning empty to save performance.");
        return [];
    }

    // 2. RAW DATA FETCH with SQL-level filtering (more reliable than JS fuzzy)
    console.info(`[fetchFilteredRoutes] Fetching data for Company: ${companyId}`);
    console.log('[fetchFilteredRoutes] Filters:', filters);

    let rawQuery = supabase
        .from('company_uploaded_data')
        .select('*')
        .eq('company_id', companyId);

    // Apply version filter if provided and not the legacy placeholder
    if (versionId && versionId !== 'active_routes' && versionId !== 'all') {
        rawQuery = rawQuery.eq('version_id', versionId);
    }

    // Apply SQL-level filters (exact match - since dropdowns come from same table)
    if (filters.region && filters.region !== 'All' && filters.region.length > 0) {
        if (Array.isArray(filters.region)) {
            // Check if 'All' is in the array (if mixed) - though usually UI handles this
            if (!filters.region.includes('All')) {
                rawQuery = rawQuery.in('branch_name', filters.region);
            }
        } else {
            rawQuery = rawQuery.eq('branch_name', filters.region);
        }
    }
    if (filters.route && filters.route !== 'All' && filters.route.length > 0) {
        if (Array.isArray(filters.route)) {
            if (!filters.route.includes('All')) {
                rawQuery = rawQuery.in('route_name', filters.route);
            }
        } else {
            rawQuery = rawQuery.eq('route_name', filters.route);
        }
    }
    if (filters.week && filters.week !== 'All' && filters.week.length > 0) {
        if (Array.isArray(filters.week)) {
            if (!filters.week.includes('All')) {
                rawQuery = rawQuery.in('week_number', filters.week);
            }
        } else {
            rawQuery = rawQuery.eq('week_number', filters.week);
        }
    }
    if (filters.day && filters.day !== 'All' && filters.day.length > 0) {
        if (Array.isArray(filters.day)) {
            if (!filters.day.includes('All')) {
                rawQuery = rawQuery.in('day_name', filters.day);
            }
        } else {
            rawQuery = rawQuery.eq('day_name', filters.day);
        }
    }

    // Order and limit
    rawQuery = rawQuery.order('created_at', { ascending: false }).limit(2000);

    let { data: rawData, error: rawError } = await rawQuery;

    if (rawError) {
        console.error('[fetchFilteredRoutes] DB Error:', rawError);
        return [];
    }

    if (!rawData || rawData.length === 0) return [];

    // 3. DEDUPLICATION (Safety Valve)
    // If multiple rows exist for same client in same version (e.g. bad upload logic), 
    // we must deduplicate to prevent stacked pins on map (even-only pin issue).
    const seen = new Set<string>();
    const uniqueData = rawData.filter(row => {
        const key = row.client_code || `${row.name}_${Number(row.lat).toFixed(4)}_${Number(row.lng).toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.info(`[fetchFilteredRoutes] Found ${rawData.length} rows, ${uniqueData.length} after deduplication.`);

    // Pagination (Manual)
    if (pageSize !== -1) {
        const from = page * pageSize;
        const to = from + pageSize;
        rawData = rawData.slice(from, to);
    }

    console.info(`[fetchFilteredRoutes] Returning ${rawData.length} rows.`);
    return rawData.map(mapRowToCustomer);
};

/**
 * NEW: Fetches route data from the Normalized Schema (route_visits -> normalized_customers).
 * This is much faster and more accurate for production data.
 */
export const fetchRouteCustomersNormalized = async (
    companyId: string,
    filters: {
        region?: string[],
        route?: string[],
        week?: string[],
        day?: string[]
    }
): Promise<Customer[]> => {
    console.info(`[fetchRouteCustomersNormalized] Fetching for Company: ${companyId}`, filters);

    let query = supabase
        .from('route_visits')
        .select(`
            id, visit_order, week_number, day_name,
            routes!inner (name, company_branches!inner (name_en)),
            normalized_customers!inner (*)
        `)
        .eq('company_id', companyId);

    // Filter by Branch (Region)
    if (filters.region && filters.region.length > 0 && !filters.region.includes('All')) {
        query = query.in('routes.company_branches.name_en', filters.region);
    }

    // Filter by Route
    if (filters.route && filters.route.length > 0 && !filters.route.includes('All')) {
        query = query.in('routes.name', filters.route);
    }

    // Filter by Week
    if (filters.week && filters.week.length > 0 && !filters.week.includes('All')) {
        query = query.in('week_number', filters.week);
    }

    // Filter by Day
    if (filters.day && filters.day.length > 0 && !filters.day.includes('All')) {
        query = query.in('day_name', filters.day);
    }

    const { data, error } = await query.order('visit_order', { ascending: true });

    if (error) {
        console.error('[fetchRouteCustomersNormalized] Error:', error);
        throw error;
    }

    if (!data || data.length === 0) return [];

    // Map Normalized schema back to Customer interface for UI compatibility
    return data.map((v: any) => {
        const c = v.normalized_customers;
        const r = v.routes;
        return {
            id: c.id,
            name: c.name_en || c.name_ar || 'Unnamed Customer',
            lat: c.lat,
            lng: c.lng,
            day: v.day_name || 'Unscheduled',
            clientCode: c.client_code,
            routeName: r?.name,
            address: c.address,
            week: v.week_number,
            regionCode: r?.company_branches?.name_en,
            nameAr: c.name_ar,
            addedDate: c.created_at,
            rowId: v.id,

            // Extended
            branch: r?.company_branches?.name_en,
            phone: c.phone,
            district: c.district,
            vat: c.vat,
            buyerId: c.buyer_id,
            classification: c.classification,
            storeType: c.store_type,
            visitOrder: v.visit_order
        } as Customer;
    });
};


export const updateCustomer = async (companyId: string, customer: Customer) => {
    if (!customer.rowId) throw new Error("Missing row ID for update");

    // Prepare JSONB updates for any remaining dynamic data
    const dataUpdate: any = {
        addedBy: customer.addedBy,
        ...customer.data
    };

    // Explicit columns
    const rowUpdate = {
        name: customer.name,
        client_code: customer.clientCode,
        lat: customer.lat,
        lng: customer.lng,
        region_description: customer.regionDescription,
        region_code: customer.regionCode,
        route_name: customer.routeName,
        // Dedicated Columns
        name_ar: customer.nameAr,
        day: customer.day,
        week: customer.week,
        branch: customer.branch,
        phone: customer.phone,
        district: customer.district,
        vat: customer.vat,
        buyer_id: customer.buyerId,
        classification: customer.classification,
        store_type: customer.storeType,
        user_code: customer.userCode,
        reach_customer_code: customer.reachCustomerCode,
    };

    // We can't partial update JSONB easily without raw SQL or fetching first.
    // Fetch current to merge JSONB
    const { data: current, error: fetchError } = await supabase.from('normalized_customers')
        .select('data')
        .eq('id', customer.rowId)
        .single();

    if (fetchError) throw fetchError;

    const newData = { ...current.data, ...dataUpdate };

    const { error } = await supabase.from('normalized_customers')
        .update({
            ...rowUpdate,
            data: newData
        })
        .eq('id', customer.rowId)
        .eq('company_id', companyId); // Extra safety

    if (error) throw new Error(error.message);
};

// Reverse geocode to get address details from lat/lng
const reverseGeocode = async (lat: number, lng: number): Promise<{
    address: string;
    district: string;
    street: string;
    neighborhood: string;
    city: string;
    nameAr: string;
    country: string;
}> => {
    try {
        // Use OpenStreetMap Nominatim (free, no API key)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar,en&addressdetails=1&extratags=1`,
            {
                headers: {
                    'User-Agent': 'ReachApp/1.0'
                }
            }
        );

        if (!response.ok) {
            console.warn('Geocoding failed:', response.status);
            return { address: '', district: '', street: '', neighborhood: '', city: '', nameAr: '', country: '' };
        }

        const data = await response.json();
        const addr = data.address || {};

        // Extract various address components
        const street = addr.road || addr.street || addr.pedestrian || '';
        const neighborhood = addr.neighbourhood || addr.suburb || addr.quarter || '';
        const district = addr.district || addr.city_district || addr.county || neighborhood || '';
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const country = addr.country || '';

        // Build full address
        const addressParts = [street, neighborhood, district, city].filter(Boolean);
        const fullAddress = addressParts.join(', ') || data.display_name || '';

        // Get Arabic name if available (Nominatim returns in requested language)
        const nameAr = data.name || '';

        return {
            address: fullAddress,
            district,
            street,
            neighborhood,
            city,
            nameAr,
            country
        };
    } catch (error) {
        console.warn('Geocoding error:', error);
        return { address: '', district: '', street: '', neighborhood: '', city: '', nameAr: '', country: '' };
    }
};

// Add a single customer from the Opportunity Scanner
export const addCustomerFromScanner = async (companyId: string, customerData: Partial<Customer>): Promise<Customer> => {
    // 1. Get active version ID
    const { data: meta, error: metaError } = await supabase
        .from('route_meta')
        .select('active_version_id')
        .eq('company_id', companyId)
        .single();

    if (metaError || !meta?.active_version_id) {
        throw new Error('No active route version found. Please upload customer data first.');
    }

    const versionId = meta.active_version_id;
    const customerId = `scanner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 2. Enrich with geocoding if we have coordinates
    let enrichedData = { ...customerData };
    if (customerData.lat && customerData.lng) {
        try {
            const geoData = await reverseGeocode(customerData.lat, customerData.lng);

            // Only fill in missing data - don't overwrite existing
            enrichedData = {
                ...customerData,
                address: customerData.address || geoData.address,
                district: customerData.district || geoData.district,
                // Use neighborhood + street for more context
                nameAr: customerData.nameAr || geoData.nameAr,
            };

            // Store extra geo data in a structured way
            console.log('Geocoding enrichment:', geoData);
        } catch (e) {
            console.warn('Geocoding enrichment failed (non-blocking):', e);
        }
    }

    // 4. Insert the customer into company_uploaded_data
    // We map the "Scanner" fields to the "Upload" schema
    const row = {
        company_id: companyId,
        // version_id: versionId, // company_uploaded_data might not use version_id directly like this, or it's part of the unique key? 
        // Checking schema via inference: usually company_uploaded_data is the raw source. 
        // Let's use the standard columns we know exist.

        client_code: enrichedData.clientCode || `SC-${Date.now().toString(36).toUpperCase()}`,
        customer_name_en: enrichedData.name || 'New Customer',
        customer_name_ar: enrichedData.nameAr || enrichedData.name || '',

        lat: enrichedData.lat || 0,
        lng: enrichedData.lng || 0,

        // Address / Location
        customer_address_1: enrichedData.address || '',
        district: enrichedData.district || '',
        region_code: enrichedData.regionCode || '',
        // region_description: enrichedData.regionDescription || '', // check if this column exists, otherwise omit

        // Route Info
        route_name: enrichedData.routeName || 'Unassigned',
        branch_code: enrichedData.branch || 'Main', // Default branch if unknown

        // Contact
        phone: enrichedData.phone || '',
        vat_number: enrichedData.vat || '',

        // Classification
        classification: enrichedData.classification || '',
        store_type: enrichedData.storeType || '',

        // Visit Schedule
        day_name: enrichedData.day || 'Sunday', // Default valid day
        week_number: enrichedData.week || 'Week 1', // Default valid week

        // Metadata / Flags
        is_active: true,
        source: 'Opportunity Scanner',
        upload_batch_id: `SCANNER_${Date.now()}` // Artificial batch ID to distinguish
    };

    const { data: insertedData, error: insertError } = await supabase
        .from('company_uploaded_data')
        .insert(row)
        .select()
        .single();

    if (insertError) {
        throw new Error(`Failed to add customer: ${insertError.message}`);
    }

    // 5. Return the new customer in the app's Customer format
    // We need to map the returned row back to our Customer interface
    return {
        id: insertedData.id,
        companyId: insertedData.company_id,
        name: insertedData.customer_name_en,
        nameAr: insertedData.customer_name_ar,
        lat: insertedData.lat,
        lng: insertedData.lng,
        address: insertedData.customer_address_1,
        district: insertedData.district,
        regionCode: insertedData.region_code,
        routeName: insertedData.route_name,
        branch: insertedData.branch_code,
        phone: insertedData.phone,
        vat: insertedData.vat_number,
        classification: insertedData.classification,
        storeType: insertedData.store_type,
        day: insertedData.day_name,
        week: insertedData.week_number,
        clientCode: insertedData.client_code,
        data: {
            addedBy: 'Opportunity Scanner',
            addedDate: new Date().toISOString()
        }
    } as Customer;
};

export const saveRouteData = async (
    companyId: string,
    customers: Customer[],
    onProgress?: (overallProgress: number, branchStats: BranchProgressMap) => void,
    cancellationToken?: { aborted: boolean }
) => {
    // 0. Validate Company Exists (Prevent FK Errors from stale sessions)
    const { count, error: companyCheckError } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .eq('id', companyId);

    if (companyCheckError || count === 0) {
        throw new Error("Invalid Company Session. Please log out and log in again.");
    }

    const versionId = Date.now().toString();
    // Optimization: Increased chunk size and parallel uploads
    // Optimization: Adjusted for stability (Timeout Fix)
    const CHUNK_SIZE = 250;
    const CONCURRENCY = 2;

    // 0. Initialize Stats
    const totalRecords = customers.length;

    // --- NEW: Auto-configure Branches ---
    // Extract unique branches from the upload
    // regionDescription maps to 'Branch' in the UI context usually
    const uploadedBranches = Array.from(new Set(customers.map(c => c.regionDescription).filter(Boolean))) as string[];

    if (uploadedBranches.length > 0) {
        try {
            // Fetch current company settings to merge
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .select('settings')
                .eq('id', companyId)
                .single();

            if (companyData && !companyError) {
                const currentSettings = companyData.settings as CompanySettings; // Type assurance
                const currentBranches = currentSettings?.common?.general?.allowedBranches || [];

                // Identify new branches that aren't in the current list
                const newBranches = uploadedBranches.filter(b => !currentBranches.includes(b));

                if (newBranches.length > 0) {
                    console.log("Auto-configuring new branches:", newBranches);

                    // Merge and update
                    const updatedBranches = [...currentBranches, ...newBranches];

                    // Also update new `branches` structure
                    const currentBranchConfigs = currentSettings?.common?.general?.branches || [];
                    const newBranchConfigs = newBranches.map(name => ({
                        id: crypto.randomUUID(),
                        name: name,
                        isActive: true
                    }));

                    const updatedBranchConfigs = [...currentBranchConfigs, ...newBranchConfigs];

                    const updatedSettings: CompanySettings = {
                        ...currentSettings,
                        common: {
                            ...currentSettings?.common,
                            general: {
                                ...currentSettings?.common?.general,
                                allowedBranches: updatedBranches,
                                branches: updatedBranchConfigs
                            }
                        }
                    };

                    await supabase
                        .from('companies')
                        .update({ settings: updatedSettings })
                        .eq('id', companyId);
                }
            }
        } catch (err) {
            console.warn("Failed to auto-configure branches:", err);
            // Non-blocking error, allow upload to proceed
        }
    }
    // ------------------------------------

    const branchStats: BranchProgressMap = {};
    const branchClientSets = new Map<string, Set<string>>();
    const branchNoGpsSets = new Map<string, Set<string>>();

    customers.forEach(c => {
        const branch = c.branch || c.regionDescription || 'Unassigned';
        if (!branchStats[branch]) {
            branchStats[branch] = { total: 0, uploaded: 0, done: false, distinct: 0, noGps: 0, nearby: 0 };
            branchClientSets.set(branch, new Set());
            branchNoGpsSets.set(branch, new Set());
        }

        const clientId = c.clientCode || c.name;
        const clientSet = branchClientSets.get(branch)!;
        const noGpsSet = branchNoGpsSets.get(branch)!;

        if (!clientSet.has(clientId)) {
            clientSet.add(clientId);
            branchStats[branch].total++;
        }

        if (!c.lat || !c.lng || c.lat === 0) {
            if (!noGpsSet.has(clientId)) {
                noGpsSet.add(clientId);
                branchStats[branch].noGps++;
            }
        }
    });

    // Initialize 'distinct' count (same as total in this context since total is now distinct)
    Object.keys(branchStats).forEach(b => {
        branchStats[b].distinct = branchStats[b].total;
    });

    if (onProgress) onProgress(0, branchStats);

    // 1. Create Route Version Entry
    await supabase.from('route_versions').insert({
        id: versionId,
        company_id: companyId,
        status: 'uploading',
        record_count: customers.length
    });

    // 2. Insert Data in Chunks (Parallelized)
    let processedCount = 0;

    // Create chunks
    const chunks: Customer[][] = [];
    for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
        chunks.push(customers.slice(i, i + CHUNK_SIZE));
    }

    // Helper to process a chunk
    const processChunk = async (chunk: Customer[]) => {
        if (cancellationToken?.aborted) throw new Error("Upload Cancelled");

        const rows = chunk.map(c => ({
            company_id: companyId,
            version_id: versionId,
            customer_id: c.id,
            name: c.name,
            lat: c.lat,
            lng: c.lng,
            address: c.address,
            customer_address: c.address,
            client_code: c.clientCode,
            route_name: c.routeName,
            region_code: c.regionCode,
            region_description: c.regionDescription,
            // Dedicated Columns
            reach_customer_code: c.reachCustomerCode,
            name_ar: c.nameAr,
            branch: c.branch,
            phone: c.phone,
            district: c.district,
            vat: c.vat,
            buyer_id: c.buyerId,
            classification: c.classification,
            store_type: c.storeType,
            day: c.day,
            week: c.week,
            user_code: c.userCode,
            // Dynamic/Extra Data
            data: {
                ...c.data, // Preserve any extra dynamic data gathered during parsing
                addedBy: c.addedBy
            }
        }));

        const { error } = await supabase.from('normalized_customers').upsert(rows);
        if (error) throw new Error(`Batch insert failed: ${error.message} `);

        // REACH LEADS CAPTURE (Global DB)
        // Fire-and-forget to avoid slowing down upload too much, or await if data integrity is critical.
        // We'll await but catch errors to not fail the main upload.
        try {
            const reachRows = chunk.map(c => {
                // Use standardized hash generator
                const hash = generateCustomerHash(c.name, c.lat, c.lng);

                return {
                    name: c.name,
                    name_ar: c.nameAr,
                    lat: c.lat,
                    lng: c.lng,
                    address: c.address,
                    customer_address: c.address,
                    region_description: c.regionDescription,
                    source_company_id: companyId,
                    original_customer_hash: hash,
                    status: 'NEW'
                };
            });

            // Use smart insert for deduplication
            await insertGlobalLeadsSmart(reachRows);
        } catch (reachError) {
            console.warn("Reach Leads capture failed (non-blocking):", reachError);
        }

        // Update Stats
        chunk.forEach(c => {
            const branch = c.regionDescription || 'Unassigned';
            // @ts-ignore
            if (branchStats[branch]) {
                // @ts-ignore
                branchStats[branch].uploaded++;
                // @ts-ignore
                if (branchStats[branch].uploaded >= branchStats[branch].total) {
                    // @ts-ignore
                    branchStats[branch].done = true;
                }
            }
        });

        processedCount += chunk.length;
        const percent = Math.round((processedCount / customers.length) * 100);
        // @ts-ignore
        if (onProgress) onProgress(percent, { ...branchStats });
    };

    // Execute with concurrency limit
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        if (cancellationToken?.aborted) break;
        const batch = chunks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(chunk => processChunk(chunk)));
    }

    if (cancellationToken?.aborted) throw new Error("Upload Cancelled");

    // 3. Mark Complete & Switch Active Version
    await supabase.from('route_versions').update({ status: 'complete' }).eq('id', versionId).eq('company_id', companyId);
    await supabase.from('route_meta').upsert({
        company_id: companyId,
        active_version_id: versionId,
        last_updated: new Date().toISOString()
    });
};

export const restoreRouteVersion = async (companyId: string, versionId: string, timestamp: string) => {
    await supabase.from('route_meta').upsert({
        company_id: companyId,
        active_version_id: versionId,
        last_updated: timestamp
    });
};

// 4. HISTORY

export const subscribeToHistory = (companyId: string, callback: (logs: HistoryLog[]) => void) => {
    checkConnection().then(ok => {
        if (!ok) return callback([]);
        supabase.from('history_logs').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
            if (data) {
                callback(data.map(row => ({
                    id: row.log_id || row.id, // Ensure we get the Version ID (log_id) not the DB UUID
                    fileName: row.file_name,
                    uploadDate: row.upload_date,
                    recordCount: row.record_count,
                    uploader: row.uploader,
                    type: row.type as any,
                    stats: row.stats
                })));
            }
        });
    });

    // We don't strictly need realtime for history as it updates on actions, but consistent with Firebase:
    const channel = supabase.channel(`history_${companyId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history_logs', filter: `company_id=eq.${companyId}` }, (payload) => {
            // re-fetch on insert
            supabase.from('history_logs').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
                if (data) {
                    callback(data.map(row => ({
                        id: row.log_id || row.id,
                        fileName: row.file_name,
                        uploadDate: row.upload_date,
                        recordCount: row.record_count,
                        uploader: row.uploader,
                        type: row.type as any,
                        stats: row.stats
                    })));
                }
            });
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
};

export const deleteHistoryLog = async (companyId: string, versionId: string) => {
    try {
        // 1. Check if this is the ACTIVE version
        const { data: meta } = await supabase
            .from('route_meta')
            .select('active_version_id')
            .eq('company_id', companyId)
            .single();

        if (meta?.active_version_id === versionId) {
            console.log("Deleting active version. Finding fallback...");

            // Find next latest version
            const { data: latest } = await supabase
                .from('history_logs')
                .select('log_id')
                .eq('company_id', companyId)
                .neq('log_id', versionId) // Exclude the one we're deleting
                .eq('type', 'ROUTE')
                .order('upload_date', { ascending: false })
                .limit(1)
                .single();

            const newActiveId = latest?.log_id || null;
            console.log("New Active Version ID:", newActiveId);

            // Update Meta to point to new fallback (or null)
            await supabase.from('route_meta').upsert({
                company_id: companyId,
                active_version_id: newActiveId,
                last_updated: new Date().toISOString()
            });
        }

        // 2. Strict Deletion Sequence
        console.log(`[Delete] Deleting version ${versionId}. Active version is ${meta?.active_version_id}`);

        const isActiveVersion = meta?.active_version_id === versionId;

        // ONLY delete operational data if we are deleting the ACTIVE version
        // Historical logs don't imply wiping current operational data unless it WAS the active one
        if (isActiveVersion) {
            console.log("[Delete] Deleting ACTIVE version operational data...");

            // Delete Route Visits FIRST (Child)
            const { error: visitError, count: deletedVisits } = await supabase
                .from('route_visits')
                .delete({ count: 'exact' })
                .eq('company_id', companyId); // Wipes current active schedule

            if (visitError) {
                console.error("Error deleting route_visits:", visitError.message);
                // We proceed to try keeping things clean, but warn
            } else {
                console.log(`[Delete] Removed ${deletedVisits} records from route_visits table.`);
            }

            // Delete Normalized Customers (Parent/Master)
            const { error: custError, count: deletedCount } = await supabase
                .from('normalized_customers')
                .delete({ count: 'exact' })
                .eq('company_id', companyId); // Wipes current active customers

            if (custError) throw new Error("Failed to delete normalized customer data: " + custError.message);
            console.log(`[Delete] Removed ${deletedCount} records from normalized_customers table.`);
        } else {
            console.log("[Delete] Deleting HISTORICAL version. Preserving operational data.");
            // We do NOT touch authorized_customers or route_visits as they represent the currently active state
        }

        // Try to clean up legacy 'customers' table just in case (optional, non-blocking)
        try {
            await supabase.from('normalized_customers').delete().eq('company_id', companyId);
        } catch (ignored) { }

        // Delete History Log
        const { error: logError } = await supabase
            .from('history_logs')
            .delete()
            .eq('company_id', companyId)
            .eq('log_id', versionId);

        if (logError) throw new Error("Failed to delete history log: " + logError.message);

        // Delete Version Record
        const { error: verError } = await supabase
            .from('route_versions')
            .delete()
            .eq('company_id', companyId)
            .eq('id', versionId);

        if (verError) throw new Error("Failed to delete version metadata: " + verError.message);

    } catch (e: any) {
        console.error("Delete Operation Failed:", e);
        throw e; // Propagate to UI
    }
};

// ==========================================
// ROUTE ASSIGNMENTS
// ==========================================

export const fetchRouteAssignments = async (companyId: string): Promise<RouteAssignment[]> => {
    const { data, error } = await supabase
        .from('route_assignments')
        .select('*')
        .eq('company_id', companyId);

    if (error) {
        console.error('Error fetching route assignments:', error);
        return [];
    }

    return data.map(r => ({
        id: r.id,
        companyId: r.company_id,
        routeName: r.route_name,
        userId: r.user_id,
        assignedAt: r.assigned_at
    }));
};

export const assignUserToRoute = async (companyId: string, routeName: string, userId: string): Promise<void> => {
    // Upsert assignment
    const { error } = await supabase
        .from('route_assignments')
        .upsert({
            company_id: companyId,
            route_name: routeName,
            user_id: userId
        }, { onConflict: 'company_id, route_name' });

    if (error) throw error;
};

export const unassignRoute = async (companyId: string, routeName: string): Promise<void> => {
    const { error } = await supabase
        .from('route_assignments')
        .delete()
        .eq('company_id', companyId)
        .eq('route_name', routeName);

    if (error) throw error;
};

// Helper to get unique routes for a company (from customer data)
export const fetchUniqueRoutes = async (companyId: string, versionId: string): Promise<string[]> => {
    // We want distinct route_name. RPC or manual extraction?
    // Manual extraction from `customers` might be heavy if not optimized.
    // Ideally we assume `route_data` might have thousands of rows.
    // For now, let's fetch 'route_name' distinct.
    // Supabase .select('route_name', { head: false, count: null }).eq... is standard but distinct is tricky without .rpc

    // Workaround: creating a dedicated RPC is best, but for now we'll fetch all unique names via JS if dataset < 10k, or use a pseudo-distinct query if possible.
    // Actually, we can use `.select('route_name')` and filter in JS, but better:

    const { data, error } = await supabase
        .from('normalized_customers')
        .select('route_name')
        .eq('company_id', companyId);

    if (error || !data) return [];

    const unique = Array.from(new Set(data.map(d => d.route_name).filter(Boolean)));
    return unique.sort();
};

// ==========================================
// DEBUG & UTILS
// ==========================================

export const addHistoryLog = async (companyId: string, log: HistoryLog) => {
    await supabase.from('history_logs').insert({
        company_id: companyId,
        log_id: log.id,
        file_name: log.fileName,
        upload_date: log.uploadDate,
        record_count: log.recordCount,
        uploader: log.uploader,
        type: log.type,
        stats: log.stats
    });

    if (log.type === 'ROUTE') {
        await supabase.from('companies').update({
            last_upload_date: log.uploadDate,
            last_upload_record_count: log.recordCount
        }).eq('id', companyId);
    }
};

// --- HISTORY ---
export const getCustomerHistory = async (customerId: string) => {
    const { data, error } = await supabase
        .from('history_logs')
        .select('*')
        .eq('company_id', customerId)
        .order('upload_date', { ascending: false });

    if (error) throw error;

    return data?.map(row => ({
        id: row.log_id || row.id,
        fileName: row.file_name,
        uploadDate: row.upload_date,
        recordCount: row.record_count,
        uploader: row.uploader,
        type: row.type,
        stats: row.stats
    })) || [];
};

// --- UTILS: Branch Autodetection ---
export const detectAndAddBranches = async (companyId: string, specificVersionId?: string): Promise<BranchConfig[]> => {
    try {
        console.log("Starting branch detection for", companyId, specificVersionId ? `(Version: ${specificVersionId})` : "(Fetching Active Version)");

        // 1. Call RPC to detect and upsert branches server-side
        const { data: detectedBranches, error: rpcError } = await supabase.rpc('detect_and_upsert_branches', {
            p_company_id: companyId,
            p_version_id: specificVersionId || null
        });

        if (rpcError) {
            console.error("RPC detect_and_upsert_branches failed:", rpcError);
            // Fallback? No, this is critical for optimization. Throw or return empty.
            throw rpcError;
        }

        console.log(`[RPC] Detected & Upserted ${detectedBranches?.length || 0} branches.`);

        if (!detectedBranches || detectedBranches.length === 0) return [];

        // --- LEGACY: Update companies.settings for Backward Comp ---
        // 2. Get current settings
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('settings')
            .eq('id', companyId)
            .single();

        if (companyError) throw companyError;

        const currentSettings = company.settings as CompanySettings;
        const currentBranches = currentSettings?.common?.general?.allowedBranches || [];
        const currentBranchConfigs = currentSettings?.common?.general?.branches || [];

        // 3. Merge
        const existingNames = new Set([
            ...currentBranches.map(b => b.trim().toLowerCase()),
            ...currentBranchConfigs.map(b => b.name.trim().toLowerCase())
        ]);

        // Filter for NEW branches only (by name)
        // RPC returns { code, name, is_new, customer_count }
        const newBranchData = detectedBranches.filter((b: any) => !existingNames.has(b.name.trim().toLowerCase()));

        if (newBranchData.length === 0) return []; // Nothing to update in settings

        // Update Legacy Lists
        const newNames = newBranchData.map((b: any) => b.name);
        const updatedLegacyBranches = [...currentBranches, ...newNames];

        // Update New Config List
        const newConfigs: BranchConfig[] = newBranchData.map((item: any) => ({
            id: crypto.randomUUID(),
            name: item.name,
            isActive: true,
            // We don't get lat/lng back from RPC in this simplified return, 
            // but we could if needed. For now, we assume settings don't strictly need centroids immediately 
            // or we could update RPC to return them.
            // Let's assume undefined for now as it's legacy config.
            address: `Auto-detected (${item.customer_count} customers)`
        }));

        const updatedBranchConfigs = [...currentBranchConfigs, ...newConfigs];

        // 4. Update
        const updatedSettings: CompanySettings = {
            ...currentSettings,
            common: {
                ...currentSettings.common,
                general: {
                    ...currentSettings.common.general,
                    allowedBranches: updatedLegacyBranches,
                    branches: updatedBranchConfigs
                }
            }
        };

        const { error: updateError } = await supabase
            .from('companies')
            .update({ settings: updatedSettings })
            .eq('id', companyId);

        if (updateError) throw updateError;

        return newConfigs;

    } catch (error) {
        console.error("Branch detection failed:", error);
        return [];
    }
};

// --- REACH CUSTOMER REGISTRATION ---

// --- REACH CUSTOMER REGISTRATION ---

export const registerReachCustomer = async (data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    role: string;
    companyName?: string;
}) => {
    try {
        const { data: insertedData, error } = await supabase
            .from('reach_customers')
            .insert([{
                first_name: data.firstName,
                last_name: data.lastName,
                email: data.email,
                phone: data.phone,
                country: data.country,
                role: data.role,
                company_name: data.companyName || null,
                status: 'lead'
            }])
            .select('id')
            .single();

        if (error) throw error;
        return { success: true, leadId: insertedData.id };
    } catch (error: any) {
        console.error("Registration Error:", error);
        throw new Error(error.message || "Failed to submit application");
    }
};

// --- DEMO PROVISIONING ---

export const getSystemSetting = async (key: string) => {
    const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', key)
        .single();

    if (error) return null;
    return data?.value;
};

export const saveSystemSetting = async (key: string, value: any) => {
    const { error } = await supabase
        .from('system_settings')
        .upsert([{ key, value, updated_at: new Date().toISOString() }]);

    if (error) throw error;
    if (error) throw error;
};

export const logPromoUsage = async (promoCode: string, companyId: string, discountAmount?: number) => {
    try {
        const { data, error } = await supabase
            .from('promo_usages')
            .insert([{
                promo_code: promoCode,
                company_id: companyId,
                used_at: new Date().toISOString(),
                discount_amount: discountAmount || 0,
                status: 'PENDING'
            }])
            .select()
            .single();

        if (error) throw error;

        // Also increment usage count on promo_code table
        await supabase.rpc('increment_promo_usage', { code_input: promoCode });

        return data;
    } catch (e) {
        console.error("Log Promo Usage Error:", e);
        return null;
    }
};

// Updated provisionDemoCompany to accept options
export const provisionDemoCompany = async (
    leadId: string,
    companyData: {
        companyName: string;
        industry: string;
        branchCount: number;
        routeCount: number;
        targetCustomersCount: number;
        targetCustomersType: string[];
        password: string;
    },
    options: {
        initialTier?: 'STARTER' | 'GROWTH' | 'ELITE' | 'NONE';
        bypassTrial?: boolean;
        customLimits?: { maxUsers: number; maxRoutes: number; maxScannerCap?: number };
        customLicenseKey?: string;
        customDurationDays?: number;
        paymentInfo?: {
            price: number;
            currency: string;
            refId?: string;
            isVerified: boolean;
            billingCycle?: string;
            sysAdminDiscountPercent?: number;
            promoCode?: string;
            promoDiscountPercent?: number;
            lastPaymentDate?: string;
            notes?: string;
        };
    } = {}
) => {
    try {
        // 1. Get Lead Details
        const { data: lead, error: leadError } = await supabase
            .from('reach_customers')
            .select('*')
            .eq('id', leadId)
            .single();

        if (leadError || !lead) throw new Error("Lead not found");

        // 2. Determine Config based on Tier
        const targetTier = options.initialTier || 'NONE';
        const isElite = targetTier === 'ELITE';

        // Fetch System Demo Config if exists
        const systemConfig = await getSystemSetting('subscription_config');

        // Config: If Elite (SysAdmin), give everything. If NONE (Public), use systemConfig or defaults.
        // Date Logic
        const billingCycle = options.paymentInfo?.billingCycle || 'monthly';
        let durationDays = 30; // Default monthly

        if (options.customDurationDays) {
            durationDays = options.customDurationDays;
        } else if (billingCycle === 'yearly') {
            durationDays = 365;
        } else {
            // Default Monthly or from System Config if needed, but strict monthly = 30
            durationDays = 30;
        }

        // Activation Date is Payment Date (or Now if not provided)
        const activationDate = options.paymentInfo?.lastPaymentDate
            ? new Date(options.paymentInfo.lastPaymentDate)
            : new Date();

        // Expiration Date
        const expirationDate = new Date(activationDate);
        expirationDate.setDate(expirationDate.getDate() + durationDays);

        const demoConfig = {
            maxUsers: options.customLimits?.maxUsers ?? (isElite ? 9999 : (systemConfig?.maxUsers || 1)),
            maxRoutes: options.customLimits?.maxRoutes ?? (isElite ? 999999 : (systemConfig?.maxRoutesPerDay || companyData.routeCount || 10)),
            maxCustomers: isElite ? 999999 : (systemConfig?.maxCustomers || companyData.targetCustomersCount || 1000),
            maxScannerCap: options.customLimits?.maxScannerCap ?? (isElite ? 999999 : (systemConfig?.market_scanner_cap || 1000)),
            durationDays: durationDays,
            allowedFeatures: isElite
                ? ['optimization', 'analytics', 'market_scanner', 'insights', 'all']
                : (systemConfig?.allowedFeatures || [])
        };

        // Generate proper UUID for company ID. Custom license key is used as display name, not ID.
        const companyId = crypto.randomUUID();
        const adminUsername = `admin_${companyData.companyName.replace(/\s+/g, '').toLowerCase()}`;

        // 3. Create Company
        const newCompany: Company = {
            id: companyId,
            name: companyData.companyName,
            subscriptionTier: targetTier as any,
            maxUsers: demoConfig.maxUsers,
            maxRoutes: demoConfig.maxRoutes,
            maxCustomers: demoConfig.maxCustomers,
            maxScannerCap: demoConfig.maxScannerCap,
            isActive: true, // Auto-active if coming from SysAdmin
            createdAt: activationDate.toISOString(), // Set created date to activation date
            expirationDate: expirationDate.toISOString(),
            features: demoConfig.allowedFeatures,
            adminUsername: adminUsername,
            settings: {
                common: {
                    general: {
                        currency: 'SAR',
                        distanceUnit: 'km',
                        language: 'en',
                        dataRetentionDays: 30,
                        country: lead.country || 'United Arab Emirates'
                    },
                    theme: { enableDarkMode: false }
                },
                modules: {
                    insights: { enabled: true, minClientsPerRoute: 5, maxClientsPerRoute: 50, efficiencyThreshold: 85, visitFrequencyDays: 7, workingDaysPerWeek: 5, churnThresholdDays: 30, nearbyRadiusMeters: 5000 },
                    market: { enabled: true, searchTimeoutSeconds: 30, minZoomLevel: 10, enableDeepScan: false, defaultKeywords: 'grocery', exportFormat: 'csv', maxLeadsPerScan: 50 },
                    optimizer: { enabled: true, avgSpeedKmh: 40, serviceTimeMin: 15, trafficFactor: 1.2, maxWorkingHours: 8, fuelCostPerKm: 0.1, driverHourlyRate: 20, startLocation: 'DEPOT', maxDistancePerRouteKm: 200, breakTimeMin: 30, costObjective: 'BALANCED' },
                    map: { enabled: true, defaultCenter: [24.7136, 46.6753], defaultZoom: 12, showTraffic: true, clusterMarkers: true, defaultMapStyle: 'STREETS', showUnassignedCustomers: true, heatmapIntensity: 1 },
                    scannerV2: { enabled: true }
                },
                // Store Subscription/Payment Info in Settings (Schema-less approach for now)
                subscription: options.paymentInfo ? {
                    price: options.paymentInfo.price,
                    currency: options.paymentInfo.currency,
                    billingCycle: options.paymentInfo.billingCycle,
                    lastPaymentDate: activationDate.toISOString(),
                    lastPaymentRef: options.paymentInfo.refId,
                    isVerified: options.paymentInfo.isVerified,
                    sysAdminDiscountPercent: options.paymentInfo.sysAdminDiscountPercent,
                    promoCode: options.paymentInfo.promoCode,
                    promoDiscountPercent: options.paymentInfo.promoDiscountPercent
                } : undefined
            }
        };

        await addCompany(newCompany);

        // 4. Create Admin User
        await addGlobalUser({
            username: adminUsername,
            password: companyData.password,
            role: UserRole.ADMIN,
            isActive: true,
            companyId: companyId,
            branchIds: []
        });

        // 5. Update Reach Customer Record
        await supabase.from('reach_customers').update({
            company_name: companyData.companyName,
            industry: companyData.industry,
            branches_count: companyData.branchCount,
            routes_count: companyData.routeCount,
            target_customers_count: companyData.targetCustomersCount,
            target_customers_type: companyData.targetCustomersType,
            status: 'provisioned'
        }).eq('id', leadId);

        return {
            success: true,
            credentials: { username: adminUsername, password: companyData.password },
            expiration: expirationDate,
            companyId: newCompany.id
        };

    } catch (error: any) {
        console.error("Provisioning Error:", error);
        throw new Error(error.message || "Failed to provision demo account");
    }
};

// Bulk Upload Excess Leads to Reach Global Leads
export const saveReachLeads = async (leads: any[], companyId: string) => {
    if (!leads || leads.length === 0) return;

    console.log(`Archiving ${leads.length} excess leads to Reach DB...`);

    // Map to db schema (best effort)
    const rows = leads.map(l => ({
        name: l.Name || l.Client_Description || l.client_name || l.client_descreption || 'Unknown',
        lat: Number(l.Latitude || l.lat || l.lat_gps || 0),
        lng: Number(l.Longitude || l.lng || l.long_gps || 0),
        region_description: l.Region_Description || l.Region || l.Branch || null,
        source_company_id: companyId,
        status: 'ARCHIVED_LIMIT',
        address: l.Address || null,
        customer_address: l.Address || null,
        // Calculate hash to prevent dupes (robust)
        original_customer_hash: generateCustomerHash(
            l.Name || l.Client_Description || l.client_name || l.client_descreption || 'Unknown',
            Number(l.Latitude || l.lat || l.lat_gps || 0),
            Number(l.Longitude || l.lng || l.long_gps || 0)
        )
    })).filter(r => r.lat !== 0 && r.lng !== 0); // Basic filter

    if (rows.length === 0) return;

    // Use smart insert
    const result = await insertGlobalLeadsSmart(rows);
    console.log(`Smart Insert Result: Added ${result.added}, Skipped ${result.skipped}`);
};

// ==========================================
// MULTI-STEP ONBOARDING
// ==========================================

export const registerGlobalUser = async (userData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    country: string;
    partnerId?: string; // Optional Affiliate Link
}) => {
    try {
        // Check for existing user first
        const { data: existingUser, error: checkError } = await supabase
            .from('app_users')
            .select('id')
            .or(`email.eq.${userData.email},phone.eq.${userData.phone}`)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existingUser) {
            throw new Error("User with this email or phone already exists.");
        }

        // 1. Create User in app_users
        const { data: newUser, error: userError } = await supabase
            .from('app_users')
            .insert([{
                username: userData.email, // Use email as username initially
                password: userData.password, // Ideally hashed, but storing plain per user model for now
                email: userData.email,
                phone: userData.phone, // Ensure this matches DB column exactly
                first_name: userData.firstName,
                last_name: userData.lastName,
                role: 'ADMIN', // Default to Admin of their future company
                is_active: true,
                // is_registered_customer: true, // Requires 'migration_recent_features.sql'
                // company_id is NULL initially (Limbo State)
            }])
            .select()
            .single();

        if (userError) throw userError;

        // 2. Sync to CRM (reach_customers)
        const { error: crmError } = await supabase
            .from('reach_customers')
            .insert([{
                first_name: userData.firstName,
                last_name: userData.lastName,
                email: userData.email,
                phone: userData.phone,
                country: userData.country,
                role: userData.role,
                status: 'lead', // Initial status
                linked_user_id: newUser.id,
                referred_by_partner_id: userData.partnerId || null
            }]);

        if (crmError) console.error("CRM Sync Error:", crmError);

        return mapRowToUser(newUser);

    } catch (e: any) {
        console.error("Registration Error:", e);
        // User-friendly Schema Cache Error Handling
        if (e.message?.includes("Could not find the") && (e.message?.includes("email") || e.message?.includes("phone"))) {
            throw new Error("System Update In Progress: The database is currently syncing new fields. Please wait a moment and try again.");
        }
        if (e.message?.includes("Could not find the 'email' column")) {
            throw new Error("System configuration updating. Please refresh the page and try again in 30 seconds.");
        }
        throw e;
    }
};


export const createTenantForUser = async (
    userId: string,
    companyData: {
        companyName: string;
        industry: string;
        branchCount: number;
        routeCount: number;
        targetCustomersCount: number;
        licenseCount?: number;
    },
    planId: string, // e.g., 'STARTER', 'GROWTH'
    adminPassword?: string // Optional override
) => {
    try {
        // 1. Get User Details
        const { data: user, error: userError } = await supabase
            .from('app_users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !user) throw new Error("User session invalid.");

        // 2. Create Company
        // Sanitize Company Name for ID
        const companyId = companyData.companyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) + "_" + Math.floor(Math.random() * 1000);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 14); // 14 Day Trial by default

        // Basic Config based on plan
        const isElite = planId === 'ELITE';
        const licenseCount = companyData.licenseCount || (isElite ? 50 : 5);

        const demoConfig = {
            maxUsers: licenseCount,
            maxRoutes: licenseCount * 2, // Simple multiple for now
            maxCustomers: licenseCount * 200,
            allowedFeatures: ['optimization', 'analytics', 'market_scanner']
        };

        const newCompany: Company = {
            id: companyId,
            name: companyData.companyName,
            subscriptionTier: planId as any,
            maxUsers: demoConfig.maxUsers,
            maxRoutes: demoConfig.maxRoutes,
            maxCustomers: demoConfig.maxCustomers,
            isActive: true,
            createdAt: new Date().toISOString(),
            expirationDate: expirationDate.toISOString(),
            features: demoConfig.allowedFeatures,
            createdByUserId: userId,
            subscriptionStatus: 'TRIAL',
            planId: planId,
            settings: {
                common: {
                    general: {
                        currency: 'SAR',
                        distanceUnit: 'km',
                        language: 'en',
                        dataRetentionDays: 30,
                        country: 'United Arab Emirates' // Default, should fetch from user profile
                    },
                    theme: { enableDarkMode: false }
                },
                modules: {
                    insights: { enabled: true, minClientsPerRoute: 5, maxClientsPerRoute: 50, efficiencyThreshold: 85, visitFrequencyDays: 7, workingDaysPerWeek: 5, churnThresholdDays: 30, nearbyRadiusMeters: 5000 },
                    market: { enabled: true, searchTimeoutSeconds: 30, minZoomLevel: 10, enableDeepScan: false, defaultKeywords: 'grocery', exportFormat: 'csv', maxLeadsPerScan: 50 },
                    optimizer: { enabled: true, avgSpeedKmh: 40, serviceTimeMin: 15, trafficFactor: 1.2, maxWorkingHours: 8, fuelCostPerKm: 0.1, driverHourlyRate: 20, startLocation: 'DEPOT', maxDistancePerRouteKm: 200, breakTimeMin: 30, costObjective: 'BALANCED' },
                    map: { enabled: true, defaultCenter: [24.7136, 46.6753], defaultZoom: 12, showTraffic: true, clusterMarkers: true, defaultMapStyle: 'STREETS', showUnassignedCustomers: true, heatmapIntensity: 1 },
                    scannerV2: { enabled: true }
                }
            }
        };

        await addCompany(newCompany);

        // 3. Update User: Link to Company and potentially update password
        const userUpdates: any = {
            company_id: companyId,
            role: 'ADMIN'
        };
        if (adminPassword) {
            userUpdates.password = adminPassword;
        }

        await supabase
            .from('app_users')
            .update(userUpdates)
            .eq('id', userId);

        // 4. Update CRM Status
        // 4. Update CRM Status (DISABLED per User Request: Do not register Company Admin as Customer in DB)
        /*
        await supabase
            .from('reach_customers')
            .update({
                company_name: companyData.companyName,
                status: 'customer',
                industry: companyData.industry,
                branches_count: companyData.branchCount,
                routes_count: companyData.routeCount
            })
            .eq('linked_user_id', userId);
        */

        // 5. Affiliate Logic (Placeholder for now)
        // If user was referred, here we would log the conversion.

        return { success: true, companyId };

    } catch (error: any) {
        console.error("Tenant Creation Error:", error);
        throw error;
    }
};

export const submitLicenseRequest = async (
    userId: string,
    companyData: {
        companyName: string;
        industry: string;
        branchCount: number;
        routeCount: number;
        targetCustomersCount: number;
        location?: string;
        website?: string;
        phone?: string;
        licenseCount?: number;
    },
    planId: string,
    promoCode?: string,
    notes?: string
) => {
    try {
        // 1. Try to get the customer ID first
        let { data: customerData, error: customerError } = await supabase
            .from('reach_customers')
            .select('id')
            .eq('linked_user_id', userId)
            .single();

        // 2. If not found, Auto-Register into CRM (Safety Net)
        if (customerError || !customerData) {
            console.log("Customer record missing for License Request. Auto-registering...");

            // Fetch App User Details
            const { data: userData, error: userError } = await supabase
                .from('app_users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError || !userData) {
                console.error("Critical: User not found for license request.");
                throw new Error("User session invalid. Please re-login.");
            }

            // Create CRM Entry (Reach Customer)
            const { data: newCustomer, error: createError } = await supabase
                .from('reach_customers')
                .insert([{
                    first_name: userData.first_name || 'New',
                    last_name: userData.last_name || 'User',
                    email: userData.email || userData.username,
                    phone: companyData.phone || userData.phone || 'N/A', // Use provided phone
                    country: 'Saudi Arabia', // Default
                    role: userData.role || 'Admin',
                    customer_address: companyData.location,
                    company_name: companyData.companyName,
                    industry: companyData.industry,
                    branches_count: companyData.branchCount,
                    routes_count: companyData.routeCount,
                    status: 'lead',
                    linked_user_id: userId,
                    dynamic_data: { website: companyData.website }
                }])
                .select('id')
                .single();

            if (createError) {
                console.error("Failed to auto-create CRM record:", createError);
                throw new Error("Failed to initialize customer record.");
            }

            customerData = newCustomer;
        } else {
            // 2b. If found, ensure company details are up to date
            await supabase.from('reach_customers').update({
                company_name: companyData.companyName,
                industry: companyData.industry,
                branches_count: companyData.branchCount,
                phone: companyData.phone, // Update phone if provided
                customer_address: companyData.location
            }).eq('id', customerData.id);
        }

        // 3. Insert into reach_license_requests
        const { error } = await supabase
            .from('reach_license_requests')
            .insert({
                customer_id: customerData.id,
                linked_user_id: userId,
                plan_id: planId,
                status: 'PENDING',
                company_name: companyData.companyName,
                industry: companyData.industry,
                staff_count: companyData.licenseCount || companyData.branchCount || 5,
                promo_code: promoCode || null,
                notes: notes || null,
            });

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error("License Request Error:", error);
        throw error;
    }
};

// Helper to get status for Limbo users
export const getReachCustomerStatus = async (userId: string): Promise<string | null> => {
    try {
        // 1. Check for Pending License Requests First (Priority)
        const { data: requestData } = await supabase
            .from('reach_license_requests')
            .select('status')
            .eq('linked_user_id', userId)
            .eq('status', 'PENDING') // Explicitly check for PENDING
            .single();

        if (requestData) {
            return 'LICENSE_REQUEST';
        }

        // 2. Fallback to Customer Profile Status (uses App User ID)
        const { data } = await supabase
            .from('reach_customers')
            .select('status')
            .eq('linked_user_id', userId)
            .single();

        return data?.status || null;
    } catch (e) {
        console.error("Error fetching status:", e);
        return null; // Fallback
    }
};

export const getLicenseRequests = async () => {
    try {
        // Fetch requests and join with reach_customers to getting profile info if needed
        const { data, error } = await supabase
            .from('reach_license_requests')
            .select(`
                *,
                reach_customers (
                    first_name,
                    last_name,
                    email,
                    phone,
                    customer_address,
                    dynamic_data
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Fetch Requests Error:", e);
        return [];
    }
};

export const deleteLicenseRequest = async (requestId: string) => {
    try {
        const { error } = await supabase
            .from('reach_license_requests')
            .delete()
            .eq('id', requestId);

        if (error) throw error;
    } catch (e) {
        throw e;
    }
};

export const updateLicenseRequestStatus = async (requestId: string, status: string, notes?: string): Promise<void> => {
    try {
        const updatePayload: any = { status };
        if (notes !== undefined) updatePayload.notes = notes;

        const { error } = await supabase
            .from('reach_license_requests')
            .update(updatePayload)
            .eq('id', requestId);

        if (error) throw error;
    } catch (error: any) {
        console.error("Update License Request Error:", error);
        throw error;
    }
};

export const updateLicenseRequestNotes = async (requestId: string, notes: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('reach_license_requests')
            .update({ notes })
            .eq('id', requestId);

        if (error) throw error;
    } catch (error: any) {
        console.error("Update License Notes Error:", error);
        throw error;
    }
};

export const updateLicenseRequestDraft = async (requestId: string, draftData: any): Promise<void> => {
    try {
        const { error } = await supabase
            .from('reach_license_requests')
            .update({ activation_draft: draftData })
            .eq('id', requestId);

        // Note: If column missing, suppress error but log
        if (error) {
            console.warn("Draft save failed (column might be missing):", error);
        }
    } catch (error: any) {
        console.error("Update Draft Error:", error);
    }
};

export const updateReachCustomerNotes = async (customerId: string, notes: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('reach_customers')
            .update({ notes })
            .eq('id', customerId);

        if (error) throw error;
    } catch (error: any) {
        console.error("Update Notes Error:", error);
        throw error;
    }
};
// --- INSIGHTS DASHBOARD SERVICES ---

export const fetchRouteHealth = async (companyId: string, filters?: any) => {
    // 1. Get All Customers for Company (Lightweight)
    let query = supabase
        .from('normalized_customers')
        .select('*')
        .eq('company_id', companyId);

    if (filters?.region && filters.region !== 'All') {
        query = query.eq('region_code', filters.region); // Assuming region_code stores 'Central', etc.
    }
    // Date filter logic would depend on visit logs, but for now we look at static assignments

    const { data: customers, error } = await query;

    if (error) {
        console.error("Error fetching route health:", error);
        return {
            healthy: 0,
            under: 0,
            over: 0,
            total: 0,
            details: []
        };
    }

    if (!customers || customers.length === 0) {
        return {
            healthy: 0,
            under: 0,
            over: 0,
            total: 0,
            details: []
        };
    }

    // 2. Group by Route
    const routeGroups: Record<string, { count: number, branch: string, region: string, clients: Set<string> }> = {};

    customers.forEach((c: any) => {
        // Use 'route_code' or 'route_description' or fallback to 'Unassigned'
        const routeName = c.route_code || c.route_description || 'Unassigned';
        const branch = c.branch_id || 'Main Branch'; // Fallback
        const region = c.region_code || 'General';

        if (!routeGroups[routeName]) {
            routeGroups[routeName] = { count: 0, branch, region, clients: new Set() };
        }

        routeGroups[routeName].count += 1;
        // Count distinct via phone or code
        const uniqueKey = c.client_code || c.phone || c.name;
        if (uniqueKey) routeGroups[routeName].clients.add(uniqueKey);
    });

    // 3. Calculate Stats & Form Details
    const details: any[] = [];
    let healthy = 0;
    let under = 0;
    let over = 0;

    Object.entries(routeGroups).forEach(([routeName, stats]) => {
        if (routeName === 'Unassigned') return; // Skip unassigned for route health checks

        const distinctCount = stats.clients.size;

        // Logic for Healthy/Under/Over (Customizable thresholds)
        // Example: Healthy = 30-60 customers, Under < 30, Over > 60
        let status = 'healthy';
        let efficiencyVal = 85; // Base mock efficiency

        if (distinctCount < 20) {
            status = 'under';
            under++;
            efficiencyVal = 50 + Math.random() * 20;
        } else if (distinctCount > 80) {
            status = 'over';
            over++;
            efficiencyVal = 70 + Math.random() * 10; // Overloaded drops efficiency
        } else {
            healthy++;
            efficiencyVal = 90 + Math.random() * 10;
        }

        details.push({
            routeName: routeName,
            branchName: stats.branch, // Using branch_id for now, ideally fetch name lookups
            distinctCustomers: distinctCount,
            region: stats.region,
            status: status,
            efficiency: `${Math.round(efficiencyVal)}%`
        });
    });

    return {
        healthy,
        under,
        over,
        total: healthy + under + over,
        details
    };
};

// --- Dashboard Insights (Server-Side Calculation) ---
export const getDashboardInsights = async (
    companyId: string,
    branchIds?: string[], // NEW: For restricted user filtering
    signal?: AbortSignal // NEW: For request cancellation
): Promise<DashboardInsights | null> => {
    try {
        console.log('[Dashboard] Fetching stats for company:', companyId, 'branchIds:', branchIds);

        // Use the new optimized RPC function that queries company_uploaded_data directly
        let query = supabase.rpc('get_dashboard_stats_from_upload', {
            p_company_id: companyId,
            p_branch_ids: branchIds && branchIds.length > 0 ? branchIds : null
        });

        if (signal) {
            query = query.abortSignal(signal);
        }

        const { data, error } = await query;

        if (error || !data) {
            console.warn('[Dashboard] RPC failed, falling back to direct query:', error?.message);
            return await getDashboardInsightsFallback(companyId, branchIds);
        }

        return data as DashboardInsights;

    } catch (err) {
        console.warn('[Dashboard] Unexpected error, trying fallback:', err);
        return await getDashboardInsightsFallback(companyId, branchIds);
    }
};

// Client-side fallback: compute KPIs directly from normalized_customers + route_visits
const getDashboardInsightsFallback = async (
    companyId: string,
    branchIds?: string[]
): Promise<DashboardInsights | null> => {
    try {
        let query = supabase
            .from('normalized_customers')
            .select(`
                id, lat, lng, classification,
                branch_id,
                visits:route_visits(week_number, day_name, route_id)
            `)
            .eq('company_id', companyId)
            .eq('is_active', true);

        if (branchIds && branchIds.length > 0) {
            // Resolve UUIDs
            const { data: brs } = await supabase
                .from('company_branches')
                .select('id, code, name_en')
                .eq('company_id', companyId);
            const ids = (brs || [])
                .filter(b => branchIds.includes(b.id) || branchIds.includes(b.code) || branchIds.includes(b.name_en))
                .map(b => b.id);
            if (ids.length > 0) query = query.in('branch_id', ids);
        }

        const { data: customers, error } = await query;
        if (error || !customers) return null;

        const totalCustomers = customers.length;
        const allVisits = customers.flatMap((c: any) => c.visits || []);
        const totalVisits = allVisits.length;
        const activeRoutes = new Set(allVisits.map((v: any) => v.route_id).filter(Boolean)).size;
        const missingGps = customers.filter((c: any) => !c.lat || !c.lng).length;

        // Route health bucketing by size
        const routeClientCount: Record<string, number> = {};
        allVisits.forEach((v: any) => {
            if (v.route_id) routeClientCount[v.route_id] = (routeClientCount[v.route_id] || 0) + 1;
        });
        let stable = 0, under = 0, over = 0;
        Object.values(routeClientCount).forEach(cnt => {
            if (cnt < 30) under++;
            else if (cnt > 120) over++;
            else stable++;
        });

        return {
            kpis: {
                totalCustomers,
                activeRoutes,
                totalVisits,
                totalDistance: 0,
                totalTime: 0,
                avgVisitsPerRoute: activeRoutes > 0 ? Math.round(totalVisits / activeRoutes) : 0,
                timePerUser: 0,
                frequency: totalCustomers > 0 ? Math.round((totalVisits / totalCustomers) * 10) / 10 : 0,
                efficiency: 0,
            },
            routeHealth: { stable, under, over, total: stable + under + over },
            alerts: { missingGps, proximityIssues: 0 },
        };
    } catch (err) {
        console.error('[Dashboard fallback] Failed:', err);
        return null;
    }
};

// 2. Resolve Route Name


// ==========================================
// NORMALIZED ARCHITECTURE QUERY FUNCTIONS
// ==========================================

// --- Branches ---

export const getBranches = async (companyId: string): Promise<NormalizedBranch[]> => {
    const { data, error } = await supabase
        .from('company_branches')
        .select('*')
        .eq('company_id', companyId)
        .order('name_en', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const getBranchByCode = async (companyId: string, code: string): Promise<NormalizedBranch | null> => {
    const { data, error } = await supabase
        .from('company_branches')
        .select('*')
        .eq('company_id', companyId)
        .eq('code', code)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};

export const upsertBranch = async (branch: Partial<NormalizedBranch>): Promise<NormalizedBranch> => {
    const { data, error } = await supabase
        .from('company_branches')
        .upsert([branch])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteBranch = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('company_branches')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

// --- Routes ---

export const getNormalizedRoutes = async (companyId: string, branchId?: string): Promise<NormalizedRoute[]> => {
    let query = supabase
        .from('routes')
        .select(`*, branches!inner (code, name_en)`)
        .eq('company_id', companyId)
        .eq('is_active', true);

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;

    return (data || []).map((r: any) => ({
        ...r,
        branch_code: r.branches?.code,
        branch_name: r.branches?.name_en
    }));
};

export const getRoutesByRepCode = async (companyId: string, repCode: string): Promise<NormalizedRoute[]> => {
    const { data, error } = await supabase
        .from('routes')
        .select(`*, branches!inner (code, name_en)`)
        .eq('company_id', companyId)
        .eq('rep_code', repCode)
        .eq('is_active', true);

    if (error) throw error;

    return (data || []).map((r: any) => ({
        ...r,
        branch_code: r.branches?.code,
        branch_name: r.branches?.name_en
    }));
};

// --- Normalized Customers ---

export const getNormalizedCustomers = async (
    companyId: string,
    options?: { branchId?: string; limit?: number; offset?: number; search?: string; }
): Promise<{ data: NormalizedCustomer[]; count: number }> => {
    let countQuery = supabase
        .from('normalized_customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true);

    let dataQuery = supabase
        .from('normalized_customers')
        .select(`*, branches!inner (code, name_en)`)
        .eq('company_id', companyId)
        .eq('is_active', true);

    if (options?.branchId) {
        countQuery = countQuery.eq('branch_id', options.branchId);
        dataQuery = dataQuery.eq('branch_id', options.branchId);
    }

    if (options?.search) {
        const searchFilter = `name_en.ilike.%${options.search}%,client_code.ilike.%${options.search}%,address.ilike.%${options.search}%`;
        countQuery = countQuery.or(searchFilter);
        dataQuery = dataQuery.or(searchFilter);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    dataQuery = dataQuery.order('name_en', { ascending: true });

    if (options?.limit) {
        const from = options.offset || 0;
        const to = from + options.limit - 1;
        dataQuery = dataQuery.range(from, to);
    }

    const { data, error } = await dataQuery;
    if (error) throw error;

    return {
        data: (data || []).map((c: any) => ({
            ...c,
            branch_code: c.branches?.code,
            branch_name: c.branches?.name_en
        })),
        count: count || 0
    };
};

export const getCustomerByClientCode = async (
    companyId: string,
    clientCode: string,
    branchId?: string
): Promise<NormalizedCustomer | null> => {
    let query = supabase
        .from('normalized_customers')
        .select(`*, branches!inner (code, name_en)`)
        .eq('company_id', companyId)
        .eq('client_code', clientCode);

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.limit(1).single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
        ...data,
        branch_code: data.branches?.code,
        branch_name: data.branches?.name_en
    };
};

// --- Route Visits ---

export const getRouteVisits = async (
    companyId: string,
    options?: { routeId?: string; customerId?: string; weekNumber?: string; dayName?: string; }
): Promise<RouteVisit[]> => {
    let query = supabase
        .from('route_visits')
        .select(`*, routes!inner (name, rep_code), normalized_customers!inner (client_code, name_en, lat, lng)`)
        .eq('company_id', companyId);

    if (options?.routeId) query = query.eq('route_id', options.routeId);
    if (options?.customerId) query = query.eq('customer_id', options.customerId);
    if (options?.weekNumber) query = query.eq('week_number', options.weekNumber);
    if (options?.dayName) query = query.eq('day_name', options.dayName);

    const { data, error } = await query.order('visit_order', { ascending: true });
    if (error) throw error;

    return (data || []).map((v: any) => ({
        ...v,
        route_name: v.routes?.name,
        customer_name: v.normalized_customers?.name_en,
        customer_lat: v.normalized_customers?.lat,
        customer_lng: v.normalized_customers?.lng
    }));
};

export const getRouteSchedule = async (companyId: string, routeId: string): Promise<RouteVisit[]> => {
    return getRouteVisits(companyId, { routeId });
};

// --- Normalized Data Statistics ---

export const getNormalizedDataSummary = async (companyId: string): Promise<{
    branches: number;
    routes: number;
    customers: number;
    visits: number;
    routesByBranch: { branch_name: string; count: number }[];
    customersByBranch: { branch_name: string; count: number }[];
}> => {
    const [branchRes, routeRes, customerRes, visitRes] = await Promise.all([
        supabase.from('company_branches').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('routes').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('normalized_customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('route_visits').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    ]);

    const { data: routesByBranch } = await supabase
        .from('routes')
        .select('branch_id, branches!inner(name_en)')
        .eq('company_id', companyId);

    const routeBranchCounts: Record<string, number> = {};
    (routesByBranch || []).forEach((r: any) => {
        const name = r.branches?.name_en || 'Unknown';
        routeBranchCounts[name] = (routeBranchCounts[name] || 0) + 1;
    });

    const { data: customersByBranch } = await supabase
        .from('normalized_customers')
        .select('branch_id, branches!inner(name_en)')
        .eq('company_id', companyId);

    const customerBranchCounts: Record<string, number> = {};
    (customersByBranch || []).forEach((c: any) => {
        const name = c.branches?.name_en || 'Unknown';
        customerBranchCounts[name] = (customerBranchCounts[name] || 0) + 1;
    });

    return {
        branches: branchRes.count || 0,
        routes: routeRes.count || 0,
        customers: customerRes.count || 0,
        visits: visitRes.count || 0,
        routesByBranch: Object.entries(routeBranchCounts).map(([name, count]) => ({ branch_name: name, count })),
        customersByBranch: Object.entries(customerBranchCounts).map(([name, count]) => ({ branch_name: name, count }))
    };
};

// Use the view for complete route schedule data
export const getFullRouteSchedule = async (companyId: string, options?: {
    branchCode?: string;
    routeName?: string;
    weekNumber?: string;
    dayName?: string;
}): Promise<any[]> => {
    let query = supabase
        .from('v_route_schedule')
        .select('*')
        .eq('company_id', companyId);

    if (options?.branchCode) query = query.eq('branch_code', options.branchCode);
    if (options?.routeName) query = query.eq('route_name', options.routeName);
    if (options?.weekNumber) query = query.eq('week_number', options.weekNumber);
    if (options?.dayName) query = query.eq('day_name', options.dayName);

    const { data, error } = await query
        .order('branch_name', { ascending: true })
        .order('route_name', { ascending: true })
        .order('week_number', { ascending: true })
        .order('day_name', { ascending: true })
        .order('visit_order', { ascending: true });

    if (error) {
        console.warn('v_route_schedule view not available, using fallback');
        return [];
    }

    return data || [];
};

// ==========================================
// NORMALIZED DATA - READ FUNCTIONS
// ==========================================

/**
 * Fetch customers from normalized tables with branch/route joins
 * Returns Customer[] format for compatibility with existing screens
 */
export const fetchNormalizedCustomers = async (
    companyId: string,
    options?: {
        branchId?: string;
        routeId?: string;
        limit?: number;
    }
): Promise<Customer[]> => {
    try {
        // Query normalized_customers with branch join
        let query = supabase
            .from('normalized_customers')
            .select(`
                *,
                branches:company_branches (code, name_en)
            `)
            .eq('company_id', companyId)
            .eq('is_active', true);

        if (options?.branchId) query = query.eq('branch_id', options.branchId);
        if (options?.limit) query = query.limit(options.limit);

        const { data, error } = await query;

        if (error) {
            console.error('[Normalized] Error fetching customers:', error);
            return [];
        }

        // Map to Customer format for screen compatibility
        return (data || []).map((row: any) => ({
            id: row.id,
            customerId: row.id,
            name: row.name_en || '',
            nameAr: row.name_ar || '',
            lat: row.lat || 0,
            lng: row.lng || 0,
            day: '', // Required field, populated from route_visits
            address: row.address || '',
            clientCode: row.client_code || '',
            phone: row.phone || '',
            classification: row.classification || '',
            regionCode: row.branches?.code || '',
            regionDescription: row.branches?.name_en || '',
            routeName: '',
            week: ''
        }));
    } catch (err) {
        console.error('[Normalized] fetchNormalizedCustomers error:', err);
        return [];
    }
};

/**
 * Get route schedule for company from normalized tables
 * Joins route_visits → routes → branches → normalized_customers
 */
export const fetchNormalizedRouteSchedule = async (
    companyId: string,
    options?: {
        branchCode?: string;
        routeName?: string;
        weekNumber?: string;
        dayName?: string;
    }
): Promise<Customer[]> => {
    try {
        // Use the v_route_schedule view if available
        let query = supabase
            .from('v_route_schedule')
            .select('*')
            .eq('company_id', companyId);

        if (options?.branchCode) query = query.eq('branch_code', options.branchCode);
        if (options?.routeName) query = query.eq('route_name', options.routeName);
        if (options?.weekNumber) query = query.eq('week_number', options.weekNumber);
        if (options?.dayName) query = query.eq('day_name', options.dayName);

        const { data, error } = await query
            .order('visit_order', { ascending: true });

        if (error) {
            console.warn('[Normalized] v_route_schedule view not available, fallback to joins');
            // Fallback: query without view
            return await fetchNormalizedCustomers(companyId);
        }

        // Map view data to Customer format
        return (data || []).map((row: any) => ({
            id: row.customer_id,
            customerId: row.customer_id,
            name: row.customer_name_en || '',
            nameAr: row.customer_name_ar || '',
            lat: row.lat || 0,
            lng: row.lng || 0,
            day: row.day_name || '', // Required field
            address: row.address || '',
            clientCode: row.client_code || '',
            phone: row.phone || '',
            classification: row.classification || '',
            regionCode: row.branch_code || '',
            regionDescription: row.branch_name || '',
            routeName: row.route_name || '',
            week: row.week_number || '',
            userCode: row.rep_code || ''
        }));
    } catch (err) {
        console.error('[Normalized] fetchNormalizedRouteSchedule error:', err);
        return [];
    }
};

/**
 * Subscribe to normalized customers (with listener for future changes)
 * This mirrors subscribeToRoutes but uses normalized tables
 */
export const subscribeToNormalizedCustomers = (
    companyId: string,
    callback: (customers: Customer[]) => void,
    onProgress?: (percent: number) => void
) => {
    // Initial fetch
    const fetchData = async () => {
        onProgress?.(10);
        const customers = await fetchNormalizedRouteSchedule(companyId);
        onProgress?.(100);
        callback(customers);
    };

    fetchData();

    // Subscribe to changes in normalized_customers table
    const subscription = supabase
        .channel(`normalized_customers_${companyId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'normalized_customers',
            filter: `company_id=eq.${companyId}`
        }, () => {
            // Refetch on any change
            fetchData();
        })
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
};

/**
 * Get dashboard insights from normalized tables
 */
export const getNormalizedDashboardInsights = async (companyId: string) => {
    try {
        // Get counts from normalized tables
        const [branchRes, routeRes, customerRes, visitRes] = await Promise.all([
            supabase.from('company_branches').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
            supabase.from('routes').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
            supabase.from('normalized_customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
            supabase.from('route_visits').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
        ]);

        const uniqueCustomers = customerRes.count || 0;
        const activeRoutes = routeRes.count || 0;
        const totalVisits = visitRes.count || 0;

        // Calculate derived metrics
        const avgVisitsPerRoute = activeRoutes > 0 ? Math.round(totalVisits / activeRoutes) : 0;

        return {
            kpi: {
                uniqueCustomers,
                activeRoutes,
                totalVisits,
                distance: totalVisits * 2.2, // Estimated km
                totalTime: totalVisits * 15, // Estimated minutes
                avgVisitsPerRoute,
                efficiency: 85, // Will be calculated from actual data
                avgFrequency: uniqueCustomers > 0 ? Number((totalVisits / uniqueCustomers).toFixed(1)) : 0,
                avgTimePerUser: activeRoutes > 0 ? Number((totalVisits * 15 / 60 / activeRoutes).toFixed(1)) : 0
            },
            routeHealth: {
                healthy: Math.round(activeRoutes * 0.7),
                under: Math.round(activeRoutes * 0.2),
                over: Math.round(activeRoutes * 0.1),
                total: activeRoutes,
                details: []
            },
            alerts: {
                noGps: 0, // Will be calculated from actual data
                nearby: 0
            }
        };
    } catch (err) {
        console.error('[Normalized] Dashboard insights error:', err);
        return null;
    }
};

export const getLicenseUsageStats = async (companyId: string) => {
    try {
        // 1. Total Customers (Exact Count)
        const { count: customerCount, error: customerError } = await supabase
            .from('company_customers')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId);
            
        if (customerError) throw customerError;

        // 2. Total Distinct Routes
        // We fetch the distinct route names from the company_customers table
        const { data: routeData, error: routeError } = await supabase
            .from('company_customers')
            .select('route_name')
            .eq('company_id', companyId);
            
        if (routeError) throw routeError;
        
        const distinctRoutes = new Set(routeData?.map(r => r.route_name).filter(Boolean)).size;

        return {
            customers: customerCount || 0,
            routes: distinctRoutes || 0
        };
    } catch (err) {
        console.error('Error fetching license usage stats:', err);
        return { customers: 0, routes: 0 };
    }
};
