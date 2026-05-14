
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Activity, Route as RouteIcon, MapPin, Milestone, Timer, BarChart3,
    Users, Repeat, Zap, AlertOctagon, Target, User as UserIcon,
    Sparkles, Rocket, TrendingUp, TrendingDown, Shield, Flag,
    Info, Loader2, RefreshCw, Gauge, Radar, AlertTriangle,
    Building2, Briefcase, Check, ArrowRight
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import { User as UserType, Company, Customer, ViewMode } from '../../../types';
import { getDashboardInsights, getBranches, supabase } from '../../../services/supabase';
import ReachCommandMap from './ReachCommandMap';

/* ================================================================== */
/*  Reusable UI Primitives                                             */
/* ================================================================== */

const InfoTooltip: React.FC<{ content: string }> = ({ content }) => (
    <div className="group relative inline-block align-middle">
        <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center hover:bg-indigo-500/20 transition-colors cursor-help border border-white/10">
            <Info className="w-2.5 h-2.5 text-white/40 group-hover:text-indigo-400 transition-colors" />
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-black/95 text-gray-200 text-[11px] leading-relaxed rounded-lg shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none invisible group-hover:visible z-[9999] text-center font-medium">
            {content}
        </div>
    </div>
);

/* ================================================================== */
/*  Efficiency Gauge — radial SVG                                      */
/* ================================================================== */

const EfficiencyGauge: React.FC<{ value: number; label?: string }> = ({ value, label }) => {
    const size = 220;
    const strokeWidth = 18;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const arcFraction = 0.75;
    const arcLength = circumference * arcFraction;
    const progress = Math.max(0, Math.min(100, value));
    const dash = (progress / 100) * arcLength;

    const stops =
        value >= 85 ? ['#10b981', '#34d399'] :
        value >= 65 ? ['#3b82f6', '#06b6d4'] :
        value >= 45 ? ['#f59e0b', '#fbbf24'] :
                      ['#ef4444', '#f43f5e'];

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size * 0.85 }}>
            <svg width={size} height={size} className="-rotate-[135deg] drop-shadow-2xl overflow-visible">
                <defs>
                    <linearGradient id="eff-gauge-grad-v2" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={stops[0]} />
                        <stop offset="100%" stopColor={stops[1]} />
                    </linearGradient>
                    <filter id="eff-gauge-glow-v2">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${arcLength} ${circumference}`} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`url(#eff-gauge-grad-v2)`} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} filter="url(#eff-gauge-glow-v2)" style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Efficiency</div>
                <div className="text-6xl font-black tracking-tighter text-white leading-none">
                    {Math.round(value)}
                    <span className="text-2xl text-white/40">%</span>
                </div>
                {label && <div className="mt-2 text-[10px] font-bold tracking-widest uppercase text-white/60">{label}</div>}
            </div>
        </div>
    );
};

/* ================================================================== */
/*  KPI Card — large hero style                                        */
/* ================================================================== */

interface KpiCardProps {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    unit?: string;
    accent: string;    // tailwind color key like 'indigo', 'rose'
    tooltip?: string;
    size?: 'sm' | 'md' | 'lg';
}

const KpiCard: React.FC<KpiCardProps> = ({ icon: Icon, label, value, unit, accent, tooltip, size = 'md' }) => {
    const accentMap: Record<string, { bg: string; border: string; iconBg: string; iconText: string; labelText: string }> = {
        indigo:   { bg: 'from-indigo-500/10 to-indigo-500/[0.02]',    border: 'border-indigo-500/20',    iconBg: 'bg-indigo-500/20',    iconText: 'text-indigo-300',    labelText: 'text-indigo-300/80' },
        violet:   { bg: 'from-violet-500/10 to-violet-500/[0.02]',    border: 'border-violet-500/20',    iconBg: 'bg-violet-500/20',    iconText: 'text-violet-300',    labelText: 'text-violet-300/80' },
        cyan:     { bg: 'from-cyan-500/10 to-cyan-500/[0.02]',        border: 'border-cyan-500/20',      iconBg: 'bg-cyan-500/20',      iconText: 'text-cyan-300',      labelText: 'text-cyan-300/80' },
        emerald:  { bg: 'from-emerald-500/10 to-emerald-500/[0.02]',  border: 'border-emerald-500/20',   iconBg: 'bg-emerald-500/20',   iconText: 'text-emerald-300',   labelText: 'text-emerald-300/80' },
        rose:     { bg: 'from-rose-500/10 to-rose-500/[0.02]',        border: 'border-rose-500/20',      iconBg: 'bg-rose-500/20',      iconText: 'text-rose-300',      labelText: 'text-rose-300/80' },
        amber:    { bg: 'from-amber-500/10 to-amber-500/[0.02]',      border: 'border-amber-500/20',     iconBg: 'bg-amber-500/20',     iconText: 'text-amber-300',     labelText: 'text-amber-300/80' },
        blue:     { bg: 'from-blue-500/10 to-blue-500/[0.02]',        border: 'border-blue-500/20',      iconBg: 'bg-blue-500/20',      iconText: 'text-blue-300',      labelText: 'text-blue-300/80' },
        fuchsia:  { bg: 'from-fuchsia-500/10 to-fuchsia-500/[0.02]',  border: 'border-fuchsia-500/20',   iconBg: 'bg-fuchsia-500/20',   iconText: 'text-fuchsia-300',   labelText: 'text-fuchsia-300/80' },
        sky:      { bg: 'from-sky-500/10 to-sky-500/[0.02]',          border: 'border-sky-500/20',       iconBg: 'bg-sky-500/20',       iconText: 'text-sky-300',       labelText: 'text-sky-300/80' },
    };
    const s = accentMap[accent] || accentMap.indigo;

    const sizeCls = size === 'lg' ? 'p-5' : size === 'sm' ? 'p-3' : 'p-4';
    const valueCls = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';

    return (
        <div className={`relative bg-gradient-to-br ${s.bg} ${s.border} border rounded-2xl ${sizeCls} backdrop-blur-sm hover:border-white/20 hover:scale-[1.02] transition-all group overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <div className={`p-1.5 rounded-lg ${s.iconBg} shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${s.iconText}`} />
                    </div>
                    <div className="flex items-center gap-1">
                        <span className={`text-[9px] font-black uppercase tracking-widest truncate ${s.labelText}`}>{label}</span>
                        {tooltip && <InfoTooltip content={tooltip} />}
                    </div>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className={`${valueCls} font-black text-white tracking-tight leading-none`}>{value}</span>
                    {unit && <span className="text-[10px] font-bold text-white/40">{unit}</span>}
                </div>
            </div>
        </div>
    );
};

/* ================================================================== */
/*  Health Bar Row — horizontal stacked bar for Stable/Under/Over      */
/* ================================================================== */

const HealthBarRow: React.FC<{
    label: string; value: number; total: number; color: 'emerald' | 'fuchsia' | 'amber'; icon: React.ElementType; tooltip?: string;
}> = ({ label, value, total, color, icon: Icon, tooltip }) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const colors = {
        emerald: { bg: 'bg-emerald-500', bgLight: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: 'text-emerald-400' },
        fuchsia: { bg: 'bg-fuchsia-500', bgLight: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', text: 'text-fuchsia-300', icon: 'text-fuchsia-400' },
        amber:   { bg: 'bg-amber-500',   bgLight: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-300',   icon: 'text-amber-400' },
    };
    const c = colors[color];
    return (
        <div className={`p-3 rounded-xl ${c.bgLight} border ${c.border}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg ${c.bgLight} border ${c.border} flex items-center justify-center`}>
                        <Icon className={`w-3 h-3 ${c.icon}`} />
                    </div>
                    <span className={`text-[10px] font-black ${c.text} uppercase tracking-widest`}>{label}</span>
                    {tooltip && <InfoTooltip content={tooltip} />}
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-white leading-none">{value}</span>
                    <span className={`text-[10px] font-bold ${c.text}`}>·{pct}%</span>
                </div>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div className={`h-full ${c.bg} transition-all duration-700 rounded-full`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
};

/* ================================================================== */
/*  Health Donut — central ring with the three route-health slices     */
/* ================================================================== */

const HealthDonut: React.FC<{ stable: number; under: number; over: number }> = ({ stable, under, over }) => {
    const total = stable + under + over;
    return (
        <div className="relative h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={[
                            { name: 'Under', value: under, color: '#d946ef' },
                            { name: 'Stable', value: stable, color: '#10b981' },
                            { name: 'Over', value: over, color: '#f59e0b' }
                        ]}
                        innerRadius={58}
                        outerRadius={78}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        startAngle={90}
                        endAngle={450}
                    >
                        <Cell fill="#d946ef" />
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">Monitored</div>
                <div className="text-4xl font-black text-white leading-none">{total}</div>
                <div className="text-[9px] font-bold text-white/50 mt-1">routes</div>
            </div>
        </div>
    );
};

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */

interface InsightsV2Props {
    currentUser: UserType;
    currentCompany: Company | null;
    allCustomers: Customer[];
    userList: UserType[];
    uploadHistory: any[];
    onNavigate: (view: ViewMode) => void;
    onLogout: () => void;
    hideHeader?: boolean;
    isDarkMode: boolean;
    language: 'en' | 'ar';
    isAiTheme: boolean;
    onToggleTheme: () => void;
    onToggleLang: () => void;
    onOpenCompanySettings?: () => void;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
    componentDidCatch(error: Error) { console.error('[InsightsV2] crash:', error); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center">
                    <h2 className="text-xl font-black text-rose-400 mb-2">حدث خطأ</h2>
                    <p className="text-white/50 mb-4 text-sm">{this.state.error?.message}</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-rose-500/15 text-rose-300 rounded-xl hover:bg-rose-500/25 border border-rose-500/30 font-bold text-sm">
                        إعادة تحميل
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const InsightsV2Content: React.FC<InsightsV2Props> = (props) => {
    const { hideHeader, currentCompany, currentUser, language, onNavigate } = props;
    const isAr = language === 'ar';
    const isAdmin = !currentUser?.role || ['ADMIN', 'MANAGER', 'SYSADMIN'].includes(currentUser?.role?.toUpperCase?.() || '');
    const userBranchIds = currentUser?.branchIds || [];

    const settingsStr = typeof currentCompany?.settings === 'string'
        ? currentCompany.settings
        : JSON.stringify(currentCompany?.settings || {});
    const settings = useMemo(() => {
        try { return JSON.parse(settingsStr); } catch { return {}; }
    }, [settingsStr]);
    const insightsSettings = settings?.modules?.insights || {};
    const optimizerSettings = settings?.modules?.optimizer || {};

    // Branches
    const { data: dbBranches = [] } = useQuery({
        queryKey: ['companyBranchesV2', currentCompany?.id],
        queryFn: async () => {
            if (!currentCompany?.id) return [];
            return await getBranches(currentCompany.id);
        },
        enabled: !!currentCompany?.id,
        staleTime: 1000 * 60 * 5,
    });

    // Fetch customer locations (lightweight: just lat/lng + district/branch for grouping)
    const { data: customerLocations = [] } = useQuery({
        queryKey: ['insightsV2CustomerLocations', currentCompany?.id, isAdmin ? 'all' : userBranchIds.join(',')],
        queryFn: async () => {
            if (!currentCompany?.id) return [] as Array<{ lat: number; lng: number; district?: string; branch_id?: string }>;
            // Use pagination because supabase limits to 1000 rows by default
            const all: any[] = [];
            const pageSize = 1000;
            for (let offset = 0; offset < 30000; offset += pageSize) {
                const { data, error } = await supabase
                    .from('normalized_customers')
                    .select('lat, lng, district, branch_id')
                    .eq('company_id', currentCompany.id)
                    .eq('is_active', true)
                    .not('lat', 'is', null)
                    .not('lng', 'is', null)
                    .range(offset, offset + pageSize - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                all.push(...data);
                if (data.length < pageSize) break;
            }
            return all;
        },
        enabled: !!currentCompany?.id,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 5,
    });

    // Branch lookup by id
    const branchById = useMemo(() => {
        const m = new Map<string, any>();
        dbBranches.forEach((b: any) => m.set(b.id, b));
        return m;
    }, [dbBranches]);

    // Haversine helper for territory radius
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371;
        const toRad = (d: number) => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Customer clusters — anchored at each BRANCH, sized by customer count, with territory radius and rank-based heat color.
    const customerClusters = useMemo(() => {
        if (!customerLocations || customerLocations.length === 0) return [];

        let valid = customerLocations.filter((c: any) =>
            c.lat != null && c.lng != null &&
            Number.isFinite(c.lat) && Number.isFinite(c.lng) &&
            !(c.lat === 0 && c.lng === 0)
        );

        if (!isAdmin && userBranchIds.length > 0) {
            const allowedIds = new Set(userBranchIds);
            valid = valid.filter((c: any) => c.branch_id && allowedIds.has(c.branch_id));
        }
        if (valid.length === 0) return [];

        // Group strictly by branch_id
        type Group = { count: number; distances: number[]; districts: Map<string, number> };
        const byBranch = new Map<string, Group>();
        valid.forEach((c: any) => {
            const bid = c.branch_id;
            if (!bid) return;
            if (!byBranch.has(bid)) byBranch.set(bid, { count: 0, distances: [], districts: new Map() });
            const g = byBranch.get(bid)!;
            g.count++;
            const branch = branchById.get(bid);
            if (branch && Number.isFinite(branch.lat) && Number.isFinite(branch.lng) && !(branch.lat === 0 && branch.lng === 0)) {
                g.distances.push(haversineKm(branch.lat, branch.lng, c.lat, c.lng));
            }
            const district = (c.district || '').trim();
            if (district) g.districts.set(district, (g.districts.get(district) || 0) + 1);
        });

        const total = valid.length;
        const built = Array.from(byBranch.entries())
            .map(([branchId, g]) => {
                const branch = branchById.get(branchId);
                if (!branch || !Number.isFinite(branch.lat) || !Number.isFinite(branch.lng) || (branch.lat === 0 && branch.lng === 0)) return null;
                // 90th-percentile distance as territory reach (ignores outliers)
                let radiusKm = 0;
                if (g.distances.length > 0) {
                    const sorted = [...g.distances].sort((a, b) => a - b);
                    radiusKm = sorted[Math.floor(sorted.length * 0.9)] || sorted[sorted.length - 1] || 0;
                }
                radiusKm = Math.max(15, Math.min(160, radiusKm));
                const topDistricts = Array.from(g.districts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([name, count]) => ({ name, count }));
                return {
                    id: branchId,
                    lat: branch.lat as number,
                    lng: branch.lng as number,
                    count: g.count,
                    label: branch.name_en || 'Branch',
                    code: branch.code || '',
                    radiusKm,
                    pct: Math.round((g.count / total) * 100 * 10) / 10,
                    topDistricts,
                };
            })
            .filter(Boolean) as Array<{ id: string; lat: number; lng: number; count: number; label: string; code: string; radiusKm: number; pct: number; topDistricts: Array<{ name: string; count: number }>; rank?: number; tier?: 'top' | 'high' | 'mid' | 'low' }>;

        // Rank by count and assign heat tier
        const rankedDesc = [...built].sort((a, b) => b.count - a.count);
        rankedDesc.forEach((c, i) => {
            c.rank = i + 1;
            c.tier = i === 0 ? 'top' : i <= 2 ? 'high' : i <= 5 ? 'mid' : 'low';
        });
        // Render smallest first so largest sits on top visually
        return rankedDesc.sort((a, b) => a.count - b.count);
    }, [customerLocations, branchById, isAdmin, userBranchIds]);

    const activeBranches = useMemo(() => {
        let branches = dbBranches.map((b: any) => ({
            id: b.id, name: b.name_en, nameAr: b.name_ar, code: b.code,
            coordinates: { lat: b.lat || 0, lng: b.lng || 0 },
            isActive: b.is_active
        }));
        if (!isAdmin && userBranchIds.length > 0) {
            branches = branches.filter((b: any) =>
                userBranchIds.includes(b.name) ||
                userBranchIds.includes(b.id) ||
                userBranchIds.includes(b.code)
            );
        }
        return branches;
    }, [dbBranches, isAdmin, userBranchIds]);

    // Dashboard insights
    const {
        data: summary,
        isLoading: isCalculating,
        refetch: refreshInsights,
        isRefetching,
        isError,
        error: queryError
    } = useQuery({
        queryKey: ['dashboardInsightsV2', currentCompany?.id, isAdmin ? 'all' : userBranchIds.join(',')],
        queryFn: async ({ signal }) => {
            if (!currentCompany?.id) throw new Error('No Company ID');
            const branchFilter = !isAdmin && userBranchIds.length > 0 ? userBranchIds : undefined;
            return await getDashboardInsights(currentCompany.id, branchFilter, signal);
        },
        enabled: !!currentCompany?.id,
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
    });

    const alerts = summary?.alerts || { missingGps: 0, proximityIssues: 0 };
    const routeHealth = summary?.routeHealth || { stable: 0, under: 0, over: 0 };
    const kpis = summary?.kpis || {
        totalCustomers: 0, activeRoutes: 0, totalVisits: 0, totalDistance: 0,
        totalTime: 0, avgVisitsPerRoute: 0, timePerUser: 0, frequency: 0, efficiency: 0
    };
    const totalRoutesMonitored = routeHealth.stable + routeHealth.under + routeHealth.over;
    const totalAlerts = (alerts.missingGps || 0) + (alerts.proximityIssues || 0);

    // Efficiency label
    const effMeta = useMemo(() => {
        const v = kpis.efficiency || 0;
        if (v >= 85) return { label: isAr ? 'مثالي' : 'Optimal', gradient: 'from-emerald-500 to-teal-500', icon: Rocket };
        if (v >= 65) return { label: isAr ? 'جيد' : 'Healthy', gradient: 'from-sky-500 to-blue-500', icon: TrendingUp };
        if (v >= 45) return { label: isAr ? 'يحتاج مراجعة' : 'Needs Review', gradient: 'from-amber-500 to-orange-500', icon: Activity };
        return { label: isAr ? 'حرج' : 'Critical', gradient: 'from-rose-500 to-red-500', icon: TrendingDown };
    }, [kpis.efficiency]);

    const HealthIcon = effMeta.icon;
    const formatNum = (n: number) => n?.toLocaleString() || '0';

    if (isError) {
        return (
            <div data-reach-screen className="p-8 text-center bg-[#0a0a14] min-h-screen flex items-center justify-center">
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 max-w-md">
                    <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-4" />
                    <h3 className="font-black text-rose-300 text-lg mb-2">{isAr ? 'خطأ في تحميل البيانات' : 'Error Loading Data'}</h3>
                    <p className="text-sm text-white/60 mb-4">{queryError?.message}</p>
                    <button onClick={() => refreshInsights()} className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 rounded-xl font-bold text-sm transition-all">
                        {isAr ? 'إعادة المحاولة' : 'Retry'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div data-reach-screen className="flex-1 flex flex-col w-full bg-[#0a0a14] font-sans pb-20 transition-colors overflow-x-hidden min-h-screen relative">

            {/* Ambient glow backdrop */}
            <div className="fixed inset-0 pointer-events-none opacity-30 z-0">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-cyan-500/5 rounded-full blur-3xl" />
            </div>

            {/* ========== COMMAND BAR ========== */}
            {!hideHeader && (
                <div data-reach-bar className="sticky top-0 z-[100] bg-[#0a0a14]/80 backdrop-blur-2xl border-b border-white/5 relative">
                    <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl blur-md opacity-60" />
                                    <div className="relative p-2.5 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl shadow-lg">
                                        <Activity className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                                            {isAr ? 'مركز العمليات' : 'Operations Command'}
                                        </h2>
                                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-widest">
                                            <Sparkles className="w-2.5 h-2.5" /> V2
                                        </span>
                                        {(isCalculating || isRefetching) && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
                                    </div>
                                    <p className="text-[11px] text-white/50 font-medium hidden sm:block">
                                        {isAr ? 'ذكاء العمليات · مدعوم بـ ReachAI' : 'Operations Intelligence · Powered by ReachAI'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {summary && (
                                    <div className={`hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${effMeta.gradient} shadow-lg`}>
                                        <HealthIcon className="w-4 h-4 text-white" />
                                        <span className="text-xs font-black text-white uppercase tracking-widest">{effMeta.label}</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => refreshInsights()}
                                    disabled={isCalculating || isRefetching}
                                    className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                    title="Refresh"
                                >
                                    <RefreshCw className={`w-4 h-4 text-white/70 ${isCalculating || isRefetching ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== BODY ========== */}
            <div className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-[1920px] mx-auto w-full relative z-10">

                {isCalculating ? (
                    /* ========== LOADING STATE ========== */
                    <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                        <div className="relative w-32 h-32 mb-8">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 blur-3xl animate-pulse" />
                            <Loader2 className="w-full h-full text-emerald-400 animate-spin relative" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Radar className="w-14 h-14 text-emerald-300" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-white mb-2 tracking-tight">
                            {isAr ? 'جارٍ تحليل البيانات' : 'Analysing operations'}
                        </h3>
                        <p className="text-sm text-white/50 font-bold uppercase tracking-widest">
                            {isAr ? 'مزامنة مقاييس السحابة' : 'Syncing cloud metrics'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ===================== HERO: EFFICIENCY + QUICK NAV ===================== */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                            {/* EFFICIENCY PANEL — 5/12 */}
                            <div className="xl:col-span-5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-6 backdrop-blur-sm relative overflow-hidden">
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className={`absolute -top-20 -left-20 w-64 h-64 bg-gradient-to-br ${effMeta.gradient} opacity-10 rounded-full blur-3xl`} />
                                </div>

                                <div className="relative">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="w-4 h-4 text-emerald-400" />
                                            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                                                {isAr ? 'لوحة التحليل' : 'Operations Brief'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                                                {currentCompany?.name || '—'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Efficiency Gauge centerpiece */}
                                    <div className="flex items-center justify-center py-4">
                                        <EfficiencyGauge value={kpis.efficiency || 0} label={effMeta.label} />
                                    </div>

                                    {/* Header stats row */}
                                    <div className="flex items-center justify-around mb-5 py-3 border-y border-white/5">
                                        <div className="text-center">
                                            <div className="text-2xl font-black text-white leading-none">{formatNum(kpis.totalCustomers || 0)}</div>
                                            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">{isAr ? 'عملاء' : 'Clients'}</div>
                                        </div>
                                        <div className="w-px h-10 bg-white/10" />
                                        <div className="text-center">
                                            <div className="text-2xl font-black text-white leading-none">{kpis.activeRoutes || 0}</div>
                                            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">{isAr ? 'مسارات' : 'Routes'}</div>
                                        </div>
                                        <div className="w-px h-10 bg-white/10" />
                                        <div className="text-center">
                                            <div className="text-2xl font-black text-white leading-none">{formatNum(kpis.totalVisits || 0)}</div>
                                            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">{isAr ? 'زيارات' : 'Visits'}</div>
                                        </div>
                                    </div>

                                    {/* Alerts banner */}
                                    <div className="mb-5">
                                        {totalAlerts === 0 ? (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">{isAr ? 'لا توجد تنبيهات' : 'All Clear'}</div>
                                                    <div className="text-[11px] font-bold text-white/70 leading-tight">{isAr ? 'لم يتم اكتشاف مشاكل في البيانات.' : 'No data integrity issues detected.'}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/[0.08] border border-rose-500/25">
                                                <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                                                    <Flag className="w-3.5 h-3.5 text-rose-300" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[9px] font-black text-rose-300 uppercase tracking-widest">
                                                        {totalAlerts} {isAr ? 'تنبيه' : totalAlerts === 1 ? 'Alert' : 'Alerts'} {isAr ? 'بحاجة للمراجعة' : 'Need Review'}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-white/70 leading-tight">
                                                        {alerts.missingGps > 0 && `${alerts.missingGps} ${isAr ? 'GPS مفقود' : 'missing GPS'}`}
                                                        {alerts.missingGps > 0 && alerts.proximityIssues > 0 && ' · '}
                                                        {alerts.proximityIssues > 0 && `${alerts.proximityIssues} ${isAr ? 'تقارب جغرافي' : 'proximity'}`}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick actions */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => onNavigate(ViewMode.ROUTE_SEQUENCE_V2)}
                                            className="group flex items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 hover:border-indigo-400/40 transition-all active:scale-95"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                                                    <RouteIcon className="w-3.5 h-3.5 text-indigo-300" />
                                                </div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{isAr ? 'المسارات' : 'Dispatch'}</span>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-indigo-300 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                        <button
                                            onClick={() => onNavigate(ViewMode.FULL_SUMMARY)}
                                            className="group flex items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 hover:border-amber-400/40 transition-all active:scale-95"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                                                    <BarChart3 className="w-3.5 h-3.5 text-amber-300" />
                                                </div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{isAr ? 'التقارير' : 'Reports'}</span>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-amber-300 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                        <button
                                            onClick={() => onNavigate(ViewMode.AI_SUGGESTIONS)}
                                            className="group flex items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/5 border border-rose-500/20 hover:border-rose-400/40 transition-all active:scale-95"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30">
                                                    <Zap className="w-3.5 h-3.5 text-rose-300" />
                                                </div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{isAr ? 'الأمثلة' : 'Optimise'}</span>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-rose-300 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                        <button
                                            onClick={() => onNavigate(ViewMode.MARKET_SCANNER)}
                                            className="group flex items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 hover:border-emerald-400/40 transition-all active:scale-95"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                                                    <Target className="w-3.5 h-3.5 text-emerald-300" />
                                                </div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{isAr ? 'السوق' : 'Scanner'}</span>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* MAP — 7/12 */}
                            <div className="xl:col-span-7 h-[500px] xl:h-auto xl:min-h-[640px] rounded-[2rem] shadow-2xl overflow-hidden relative z-0 ring-1 ring-white/10 border border-white/5">
                                <ReachCommandMap
                                    companyLocation={settings?.modules?.map?.defaultCenter || null}
                                    companyName={currentCompany?.name}
                                    branches={activeBranches}
                                    country={settings?.common?.general?.country || 'Saudi Arabia'}
                                    customerClusters={customerClusters}
                                />

                                {/* Floating top-right pills */}
                                <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 items-end">
                                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                            <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                                        </div>
                                        <div>
                                            <div className="text-[8px] font-black text-emerald-300 uppercase tracking-widest leading-none">{isAr ? 'فروع' : 'Branches'}</div>
                                            <div className="text-sm font-black text-white leading-tight">{activeBranches.length}</div>
                                        </div>
                                    </div>
                                    {customerClusters.length > 0 && (
                                        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                                <Radar className="w-3.5 h-3.5 text-indigo-300" />
                                            </div>
                                            <div>
                                                <div className="text-[8px] font-black text-indigo-300 uppercase tracking-widest leading-none">{isAr ? 'مناطق' : 'Clusters'}</div>
                                                <div className="text-sm font-black text-white leading-tight">{customerClusters.length}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Bottom legend strip */}
                                <div className="absolute bottom-3 left-3 z-[1000]">
                                    <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-white/80 uppercase tracking-widest">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                            {formatNum(kpis.totalCustomers || 0)} {isAr ? 'عميل' : 'Clients'}
                                        </div>
                                        <div className="w-px h-3 bg-white/10" />
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-white/80 uppercase tracking-widest">
                                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                            {kpis.activeRoutes || 0} {isAr ? 'مسار' : 'Routes'}
                                        </div>
                                        {totalAlerts > 0 && (
                                            <>
                                                <div className="w-px h-3 bg-white/10" />
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-300 uppercase tracking-widest">
                                                    <Flag className="w-2.5 h-2.5" />
                                                    {totalAlerts} {isAr ? 'تنبيه' : 'Alert' + (totalAlerts === 1 ? '' : 's')}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ===================== KPI DECK ===================== */}
                        <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-5 sm:p-6 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                        <Gauge className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white tracking-tight">{isAr ? 'مؤشرات الأداء' : 'Performance Metrics'}</h3>
                                        <p className="text-xs text-white/50 font-medium">{isAr ? 'لقطة فورية لعمليات الأسطول' : 'Real-time snapshot of your fleet operations'}</p>
                                    </div>
                                </div>
                                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                                    9 {isAr ? 'مقاييس' : 'Metrics'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3">
                                <KpiCard icon={Users} label={isAr ? 'إجمالي العملاء' : 'Total Clients'} value={formatNum(kpis.totalCustomers || 0)} accent="blue" tooltip='Distinct count of "Client Code" across all records.' size="lg" />
                                <KpiCard icon={RouteIcon} label={isAr ? 'المسارات النشطة' : 'Active Routes'} value={kpis.activeRoutes || 0} accent="violet" tooltip="Distinct count of unique route names." size="lg" />
                                <KpiCard icon={MapPin} label={isAr ? 'إجمالي الزيارات' : 'Total Visits'} value={formatNum(kpis.totalVisits || 0)} accent="cyan" tooltip="Total number of records/stops." size="lg" />
                                <KpiCard icon={Milestone} label={isAr ? 'المسافة الكلية' : 'Total Distance'} value={formatNum(kpis.totalDistance || 0)} unit="km" accent="emerald" tooltip="GPS-based Haversine distance." size="lg" />
                                <KpiCard icon={Timer} label={isAr ? 'الوقت الكلي' : 'Total Time'} value={Math.round((kpis.totalTime || 0) / 60)} unit="hrs" accent="amber" tooltip="Travel time (25km/h) + service time (10m/visit)." size="lg" />
                                <KpiCard icon={BarChart3} label={isAr ? 'متوسط الزيارات' : 'Avg Visits'} value={kpis.avgVisitsPerRoute || 0} accent="fuchsia" tooltip="Total visits / active routes." size="lg" />
                                <KpiCard icon={UserIcon} label={isAr ? 'وقت/مستخدم' : 'Time / User'} value={kpis.timePerUser || 0} unit="hrs" accent="sky" tooltip={`Avg. working hours per user (Limit: ${optimizerSettings?.maxWorkingHours || 9}h/day)`} size="lg" />
                                <KpiCard icon={Repeat} label={isAr ? 'التكرار' : 'Visit Frequency'} value={kpis.frequency || 0} accent="indigo" tooltip={`Avg. visits per client (Target: ${insightsSettings?.visitFrequencyDays || 7} days)`} size="lg" />
                                <KpiCard icon={Zap} label={isAr ? 'الكفاءة' : 'Efficiency'} value={kpis.efficiency || 0} unit="%" accent="rose" tooltip={`Route optimisation score (Target: ${insightsSettings?.efficiencyThreshold || 85}%)`} size="lg" />
                            </div>
                        </div>

                        {/* ===================== HEALTH + ALERTS ===================== */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            {/* ROUTE HEALTH — 7/12 */}
                            <div className="lg:col-span-7 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-5 sm:p-6 backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                            <Activity className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white tracking-tight">{isAr ? 'صحة المسارات' : 'Route Health'}</h3>
                                            <p className="text-xs text-white/50 font-medium">
                                                {isAr ? `مُراقب: ${totalRoutesMonitored} مسار` : `Monitoring ${totalRoutesMonitored} routes`}
                                            </p>
                                        </div>
                                    </div>
                                    <InfoTooltip content={`Stable: ${insightsSettings?.minClientsPerRoute || 80}-${insightsSettings?.maxClientsPerRoute || 120} customers per route.`} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                    <HealthDonut
                                        stable={routeHealth.stable || 0}
                                        under={routeHealth.under || 0}
                                        over={routeHealth.over || 0}
                                    />
                                    <div className="flex flex-col gap-2.5">
                                        <HealthBarRow
                                            label={isAr ? 'مستقر' : 'Stable'}
                                            value={routeHealth.stable || 0}
                                            total={totalRoutesMonitored}
                                            color="emerald"
                                            icon={Shield}
                                            tooltip={`Between ${insightsSettings?.minClientsPerRoute || 80} and ${insightsSettings?.maxClientsPerRoute || 120} customers`}
                                        />
                                        <HealthBarRow
                                            label={isAr ? 'ناقص' : 'Under-utilised'}
                                            value={routeHealth.under || 0}
                                            total={totalRoutesMonitored}
                                            color="fuchsia"
                                            icon={TrendingDown}
                                            tooltip={`Fewer than ${insightsSettings?.minClientsPerRoute || 80} customers`}
                                        />
                                        <HealthBarRow
                                            label={isAr ? 'محمل زيادة' : 'Overloaded'}
                                            value={routeHealth.over || 0}
                                            total={totalRoutesMonitored}
                                            color="amber"
                                            icon={TrendingUp}
                                            tooltip={`More than ${insightsSettings?.maxClientsPerRoute || 120} customers`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* DATA ALERTS — 5/12 */}
                            <div className="lg:col-span-5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-5 sm:p-6 backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                            <AlertOctagon className="w-5 h-5 text-rose-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-white tracking-tight">{isAr ? 'تنبيهات البيانات' : 'Data Alerts'}</h3>
                                            <p className="text-xs text-white/50 font-medium">
                                                {totalAlerts === 0
                                                    ? (isAr ? 'لا توجد مشاكل' : 'No issues detected')
                                                    : (isAr ? `${totalAlerts} تحتاج مراجعة` : `${totalAlerts} need review`)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {totalAlerts === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center">
                                        <div className="inline-flex w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mb-3">
                                            <Check className="w-8 h-8 text-emerald-400" />
                                        </div>
                                        <div className="text-sm font-black text-white mb-1">{isAr ? 'كل شيء نظيف' : 'All data clean'}</div>
                                        <div className="text-xs text-white/50 max-w-[240px]">
                                            {isAr
                                                ? 'لم يتم اكتشاف مشاكل جغرافية أو إحداثيات مفقودة.'
                                                : 'No missing GPS or proximity issues detected in the current dataset.'}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {alerts.missingGps > 0 && (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/25 hover:bg-rose-500/[0.1] transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                                                    <AlertOctagon className="w-5 h-5 text-rose-300" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">{isAr ? 'حرج' : 'Critical'}</span>
                                                    </div>
                                                    <div className="text-sm font-black text-white leading-tight">
                                                        {isAr ? 'إحداثيات مفقودة' : 'Missing GPS Coordinates'}
                                                    </div>
                                                    <div className="text-[11px] text-white/50 font-medium mt-0.5">
                                                        {isAr ? 'عملاء بدون إحداثيات صالحة' : 'Customers without valid lat/lng'}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-2xl font-black text-rose-300 leading-none">{formatNum(alerts.missingGps)}</div>
                                                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-1">
                                                        {isAr ? 'سجل' : 'Records'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {alerts.proximityIssues > 0 && (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/25 hover:bg-amber-500/[0.1] transition-colors">
                                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                                    <Target className="w-5 h-5 text-amber-300" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">{isAr ? 'تحذير' : 'Warning'}</span>
                                                    </div>
                                                    <div className="text-sm font-black text-white leading-tight">
                                                        {isAr ? 'مشاكل تقارب' : 'Proximity Issues'}
                                                    </div>
                                                    <div className="text-[11px] text-white/50 font-medium mt-0.5">
                                                        {isAr
                                                            ? `عملاء ضمن ${insightsSettings?.nearbyRadiusMeters || 100}م من الفرع`
                                                            : `Customers within ${insightsSettings?.nearbyRadiusMeters || 100}m of branch`}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-2xl font-black text-amber-300 leading-none">{formatNum(alerts.proximityIssues)}</div>
                                                    <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-1">
                                                        {isAr ? 'سجل' : 'Records'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ===================== FOOTER STAMP ===================== */}
                        <div className="flex items-center justify-center pt-4 pb-2">
                            <div className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-widest">
                                <Sparkles className="w-3 h-3 text-emerald-400/50" />
                                <span>{isAr ? 'عمليات V2 · مباشر · ReachAI' : 'Operations V2 · Live · ReachAI'}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const InsightsV2: React.FC<InsightsV2Props> = (props) => (
    <ErrorBoundary>
        <InsightsV2Content {...props} />
    </ErrorBoundary>
);

export default InsightsV2;
