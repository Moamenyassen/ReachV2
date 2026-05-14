// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Filter, Sparkles, ChevronDown, Check, X, Search, Loader2, SlidersHorizontal, RotateCcw, Calendar, Users } from 'lucide-react';
import { fetchOptimizationSuggestions, fetchOptimizationFilters, OptimizationSuggestion } from '../../../services/clientOptimizer';
import OptimizerHeader from './OptimizerHeader';
import OptimizerCard from './OptimizerCard';
import OptimizerMap from './OptimizerMap';
import ImpactPanel from './ImpactPanel';

interface OptimizerLayoutProps {
    onBack?: () => void;
    companyId?: string;
    userBranchIds?: string[];
    userRole?: string;
}

// Priority filter tabs
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';
type SwapTypeFilter = 'all' | 'USER_SWAP' | 'DAY_SWAP';

const OptimizerLayout: React.FC<OptimizerLayoutProps> = ({ onBack, companyId, userBranchIds, userRole }) => {
    // Data state
    const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
    const [stats, setStats] = useState({ distance: 0, time: 0, optimizations: 0 });

    // Filter state
    const [branches, setBranches] = useState<{ code: string; name: string }[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [availableRoutes, setAvailableRoutes] = useState<string[]>([]);
    const [routeDetails, setRouteDetails] = useState<{ name: string; branch: string }[]>([]);
    const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
    const [isRouteMenuOpen, setIsRouteMenuOpen] = useState(false);

    // Local filters
    const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
    const [swapTypeFilter, setSwapTypeFilter] = useState<SwapTypeFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Derived state for routes based on selected branch
    const filteredRouteOptions = useMemo(() => {
        if (!selectedBranch || selectedBranch === '' || selectedBranch === 'All Branches') {
            return availableRoutes;
        }
        const branchRoutes = new Set(
            routeDetails
                .filter(r => r.branch === selectedBranch)
                .map(r => r.name)
        );
        return Array.from(branchRoutes).sort();
    }, [selectedBranch, availableRoutes, routeDetails]);

    // Filter suggestions based on local filters
    const filteredSuggestions = useMemo(() => {
        return suggestions.filter(s => {
            // Priority filter
            if (priorityFilter !== 'all') {
                const score = s.impactScore;
                if (priorityFilter === 'high' && score < 70) return false;
                if (priorityFilter === 'medium' && (score < 40 || score >= 70)) return false;
                if (priorityFilter === 'low' && score >= 40) return false;
            }

            // Swap type filter
            if (swapTypeFilter !== 'all' && s.type !== swapTypeFilter) return false;

            // Search query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = s.clientName?.toLowerCase().includes(query);
                const matchesCode = s.clientCode?.toLowerCase().includes(query);
                const matchesDistrict = s.district?.toLowerCase().includes(query);
                if (!matchesName && !matchesCode && !matchesDistrict) return false;
            }

            return true;
        });
    }, [suggestions, priorityFilter, swapTypeFilter, searchQuery]);

    // Calculate average confidence
    const avgConfidence = useMemo(() => {
        if (suggestions.length === 0) return 0;
        const total = suggestions.reduce((sum, s) => sum + s.confidence, 0);
        return Math.round(total / suggestions.length);
    }, [suggestions]);

    const toggleRoute = (route: string) => {
        setSelectedRoutes(prev =>
            prev.includes(route)
                ? prev.filter(r => r !== route)
                : [...prev, route]
        );
    };

    useEffect(() => {
        loadFilters();
    }, []);

    // Reload data when filter changes
    useEffect(() => {
        if (selectedBranch && selectedBranch !== 'All Branches') {
            const validRoutes = new Set(
                routeDetails
                    .filter(r => r.branch === selectedBranch)
                    .map(r => r.name)
            );
            const isValid = selectedRoutes.every(r => validRoutes.has(r));
            if (!isValid) {
                setSelectedRoutes([]);
            }
        }
        if (selectedBranch) {
            loadData();
        } else {
            setSuggestions([]);
            setStats({ distance: 0, time: 0, optimizations: 0 });
        }
    }, [selectedBranch, selectedRoutes]);

    const loadFilters = async () => {
        if (!companyId) return;
        const allowedBranches = userRole === 'ADMIN' || userRole === 'sys_admin' ? undefined : userBranchIds;
        const { branches, routes, routeDetails } = await fetchOptimizationFilters(companyId, allowedBranches);
        setBranches(branches);
        setAvailableRoutes(routes || []);
        if (routeDetails) {
            setRouteDetails(routeDetails);
        }
    };

    const loadData = async () => {
        setLoading(true);
        if (!companyId) return;

        const allowedBranchNames = userRole === 'ADMIN' || userRole === 'sys_admin' ? undefined : userBranchIds;
        let allowedBranchCodes: string[] | undefined = undefined;
        if (allowedBranchNames && branches.length > 0) {
            allowedBranchCodes = branches
                .filter(b => allowedBranchNames.includes(b.name))
                .map(b => b.code);
        }

        const selectedBranchCode = branches.find(b => b.name === selectedBranch)?.code;

        const result = await fetchOptimizationSuggestions(
            companyId,
            {
                branch_code: selectedBranch === 'All Branches' ? undefined : selectedBranchCode,
                routes: selectedRoutes.length > 0 ? selectedRoutes : undefined
            },
            allowedBranchCodes
        );

        if (result.success) {
            setSuggestions(result.suggestions);
            setStats(result.totalSavings);
        }
        setLoading(false);
    };

    const selectedSuggestion = suggestions.find(s => s.id === selectedSuggestionId) || null;

    const handleAutoOptimize = () => {
        console.log('Auto-optimize triggered');
        // TODO: Implement batch optimization
    };

    const handleApply = (suggestionId?: string) => {
        const id = suggestionId || selectedSuggestionId;
        console.log('Apply optimization:', id);
        // TODO: Implement apply logic
    };

    const handleDismiss = (suggestionId: string) => {
        console.log('Dismiss suggestion:', suggestionId);
        setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
        if (selectedSuggestionId === suggestionId) {
            setSelectedSuggestionId(null);
        }
    };

    const resetFilters = () => {
        setPriorityFilter('all');
        setSwapTypeFilter('all');
        setSearchQuery('');
    };

    const hasActiveFilters = priorityFilter !== 'all' || swapTypeFilter !== 'all' || searchQuery !== '';

    // Priority filter counts
    const priorityCounts = useMemo(() => {
        return {
            high: suggestions.filter(s => s.impactScore >= 70).length,
            medium: suggestions.filter(s => s.impactScore >= 40 && s.impactScore < 70).length,
            low: suggestions.filter(s => s.impactScore < 40).length
        };
    }, [suggestions]);

    return (
        <div className="h-full flex flex-col bg-[#0a0b0f] text-white overflow-hidden">
            {/* Header */}
            <OptimizerHeader
                stats={stats}
                avgConfidence={avgConfidence}
                onAutoOptimize={handleAutoOptimize}
                onRefresh={loadData}
                loading={loading}
            />

            {/* Filter Bar */}
            <div className="h-14 border-b border-white/5 bg-[#0d0e14] flex items-center px-6 gap-4 shrink-0 z-30 relative overflow-visible">
                <div className="flex items-center gap-2 text-gray-500">
                    <SlidersHorizontal size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Filters</span>
                </div>

                <div className="w-px h-5 bg-white/10" />

                {/* Branch Filter */}
                <select
                    className="bg-white/5 border border-white/10 text-xs font-medium text-gray-300 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all min-w-[140px]"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                        <option key={b.code} value={b.name} className="bg-[#1a1b26] text-white">{b.name}</option>
                    ))}
                </select>

                {/* Route Multi-Select */}
                <div className="relative">
                    <button
                        onClick={() => setIsRouteMenuOpen(!isRouteMenuOpen)}
                        className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all
                            ${selectedRoutes.length > 0
                                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                    >
                        <span>{selectedRoutes.length > 0 ? `${selectedRoutes.length} Routes` : 'All Routes'}</span>
                        <ChevronDown size={12} className={`transition-transform ${isRouteMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isRouteMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsRouteMenuOpen(false)} />
                            <div className="absolute top-full mt-2 left-0 w-64 max-h-[350px] overflow-y-auto bg-[#171a26] border border-white/10 rounded-xl shadow-2xl z-50">
                                <div className="p-3 border-b border-white/5 bg-black/20 sticky top-0 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Routes</span>
                                    <div className="flex gap-3">
                                        {selectedRoutes.length < filteredRouteOptions.length && (
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedRoutes(filteredRouteOptions); }} className="text-[10px] text-indigo-400 hover:text-indigo-300">
                                                Select All
                                            </button>
                                        )}
                                        {selectedRoutes.length > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedRoutes([]); }} className="text-[10px] text-red-400 hover:text-red-300">
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="p-2">
                                    {filteredRouteOptions.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-gray-500">No routes found</div>
                                    ) : (
                                        filteredRouteOptions.map(route => (
                                            <div
                                                key={route}
                                                onClick={(e) => { e.stopPropagation(); toggleRoute(route); }}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors
                                                    ${selectedRoutes.includes(route) ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-gray-300'}`}
                                            >
                                                <span className="text-xs font-mono">{route}</span>
                                                {selectedRoutes.includes(route) && <Check size={12} className="text-indigo-400" />}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="w-px h-5 bg-white/10" />

                {/* Swap Type Filter */}
                <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10">
                    <button
                        onClick={() => setSwapTypeFilter('all')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${swapTypeFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setSwapTypeFilter('USER_SWAP')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${swapTypeFilter === 'USER_SWAP' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Users size={10} /> User
                    </button>
                    <button
                        onClick={() => setSwapTypeFilter('DAY_SWAP')}
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${swapTypeFilter === 'DAY_SWAP' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Calendar size={10} /> Day
                    </button>
                </div>

                {/* Active filters indicator & reset */}
                {hasActiveFilters && (
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                    >
                        <RotateCcw size={10} />
                        Reset
                    </button>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Results count */}
                <span className="text-[10px] text-gray-500">
                    Showing <strong className="text-gray-300">{filteredSuggestions.length}</strong> of {suggestions.length}
                </span>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL - Opportunities List */}
                <div className="w-[32%] border-r border-white/5 flex flex-col bg-[#0c0d12]">
                    {/* Panel Header with Priority Tabs */}
                    <div className="p-4 border-b border-white/5 bg-black/20">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                Opportunities
                            </h2>
                            {/* Search */}
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-black/40 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs w-36 focus:border-indigo-500 outline-none transition-colors"
                                />
                            </div>
                        </div>

                        {/* Priority Tabs */}
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPriorityFilter('all')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${priorityFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}
                            >
                                All ({suggestions.length})
                            </button>
                            <button
                                onClick={() => setPriorityFilter('high')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${priorityFilter === 'high' ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:bg-white/5'}`}
                            >
                                🔴 High ({priorityCounts.high})
                            </button>
                            <button
                                onClick={() => setPriorityFilter('medium')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${priorityFilter === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:bg-white/5'}`}
                            >
                                🟡 Med ({priorityCounts.medium})
                            </button>
                            <button
                                onClick={() => setPriorityFilter('low')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${priorityFilter === 'low' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:bg-white/5'}`}
                            >
                                🟢 Low ({priorityCounts.low})
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Cards */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-indigo-400 gap-3">
                                <Loader2 className="animate-spin w-8 h-8" />
                                <span className="text-xs font-mono animate-pulse">Analyzing Route Network...</span>
                            </div>
                        ) : filteredSuggestions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2 py-20">
                                <Search className="w-10 h-10 opacity-20" />
                                <span className="text-sm font-medium">
                                    {!selectedBranch ? 'Select a Branch to start' : hasActiveFilters ? 'No matches for current filters' : 'No optimizations found'}
                                </span>
                                {hasActiveFilters && (
                                    <button
                                        onClick={resetFilters}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-2"
                                    >
                                        Reset Filters
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredSuggestions.map((s, idx) => (
                                <OptimizerCard
                                    key={s.id}
                                    suggestion={s}
                                    index={idx}
                                    isSelected={selectedSuggestionId === s.id}
                                    isExpanded={selectedSuggestionId === s.id}
                                    onClick={() => setSelectedSuggestionId(s.id === selectedSuggestionId ? null : s.id)}
                                    onApply={() => handleApply(s.id)}
                                    onDismiss={() => handleDismiss(s.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* CENTER PANEL - Map */}
                <div className="w-[43%] bg-[#05060a] relative">
                    <OptimizerMap
                        suggestions={filteredSuggestions}
                        selectedSuggestion={selectedSuggestion}
                        onSelectSuggestion={(id) => setSelectedSuggestionId(id)}
                    />
                </div>

                {/* RIGHT PANEL - Impact Analysis */}
                <div className="w-[25%] bg-[#0c0d12] border-l border-white/5">
                    <ImpactPanel
                        suggestion={selectedSuggestion}
                        onApply={() => handleApply()}
                    />
                </div>
            </div>

            {/* Custom scrollbar styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    );
};

export default OptimizerLayout;
