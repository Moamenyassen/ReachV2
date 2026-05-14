// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Customer, NormalizedBranch, NormalizedRoute, UserRole } from '../../../types';
import { calculateDistance } from '../../../services/optimizer';
import {
    getBranches, fetchRouteCustomersNormalized
} from '../../../services/supabase';
import {
    ArrowLeft, Zap, Building2, Loader2, AlertTriangle, Search, ArrowRight, Clock,
    User, Map as MapIcon, Sparkles, TrendingDown, Target, ChevronRight, Filter,
    Calendar, Truck, RotateCcw, CheckCircle2, X, Eye, Info
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const DARK_TILE_ATTR = '&copy; OSM &copy; CARTO';

// ─── Tunables ─────────────────────────────────────────────────────────────
// Minimum km saved before we surface a suggestion (avoids noise from tiny shifts)
const MIN_SAVING_KM = 2;
// Suggestion is "high impact" if savings exceed this
const HIGH_IMPACT_KM = 6;
// Cap on number of nearest peers used to build a route's centroid (perf safety)
const MAX_MEMBERS_FOR_CENTROID = 200;
// Defaults if company optimizer settings aren't passed in
const DEFAULT_AVG_SPEED_KMH = 35;
const DEFAULT_TRAFFIC_FACTOR = 1.35;

// Helpers
const formatHours = (h: number): string => {
    if (h <= 0) return '0 min';
    if (h < 1) return `${Math.round(h * 60)} min`;
    const whole = Math.floor(h);
    const mins = Math.round((h - whole) * 60);
    if (mins === 0) return `${whole} hr`;
    if (mins === 60) return `${whole + 1} hr`;
    return `${whole}h ${mins}m`;
};

// ─── Types ────────────────────────────────────────────────────────────────
interface DayCluster {
    day: string;
    members: { lat: number; lng: number }[];
    centroid: { lat: number; lng: number };
}

interface RouteWithMembers {
    id: string;
    name: string;
    branchId: string;
    branchName: string;
    repCode?: string;
    centroid: { lat: number; lng: number };
    members: { lat: number; lng: number; day?: string }[];
    days: string[]; // distinct days this route serves
    byDay: Map<string, DayCluster>; // per-day clusters for picking the exact recommended day
}

interface RouteAlternative {
    type: 'ROUTE_SWITCH' | 'DAY_SHIFT'; // ROUTE_SWITCH = move to a different route, DAY_SHIFT = same route, different day
    routeName: string;
    rep?: string;
    days: string[];          // every day this route serves
    bestDay?: string;        // the specific day whose cluster is closest to the customer
    distKm: number;          // distance from customer to the BEST DAY's cluster centroid
    overallDistKm: number;   // distance to overall route centroid (fallback / context)
    centroid: [number, number];        // best-day centroid (used for the map line + label)
    overallCentroid: [number, number]; // route-wide centroid
    bestDayMembers: [number, number][]; // members of best-day cluster
    members: [number, number][];        // all members (for context)
}

interface Suggestion {
    id: string;                     // customer id
    type: 'ROUTE_SWITCH' | 'DAY_SHIFT';
    customer: Customer;
    branchName: string;
    branchId?: string;
    currentRouteName: string;
    currentRouteRep?: string;
    currentRouteDays: string[];
    currentDay?: string;             // customer's currently-assigned day on the current route
    currentDistKm: number;           // distance to current day's cluster (or overall if no day)
    currentRouteCentroid: [number, number];
    currentRoutePath: [number, number][];
    // top-N alternatives sorted by distance asc (excludes current route).
    // Used so excluding a route on the fly can fall through to the next best.
    alternatives: RouteAlternative[];
    // Computed from `alternatives` + excluded set at render time
    suggestedRouteName: string;
    suggestedRouteRep?: string;
    suggestedRouteDays: string[];
    suggestedDay?: string;           // the SINGLE recommended day for visiting this customer
    suggestedDistKm: number;
    suggestedRouteCentroid: [number, number];
    suggestedRoutePath: [number, number][];
    kmSaved: number;
    timeSavedHours: number;          // round-trip hours saved using avgSpeed * trafficFactor
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface BranchAnalysis {
    branchId: string;
    branchName: string;
    customersAnalyzed: number;
    routesAnalyzed: number;
    suggestions: Suggestion[];
    totalKmSavable: number;
}

// ─── Component ─────────────────────────────────────────────────────────────
interface AIOptimizerV2Props {
    onBack: () => void;
    isDarkMode?: boolean;
    language?: 'en' | 'ar';
    hideHeader?: boolean;
    companyId?: string;
    userBranchIds?: string[];
    userRole?: string;
}

const AIOptimizerV2: React.FC<AIOptimizerV2Props> = ({
    onBack, language, companyId, userBranchIds, userRole, hideHeader
}) => {
    const isAr = language === 'ar';
    const isAdmin = userRole === UserRole.ADMIN || userRole === 'ADMIN';

    // ── State ─────────────────────────────────────────────────────────
    const [branches, setBranches] = useState<NormalizedBranch[]>([]);
    const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
    const [loadingBranches, setLoadingBranches] = useState(false);

    const [analyses, setAnalyses] = useState<Record<string, BranchAnalysis>>({});
    const [analyzingBranch, setAnalyzingBranch] = useState<string | null>(null);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
    const [sortBy, setSortBy] = useState<'savings' | 'name' | 'priority'>('savings');
    const [openSuggestion, setOpenSuggestion] = useState<Suggestion | null>(null);
    const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    // Per-branch set of excluded route names (won't be suggested as targets)
    const [excludedRoutes, setExcludedRoutes] = useState<Record<string, Set<string>>>({});
    const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
    const [routesDropdownOpen, setRoutesDropdownOpen] = useState(false);

    // Close dropdowns on outside click
    useEffect(() => {
        if (!branchDropdownOpen && !routesDropdownOpen) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest('[data-dropdown]')) {
                setBranchDropdownOpen(false);
                setRoutesDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [branchDropdownOpen, routesDropdownOpen]);

    // ── Load branches ─────────────────────────────────────────────────
    useEffect(() => {
        if (!companyId) return;
        let cancelled = false;
        (async () => {
            setLoadingBranches(true);
            try {
                let list = await getBranches(companyId);
                if (!isAdmin && userBranchIds?.length) {
                    list = list.filter(b => userBranchIds.includes(b.id) || userBranchIds.includes(b.code) || userBranchIds.includes(b.name_en));
                }
                if (!cancelled) {
                    setBranches(list);
                    if (list.length > 0 && !activeBranchId) setActiveBranchId(list[0].id);
                }
            } catch (e: any) {
                console.error('[AIOptimizerV2] load branches failed', e);
            } finally {
                if (!cancelled) setLoadingBranches(false);
            }
        })();
        return () => { cancelled = true; };
    }, [companyId, isAdmin, userBranchIds]);

    // ── Analyze a branch ───────────────────────────────────────────────
    const analyzeBranch = useCallback(async (branch: NormalizedBranch) => {
        if (!companyId) return;
        setAnalyzingBranch(branch.id);
        setAnalyzeError(null);
        try {
            // Pull customers + their current route assignment for this branch.
            // The join in fetchRouteCustomersNormalized hydrates routeName and day per customer.
            const customers = await fetchRouteCustomersNormalized(companyId, {
                region: [branch.name_en]
            });

            // Derive routes purely from the customers' routeName/day fields
            // — avoids a separate routes query (whose schema-cache join is currently broken in
            // getNormalizedRoutes). Rep code can be added later once that helper is fixed.
            const routesByName = new Map<string, RouteWithMembers>();
            for (const c of customers) {
                if (!c.lat || !c.lng || !c.routeName) continue;
                let rwm = routesByName.get(c.routeName);
                if (!rwm) {
                    rwm = {
                        id: c.routeName, // use name as a stable key
                        name: c.routeName,
                        branchId: branch.id,
                        branchName: branch.name_en,
                        repCode: undefined,
                        centroid: { lat: 0, lng: 0 },
                        members: [],
                        days: [],
                        byDay: new Map(),
                    };
                    routesByName.set(c.routeName, rwm);
                }
                if (rwm.members.length < MAX_MEMBERS_FOR_CENTROID) {
                    rwm.members.push({ lat: c.lat, lng: c.lng, day: c.day });
                }
                if (c.day && !rwm.days.includes(c.day)) rwm.days.push(c.day);
                // Build per-day cluster — one row may cover multiple days (e.g., "Tue, Thu").
                // Split on commas so each day gets its own cluster.
                if (c.day) {
                    const days = String(c.day).split(/[,;|]/).map(d => d.trim()).filter(Boolean);
                    for (const d of days) {
                        let cluster = rwm.byDay.get(d);
                        if (!cluster) {
                            cluster = { day: d, members: [], centroid: { lat: 0, lng: 0 } };
                            rwm.byDay.set(d, cluster);
                        }
                        cluster.members.push({ lat: c.lat, lng: c.lng });
                    }
                }
            }

            // Compute centroids — overall + per-day
            for (const rwm of routesByName.values()) {
                if (rwm.members.length === 0) continue;
                let sLat = 0, sLng = 0;
                for (const m of rwm.members) { sLat += m.lat; sLng += m.lng; }
                rwm.centroid = { lat: sLat / rwm.members.length, lng: sLng / rwm.members.length };
                for (const cluster of rwm.byDay.values()) {
                    if (cluster.members.length === 0) continue;
                    let csLat = 0, csLng = 0;
                    for (const m of cluster.members) { csLat += m.lat; csLng += m.lng; }
                    cluster.centroid = { lat: csLat / cluster.members.length, lng: csLng / cluster.members.length };
                }
            }

            // Build suggestions: for each customer with a current route, find a closer alternative ROUTE in same branch
            const suggestions: Suggestion[] = [];
            const branchRoutes = Array.from(routesByName.values()).filter(r => r.members.length > 0);

            // Dedupe customers — the route_visits join returns one row per visit, so the
            // same customer can appear under several days/weeks for the same route. We only
            // want one suggestion per customer.
            const seenCustomerIds = new Set<string>();
            for (const c of customers) {
                if (!c.lat || !c.lng || !c.routeName) continue;
                const dedupeKey = c.id || c.clientCode || `${c.lat},${c.lng}`;
                if (seenCustomerIds.has(dedupeKey)) continue;
                seenCustomerIds.add(dedupeKey);
                const currentRoute = routesByName.get(c.routeName);
                if (!currentRoute || currentRoute.members.length === 0) continue;

                // Customer's currently-assigned day (may be a multi-day string — pick first).
                const currentDay = c.day ? String(c.day).split(/[,;|]/)[0].trim() : undefined;
                // Distance to the customer's actual day-cluster on the current route (more accurate
                // than the route-wide centroid). Falls back to the overall centroid if no day.
                let currentDist: number;
                if (currentDay && currentRoute.byDay.has(currentDay)) {
                    const cluster = currentRoute.byDay.get(currentDay)!;
                    currentDist = calculateDistance(c.lat, c.lng, cluster.centroid.lat, cluster.centroid.lng);
                } else {
                    currentDist = calculateDistance(c.lat, c.lng, currentRoute.centroid.lat, currentRoute.centroid.lng);
                }

                // Candidate alternatives for this customer:
                //   (a) ROUTE_SWITCH — every other route in the branch, scored on its best day
                //   (b) DAY_SHIFT     — same route, but a different day (excludes current day)
                // Whichever wins on distance becomes the recommendation.
                const alts: RouteAlternative[] = [];

                // (a) ROUTE_SWITCH candidates
                for (const r of branchRoutes) {
                    if (r.id === currentRoute.id || r.name === currentRoute.name) continue;
                    const overallD = calculateDistance(c.lat, c.lng, r.centroid.lat, r.centroid.lng);

                    let bestDay: string | undefined;
                    let bestDayDist = Infinity;
                    let bestDayMembers: [number, number][] = [];
                    let bestDayCentroid: [number, number] = [r.centroid.lat, r.centroid.lng];
                    for (const cluster of r.byDay.values()) {
                        if (cluster.members.length === 0) continue;
                        const d = calculateDistance(c.lat, c.lng, cluster.centroid.lat, cluster.centroid.lng);
                        if (d < bestDayDist) {
                            bestDayDist = d;
                            bestDay = cluster.day;
                            bestDayMembers = cluster.members.slice(0, 40).map(m => [m.lat, m.lng] as [number, number]);
                            bestDayCentroid = [cluster.centroid.lat, cluster.centroid.lng];
                        }
                    }
                    const distKm = isFinite(bestDayDist) ? bestDayDist : overallD;

                    alts.push({
                        type: 'ROUTE_SWITCH',
                        routeName: r.name,
                        rep: r.repCode,
                        days: r.days,
                        bestDay,
                        distKm,
                        overallDistKm: overallD,
                        centroid: bestDayCentroid,
                        overallCentroid: [r.centroid.lat, r.centroid.lng],
                        bestDayMembers,
                        members: r.members.slice(0, 60).map(m => [m.lat, m.lng] as [number, number]),
                    });
                }

                // (b) DAY_SHIFT candidates — same route, every day other than the current one
                for (const cluster of currentRoute.byDay.values()) {
                    if (cluster.members.length === 0) continue;
                    if (currentDay && cluster.day === currentDay) continue;
                    const d = calculateDistance(c.lat, c.lng, cluster.centroid.lat, cluster.centroid.lng);
                    alts.push({
                        type: 'DAY_SHIFT',
                        routeName: currentRoute.name,
                        rep: currentRoute.repCode,
                        days: [cluster.day],
                        bestDay: cluster.day,
                        distKm: d,
                        overallDistKm: calculateDistance(c.lat, c.lng, currentRoute.centroid.lat, currentRoute.centroid.lng),
                        centroid: [cluster.centroid.lat, cluster.centroid.lng],
                        overallCentroid: [currentRoute.centroid.lat, currentRoute.centroid.lng],
                        bestDayMembers: cluster.members.slice(0, 40).map(m => [m.lat, m.lng] as [number, number]),
                        members: currentRoute.members.slice(0, 60).map(m => [m.lat, m.lng] as [number, number]),
                    });
                }
                if (alts.length === 0) continue;
                alts.sort((a, b) => a.distKm - b.distKm);
                const top = alts.slice(0, 5);
                const best = top[0];
                const kmSaved = currentDist - best.distKm;
                if (kmSaved < MIN_SAVING_KM) continue;

                // Time saved estimate — round-trip detour avoided
                // hours = (kmSaved * trafficFactor / avgSpeed) * 2 (out and back)
                const timeSavedHours = (kmSaved * DEFAULT_TRAFFIC_FACTOR / DEFAULT_AVG_SPEED_KMH) * 2;

                const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
                    kmSaved >= HIGH_IMPACT_KM ? 'HIGH' :
                    kmSaved >= MIN_SAVING_KM * 1.7 ? 'MEDIUM' : 'LOW';

                suggestions.push({
                    id: c.id || `${c.clientCode || c.lat}-${c.lng}`,
                    type: best.type,
                    customer: c,
                    branchName: branch.name_en,
                    branchId: branch.id,
                    currentRouteName: currentRoute.name,
                    currentRouteRep: currentRoute.repCode,
                    currentRouteDays: currentRoute.days,
                    currentDay,
                    currentDistKm: currentDist,
                    currentRouteCentroid: currentDay && currentRoute.byDay.has(currentDay)
                        ? [currentRoute.byDay.get(currentDay)!.centroid.lat, currentRoute.byDay.get(currentDay)!.centroid.lng]
                        : [currentRoute.centroid.lat, currentRoute.centroid.lng],
                    currentRoutePath: (currentDay && currentRoute.byDay.get(currentDay)?.members.length
                        ? currentRoute.byDay.get(currentDay)!.members
                        : currentRoute.members).slice(0, 60).map(m => [m.lat, m.lng] as [number, number]),
                    alternatives: top,
                    // The "suggested" fields below are filled with the unfiltered top alternative;
                    // the visible-suggestions memo recomputes them based on the user's excluded-routes set.
                    suggestedRouteName: best.routeName,
                    suggestedRouteRep: best.rep,
                    suggestedRouteDays: best.days,
                    suggestedDay: best.bestDay,
                    suggestedDistKm: best.distKm,
                    suggestedRouteCentroid: best.centroid,
                    suggestedRoutePath: best.bestDayMembers.length > 0 ? best.bestDayMembers : best.members,
                    kmSaved,
                    timeSavedHours,
                    priority,
                });
            }

            suggestions.sort((a, b) => b.kmSaved - a.kmSaved);

            const totalKmSavable = suggestions.reduce((s, x) => s + x.kmSaved, 0);

            setAnalyses(prev => ({
                ...prev,
                [branch.id]: {
                    branchId: branch.id,
                    branchName: branch.name_en,
                    customersAnalyzed: customers.filter(c => c.lat && c.lng && c.routeName).length,
                    routesAnalyzed: branchRoutes.length,
                    suggestions,
                    totalKmSavable,
                },
            }));
        } catch (e: any) {
            console.error('[AIOptimizerV2] analyze failed', e);
            setAnalyzeError(e?.message || 'Analysis failed.');
        } finally {
            setAnalyzingBranch(null);
        }
    }, [companyId]);

    // Auto-run when active branch changes if not yet analyzed
    useEffect(() => {
        if (!activeBranchId) return;
        if (analyses[activeBranchId]) return;
        const branch = branches.find(b => b.id === activeBranchId);
        if (branch) analyzeBranch(branch);
    }, [activeBranchId, branches, analyses, analyzeBranch]);

    // ── Visible suggestions for the active branch ──────────────────────
    const activeAnalysis = activeBranchId ? analyses[activeBranchId] : null;
    const branchExcluded = activeBranchId ? (excludedRoutes[activeBranchId] || new Set<string>()) : new Set<string>();

    // All distinct routes in the active branch (for the exclusion picker)
    const branchRoutes = useMemo(() => {
        if (!activeAnalysis) return [] as { name: string; suggestionsAsTarget: number }[];
        const counts = new Map<string, number>();
        for (const s of activeAnalysis.suggestions) {
            counts.set(s.currentRouteName, (counts.get(s.currentRouteName) || 0));
            for (const a of s.alternatives) counts.set(a.routeName, (counts.get(a.routeName) || 0) + 1);
        }
        return Array.from(counts.entries())
            .map(([name, n]) => ({ name, suggestionsAsTarget: n }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [activeAnalysis]);

    const visibleSuggestions = useMemo(() => {
        if (!activeAnalysis) return [] as Suggestion[];
        const q = searchQuery.trim().toLowerCase();

        // For each suggestion, recompute the effective alternative based on the branch-excluded set.
        // If the original best is excluded, fall through to the next best non-excluded alternative.
        const remapped: Suggestion[] = [];
        for (const s of activeAnalysis.suggestions) {
            if (appliedIds.has(s.id) || dismissedIds.has(s.id)) continue;
            const effective = s.alternatives.find(a => !branchExcluded.has(a.routeName));
            if (!effective) continue; // every alternative excluded → drop
            const kmSaved = s.currentDistKm - effective.distKm;
            if (kmSaved < MIN_SAVING_KM) continue;
            const timeSavedHours = (kmSaved * DEFAULT_TRAFFIC_FACTOR / DEFAULT_AVG_SPEED_KMH) * 2;
            const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
                kmSaved >= HIGH_IMPACT_KM ? 'HIGH' :
                kmSaved >= MIN_SAVING_KM * 1.7 ? 'MEDIUM' : 'LOW';
            remapped.push({
                ...s,
                type: effective.type,
                suggestedRouteName: effective.routeName,
                suggestedRouteRep: effective.rep,
                suggestedRouteDays: effective.days,
                suggestedDay: effective.bestDay,
                suggestedDistKm: effective.distKm,
                suggestedRouteCentroid: effective.centroid,
                suggestedRoutePath: effective.bestDayMembers.length > 0 ? effective.bestDayMembers : effective.members,
                kmSaved,
                timeSavedHours,
                priority,
            });
        }

        let list = remapped;
        if (priorityFilter !== 'ALL') list = list.filter(s => s.priority === priorityFilter);
        if (q) list = list.filter(s =>
            (s.customer.name || '').toLowerCase().includes(q)
            || (s.customer.clientCode || '').toLowerCase().includes(q)
            || (s.currentRouteName || '').toLowerCase().includes(q)
            || (s.suggestedRouteName || '').toLowerCase().includes(q)
        );
        if (sortBy === 'savings') list.sort((a, b) => b.kmSaved - a.kmSaved);
        else if (sortBy === 'name') list.sort((a, b) => (a.customer.name || '').localeCompare(b.customer.name || ''));
        else if (sortBy === 'priority') {
            const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            list.sort((a, b) => order[a.priority] - order[b.priority]);
        }
        return list;
    }, [activeAnalysis, searchQuery, priorityFilter, sortBy, appliedIds, dismissedIds, branchExcluded]);

    const toggleExcludeRoute = (routeName: string) => {
        if (!activeBranchId) return;
        setExcludedRoutes(prev => {
            const next = { ...prev };
            const set = new Set(next[activeBranchId] || []);
            if (set.has(routeName)) set.delete(routeName); else set.add(routeName);
            next[activeBranchId] = set;
            return next;
        });
    };
    const clearExcluded = () => {
        if (!activeBranchId) return;
        setExcludedRoutes(prev => ({ ...prev, [activeBranchId]: new Set() }));
    };

    const handleApply = (s: Suggestion) => {
        // Marks the suggestion as locally applied. Persisting to DB requires creating
        // a new route_visit and removing the old — left as a follow-up.
        setAppliedIds(prev => { const n = new Set(prev); n.add(s.id); return n; });
        setOpenSuggestion(null);
    };
    const handleDismiss = (s: Suggestion) => {
        setDismissedIds(prev => { const n = new Set(prev); n.add(s.id); return n; });
        setOpenSuggestion(null);
    };

    return (
        <div data-reach-screen className="relative h-screen w-full bg-[#020617] text-white font-sans flex flex-col overflow-hidden">
            {/* Background flair */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            {!hideHeader && (
                <header data-reach-bar className="relative z-10 flex items-center gap-3 px-6 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                        title={isAr ? 'رجوع' : 'Back'}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="relative w-10 h-10 shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl blur opacity-50" />
                            <div className="relative w-10 h-10 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-xl flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-base font-black uppercase tracking-widest leading-none truncate">{isAr ? 'محسن المسارات' : 'AI Optimizer'}</h1>
                                <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-[8px] font-black text-purple-300 uppercase tracking-widest">V2</span>
                            </div>
                            <p className="text-[10px] text-amber-300 font-bold mt-1 uppercase truncate">{isAr ? 'مسار صحيح • مندوب صحيح • يوم صحيح' : 'Right route · Right rep · Right day'}</p>
                        </div>
                    </div>
                </header>
            )}

            {/* Branch + Excluded-Routes dropdowns — side-by-side */}
            <div data-reach-bar className="relative px-6 py-3 border-b border-white/5 bg-slate-900/40 backdrop-blur" style={{ zIndex: 200 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-7xl mx-auto">
                    {/* Branch dropdown */}
                    <div className="relative" data-dropdown="branch">
                        <label className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black text-white/50 uppercase tracking-widest">
                            <Building2 className="w-3.5 h-3.5 text-amber-400" /> {isAr ? 'الفرع' : 'Branch'}
                        </label>
                        <button
                            onClick={() => { setBranchDropdownOpen(o => !o); setRoutesDropdownOpen(false); }}
                            disabled={loadingBranches || branches.length === 0}
                            className="w-full bg-black/40 border border-white/10 hover:border-amber-500/40 rounded-xl px-3 py-2 text-sm font-bold text-left flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                            <span className="truncate flex items-center gap-2">
                                {loadingBranches
                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {isAr ? 'جاري التحميل...' : 'Loading…'}</>
                                    : (() => {
                                        const b = branches.find(x => x.id === activeBranchId);
                                        return b ? (
                                            <>
                                                <span className="truncate">{b.name_en}</span>
                                                {analyses[b.id] && (
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${analyses[b.id].suggestions.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
                                                        {analyses[b.id].suggestions.length}
                                                    </span>
                                                )}
                                            </>
                                        ) : (isAr ? 'اختر فرعاً' : 'Pick a branch');
                                    })()}
                            </span>
                            <ChevronRight className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${branchDropdownOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {branchDropdownOpen && (
                            <div style={{ background: '#0f172a' }} className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-slate-600 shadow-2xl max-h-72 overflow-y-auto">
                                {branches.length === 0 ? (
                                    <div className="px-3 py-4 text-[11px] text-white/50 text-center">{isAr ? 'لا توجد فروع متاحة' : 'No branches available.'}</div>
                                ) : (
                                    branches.map(b => {
                                        const active = b.id === activeBranchId;
                                        const a = analyses[b.id];
                                        return (
                                            <button
                                                key={b.id}
                                                onClick={() => { setActiveBranchId(b.id); setBranchDropdownOpen(false); }}
                                                className={`w-full px-3 py-2 text-left text-sm font-bold flex items-center justify-between gap-2 transition-colors ${
                                                    active ? 'bg-amber-500/15 text-amber-200' : 'text-white/80 hover:bg-white/[0.05]'
                                                }`}
                                            >
                                                <span className="flex items-center gap-2 min-w-0">
                                                    <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                    <span className="truncate">{b.name_en}</span>
                                                </span>
                                                {a && (
                                                    <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black ${a.suggestions.length > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/40'}`}>
                                                        {a.suggestions.length}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    {/* Excluded-routes dropdown */}
                    <div className="relative" data-dropdown="routes">
                        <label className="flex items-center gap-1.5 mb-1.5 text-[10px] font-black text-white/50 uppercase tracking-widest">
                            <Truck className="w-3.5 h-3.5 text-amber-400" /> {isAr ? 'المسارات المستثناة' : 'Excluded Routes'}
                            <span className="text-white/30">·</span>
                            <span className="text-white/40 normal-case font-medium">{isAr ? 'لن تظهر كخيارات للنقل' : "won't appear as targets"}</span>
                        </label>
                        <button
                            onClick={() => { setRoutesDropdownOpen(o => !o); setBranchDropdownOpen(false); }}
                            disabled={!activeAnalysis || branchRoutes.length === 0}
                            className="w-full bg-black/40 border border-white/10 hover:border-amber-500/40 rounded-xl px-3 py-2 text-sm font-bold text-left flex items-center justify-between transition-colors disabled:opacity-50"
                        >
                            <span className="truncate text-white/80">
                                {!activeAnalysis || branchRoutes.length === 0
                                    ? (isAr ? 'اختر فرعاً أولاً' : 'No branch selected')
                                    : branchExcluded.size === 0
                                        ? <span className="text-white/50">{isAr ? `كل المسارات متاحة · ${branchRoutes.length} قابلة للاستخدام` : `All routes available · ${branchRoutes.length} usable`}</span>
                                        : <span><span className="text-rose-300">{branchExcluded.size}</span> {isAr ? `مستثنى · ` : 'excluded · '}<span className="text-emerald-300">{branchRoutes.length - branchExcluded.size}</span> {isAr ? 'قابلة للاستخدام' : 'usable'}</span>
                                }
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {branchExcluded.size > 0 && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); clearExcluded(); }}
                                        className="px-1.5 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black text-white/60 uppercase tracking-widest cursor-pointer"
                                    >
                                        {isAr ? 'مسح' : 'Clear'}
                                    </span>
                                )}
                                <ChevronRight className={`w-4 h-4 text-white/40 transition-transform ${routesDropdownOpen ? 'rotate-90' : ''}`} />
                            </div>
                        </button>
                        {routesDropdownOpen && activeAnalysis && branchRoutes.length > 0 && (
                            <div style={{ background: '#0f172a' }} className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-slate-600 shadow-2xl max-h-72 overflow-y-auto">
                                <div className="px-3 py-2 text-[10px] text-white/40 leading-relaxed border-b border-white/5">
                                    {isAr ? 'انقر للتبديل. المسارات المستثناة لن تُقترح. سيختار النظام أفضل بديل للعميل.' : "Click to toggle. Excluded routes won't be suggested as targets. The optimizer will fall through to the next-best alternative for each customer."}
                                </div>
                                {branchRoutes.map(r => {
                                    const excluded = branchExcluded.has(r.name);
                                    return (
                                        <button
                                            key={r.name}
                                            onClick={() => toggleExcludeRoute(r.name)}
                                            className={`w-full px-3 py-2 text-left text-sm font-bold flex items-center gap-2 transition-colors ${
                                                excluded ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20' : 'text-white/80 hover:bg-white/[0.05]'
                                            }`}
                                        >
                                            <span className="shrink-0 w-4 h-4 rounded border flex items-center justify-center" style={{ borderColor: excluded ? '#fb7185' : '#10b98180', background: excluded ? 'transparent' : 'rgba(16,185,129,0.15)' }}>
                                                {excluded ? <X className="w-3 h-3 text-rose-300" /> : <CheckCircle2 className="w-3 h-3 text-emerald-300" />}
                                            </span>
                                            <span className={`flex-1 truncate ${excluded ? 'line-through opacity-70' : ''}`}>{r.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI strip */}
            {activeAnalysis && (
                <div className="relative z-10 px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-7xl mx-auto w-full">
                    <KPI icon={User}        label={isAr ? 'العملاء المحللون' : 'Customers Analyzed'}  value={activeAnalysis.customersAnalyzed} color="cyan" />
                    <KPI icon={Truck}       label={isAr ? 'مسارات الفرع' : 'Routes in Branch'}    value={activeAnalysis.routesAnalyzed}    color="indigo" />
                    <KPI icon={Sparkles}    label={isAr ? 'توصيات متاحة' : 'Suggestions Found'}   value={visibleSuggestions.length} color="amber" />
                    <KPI icon={TrendingDown} label={isAr ? 'إجمالي الوفر' : 'Total Savings'} value={(() => {
                        const km = visibleSuggestions.reduce((sum, s) => sum + s.kmSaved, 0);
                        const hr = visibleSuggestions.reduce((sum, s) => sum + s.timeSavedHours, 0);
                        return <span><span>{km.toFixed(0)}<span className="text-sm ml-0.5">km</span></span> <span className="text-emerald-400/60 mx-1">·</span> <span>{formatHours(hr)}</span></span>;
                    })()} color="emerald" />
                </div>
            )}

            {/* Filter bar */}
            {activeAnalysis && activeAnalysis.suggestions.length > 0 && (
                <div className="relative z-10 px-6 py-3 mt-3 flex flex-col sm:flex-row gap-2 max-w-7xl mx-auto w-full">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            placeholder={isAr ? 'ابحث عن عميل، رمز، أو مسار...' : 'Search customer, code, or route…'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-amber-500 placeholder:text-white/30"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <PillSelect
                            label={isAr ? 'الأولوية' : 'Priority'}
                            options={[
                                { value: 'ALL',    label: isAr ? 'الكل' : 'All' },
                                { value: 'HIGH',   label: isAr ? 'عالٍ' : 'High' },
                                { value: 'MEDIUM', label: isAr ? 'متوسط' : 'Medium' },
                                { value: 'LOW',    label: isAr ? 'منخفض' : 'Low' },
                            ]}
                            value={priorityFilter}
                            onChange={v => setPriorityFilter(v as any)}
                            isAr={isAr}
                        />
                        <PillSelect
                            label={isAr ? 'ترتيب' : 'Sort'}
                            options={[
                                { value: 'savings',  label: isAr ? 'أعلى وفر' : 'Most savings' },
                                { value: 'priority', label: isAr ? 'الأولوية' : 'Priority' },
                                { value: 'name',     label: isAr ? 'العميل أ←ي' : 'Customer A→Z' },
                            ]}
                            value={sortBy}
                            onChange={v => setSortBy(v as any)}
                            isAr={isAr}
                        />
                    </div>
                </div>
            )}

            {/* Body */}
            <main className="relative z-10 flex-1 overflow-y-auto px-6 py-4 max-w-7xl mx-auto w-full">
                {!activeBranchId && !loadingBranches && (
                    <EmptyState
                        icon={Building2}
                        title={isAr ? 'اختر فرعاً' : 'Pick a branch'}
                        message={isAr ? 'يتم تحليل التوصيات لكل فرع بشكل مستقل ولا تختلط بين الفروع.' : 'Suggestions are analyzed per-branch and never mixed across branches.'}
                    />
                )}
                {analyzingBranch === activeBranchId && (
                    <div className="py-16 text-center">
                        <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                            <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                            <span className="text-sm font-black text-amber-200">{isAr ? 'جاري تحليل مسارات هذا الفرع...' : 'Analyzing routes for this branch…'}</span>
                        </div>
                    </div>
                )}
                {analyzeError && (
                    <div className="my-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-sm text-rose-200">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {analyzeError}
                    </div>
                )}
                {activeAnalysis && analyzingBranch !== activeBranchId && (
                    <>
                        {visibleSuggestions.length === 0 ? (
                            <EmptyState
                                icon={CheckCircle2}
                                title={isAr ? 'لا يوجد ما يحتاج تحسين 🎉' : 'Nothing to optimize 🎉'}
                                message={
                                    activeAnalysis.suggestions.length > 0
                                        ? (isAr ? 'تم تطبيق أو تجاهل جميع التوصيات في هذا الفرع.' : 'All suggestions in this branch have been applied or dismissed.')
                                        : (isAr ? `لا يوجد عميل يوفر أكثر من ${MIN_SAVING_KM} كم بتغيير مساره.` : `No customer would save more than ${MIN_SAVING_KM} km by switching routes within this branch. Routes look balanced.`)
                                }
                            />
                        ) : (
                            <div className="space-y-2 pb-12">
                                <AnimatePresence>
                                    {visibleSuggestions.map((s, i) => (
                                        <SuggestionCard
                                            key={s.id}
                                            suggestion={s}
                                            index={i}
                                            onClick={() => setOpenSuggestion(s)}
                                            onApply={() => handleApply(s)}
                                            onDismiss={() => handleDismiss(s)}
                                            isAr={isAr}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Detail drawer */}
            <AnimatePresence>
                {openSuggestion && (
                    <DetailDrawer
                        suggestion={openSuggestion}
                        onClose={() => setOpenSuggestion(null)}
                        onApply={() => handleApply(openSuggestion)}
                        onDismiss={() => handleDismiss(openSuggestion)}
                        isAr={isAr}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Sub-components ────────────────────────────────────────────────────────

const KPI: React.FC<{ icon: any; label: string; value: any; color: string }> = ({ icon: Icon, label, value, color }) => {
    const colorMap: Record<string, string> = {
        cyan:    'from-cyan-500/15 to-cyan-500/5 border-cyan-500/30 text-cyan-300',
        indigo:  'from-indigo-500/15 to-indigo-500/5 border-indigo-500/30 text-indigo-300',
        amber:   'from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-300',
        emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-300',
    };
    return (
        <div className={`rounded-xl bg-gradient-to-br ${colorMap[color] || colorMap.cyan} border p-3`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80">{label}</span>
            </div>
            <div className="text-2xl font-black leading-none">{value}</div>
        </div>
    );
};

const PillSelect: React.FC<{ label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; isAr?: boolean }> = ({ label, options, value, onChange, isAr }) => (
    <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2.5">{label}</span>
        {options.map(o => (
            <button
                key={o.value}
                onClick={() => onChange(o.value)}
                className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    value === o.value ? 'bg-amber-500/20 text-amber-200' : 'text-white/50 hover:text-white/80'
                }`}
            >
                {o.label}
            </button>
        ))}
    </div>
);

const SwapTypeBadge: React.FC<{ type: 'ROUTE_SWITCH' | 'DAY_SHIFT'; isAr?: boolean }> = ({ type, isAr }) =>
    type === 'DAY_SHIFT'
        ? <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border bg-violet-500/15 border-violet-500/30 text-violet-300 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {isAr ? 'تغيير اليوم' : 'Day Shift'}</span>
        : <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border bg-cyan-500/15 border-cyan-500/30 text-cyan-300 flex items-center gap-1"><Truck className="w-2.5 h-2.5" /> {isAr ? 'تغيير المسار' : 'Route Switch'}</span>;

const PriorityBadge: React.FC<{ priority: 'HIGH' | 'MEDIUM' | 'LOW'; isAr?: boolean }> = ({ priority, isAr }) => {
    const map = {
        HIGH:   { c: 'bg-rose-500/15 border-rose-500/30 text-rose-300',    label: isAr ? 'أثر عالٍ' : 'High Impact' },
        MEDIUM: { c: 'bg-amber-500/15 border-amber-500/30 text-amber-300', label: isAr ? 'متوسط' : 'Medium' },
        LOW:    { c: 'bg-slate-500/15 border-slate-500/30 text-slate-300', label: isAr ? 'منخفض' : 'Low' },
    } as const;
    const { c, label } = map[priority];
    return <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${c}`}>{label}</span>;
};

const SuggestionCard: React.FC<{
    suggestion: Suggestion;
    index: number;
    onClick: () => void;
    onApply: () => void;
    onDismiss: () => void;
    isAr?: boolean;
}> = ({ suggestion: s, index, onClick, onApply, onDismiss, isAr }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ delay: 0.02 * Math.min(index, 12) }}
        data-reach-card className="rounded-2xl bg-white/[0.03] border border-white/5 hover:border-amber-500/40 transition-colors overflow-hidden"
    >
        <button onClick={onClick} className="w-full text-left p-4 flex items-center gap-3">
            {/* Customer block */}
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black shadow-lg">
                <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black truncate">{s.customer.name || s.customer.clientCode || (isAr ? 'عميل' : 'Customer')}</span>
                    <PriorityBadge priority={s.priority} isAr={isAr} />
                    <SwapTypeBadge type={s.type} isAr={isAr} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/60">
                    <span className="font-mono">{s.customer.clientCode || '—'}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-white/50">{s.branchName}</span>
                </div>
                {/* Route swap visual */}
                {s.type === 'DAY_SHIFT' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{(isAr ? 'نفس المندوب · ' : 'Same rep · ') + s.currentRouteName}</span>
                        <span className="text-white/20">·</span>
                        <span className="px-2 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> {s.currentDay || '—'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                        <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 font-bold flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" /> {s.suggestedDay || '—'}
                        </span>
                    </div>
                ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 font-bold">
                            <span className="opacity-70">{isAr ? 'من' : 'From'}</span> {s.currentRouteName}
                        </span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                        <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 font-bold">
                            <span className="opacity-70">{isAr ? 'إلى' : 'To'}</span> {s.suggestedRouteName}
                        </span>
                        {s.suggestedRouteRep && (
                            <span className="text-[10px] text-white/40">
                                <span className="text-white/30">{isAr ? 'مندوب' : 'rep'}</span> <span className="font-mono text-cyan-300">{s.suggestedRouteRep}</span>
                            </span>
                        )}
                        {s.suggestedDay && (
                            <span className="px-1.5 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-[10px] font-black text-violet-200 flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" /> {s.suggestedDay}
                            </span>
                        )}
                    </div>
                )}
            </div>
            {/* Savings block */}
            <div className="shrink-0 text-right">
                <div className="text-2xl font-black text-emerald-300 leading-none">{s.kmSaved.toFixed(1)}</div>
                <div className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest mt-1">km saved</div>
                {s.timeSavedHours > 0.05 && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-black text-cyan-200">
                        <Clock className="w-2.5 h-2.5" /> {formatHours(s.timeSavedHours)}
                    </div>
                )}
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
        </button>
        {/* Quick actions row */}
        <div className="px-4 pb-3 flex items-center gap-2">
            <button
                onClick={onApply}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-black text-emerald-200 uppercase tracking-widest flex items-center gap-1.5 transition-all"
            >
                <CheckCircle2 className="w-3 h-3" /> {isAr ? 'تحديد كمُطبَّق' : 'Mark as applied'}
            </button>
            <button
                onClick={onDismiss}
                className="px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-[10px] font-black text-white/50 uppercase tracking-widest flex items-center gap-1.5 transition-all"
            >
                <X className="w-3 h-3" /> {isAr ? 'تجاهل' : 'Dismiss'}
            </button>
            <button
                onClick={onClick}
                className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[10px] font-black text-amber-200 uppercase tracking-widest flex items-center gap-1.5 transition-all"
            >
                <Eye className="w-3 h-3" /> {isAr ? 'عرض على الخريطة' : 'View on map'}
            </button>
        </div>
    </motion.div>
);

const EmptyState: React.FC<{ icon: any; title: string; message: string }> = ({ icon: Icon, title, message }) => (
    <div className="py-20 text-center max-w-md mx-auto">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
            <Icon className="w-7 h-7 text-white/40" />
        </div>
        <h3 className="text-base font-black text-white">{title}</h3>
        <p className="text-[12px] text-white/50 mt-1.5 leading-relaxed">{message}</p>
    </div>
);

// ─── Map helpers ──────────────────────────────────────────────────────────
// Teardrop pin with a colored body + lighter inner dot, drawn via inline SVG so
// each route's stops look like real route pins. Used for both current and
// suggested day's customers (different colors).
const buildDayPinIcon = (fill: string, ring: string, dot: string) => L.divIcon({
    className: 'ms-day-pin',
    html: `
        <svg viewBox="0 0 22 30" width="22" height="30" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45));">
            <path d="M11 0.8 C5.4 0.8 0.8 5.4 0.8 11 C0.8 18.5 11 29.2 11 29.2 C11 29.2 21.2 18.5 21.2 11 C21.2 5.4 16.6 0.8 11 0.8 Z"
                  fill="${fill}" stroke="${ring}" stroke-width="1.6"/>
            <circle cx="11" cy="10.6" r="3.6" fill="${dot}"/>
        </svg>
    `,
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -28],
});

const yellowDayPin   = buildDayPinIcon('#facc15', '#854d0e', '#fef9c3');
const redDayPin      = buildDayPinIcon('#dc2626', '#7f1d1d', '#fee2e2');

const LegendDot: React.FC<{ color: string; label: string; dashed?: boolean }> = ({ color, label, dashed }) => (
    <span className="flex items-center gap-1.5">
        <span className="relative inline-block w-3 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className="text-white/80">{label}</span>
        {dashed && <span className="ml-0.5 text-white/30 text-[9px]">--</span>}
    </span>
);

const DistanceLabel: React.FC<{ from: [number, number]; to: [number, number]; kind: 'current' | 'suggested'; value: string }> = ({ from, to, kind, value }) => {
    const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    // Current = yellow, Suggested = red (per user request)
    const bg = kind === 'current' ? '#facc15' : '#dc2626';
    const ring = kind === 'current' ? '#fde047' : '#ef4444';
    const fg = kind === 'current' ? '#422006' : '#ffffff';
    const icon = L.divIcon({
        className: 'ms-dist-label',
        html: `<div style="transform:translate(-50%,-50%);background:${bg};color:${fg};border:1.5px solid ${ring};padding:2px 8px;border-radius:9999px;font-weight:900;font-size:10px;letter-spacing:0.04em;white-space:nowrap;box-shadow:0 4px 14px ${bg}66;font-family:system-ui,-apple-system,sans-serif;display:inline-block;">${value}</div>`,
        iconSize: [1, 1],
        iconAnchor: [0, 0],
    });
    return <Marker position={mid} icon={icon} interactive={false} />;
};

// ─── Detail Drawer with Map ────────────────────────────────────────────────
// Fits the map to the points + force-recalculates Leaflet's container size.
// The map mounts inside an animated drawer, so its container has a width/height
// of zero on first render — without invalidateSize() Leaflet renders at world zoom.
const FitBounds: React.FC<{ points: [number, number][] }> = ({ points }) => {
    const map = useMap();
    useEffect(() => {
        if (points.length === 0) return;
        // Filter out junk coords (0,0 / NaN) which would skew bounds toward Africa.
        const clean = points.filter(p =>
            Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
            !(p[0] === 0 && p[1] === 0) &&
            Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
        );
        if (clean.length === 0) return;
        const b = L.latLngBounds(clean as any);
        if (!b.isValid()) return;
        // Two-phase fit: invalidate size first (drawer animation), then fit.
        const t1 = setTimeout(() => {
            map.invalidateSize({ animate: false });
            map.fitBounds(b.pad(0.20), { animate: false, maxZoom: 14 });
        }, 60);
        const t2 = setTimeout(() => {
            map.invalidateSize({ animate: false });
            map.fitBounds(b.pad(0.20), { animate: true, maxZoom: 14 });
        }, 320);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [map, points]);
    return null;
};

const DetailDrawer: React.FC<{
    suggestion: Suggestion;
    onClose: () => void;
    onApply: () => void;
    onDismiss: () => void;
    isAr?: boolean;
}> = ({ suggestion: s, onClose, onApply, onDismiss, isAr }) => {
    // Include EVERY relevant point: customer + both centroids + sample of both routes' members.
    // This makes the map auto-zoom to a frame where the user can compare the two routes
    // and the customer's position relative to them.
    const allPoints: [number, number][] = useMemo(() => {
        const pts: [number, number][] = [];
        if (s.customer.lat && s.customer.lng) pts.push([s.customer.lat, s.customer.lng]);
        if (s.currentRouteCentroid) pts.push(s.currentRouteCentroid);
        if (s.suggestedRouteCentroid) pts.push(s.suggestedRouteCentroid);
        s.currentRoutePath.forEach(p => pts.push(p));
        s.suggestedRoutePath.forEach(p => pts.push(p));
        return pts;
    }, [s]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-3xl rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-base font-black truncate">{s.customer.name || (isAr ? 'عميل' : 'Customer')}</div>
                            <div className="text-[11px] text-white/50 font-mono truncate">{s.customer.clientCode || s.id}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>

                {/* Body */}
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Map */}
                    <div className="relative h-80 md:h-[28rem] bg-slate-950">
                        <MapContainer center={[s.customer.lat, s.customer.lng]} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                            <TileLayer url={DARK_TILE_URL} attribution={DARK_TILE_ATTR} />
                            <FitBounds points={allPoints} />

                            {/* Current-day customers as YELLOW pins (filtered to customer's current visit day) */}
                            {s.currentRoutePath.map((p, i) => (
                                <Marker key={`cur-${i}`} position={p} icon={yellowDayPin} zIndexOffset={50}>
                                    <Popup>
                                        <div className="text-xs">
                                            <div className="font-black text-yellow-700 uppercase tracking-widest text-[9px] mb-1">{isAr ? `يوم الزيارة الحالي · توقف #${i+1}` : `Current Visit Day · Stop #${i + 1}`}</div>
                                            <div className="font-bold">{s.currentRouteName}</div>
                                            <div className="text-slate-700 mt-0.5"><Calendar className="inline w-3 h-3 -mt-0.5 mr-0.5" />{s.currentDay || '—'}</div>
                                            <div className="text-slate-500 mt-0.5">{p[0].toFixed(5)}, {p[1].toFixed(5)}</div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                            {/* Suggested-day customers as RED pins (filtered to suggested day) */}
                            {s.suggestedRoutePath.map((p, i) => (
                                <Marker key={`sug-${i}`} position={p} icon={redDayPin} zIndexOffset={60}>
                                    <Popup>
                                        <div className="text-xs">
                                            <div className="font-black text-red-700 uppercase tracking-widest text-[9px] mb-1">{isAr ? `يوم الزيارة المقترح · توقف #${i+1}` : `Suggested Visit Day · Stop #${i + 1}`}</div>
                                            <div className="font-bold">{s.suggestedRouteName}</div>
                                            <div className="text-slate-700 mt-0.5"><Calendar className="inline w-3 h-3 -mt-0.5 mr-0.5" />{s.suggestedDay || '—'}</div>
                                            <div className="text-slate-500 mt-0.5">{p[0].toFixed(5)}, {p[1].toFixed(5)}</div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}

                            {/* Centroid for current visit day — YELLOW halo */}
                            <CircleMarker
                                center={s.currentRouteCentroid}
                                radius={16}
                                pathOptions={{ fillColor: '#facc15', color: '#fde047', fillOpacity: 0.22, weight: 2 }}
                            >
                                <Popup>
                                    <div className="text-xs">
                                        <div className="font-black text-yellow-700 uppercase tracking-widest text-[9px] mb-1">{isAr ? 'اليوم الحالي · مركز المجموعة' : 'Current Day · Cluster Center'}</div>
                                        <div className="font-bold">{s.currentRouteName}</div>
                                        <div className="text-slate-700 mt-1"><Calendar className="inline w-3 h-3 -mt-0.5 mr-0.5" />{s.currentDay || '—'}</div>
                                        <div className="text-slate-600 mt-0.5">{s.currentRoutePath.length} {isAr ? 'عميل في هذا اليوم' : 'customers visited this day'}</div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                            {/* Centroid for suggested visit day — RED halo */}
                            <CircleMarker
                                center={s.suggestedRouteCentroid}
                                radius={16}
                                pathOptions={{ fillColor: '#dc2626', color: '#ef4444', fillOpacity: 0.22, weight: 2 }}
                            >
                                <Popup>
                                    <div className="text-xs">
                                        <div className="font-black text-red-700 uppercase tracking-widest text-[9px] mb-1">{isAr ? 'اليوم المقترح · مركز المجموعة' : 'Suggested Day · Cluster Center'}</div>
                                        <div className="font-bold">{s.suggestedRouteName}</div>
                                        <div className="text-slate-700 mt-1"><Calendar className="inline w-3 h-3 -mt-0.5 mr-0.5" />{s.suggestedDay || '—'}</div>
                                        <div className="text-slate-600 mt-0.5">{s.suggestedRoutePath.length} {isAr ? 'عميل في هذا اليوم' : 'customers visited this day'}</div>
                                    </div>
                                </Popup>
                            </CircleMarker>

                            {/* Customer → current visit-day cluster — YELLOW dashed (clickable) */}
                            <Polyline
                                positions={[[s.customer.lat, s.customer.lng], s.currentRouteCentroid]}
                                pathOptions={{ color: '#facc15', weight: 4, dashArray: '8,8', opacity: 0.85 }}
                            >
                                <Popup>
                                    <div className="text-xs min-w-[200px]">
                                        <div className="font-black text-yellow-700 uppercase tracking-widest text-[9px] mb-1.5">Current Visit Day</div>
                                        <div className="space-y-0.5 text-slate-700">
                                            <div><span className="font-semibold">Day:</span> <span className="text-yellow-800 font-bold">{s.currentDay || '—'}</span></div>
                                            <div><span className="font-semibold">Route:</span> {s.currentRouteName}</div>
                                            <div><span className="font-semibold">Rep:</span> {s.currentRouteRep || '—'}</div>
                                            <div className="pt-1 mt-1 border-t border-slate-200"><span className="font-semibold">Distance from customer:</span> <span className="font-mono text-yellow-700">{s.currentDistKm.toFixed(1)} km</span></div>
                                        </div>
                                    </div>
                                </Popup>
                            </Polyline>
                            {/* Customer → suggested visit-day cluster — RED solid (clickable) */}
                            <Polyline
                                positions={[[s.customer.lat, s.customer.lng], s.suggestedRouteCentroid]}
                                pathOptions={{ color: '#dc2626', weight: 4, opacity: 0.95 }}
                            >
                                <Popup>
                                    <div className="text-xs min-w-[200px]">
                                        <div className="font-black text-red-700 uppercase tracking-widest text-[9px] mb-1.5">Suggested Visit Day</div>
                                        <div className="space-y-0.5 text-slate-700">
                                            <div><span className="font-semibold">Day:</span> <span className="text-red-800 font-bold">{s.suggestedDay || '—'}</span></div>
                                            <div><span className="font-semibold">Route:</span> {s.suggestedRouteName}</div>
                                            <div><span className="font-semibold">Rep:</span> {s.suggestedRouteRep || '—'}</div>
                                            <div className="pt-1 mt-1 border-t border-slate-200"><span className="font-semibold">Distance from customer:</span> <span className="font-mono text-red-700">{s.suggestedDistKm.toFixed(1)} km</span></div>
                                            <div><span className="font-semibold">Savings:</span> <span className="font-mono text-emerald-700">−{s.kmSaved.toFixed(1)} km · {formatHours(s.timeSavedHours)}</span></div>
                                        </div>
                                    </div>
                                </Popup>
                            </Polyline>

                            {/* Distance labels at midpoints */}
                            <DistanceLabel
                                from={[s.customer.lat, s.customer.lng]}
                                to={s.currentRouteCentroid}
                                kind="current"
                                value={`${s.currentDistKm.toFixed(1)} km`}
                            />
                            <DistanceLabel
                                from={[s.customer.lat, s.customer.lng]}
                                to={s.suggestedRouteCentroid}
                                kind="suggested"
                                value={`${s.suggestedDistKm.toFixed(1)} km`}
                            />

                            {/* Customer pin — last so it stays on top */}
                            <CircleMarker
                                center={[s.customer.lat, s.customer.lng]}
                                radius={11}
                                pathOptions={{ fillColor: '#22d3ee', color: '#0891b2', fillOpacity: 1, weight: 3 }}
                            >
                                <Popup><div className="text-xs"><b>{s.customer.name}</b><br />{s.customer.clientCode}</div></Popup>
                            </CircleMarker>
                        </MapContainer>

                        {/* Legend overlay — explicit about which day each color represents */}
                        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur border border-white/10 text-[10px] font-bold pointer-events-none">
                            <LegendDot color="#22d3ee" label={isAr ? 'عميل' : 'Customer'} />
                            <LegendDot color="#facc15" label={isAr ? `اليوم الحالي: ${s.currentDay || '—'}` : `Current day: ${s.currentDay || '—'}`} dashed />
                            <LegendDot color="#dc2626" label={isAr ? `اليوم المقترح: ${s.suggestedDay || '—'}` : `Suggested day: ${s.suggestedDay || '—'}`} />
                            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-300 font-black">
                                −{s.kmSaved.toFixed(1)} km · {formatHours(s.timeSavedHours)}
                            </span>
                            <span className="basis-full text-[9px] text-white/40 font-medium normal-case">
                                {isAr ? 'يُعرض العملاء المزارون في كل يوم فقط. انقر على أي خط أو نقطة لمزيد من التفاصيل.' : 'Showing only customers visited on each day. Click any line, dot, or centroid for details.'}
                            </span>
                        </div>
                    </div>

                    {/* Info panel */}
                    <div className="p-5 space-y-4">
                        <div>
                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{isAr ? 'الفرع' : 'Branch'}</div>
                            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-400" /><span className="text-sm font-bold">{s.branchName}</span></div>
                        </div>

                        <div>
                            <div className="text-[10px] font-black text-yellow-300 uppercase tracking-widest mb-1.5">{isAr ? 'الزيارة الحالية · اليوم' : 'Current Visit · Day'}</div>
                            <RouteBlock
                                color="yellow"
                                routeName={s.currentRouteName}
                                rep={s.currentRouteRep}
                                days={s.currentDay ? [s.currentDay] : s.currentRouteDays}
                                distance={s.currentDistKm}
                                isAr={isAr}
                            />
                        </div>

                        <div className="flex items-center justify-center">
                            <ArrowRight className="w-5 h-5 text-amber-400" />
                        </div>

                        <div>
                            <div className="text-[10px] font-black text-red-300 uppercase tracking-widest mb-1.5">{isAr ? 'الزيارة المقترحة · اليوم' : 'Suggested Visit · Day'}</div>
                            <RouteBlock
                                color="red"
                                routeName={s.suggestedRouteName}
                                rep={s.suggestedRouteRep}
                                days={s.suggestedDay ? [s.suggestedDay] : s.suggestedRouteDays}
                                distance={s.suggestedDistKm}
                                isAr={isAr}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2">
                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                                <div className="text-xl font-black text-emerald-300 leading-none">{s.kmSaved.toFixed(1)}<span className="text-[10px] ml-0.5">km</span></div>
                                <div className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest mt-1">{isAr ? 'وفر في المسافة' : 'Driving saved'}</div>
                            </div>
                            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3 text-center">
                                <div className="text-xl font-black text-cyan-300 leading-none">{formatHours(s.timeSavedHours)}</div>
                                <div className="text-[9px] font-black text-cyan-400/70 uppercase tracking-widest mt-1">{isAr ? 'وفر في الوقت' : 'Time saved'}</div>
                            </div>
                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-center flex items-center justify-center">
                                <PriorityBadge priority={s.priority} isAr={isAr} />
                            </div>
                        </div>

                        <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-cyan-300 shrink-0 mt-0.5" />
                            {s.type === 'DAY_SHIFT' ? (
                                <p className="text-[11px] text-cyan-100/80 leading-relaxed">
                                    {isAr ? 'تغيير يوم الزيارة فقط' : <>Just <strong>shifting the visit day</strong> on the same route saves more than switching reps. Keep <strong>rep {s.currentRouteRep || s.currentRouteName}</strong>, but visit on <strong>{s.suggestedDay || '—'}</strong> instead of <strong>{s.currentDay || '—'}</strong>.</>}
                                </p>
                            ) : (
                                <p className="text-[11px] text-cyan-100/80 leading-relaxed">
                                    {isAr ? 'المسار المقترح في نفس الفرع' : <>The suggested route is in the <strong>same branch</strong> and excludes the customer's current route. The customer would be visited by <strong>rep {s.suggestedRouteRep || '—'}</strong> on <strong>{s.suggestedDay || s.suggestedRouteDays.join(', ') || '—'}</strong>.</>}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                        onClick={onDismiss}
                        className="px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-[11px] font-black text-white/60 uppercase tracking-widest"
                    >
                        {isAr ? 'تجاهل' : 'Dismiss'}
                    </button>
                    <button
                        onClick={onApply}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/30"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" /> {isAr ? 'تحديد كمُطبَّق' : 'Mark as Applied'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const RouteBlock: React.FC<{
    color: 'yellow' | 'red';
    routeName: string;
    rep?: string;
    days: string[];
    distance: number;
    isAr?: boolean;
}> = ({ color, routeName, rep, days, distance, isAr }) => {
    const styles = color === 'yellow'
        ? { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', accent: 'text-yellow-300' }
        : { bg: 'bg-red-500/10', border: 'border-red-500/30', accent: 'text-red-300' };
    return (
        <div className={`rounded-xl ${styles.bg} ${styles.border} border p-3`}>
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                    <Truck className={`w-4 h-4 ${styles.accent}`} />
                    <span className="text-sm font-black truncate">{routeName}</span>
                </div>
                <span className={`text-[10px] font-mono ${styles.accent}`}>{distance.toFixed(1)} km</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                    <User className="w-3 h-3 text-white/40" />
                    <span>{isAr ? 'المندوب: ' : 'Rep: '}<span className="font-mono text-cyan-300">{rep || '—'}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-white/70">
                    <Calendar className="w-3 h-3 text-white/40" />
                    <span>{days.length > 0 ? days.join(', ') : '—'}</span>
                </div>
            </div>
        </div>
    );
};

export default AIOptimizerV2;
