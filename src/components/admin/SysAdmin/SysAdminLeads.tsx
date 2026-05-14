import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    getGlobalReachLeads,
    addGlobalReachLead,
    upsertGlobalReachLeads,
    deleteGlobalReachLead,
    deleteAllGlobalReachLeads,
    checkGlobalLeadsDuplicates,
    getGlobalDistinctRegions,
    getGlobalDistinctStatuses,
    getAllGlobalReachLeads,
    getGlobalDistinctValues
} from '../../../services/supabase';
import {
    Plus,
    Users,
    Loader2,
    MapPin,
    Globe,
    Building2,
    Search,
    Upload,
    X,
    Download,
    ChevronLeft,
    ChevronRight,
    Filter,
    Navigation,
    Map,
    Eye,
    Settings,
    MoreHorizontal,
    ArrowUpDown,
    CheckCircle2,
    Edit2,
    Clock,
    Layout,
    Sparkles,
    AlertCircle,
    Trash2
} from 'lucide-react';
import Papa from 'papaparse';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    ColumnDef,
    flexRender,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import DataOptimizerModal from '../../features/Optimizer/DataOptimizerModal';
import SysAdminUploadModal from './SysAdminUploadModal';
import SysAdminCompanyImportModal from './SysAdminCompanyImportModal';
import SysAdminDuplicateModal from './SysAdminDuplicateModal';
import DataCleaningWorkbench from '../../DataCleaningWorkbench';
import { ConfirmModal, PageHeader } from './SysAdminShared';

const SysAdminLeads: React.FC = () => {
    // Data State
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize, setPageSize] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [availableRegions, setAvailableRegions] = useState<string[]>([]);
    const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

    // Worker State
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleaningProgress, setCleaningProgress] = useState(0);
    const [cleaningReport, setCleaningReport] = useState<any>(null);
    const [allLeadsForCleaning, setAllLeadsForCleaning] = useState<any[]>([]);
    const [showReportModal, setShowReportModal] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    // Actions State
    const [clearConfirmation, setClearConfirmation] = useState(false);
    const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState(false);

    // Table States
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('sysadmin_leads_grid_visibility');
                return saved ? JSON.parse(saved) : {};
            } catch (e) {
                console.error("Failed to parse saved visibility", e);
            }
        }
        return {};
    });
    const [rowSelection, setRowSelection] = useState({});

    // Persist Column Visibility
    useEffect(() => {
        localStorage.setItem('sysadmin_leads_grid_visibility', JSON.stringify(columnVisibility));
    }, [columnVisibility]);
    const [globalSearch, setGlobalSearch] = useState('');

    // Modal / Creation States
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isCompanyImportOpen, setIsCompanyImportOpen] = useState(false);
    const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [duplicates, setDuplicates] = useState<any[][]>([]);
    const [editingLead, setEditingLead] = useState<any>(null); // New state for editing
    const [showColumnManager, setShowColumnManager] = useState(false);
    const [newLeadForm, setNewLeadForm] = useState({
        name: '',
        name_ar: '',
        address: '',
        lat: '',
        lng: '',
        region_description: '',
        source_company_id: 'MANUAL_ENTRY'
    });
    const [creatingLead, setCreatingLead] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Virtualization Refs
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const handleFullClean = async () => {
        setIsCleaning(true);
        setCleaningProgress(10); // Start

        try {
            // 1. Fetch All Data
            const allData = await getAllGlobalReachLeads();
            setAllLeadsForCleaning(allData);
            setCleaningProgress(30); // Data Loaded

            // 2. Initialize Worker
            if (!workerRef.current) {
                // Ensure the path is correct relative to the component
                workerRef.current = new Worker(new URL('../../../workers/cleaning.worker.ts', import.meta.url), { type: 'module' });
            }

            // 3. Set up listener
            workerRef.current.onmessage = (e) => {
                const msg = e.data;

                if (msg.type === 'PROGRESS') {
                    // Update progress bar (scale from 30% to 90%)
                    const p = 30 + Math.floor(msg.progress * 0.6);
                    setCleaningProgress(p);
                } else if (msg.type === 'COMPLETE' || msg.stats) {
                    // Handle completion (support both new and legacy format just in case)
                    const report = msg.report || msg;
                    setCleaningReport(report);
                    setIsCleaning(false);
                    setShowReportModal(true);
                    setCleaningProgress(100);
                }
            };

            // 4. Send Data
            workerRef.current.postMessage({ type: 'START_CLEANING', data: allData });
            setCleaningProgress(30); // Processing started

        } catch (e) {
            console.error(e);
            setIsCleaning(false);
            setNotification({ message: 'Cleaning failed. Check console for details.', type: 'error' });
        }
    };

    // Load Leads
    const loadLeadsData = useCallback(async () => {
        setLoading(true);
        try {
            // Map TanStack filters to our API filters
            const filters: any = {
                search: globalSearch
            };

            // Explicit mappings
            const sourceFilter = columnFilters.find(f => f.id === 'source_company_id')?.value as string;
            if (sourceFilter && sourceFilter !== 'ALL') filters.source = sourceFilter;

            const statusFilter = columnFilters.find(f => f.id === 'status')?.value as string;
            if (statusFilter && statusFilter !== 'ALL') filters.status = statusFilter;

            const regionFilter = columnFilters.find(f => f.id === 'region_description')?.value as string;
            if (regionFilter && regionFilter !== 'ALL') filters.region = regionFilter;

            // Generic mapping for other columns (name, address, etc.)
            columnFilters.forEach(f => {
                if (['source_company_id', 'status', 'region_description'].includes(f.id)) return;
                // Avoid "ALL" if it leaks in, though usually it's specific dropdowns that use ALL.
                if (f.value && f.value !== 'ALL') {
                    filters[f.id] = f.value;
                }
            });

            // Sorting
            const currentSort = sorting && sorting.length > 0 ? sorting[0] : { id: 'created_at', desc: true };
            const sortBy = currentSort.id;
            const sortOrder = currentSort.desc ? 'desc' : 'asc';

            // Note: In a full implementation, we would send all columnFilters and sorting to the server
            const { data, count } = await getGlobalReachLeads(currentPage, pageSize, filters, sortBy, sortOrder);
            setLeads(data || []);
            setTotalCount(count || 0);
        } catch (e) {
            console.error("Failed to load global leads", e);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, globalSearch, columnFilters, sorting]);



    // Dynamic Filter Options Map
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({});

    useEffect(() => {
        loadLeadsData();
        // Load distinct regions and statuses on mount
        getGlobalDistinctRegions().then(setAvailableRegions).catch(console.error);
        getGlobalDistinctStatuses().then(setAvailableStatuses).catch(console.error);

        // Load distinct values for specific dynamic fields as requested
        const targetFields = [
            'channel_band',
            'outlet_type',
            'store_segmentation',
            'store_city_location',
            'store_location_city'
        ];

        const loadDynamicOptions = async () => {
            const options: Record<string, string[]> = {};
            for (const field of targetFields) {
                try {
                    const values = await getGlobalDistinctValues(field, true);
                    if (values.length > 0) {
                        options[`dyn_${field}`] = values;
                        options[field] = values;
                    }
                } catch (e) {
                    console.warn(`Failed to load options for ${field}`, e);
                }
            }
            setDynamicOptions(prev => ({ ...prev, ...options }));
        };
        loadDynamicOptions();
    }, [loadLeadsData]);

    const handleClearAll = async () => {
        try {
            await deleteAllGlobalReachLeads();
            setLeads([]);
            setTotalCount(0);
            setNotification({ message: 'Global Registry Wiped Successfully', type: 'success' });
            setClearConfirmation(false);
        } catch (e) {
            console.error(e);
            setNotification({ message: 'Failed to wipe data', type: 'error' });
        }
    };

    const handleDeleteLead = async (id: string) => {
        try {
            await deleteGlobalReachLead(id);
            setLeads(prev => prev.filter(l => l.id !== id));
            setTotalCount(prev => prev - 1);
            setNotification({ message: 'Lead successfully deleted', type: 'success' });
            setDeleteConfirmation(false);
            setSingleDeleteId(null);
        } catch (e) {
            console.error("Delete failed", e);
            setNotification({ message: 'Failed to delete lead', type: 'error' });
        }
    };

    // Helpers
    const getSourceLabel = (sourceId: string) => {
        if (sourceId === 'MANUAL_ENTRY' || sourceId === 'MANUAL') return { text: 'Manual', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
        if (sourceId === 'SCANNER' || sourceId === 'MARKET_SCANNER') return { text: 'Scanner', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
        return { text: 'Uploaded', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    };

    const openNavigation = (lat: number, lng: number) => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    };

    // Columns Definition
    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500"
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500"
                />
            ),
            size: 40,
        },
        {
            id: 'row_number',
            header: '#',
            cell: ({ row }) => (
                <span className="text-[10px] text-slate-500 font-mono">
                    {(currentPage - 1) * pageSize + row.index + 1}
                </span>
            ),
            size: 50,
        },
        {
            accessorKey: 'id',
            header: 'ID',
            cell: info => <span className="font-mono text-[10px] text-slate-500">{(info.getValue() as string).split('-')[0]}</span>,
            size: 80,
        },
        {
            accessorKey: 'source_company_id',
            header: 'Source',
            cell: ({ getValue }) => {
                const source = getValue() as string;
                let label = source;
                let colorClass = 'text-slate-400';

                if (source === 'MANUAL_ENTRY' || source === 'MANUAL') { label = 'Manual Entry'; colorClass = 'text-blue-400'; }
                else if (source === 'SCANNER' || source === 'MARKET_SCANNER') { label = 'Scanner'; colorClass = 'text-purple-400'; }
                else if (source === 'UPLOADED') { label = 'CSV Upload'; colorClass = 'text-emerald-400'; }
                else {
                    // If it's a UUID or company ID, it's fetched from a CRM
                    label = 'FETCHED (CRM)';
                    colorClass = 'text-amber-400';
                }

                return (
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${colorClass}`}>{label}</span>
                        {/* Show specific source ID in smaller text if it's external */}
                        {!['MANUAL', 'SCANNER', 'UPLOADED'].includes(label) && source !== 'MANUAL_ENTRY' && source !== 'MARKET_SCANNER' && (
                            <span className="text-[8px] text-slate-600 font-mono truncate max-w-[100px]" title={source}>{source.split('-')[0]}...</span>
                        )}
                    </div>
                );
            },
            size: 120,
        },
        {
            accessorKey: 'name',
            header: 'Business Name (EN)',
            cell: info => <span className="font-bold text-white group-hover:text-indigo-400 transition-colors">{info.getValue() as string}</span>,
            size: 200,
        },
        {
            accessorKey: 'name_ar',
            header: 'Business Name (AR)',
            cell: info => <span className="text-slate-400 font-medium" dir="rtl">{info.getValue() as string || '-'}</span>,
            size: 150,
        },
        {
            accessorKey: 'region_description',
            header: 'Region / City',
            cell: info => (
                <div className="flex items-center gap-2 text-slate-300">
                    <Building2 className="w-3 h-3 text-slate-600" />
                    {info.getValue() as string || 'Global Registry'}
                </div>
            ),
            size: 150,
        },
        {
            accessorKey: 'address',
            header: 'Full Address',
            cell: info => <span className="text-[10px] text-slate-500 truncate max-w-[150px]" title={info.getValue() as string}>{info.getValue() as string}</span>,
            size: 150,
        },
        {
            accessorKey: 'customer_address',
            header: 'Clean Address',
            cell: info => <span className="text-[10px] text-emerald-400 font-medium truncate max-w-[150px]" title={info.getValue() as string}>{info.getValue() as string || '-'}</span>,
            size: 150,
        },
        {
            id: 'coordinates',
            header: 'Coordinates',
            accessorFn: row => `${row.lat}, ${row.lng}`,
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px]">
                    <MapPin className="w-3 h-3 text-indigo-500/50" />
                    {row.original.lat.toFixed(5)}, {row.original.lng.toFixed(5)}
                </div>
            ),
            size: 140,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row, getValue }) => {
                const status = getValue() as string;
                const sourceId = row.original.source_company_id;
                const isImported = sourceId && !['MANUAL_ENTRY', 'SCANNER', 'UPLOADED', 'MANUAL'].includes(sourceId);
                const [isLoading, setIsLoading] = React.useState(false);

                const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
                    const newStatus = e.target.value;
                    setIsLoading(true);
                    try {
                        const updated = { ...row.original, status: newStatus };
                        await upsertGlobalReachLeads([updated]);
                        loadLeadsData();
                    } catch (err) {
                        console.error(err);
                        alert("Failed to update status");
                    } finally {
                        setIsLoading(false);
                    }
                };

                if (isImported) {
                    return (
                        <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                            <span className="text-slate-700 font-mono text-[10px]">
                                -
                            </span>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col gap-1 items-center" onClick={e => e.stopPropagation()}>
                        <div className="relative group/status w-full">
                            <select
                                value={status}
                                onChange={handleChange}
                                disabled={isLoading}
                                className={`
                                    appearance-none w-full bg-transparent text-[9px] font-black uppercase tracking-wider
                                    border rounded-full px-2 py-0.5 outline-none cursor-pointer text-center
                                    ${isLoading ? 'opacity-50' : 'hover:bg-white/5'}
                                    ${status === 'NEW' ? 'text-blue-400 border-blue-500/20' :
                                        status === 'CONTACTED' ? 'text-amber-400 border-amber-500/20' :
                                            status === 'QUALIFIED' ? 'text-emerald-400 border-emerald-500/20' :
                                                status === 'CLOSED' ? 'text-purple-400 border-purple-500/20' :
                                                    'text-rose-400 border-rose-500/20'}
                                `}
                            >
                                <option value="NEW" className="bg-[#0f172a] text-blue-400">NEW</option>
                                <option value="CONTACTED" className="bg-[#0f172a] text-amber-400">CONTACTED</option>
                                <option value="QUALIFIED" className="bg-[#0f172a] text-emerald-400">QUALIFIED</option>
                                <option value="CLOSED" className="bg-[#0f172a] text-purple-400">CLOSED</option>
                                <option value="INVALID" className="bg-[#0f172a] text-rose-400">INVALID</option>
                            </select>
                            {isLoading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-3 h-3 animate-spin text-white" /></div>}
                        </div>
                    </div >
                );
            },
            size: 110,
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            setEditingLead(row.original);
                            setNewLeadForm({
                                name: row.original.name || '',
                                name_ar: row.original.name_ar || '',
                                region_description: row.original.region_description || '',
                                address: row.original.address || '',
                                lat: row.original.lat.toString(),
                                lng: row.original.lng.toString(),
                                source_company_id: row.original.source_company_id || 'MANUAL'
                            });
                            setIsLeadModalOpen(true);
                        }}
                        className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                        title="Edit Record"
                    >
                        <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => openNavigation(row.original.lat, row.original.lng)}
                        className="p-1.5 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                        title="Navigate"
                    >
                        <Navigation className="w-3 h-3" />
                    </button>
                    <button
                        onClick={() => {
                            setSingleDeleteId(row.original.id);
                            setDeleteConfirmation(true);
                        }}
                        className="p-1.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        title="Delete (Requires Admin Auth)"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            ),
            size: 80,
        },
        {
            accessorKey: 'created_at',
            header: 'Registered',
            cell: info => (
                <div className="text-right text-slate-500 font-mono text-[10px]">
                    {new Date(info.getValue() as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
            ),
            size: 120,
        },
    ], []);

    // Dynamic Columns Logic
    const dynamicColumns = useMemo<ColumnDef<any>[]>(() => {
        if (!leads || leads.length === 0) return [];

        // Extract all unique keys from dynamic_data across all loaded leads
        const keys = new Set<string>();
        leads.forEach(lead => {
            if (lead.dynamic_data) {
                Object.keys(lead.dynamic_data).forEach(k => keys.add(k));
            }
        });

        return Array.from(keys).map(key => ({
            id: `dyn_${key}`,
            accessorFn: row => row.dynamic_data?.[key],
            header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            cell: info => (
                <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-500/50" />
                    <span className="text-[10px] font-medium text-pink-200">{info.getValue() as string || '-'}</span>
                </div>
            ),
            size: 150
        }));
    }, [leads]);

    // Merge Static & Dynamic Columns
    const allColumns = useMemo(() => [...columns, ...dynamicColumns], [columns, dynamicColumns]);

    // Table Instance
    const table = useReactTable({
        data: leads,
        columns: allColumns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            globalFilter: globalSearch,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalSearch,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        manualFiltering: true, // Fix: Disable client-side filtering so we rely 100% on server
        pageCount: Math.ceil(totalCount / pageSize),
    });

    const { rows } = table.getRowModel();

    // Virtualization
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 40, // compact row height
        overscan: 10,
    });

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
    const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;

    // Handlers
    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingLead(true);
        try {
            const leadData = {
                ...newLeadForm,
                lat: parseFloat(newLeadForm.lat),
                lng: parseFloat(newLeadForm.lng),
                status: editingLead?.status || 'NEW',
                id: editingLead?.id // Include ID if editing
            };

            await upsertGlobalReachLeads([leadData]);
            setNotification({
                message: editingLead ? 'Record updated successfully' : 'Manual Record Synchronized',
                type: 'success'
            });
            setIsLeadModalOpen(false);
            setEditingLead(null);
            setNewLeadForm({ name: '', name_ar: '', region_description: '', address: '', lat: '', lng: '', source_company_id: 'MANUAL_ENTRY' });
            loadLeadsData();
        } catch (err) {
            console.error(err);
            setNotification({ message: 'Synchronization Fail Code 04', type: 'error' });
        } finally {
            setCreatingLead(false);
        }
    };

    const handleExportLeads = () => {
        const selectedIds = Object.keys(rowSelection);
        const dataToExport = selectedIds.length > 0
            ? leads.filter((_, idx) => rowSelection[idx as any])
            : leads;

        if (dataToExport.length === 0) return;

        const exportData = dataToExport.map(l => ({
            ID: l.id,
            Name: l.name,
            NameArabic: l.name_ar,
            Address: l.address,
            Region: l.region_description,
            Latitude: l.lat,
            Longitude: l.lng,
            Source: l.source_company_id,
            Status: l.status,
            DateAdded: new Date(l.created_at).toLocaleString()
        }));

        const csv = Papa.unparse(exportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `reach_global_leads_raw_data.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-9rem)] p-6 space-y-4 animate-in fade-in duration-500">
            {/* Action Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shrink-0">
                <PageHeader
                    icon={<Layout className="w-5 h-5" />}
                    title="Reach Leads"
                    subtitle={`Global lead registry · ${totalCount.toLocaleString()} records`}
                />

                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {/* Global Search */}
                    <div className="relative flex-grow lg:flex-grow-0 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search globally..."
                            value={globalSearch}
                            onChange={(e) => setGlobalSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-[#1e293b]/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/50 transition-all font-medium"
                        />
                    </div>

                    <div className="flex items-center gap-2">

                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="p-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all"
                            title="Import Data (CSV)"
                        >
                            <Upload className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => setIsCompanyImportOpen(true)}
                            className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all"
                            title="Fetch From Other Companies"
                        >
                            <Globe className="w-4 h-4" />
                        </button>

                        <button
                            onClick={handleFullClean}
                            className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all font-bold text-xs flex items-center gap-2"
                            title="Full Dataset Deep Clean (Worker)"
                        >
                            <Sparkles className="w-4 h-4" />
                            <span className="hidden xl:inline">PRO CLEAN</span>
                        </button>

                        <button
                            onClick={() => setShowColumnManager(!showColumnManager)}
                            className={`p-2 rounded-xl border transition-all ${showColumnManager ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'}`}
                            title="Manage Columns"
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        <div className="h-6 w-px bg-white/10 mx-1" />

                        <button
                            onClick={() => setClearConfirmation(true)}
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                            title="Clear All Leads"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                            onClick={handleExportLeads}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-400 border border-white/10 transition-all active:scale-95"
                            title={`Export ${Object.keys(rowSelection).length > 0 ? `(${Object.keys(rowSelection).length})` : 'All'}`}
                        >
                            <Download className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => setIsLeadModalOpen(true)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center transition-all active:scale-95"
                            title="Add Single Record"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={clearConfirmation}
                onClose={() => setClearConfirmation(false)}
                onConfirm={handleClearAll}
                title="Clear Global Registry"
                description={`This action is irreversible. All ${totalCount.toLocaleString()} records in the Global Lead Registry will be permanently wiped.`}
            />

            <ConfirmModal
                isOpen={deleteConfirmation}
                onClose={() => { setDeleteConfirmation(false); setSingleDeleteId(null); }}
                onConfirm={() => singleDeleteId && handleDeleteLead(singleDeleteId)}
                title="Delete Lead Record"
                description="This will permanently remove the lead from the Global Registry. This action cannot be undone."
            />

            {/* Column Visibility Popup */}
            {
                showColumnManager && (
                    <div className="absolute top-24 right-10 z-[60] w-64 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black uppercase text-slate-500">Visible Fields</span>
                            <button onClick={() => setShowColumnManager(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                            {table.getAllLeafColumns().map(column => (
                                <label key={column.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={column.getIsVisible()}
                                        onChange={column.getToggleVisibilityHandler()}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 accent-indigo-500"
                                    />
                                    <span className="text-xs font-bold text-slate-300 capitalize">{column.id.replace(/_/g, ' ')}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Data Grid Body */}
            <div className="flex-grow bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col relative">
                {/* Fixed Scrollable Header */}
                <div
                    ref={tableContainerRef}
                    className="overflow-auto flex-grow custom-scrollbar"
                >
                    <table className="w-full border-collapse table-fixed">
                        <thead className="sticky top-0 z-[50] bg-[#1e293b] border-b border-white/10 shadow-lg">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            className="px-4 py-3 text-left border-r border-white/5"
                                            style={{ width: header.getSize() }}
                                        >
                                            <div className="flex flex-col gap-2">
                                                <div
                                                    className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ${header.column.getCanSort() ? 'cursor-pointer hover:text-white' : ''}`}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    {header.column.getIsSorted() && (
                                                        <ArrowUpDown className={`w-3 h-3 ${header.column.getIsSorted() === 'asc' ? 'text-indigo-400' : 'text-purple-400'}`} />
                                                    )}
                                                </div>

                                                {/* Inline Filtering */}
                                                {header.column.getCanFilter() ? (
                                                    <div className="relative">
                                                        {header.column.id === 'status' ? (
                                                            <select
                                                                value={(header.column.getFilterValue() ?? 'ALL') as string}
                                                                onChange={e => header.column.setFilterValue(e.target.value)}
                                                                className="w-full pl-2 pr-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-slate-300 outline-none focus:border-indigo-500 transition-all cursor-pointer appearance-none text-center font-bold"
                                                            >
                                                                <option value="ALL">ALL {availableStatuses.length > 0 ? `(${availableStatuses.length})` : ''}</option>
                                                                {availableStatuses.map(status => (
                                                                    <option key={status} value={status}>{status}</option>
                                                                ))}
                                                            </select>
                                                        ) : header.column.id === 'source_company_id' ? (
                                                            <select
                                                                value={(header.column.getFilterValue() ?? 'ALL') as string}
                                                                onChange={e => header.column.setFilterValue(e.target.value)}
                                                                className="w-full pl-2 pr-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-slate-300 outline-none focus:border-indigo-500 transition-all cursor-pointer appearance-none text-center font-bold"
                                                            >
                                                                <option value="ALL">ALL</option>
                                                                <option value="MANUAL_FILTER">Manual / CSV</option>
                                                                <option value="SCANNER_FILTER">Scanner</option>
                                                                <option value="FETCHED_FILTER">Fetched (Company)</option>
                                                            </select>
                                                        ) : header.column.id === 'region_description' ? (
                                                            <select
                                                                value={(header.column.getFilterValue() ?? 'ALL') as string}
                                                                onChange={e => header.column.setFilterValue(e.target.value)}
                                                                className="w-full pl-2 pr-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-slate-300 outline-none focus:border-indigo-500 transition-all cursor-pointer appearance-none text-center font-bold"
                                                            >
                                                                <option value="ALL">ALL ({availableRegions.length})</option>
                                                                {availableRegions.map(region => (
                                                                    <option key={region} value={region}>{region}</option>
                                                                ))}
                                                            </select>
                                                        ) : dynamicOptions[header.column.id.replace('dyn_', '')] ? (
                                                            <select
                                                                value={(header.column.getFilterValue() ?? 'ALL') as string}
                                                                onChange={e => header.column.setFilterValue(e.target.value)}
                                                                className="w-full pl-2 pr-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-slate-300 outline-none focus:border-indigo-500 transition-all cursor-pointer appearance-none text-center font-bold"
                                                            >
                                                                <option value="ALL">ALL ({dynamicOptions[header.column.id.replace('dyn_', '')].length})</option>
                                                                {dynamicOptions[header.column.id.replace('dyn_', '')].map(opt => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <>
                                                                <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-600" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Filter..."
                                                                    value={(header.column.getFilterValue() ?? '') as string}
                                                                    onChange={e => header.column.setFilterValue(e.target.value)}
                                                                    className="w-full pl-6 pr-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-slate-300 outline-none focus:border-indigo-500 transition-all font-mono"
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                ) : <div className="h-[21px]" />}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>

                        <tbody className="relative">
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length} className="py-40 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                                            <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Accessing Grid Segments...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="py-40 text-center">
                                        <span className="text-slate-600 text-xs font-bold uppercase">No records found matching current index</span>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {paddingTop > 0 && <tr><td style={{ height: `${paddingTop}px` }} /></tr>}
                                    {virtualRows.map(virtualRow => {
                                        const row = rows[virtualRow.index];
                                        return (
                                            <tr
                                                key={row.id}
                                                className={`hover:bg-indigo-500/5 transition-colors group cursor-default border-b border-white/5 ${row.getIsSelected() ? 'bg-indigo-500/10' : ''}`}
                                                style={{ height: `${virtualRow.size}px` }}
                                            >
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-4 py-2 text-[11px] whitespace-nowrap overflow-hidden text-ellipsis border-r border-white/5">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                    {paddingBottom > 0 && <tr><td style={{ height: `${paddingBottom}px` }} /></tr>}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination Stats */}
                <div className="shrink-0 px-6 py-4 bg-white/[0.02] border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Showing <span className="text-white">{leads.length}</span> of <span className="text-white">{totalCount}</span> Database Assets
                        </div>
                        {Object.keys(rowSelection).length > 0 && (
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3" /> {Object.keys(rowSelection).length} Records Selected
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                            Rows per page:
                            <select
                                value={pageSize}
                                onChange={e => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white outline-none"
                            >
                                {[50, 100, 250, 500, 1000].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                                <option value={totalCount}>All ({totalCount})</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || loading}
                                className={`p-1.5 rounded-lg border border-white/10 transition-all ${currentPage === 1 ? 'opacity-20' : 'hover:bg-white/10'}`}
                            >
                                <ChevronLeft className="w-4 h-4 text-white" />
                            </button>
                            <span className="text-[10px] font-black text-white w-20 text-center uppercase tracking-widest">
                                PAGE {currentPage} / {Math.ceil(totalCount / pageSize)}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                                disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                                className={`p-1.5 rounded-lg border border-white/10 transition-all ${currentPage >= Math.ceil(totalCount / pageSize) ? 'opacity-20' : 'hover:bg-white/10'}`}
                            >
                                <ChevronRight className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {
                isLeadModalOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                <h3 className="text-xl font-black text-white flex items-center gap-3">
                                    {editingLead ? <Edit2 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                                    {editingLead ? 'Edit Register Entry' : 'New Register Entry'}
                                </h3>
                                <button onClick={() => { setIsLeadModalOpen(false); setEditingLead(null); }} className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleCreateLead} className="p-8 space-y-6">
                                <div className="max-h-[60vh] overflow-y-auto px-1 space-y-6 custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Name (EN)</label>
                                            <input required type="text" value={newLeadForm.name} onChange={e => setNewLeadForm({ ...newLeadForm, name: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Name (AR)</label>
                                            <input type="text" value={newLeadForm.name_ar} onChange={e => setNewLeadForm({ ...newLeadForm, name_ar: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none text-right" dir="rtl" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase">Region/City</label>
                                        <input type="text" value={newLeadForm.region_description} onChange={e => setNewLeadForm({ ...newLeadForm, region_description: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase">Full Address</label>
                                        <input type="text" value={newLeadForm.address} onChange={e => setNewLeadForm({ ...newLeadForm, address: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Latitude</label>
                                            <input required type="number" step="any" value={newLeadForm.lat} onChange={e => setNewLeadForm({ ...newLeadForm, lat: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none font-mono" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500 uppercase">Longitude</label>
                                            <input required type="number" step="any" value={newLeadForm.lng} onChange={e => setNewLeadForm({ ...newLeadForm, lng: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-indigo-500 outline-none font-mono" />
                                        </div>
                                    </div>
                                </div>
                                <button disabled={creatingLead} type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-xl shadow-indigo-500/20 transition-all active:scale-95">
                                    {creatingLead ? <Loader2 className="animate-spin w-5 h-5 mx-auto" /> : 'Sychronize Record'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            <DataOptimizerModal
                isOpen={isOptimizerOpen}
                onClose={() => setIsOptimizerOpen(false)}
                data={leads}
                sourceType="GLOBAL"
                onApplyUpdates={async (updates, deletes) => {
                    try {
                        if (deletes && deletes.length > 0) {
                            await Promise.all(deletes.map(id => deleteGlobalReachLead(id)));
                        }

                        if (updates && updates.length > 0) {
                            await upsertGlobalReachLeads(updates);
                        }

                        await loadLeadsData();
                        setIsOptimizerOpen(false);
                        setNotification({ message: 'Optimization applied successfully', type: 'success' });
                        setTimeout(() => setNotification(null), 3000);
                    } catch (err) {
                        console.error("Failed to persist optimized data:", err);
                        setNotification({ message: 'Failed to apply optimization', type: 'error' });
                        setTimeout(() => setNotification(null), 4000);
                        throw err; // Re-throw to allow modal to handle error state if needed
                    }
                }}
            />

            <SysAdminUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onSuccess={() => {
                    loadLeadsData();
                    // Close & Refresh logic is handled by component, but we ensure state is reset
                    setIsUploadModalOpen(false);
                }}
            />

            <SysAdminCompanyImportModal
                isOpen={isCompanyImportOpen}
                onClose={() => setIsCompanyImportOpen(false)}
                onSuccess={() => {
                    loadLeadsData();
                    setNotification({ message: 'Companies imported successfully', type: 'success' });
                }}
            />

            <SysAdminDuplicateModal
                isOpen={isDuplicateModalOpen}
                onClose={() => setIsDuplicateModalOpen(false)}
                duplicates={duplicates}
                onResolve={() => {
                    loadLeadsData();
                    setNotification({ message: 'Duplicates resolved successfully', type: 'success' });
                }}
            />

            {/* Notification Toast */}
            {
                notification && (
                    <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 z-[100] ${notification.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="text-sm font-bold uppercase tracking-wider flex-1 mr-2">{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-4 h-4 opacity-70 hover:opacity-100" />
                        </button>
                    </div>
                )
            }

            {/* Cleaning Progress Overlay */}
            {isCleaning && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
                        <div className="relative w-20 h-20 mb-6">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="40" cy="40" r="36" fill="transparent" stroke="#334155" strokeWidth="8" />
                                <circle
                                    cx="40" cy="40" r="36"
                                    fill="transparent"
                                    stroke="#10b981"
                                    strokeWidth="8"
                                    strokeDasharray={226}
                                    strokeDashoffset={226 - (226 * cleaningProgress) / 100}
                                    className="transition-all duration-500 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-white">
                                {cleaningProgress}%
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">AI Optimization Active</h3>
                        <p className="text-slate-400 text-sm animate-pulse">
                            Analyzing records, normalizing regions, and detecting ghost duplicates...
                        </p>
                    </div>
                </div>
            )}

            {/* Data Cleaning Workbench */}
            <DataCleaningWorkbench
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                cleaningReport={cleaningReport}
                allLeads={allLeadsForCleaning}
                onApply={async (approvedStandardizations, resolvedMerges) => {
                    try {
                        const updates: any[] = [];

                        // 1. Apply Standardizations
                        // We need to map the uniqueKey "id_field" back to the actual record updates
                        // This is a bit inefficient (searching approved set), better if we constructed the updates directly.
                        if (cleaningReport && approvedStandardizations.size > 0) {
                            cleaningReport.normalizedRecords.forEach((item: any) => {
                                const uniqueKey = item.id + '_' + item.field;
                                if (approvedStandardizations.has(uniqueKey)) {
                                    // Find if we already have an update pending for this ID
                                    let existingUpdate = updates.find(u => u.id === item.id);
                                    if (!existingUpdate) {
                                        // Get original record to ensure we don't lose other fields if upsert requires them (Supabase usually patches if ID exists)
                                        // But getting the full record from allLeadsForCleaning is safer
                                        const original = allLeadsForCleaning.find(l => l.id === item.id);
                                        if (original) {
                                            existingUpdate = { ...original };
                                            updates.push(existingUpdate);
                                        }
                                    }

                                    if (existingUpdate) {
                                        existingUpdate[item.field] = item.newValue;
                                    }
                                }
                            });
                        }

                        // 2. Apply Merges
                        if (cleaningReport && resolvedMerges.size > 0 && cleaningReport.duplicatesGroups) {
                            for (const [groupIndexStr, resolution] of resolvedMerges.entries()) {
                                const groupIdx = parseInt(groupIndexStr);
                                const group = cleaningReport.duplicatesGroups[groupIdx];
                                if (!group || group.length < 2) continue;

                                const idA = group[0];
                                const idB = group[1]; // Simple 2-way merge for now as per UI

                                if (resolution === 'KEEP_A') {
                                    // Delete B
                                    await deleteGlobalReachLead(idB);
                                } else if (resolution === 'KEEP_B') {
                                    // Delete A (which usually means we might want to update B's ID or just keep B as is? 
                                    // If we "Keep B", we essentially just delete A.
                                    await deleteGlobalReachLead(idA);
                                } else if (resolution === 'SMART_MERGE') {
                                    // Merge non-empty fields from B into A, then delete B
                                    // For simplicity in this iteration: We prioritize data length/completeness
                                    // Implementation: Update A with B's better fields, Delete B
                                    const recA = allLeadsForCleaning.find(l => l.id === idA);
                                    const recB = allLeadsForCleaning.find(l => l.id === idB);

                                    if (recA && recB) {
                                        const merged = { ...recA };
                                        // Simple heuristic: if A is empty but B has value, take B
                                        Object.keys(recB).forEach(key => {
                                            if ((!merged[key] || merged[key] === '') && recB[key]) {
                                                merged[key] = recB[key];
                                            }
                                        });
                                        updates.push(merged); // Queue update for A
                                        await deleteGlobalReachLead(idB); // Delete B immediately
                                    }
                                }
                            }
                        }

                        if (updates.length > 0) {
                            await upsertGlobalReachLeads(updates);
                            setNotification({ message: `Applied ${updates.length} updates & resolved duplicates`, type: 'success' });
                        } else if (resolvedMerges.size > 0) {
                            setNotification({ message: `Resolved ${resolvedMerges.size} duplicates`, type: 'success' });
                        }

                        setShowReportModal(false);
                        loadLeadsData(); // Refresh table
                    } catch (e) {
                        console.error("Apply failed", e);
                        alert("Failed to apply changes");
                    }
                }}
            />
        </div >
    );
};

export default SysAdminLeads;
