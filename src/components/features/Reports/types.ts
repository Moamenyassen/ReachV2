
export interface HierarchicalData {
    level_type: 'BRANCH' | 'ROUTE' | 'USER' | 'WEEK' | 'DAY';
    parent_id: string | null;
    id: string;
    name: string;
    total_clients: number;
    class_a_count: number;
    class_b_count: number;
    class_c_count: number;
    supermarkets_count: number;
    retail_count: number;
    hypermarkets_count: number;
    minimarkets_count: number;
    districts_covered: number;
    total_visits: number;
}

export interface RouteSummaryData {
    route_name: string;
    branch_name: string;
    total_clients: number;
    class_a_pct: number;
    location_coverage_pct: number;
    weeks_active: number;
    days_active: number;
    sales_reps_count: number;
    total_planned_visits: number;
}

export interface VisitFrequencyData {
    client_code: string;
    client_name_en: string;
    client_name_ar: string;
    classification: string;
    store_type: string;
    district: string;
    total_visits: number;
    weeks_covered: number;
    days_per_week: number;
    visit_days: string;
    routes_assigned: number;
}

export interface RouteEfficiencyData {
    route_name: string;
    branch_name: string;
    total_clients: number;
    districts_covered: number;
    users_assigned: number;
    avg_clients_per_day: number;
    gps_coverage_percent: number;
}

export interface UserWorkloadData {
    rep_code: string;
    total_clients: number;
    total_visits: number;
    weekly_visits: number;
    avg_clients_per_day: number;
    a_class_count: number;
    b_class_count: number;
    c_class_count: number;
    districts_covered: number;
    routes_assigned: number;
}

export interface DataQualityData {
    route_name: string;
    branch_name: string;
    total_records: number;
    gps_coverage: number;
    phone_coverage: number;
    classification_coverage: number;
    store_type_coverage: number;
    schedule_coverage: number;
    vat_coverage: number;
}

export interface WeeklyCoverageData {
    client_code: string;
    client_name: string;
    classification: string;
    store_type: string;
    route_name: string;
    week_1_covered: boolean;
    week_2_covered: boolean;
    week_3_covered: boolean;
    week_4_covered: boolean;
    weeks_covered: number;
    coverage_percent: number;
}

export interface ReportFilterState {
    company_id?: string;
    region?: string;
    branch_code?: string;
    route_name?: string;
    limit?: number;
    // NEW: For branch-based access control
    branchIds?: string[];
}
