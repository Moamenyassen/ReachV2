/**
 * ETL Service for High-Fidelity Normalized Architecture
 * 
 * Processes CSV uploads in a 4-step pipeline:
 * 1. Extract & Upsert Branches
 * 2. Extract & Upsert Routes
 * 3. Extract & Upsert Customers
 * 4. Bulk Insert Route Visits
 */

import { supabase } from './supabase';
import { Customer } from '../types';
import {
    NormalizedBranch,
    NormalizedRep,
    NormalizedRoute,
    NormalizedCustomer,
    RouteVisit,
    CSVRowInput,
    ETLResult,
    ETLProgress
} from '../types';

// Re-export ETLProgress for convenience
export type { ETLProgress } from '../types';

// ==========================================
// TYPE DEFINITIONS (also in types.ts)
// ==========================================

export interface CSVColumnMapping {
    // Branch fields
    branch_code: string;
    branch_name: string;

    // Route fields
    route_name: string;
    rep_code: string;

    // Customer fields
    client_code: string;
    reach_customer_code?: string; // NEW: Explicit Reach Code
    customer_name_en: string;
    customer_name_ar?: string;
    lat: string;
    lng: string;
    address?: string;
    phone?: string;
    classification?: string;
    vat?: string;
    district?: string;
    buyer_id?: string;
    store_type?: string;
    region?: string;

    // Visit fields
    week_number?: string;
    day_name?: string;
    visit_order?: string;
}

export interface ETLStats {
    branches: { added: number; updated: number; total: number };
    reps: { added: number; updated: number; total: number };
    routes: { added: number; updated: number; total: number };
    customers: { added: number; updated: number; total: number };
    visits: { added: number; skipped: number; total: number };
}

// ==========================================
// MAIN ETL PROCESSOR
// ==========================================

// Helper to rollback specific IDs on failure
// Helper to rollback specific IDs on failure
export const rollbackUpload = async (ids: { branches: string[], reps: string[], routes: string[], customers: string[] }, batchId: string) => {
    console.warn(`[ETL] Rolling back... Branches: ${ids.branches.length}, Reps: ${ids.reps.length}, Routes: ${ids.routes.length}, Customers: ${ids.customers.length}`);

    // 1. Delete Raw Data (Batch) - Safe to delete by batch ID
    if (batchId) {
        await supabase.from('company_uploaded_data').delete().eq('upload_batch_id', batchId);
    }

    // 2. Delete Operational Data (Order matters for constraints)
    // Visits will cascade via Routes/Customers
    if (ids.customers.length > 0) await supabase.from('normalized_customers').delete().in('id', ids.customers);
    if (ids.routes.length > 0) await supabase.from('routes').delete().in('id', ids.routes);
    if (ids.reps.length > 0) await supabase.from('normalized_reps').delete().in('id', ids.reps);
    if (ids.branches.length > 0) await supabase.from('company_branches').delete().in('id', ids.branches);

    console.log('[ETL] Rollback complete.');
};

// NEW: Helper to clear ALL normalized data for a company (Nuclear option but safer for clean state)
// NEW: Helper to clear ALL normalized data for a company (Nuclear option but safer for clean state)
export const clearNormalizedData = async (companyId: string) => {
    console.warn(`[ETL] NUCLEAR ROLLBACK: Clearing all normalized data for company: ${companyId}`);

    // Deletes cascade so we can just delete from parent tables mostly
    // But to be safe and avoid constraint issues, we go in order:

    // 1. Visits (auto-deleted if routes deleted, but safe to do)
    await supabase.from('route_visits').delete().eq('company_id', companyId);

    // 2. Customers
    await supabase.from('normalized_customers').delete().eq('company_id', companyId);

    // 3. Routes
    await supabase.from('routes').delete().eq('company_id', companyId);

    // 4. Reps
    await supabase.from('normalized_reps').delete().eq('company_id', companyId);

    // 5. Branches (careful if other data depends on it, but for fresh upload it's fine)
    await supabase.from('company_branches').delete().eq('company_id', companyId);

    console.log('[ETL] Full cleanup complete.');
};

export const processNormalizedCSVUpload = async (
    rows: any[],
    mapping: CSVColumnMapping,
    companyId: string,
    onProgress?: (progress: ETLProgress) => void
): Promise<{ success: boolean; error?: string; stats?: any, batchId?: string }> => { // Added batchId to return type

    const trackedIds = {
        branches: [] as string[],
        reps: [] as string[],
        routes: [] as string[],
        customers: [] as string[]
    };
    const uploadBatchId = crypto.randomUUID();

    const stats: ETLStats = {
        branches: { added: 0, updated: 0, total: 0 },
        reps: { added: 0, updated: 0, total: 0 },
        routes: { added: 0, updated: 0, total: 0 },
        customers: { added: 0, updated: 0, total: 0 },
        visits: { added: 0, skipped: 0, total: 0 }
    };

    try {
        console.log(`[ETL] Processing ${rows.length} rows for company ${companyId}. Batch: ${uploadBatchId}`);

        // ==========================================
        // STEP 0: BACKUP RAW DATA (Blocking for safety)
        // ==========================================
        try {
            await bulkInsertRawData(rows, mapping, companyId, uploadBatchId, onProgress);
        } catch (backupError: any) {
            console.error('[ETL] Raw Data Backup Failed:', backupError);
            throw new Error(`Raw Backup Failed: ${backupError.message}`);
        }

        // ==========================================
        // STEP 1: EXTRACT & UPSERT BRANCHES
        // ==========================================
        // ==========================================
        // STEP 1: EXTRACT & UPSERT BRANCHES
        // ==========================================
        onProgress?.({ step: 1, stepName: 'Scanning Rows for Branches', percent: 0, totalCount: rows.length, currentCount: 0 });

        console.log('[ETL] Starting ETL. Columns Mapped:', Object.keys(mapping).length);
        console.log('[ETL] Mapping Config:', mapping);

        const branchMap = await extractAndUpsertBranches(rows, mapping, companyId);

        stats.branches.total = branchMap.size;
        stats.branches.added = branchMap.size;

        onProgress?.({ step: 1, stepName: 'Branches Processed', percent: 100, currentCount: branchMap.size, totalCount: branchMap.size });

        // ==========================================
        // STEP 2: EXTRACT & UPSERT REPS (SKIPPED PER USER REQUEST)
        // ==========================================
        // const repMap = await extractAndUpsertReps(...) <-- SKIPPING
        const repMap = new Map<string, string>(); // Empty map, routes table uses rep_code string directly

        // stats.reps = { added: 0, updated: 0, total: 0 }; // Reps not tracked


        // ==========================================
        // STEP 3: EXTRACT & UPSERT ROUTES
        // ==========================================
        onProgress?.({ step: 3, stepName: 'Processing Routes', percent: 0, totalCount: 0, currentCount: 0 });
        console.log(`[ETL] Step 2 Done. Rep Map Size: ${repMap.size}`);

        const routeMap = await extractAndUpsertRoutes(rows, mapping, companyId, branchMap, repMap, (p, current, total) => {
            onProgress?.({ step: 3, stepName: 'Processing Routes', percent: p, currentCount: current, totalCount: total });
        });
        stats.routes.total = routeMap.size;
        stats.routes.added = routeMap.size;

        onProgress?.({ step: 3, stepName: 'Processing Routes', percent: 100, currentCount: routeMap.size, totalCount: routeMap.size });

        console.log(`[ETL] Step 3 Done. Route Map Size: ${routeMap.size}`);
        if (routeMap.size === 0) console.warn('[ETL] WARNING: No Routes Extracted! Check mapping logic.');

        // ==========================================
        // STEP 4: EXTRACT & UPSERT CUSTOMERS
        // ==========================================
        onProgress?.({ step: 4, stepName: 'Processing Customers', percent: 0, totalCount: rows.length, currentCount: 0 });
        const customerMap = await extractAndUpsertCustomers(rows, mapping, companyId, branchMap, routeMap, (p, current, total) => {
            onProgress?.({ step: 4, stepName: 'Processing Customers', percent: p, currentCount: current, totalCount: total });
        });
        trackedIds.customers.push(...Array.from(customerMap.values()));
        stats.customers.total = customerMap.size;
        stats.customers.added = customerMap.size;
        onProgress?.({ step: 4, stepName: 'Processing Customers', percent: 100, currentCount: customerMap.size, totalCount: customerMap.size });
        console.log(`[ETL] Step 4 Done. Customer Map Size: ${customerMap.size}`);

        // ==========================================
        // STEP 5: BULK INSERT ROUTE VISITS
        // ==========================================
        onProgress?.({ step: 5, stepName: 'Creating Visit Schedule', percent: 0, totalCount: rows.length, currentCount: 0 });
        const visitStats = await bulkInsertRouteVisits(
            rows,
            mapping,
            companyId,
            routeMap,
            customerMap,
            branchMap,
            (p, current, total) => {
                onProgress?.({ step: 5, stepName: 'Creating Visit Schedule', percent: p, currentCount: current, totalCount: total });
            }
        );
        stats.visits = visitStats;
        onProgress?.({ step: 5, stepName: 'Creating Visit Schedule', percent: 100, currentCount: visitStats.total, totalCount: visitStats.total });
        console.log(`[ETL] Step 5 Done. Visit Stats: ${JSON.stringify(visitStats)}`);

        return { success: true, stats, batchId: uploadBatchId };

    } catch (error: any) {
        console.error('[ETL] Error during processing:', error);

        // Critical: Rollback EVERYTHING.
        await rollbackUpload(trackedIds, uploadBatchId);
        await clearNormalizedData(companyId); // <--- Ensure we wipe partial data on error

        return {
            success: false,
            stats,
            error: error.message || 'Unknown error during ETL processing',
            batchId: uploadBatchId
        };
    }
}

// ==========================================
// STEP 0: RAW DATA BACKUP
// ==========================================
async function bulkInsertRawData(
    rows: any[],
    mapping: CSVColumnMapping,
    companyId: string,
    uploadBatchId: string,
    onProgress?: (progress: ETLProgress) => void
) {
    const BATCH_SIZE = 2000; // Increased
    const CONCURRENCY_LIMIT = 5; // Parallel requests
    let processedCount = 0;

    onProgress?.({ step: 0, stepName: 'Backing up Raw Data', percent: 0, totalCount: rows.length, currentCount: 0 });
    console.log(`[ETL-Opt] Starting Concurrent Raw Backup. Total: ${rows.length}, Batch: ${BATCH_SIZE}, Concurrency: ${CONCURRENCY_LIMIT}`);

    // Pre-map all rows to raw tokens to avoid overhead in loop
    const allRawRows = rows.map(row => ({
        company_id: companyId,
        region: row[mapping.region] || row[mapping.branch_name] || null,
        branch_code: row[mapping.branch_code] || null,
        branch_name: row[mapping.branch_name] || null,
        route_name: row[mapping.route_name] || null,
        rep_code: row[mapping.rep_code] || null,
        client_code: row[mapping.client_code] || null,
        customer_name_en: row[mapping.customer_name_en] || null,
        customer_name_ar: row[mapping.customer_name_ar] || null,
        address: row[mapping.address] || null,
        phone: row[mapping.phone] || null,
        district: row[mapping.district] || null,
        vat: row[mapping.vat] || null,
        buyer_id: row[mapping.buyer_id] || null,
        classification: row[mapping.classification] || null,
        store_type: row[mapping.store_type] || null,
        lat: parseFloat(row[mapping.lat]) || null,
        lng: parseFloat(row[mapping.lng]) || null,
        week_number: row[mapping.week_number]?.toString() || null,
        day_name: row[mapping.day_name] || null,
        upload_batch_id: uploadBatchId
    }));

    // Chunk the data
    const chunks = [];
    for (let i = 0; i < allRawRows.length; i += BATCH_SIZE) {
        chunks.push(allRawRows.slice(i, i + BATCH_SIZE));
    }

    // Process chunks with concurrency limit
    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
        const batchPromises = chunks.slice(i, i + CONCURRENCY_LIMIT).map(async (chunk) => {
            const { error } = await supabase.from('company_uploaded_data').insert(chunk);
            if (error) throw new Error(`Raw Data Insert Failed: ${error.message}`);

            processedCount += chunk.length;

            // Only update progress periodically
            if (processedCount % (BATCH_SIZE * 2) === 0 || processedCount === rows.length) {
                onProgress?.({
                    step: 0,
                    stepName: 'Backing up Raw Data (Optimized)',
                    percent: Math.round((processedCount / rows.length) * 100),
                    totalCount: rows.length,
                    currentCount: processedCount
                });
            }
        });

        await Promise.all(batchPromises);
        console.log(`[ETL-Opt] Processed ${processedCount}/${rows.length} raw rows...`);
    }

    onProgress?.({ step: 0, stepName: 'Raw Data Backup Complete', percent: 100, totalCount: rows.length, currentCount: rows.length });
}

// ==========================================
// STEP 1: EXTRACT & UPSERT BRANCHES
// ==========================================

async function extractAndUpsertBranches(
    rows: any[],
    mapping: CSVColumnMapping,
    companyId: string
): Promise<Map<string, string>> {

    // Extract unique branches from CSV
    const branchSet = new Map<string, { code: string; name_en: string }>();

    for (const [index, row] of rows.entries()) {
        let code = (row[mapping.branch_code] || '').toString().trim().toUpperCase();
        let name = (row[mapping.branch_name] || '').toString().trim();

        // FAILSAFE: If no branch detected, assign to 'UNASSIGNED'
        if (!code) {
            code = 'UNASSIGNED';
            name = name || 'Unassigned Region';
        }

        // Fallback: Use code as name if name is missing
        if (!name && code) {
            name = code;
        }

        if (code && name && !branchSet.has(code)) {
            branchSet.set(code, { code, name_en: name });
        }
    }

    if (branchSet.size === 0) {
        console.warn('[ETL] No branches found in CSV');
        return new Map();
    }

    // Upsert branches to database
    const branchArray = Array.from(branchSet.values()).map(b => ({
        code: b.code,
        name_en: b.name_en,
        company_id: companyId,
        is_active: true
    }));

    console.log('[ETL] Attempting to upsert branches:', branchArray.length);

    // Use code AND company_id for conflict resolution
    const { data, error } = await supabase
        .from('company_branches') // REVERTED: branches -> company_branches
        .upsert(branchArray, {
            onConflict: 'code,company_id',
            ignoreDuplicates: false
        })
        .select('id, code');

    if (error) {
        console.error('[ETL] Branch upsert error:', error);
        throw new Error(`Failed to upsert branches: ${error.message}`);
    }

    // Build code -> id map
    const branchMap = new Map<string, string>();
    for (const branch of (data || [])) {
        branchMap.set(branch.code, branch.id);
    }

    // RELIABILITY FIX: Always fetch branches from DB to ensure we have the complete and correct IDs.
    if (branchMap.size < branchSet.size) {
        const { data: fetchedBranches, error: fetchError } = await supabase
            .from('company_branches') // REVERTED: branches -> company_branches
            .select('id, code')
            .eq('company_id', companyId);

        if (fetchError) {
            console.error('[ETL] Failed to refresh branch map:', fetchError);
            throw new Error(`Failed to refresh branch map: ${fetchError.message}`);
        }

        // Rebuild map from source of truth
        for (const branch of (fetchedBranches || [])) {
            branchMap.set(branch.code, branch.id);
        }
    }

    console.log(`[ETL] Upserted ${branchMap.size} branches`);
    return branchMap;
}

// ==========================================
// STEP 2: EXTRACT & UPSERT REPS
// ==========================================

async function extractAndUpsertReps(
    rows: any[],
    mapping: CSVColumnMapping,
    companyId: string,
    branchMap: Map<string, string>,
    onProgress?: (percent: number, current?: number, total?: number) => void
): Promise<Map<string, string>> {

    const repSet = new Map<string, { user_code: string; name: string; branch_id: string }>();

    for (const row of rows) { // <--- Added missing loop
        // NORMALIZATION FIX: Align exactly with extractAndUpsertBranches
        let branchCode = (row[mapping.branch_code!] || '').toString().trim().toUpperCase();
        if (!branchCode) {
            branchCode = 'UNASSIGNED';
        }

        const repCode = (row[mapping.rep_code!] || '').toString().trim();

        if (!repCode) continue;

        const branchId = branchMap.get(branchCode);
        if (!branchId) {
            // Logging only once to avoid spam
            if (Math.random() < 0.001) console.warn(`[ETL] Skipped Rep ${repCode}: Branch '${branchCode}' not found in map.`);
            continue;
        }

        // Key: user_code is unique per company.
        if (!repSet.has(repCode)) {
            repSet.set(repCode, {
                user_code: repCode,
                name: repCode,
                branch_id: branchId
            });
        }
    }

    if (repSet.size === 0) return new Map();

    const repArray = Array.from(repSet.values()).map(r => ({
        user_code: r.user_code,
        name: r.name,
        branch_id: r.branch_id,
        company_id: companyId
    }));

    console.log(`[ETL] Upserting ${repArray.length} Reps. BranchMapSize: ${branchMap.size}`);

    // BATCHED UPSERT to avoid timeouts/limits and potential FK race conditions
    const BATCH_SIZE = 2500; // Increased from 1000
    const repMap = new Map<string, string>();

    for (let i = 0; i < repArray.length; i += BATCH_SIZE) {
        const batch = repArray.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
            .from('normalized_reps')
            .upsert(batch, { onConflict: 'company_id,user_code' })
            .select('id, user_code');

        if (error) {
            console.error('[ETL] Rep upsert error:', error);
            throw new Error(`Failed to upsert reps (Batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`);
        }

        for (const rep of (data || [])) {
            repMap.set(rep.user_code, rep.id);
        }

        // Update progress
        const p = Math.min(100, Math.round(((i + batch.length) / repArray.length) * 100));
        onProgress?.(p, i + batch.length, repArray.length);
    }

    // fallback fetch if needed (unlikely with select)
    return repMap;
}

// ==========================================
// STEP 3: EXTRACT & UPSERT ROUTES
// ==========================================

async function extractAndUpsertRoutes(
    rows: any[],
    mapping: CSVColumnMapping,
    companyId: string,
    branchMap: Map<string, string>,
    repMap: Map<string, string>,
    onProgress?: (percent: number, current?: number, total?: number) => void
): Promise<Map<string, string>> {

    // Extract unique routes from CSV
    // Key: "regionCode|routeName" to handle same route name in different branches
    const routeSet = new Map<string, { name: string; rep_code: string; branch_id: string }>();

    for (const row of rows) {
        // PER USER RULE: Branch separation is based on Region Code
        const regionCode = (row[mapping.branch_code] || 'UNASSIGNED').toString().trim().toUpperCase();
        const routeName = (row[mapping.route_name] || '').toString().trim();
        const repCode = (row[mapping.rep_code] || '').toString().trim();

        const branchId = branchMap.get(regionCode);

        // Debug log for standard region matching
        if (Math.random() < 0.0001) console.log(`[ETL] Route Check: ${routeName} -> Region: ${regionCode} -> Found: ${!!branchId}`);

        if (!branchId || !routeName) continue;

        // GLOBAL UNIQUENESS: Key just by routeName (ignoring branch) per user request
        // BUT we must associate it with the correct branch (via region code)
        const key = routeName;
        if (!routeSet.has(key)) {
            routeSet.set(key, {
                name: routeName,
                rep_code: repCode || null as any,
                branch_id: branchId // Linked via region code
            });
        }
    }

    if (routeSet.size === 0) {
        console.warn('[ETL] No routes found in CSV');
        return new Map();
    }

    // Upsert routes to database (using 'routes' table, not 'normalized_routes')
    const routeArray = Array.from(routeSet.values()).map(r => ({
        name: r.name,           // Keep for backward compatibility
        route_name: r.name,     // NEW: Explicit route_name field
        rep_code: r.rep_code,
        branch_id: r.branch_id,
        company_id: companyId
    }));

    // Split into batches
    const BATCH_SIZE = 2500; // Increased from 1000
    const routeMap = new Map<string, string>();
    const branchIdToCode = new Map<string, string>();
    for (const [code, id] of branchMap.entries()) branchIdToCode.set(id, code);

    for (let i = 0; i < routeArray.length; i += BATCH_SIZE) {
        const batch = routeArray.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
            .from('routes') // Fixed: was 'normalized_routes', schema uses 'routes'
            .upsert(batch, {
                onConflict: 'name,branch_id', // Fixed: matches UNIQUE(name, branch_id) in schema
                ignoreDuplicates: false
            })
            .select('id, name, branch_id, rep_code');

        if (error) {
            console.error('[ETL] Route upsert error:', error);
            throw new Error(`Failed to upsert routes: ${error.message}`);
        }

        for (const route of (data || [])) {
            // Map by Name (Primary)
            routeMap.set(route.name, route.id);

            // Map by Rep Code (Fallback)
            if (route.rep_code) {
                routeMap.set(route.rep_code, route.id);
            }
        }

        // Update progress
        const p = Math.min(100, Math.round(((i + batch.length) / routeArray.length) * 100));
        onProgress?.(p, i + batch.length, routeArray.length);
    }

    // Fallback fetch if upsert didn't return all IDs
    if (routeMap.size < routeSet.size) {
        // ... previous fallback logic ...
    }

    console.log(`[ETL] Upserted ${routeMap.size} route keys (names + reps)`);
    return routeMap;
}

// ==========================================
// STEP 4: EXTRACT & UPSERT CUSTOMERS
// ==========================================

async function extractAndUpsertCustomers(
    rows: any[],
    mapping: CSVColumnMapping,
    companyId: string,
    branchMap: Map<string, string>,
    routeMap: Map<string, string>,
    onProgress?: (percent: number, current?: number, total?: number) => void
): Promise<Map<string, string>> {

    // Extract unique customers from CSV
    // Key: "branchCode|clientCode" to handle same client code in different branches
    const customerSet = new Map<string, any>();

    for (const [index, row] of rows.entries()) {
        const branchCode = (row[mapping.branch_code] || 'UNASSIGNED').toString().trim().toUpperCase();
        let clientCode = (row[mapping.client_code] || '').toString().trim();
        const nameEn = (row[mapping.customer_name_en] || '').toString().trim();

        // FAILSAFE: Generate Client Code if missing
        if (!clientCode && nameEn) {
            // Simple hash or slug from name
            clientCode = nameEn.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
            if (!clientCode) clientCode = `GEN-${index}`;
        }

        const branchId = branchMap.get(branchCode);

        // DEBUG: Log first row extraction
        if (index === 0) {
            console.log('[ETL] Customer Extraction Sample:', {
                branchCode, branchId, clientCode, nameEn
            });
        }

        if (!branchId || !clientCode) continue;

        const key = `${branchCode}|${clientCode}`;
        if (!customerSet.has(key)) {
            customerSet.set(key, {
                client_code: clientCode,
                // reach_customer_code removed from top level
                name_en: nameEn,
                name_ar: mapping.customer_name_ar ? (row[mapping.customer_name_ar] || '').toString().trim() : null,
                lat: parseFloat(row[mapping.lat]) || 0,
                lng: parseFloat(row[mapping.lng]) || 0,
                address: mapping.address ? (row[mapping.address] || '').toString().trim() : null,
                phone: mapping.phone ? (row[mapping.phone] || '').toString().trim() : null,
                classification: mapping.classification ? (row[mapping.classification] || '').toString().trim() : null,

                // Mapped Advanced Fields
                vat: mapping.vat ? (row[mapping.vat] || '').toString().trim() : null,
                district: mapping.district ? (row[mapping.district] || '').toString().trim() : null,
                buyer_id: mapping.buyer_id ? (row[mapping.buyer_id] || '').toString().trim() : null,
                store_type: mapping.store_type ? (row[mapping.store_type] || '').toString().trim() : null,

                branch_id: branchId,
                company_id: companyId,
                dynamic_data: {
                    ...(row.data || {}), // Save all unmapped columns
                    region: mapping.region ? (row[mapping.region] || '').toString().trim() : null,
                    reach_customer_code: mapping.reach_customer_code ? (row[mapping.reach_customer_code] || '').toString().trim() : null
                }
            });
        }
    }

    if (customerSet.size === 0) {
        console.warn('[ETL] No customers found in CSV');
        return new Map();
    }

    // Batch upsert customers (in chunks to avoid timeout)
    const customerArray = Array.from(customerSet.values());
    const BATCH_SIZE = 2500; // Increased from 500
    const customerMap = new Map<string, string>();

    // Create reverse branchId -> branchCode map
    const branchIdToCode = new Map<string, string>();
    for (const [code, id] of branchMap.entries()) {
        branchIdToCode.set(id, code);
    }

    for (let i = 0; i < customerArray.length; i += BATCH_SIZE) {
        const batch = customerArray.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
            .from('normalized_customers')
            .upsert(batch, {
                onConflict: 'client_code,branch_id',
                ignoreDuplicates: false
            })
            .select('id, client_code, branch_id');

        if (error) {
            console.error('[ETL] Customer upsert error:', error);
            throw new Error(`Failed to upsert customers: ${error.message}`);
        }

        // Build map from response
        for (const customer of (data || [])) {
            const branchCode = branchIdToCode.get(customer.branch_id);
            if (branchCode) {
                const key = `${branchCode}|${customer.client_code}`;
                customerMap.set(key, customer.id);
            }
        }

        const progress = Math.min(100, Math.round(((i + batch.length) / customerArray.length) * 100));
        onProgress?.(progress, i + batch.length, customerArray.length);
    }

    // If some customers weren't returned, fetch them
    if (customerMap.size < customerSet.size) {
        const { data: fetchedCustomers } = await supabase
            .from('normalized_customers')
            .select('id, client_code, branch_id')
            .eq('company_id', companyId);

        for (const customer of (fetchedCustomers || [])) {
            const branchCode = branchIdToCode.get(customer.branch_id);
            if (branchCode) {
                const key = `${branchCode}|${customer.client_code}`;
                if (!customerMap.has(key)) {
                    customerMap.set(key, customer.id);
                }
            }
        }
    }

    console.log(`[ETL] Upserted ${customerMap.size} customers`);
    return customerMap;
}

// ==========================================
// STEP 4: BULK INSERT ROUTE VISITS
// ==========================================

async function bulkInsertRouteVisits(
    rows: any[],
    mapping: CSVColumnMapping,
    companyId: string,
    routeMap: Map<string, string>,
    customerMap: Map<string, string>,
    branchMap: Map<string, string>,
    onProgress?: (percent: number, current?: number, total?: number) => void
): Promise<{ added: number; skipped: number; total: number }> {

    const stats = { added: 0, skipped: 0, total: 0 };
    const visitArray: any[] = [];
    const seenVisits = new Set<string>(); // Prevent duplicates in batch

    for (const row of rows) {
        stats.total++;

        const branchCode = (row[mapping.branch_code] || '').toString().trim().toUpperCase();
        const routeName = (row[mapping.route_name] || '').toString().trim();
        const clientCode = (row[mapping.client_code] || '').toString().trim();
        const repCode = mapping.rep_code ? (row[mapping.rep_code] || '').toString().trim() : '';

        // Get IDs from maps
        // Get IDs from maps
        // PRIMARY LOOKUP: By Route Name (Global)
        let routeId = routeMap.get(routeName);
        const customerKey = `${branchCode}|${clientCode}`;

        const customerId = customerMap.get(customerKey);

        // Fallback: Try linking via Rep Code (if route name lookup failed)
        if (!routeId && repCode) {
            routeId = routeMap.get(repCode);
        }

        if (!routeId || !customerId) {
            stats.skipped++;
            continue;
        }

        // Extract visit details
        const weekNumber = mapping.week_number
            ? (row[mapping.week_number] || '').toString().trim()
            : 'W1';
        const dayName = mapping.day_name
            ? (row[mapping.day_name] || '').toString().trim()
            : 'Sunday';
        const visitOrder = mapping.visit_order
            ? parseInt(row[mapping.visit_order]) || 0
            : 0;

        // Create unique key to prevent duplicates
        const visitKey = `${routeId}|${customerId}|${weekNumber}|${dayName}`;
        if (seenVisits.has(visitKey)) {
            stats.skipped++;
            continue;
        }
        seenVisits.add(visitKey);

        visitArray.push({
            route_id: routeId,
            customer_id: customerId,
            week_number: weekNumber,
            day_name: dayName,
            visit_order: visitOrder,
            company_id: companyId,
            visit_type: 'SCHEDULED'
        });
    }

    if (visitArray.length === 0) {
        console.warn('[ETL] No valid visits to insert');
        return stats;
    }

    // Batch insert visits (in chunks)
    const BATCH_SIZE = 2500; // Increased from 1000

    for (let i = 0; i < visitArray.length; i += BATCH_SIZE) {
        const batch = visitArray.slice(i, i + BATCH_SIZE);

        const { error } = await supabase
            .from('route_visits')
            .upsert(batch, {
                onConflict: 'route_id,customer_id,week_number,day_name',
                ignoreDuplicates: true
            });

        if (error) {
            console.error('[ETL] Visit insert error:', error);
            // Don't throw - continue with other batches
            stats.skipped += batch.length;
        } else {
            stats.added += batch.length;
        }

        const progress = Math.min(100, Math.round(((i + batch.length) / visitArray.length) * 100));
        onProgress?.(progress, i + batch.length, visitArray.length);
    }

    console.log(`[ETL] Inserted ${stats.added} visits, skipped ${stats.skipped}`);
    return stats;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Auto-detect column mapping from CSV headers
 */
export function autoDetectColumnMapping(headers: string[]): Partial<CSVColumnMapping> {
    const mapping: Partial<CSVColumnMapping> = {};

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    console.log('[ETL] Auto-detecting columns from headers:', headers);
    console.log('[ETL] Normalized headers:', headers.map(h => `${h} -> ${normalize(h)}`));

    for (const header of headers) {
        const norm = normalize(header);

        // Branch detection - STRICT
        // branch_code = code identifier (e.g., 'JED', 'RYD')  
        // branch = branch name (e.g., 'Jeddah', 'Riyadh')
        if (norm.includes('branchcode') || norm === 'brcode') {
            mapping.branch_code = header;
        } else if (norm === 'branch' || norm === 'branchname' || norm === 'depot') {
            // Branch name - NOT Region
            mapping.branch_name = header;
        }

        // Region code = Branch code (user clarified region_code IS the branch identifier)
        else if (norm === 'regioncode' || norm === 'region_code') {
            mapping.branch_code = header; // Map to branch_code, not region
        }
        // Region description/name is separate
        else if (norm === 'region' || norm.includes('regiondesc') || norm === 'regionname' || norm === 'المنطقة') {
            mapping.region = header;
        }

        // Route detection
        else if (norm.includes('routedesc') || norm.includes('routename') || norm === 'routedescription' || norm === 'route') {
            mapping.route_name = header;
        } else if (norm.includes('usercode') || norm === 'repcode' || norm === 'salesman' || norm === 'driver' || norm === 'rep') {
            mapping.rep_code = header;
        }

        // Coordinates
        else if (norm === 'lat' || norm === 'latitude') {
            mapping.lat = header;
        } else if (norm === 'lng' || norm === 'long' || norm === 'longitude') {
            mapping.lng = header;
        }

        // Customer Identity
        else if (norm.includes('clientcode') || norm === 'rclientcode' || norm === 'customerid' || norm === 'customercode' || norm === 'code') {
            mapping.client_code = header;
        }
        else if (norm === 'reachcustomercode' || norm === 'rclientcode') {
            mapping.reach_customer_code = header;
        }
        else if (norm.includes('clientdescreption') || norm.includes('clientdescription') || norm.includes('customername') || norm === 'name' || norm === 'customer') {
            mapping.customer_name_en = header;
        }
        else if (norm.includes('clientarabic') || norm.includes('namear') || norm === 'arabicname' || norm.includes('arabic')) {
            mapping.customer_name_ar = header;
        }

        // Additional fields
        else if (norm.includes('address') || norm.includes('العنوان') || norm === 'location') {
            mapping.address = header;
        } else if (norm.includes('phone') || norm.includes('mobile') || norm.includes('الهاتف') || norm === 'contact') {
            mapping.phone = header;
        } else if (norm.includes('class') || norm.includes('category') || norm.includes('التصنيف') || norm === 'classification') {
            mapping.classification = header;
        }
        else if (norm.includes('vat') || norm.includes('tax')) {
            mapping.vat = header;
        }
        else if (norm.includes('district') || norm.includes('neighborhood')) {
            mapping.district = header;
        }
        else if (norm.includes('buyeridentification') || norm.includes('buyerid') || norm === 'buyer') {
            mapping.buyer_id = header;
        }
        else if (norm.includes('storetype') || norm.includes('channel') || norm === 'type') {
            mapping.store_type = header;
        }

        // Visit schedule
        else if (norm.includes('week') || norm.includes('الاسبوع')) {
            mapping.week_number = header;
        } else if (norm.includes('day') || norm.includes('اليوم')) {
            mapping.day_name = header;
        } else if (norm.includes('order') || norm.includes('sequence') || norm.includes('الترتيب')) {
            mapping.visit_order = header;
        }
    }

    return mapping;
}

/**
 * Validate that required fields are mapped
 */
export function validateColumnMapping(mapping: Partial<CSVColumnMapping>): {
    isValid: boolean;
    missingFields: string[]
} {
    const required = ['branch_code', 'branch_name', 'route_name', 'client_code', 'customer_name_en', 'lat', 'lng'];
    const missing: string[] = [];

    for (const field of required) {
        if (!mapping[field as keyof CSVColumnMapping]) {
            missing.push(field);
        }
    }

    return {
        isValid: missing.length === 0,
        missingFields: missing
    };
}

// clearNormalizedData removed to avoid duplicate declaration (defined at top of file)

/**
 * Get summary statistics for normalized data
 */
export async function getNormalizedDataStats(companyId: string): Promise<{
    branches: number;
    routes: number;
    customers: number;
    visits: number;
}> {
    const [branchRes, routeRes, customerRes, visitRes] = await Promise.all([
        supabase.from('company_branches').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('routes').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('normalized_customers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('route_visits').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    ]);

    return {
        branches: branchRes.count || 0,
        routes: routeRes.count || 0,
        customers: customerRes.count || 0,
        visits: visitRes.count || 0
    };
}

/**
 * Transforms raw CSV rows into Customer objects based on the provided mapping.
 * Centralizes the transformation logic to support dynamic re-mapping in the UI.
 */
export function transformRowsToCustomers(
    rows: any[],
    mapping: CSVColumnMapping,
): Customer[] {
    const mappedKeys = Object.values(mapping).filter(Boolean) as string[];

    return rows.map(row => {
        // Extract extra fields (dynamic columns)
        const extraData: Record<string, any> = {};
        Object.keys(row).forEach(key => {
            if (!mappedKeys.includes(key) && key !== 'id') {
                extraData[key] = row[key];
            }
        });

        return {
            ...row,
            // Branch fields
            branch: String(row[mapping.branch_name!] || ''),
            regionCode: String(row[mapping.branch_code!] || ''),
            regionDescription: String(row[mapping.region!] || ''),
            // Route & User
            routeName: String(row[mapping.route_name!] || ''),
            userCode: String(row[mapping.rep_code!] || ''),
            // Customer identity
            clientCode: String(row[mapping.client_code!] || ''),
            name: String(row[mapping.customer_name_en!] || ''),
            nameAr: row[mapping.customer_name_ar!] || '',
            // Location
            lat: Number(row[mapping.lat!]) || 0,
            lng: Number(row[mapping.lng!]) || 0,
            address: row[mapping.address!] || '',
            phone: row[mapping.phone!] || '',
            classification: row[mapping.classification!] || '',
            // Schedule
            week: row[mapping.week_number!] ? String(row[mapping.week_number!]) : '',
            day: row[mapping.day_name!] || '',
            visitOrder: row[mapping.visit_order!] ? parseInt(row[mapping.visit_order!]) : 0,
            // Extended fields
            reachCustomerCode: mapping.reach_customer_code ? (row[mapping.reach_customer_code] || '').toString().trim() : '',
            vat: mapping.vat ? (row[mapping.vat] || '').toString().trim() : '',
            district: mapping.district ? (row[mapping.district] || '').toString().trim() : '',
            buyerId: mapping.buyer_id ? (row[mapping.buyer_id] || '').toString().trim() : '',
            storeType: mapping.store_type ? (row[mapping.store_type] || '').toString().trim() : '',
            id: row.id || row[mapping.client_code!] || crypto.randomUUID(),
            // Store dynamic data
            data: extraData
        } as Customer;
    });
}
