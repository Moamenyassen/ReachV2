-- ============================================================================
-- MIGRATION: Aggregate Filter Stats (Counts per Branch and Route) - V2 (Pure SQL)
-- Purpose: Provides efficient distinct customer counts for filter dropdowns.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_filter_stats(p_company_id TEXT)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER AS $$
    SELECT jsonb_build_object(
        'branches', COALESCE((
            SELECT jsonb_object_agg(b.name_en, q.c_count)
            FROM (
                SELECT branch_id, COUNT(DISTINCT id) as c_count
                FROM normalized_customers
                WHERE company_id = p_company_id
                GROUP BY branch_id
            ) q
            JOIN company_branches b ON b.id = q.branch_id
        ), '{}'::jsonb),
        'routes', COALESCE((
            SELECT jsonb_object_agg(r.name, q.r_count)
            FROM (
                SELECT route_id, COUNT(DISTINCT customer_id) as r_count
                FROM route_visits
                WHERE company_id = p_company_id
                GROUP BY route_id
            ) q
            JOIN routes r ON r.id = q.route_id
        ), '{}'::jsonb)
    );
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_filter_stats(TEXT) TO authenticated, service_role;
