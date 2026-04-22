/**
 * reportService.ts
 * Computes all Detailed Reports data directly from Supabase's
 * `company_uploaded_data` table — the source of truth for uploaded routes.
 */
import { supabase } from './supabase';
import {
    HierarchicalData,
    RouteSummaryData,
    VisitFrequencyData,
    RouteEfficiencyData,
    UserWorkloadData,
    DataQualityData,
    WeeklyCoverageData,
} from '../components/features/Reports/types';

// ─────────────────────────────────────────────
// Raw row from company_uploaded_data
// ─────────────────────────────────────────────
interface RawRow {
    id: string;
    client_code?: string;
    customer_name_en?: string;
    customer_name_ar?: string;
    name?: string;
    name_ar?: string;
    lat?: number;
    lng?: number;
    branch_name?: string;
    branch_code?: string;
    branch?: string;
    route_name?: string;
    user_code?: string;
    rep_code?: string;
    classification?: string;
    store_type?: string;
    district?: string;
    phone?: string;
    vat?: string;
    vat_number?: string;
    week_number?: string;
    week?: string;
    day_name?: string;
    day?: string;
    is_active?: boolean;
}

// Normalize field names (schema drift between legacy & current columns)
const n = (r: RawRow) => ({
    id: r.id,
    clientCode: r.client_code || '',
    name: r.customer_name_en || r.name || '',
    lat: Number(r.lat) || 0,
    lng: Number(r.lng) || 0,
    branch: r.branch_name || r.branch || 'Unknown',
    route: r.route_name || 'Unassigned',
    rep: r.user_code || r.rep_code || 'Unassigned',
    classification: (r.classification || '').toUpperCase().trim(),
    storeType: (r.store_type || '').toLowerCase().trim(),
    district: r.district || '',
    phone: (r.phone || '').trim(),
    vat: (r.vat_number || r.vat || '').trim(),
    week: (r.week_number || r.week || '').trim(),
    day: (r.day_name || r.day || '').trim(),
});

type NormalRow = ReturnType<typeof n>;

// ─────────────────────────────────────────────
// Central fetch: paginated, ALL rows
// ─────────────────────────────────────────────
export const fetchReportData = async (
    companyId: string,
    branchIds?: string[]
): Promise<NormalRow[]> => {
    if (!companyId) {
        console.warn('[reportService] No companyId provided');
        return [];
    }

    const PAGE = 1000;
    let from = 0;
    const all: RawRow[] = [];

    // Resolve branch filter (accept id/code/name)
    let branchFilter: string[] | null = null;
    if (branchIds && branchIds.length > 0) {
        const { data: brs } = await supabase
            .from('company_branches')
            .select('id, code, name_en')
            .eq('company_id', companyId);
        const matched = (brs || []).filter(
            b => branchIds.includes(b.id) || branchIds.includes(b.code) || branchIds.includes(b.name_en)
        );
        branchFilter = matched.map(b => b.name_en);
    }

    console.log(`[reportService] fetchReportData companyId=${companyId}`, { branchFilter });

    // Loop pages until exhausted. Use select('*') for schema flexibility.
    while (true) {
        let q = supabase
            .from('company_uploaded_data')
            .select('*')
            .eq('company_id', companyId)
            .range(from, from + PAGE - 1);

        if (branchFilter && branchFilter.length > 0) {
            q = q.in('branch_name', branchFilter);
        }

        const { data, error } = await q;
        if (error) {
            console.error('[reportService] Supabase error:', error);
            throw new Error(`Reports query failed: ${error.message}`);
        }
        if (!data || data.length === 0) break;

        all.push(...(data as RawRow[]));
        if (data.length < PAGE) break;
        from += PAGE;
        if (from > 500_000) break;
    }

    console.log(`[reportService] Fetched ${all.length} raw rows for company ${companyId}`);

    if (all.length === 0) return [];

    // Deduplicate by client_code + route + week + day (one row per visit)
    const seen = new Set<string>();
    const unique: RawRow[] = [];
    for (const r of all) {
        const key = `${r.client_code || r.id}_${r.route_name || ''}_${r.week_number || r.week || ''}_${r.day_name || r.day || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
    }

    console.log(`[reportService] ${unique.length} rows after dedup`);
    return unique.map(n);
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const uniqCustomers = (rows: NormalRow[]): NormalRow[] => {
    const seen = new Map<string, NormalRow>();
    rows.forEach(r => {
        const k = r.clientCode || r.id;
        if (!seen.has(k)) seen.set(k, r);
    });
    return Array.from(seen.values());
};

const classCount = (rows: NormalRow[], cls: string) =>
    rows.filter(r => r.classification === cls).length;

const storeCount = (rows: NormalRow[], type: string) =>
    rows.filter(r => r.storeType.includes(type)).length;

// ─────────────────────────────────────────────
// 1. Hierarchical Data (Branch → Route → User → Week → Day)
// ─────────────────────────────────────────────
export const computeHierarchy = (rows: NormalRow[]): HierarchicalData[] => {
    const byBranch = groupBy(rows, r => r.branch);
    const result: any[] = [];

    for (const [branchName, branchRows] of byBranch) {
        const bCustomers = uniqCustomers(branchRows);
        const branchId = `br_${branchName}`;
        const branchNode: any = {
            id: branchId,
            level_type: 'BRANCH',
            parent_id: null,
            name: branchName,
            total_clients: bCustomers.length,
            class_a_count: classCount(bCustomers, 'A'),
            class_b_count: classCount(bCustomers, 'B'),
            class_c_count: classCount(bCustomers, 'C'),
            supermarkets_count: storeCount(bCustomers, 'super'),
            retail_count: storeCount(bCustomers, 'retail'),
            hypermarkets_count: storeCount(bCustomers, 'hyper'),
            minimarkets_count: storeCount(bCustomers, 'mini'),
            districts_covered: new Set(bCustomers.map(r => r.district).filter(Boolean)).size,
            total_visits: branchRows.length,
            _children: [],
        };

        const byRoute = groupBy(branchRows, r => r.route);
        for (const [routeName, routeRows] of byRoute) {
            const rCustomers = uniqCustomers(routeRows);
            const routeId = `rt_${branchId}_${routeName}`;
            const routeNode: any = {
                id: routeId,
                level_type: 'ROUTE',
                parent_id: branchId,
                name: routeName,
                total_clients: rCustomers.length,
                class_a_count: classCount(rCustomers, 'A'),
                class_b_count: classCount(rCustomers, 'B'),
                class_c_count: classCount(rCustomers, 'C'),
                supermarkets_count: storeCount(rCustomers, 'super'),
                retail_count: storeCount(rCustomers, 'retail'),
                hypermarkets_count: storeCount(rCustomers, 'hyper'),
                minimarkets_count: storeCount(rCustomers, 'mini'),
                districts_covered: new Set(rCustomers.map(r => r.district).filter(Boolean)).size,
                total_visits: routeRows.length,
                _children: [],
            };

            const byRep = groupBy(routeRows, r => r.rep);
            for (const [repCode, repRows] of byRep) {
                const uCustomers = uniqCustomers(repRows);
                const userId = `u_${routeId}_${repCode}`;
                const userNode: any = {
                    id: userId,
                    level_type: 'USER',
                    parent_id: routeId,
                    name: repCode,
                    total_clients: uCustomers.length,
                    class_a_count: classCount(uCustomers, 'A'),
                    class_b_count: classCount(uCustomers, 'B'),
                    class_c_count: classCount(uCustomers, 'C'),
                    supermarkets_count: storeCount(uCustomers, 'super'),
                    retail_count: storeCount(uCustomers, 'retail'),
                    hypermarkets_count: storeCount(uCustomers, 'hyper'),
                    minimarkets_count: storeCount(uCustomers, 'mini'),
                    districts_covered: new Set(uCustomers.map(r => r.district).filter(Boolean)).size,
                    total_visits: repRows.length,
                    _children: [],
                };

                const byWeek = groupBy(repRows, r => r.week || 'W?');
                for (const [week, weekRows] of byWeek) {
                    const weekId = `w_${userId}_${week}`;
                    const weekNode: any = {
                        id: weekId,
                        level_type: 'WEEK',
                        parent_id: userId,
                        name: `Week ${week}`,
                        total_clients: uniqCustomers(weekRows).length,
                        class_a_count: 0, class_b_count: 0, class_c_count: 0,
                        supermarkets_count: 0, retail_count: 0,
                        hypermarkets_count: 0, minimarkets_count: 0,
                        districts_covered: 0,
                        total_visits: weekRows.length,
                        _children: [],
                    };

                    const byDay = groupBy(weekRows, r => r.day || 'Unknown');
                    for (const [day, dayRows] of byDay) {
                        weekNode._children.push({
                            id: `d_${weekId}_${day}`,
                            level_type: 'DAY',
                            parent_id: weekId,
                            name: day,
                            total_clients: uniqCustomers(dayRows).length,
                            class_a_count: 0, class_b_count: 0, class_c_count: 0,
                            supermarkets_count: 0, retail_count: 0,
                            hypermarkets_count: 0, minimarkets_count: 0,
                            districts_covered: 0,
                            total_visits: dayRows.length,
                            _children: [],
                        });
                    }
                    userNode._children.push(weekNode);
                }
                routeNode._children.push(userNode);
            }
            branchNode._children.push(routeNode);
        }
        result.push(branchNode);
    }
    return result;
};

function groupBy<T, K>(arr: T[], fn: (v: T) => K): Map<K, T[]> {
    const m = new Map<K, T[]>();
    for (const v of arr) {
        const k = fn(v);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(v);
    }
    return m;
}

// ─────────────────────────────────────────────
// 2. Route Summary
// ─────────────────────────────────────────────
export const computeRouteSummary = (rows: NormalRow[]): RouteSummaryData[] => {
    const byRoute = groupBy(rows, r => `${r.branch}||${r.route}`);
    const out: RouteSummaryData[] = [];
    byRoute.forEach((rRows, key) => {
        const [branch, route] = key.split('||');
        const custs = uniqCustomers(rRows);
        const weeks = new Set(rRows.map(r => r.week).filter(Boolean));
        const days = new Set(rRows.map(r => r.day).filter(Boolean));
        const reps = new Set(rRows.map(r => r.rep).filter(v => v && v !== 'Unassigned'));
        const withGps = custs.filter(c => c.lat && c.lng).length;
        out.push({
            route_name: route,
            branch_name: branch,
            total_clients: custs.length,
            class_a_pct: custs.length ? Math.round((classCount(custs, 'A') / custs.length) * 100) : 0,
            location_coverage_pct: custs.length ? Math.round((withGps / custs.length) * 100) : 0,
            weeks_active: weeks.size,
            days_active: days.size,
            sales_reps_count: Math.max(reps.size, 1),
            total_planned_visits: rRows.length,
        });
    });
    return out.sort((a, b) => b.total_clients - a.total_clients);
};

// ─────────────────────────────────────────────
// 3. Visit Frequency (per unique customer)
// ─────────────────────────────────────────────
export const computeVisitFrequency = (rows: NormalRow[]): VisitFrequencyData[] => {
    const byCust = groupBy(rows, r => r.clientCode || r.id);
    const out: VisitFrequencyData[] = [];
    byCust.forEach((cRows, _code) => {
        const first = cRows[0];
        const weeks = new Set(cRows.map(r => r.week).filter(Boolean));
        const days = new Set(cRows.map(r => r.day).filter(Boolean));
        const routes = new Set(cRows.map(r => r.route).filter(Boolean));
        out.push({
            client_code: first.clientCode,
            client_name_en: first.name,
            client_name_ar: '',
            classification: first.classification,
            store_type: first.storeType,
            district: first.district,
            total_visits: cRows.length,
            weeks_covered: weeks.size,
            days_per_week: weeks.size > 0 ? Math.round(days.size / weeks.size) : days.size,
            visit_days: Array.from(days).join(', '),
            routes_assigned: routes.size,
        });
    });
    return out.sort((a, b) => b.total_visits - a.total_visits);
};

// ─────────────────────────────────────────────
// 4. Route Efficiency
// ─────────────────────────────────────────────
export const computeRouteEfficiency = (rows: NormalRow[]): RouteEfficiencyData[] => {
    const byRoute = groupBy(rows, r => `${r.branch}||${r.route}`);
    const out: RouteEfficiencyData[] = [];
    byRoute.forEach((rRows, key) => {
        const [branch, route] = key.split('||');
        const custs = uniqCustomers(rRows);
        const days = new Set(rRows.map(r => r.day).filter(Boolean));
        const reps = new Set(rRows.map(r => r.rep).filter(v => v && v !== 'Unassigned'));
        const districts = new Set(custs.map(c => c.district).filter(Boolean));
        const withGps = custs.filter(c => c.lat && c.lng).length;
        out.push({
            route_name: route,
            branch_name: branch,
            total_clients: custs.length,
            districts_covered: districts.size,
            users_assigned: Math.max(reps.size, 1),
            avg_clients_per_day: days.size > 0 ? Math.round(custs.length / days.size) : custs.length,
            gps_coverage_percent: custs.length ? Math.round((withGps / custs.length) * 100) : 0,
        });
    });
    return out.sort((a, b) => b.total_clients - a.total_clients);
};

// ─────────────────────────────────────────────
// 5. User Workload
// ─────────────────────────────────────────────
export const computeUserWorkload = (rows: NormalRow[]): UserWorkloadData[] => {
    const byRep = groupBy(rows, r => r.rep);
    const out: UserWorkloadData[] = [];
    byRep.forEach((rRows, rep) => {
        const custs = uniqCustomers(rRows);
        const weeks = new Set(rRows.map(r => r.week).filter(Boolean));
        const days = new Set(rRows.map(r => r.day).filter(Boolean));
        const routes = new Set(rRows.map(r => r.route).filter(Boolean));
        const districts = new Set(custs.map(c => c.district).filter(Boolean));
        out.push({
            rep_code: rep,
            total_clients: custs.length,
            total_visits: rRows.length,
            weekly_visits: weeks.size > 0 ? Math.round(rRows.length / weeks.size) : rRows.length,
            avg_clients_per_day: days.size > 0 ? Math.round(custs.length / days.size) : custs.length,
            a_class_count: classCount(custs, 'A'),
            b_class_count: classCount(custs, 'B'),
            c_class_count: classCount(custs, 'C'),
            districts_covered: districts.size,
            routes_assigned: routes.size,
        });
    });
    return out.sort((a, b) => b.total_clients - a.total_clients);
};

// ─────────────────────────────────────────────
// 6. Data Quality (per route)
// ─────────────────────────────────────────────
export const computeDataQuality = (rows: NormalRow[]): DataQualityData[] => {
    const byRoute = groupBy(rows, r => `${r.branch}||${r.route}`);
    const pct = (c: number, t: number) => (t > 0 ? Math.round((c / t) * 100) : 0);
    const out: DataQualityData[] = [];
    byRoute.forEach((rRows, key) => {
        const [branch, route] = key.split('||');
        const custs = uniqCustomers(rRows);
        const n = custs.length;
        out.push({
            route_name: route,
            branch_name: branch,
            total_records: n,
            gps_coverage: pct(custs.filter(c => c.lat && c.lng).length, n),
            phone_coverage: pct(custs.filter(c => c.phone).length, n),
            classification_coverage: pct(custs.filter(c => c.classification).length, n),
            store_type_coverage: pct(custs.filter(c => c.storeType).length, n),
            schedule_coverage: pct(custs.filter(c => rRows.some(r => r.clientCode === c.clientCode && r.week && r.day)).length, n),
            vat_coverage: pct(custs.filter(c => c.vat).length, n),
        });
    });
    return out.sort((a, b) => a.route_name.localeCompare(b.route_name));
};

// ─────────────────────────────────────────────
// 7. Weekly Coverage (per customer)
// ─────────────────────────────────────────────
export const computeWeeklyCoverage = (rows: NormalRow[]): WeeklyCoverageData[] => {
    const byCust = groupBy(rows, r => r.clientCode || r.id);
    const hasWeek = (weeks: Set<string>, num: number): boolean => {
        const variants = [String(num), `W${num}`, `Week ${num}`, `week ${num}`, `week${num}`];
        return variants.some(v => weeks.has(v));
    };

    const out: WeeklyCoverageData[] = [];
    byCust.forEach((cRows, _code) => {
        const first = cRows[0];
        const weeks = new Set(cRows.map(r => r.week).filter(Boolean));
        const w1 = hasWeek(weeks, 1);
        const w2 = hasWeek(weeks, 2);
        const w3 = hasWeek(weeks, 3);
        const w4 = hasWeek(weeks, 4);
        const explicitCount = [w1, w2, w3, w4].filter(Boolean).length;
        // If no explicit week markers, fall back to distinct week count
        const finalCount = explicitCount > 0 ? explicitCount : Math.min(weeks.size, 4);

        out.push({
            client_code: first.clientCode,
            client_name: first.name,
            classification: first.classification,
            store_type: first.storeType,
            route_name: first.route,
            week_1_covered: w1 || (explicitCount === 0 && weeks.size >= 1),
            week_2_covered: w2 || (explicitCount === 0 && weeks.size >= 2),
            week_3_covered: w3 || (explicitCount === 0 && weeks.size >= 3),
            week_4_covered: w4 || (explicitCount === 0 && weeks.size >= 4),
            weeks_covered: finalCount,
            coverage_percent: Math.round((finalCount / 4) * 100),
        });
    });
    return out.sort((a, b) => a.weeks_covered - b.weeks_covered);
};

// ─────────────────────────────────────────────
// Filter data: unique branch names — from actual uploaded data
// ─────────────────────────────────────────────
export const fetchReportBranches = async (companyId: string): Promise<string[]> => {
    // Try company_branches first (normalized source)
    const { data: brs } = await supabase
        .from('company_branches')
        .select('name_en')
        .eq('company_id', companyId)
        .order('name_en');

    const names = (brs || []).map(b => b.name_en).filter(Boolean);
    if (names.length > 0) return names;

    // Fallback: distinct branch_name from uploaded data (paginated)
    const set = new Set<string>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data } = await supabase
            .from('company_uploaded_data')
            .select('branch_name')
            .eq('company_id', companyId)
            .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        data.forEach(r => r.branch_name && set.add(r.branch_name));
        if (data.length < PAGE) break;
        from += PAGE;
        if (from > 100_000) break;
    }
    return Array.from(set).sort();
};
