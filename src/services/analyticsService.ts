import { supabase } from './supabase';

export interface DashboardSummary {
    total_visits: number;
    active_routes: number;
    efficiency_score: number;
    top_performer_name: string;
}

/**
 * Fetches high-level dashboard KPIs directly from the database RPC function.
 * This skips downloading thousands of rows to the client, improving performance significantly.
 * 
 * @param branchId - Optional: Filter by specific branch UUID. If null, returns global company stats.
 * @returns DashboardSummary object
 */
export const fetchDashboardSummary = async (branchId?: string): Promise<DashboardSummary | null> => {
    try {
        const { data, error } = await supabase
            .rpc('get_dashboard_summary', {
                target_branch_id: branchId || null
            });

        if (error) {
            console.error('Analytics RPC Error:', error);
            throw error;
        }

        return data as DashboardSummary;
    } catch (e) {
        console.error('Failed to fetch dashboard summary:', e);
        return null;
    }
};

/**
 * Fetches detailed route performance stats from the server-side view.
 * Useful for "Top Performers" list or "Route Efficiency" charts.
 */
export const fetchRoutePerformance = async (branchId?: string) => {
    let query = supabase.from('view_route_performance').select('*');

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query.order('efficiency_score', { ascending: false });

    if (error) {
        console.error('Error fetching route performance:', error);
        return [];
    }
    return data;
};
