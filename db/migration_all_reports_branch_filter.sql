-- ============================================================================
-- MIGRATION: Add Branch Filtering Support to All Detailed Report RPCs
-- This migration updates all report RPC functions to accept p_branch_ids parameter
-- for filtering data based on restricted user branches.
-- 
-- Run this in Supabase SQL Editor to apply branch filtering to Detailed Reports
-- ============================================================================
-- RPC 2: Route Summary Report (Tab 2) - Updated with branch filtering
CREATE OR REPLACE FUNCTION get_route_summary_report(
        p_company_id TEXT DEFAULT NULL,
        p_branch_ids TEXT [] DEFAULT NULL -- NEW: Branch filter
    ) RETURNS TABLE (
        route_name TEXT,
        branch_name TEXT,
        total_clients INTEGER,
        class_a_pct NUMERIC,
        location_coverage_pct NUMERIC,
        weeks_active INTEGER,
        days_active INTEGER,
        sales_reps_count INTEGER,
        total_planned_visits INTEGER
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT c.route_name,
    MAX(c.branch_name) as branch_name,
    COUNT(DISTINCT c.client_code)::INTEGER as total_clients,
    ROUND(
        100.0 * COUNT(
            DISTINCT CASE
                WHEN c.classification = 'A' THEN c.client_code
            END
        ) / NULLIF(COUNT(DISTINCT c.client_code), 0),
        1
    ) as class_a_pct,
    ROUND(
        100.0 * COUNT(
            DISTINCT CASE
                WHEN c.lat IS NOT NULL
                AND c.lng IS NOT NULL THEN c.client_code
            END
        ) / NULLIF(COUNT(DISTINCT c.client_code), 0),
        1
    ) as location_coverage_pct,
    COUNT(DISTINCT c.week_number)::INTEGER as weeks_active,
    COUNT(DISTINCT c.day_name)::INTEGER as days_active,
    COUNT(DISTINCT c.rep_code)::INTEGER as sales_reps_count,
    COUNT(*)::INTEGER as total_planned_visits
FROM company_uploaded_data c
WHERE (
        p_company_id IS NULL
        OR c.company_id = p_company_id
    ) -- NEW: Branch filter
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR c.branch_code = ANY(p_branch_ids)
        OR c.branch_name = ANY(p_branch_ids)
    )
GROUP BY c.route_name
ORDER BY total_clients DESC;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_route_summary_report(TEXT, TEXT []) TO authenticated,
    service_role,
    anon;
-- RPC 3: Visit Frequency Analysis (Tab 3) - Updated with branch filtering
CREATE OR REPLACE FUNCTION get_visit_frequency_report(
        p_company_id TEXT DEFAULT NULL,
        p_limit INTEGER DEFAULT 100,
        p_branch_ids TEXT [] DEFAULT NULL -- NEW: Branch filter
    ) RETURNS TABLE (
        client_code TEXT,
        client_name_en TEXT,
        client_name_ar TEXT,
        classification TEXT,
        store_type TEXT,
        district TEXT,
        total_visits INTEGER,
        weeks_covered INTEGER,
        days_per_week NUMERIC,
        visit_days TEXT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT c.client_code,
    MAX(c.client_name_en) as client_name_en,
    MAX(c.client_name_ar) as client_name_ar,
    MAX(c.classification) as classification,
    MAX(c.store_type) as store_type,
    MAX(c.district) as district,
    COUNT(*)::INTEGER as total_visits,
    COUNT(DISTINCT c.week_number)::INTEGER as weeks_covered,
    ROUND(
        COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT c.week_number), 0),
        1
    ) as days_per_week,
    STRING_AGG(
        DISTINCT c.day_name,
        ', '
        ORDER BY c.day_name
    ) as visit_days
FROM company_uploaded_data c
WHERE (
        p_company_id IS NULL
        OR c.company_id = p_company_id
    ) -- NEW: Branch filter  
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR c.branch_code = ANY(p_branch_ids)
        OR c.branch_name = ANY(p_branch_ids)
    )
GROUP BY c.client_code
ORDER BY total_visits DESC
LIMIT p_limit;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_visit_frequency_report(TEXT, INTEGER, TEXT []) TO authenticated,
    service_role,
    anon;
-- RPC 4: Route Efficiency Report (Tab 4) - Updated with branch filtering
CREATE OR REPLACE FUNCTION get_route_efficiency_report(
        p_company_id TEXT DEFAULT NULL,
        p_branch_ids TEXT [] DEFAULT NULL -- NEW: Branch filter
    ) RETURNS TABLE (
        route_name TEXT,
        branch_name TEXT,
        total_clients INTEGER,
        avg_clients_per_day NUMERIC,
        districts_covered INTEGER,
        gps_coverage_percent NUMERIC,
        users_assigned INTEGER
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT c.route_name,
    MAX(c.branch_name) as branch_name,
    COUNT(DISTINCT c.client_code)::INTEGER as total_clients,
    ROUND(
        COUNT(DISTINCT c.client_code)::NUMERIC / NULLIF(COUNT(DISTINCT c.day_name), 0),
        1
    ) as avg_clients_per_day,
    COUNT(DISTINCT c.district)::INTEGER as districts_covered,
    ROUND(
        100.0 * COUNT(
            DISTINCT CASE
                WHEN c.lat IS NOT NULL
                AND c.lng IS NOT NULL THEN c.client_code
            END
        ) / NULLIF(COUNT(DISTINCT c.client_code), 0),
        1
    ) as gps_coverage_percent,
    COUNT(DISTINCT c.rep_code)::INTEGER as users_assigned
FROM company_uploaded_data c
WHERE (
        p_company_id IS NULL
        OR c.company_id = p_company_id
    ) -- NEW: Branch filter
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR c.branch_code = ANY(p_branch_ids)
        OR c.branch_name = ANY(p_branch_ids)
    )
GROUP BY c.route_name
ORDER BY total_clients DESC;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_route_efficiency_report(TEXT, TEXT []) TO authenticated,
    service_role,
    anon;
-- RPC 5: User Workload Report (Tab 5) - Updated with branch filtering
CREATE OR REPLACE FUNCTION get_user_workload_report(
        p_company_id TEXT DEFAULT NULL,
        p_branch_ids TEXT [] DEFAULT NULL -- NEW: Branch filter
    ) RETURNS TABLE (
        rep_code TEXT,
        total_clients INTEGER,
        weekly_visits INTEGER,
        avg_clients_per_day NUMERIC,
        a_class_count INTEGER,
        b_class_count INTEGER,
        c_class_count INTEGER
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT c.rep_code,
    COUNT(DISTINCT c.client_code)::INTEGER as total_clients,
    ROUND(COUNT(*)::NUMERIC / 4, 0)::INTEGER as weekly_visits,
    ROUND(
        COUNT(DISTINCT c.client_code)::NUMERIC / NULLIF(COUNT(DISTINCT c.day_name), 0),
        1
    ) as avg_clients_per_day,
    COUNT(
        DISTINCT CASE
            WHEN c.classification = 'A' THEN c.client_code
        END
    )::INTEGER as a_class_count,
    COUNT(
        DISTINCT CASE
            WHEN c.classification = 'B' THEN c.client_code
        END
    )::INTEGER as b_class_count,
    COUNT(
        DISTINCT CASE
            WHEN c.classification = 'C' THEN c.client_code
        END
    )::INTEGER as c_class_count
FROM company_uploaded_data c
WHERE (
        p_company_id IS NULL
        OR c.company_id = p_company_id
    )
    AND c.rep_code IS NOT NULL -- NEW: Branch filter
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR c.branch_code = ANY(p_branch_ids)
        OR c.branch_name = ANY(p_branch_ids)
    )
GROUP BY c.rep_code
ORDER BY total_clients DESC;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_workload_report(TEXT, TEXT []) TO authenticated,
    service_role,
    anon;
-- RPC 6: Data Quality Report (Tab 6) - Updated with branch filtering
CREATE OR REPLACE FUNCTION get_data_quality_report(
        p_company_id TEXT DEFAULT NULL,
        p_branch_ids TEXT [] DEFAULT NULL -- NEW: Branch filter
    ) RETURNS TABLE (
        route_name TEXT,
        branch_name TEXT,
        total_records INTEGER,
        gps_coverage NUMERIC,
        phone_coverage NUMERIC,
        classification_coverage NUMERIC,
        store_type_coverage NUMERIC,
        schedule_coverage NUMERIC,
        vat_coverage NUMERIC
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT c.route_name,
    MAX(c.branch_name) as branch_name,
    COUNT(*)::INTEGER as total_records,
    ROUND(
        100.0 * COUNT(
            CASE
                WHEN c.lat IS NOT NULL
                AND c.lng IS NOT NULL THEN 1
            END
        ) / NULLIF(COUNT(*), 0),
        0
    ) as gps_coverage,
    ROUND(
        100.0 * COUNT(
            CASE
                WHEN c.phone IS NOT NULL
                AND c.phone <> '' THEN 1
            END
        ) / NULLIF(COUNT(*), 0),
        0
    ) as phone_coverage,
    ROUND(
        100.0 * COUNT(
            CASE
                WHEN c.classification IS NOT NULL
                AND c.classification <> '' THEN 1
            END
        ) / NULLIF(COUNT(*), 0),
        0
    ) as classification_coverage,
    ROUND(
        100.0 * COUNT(
            CASE
                WHEN c.store_type IS NOT NULL
                AND c.store_type <> '' THEN 1
            END
        ) / NULLIF(COUNT(*), 0),
        0
    ) as store_type_coverage,
    ROUND(
        100.0 * COUNT(
            CASE
                WHEN c.week_number IS NOT NULL
                AND c.day_name IS NOT NULL THEN 1
            END
        ) / NULLIF(COUNT(*), 0),
        0
    ) as schedule_coverage,
    ROUND(
        100.0 * COUNT(
            CASE
                WHEN c.vat_number IS NOT NULL
                AND c.vat_number <> '' THEN 1
            END
        ) / NULLIF(COUNT(*), 0),
        0
    ) as vat_coverage
FROM company_uploaded_data c
WHERE (
        p_company_id IS NULL
        OR c.company_id = p_company_id
    ) -- NEW: Branch filter
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR c.branch_code = ANY(p_branch_ids)
        OR c.branch_name = ANY(p_branch_ids)
    )
GROUP BY c.route_name
ORDER BY total_records DESC;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_data_quality_report(TEXT, TEXT []) TO authenticated,
    service_role,
    anon;
-- RPC 7: Weekly Coverage Report (Tab 7) - Updated with branch filtering
CREATE OR REPLACE FUNCTION get_weekly_coverage_report(
        p_company_id TEXT DEFAULT NULL,
        p_limit INTEGER DEFAULT 100,
        p_branch_ids TEXT [] DEFAULT NULL -- NEW: Branch filter
    ) RETURNS TABLE (
        client_code TEXT,
        client_name TEXT,
        weeks_covered INTEGER,
        week_1_covered BOOLEAN,
        week_2_covered BOOLEAN,
        week_3_covered BOOLEAN,
        week_4_covered BOOLEAN,
        coverage_percent NUMERIC
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT c.client_code,
    MAX(
        COALESCE(c.client_name_en, c.client_name_ar, 'Unknown')
    ) as client_name,
    COUNT(DISTINCT c.week_number)::INTEGER as weeks_covered,
    BOOL_OR(
        c.week_number = '1'
        OR c.week_number = 'W1'
        OR c.week_number = 'Week 1'
    ) as week_1_covered,
    BOOL_OR(
        c.week_number = '2'
        OR c.week_number = 'W2'
        OR c.week_number = 'Week 2'
    ) as week_2_covered,
    BOOL_OR(
        c.week_number = '3'
        OR c.week_number = 'W3'
        OR c.week_number = 'Week 3'
    ) as week_3_covered,
    BOOL_OR(
        c.week_number = '4'
        OR c.week_number = 'W4'
        OR c.week_number = 'Week 4'
    ) as week_4_covered,
    ROUND(100.0 * COUNT(DISTINCT c.week_number) / 4, 0) as coverage_percent
FROM company_uploaded_data c
WHERE (
        p_company_id IS NULL
        OR c.company_id = p_company_id
    )
    AND c.week_number IS NOT NULL -- NEW: Branch filter
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR c.branch_code = ANY(p_branch_ids)
        OR c.branch_name = ANY(p_branch_ids)
    )
GROUP BY c.client_code
ORDER BY weeks_covered ASC,
    client_name -- Show gaps first
LIMIT p_limit;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_weekly_coverage_report(TEXT, INTEGER, TEXT []) TO authenticated,
    service_role,
    anon;
-- ============================================================================
-- ALSO UPDATE: Insights Dashboard RPC with KPI calculations
-- This updates get_dashboard_stats_from_upload for proper Time/User and Frequency calculations
-- ============================================================================
CREATE OR REPLACE FUNCTION get_dashboard_stats_from_upload(
        p_company_id TEXT,
        p_branch_ids TEXT [] DEFAULT NULL -- For branch-level filtering
    ) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_total_branches INT;
v_total_routes INT;
v_total_customers INT;
v_total_visits INT;
v_total_time INT;
v_total_distance NUMERIC;
v_total_users INT;
v_time_per_user NUMERIC;
v_frequency NUMERIC;
v_efficiency NUMERIC;
v_result JSONB;
BEGIN -- Total Branches (distinct branch_code)
SELECT COUNT(DISTINCT branch_code) INTO v_total_branches
FROM company_uploaded_data
WHERE company_id = p_company_id
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR branch_code = ANY(p_branch_ids)
        OR branch_name = ANY(p_branch_ids)
    );
-- Total Routes
SELECT COUNT(DISTINCT route_name) INTO v_total_routes
FROM company_uploaded_data
WHERE company_id = p_company_id
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR branch_code = ANY(p_branch_ids)
        OR branch_name = ANY(p_branch_ids)
    );
-- Total Customers
SELECT COUNT(DISTINCT client_code) INTO v_total_customers
FROM company_uploaded_data
WHERE company_id = p_company_id
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR branch_code = ANY(p_branch_ids)
        OR branch_name = ANY(p_branch_ids)
    );
-- Total Visits
SELECT COUNT(*) INTO v_total_visits
FROM company_uploaded_data
WHERE company_id = p_company_id
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR branch_code = ANY(p_branch_ids)
        OR branch_name = ANY(p_branch_ids)
    );
-- Total Users (distinct rep_code) - for Time/User calculation
SELECT COUNT(DISTINCT rep_code) INTO v_total_users
FROM company_uploaded_data
WHERE company_id = p_company_id
    AND rep_code IS NOT NULL
    AND (
        p_branch_ids IS NULL
        OR array_length(p_branch_ids, 1) IS NULL
        OR branch_code = ANY(p_branch_ids)
        OR branch_name = ANY(p_branch_ids)
    );
-- Derived Calculations
v_total_distance := ROUND(v_total_visits * 2.2, 1);
-- Estimated distance per visit
v_total_time := v_total_visits * 15;
-- 15 minutes per visit (estimated)
-- Time Per User (hours) = total time (minutes) / 60 / number of users
IF v_total_users > 0 THEN v_time_per_user := ROUND((v_total_time::NUMERIC / 60) / v_total_users, 1);
ELSE v_time_per_user := 0;
END IF;
-- Frequency = average visits per customer per week (assuming 4 weeks of data)
IF v_total_customers > 0 THEN v_frequency := ROUND(
    v_total_visits::NUMERIC / v_total_customers / 4,
    1
);
ELSE v_frequency := 0;
END IF;
-- Efficiency = 8-Hour Shift Utilization Curve (Aggregated Average)
-- 1. Calculate shift duration for every Rep/Day combination (20m service + 5m avg drive per visit)
WITH daily_shifts AS (
    SELECT 
        rep_code, 
        week_number, 
        day_name,
        COUNT(*) * 25 as total_shift_mins -- 20m service + 5m drive estimate
    FROM company_uploaded_data
    WHERE company_id = p_company_id
        AND (
            p_branch_ids IS NULL
            OR array_length(p_branch_ids, 1) IS NULL
            OR branch_code = ANY(p_branch_ids)
            OR branch_name = ANY(p_branch_ids)
        )
    GROUP BY rep_code, week_number, day_name
),
shift_scores AS (
    SELECT 
        CASE 
            WHEN total_shift_mins <= 480 THEN (total_shift_mins::FLOAT / 480.0) * 100
            ELSE (480.0 / total_shift_mins::FLOAT) * 100
        END as score
    FROM daily_shifts
)
SELECT ROUND(COALESCE(AVG(score), 0), 0) INTO v_efficiency FROM shift_scores;
-- Construct Response
v_result := jsonb_build_object(
    'kpis',
    jsonb_build_object(
        'totalBranches',
        v_total_branches,
        'totalRoutes',
        v_total_routes,
        'totalCustomers',
        v_total_customers,
        'totalVisits',
        v_total_visits,
        'totalDistanceKm',
        v_total_distance,
        'totalTimeMinutes',
        v_total_time,
        'timePerUser',
        v_time_per_user,
        'frequency',
        v_frequency,
        'efficiency',
        COALESCE(v_efficiency, 100)
    ),
    'mapData',
    '[]'::jsonb --  Map data handled separately for performance
);
RETURN v_result;
END;
$$;
-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats_from_upload(TEXT, TEXT []) TO authenticated,
    service_role,
    anon;
-- Done!
-- After running this migration, restart your backend server for changes to take effect.