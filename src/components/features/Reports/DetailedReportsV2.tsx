/**
 * DetailedReportsV2.tsx
 * Full redesign of the Detailed Reports screen.
 *  - Single React Query fetch from company_uploaded_data, cached 5 min
 *  - All reports compute from the same dataset (no extra round-trips)
 *  - Sidebar report library, sticky multi-select filter bar, KPI strip
 *  - Generic sortable / searchable / CSV-exportable table
 *  - 3D-floating shadow visual language matching Insights
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    Search, Filter, X, Download, ChevronDown, ChevronRight, ArrowUpDown,
    LayoutGrid, Users, MapPin, Activity, BarChart3, Calendar, Database,
    Building2, Route as RouteIcon, ClipboardCheck, Target, Loader2, CheckCircle2,
    Maximize2, Minimize2, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { User as UserType } from '../../../types';
import {
    fetchReportData,
    computeRouteSummary,
    computeVisitFrequency,
    computeRouteEfficiency,
    computeUserWorkload,
    computeDataQuality,
    computeWeeklyCoverage,
} from '../../../services/reportService';

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface DetailedReportsV2Props {
    currentUser?: UserType;
    onBack?: () => void;
    isDarkMode?: boolean;
    language?: 'en' | 'ar';
    onToggleTheme?: () => void;
    onToggleLang?: () => void;
    hideHeader?: boolean;
    currentFilters?: { region?: string; route?: string; day?: string; week?: string };
}

// ─────────────────────────────────────────────
// Filter state
// ─────────────────────────────────────────────
interface FilterState {
    branches: Set<string>;
    routes: Set<string>;
    days: Set<string>;
    weeks: Set<string>;
    classifications: Set<string>;
    reps: Set<string>;
    search: string;
}

const emptyFilters = (): FilterState => ({
    branches: new Set(),
    routes: new Set(),
    days: new Set(),
    weeks: new Set(),
    classifications: new Set(),
    reps: new Set(),
    search: '',
});

// ─────────────────────────────────────────────
// Report config: each report knows its column shape + which compute fn to use
// ─────────────────────────────────────────────
type Report = {
    id: string;
    label: string;
    labelAr: string;
    group: 'overview' | 'performance' | 'quality' | 'coverage';
    Icon: React.ComponentType<{ className?: string }>;
    description: string;
    descriptionAr: string;
    compute: (rows: any[]) => any[];
    columns: ColumnDef[];
    /** which keys are searched by the search box */
    searchKeys: string[];
    /** Drill-down: clicking a row's chevron opens the target report,
     *  inheriting the row's value(s) as filters. Each entry: pull `fromKey`
     *  from the clicked row, push it into `toFilter` set. The first entry's
     *  value is shown in the breadcrumb crumb. */
    drillTarget?: {
        reportId: string;
        inherits: Array<{ fromKey: string; toFilter: keyof FilterState }>;
        crumbKey: string; // which row field shows in the breadcrumb
    };
};

type ColumnFormat = 'number' | 'percent' | 'text' | 'class' | 'check' | 'status' | 'visits';
type ColumnDef = {
    key: string;
    label: string;
    labelAr: string;
    align?: 'left' | 'right' | 'center';
    format?: ColumnFormat;
    sortable?: boolean;
    /** if true, clicking a cell adds it to filters */
    filterable?: keyof FilterState;
    /** width hint */
    width?: string;
};

// ─────────────────────────────────────────────
// Status / alert helpers — produce { tone, label } objects rendered
// by the 'status' formatter as a colored pill.
// ─────────────────────────────────────────────
const status = (tone: 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' | 'slate', label: string) => ({ tone, label });

const branchHealthBadge = (customers: number, gpsPct: number) => {
    if (customers < 100) return status('rose', 'LOW LOAD');
    if (customers > 1500) return status('amber', 'HIGH LOAD');
    if (gpsPct < 50) return status('rose', 'POOR GPS');
    if (gpsPct < 80) return status('amber', 'WATCH');
    return status('emerald', 'HEALTHY');
};

const routeHealthBadge = (customers: number, classAPct: number, gpsPct: number) => {
    if (customers < 30) return status('rose', 'UNDER');
    if (customers > 200) return status('amber', 'OVER');
    if (gpsPct < 50) return status('rose', 'BAD GPS');
    if (classAPct >= 30 && gpsPct >= 80) return status('emerald', 'STRONG');
    return status('cyan', 'STABLE');
};

const efficiencyBadge = (avgPerDay: number, gpsPct: number) => {
    if (gpsPct < 50) return status('rose', 'BAD DATA');
    if (avgPerDay < 10) return status('amber', 'LIGHT');
    if (avgPerDay > 35) return status('rose', 'OVERLOAD');
    return status('emerald', 'OPTIMAL');
};

const workloadBadge = (customers: number, weeklyVisits: number) => {
    if (customers > 250) return status('rose', 'OVERLOADED');
    if (customers > 150) return status('amber', 'HEAVY');
    if (customers < 30) return status('cyan', 'LIGHT');
    return status('emerald', 'BALANCED');
};

const qualityBadge = (gps: number, phone: number, cls: number, schedule: number) => {
    const avg = (gps + phone + cls + schedule) / 4;
    if (avg < 50) return status('rose', 'CRITICAL');
    if (avg < 75) return status('amber', 'NEEDS WORK');
    if (avg < 90) return status('cyan', 'GOOD');
    return status('emerald', 'EXCELLENT');
};

const coverageBadge = (pct: number) => {
    if (pct >= 100) return status('emerald', 'FULL');
    if (pct >= 75) return status('cyan', 'STRONG');
    if (pct >= 50) return status('amber', 'PARTIAL');
    if (pct >= 25) return status('rose', 'LOW');
    return status('rose', 'GAP');
};

const visitFreqBadge = (visits: number) => {
    if (visits >= 16) return status('emerald', 'INTENSIVE');
    if (visits >= 8) return status('cyan', 'REGULAR');
    if (visits >= 3) return status('amber', 'LIGHT');
    return status('rose', 'RARE');
};

// ─────────────────────────────────────────────
// Day-of-week normalization (handles "Saturday" / "SAT" / "sat" / "saturday" etc)
// ─────────────────────────────────────────────
const normalizeDay = (raw: string): string => {
    if (!raw) return '';
    const s = String(raw).trim().toUpperCase().slice(0, 3);
    return ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'].includes(s) ? s : '';
};

// Branch overview: synthesized from rows on the fly
const computeBranchOverview = (rows: any[]) => {
    const map = new Map<string, { branch: string; customers: Set<string>; routes: Set<string>; reps: Set<string>; visits: number; gpsCovered: number }>();
    rows.forEach(r => {
        const k = r.branch || 'Unknown';
        if (!map.has(k)) map.set(k, { branch: k, customers: new Set(), routes: new Set(), reps: new Set(), visits: 0, gpsCovered: 0 });
        const e = map.get(k)!;
        e.visits += 1;
        if (r.clientCode) e.customers.add(r.clientCode);
        if (r.route) e.routes.add(r.route);
        if (r.rep && r.rep !== 'Unassigned') e.reps.add(r.rep);
    });
    // gps coverage by distinct customer
    const seen = new Set<string>();
    rows.forEach(r => {
        if (!r.clientCode) return;
        const composite = `${r.branch}|${r.clientCode}`;
        if (seen.has(composite)) return;
        seen.add(composite);
        if (r.lat && r.lng) {
            const e = map.get(r.branch);
            if (e) e.gpsCovered += 1;
        }
    });
    return Array.from(map.values()).map(e => {
        const customers = e.customers.size;
        const gps = customers ? Math.round((e.gpsCovered / customers) * 100) : 0;
        return {
            branch_name: e.branch,
            total_customers: customers,
            total_routes: e.routes.size,
            total_reps: e.reps.size,
            total_visits: e.visits,
            gps_coverage: gps,
            health: branchHealthBadge(customers, gps),
        };
    }).sort((a, b) => b.total_customers - a.total_customers);
};

// ─────────────────────────────────────────────
// Daily Coverage: per-customer day-of-week presence (Sat–Fri)
// ─────────────────────────────────────────────
const computeDailyCoverage = (rows: any[]) => {
    const byCust = new Map<string, any[]>();
    rows.forEach(r => {
        const k = r.clientCode || r.id;
        if (!byCust.has(k)) byCust.set(k, []);
        byCust.get(k)!.push(r);
    });
    const out: any[] = [];
    byCust.forEach(cRows => {
        const first = cRows[0];
        const days = new Set(cRows.map(r => normalizeDay(r.day)).filter(Boolean));
        const count = days.size;
        const pct = Math.round((count / 7) * 100);
        out.push({
            client_code: first.clientCode,
            client_name: first.name,
            classification: first.classification,
            store_type: first.storeType,
            route_name: first.route,
            branch_name: first.branch,
            sat: days.has('SAT'),
            sun: days.has('SUN'),
            mon: days.has('MON'),
            tue: days.has('TUE'),
            wed: days.has('WED'),
            thu: days.has('THU'),
            fri: days.has('FRI'),
            days_covered: count,
            coverage_percent: pct,
            status: coverageBadge(pct),
        });
    });
    return out.sort((a, b) => a.days_covered - b.days_covered);
};

// Wrap existing compute fns to attach a status field on each row
const withStatus = <T extends Record<string, any>>(fn: (rows: any[]) => T[], compute: (row: T) => any) =>
    (rows: any[]): T[] => fn(rows).map(r => ({ ...r, status: compute(r) }));

const REPORTS: Report[] = [
    {
        id: 'branchOverview',
        label: 'Branch Overview',
        labelAr: 'نظرة عامة على الفروع',
        group: 'overview',
        Icon: Building2,
        description: 'Per-branch totals: customers, routes, reps, visits, GPS coverage',
        descriptionAr: 'إجماليات لكل فرع: العملاء، المسارات، المندوبون، الزيارات، تغطية GPS',
        compute: computeBranchOverview, // already attaches `health`
        columns: [
            { key: 'branch_name', label: 'Branch', labelAr: 'الفرع', sortable: true, filterable: 'branches' },
            { key: 'total_customers', label: 'Customers', labelAr: 'العملاء', align: 'right', format: 'number', sortable: true },
            { key: 'total_routes', label: 'Routes', labelAr: 'المسارات', align: 'right', format: 'number', sortable: true },
            { key: 'total_reps', label: 'Reps', labelAr: 'المندوبون', align: 'right', format: 'number', sortable: true },
            { key: 'total_visits', label: 'Visits', labelAr: 'الزيارات', align: 'right', format: 'number', sortable: true },
            { key: 'gps_coverage', label: 'GPS %', labelAr: 'GPS %', align: 'right', format: 'percent', sortable: true },
            { key: 'health', label: 'Health', labelAr: 'الحالة', align: 'center', format: 'status' },
        ],
        searchKeys: ['branch_name'],
        drillTarget: {
            reportId: 'routeSummary',
            inherits: [{ fromKey: 'branch_name', toFilter: 'branches' }],
            crumbKey: 'branch_name',
        },
    },
    {
        id: 'routeSummary',
        label: 'Route Summary',
        labelAr: 'ملخص المسارات',
        group: 'overview',
        Icon: RouteIcon,
        description: 'Per-route KPIs: customer count, A-class %, GPS %, weeks/days active, reps',
        descriptionAr: 'مؤشرات لكل مسار: عدد العملاء، نسبة الفئة أ، GPS، الأسابيع والأيام النشطة',
        compute: withStatus(computeRouteSummary, r => routeHealthBadge(r.total_clients, r.class_a_pct, r.location_coverage_pct)),
        columns: [
            { key: 'route_name', label: 'Route', labelAr: 'المسار', sortable: true, filterable: 'routes' },
            { key: 'branch_name', label: 'Branch', labelAr: 'الفرع', sortable: true, filterable: 'branches' },
            { key: 'total_clients', label: 'Customers', labelAr: 'العملاء', align: 'right', format: 'number', sortable: true },
            { key: 'class_a_pct', label: 'A %', labelAr: 'فئة أ %', align: 'right', format: 'percent', sortable: true },
            { key: 'location_coverage_pct', label: 'GPS %', labelAr: 'GPS %', align: 'right', format: 'percent', sortable: true },
            { key: 'weeks_active', label: 'Weeks', labelAr: 'أسابيع', align: 'right', format: 'number', sortable: true },
            { key: 'days_active', label: 'Days', labelAr: 'أيام', align: 'right', format: 'number', sortable: true },
            { key: 'sales_reps_count', label: 'Reps', labelAr: 'مندوبون', align: 'right', format: 'number', sortable: true },
            { key: 'total_planned_visits', label: 'Visits', labelAr: 'زيارات', align: 'right', format: 'number', sortable: true },
            { key: 'status', label: 'Health', labelAr: 'الحالة', align: 'center', format: 'status' },
        ],
        searchKeys: ['route_name', 'branch_name'],
        drillTarget: {
            reportId: 'visitFrequency',
            inherits: [
                { fromKey: 'route_name', toFilter: 'routes' },
                { fromKey: 'branch_name', toFilter: 'branches' },
            ],
            crumbKey: 'route_name',
        },
    },
    {
        id: 'routeEfficiency',
        label: 'Route Efficiency',
        labelAr: 'كفاءة المسارات',
        group: 'performance',
        Icon: BarChart3,
        description: 'Customers per day, districts covered, GPS coverage',
        descriptionAr: 'العملاء يوميًا، الأحياء المغطاة، تغطية GPS',
        compute: withStatus(computeRouteEfficiency, r => efficiencyBadge(r.avg_clients_per_day, r.gps_coverage_percent)),
        columns: [
            { key: 'route_name', label: 'Route', labelAr: 'المسار', sortable: true, filterable: 'routes' },
            { key: 'branch_name', label: 'Branch', labelAr: 'الفرع', sortable: true, filterable: 'branches' },
            { key: 'total_clients', label: 'Customers', labelAr: 'العملاء', align: 'right', format: 'number', sortable: true },
            { key: 'districts_covered', label: 'Districts', labelAr: 'الأحياء', align: 'right', format: 'number', sortable: true },
            { key: 'users_assigned', label: 'Reps', labelAr: 'مندوبون', align: 'right', format: 'number', sortable: true },
            { key: 'avg_clients_per_day', label: 'Avg / Day', labelAr: 'متوسط/اليوم', align: 'right', format: 'number', sortable: true },
            { key: 'gps_coverage_percent', label: 'GPS %', labelAr: 'GPS %', align: 'right', format: 'percent', sortable: true },
            { key: 'status', label: 'Efficiency', labelAr: 'الكفاءة', align: 'center', format: 'status' },
        ],
        searchKeys: ['route_name', 'branch_name'],
        drillTarget: {
            reportId: 'visitFrequency',
            inherits: [
                { fromKey: 'route_name', toFilter: 'routes' },
                { fromKey: 'branch_name', toFilter: 'branches' },
            ],
            crumbKey: 'route_name',
        },
    },
    {
        id: 'userWorkload',
        label: 'User Workload',
        labelAr: 'عبء المندوبين',
        group: 'performance',
        Icon: Users,
        description: 'Per-rep load: customers, visits, weekly load, class mix, routes',
        descriptionAr: 'عبء كل مندوب: العملاء، الزيارات، الحمل الأسبوعي، توزيع الفئات',
        compute: withStatus(computeUserWorkload, r => workloadBadge(r.total_clients, r.weekly_visits)),
        columns: [
            { key: 'rep_code', label: 'Rep Code', labelAr: 'كود المندوب', sortable: true },
            { key: 'total_clients', label: 'Customers', labelAr: 'العملاء', align: 'right', format: 'number', sortable: true },
            { key: 'total_visits', label: 'Visits', labelAr: 'الزيارات', align: 'right', format: 'number', sortable: true },
            { key: 'weekly_visits', label: 'Weekly', labelAr: 'أسبوعي', align: 'right', format: 'number', sortable: true },
            { key: 'avg_clients_per_day', label: 'Avg / Day', labelAr: 'متوسط/اليوم', align: 'right', format: 'number', sortable: true },
            { key: 'a_class_count', label: 'A', labelAr: 'أ', align: 'right', format: 'number', sortable: true },
            { key: 'b_class_count', label: 'B', labelAr: 'ب', align: 'right', format: 'number', sortable: true },
            { key: 'c_class_count', label: 'C', labelAr: 'ج', align: 'right', format: 'number', sortable: true },
            { key: 'districts_covered', label: 'Districts', labelAr: 'الأحياء', align: 'right', format: 'number', sortable: true },
            { key: 'routes_assigned', label: 'Routes', labelAr: 'المسارات', align: 'right', format: 'number', sortable: true },
            { key: 'status', label: 'Load', labelAr: 'الحمل', align: 'center', format: 'status' },
        ],
        searchKeys: ['rep_code'],
        drillTarget: {
            reportId: 'visitFrequency',
            inherits: [{ fromKey: 'rep_code', toFilter: 'reps' }],
            crumbKey: 'rep_code',
        },
    },
    {
        id: 'dataQuality',
        label: 'Data Quality',
        labelAr: 'جودة البيانات',
        group: 'quality',
        Icon: ClipboardCheck,
        description: 'GPS / phone / classification / store-type / VAT coverage per route',
        descriptionAr: 'تغطية GPS، الهاتف، التصنيف، نوع المتجر، الضريبة لكل مسار',
        compute: withStatus(computeDataQuality, r => qualityBadge(r.gps_coverage, r.phone_coverage, r.classification_coverage, r.schedule_coverage)),
        columns: [
            { key: 'route_name', label: 'Route', labelAr: 'المسار', sortable: true, filterable: 'routes' },
            { key: 'branch_name', label: 'Branch', labelAr: 'الفرع', sortable: true, filterable: 'branches' },
            { key: 'total_records', label: 'Records', labelAr: 'السجلات', align: 'right', format: 'number', sortable: true },
            { key: 'gps_coverage', label: 'GPS', labelAr: 'GPS', align: 'right', format: 'percent', sortable: true },
            { key: 'phone_coverage', label: 'Phone', labelAr: 'هاتف', align: 'right', format: 'percent', sortable: true },
            { key: 'classification_coverage', label: 'Class', labelAr: 'تصنيف', align: 'right', format: 'percent', sortable: true },
            { key: 'store_type_coverage', label: 'Store Type', labelAr: 'نوع المتجر', align: 'right', format: 'percent', sortable: true },
            { key: 'schedule_coverage', label: 'Schedule', labelAr: 'جدول', align: 'right', format: 'percent', sortable: true },
            { key: 'vat_coverage', label: 'VAT', labelAr: 'ضريبة', align: 'right', format: 'percent', sortable: true },
            { key: 'status', label: 'Grade', labelAr: 'التقييم', align: 'center', format: 'status' },
        ],
        searchKeys: ['route_name', 'branch_name'],
        drillTarget: {
            reportId: 'visitFrequency',
            inherits: [
                { fromKey: 'route_name', toFilter: 'routes' },
                { fromKey: 'branch_name', toFilter: 'branches' },
            ],
            crumbKey: 'route_name',
        },
    },
    {
        id: 'visitFrequency',
        label: 'Visit Frequency',
        labelAr: 'تكرار الزيارات',
        group: 'coverage',
        Icon: Activity,
        description: 'Per-customer visit count, weeks covered, days per week, routes assigned',
        descriptionAr: 'عدد زيارات كل عميل، الأسابيع، الأيام في الأسبوع، المسارات المسندة',
        compute: withStatus(computeVisitFrequency, r => visitFreqBadge(r.total_visits)),
        columns: [
            { key: 'client_code', label: 'Code', labelAr: 'الكود', sortable: true },
            { key: 'client_name_en', label: 'Customer', labelAr: 'العميل', sortable: true },
            { key: 'classification', label: 'Class', labelAr: 'الفئة', format: 'class', sortable: true, filterable: 'classifications' },
            { key: 'store_type', label: 'Store Type', labelAr: 'نوع المتجر', sortable: true },
            { key: 'district', label: 'District', labelAr: 'الحي', sortable: true },
            { key: 'total_visits', label: 'Visits', labelAr: 'زيارات', align: 'right', format: 'visits', sortable: true },
            { key: 'weeks_covered', label: 'Weeks', labelAr: 'أسابيع', align: 'right', format: 'number', sortable: true },
            { key: 'days_per_week', label: 'Days/Wk', labelAr: 'أيام/أسبوع', align: 'right', format: 'number', sortable: true },
            { key: 'visit_days', label: 'Days', labelAr: 'الأيام' },
            { key: 'routes_assigned', label: 'Routes', labelAr: 'المسارات', align: 'right', format: 'number', sortable: true },
            { key: 'status', label: 'Cadence', labelAr: 'التواتر', align: 'center', format: 'status' },
        ],
        searchKeys: ['client_code', 'client_name_en', 'district'],
    },
    {
        id: 'weeklyCoverage',
        label: 'Weekly Coverage',
        labelAr: 'التغطية الأسبوعية',
        group: 'coverage',
        Icon: Calendar,
        description: 'Per-customer week presence (W1–W4) + coverage %',
        descriptionAr: 'حضور كل عميل في الأسابيع W1–W4 + نسبة التغطية',
        compute: withStatus(computeWeeklyCoverage, r => coverageBadge(r.coverage_percent)),
        columns: [
            { key: 'client_code', label: 'Code', labelAr: 'الكود', sortable: true },
            { key: 'client_name', label: 'Customer', labelAr: 'العميل', sortable: true },
            { key: 'classification', label: 'Class', labelAr: 'الفئة', format: 'class', sortable: true, filterable: 'classifications' },
            { key: 'store_type', label: 'Store Type', labelAr: 'نوع المتجر', sortable: true },
            { key: 'route_name', label: 'Route', labelAr: 'المسار', sortable: true, filterable: 'routes' },
            { key: 'week_1_covered', label: 'W1', labelAr: 'أ1', align: 'center', format: 'check', sortable: true },
            { key: 'week_2_covered', label: 'W2', labelAr: 'أ2', align: 'center', format: 'check', sortable: true },
            { key: 'week_3_covered', label: 'W3', labelAr: 'أ3', align: 'center', format: 'check', sortable: true },
            { key: 'week_4_covered', label: 'W4', labelAr: 'أ4', align: 'center', format: 'check', sortable: true },
            { key: 'weeks_covered', label: 'Total', labelAr: 'إجمالي', align: 'right', format: 'number', sortable: true },
            { key: 'coverage_percent', label: 'Coverage', labelAr: 'تغطية', align: 'right', format: 'percent', sortable: true },
            { key: 'status', label: 'Grade', labelAr: 'التقييم', align: 'center', format: 'status' },
        ],
        searchKeys: ['client_code', 'client_name', 'route_name'],
    },
    {
        id: 'dailyCoverage',
        label: 'Daily Coverage',
        labelAr: 'التغطية اليومية',
        group: 'coverage',
        Icon: Calendar,
        description: 'Per-customer day-of-week presence (Sat–Fri) + coverage %',
        descriptionAr: 'حضور كل عميل في أيام الأسبوع (السبت–الجمعة) + نسبة التغطية',
        compute: computeDailyCoverage, // already attaches `status`
        columns: [
            { key: 'client_code', label: 'Code', labelAr: 'الكود', sortable: true },
            { key: 'client_name', label: 'Customer', labelAr: 'العميل', sortable: true },
            { key: 'classification', label: 'Class', labelAr: 'الفئة', format: 'class', sortable: true, filterable: 'classifications' },
            { key: 'route_name', label: 'Route', labelAr: 'المسار', sortable: true, filterable: 'routes' },
            { key: 'branch_name', label: 'Branch', labelAr: 'الفرع', sortable: true, filterable: 'branches' },
            { key: 'sat', label: 'Sat', labelAr: 'سبت', align: 'center', format: 'check', sortable: true },
            { key: 'sun', label: 'Sun', labelAr: 'أحد', align: 'center', format: 'check', sortable: true },
            { key: 'mon', label: 'Mon', labelAr: 'إثنين', align: 'center', format: 'check', sortable: true },
            { key: 'tue', label: 'Tue', labelAr: 'ثلاثاء', align: 'center', format: 'check', sortable: true },
            { key: 'wed', label: 'Wed', labelAr: 'أربعاء', align: 'center', format: 'check', sortable: true },
            { key: 'thu', label: 'Thu', labelAr: 'خميس', align: 'center', format: 'check', sortable: true },
            { key: 'fri', label: 'Fri', labelAr: 'جمعة', align: 'center', format: 'check', sortable: true },
            { key: 'days_covered', label: 'Total', labelAr: 'إجمالي', align: 'right', format: 'number', sortable: true },
            { key: 'coverage_percent', label: 'Coverage', labelAr: 'تغطية', align: 'right', format: 'percent', sortable: true },
            { key: 'status', label: 'Grade', labelAr: 'التقييم', align: 'center', format: 'status' },
        ],
        searchKeys: ['client_code', 'client_name', 'route_name', 'branch_name'],
    },
];

const GROUPS: Array<{ id: string; label: string; labelAr: string }> = [
    { id: 'overview', label: 'Overview', labelAr: 'نظرة عامة' },
    { id: 'performance', label: 'Performance', labelAr: 'الأداء' },
    { id: 'quality', label: 'Data Quality', labelAr: 'جودة البيانات' },
    { id: 'coverage', label: 'Coverage', labelAr: 'التغطية' },
];

// ─────────────────────────────────────────────
// Multi-select dropdown
// ─────────────────────────────────────────────
const MultiSelect: React.FC<{
    label: string;
    options: string[];
    selected: Set<string>;
    onChange: (next: Set<string>) => void;
    icon?: React.ComponentType<{ className?: string }>;
}> = ({ label, options, selected, onChange, icon: Icon }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener('mousedown', onClick);
        return () => window.removeEventListener('mousedown', onClick);
    }, [open]);

    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;
        const q = search.toLowerCase();
        return options.filter(o => o.toLowerCase().includes(q));
    }, [options, search]);

    const toggle = (v: string) => {
        const next = new Set(selected);
        next.has(v) ? next.delete(v) : next.add(v);
        onChange(next);
    };
    const clearAll = () => onChange(new Set());
    const selectAll = () => onChange(new Set(filteredOptions));

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-[11px] font-bold text-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] ${selected.size > 0 ? 'ring-1 ring-indigo-400/40' : ''}`}
            >
                {Icon && <Icon className="w-3.5 h-3.5 text-indigo-400" />}
                <span>{label}</span>
                {selected.size > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[9px] font-black">{selected.size}</span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-[200] mt-2 right-0 min-w-[260px] max-w-[320px] rounded-xl bg-panel/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6),0_8px_22px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden">
                    <div className="p-2">
                        <div className="relative">
                            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter options…"
                                className="w-full pl-7 pr-2 py-1.5 rounded-md bg-white/5 text-[11px] text-main placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                            />
                        </div>
                    </div>
                    <div className="px-3 py-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        <button onClick={selectAll} className="hover:text-indigo-400">Select all</button>
                        <button onClick={clearAll} className="hover:text-rose-400">Clear</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar pb-2">
                        {filteredOptions.length === 0 && (
                            <div className="px-3 py-4 text-center text-[10px] text-slate-500">No matches</div>
                        )}
                        {filteredOptions.map(opt => {
                            const isSel = selected.has(opt);
                            return (
                                <button
                                    key={opt}
                                    onClick={() => toggle(opt)}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-white/5 ${isSel ? 'text-indigo-300' : 'text-slate-300'}`}
                                >
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${isSel ? 'bg-indigo-500 border-indigo-400' : 'border-white/20'}`}>
                                        {isSel && <CheckCircle2 className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="truncate">{opt}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Active filter chips
// ─────────────────────────────────────────────
const FilterChips: React.FC<{
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}> = ({ filters, setFilters }) => {
    const removeFromSet = (key: keyof FilterState, value: string) => {
        setFilters(prev => {
            const next = { ...prev };
            const set = new Set(prev[key] as Set<string>);
            set.delete(value);
            (next as any)[key] = set;
            return next;
        });
    };
    const all: Array<{ key: keyof FilterState; value: string; color: string }> = [];
    filters.branches.forEach(v => all.push({ key: 'branches', value: v, color: 'cyan' }));
    filters.routes.forEach(v => all.push({ key: 'routes', value: v, color: 'violet' }));
    filters.days.forEach(v => all.push({ key: 'days', value: v, color: 'emerald' }));
    filters.weeks.forEach(v => all.push({ key: 'weeks', value: v, color: 'amber' }));
    filters.classifications.forEach(v => all.push({ key: 'classifications', value: v, color: 'rose' }));
    filters.reps.forEach(v => all.push({ key: 'reps', value: v, color: 'indigo' }));

    if (all.length === 0 && !filters.search) return null;

    const colorClasses: Record<string, string> = {
        cyan: 'bg-cyan-500/15 text-cyan-300',
        violet: 'bg-violet-500/15 text-violet-300',
        emerald: 'bg-emerald-500/15 text-emerald-300',
        amber: 'bg-amber-500/15 text-amber-300',
        rose: 'bg-rose-500/15 text-rose-300',
        indigo: 'bg-indigo-500/15 text-indigo-300',
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {all.map((c, i) => (
                <span key={`${c.key}-${c.value}-${i}`} className={`flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-bold ${colorClasses[c.color]}`}>
                    <span className="truncate max-w-[140px]">{c.value}</span>
                    <button onClick={() => removeFromSet(c.key, c.value)} className="rounded-full hover:bg-white/20 p-0.5">
                        <X className="w-2.5 h-2.5" />
                    </button>
                </span>
            ))}
            {filters.search && (
                <span className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300">
                    "{filters.search}"
                    <button onClick={() => setFilters(p => ({ ...p, search: '' }))} className="rounded-full hover:bg-white/20 p-0.5">
                        <X className="w-2.5 h-2.5" />
                    </button>
                </span>
            )}
            {(all.length > 0 || filters.search) && (
                <button
                    onClick={() => setFilters(emptyFilters())}
                    className="text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 px-2 py-0.5"
                >Clear all</button>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// Generic data table
// ─────────────────────────────────────────────
const formatCell = (val: any, fmt?: ColumnFormat) => {
    if (val == null || val === '') return <span className="text-slate-600">—</span>;
    if (fmt === 'number') return Number(val).toLocaleString();
    if (fmt === 'percent') {
        const n = Number(val);
        const tone = n >= 80 ? 'text-emerald-300' : n >= 50 ? 'text-amber-300' : 'text-rose-300';
        return <span className={`font-mono font-bold ${tone}`}>{n}%</span>;
    }
    if (fmt === 'class') {
        const s = String(val).toUpperCase();
        const tone: Record<string, string> = { A: 'bg-emerald-500/15 text-emerald-300', B: 'bg-amber-500/15 text-amber-300', C: 'bg-rose-500/15 text-rose-300' };
        return <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${tone[s] || 'bg-slate-500/15 text-slate-300'}`}>{s || '—'}</span>;
    }
    if (fmt === 'check') return val ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" /> : <span className="text-slate-700">·</span>;
    if (fmt === 'status') {
        const o = val as { tone?: string; label?: string };
        if (!o || !o.label) return <span className="text-slate-600">—</span>;
        const tones: Record<string, string> = {
            emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
            amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
            rose: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
            cyan: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
            violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
            slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
        };
        const cls = tones[o.tone || 'slate'] || tones.slate;
        return <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ring-1 ${cls}`}>{o.label}</span>;
    }
    if (fmt === 'visits') {
        const n = Number(val) || 0;
        const tone = n >= 12 ? 'text-emerald-300' : n >= 4 ? 'text-amber-300' : 'text-rose-300';
        return <span className={`font-mono font-bold ${tone}`}>{n.toLocaleString()}</span>;
    }
    return String(val);
};

const csvEscape = (s: any) => {
    const v = s == null ? '' : String(s);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
};

const csvValue = (val: any): string => {
    if (val == null) return '';
    if (typeof val === 'object' && 'label' in val) return String(val.label ?? '');
    if (typeof val === 'boolean') return val ? 'YES' : 'NO';
    return String(val);
};

const downloadCsv = (filename: string, columns: ColumnDef[], rows: any[]) => {
    const header = columns.map(c => csvEscape(c.label)).join(',');
    const body = rows.map(r => columns.map(c => csvEscape(csvValue(r[c.key]))).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

const DataTable: React.FC<{
    report: Report;
    rows: any[];
    isAr: boolean;
    density: 'compact' | 'normal';
    onCellFilter: (key: keyof FilterState, value: string) => void;
    onDrill?: (row: any) => void;
}> = ({ report, rows, isAr, density, onCellFilter, onDrill }) => {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(0);
    const PAGE = 100;

    useEffect(() => { setPage(0); setSortKey(null); }, [report.id]);

    const sorted = useMemo(() => {
        if (!sortKey) return rows;
        // tone severity for status sorting (rose worst → emerald best)
        const toneRank: Record<string, number> = { rose: 0, amber: 1, cyan: 2, violet: 3, emerald: 4, slate: 5 };
        const out = [...rows];
        out.sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            // status objects: sort by tone severity
            if (av && typeof av === 'object' && 'tone' in av) {
                const ar = toneRank[av.tone] ?? 99;
                const br = toneRank[bv?.tone] ?? 99;
                return sortDir === 'asc' ? ar - br : br - ar;
            }
            if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
            if (typeof av === 'boolean' && typeof bv === 'boolean') return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
            return sortDir === 'asc' ? String(av ?? '').localeCompare(String(bv ?? '')) : String(bv ?? '').localeCompare(String(av ?? ''));
        });
        return out;
    }, [rows, sortKey, sortDir]);

    const visible = sorted.slice(page * PAGE, page * PAGE + PAGE);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE));
    const padY = density === 'compact' ? 'py-1.5' : 'py-2.5';

    const toggleSort = (k: string) => {
        if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(k); setSortDir('desc'); }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl bg-panel/40 overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55),0_8px_22px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex-1 overflow-auto custom-scrollbar">
                {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-xs text-slate-500 gap-2">
                        <Filter className="w-6 h-6 opacity-30" />
                        <span>{isAr ? 'لا توجد سجلات تطابق هذه الفلاتر' : 'No rows match these filters.'}</span>
                    </div>
                ) : (
                    <table className="w-full text-[11px]">
                        <thead className="sticky top-0 bg-panel/95 backdrop-blur z-10">
                            <tr className="text-left text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                                {report.columns.map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => col.sortable && toggleSort(col.key)}
                                        className={`px-3 ${padY} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.sortable ? 'cursor-pointer hover:text-indigo-400' : ''}`}
                                    >
                                        <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                            {isAr ? col.labelAr : col.label}
                                            {col.sortable && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                                        </div>
                                    </th>
                                ))}
                                {!!onDrill && report.drillTarget && (
                                    <th className={`px-2 ${padY} text-center w-10`}>
                                        <span className="opacity-50">↘</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((r, i) => (
                                <tr
                                    key={i}
                                    className={`border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors ${onDrill && report.drillTarget ? 'group' : ''}`}
                                    onDoubleClick={() => onDrill && report.drillTarget && onDrill(r)}
                                >
                                    {report.columns.map(col => {
                                        const val = r[col.key];
                                        const isFilterable = !!col.filterable && val != null && val !== '';
                                        return (
                                            <td
                                                key={col.key}
                                                onClick={() => isFilterable && onCellFilter(col.filterable!, String(val))}
                                                title={isFilterable ? `Filter by ${col.label} = ${val}` : undefined}
                                                className={`px-3 ${padY} ${col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : 'text-left'} ${isFilterable ? 'cursor-pointer hover:text-indigo-300' : ''}`}
                                            >
                                                {formatCell(val, col.format)}
                                            </td>
                                        );
                                    })}
                                    {!!onDrill && report.drillTarget && (
                                        <td className={`px-2 ${padY} text-center`}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDrill(r); }}
                                                title={isAr ? 'فتح التفاصيل' : 'Drill into details'}
                                                className="p-1 rounded-md opacity-30 group-hover:opacity-100 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {/* Pagination */}
            {sorted.length > PAGE && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-panel/50 text-[10px] text-slate-400">
                    <span>{isAr ? `صفحة ${page + 1} من ${totalPages}` : `Page ${page + 1} of ${totalPages}`} · {sorted.length.toLocaleString()} {isAr ? 'سجل' : 'rows'}</span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">«</button>
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">‹</button>
                        <span className="px-2 font-mono">{page + 1}/{totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">›</button>
                        <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-30">»</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────
// KPI strip
// ─────────────────────────────────────────────
const KpiTile: React.FC<{ label: string; value: string | number; tone: string; Icon: React.ComponentType<{ className?: string }> }> = ({ label, value, tone, Icon }) => {
    const toneMap: Record<string, { grad: string; text: string; glow: string }> = {
        cyan: { grad: 'from-cyan-500/25 to-cyan-500/5', text: 'text-cyan-400', glow: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_0_18px_rgba(6,182,212,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]' },
        violet: { grad: 'from-violet-500/25 to-violet-500/5', text: 'text-violet-400', glow: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_0_18px_rgba(139,92,246,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]' },
        emerald: { grad: 'from-emerald-500/25 to-emerald-500/5', text: 'text-emerald-400', glow: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_0_18px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]' },
        amber: { grad: 'from-amber-500/25 to-amber-500/5', text: 'text-amber-400', glow: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_0_18px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]' },
        rose: { grad: 'from-rose-500/25 to-rose-500/5', text: 'text-rose-400', glow: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_0_18px_rgba(244,63,94,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]' },
        indigo: { grad: 'from-indigo-500/25 to-indigo-500/5', text: 'text-indigo-400', glow: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_0_18px_rgba(99,102,241,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]' },
    };
    const t = toneMap[tone] || toneMap.cyan;
    return (
        <div className={`flex flex-col justify-center p-3 rounded-xl bg-gradient-to-br ${t.grad} ${t.glow} backdrop-blur-md hover:-translate-y-1 transition-transform`}>
            <div className="flex items-center justify-between mb-1.5">
                <div className={`p-1 rounded-lg bg-white/5`}>
                    <Icon className={`w-3.5 h-3.5 ${t.text} opacity-90`} />
                </div>
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 ml-2 text-right leading-none">{label}</span>
            </div>
            <span className="text-xl font-black text-main tracking-tight">{value}</span>
        </div>
    );
};

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
const DetailedReportsV2: React.FC<DetailedReportsV2Props> = ({ currentUser, language = 'en', currentFilters: initialFilters }) => {
    const isAr = language === 'ar';
    const isAdmin = !currentUser?.role || ['ADMIN', 'MANAGER', 'SYSADMIN'].includes(currentUser?.role?.toUpperCase?.() || '');
    const userBranchIds = currentUser?.branchIds || [];
    const branchFilter = !isAdmin && userBranchIds.length > 0 ? userBranchIds : undefined;
    const companyId = currentUser?.companyId || '';

    const [activeReportId, setActiveReportId] = useState<string>('branchOverview');
    const [filters, setFilters] = useState<FilterState>(() => {
        const f = emptyFilters();
        if (initialFilters?.region && initialFilters.region !== 'All') f.branches.add(initialFilters.region);
        if (initialFilters?.route && initialFilters.route !== 'All') f.routes.add(initialFilters.route);
        if (initialFilters?.day && initialFilters.day !== 'All') f.days.add(initialFilters.day);
        if (initialFilters?.week && initialFilters.week !== 'All') f.weeks.add(initialFilters.week);
        return f;
    });
    const [density, setDensity] = useState<'compact' | 'normal'>('normal');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // ─── Drill stack: each entry = one drill step taken from a report row.
    //     Used to render breadcrumb + to know which filters to remove on pop.
    type DrillCrumb = {
        fromReportId: string;
        toReportId: string;
        crumbLabel: string;
        added: Array<{ filterKey: keyof FilterState; value: string }>;
    };
    const [drillStack, setDrillStack] = useState<DrillCrumb[]>([]);

    // ─── Single fetch, cached 5 min ───
    const { data: rawData = [], isLoading, isError, error, refetch, isRefetching } = useQuery({
        queryKey: ['reportRawData', companyId, (branchFilter || []).join(',')],
        queryFn: () => fetchReportData(companyId, branchFilter),
        enabled: !!companyId,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });

    // ─── Distinct values for filter dropdowns (computed from raw) ───
    const distinct = useMemo(() => {
        const branches = new Set<string>();
        const routes = new Set<string>();
        const days = new Set<string>();
        const weeks = new Set<string>();
        const classifications = new Set<string>();
        const reps = new Set<string>();
        rawData.forEach((r: any) => {
            if (r.branch) branches.add(r.branch);
            if (r.route) routes.add(r.route);
            if (r.day) days.add(r.day);
            if (r.week) weeks.add(r.week);
            if (r.classification) classifications.add(r.classification);
            if (r.rep && r.rep !== 'Unassigned') reps.add(r.rep);
        });
        return {
            branches: Array.from(branches).sort(),
            routes: Array.from(routes).sort(),
            days: Array.from(days).sort(),
            weeks: Array.from(weeks).sort(),
            classifications: Array.from(classifications).sort(),
            reps: Array.from(reps).sort(),
        };
    }, [rawData]);

    // ─── Filter raw data by filter state ───
    const filteredRaw = useMemo(() => {
        if (rawData.length === 0) return rawData;
        const { branches: fb, routes: fr, days: fd, weeks: fw, classifications: fc, reps: frep } = filters;
        return rawData.filter((r: any) => {
            if (fb.size && !fb.has(r.branch)) return false;
            if (fr.size && !fr.has(r.route)) return false;
            if (fd.size && !fd.has(r.day)) return false;
            if (fw.size && !fw.has(r.week)) return false;
            if (fc.size && !fc.has(r.classification)) return false;
            if (frep.size && !frep.has(r.rep)) return false;
            return true;
        });
    }, [rawData, filters.branches, filters.routes, filters.days, filters.weeks, filters.classifications, filters.reps]);

    // ─── Active report + computed rows ───
    const activeReport = REPORTS.find(r => r.id === activeReportId)!;
    const computedRows = useMemo(() => activeReport.compute(filteredRaw), [activeReport, filteredRaw]);

    // ─── Apply text search to computed rows ───
    const visibleRows = useMemo(() => {
        if (!filters.search.trim()) return computedRows;
        const q = filters.search.trim().toLowerCase();
        return computedRows.filter(r => activeReport.searchKeys.some(k => String(r[k] ?? '').toLowerCase().includes(q)));
    }, [computedRows, filters.search, activeReport]);

    // ─── Top KPIs (always derived from filteredRaw, not active report) ───
    const kpis = useMemo(() => {
        const customers = new Set<string>();
        const routes = new Set<string>();
        const branches = new Set<string>();
        const reps = new Set<string>();
        let visits = 0;
        filteredRaw.forEach((r: any) => {
            if (r.clientCode) customers.add(r.clientCode);
            if (r.route) routes.add(r.route);
            if (r.branch) branches.add(r.branch);
            if (r.rep && r.rep !== 'Unassigned') reps.add(r.rep);
            visits += 1;
        });
        return {
            customers: customers.size,
            routes: routes.size,
            branches: branches.size,
            reps: reps.size,
            visits,
        };
    }, [filteredRaw]);

    const onCellFilter = (key: keyof FilterState, value: string) => {
        setFilters(prev => {
            const next = { ...prev };
            const set = new Set(prev[key] as Set<string>);
            set.has(value) ? set.delete(value) : set.add(value);
            (next as any)[key] = set;
            return next;
        });
    };

    // ─── Drill into a row's child report, inheriting filters from the row ───
    const handleDrill = (row: any) => {
        const tgt = activeReport.drillTarget;
        if (!tgt) return;
        const added: Array<{ filterKey: keyof FilterState; value: string }> = [];
        setFilters(prev => {
            const next = { ...prev };
            tgt.inherits.forEach(({ fromKey, toFilter }) => {
                const v = row[fromKey];
                if (v == null || v === '') return;
                const set = new Set(prev[toFilter] as Set<string>);
                if (!set.has(String(v))) {
                    set.add(String(v));
                    added.push({ filterKey: toFilter, value: String(v) });
                }
                (next as any)[toFilter] = set;
            });
            return next;
        });
        setDrillStack(prev => [
            ...prev,
            {
                fromReportId: activeReport.id,
                toReportId: tgt.reportId,
                crumbLabel: String(row[tgt.crumbKey] ?? ''),
                added,
            },
        ]);
        setActiveReportId(tgt.reportId);
    };

    // ─── Pop drill stack to a given depth (0 = home, N = keep N crumbs) ───
    const popDrillTo = (depth: number) => {
        const removed = drillStack.slice(depth);
        if (removed.length === 0) return;
        setFilters(prev => {
            const next = { ...prev };
            removed.forEach(crumb => {
                crumb.added.forEach(({ filterKey, value }) => {
                    const set = new Set(next[filterKey] as Set<string>);
                    set.delete(value);
                    (next as any)[filterKey] = set;
                });
            });
            return next;
        });
        setDrillStack(drillStack.slice(0, depth));
        const targetReport = depth === 0
            ? (drillStack[0]?.fromReportId || 'branchOverview')
            : drillStack[depth - 1].toReportId;
        setActiveReportId(targetReport);
    };

    // Manual report switch from sidebar — clear drill stack to keep state coherent
    const setReport = (id: string) => {
        if (id === activeReportId) return;
        setActiveReportId(id);
        setDrillStack([]);
    };

    const handleExport = () => {
        const fname = `${activeReport.id}_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadCsv(fname, activeReport.columns, visibleRows);
    };

    return (
        <div data-reach-screen className="flex h-screen bg-main text-main font-sans overflow-hidden relative" dir={isAr ? 'rtl' : 'ltr'}>
            {/* Background grid */}
            <style>{`
                .reports-grid-bg {
                  background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0);
                  background-size: 24px 24px;
                }
            `}</style>
            <div className="absolute inset-0 pointer-events-none reports-grid-bg" />

            {/* ─── SIDEBAR: Report library ─── */}
            <aside className={`relative shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-14' : 'w-60'} z-10`}>
                <div className="m-3 h-[calc(100%-1.5rem)] rounded-2xl bg-panel/50 backdrop-blur-md p-3 overflow-hidden flex flex-col shadow-[0_24px_60px_rgba(0,0,0,0.55),0_8px_22px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex items-center justify-between mb-3 px-1">
                        {!sidebarCollapsed && (
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-300">{isAr ? 'التقارير' : 'Reports'}</span>
                            </div>
                        )}
                        <button onClick={() => setSidebarCollapsed(c => !c)} className="p-1 rounded hover:bg-white/10 text-slate-400" title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
                            {sidebarCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-3">
                        {GROUPS.map(g => {
                            const inGroup = REPORTS.filter(r => r.group === g.id);
                            if (!inGroup.length) return null;
                            return (
                                <div key={g.id}>
                                    {!sidebarCollapsed && (
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-2 mb-1">{isAr ? g.labelAr : g.label}</div>
                                    )}
                                    <div className="space-y-0.5">
                                        {inGroup.map(r => {
                                            const isActive = r.id === activeReportId;
                                            const Icon = r.Icon;
                                            return (
                                                <button
                                                    key={r.id}
                                                    onClick={() => setReport(r.id)}
                                                    title={sidebarCollapsed ? (isAr ? r.labelAr : r.label) : undefined}
                                                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'} px-2 py-2 rounded-lg text-[11px] text-left transition-all ${isActive ? 'bg-indigo-500/20 text-indigo-200 shadow-[0_4px_12px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                                                >
                                                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-500'}`} />
                                                    {!sidebarCollapsed && <span className="font-bold truncate">{isAr ? r.labelAr : r.label}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </aside>

            {/* ─── MAIN ─── */}
            <div className="flex-1 flex flex-col min-w-0 p-3 gap-3 overflow-hidden z-10">
                {/* Filter bar */}
                <div className="shrink-0 rounded-2xl bg-panel/50 backdrop-blur-md p-3 shadow-[0_16px_40px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                value={filters.search}
                                onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
                                placeholder={isAr ? 'بحث في التقرير الحالي…' : 'Search this report…'}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 text-[11px] text-main placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
                            />
                        </div>
                        <MultiSelect label={isAr ? 'الفروع' : 'Branches'} icon={Building2} options={distinct.branches} selected={filters.branches} onChange={s => setFilters(p => ({ ...p, branches: s }))} />
                        <MultiSelect label={isAr ? 'المسارات' : 'Routes'} icon={RouteIcon} options={distinct.routes} selected={filters.routes} onChange={s => setFilters(p => ({ ...p, routes: s }))} />
                        <MultiSelect label={isAr ? 'الأيام' : 'Days'} icon={Calendar} options={distinct.days} selected={filters.days} onChange={s => setFilters(p => ({ ...p, days: s }))} />
                        <MultiSelect label={isAr ? 'الأسابيع' : 'Weeks'} icon={Calendar} options={distinct.weeks} selected={filters.weeks} onChange={s => setFilters(p => ({ ...p, weeks: s }))} />
                        <MultiSelect label={isAr ? 'الفئات' : 'Class'} icon={Target} options={distinct.classifications} selected={filters.classifications} onChange={s => setFilters(p => ({ ...p, classifications: s }))} />
                        <MultiSelect label={isAr ? 'المندوبون' : 'Reps'} icon={Users} options={distinct.reps} selected={filters.reps} onChange={s => setFilters(p => ({ ...p, reps: s }))} />
                        <div className="flex-1" />
                        <button
                            onClick={() => refetch()}
                            disabled={isLoading || isRefetching}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-[11px] font-bold text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                            title="Refetch raw data"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${(isLoading || isRefetching) ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
                            <span>{isLoading || isRefetching ? (isAr ? 'تحميل…' : 'Refreshing…') : (isAr ? 'تحديث' : 'Refresh')}</span>
                        </button>
                        <button
                            onClick={() => setDensity(d => d === 'compact' ? 'normal' : 'compact')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-[11px] font-bold text-slate-300"
                            title="Toggle density"
                        >
                            {density === 'compact' ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                            <span>{density === 'compact' ? (isAr ? 'عادي' : 'Normal') : (isAr ? 'مضغوط' : 'Compact')}</span>
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={visibleRows.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 transition text-[11px] font-bold text-emerald-300 disabled:opacity-40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                            title="Download as CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
                        </button>
                    </div>
                    {/* Active filter chips */}
                    <div className="mt-2.5"><FilterChips filters={filters} setFilters={setFilters} /></div>
                </div>

                {/* KPI strip */}
                <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    <KpiTile label={isAr ? 'العملاء' : 'Customers'} value={kpis.customers.toLocaleString()} tone="cyan" Icon={Users} />
                    <KpiTile label={isAr ? 'المسارات' : 'Routes'} value={kpis.routes.toLocaleString()} tone="violet" Icon={RouteIcon} />
                    <KpiTile label={isAr ? 'الفروع' : 'Branches'} value={kpis.branches.toLocaleString()} tone="emerald" Icon={Building2} />
                    <KpiTile label={isAr ? 'المندوبون' : 'Reps'} value={kpis.reps.toLocaleString()} tone="amber" Icon={Users} />
                    <KpiTile label={isAr ? 'الزيارات' : 'Visits'} value={kpis.visits.toLocaleString()} tone="rose" Icon={MapPin} />
                </div>

                {/* Report header */}
                <div className="shrink-0 flex items-end justify-between gap-2 px-1">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <activeReport.Icon className="w-4 h-4 text-indigo-400" />
                            <h2 className="text-sm font-black uppercase tracking-wider text-main">{isAr ? activeReport.labelAr : activeReport.label}</h2>
                            <span className="text-[10px] font-mono text-slate-500">{visibleRows.length.toLocaleString()} {isAr ? 'سجل' : 'rows'}</span>
                            {activeReport.drillTarget && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300/80 px-1.5 py-0.5 rounded bg-indigo-500/10">
                                    {isAr ? 'انقر مزدوجًا للتفاصيل' : 'Double-click row · or ›'}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 max-w-2xl">{isAr ? activeReport.descriptionAr : activeReport.description}</p>
                        {/* Drill breadcrumb */}
                        {drillStack.length > 0 && (
                            <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                                <button
                                    onClick={() => popDrillTo(0)}
                                    className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-white/5"
                                    title={isAr ? 'العودة للجذر' : 'Back to start'}
                                >
                                    {(() => {
                                        const startId = drillStack[0]?.fromReportId || 'branchOverview';
                                        const startReport = REPORTS.find(r => r.id === startId);
                                        return isAr ? startReport?.labelAr : startReport?.label;
                                    })()}
                                </button>
                                {drillStack.map((c, i) => (
                                    <React.Fragment key={i}>
                                        <ChevronRight className="w-3 h-3 text-slate-600" />
                                        <button
                                            onClick={() => popDrillTo(i + 1)}
                                            className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded transition-colors ${i === drillStack.length - 1 ? 'text-indigo-300 bg-indigo-500/15' : 'text-slate-400 hover:text-indigo-300 hover:bg-white/5'}`}
                                            title={c.crumbLabel}
                                        >
                                            <span className="truncate max-w-[160px] inline-block align-bottom">{c.crumbLabel || '—'}</span>
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 rounded-2xl bg-panel/30">
                        <Loader2 className="w-4 h-4 animate-spin mr-2 text-indigo-400" />
                        {isAr ? 'تحميل البيانات…' : 'Loading raw report data…'}
                    </div>
                ) : isError ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-xs text-rose-400 gap-2 rounded-2xl bg-panel/30">
                        <AlertTriangle className="w-6 h-6 opacity-60" />
                        <span>{(error as any)?.message || 'Failed to load data'}</span>
                        <button onClick={() => refetch()} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300">Retry</button>
                    </div>
                ) : (
                    <DataTable
                        report={activeReport}
                        rows={visibleRows}
                        isAr={isAr}
                        density={density}
                        onCellFilter={onCellFilter}
                        onDrill={handleDrill}
                    />
                )}
            </div>
        </div>
    );
};

export default DetailedReportsV2;
