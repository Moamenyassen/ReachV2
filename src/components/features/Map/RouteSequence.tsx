
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TRANSLATIONS, DEFAULT_COMPANY_SETTINGS } from '../../../config/constants';
import { Customer, RouteSummary, CompanySettings, NormalizedBranch } from '../../../types';
import { optimizeRoute, calculateDistance, analyzeSameLocation, countNearbyCustomers, OptimizerConfig } from '../../../services/optimizer';
import { supabase, fetchFilteredRoutes, fetchUniqueFilterData, fetchRoutePortfolioCount, fetchRouteCustomersNormalized, fetchCompanyRoutes, fetchFilterStats } from '../../../services/supabase';
import MapVisualizer from '../../MapVisualizer';
import ErrorBoundary from '../../ErrorBoundary';
import {
    ArrowLeft, Navigation, Clock,
    Map as MapIcon, Globe,
    ListFilter, Truck, Loader2, Zap, Briefcase, ChevronRight,
    Activity, BarChart3, ChevronDown, Timer, UserCheck,
    MapPin, Info, Layers, MapPinned, TentTree, Users, Target, Printer,
    Calendar, Hash, Building2, AlertTriangle, Check, ChevronsUpDown, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RouteSequenceProps {
    // allCustomers removed - redundant
    companyId?: string;
    activeVersionId?: string;
    onBack: () => void;
    isDarkMode: boolean;
    language: 'en' | 'ar';
    onToggleTheme: () => void;
    onToggleLang: () => void;
    settings?: CompanySettings;
    // Removed external props passed for old filtering
    hideHeader?: boolean;
    // NEW: For branch-based access control
    userRole?: string;
    userBranchIds?: string[];
    // NEW: Trigger refresh of cached stats after upload
    lastUploadDate?: string;
}

const InfoTooltip = ({ content }: { content: string }) => (
    <div className="group relative inline-block ml-1.5 align-middle">
        <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-brand-primary/10 transition-colors cursor-help">
            <Info className="w-3 h-3 text-muted group-hover:text-brand-primary transition-colors" />
        </div>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-60 p-3 bg-gray-950 text-gray-200 text-[11px] leading-relaxed rounded-lg shadow-2xl border border-gray-800 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none invisible group-hover:visible z-[9999] text-center font-medium translate-y-2 group-hover:translate-y-0">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-950"></div>
        </div>
    </div>
);

const CustomGraphTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-900/95 backdrop-blur-md text-white p-3 sm:p-4 rounded-xl shadow-2xl border border-gray-700 text-[10px] sm:text-xs z-[9999] min-w-[200px] sm:min-w-[240px]">
                <div className="flex items-center gap-2 mb-2 sm:mb-3 pb-2 border-b border-gray-700">
                    <span className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Leg {data.index}</span>
                    <span className="font-bold text-gray-300">Travel Details</span>
                </div>
                <div className="flex flex-col gap-1.5 sm:gap-2 mb-3 sm:mb-4 text-left">
                    <div><span className="text-[8px] sm:text-[9px] text-gray-500 uppercase font-bold block leading-none mb-1">From</span><span className="font-bold text-gray-300 block leading-tight truncate">{data.fromName}</span></div>
                    <div><span className="text-[8px] sm:text-[9px] text-gray-500 uppercase font-bold block leading-none mb-1">To</span><span className="font-bold text-white block leading-tight truncate">{data.toName}</span></div>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/50 p-2 sm:p-2.5 rounded-lg border border-gray-700/50">
                    <div className="flex-1 text-center"><span className="block text-gray-500 text-[8px] sm:text-[9px] uppercase font-bold mb-0.5">Distance</span><span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">{data.distance} km</span></div>
                    <div className="w-px h-6 sm:h-8 bg-gray-700"></div>
                    <div className="flex-1 text-center"><span className="block text-gray-500 text-[8px] sm:text-[9px] uppercase font-bold mb-0.5">Est. Time</span><span className="font-mono font-bold text-amber-400 text-xs sm:text-sm">{Math.round(data.time)} min</span></div>
                </div>
            </div>
        );
    }
    return null;
}


// NEW: MultiSelect Component
interface MultiSelectProps {
    title: string;
    options: { val: string; count?: number }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    icon?: React.ElementType;
    placeholder?: string;
    disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ title, options, selected, onChange, icon: Icon, placeholder = 'Select...', disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (val: string) => {
        let newSelected;
        if (val === 'All') {
            // Toggle All: If currently All is selected (or nothing), deselect all? Or verify logic.
            // Convention: If 'All' is clicked, clear others and set 'All'.
            newSelected = ['All'];
        } else {
            // If selecting a specific value, remove 'All' if present
            const withoutAll = selected.filter(s => s !== 'All');
            if (withoutAll.includes(val)) {
                newSelected = withoutAll.filter(s => s !== val);
            } else {
                newSelected = [...withoutAll, val];
            }
            // If nothing selected, revert to All? Or allow empty? Let's default to All if empty for easier logic, or handle empty as "None".
            // Implementation choice: Empty = All.
            if (newSelected.length === 0) newSelected = ['All'];
        }
        onChange(newSelected);
    };

    const isAllSelected = selected.includes('All') || selected.length === 0;
    const displayValue = isAllSelected ? localizedAll(placeholder) : `${selected.length} Selected`;

    // Simple localization helper since we are inside the component
    function localizedAll(ph: string) {
        if (ph.includes('Branch') || ph.includes('الفرع')) return 'All Branches';
        if (ph.includes('Route') || ph.includes('مسار')) return 'All Routes';
        return 'All';
    }

    return (
        <div className="relative w-full md:flex-1 group" ref={containerRef}>
            {Icon && <Icon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted z-10" />}

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full bg-gray-50 dark:bg-gray-950 border ${isOpen ? 'border-brand-primary ring-1 ring-brand-primary' : 'border-gray-200 dark:border-gray-800'} rounded-xl py-2.5 sm:py-3 pl-10 pr-8 text-[10px] sm:text-xs font-bold text-left flex items-center justify-between outline-none transition-all text-gray-900 dark:text-white shadow-sm hover:border-gray-300 dark:hover:border-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className="truncate">{selected.includes('All') ? placeholder : `${selected.length} Selected`}</span>
                <ChevronsUpDown className="w-3 h-3 text-muted" />
            </button>

            {isOpen && !disabled && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-[5000] max-h-60 overflow-y-auto p-1">
                    <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected.includes('All') ? 'bg-brand-primary/10 text-brand-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                        onClick={() => toggleOption('All')}
                    >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.includes('All') ? 'bg-brand-primary border-brand-primary' : 'border-gray-300 dark:border-gray-500'}`}>
                            {selected.includes('All') && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold">Select All</span>
                    </div>
                    {options.filter(opt => opt.val !== 'All').map((opt) => {
                        const isSelected = selected.includes(opt.val);
                        return (
                            <div
                                key={opt.val}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-brand-primary/5 text-brand-primary' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                                onClick={() => toggleOption(opt.val)}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-brand-primary border-brand-primary' : 'border-gray-300 dark:border-gray-500'}`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-[10px] sm:text-xs font-medium truncate flex-1">{opt.val}</span>
                                {opt.count !== undefined && <span className="text-[9px] text-muted bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md">{opt.count}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const RouteSequence: React.FC<RouteSequenceProps> = ({ companyId, activeVersionId, onBack, isDarkMode, language, settings, hideHeader = false, userRole, userBranchIds, lastUploadDate }) => {
    // Check if user is admin/manager (can see all data)
    const isAdmin = !userRole || ['ADMIN', 'MANAGER', 'SYSADMIN'].includes(userRole.toUpperCase());

    const t = TRANSLATIONS[language];
    const isAr = language === 'ar';

    const optimizerConfig: OptimizerConfig = useMemo(() => {
        return {
            ...DEFAULT_COMPANY_SETTINGS.modules.optimizer,
            ...settings?.modules?.optimizer,
            drivingDistanceFactor: settings?.modules?.optimizer?.drivingDistanceFactor ?? 1.4 // Fallback
        } as OptimizerConfig;
    }, [settings]);

    // FILTER STATE
    // FILTER STATE - NOW ARRAYS
    const [selectedRegions, setSelectedRegions] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_regions');
        return saved ? JSON.parse(saved) : ['All'];
    });
    const [selectedRoutes, setSelectedRoutes] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_routes');
        return saved ? JSON.parse(saved) : ['All'];
    });
    const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
    const [availableDays, setAvailableDays] = useState<string[]>([]);
    const [selectedWeeks, setSelectedWeeks] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_weeks');
        return saved ? JSON.parse(saved) : ['All'];
    });
    const [selectedDays, setSelectedDays] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_days');
        return saved ? JSON.parse(saved) : ['All'];
    });

    // DROPDOWN DATA STATE
    const [availableRegions, setAvailableRegions] = useState<{ val: string; count: number }[]>([]);
    const [availableRoutes, setAvailableRoutes] = useState<{ val: string; count: number }[]>([]);

    // EXECUTION STATE
    const [isExecuted, setIsExecuted] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // DATA STATE
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [timelineRoute, setTimelineRoute] = useState<Customer[]>([]);
    const [summary, setSummary] = useState<RouteSummary | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isRoutesLoading, setIsRoutesLoading] = useState(false);
    const [routePortfolioCount, setRoutePortfolioCount] = useState<number>(0);
    const [dbBranches, setDbBranches] = useState<NormalizedBranch[]>([]);
    const [debugInfo, setDebugInfo] = useState<{ rowCount: number; normalizedCount: number; globalCount: number; routeVisitsCount: number; companyId: string; error?: string }>({
        rowCount: 0,
        normalizedCount: 0,
        globalCount: 0,
        routeVisitsCount: 0,
        companyId: companyId || 'N/A'
    });

    const [filterStats, setFilterStats] = useState<{ branches: Record<string, number>, routes: Record<string, number> }>({ branches: {}, routes: {} });

    // DEBUG: Check if data exists
    useEffect(() => {
        if (!companyId) return;
        const checkData = async () => {
            // Check specific to this company
            const { count: companyCount } = await supabase
                .from('company_uploaded_data')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId);

            // NEW: Check Normalized Customers
            const { count: normalizedCount } = await supabase
                .from('normalized_customers')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId);

            // Check GLOBALLY (Total rows in the table across all companies)
            const { count: globalCount } = await supabase
                .from('company_uploaded_data')
                .select('*', { count: 'exact', head: true });

            // NEW: Check Route Visits
            const { count: visitsCount } = await supabase
                .from('route_visits')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', companyId);

            console.info('[DEBUG] counts - Raw:', companyCount, 'Normalized:', normalizedCount, 'Visits:', visitsCount, 'Global:', globalCount);
            setDebugInfo(prev => ({
                ...prev,
                rowCount: companyCount || 0,
                normalizedCount: normalizedCount || 0,
                globalCount: globalCount || 0,
                routeVisitsCount: visitsCount || 0,
                companyId
            }));
        };
        checkData();
    }, [companyId]);

    // NEW: Load filter counts (stats)
    const prevUploadDate = useRef(lastUploadDate);
    useEffect(() => {
        if (!companyId) return;
        const loadStats = async () => {
            const isNewUpload = prevUploadDate.current !== lastUploadDate;
            if (isNewUpload) {
                prevUploadDate.current = lastUploadDate;
            }
            const stats = await fetchFilterStats(companyId, isNewUpload);
            setFilterStats(stats);
        };
        loadStats();
    }, [companyId, lastUploadDate]);

    // Initial Load - Branches (Direct Query to company_branches table)
    // NEW: Filter branches by user's assigned branches for non-admin users
    useEffect(() => {
        if (!companyId) return;

        const loadBranches = async () => {
            console.log('[RouteSequence] Loading DB branches for start nodes:', companyId, 'isAdmin:', isAdmin, 'userBranchIds:', userBranchIds);
            try {
                const { getBranches } = await import('../../../services/supabase');
                let branches = await getBranches(companyId);

                // NEW: Filter branches for non-admin users
                if (!isAdmin && userBranchIds && userBranchIds.length > 0) {
                    console.log('[RouteSequence] Filtering branches for restricted user. Allowed branches:', userBranchIds);
                    branches = branches.filter(b =>
                        userBranchIds.includes(b.name_en) ||
                        userBranchIds.includes(b.id) ||
                        userBranchIds.includes(b.code)
                    );
                    console.log('[RouteSequence] Filtered branches count:', branches.length);
                }

                setDbBranches(branches);

                // Map for dropdown
                const branchOptions = branches.map(b => ({
                    val: b.name_en,
                    count: filterStats.branches[b.name_en] || 0
                }));
                setAvailableRegions(branchOptions);

                // Auto-select first branch if none selected or if userBranchIds force a change
                const savedRegionsStr = localStorage.getItem('rg_dash_regions');
                const savedRegions = savedRegionsStr ? JSON.parse(savedRegionsStr) : null;
                const hasValidSavedRegion = savedRegions && savedRegions.some((r: string) => branchOptions.map(b => b.val).includes(r));

                if (branchOptions.length > 0 && selectedRegions.length === 1 && selectedRegions[0] === 'All' && !hasValidSavedRegion) {
                    setSelectedRegions([branchOptions[0].val]);
                }
            } catch (err) {
                console.error("Failed to load DB branches:", err);
            }
        };

        loadBranches();
    }, [companyId, isAdmin, userBranchIds]);

    // Secondary Load - Routes (Direct Query to company_uploaded_data via RPC with Hierarchy)
    useEffect(() => {
        if (!companyId) return;

        const loadRoutes = async () => {
            setIsRoutesLoading(true);

            // Use normalized fetchCompanyRoutes which joins branches
            // If selectedRegions includes 'All', pass undefined to fetchCompanyRoutes to get all for company
            const branchFilter = selectedRegions.includes('All') ? undefined : selectedRegions;

            const data = await fetchCompanyRoutes(companyId, branchFilter);

            // Map to format expected by MultiSelect { val, count }
            const mappedRoutes = data.map((r: any) => ({
                val: r.routeName,
                count: filterStats.routes[r.routeName] || 0
            }));

            setAvailableRoutes(mappedRoutes);
            setIsRoutesLoading(false);

            if (mappedRoutes.length === 0) {
                setSelectedRoutes(['All']);
            }
        };

        loadRoutes();
    }, [companyId, selectedRegions]);

    // Load unique weeks and days from normalized route_visits table (COMBINED query for efficiency)
    useEffect(() => {
        if (!companyId) return;

        const loadWeeksAndDays = async () => {
            // Both weeks and days fetched with company_id isolation to prevent cross-tenant bleed
            const { data: weeksData } = await supabase
                .from('route_visits')
                .select('week_number')
                .eq('company_id', companyId);  // SECURITY: company isolation

            const distinctWeeks = Array.from(new Set(
                (weeksData || []).map(item => item.week_number).filter(Boolean).filter((w: string) => w !== 'NULL')
            ));
            setAvailableWeeks(distinctWeeks.sort() as string[]);

            const { data: daysData } = await supabase
                .from('route_visits')
                .select('day_name')
                .eq('company_id', companyId);  // SECURITY: company isolation

            const distinctDays = Array.from(new Set(
                (daysData || []).map(item => item.day_name).filter(Boolean).filter((d: string) => d !== 'NULL')
            ));
            setAvailableDays(distinctDays as string[]);
        };

        loadWeeksAndDays();
    }, [companyId]);


    // EXECUTE / FETCH DATA
    const handleExecute = async () => {
        if (!companyId) return;

        // CRITICAL: Prevent loading without filter to avoid crashing (Large Data)
        // Check if ANY route is selected (or All)
        if (selectedRoutes.length === 0) {
            alert("Please select at least one Route.");
            return;
        }

        setIsLoading(true);
        setIsExecuted(true); // Show UI containers

        // PERSISTENCE
        localStorage.setItem('rg_dash_regions', JSON.stringify(selectedRegions));
        localStorage.setItem('rg_dash_routes', JSON.stringify(selectedRoutes));
        localStorage.setItem('rg_dash_weeks', JSON.stringify(selectedWeeks));
        localStorage.setItem('rg_dash_days', JSON.stringify(selectedDays));

        try {
            // Aggregate portfolio count for all selected routes
            let totalPortfolio = 0;
            const routeList = selectedRoutes.includes('All') ? availableRoutes.map(r => r.val) : selectedRoutes;

            // If strictly ONE region is selected, use it for portfolio scope
            const branchName = selectedRegions.length === 1 && selectedRegions[0] !== 'All' ? selectedRegions[0] : 'All';

            const portfolioPromises = routeList.map(r => fetchRoutePortfolioCount(companyId, r, branchName));
            const portfolioResults = await Promise.all(portfolioPromises);
            totalPortfolio = portfolioResults.reduce((sum, count) => sum + count, 0);

            setRoutePortfolioCount(totalPortfolio);

            // 1. Try Normalized Fetch (Production Path)
            let allRouteData = await fetchRouteCustomersNormalized(
                companyId,
                {
                    region: selectedRegions,
                    route: selectedRoutes,
                    week: selectedWeeks,
                    day: selectedDays
                }
            );

            // 2. Fallback to Legacy Fetch if normalized is empty (Migration support)
            if (allRouteData.length === 0) {
                console.info('[RouteSequence] Normalized data empty, trying legacy fetch...');
                allRouteData = await fetchFilteredRoutes(
                    companyId,
                    activeVersionId || 'active_routes',
                    {
                        region: selectedRegions,
                        route: selectedRoutes,
                        week: selectedWeeks,
                        day: selectedDays
                    },
                    0, // page
                    -1  // pageSize
                );
            }

            setFilteredCustomers(allRouteData);

            if (allRouteData.length > 0) {
                // Optimizer triggered via useEffect
            } else {
                setTimelineRoute([]);
                setSummary(null);
            }

        } catch (err) {
            console.error("Failed to load route sequence data", err);
        } finally {
            setIsLoading(false);
        }
    };

    // STATS CALCULATION
    const stats = useMemo(() => {
        // Numerator: Distinct count of customers as per day filter
        const totalStops = new Set(filteredCustomers.map(c => c.clientCode)).size;

        // Denominator: Total distinct count of the filtered route (fetched from handleExecute)
        const portfolioCount = routePortfolioCount;

        return {
            totalStops,
            portfolioCount
        };

    }, [filteredCustomers, routePortfolioCount]);

    // OPTIMIZER LOGIC
    useEffect(() => {
        if (filteredCustomers.length === 0) return;

        setIsProcessing(true);
        // Small timeout to allow UI to render spinner before heavy calc
        const timer = setTimeout(() => {
            const regionCode = filteredCustomers[0]?.regionCode;
            let startNode: Customer | undefined;

            // Try to find Branch Start Node
            // Try to find Branch Start Node
            // Use selectedRegion state if available, otherwise fall back to first customer's region
            // If multi-regions, use the first one, or 'All' logic.
            const targetRegion = (selectedRegions.length === 1 && selectedRegions[0] !== 'All') ? selectedRegions[0] : filteredCustomers[0]?.regionCode;

            if (targetRegion) {
                // Use live DB branches for start coordinates
                const branch = dbBranches.find(b =>
                    b.name_en.toLowerCase() === targetRegion.toLowerCase() ||
                    b.code?.toLowerCase() === targetRegion.toLowerCase()
                );

                if (branch && branch.lat != null && branch.lng != null) {
                    startNode = {
                        id: `branch-${branch.id}`,
                        name: `Start: ${branch.name_en}`,
                        lat: branch.lat,
                        lng: branch.lng,
                        day: 'All',
                        regionCode: branch.name_en,
                        routeName: 'DEPOT',
                        clientCode: 'BRANCH'
                    };
                }
            }

            const input = startNode ? [startNode, ...filteredCustomers] : [...filteredCustomers];

            // RUN OPTIMIZER
            const { orderedCustomers, summary: resSum } = optimizeRoute(input, startNode?.id, optimizerConfig);

            setTimelineRoute(orderedCustomers);
            setSummary(resSum);
            setIsProcessing(false);
        }, 100);

        return () => clearTimeout(timer);
    }, [filteredCustomers, optimizerConfig, settings]);

    // Computed Values used in Render
    const nearbyCount = useMemo(() => {
        if (filteredCustomers.length < 2) return 0;
        const thresholdKm = (settings?.modules?.insights?.nearbyRadiusMeters || 100) / 1000;
        return countNearbyCustomers(filteredCustomers, thresholdKm);
    }, [filteredCustomers, settings]);

    const servingTimeMin = (stats?.totalStops || 0) * (optimizerConfig?.serviceTimeMin || 20);
    const driveTimeMin = useMemo(() => {
        if (!summary) return 0;
        return Math.max(0, summary.totalTimeMin - servingTimeMin);
    }, [summary, servingTimeMin]);

    const efficiencyScore = useMemo(() => {
        if (!summary || !summary.totalTimeMin || summary.totalTimeMin === 0) return 0;

        // CUSTOMER REQUEST FIX: Calculate efficiency from First Visit, not Branch.
        // This means we exclude the time taken for the first leg (Branch -> Stop 1) from the Total Time denominator.

        // CUSTOMER REQUEST FIX: Efficiency peaks at an ideal 8-hour (480 min) shift.
        // It calculates based on Total Time (Serving + Driving).
        // If Total Time < 480: Efficiency decreases (under-utilized)
        // If Total Time > 480: Efficiency decreases (over-utilized / overtime penalty)
        const idealShiftMins = 480;
        let efficiency = 0;

        if (summary.totalTimeMin <= idealShiftMins) {
            efficiency = (summary.totalTimeMin / idealShiftMins) * 100;
        } else {
            efficiency = (idealShiftMins / summary.totalTimeMin) * 100;
        }

        return Math.min(100, Math.round(efficiency));
    }, [summary]);

    const formatMins = (mins: number) => {
        if (mins < 60) return `${Math.round(mins)}m`;
        return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
    };

    const graphData = useMemo(() => {
        if (!summary || !summary.segments) return [];
        return summary.segments.map((seg, i) => ({
            index: i + 1, distance: seg.distanceKm, time: seg.estimatedTimeMin,
            fromId: seg.fromId, toId: seg.toId, fromName: timelineRoute[i]?.name, toName: timelineRoute[i + 1]?.name
        }));
    }, [summary, timelineRoute]);

    // Use database values for weeks/days if available, otherwise use defaults
    const weeks = availableWeeks.length > 0 ? availableWeeks : ['Week One', 'Week Two', 'Week Three', 'Week Four'];
    const days = availableDays.length > 0 ? availableDays : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];

    // Map dbBranches to BranchConfig for MapVisualizer
    const mapBranchConfigs = useMemo(() => {
        // Only show branches that are relevant to selected regions
        return dbBranches
            .filter(b => selectedRegions.includes('All') || selectedRegions.includes(b.name_en))
            .map(b => ({
                id: b.id,
                name: b.name_en,
                nameAr: b.name_ar,
                code: b.code,
                coordinates: { lat: b.lat || 0, lng: b.lng || 0 },
                isActive: b.is_active
            }));
    }, [dbBranches, selectedRegions]);

    return (
        <div className="flex-1 flex flex-col w-full bg-gray-50/50 dark:bg-black font-sans pb-20 sm:pb-40 transition-colors duration-300 overflow-x-hidden">

            <div className="sticky top-0 z-[100] bg-white/80 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 transition-all shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] p-3 sm:p-4 md:p-6">
                <div className="max-w-[1920px] mx-auto space-y-3 sm:space-y-4">
                    {!hideHeader && (
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <button onClick={onBack} title="Back" className="p-2 sm:p-2.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 group shrink-0">
                                    <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-muted group-hover:text-brand-primary transition-colors" />
                                </button>
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                    <div className="p-2 bg-brand-primary rounded-lg sm:rounded-xl shadow-lg shrink-0"><Truck className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></div>
                                    <h2 className="text-base sm:text-2xl font-black text-main tracking-tight flex items-center gap-2 truncate">
                                        {t.routeSequence}
                                        {(isProcessing || isLoading) && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-brand-primary" />}
                                    </h2>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white dark:bg-gray-800 p-2 sm:p-2.5 rounded-2xl flex flex-col md:flex-row gap-2 items-center shadow-[0_2px_8px_0_rgba(0,0,0,0.04),0_12px_24px_-4px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10 dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
                        {/* BRANCH SELECT */}
                        <MultiSelect
                            title="Branch"
                            placeholder={isAr ? 'كل الفروع' : 'All Branches'}
                            options={[{ val: 'All', count: availableRegions.reduce((a, b) => a + b.count, 0) }, ...availableRegions]}
                            selected={selectedRegions}
                            onChange={(val) => { setSelectedRegions(val); setSelectedRoutes(['All']); }} // Reset routes on branch change
                            icon={Building2}
                            disabled={isLoading}
                        />

                        {/* ROUTE SELECT */}
                        <MultiSelect
                            title="Route"
                            placeholder={isAr ? 'كل المسارات' : 'All Routes'}
                            options={[{ val: 'All', count: availableRoutes.reduce((a, b) => a + b.count, 0) }, ...availableRoutes]}
                            selected={selectedRoutes}
                            onChange={setSelectedRoutes}
                            icon={MapIcon}
                            disabled={isLoading || isRoutesLoading}
                        />

                        {/* WEEK & DAY SELECT */}
                        <div className="flex w-full md:w-auto gap-1.5 sm:gap-2">
                            <div className="flex-1 md:w-32">
                                <MultiSelect
                                    title="Week"
                                    placeholder={t.allWeeks}
                                    options={[{ val: 'All' }, ...weeks.map(w => ({ val: w }))]}
                                    selected={selectedWeeks}
                                    onChange={setSelectedWeeks}
                                    icon={Calendar}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="flex-1 md:w-32">
                                <MultiSelect
                                    title="Day"
                                    placeholder={t.allDays}
                                    options={[{ val: 'All' }, ...days.map(d => ({ val: d }))]}
                                    selected={selectedDays}
                                    onChange={setSelectedDays}
                                    icon={Clock}
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                onClick={handleExecute}
                                disabled={isLoading}
                                className="px-4 py-2.5 sm:py-3 bg-brand-primary hover:bg-brand-primary/80 disabled:bg-brand-primary/50 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-brand-primary/30 transition-all active:scale-95 flex items-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                                {isAr ? 'عرض' : 'View'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Debug panel hidden in production */}

            {!isExecuted ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700 h-[60vh]">
                    <div className="relative mb-8 group">
                        <div className="absolute inset-0 bg-brand-primary/20 blur-2xl rounded-full scale-150 group-hover:bg-brand-primary/40 transition-colors duration-700"></div>
                        <div className="w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-brand-primary/20 rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.1)] backdrop-blur-sm relative z-10 transition-transform duration-500 group-hover:scale-110">
                            <MapIcon className="w-12 h-12 text-brand-primary mb-2 opacity-80" />
                            <Navigation className="w-6 h-6 text-cyan-400 absolute bottom-6 right-6" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">Sequence Intelligence</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-lg mb-8 leading-relaxed">
                        Select your desired Region, Route, Week, and Day from the top controls, then click <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary font-bold rounded-md uppercase tracking-wider text-xs shadow-sm mx-1">View</span> to decode and optimize travel paths.
                    </p>
                    {isAdmin && (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-black/20">
                            Use Admin Panel to upload new ETLS
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-3 sm:p-8 space-y-6 sm:space-y-8 max-w-[1920px] mx-auto w-full animate-in fade-in duration-500">
                    {/* Safety Valve */}
                    {stats.totalStops > 1000 ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200 dark:border-red-800 text-center animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-2xl font-black text-red-700 dark:text-red-400 mb-2">Data too heavy ({stats.totalStops} records)</h3>
                            <p className="text-red-600/80 dark:text-red-300 max-w-md font-medium text-lg">Please refine your filter (select a specific route or smaller date range) to prevent system overload.</p>
                        </div>
                    ) : (
                        <ErrorBoundary>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                                <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl group hover:-translate-y-1 transition-all duration-300 relative">
                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    </div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="p-3 bg-gray-800/50 rounded-2xl border border-gray-700/50 shadow-inner group-hover:shadow-lg group-hover:shadow-brand-primary/10 transition-all duration-300"><Navigation className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary" /></div>
                                        <div className="relative z-50">
                                            <InfoTooltip content="Planned visits for the selected cycle vs total unique clients assigned to this route." />
                                        </div>
                                    </div>
                                    <p className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight relative z-10">
                                        {stats.totalStops} <span className="text-sm text-gray-500 font-bold mx-0.5">/</span> {stats.portfolioCount || '--'}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 relative z-10">Coverage</p>
                                </div>

                                <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl group hover:-translate-y-1 transition-all duration-300 relative">
                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    </div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="p-3 bg-gray-800/50 rounded-2xl border border-gray-700/50 shadow-inner group-hover:shadow-lg group-hover:shadow-blue-500/10 transition-all duration-300"><MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" /></div>
                                        <InfoTooltip content="Total cumulative travel distance for the generated sequence in kilometers." />
                                    </div>
                                    <p className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight relative z-10">{summary?.totalDistanceKm ?? '--'} <span className="text-xs text-gray-500 font-medium">km</span></p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 relative z-10">Distance</p>
                                </div>

                                <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl group hover:-translate-y-1 transition-all duration-300 relative">
                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    </div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="p-3 bg-gray-800/50 rounded-2xl border border-gray-700/50 shadow-inner group-hover:shadow-lg group-hover:shadow-rose-500/10 transition-all duration-300"><Timer className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" /></div>
                                        <InfoTooltip content="Total time spent behind the wheel moving between customer locations." />
                                    </div>
                                    <p className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight relative z-10">{summary ? formatMins(driveTimeMin) : '--'}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 relative z-10">Drive Time</p>
                                </div>

                                <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl group hover:-translate-y-1 transition-all duration-300 relative">
                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    </div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="p-3 bg-gray-800/50 rounded-2xl border border-gray-700/50 shadow-inner group-hover:shadow-lg group-hover:shadow-emerald-500/10 transition-all duration-300"><UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" /></div>
                                        <InfoTooltip content="Time allocated for on-site customer service (fixed at 20 mins per stop)." />
                                    </div>
                                    <p className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight relative z-10">{formatMins(servingTimeMin)}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 relative z-10">Serving Time</p>
                                </div>

                                <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl group hover:-translate-y-1 transition-all duration-300 relative">
                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    </div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="p-3 bg-gray-800/50 rounded-2xl border border-gray-700/50 shadow-inner group-hover:shadow-lg group-hover:shadow-amber-500/10 transition-all duration-300"><Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" /></div>
                                        <InfoTooltip content="Full shift duration combining Drive Time and Serving Time." />
                                    </div>
                                    <p className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight relative z-10">{summary ? formatMins(summary.totalTimeMin) : '--'}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 relative z-10">Total Work</p>
                                </div>

                                <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl group hover:-translate-y-1 transition-all duration-300 relative">
                                    <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    </div>
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="p-3 bg-gray-800/50 rounded-2xl border border-gray-700/50 shadow-inner group-hover:shadow-lg group-hover:shadow-violet-500/10 transition-all duration-300"><Zap className="w-5 h-5 sm:w-6 sm:h-6 text-violet-500" /></div>
                                        <InfoTooltip content="Route utilization score. Peaks at 100% for exactly 8 hours of work. Decreases for under-utilization (short shifts) and over-utilization (overtime)." />
                                    </div>
                                    <p className="text-2xl sm:text-3xl font-black text-white leading-none tracking-tight relative z-10">{efficiencyScore}%</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2 relative z-10">Efficiency</p>
                                </div>
                            </div>

                            {/* Empty State / Not Processed */}
                            {!isProcessing && filteredCustomers.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-12 py-24 text-center">
                                    <Target className="w-12 h-12 text-muted mb-4 opacity-50" />
                                    <p className="text-muted">No visits found matching these filters.</p>
                                </div>
                            )}

                            {isProcessing && (
                                <div className="bg-panel rounded-3xl sm:rounded-[3rem] border border-main p-12 sm:p-24 flex flex-col items-center justify-center text-center animate-in fade-in glass-panel mt-8">
                                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6 sm:mb-10">
                                        <Loader2 className="w-full h-full text-brand-primary animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center"><Zap className="w-8 h-8 sm:w-12 sm:h-12 text-brand-primary animate-pulse" /></div>
                                    </div>
                                    <h3 className="text-xl sm:text-3xl font-black text-main mb-2 tracking-tight">{t.processing}</h3>
                                    <p className="text-[10px] sm:text-sm text-muted font-bold uppercase tracking-widest">Organizing {filteredCustomers.length} stops for minimum travel</p>
                                </div>
                            )}

                            {/* RESULTS: Map & Timeline */}
                            {!isProcessing && summary && (
                                <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700 mt-8">
                                    <section id="map-view" className="w-full h-[400px] sm:h-[550px] rounded-[2.5rem] shadow-2xl overflow-hidden relative z-0 ring-4 ring-gray-900 border border-gray-800">
                                        <MapVisualizer
                                            route={timelineRoute}
                                            branches={mapBranchConfigs}
                                            settings={settings}
                                            selectedCustomerId={selectedCustomerId}
                                        />

                                        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-[1000] flex flex-col gap-1.5 sm:gap-2 pointer-events-none max-w-[140px] sm:max-w-none">
                                            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-xl p-2 sm:p-2.5 shadow-2xl min-w-[100px] sm:min-w-[160px] pointer-events-auto group">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 text-[8px] sm:text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                                        <Briefcase className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Portfolio
                                                    </div>
                                                    <InfoTooltip content="Master customer records for this route." />
                                                </div>
                                                <div className="text-sm sm:text-xl font-black text-gray-900 dark:text-white">{stats.portfolioCount}</div>
                                            </div>

                                            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-xl p-2 sm:p-2.5 shadow-2xl min-w-[100px] sm:min-w-[160px] pointer-events-auto group">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 text-[8px] sm:text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                                                        <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Nearby
                                                    </div>
                                                    <InfoTooltip content={`Clients within ${settings?.modules?.insights?.nearbyRadiusMeters || 100}m of each other.`} />
                                                </div>
                                                <div className="text-sm sm:text-xl font-black text-main">{nearbyCount}</div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Timeline & Flow Charts */}
                                    <div className="grid grid-cols-1 gap-6 sm:gap-8">
                                        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl flex flex-col relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700"></div>
                                            {!hideHeader && (
                                                <div className="flex justify-between items-center mb-6 sm:mb-8">
                                                    <div>
                                                        <h3 className="text-lg sm:text-2xl font-black text-main flex items-center gap-2">
                                                            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary" />
                                                            Timeline & Execution
                                                        </h3>
                                                        <p className="text-xs sm:text-sm text-muted font-medium ml-7 sm:ml-8">Detailed stop-by-stop sequence</p>
                                                    </div>
                                                    <button title="Print Sequence" onClick={() => window.print()} className="p-2 sm:p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 hover:bg-brand-primary/10 text-muted hover:text-brand-primary transition-all group border border-transparent hover:border-brand-primary/20">
                                                        <Printer className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                                <div className="flex items-center gap-1.5 mb-0.5 sm:mb-1 text-[8px] sm:text-[9px] font-black text-brand-primary uppercase tracking-widest">
                                                    <Briefcase className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Portfolio
                                                </div>
                                                <InfoTooltip content="Master customer records for this route." />
                                            </div>
                                            <p className="text-xl sm:text-2xl font-black text-main leading-tight">
                                                {stats.totalStops} <span className="text-xs text-muted font-bold mx-0.5">/</span> {stats.portfolioCount || '--'}
                                            </p>
                                            <p className="text-[7px] sm:text-[9px] font-bold text-muted uppercase tracking-widest mt-1">Coverage</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl flex flex-col relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700"></div>
                                            <div className="flex justify-between items-center mb-6 sm:mb-8">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    <div className="p-2 sm:p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl"><Activity className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                                                    <div>
                                                        <h3 className="font-black text-main uppercase tracking-wider text-[10px] sm:text-xs flex items-center">
                                                            Route Distance Flow
                                                            <InfoTooltip content="Leg-by-leg variance analysis." />
                                                        </h3>
                                                        <p className="text-[8px] sm:text-[10px] font-bold text-muted uppercase tracking-tighter">Travel variance (km)</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[8px] sm:text-[10px] font-black text-brand-primary uppercase tracking-widest block mb-0.5">Average Leg</span>
                                                    <span className="text-base sm:text-xl font-black text-main">{(summary.totalDistanceKm / (timelineRoute.length || 1)).toFixed(2)} km</span>
                                                </div>
                                            </div>
                                            <div className="h-[180px] sm:h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={graphData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                                                        <XAxis dataKey="index" hide />
                                                        <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                                        <Tooltip content={<CustomGraphTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                                        <Bar dataKey="distance" radius={[4, 4, 0, 0]}>
                                                            {graphData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.distance > 5 ? '#ef4444' : '#6366f1'} fillOpacity={0.8} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    <section className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 dark:bg-gray-700"></div>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-10 gap-4">
                                            <div className="flex items-center gap-3 sm:gap-4">
                                                <div className="p-2.5 sm:p-3 bg-brand-primary/10 text-brand-primary rounded-xl sm:rounded-2xl shrink-0"><MapPinned className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                                                <div>
                                                    <h3 className="text-xl sm:text-2xl font-black text-main tracking-tight flex items-center">
                                                        {t.clientSequence}
                                                        <InfoTooltip content="Sequence optimized to minimize carbon footprint and fuel." />
                                                    </h3>
                                                    <p className="text-xs sm:text-sm text-muted font-medium">Following this order ensures maximum field productivity</p>
                                                </div>
                                            </div>
                                            <div className="bg-main px-4 sm:px-5 py-1.5 sm:py-2 rounded-full border border-main text-[8px] sm:text-[10px] font-black text-muted uppercase tracking-widest">{timelineRoute.length} STOPS TOTAL</div>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute left-[1.4rem] sm:left-[2.25rem] top-4 bottom-4 w-0.5 sm:w-1 bg-gradient-to-b from-brand-primary via-brand-primary/20 to-transparent opacity-20"></div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 sm:gap-x-12 gap-y-6 sm:gap-y-8">
                                                {timelineRoute.map((stop, index) => {
                                                    const isBranch = stop?.id?.startsWith('branch-') || false;
                                                    const isSelected = selectedCustomerId === stop.id;
                                                    const legStats = index > 0 && summary.segments[index - 1];

                                                    return (
                                                        <div key={stop.id} className="relative pl-10 sm:pl-16 group">
                                                            <div title={isBranch ? 'Depot' : `Stop ${index}`} className={`absolute left-[1.1rem] sm:left-[1.65rem] top-1/2 -translate-y-1/2 w-4 h-4 sm:w-6 sm:h-6 rounded-full border-[3px] sm:border-[4px] z-20 cursor-pointer transition-all flex items-center justify-center ${isBranch ? 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700 ring-2 ring-brand-primary/20' : isSelected ? 'bg-brand-primary border-white scale-110 sm:scale-125 shadow-lg' : 'bg-gray-100 dark:bg-gray-800 border-brand-primary group-hover:scale-110'}`} onClick={() => setSelectedCustomerId(stop.id)}>
                                                                {isBranch && <Building2 className="w-2 h-2 sm:w-3 sm:h-3 text-brand-primary" />}
                                                            </div>

                                                            <div className={`p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl transition-all duration-300 cursor-pointer ${isSelected ? 'ring-2 ring-brand-primary shadow-[0_20px_40px_-10px_rgba(79,70,229,0.3)] scale-[1.02] z-10' : 'shadow-[0_2px_8px_0_rgba(0,0,0,0.04)] hover:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:ring-1 hover:ring-black/5 dark:hover:ring-white/10'}`} onClick={() => setSelectedCustomerId(stop.id)}>
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                                                            <span className={`text-[8px] sm:text-[10px] font-black uppercase px-2 py-0.5 sm:py-1 rounded-lg ${isBranch ? 'bg-gray-100 dark:bg-gray-900 text-brand-primary border border-transparent' : 'bg-brand-primary/10 text-brand-primary'}`}>
                                                                                {isBranch ? 'DEPOT' : `STOP #${index}`}
                                                                            </span>
                                                                            {!isBranch && (
                                                                                <div className="flex items-center gap-1.5">
                                                                                    {stop.clientCode && (
                                                                                        <div className="flex items-center gap-1 bg-main px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg border border-main">
                                                                                            <Hash className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted" />
                                                                                            <span className="text-[8px] sm:text-[10px] font-mono font-bold text-main">{stop.clientCode}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {stop.reachCustomerCode && (
                                                                                        <div className="flex items-center gap-1 bg-brand-primary/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg border border-brand-primary/20">
                                                                                            <span className="text-[8px] sm:text-[10px] font-black text-brand-primary uppercase tracking-tighter">REACH-ID: {stop.reachCustomerCode}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <h4 className="text-sm sm:text-lg font-black text-main truncate group-hover:text-brand-primary transition-colors">{stop.name}</h4>
                                                                        {stop.nameAr && <p className="text-base sm:text-lg font-bold text-brand-primary mt-0.5 leading-tight" dir="rtl">{stop.nameAr}</p>}

                                                                        {legStats && (
                                                                            <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4 border-t border-gray-100 dark:border-gray-700/30 pt-3">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Navigation className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted" />
                                                                                    <span className="text-[10px] sm:text-xs font-bold text-muted">+{legStats.distanceKm} km</span>
                                                                                </div>
                                                                                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-main"></div>
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <Timer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted" />
                                                                                    <span className="text-[10px] sm:text-xs font-bold text-muted">~{Math.round(legStats.estimatedTimeMin)} min</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="ml-3 sm:ml-4 p-2 sm:p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl sm:rounded-2xl group-hover:bg-brand-primary transition-all shadow-sm group-hover:shadow-brand-primary/30 border border-transparent">
                                                                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted group-hover:text-white" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}
                        </ErrorBoundary>
                    )}
                </div>
            )}
        </div>
    );
};

export default RouteSequence;
