import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Customer, ViewMode, CompanySettings, UserRole } from '../../../types';
import { Search, MapPin, Hash, Calendar, Navigation, Globe, Inbox, Filter, ChevronLeft, UserPlus, ArrowUpDown, ChevronDown, AlertTriangle, CheckCircle2, Radar, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { fetchCustomers, fetchCustomerRegions } from '../../../services/supabase';

interface CustomersProps {
    companyId?: string;
    isDarkMode: boolean;
    language: 'en' | 'ar';
    userRole?: string;      // NEW: User's role for access control
    userBranchIds?: string[]; // NEW: User's assigned branches for filtering
    onNavigate: (view: string) => void;
    hideHeader?: boolean;
    onUpdateCustomer?: (customer: Customer) => void;
    onUpload?: () => void;
    companySettings?: CompanySettings;
    isLoading?: boolean; // Initial Loading (Legacy) - can ignore or use for global sync
}

const Customers: React.FC<CustomersProps> = ({
    companyId,
    isDarkMode,
    language,
    onNavigate,
    hideHeader,
    onUpdateCustomer,
    onUpload,
    companySettings,
    isLoading: isGlobalLoading = false,
    userRole,
    userBranchIds
}) => {
    // Determine if user should see all data (admin/manager) or filtered by branches
    const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'SYSADMIN';
    const effectiveBranchIds = isAdmin ? undefined : userBranchIds;

    // DEBUG: Log branch filtering values
    console.log('[Customers] Branch Filter Debug:', {
        companyId,
        userRole,
        userBranchIds,
        isAdmin,
        effectiveBranchIds
    });

    // Server-Side State
    const [data, setData] = useState<Customer[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [totalDatabaseCount, setTotalDatabaseCount] = useState(0);
    const [isFetching, setIsFetching] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [filterRegion, setFilterRegion] = useState('All');
    const [filterAlert, setFilterAlert] = useState('All'); // 'All', 'Missing GPS'
    const [filterSource, setFilterSource] = useState('All'); // 'All', 'Scanner'
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const [regions, setRegions] = useState<string[]>([]);

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Customer | 'status', direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(50);

    // Fetch Regions & Total Count on Mount
    useEffect(() => {
        if (companyId) {
            fetchCustomerRegions(companyId).then(setRegions);
            // Fetch total count (filtered by user's branches if not admin)
            fetchCustomers(companyId, 0, 1, {}, 'name', true, effectiveBranchIds).then(res => {
                setTotalDatabaseCount(res.count);
            });
        }
    }, [companyId, effectiveBranchIds]);

    // Debounce Search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Reset page on search
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch Data
    const loadCustomers = useCallback(async () => {
        if (!companyId) return;

        setIsFetching(true);
        try {
            const filters = {
                search: debouncedSearch,
                region: filterRegion,
                alert: filterAlert,
                source: filterSource
            };

            const result = await fetchCustomers(
                companyId,
                currentPage - 1, // API is 0-indexed
                itemsPerPage,
                filters,
                sortConfig.key as string,
                sortConfig.direction === 'asc',
                effectiveBranchIds // Pass branch restriction for non-admin users
            );

            setData(result.data);
            setTotalItems(result.count);
        } catch (err) {
            console.error("Failed to load customers", err);
        } finally {
            setIsFetching(false);
        }
    }, [companyId, currentPage, itemsPerPage, debouncedSearch, filterRegion, filterAlert, filterSource, sortConfig, effectiveBranchIds]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    // Editing Logic
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Customer>>({});

    const handleStartEdit = (customer: Customer) => {
        setEditingId(customer.rowId || customer.id);
        setEditForm({ ...customer });
    };

    const handleSave = async (original: Customer) => {
        if (onUpdateCustomer && editForm) {
            const updated = { ...original, ...editForm };
            await onUpdateCustomer(updated);
            setEditingId(null);
            setEditForm({});
            // Refresh data after update (optimistic update would be better but simple refresh is safer)
            loadCustomers();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, customer: Customer) => {
        if (e.key === 'Enter') handleSave(customer);
        else if (e.key === 'Escape') {
            setEditingId(null);
            setEditForm({});
        }
    };

    const handleChange = (field: keyof Customer, value: any) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSort = (key: keyof Customer) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Render Helpers
    const renderCell = (customer: Customer, field: keyof Customer, width: string = 'w-32', placeholder: string = '') => {
        const isEditing = editingId === (customer.rowId || customer.id);
        const value = isEditing ? (editForm[field] !== undefined ? editForm[field] : customer[field]) : customer[field];

        if (isEditing) {
            return (
                <input
                    autoFocus={field === 'name'}
                    type="text"
                    className={`w-full bg-slate-100 dark:bg-slate-700 border-indigo-500/50 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500 ${width}`}
                    defaultValue={(value as string | number) || ''}
                    placeholder={placeholder}
                    onChange={(e) => {
                        // Debounce the state update slightly to avoid freezing on fast typing, 
                        // or just rely on uncontrolled behavior until save.
                        handleChange(field, e.target.value);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, customer)}
                />
            );
        }
        return <div className={`truncate ${width}`} title={String(value || '')}>{typeof value === 'object' ? JSON.stringify(value) : (value || <span className="text-slate-400 italic">Empty</span>)}</div>;
    };

    const isEmpty = totalItems === 0 && !isFetching && !debouncedSearch && filterRegion === 'All' && filterAlert === 'All';

    if (isEmpty && !isGlobalLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                    <Inbox className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="2xl font-black text-slate-800 dark:text-white mb-2">No Customers Found</h2>
                <div className="flex gap-4 mt-8">
                    {onUpload && (<button onClick={onUpload} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold">Upload Data</button>)}
                </div>
            </div>
        );
    }

    const hasNoAccess = !isAdmin && (!userBranchIds || userBranchIds.length === 0);

    if (hasNoAccess) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 bg-slate-50 dark:bg-[#0f172a]">
                <div className="w-24 h-24 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-6 ring-1 ring-rose-500/20 shadow-2xl">
                    <AlertTriangle className="w-10 h-10 text-rose-600 dark:text-rose-400" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Access Restricted</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Contact your system administrator to get branches assigned to your account. You currently do not have access to view any customer data.
                </p>
                <div className="mt-8">
                    <button onClick={() => onNavigate(ViewMode.DASHBOARD)} className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className={`h-full flex flex-col ${isDarkMode ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
            {!hideHeader && (
                <div className="shrink-0 p-6 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button title="Go Back" onClick={() => onNavigate(ViewMode.DASHBOARD)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                            <ChevronLeft className="w-5 h-5 text-slate-500" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-black text-slate-900 dark:text-white">Customer Database</h1>
                                <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {totalItems !== totalDatabaseCount ? `${totalItems.toLocaleString()} / ` : ''}{totalDatabaseCount.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Distinct Records</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isFetching && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                                        <Loader2 className="w-2.5 h-2.5 text-indigo-500 animate-spin" />
                                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter">Loading...</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center gap-3">
                        {/* Actions moved to filter bar */}
                    </div>
                </div>
            )}

            {/* Action Bar */}
            <div className={`shrink-0 px-6 py-3 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'} flex flex-col gap-4`}>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, code, or address... (Enter to search)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'} text-xs focus:ring-2 focus:ring-indigo-500`}
                        />
                    </div>

                    {/* Filters Toggle & Active Filters Display */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            className={`p-2 rounded-lg border transition-colors flex items-center gap-2 ${isFiltersOpen
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                                }`}
                            title="Toggle Filters"
                        >
                            <Filter className="w-4 h-4" />
                            <span className="text-xs font-bold">Filters</span>
                            {(filterRegion !== 'All' || filterAlert !== 'All' || filterSource !== 'All') && (
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                            )}
                            <ChevronDown className={`w-3 h-3 transition-transform ${isFiltersOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Pagination Controls */}
                        <div className="flex gap-1 items-center ml-auto">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1 || isFetching}
                                className="px-2 py-2 rounded border bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                title="Previous Page"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <span className="flex items-center justify-center px-3 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border dark:border-slate-700 min-w-[80px]">
                                {currentPage} / {totalPages || 1}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage >= totalPages || isFetching}
                                className="px-2 py-2 rounded border bg-white dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                title="Next Page"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Page Size */}
                        <select
                            title="Items per page"
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                        >
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                            <option value={200}>200 / page</option>
                        </select>
                    </div>

                    {/* Collapsible Filters */}
                    {isFiltersOpen && (
                        <div className="flex items-center gap-2 w-full overflow-x-auto p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg animate-in slide-in-from-top-2 duration-200">
                            <select
                                title="Filter by Region"
                                value={filterRegion}
                                onChange={(e) => setFilterRegion(e.target.value)}
                                className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg border text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                            >
                                <option value="All">All Regions</option>
                                {regions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>

                            <select
                                title="Filter by Status"
                                value={filterAlert}
                                onChange={(e) => setFilterAlert(e.target.value)}
                                className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg border text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                            >
                                <option value="All">All Statuses</option>
                                <option value="Missing GPS">⚠️ Missing GPS</option>
                                <option value="Nearby" disabled>🎯 Nearby Branch (N/A)</option>
                            </select>

                            {/* Source Filter */}
                            <select
                                title="Filter by Source"
                                value={filterSource}
                                onChange={(e) => setFilterSource(e.target.value)}
                                className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg border text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-700'} ${filterSource === 'Scanner' ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}
                            >
                                <option value="All">All Sources</option>
                                <option value="Scanner">📡 From Scanner</option>
                            </select>

                            <button
                                onClick={() => {
                                    setFilterRegion('All');
                                    setFilterAlert('All');
                                    setFilterSource('All');
                                }}
                                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                            >
                                Reset Filters
                            </button>
                        </div>
                    )}



                    {/* Upload Action (Moved here) */}
                    {onUpload && (
                        <div className="pl-4 md:border-l border-slate-200 dark:border-slate-700 ml-auto md:ml-0">
                            <button
                                onClick={onUpload}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm shadow-indigo-500/20 whitespace-nowrap"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Upload Data</span>
                                <span className="md:hidden">Upload</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 px-4 pb-4 relative">
                {isFetching && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-20 flex items-center justify-center rounded-xl">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                )}

                <div className={`w-full h-full overflow-auto custom-scrollbar rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <table className="min-w-max w-full text-left text-xs">
                        <thead className={`${isDarkMode ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-50 text-slate-500'} font-bold uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md`}>
                            <tr>
                                {[
                                    { label: 'Code', key: 'clientCode', width: 'w-24' },
                                    { label: 'Name', key: 'name', width: 'w-48' },
                                    { label: 'Name (AR)', key: 'nameAr', width: 'w-32' },
                                    { label: 'Branch', key: 'branch', width: 'w-32' },
                                    { label: 'Phone', key: 'phone', width: 'w-32' },
                                    { label: 'Address', key: 'address', width: 'w-64' },
                                    { label: 'District', key: 'district', width: 'w-32' },
                                    { label: 'VAT', key: 'vat', width: 'w-32' },
                                    { label: 'Buyer ID', key: 'buyerId', width: 'w-32' },
                                    { label: 'Class', key: 'classification', width: 'w-24' },
                                    { label: 'Type', key: 'storeType', width: 'w-24' },
                                    { label: 'GPS', key: 'lat', width: 'w-32' },
                                    { label: 'Region', key: 'regionDescription', width: 'w-32' },
                                    { label: 'Reg. Code', key: 'regionCode', width: 'w-24' },
                                    { label: 'Route', key: 'routeName', width: 'w-32' },
                                    { label: 'Reach Code', key: 'reachCustomerCode', width: 'w-32' },
                                    { label: 'Day', key: 'day', width: 'w-24' },
                                    { label: 'Week', key: 'week', width: 'w-24' },
                                    { label: 'Added By', key: 'addedBy', width: 'w-32' },
                                    { label: 'Date', key: 'addedDate', width: 'w-32' },
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        className={`px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors select-none ${col.width}`}
                                        onClick={() => handleSort(col.key as keyof Customer)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            <ArrowUpDown className={`w-3 h-3 ${sortConfig?.key === col.key ? 'text-indigo-500 opacity-100' : 'opacity-30'}`} />
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-right sticky right-0 bg-inherit shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)]">Action</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                            {data.map((customer, idx) => {
                                const isMissingGps = !customer.lat || !customer.lng || (customer.lat === 0 && customer.lng === 0);
                                return (
                                    <tr
                                        key={customer.rowId || customer.id || `${idx}-${currentPage}`}
                                        className={`
                                        group transition-colors 
                                        ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'} 
                                        ${editingId === (customer.rowId || customer.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}
                                        ${isMissingGps ? 'bg-rose-500/5 hover:bg-rose-500/10' : ''}
                                    `}
                                        onClick={() => onUpdateCustomer && handleStartEdit(customer)}
                                    >
                                        <td className="px-4 py-2 font-mono text-slate-500">
                                            <div className="flex items-center gap-2" title={isMissingGps ? "Missing GPS Coordinates" : ""}>
                                                {isMissingGps && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                                                {renderCell(customer, 'clientCode', 'w-20', 'Generate')}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 font-medium text-slate-200">
                                            {renderCell(customer, 'name', 'w-48', 'Name')}
                                        </td>
                                        <td className="px-4 py-2 font-medium font-arabic text-slate-400">
                                            {renderCell(customer, 'nameAr', 'w-32', 'اسم العميل')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'branch', 'w-32', 'Branch')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'phone', 'w-32', 'Phone')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'address', 'w-64', 'Address')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'district', 'w-32', 'District')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'vat', 'w-32', 'VAT')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'buyerId', 'w-32', 'Buyer ID')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'classification', 'w-24', 'Class')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'storeType', 'w-24', 'Type')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {isMissingGps ? (
                                                <span className="text-[10px] text-rose-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> Missing</span>
                                            ) : (
                                                <div className="flex gap-2 text-[10px] font-mono">
                                                    <span>{Number(customer.lat).toFixed(4)}</span>
                                                    <span className="opacity-50">,</span>
                                                    <span>{Number(customer.lng).toFixed(4)}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            {renderCell(customer, 'regionDescription', 'w-24', 'Region')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                            {renderCell(customer, 'regionCode', 'w-20', 'Code')}
                                        </td>
                                        <td className="px-4 py-2">
                                            {renderCell(customer, 'routeName', 'w-24', 'Route')}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-pink-400 text-[10px]">
                                            {customer.reachCustomerCode || '-'}
                                        </td>
                                        <td className="px-4 py-2">
                                            {renderCell(customer, 'day', 'w-24', 'Day')}
                                        </td>
                                        <td className="px-4 py-2">
                                            {renderCell(customer, 'week', 'w-24', 'Week')}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500 text-[10px]">
                                            {customer.addedBy || '-'}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500 text-[10px] whitespace-nowrap">
                                            {customer.addedDate ? new Date(customer.addedDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right sticky right-0 bg-inherit shadow- [-10px_0_10px_-10px_rgba(0,0,0,0.1)]">
                                            {editingId === (customer.rowId || customer.id) ? (
                                                <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded cursor-pointer hover:bg-emerald-500/20" onClick={(e) => { e.stopPropagation(); handleSave(customer); }}>Save</span>
                                            ) : (
                                                <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div >
    );
};

export default Customers;
