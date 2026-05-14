
import React, { useMemo, useState } from 'react';
import { Customer } from '../../../types';
import {
    AlertCircle, AlertTriangle, ArrowRight, Building2, CalendarCheck, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Columns, Database, FileSpreadsheet, FileText, Map, MapPin, RotateCcw, Route, Save, Share2, Table2, Users, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DataUploadConfirmationProps {
    data: Customer[];
    fileName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isUploading: boolean;
    progress?: { percent: number; stepName: string };
    mapping?: Record<string, string>;
    onUpdateMapping?: (key: string, value: string) => void;
    availableHeaders?: string[];
    onAutoDetect?: (table: string) => void;
    firstRawRow?: Record<string, any>;
}

// Table section with expandable details
interface TableSectionProps {
    title: string;
    icon: React.ReactNode;
    color: string;
    count: number;
    tableName: string;
    columns: { name: string; mapped: boolean; csvHeader?: string }[];
    sampleRows: Record<string, string | number | null>[];  // Full row data for table preview
    isExpanded: boolean;
    onToggle: () => void;
    onUpdateMapping?: (key: string, value: string) => void;
    availableHeaders?: string[];
    onAutoDetect?: (table: string) => void;
    firstRawRow?: Record<string, any>;
}

const TableSection: React.FC<TableSectionProps> = ({
    title, icon, color, count, tableName, columns, sampleRows, isExpanded, onToggle,
    onUpdateMapping, availableHeaders = [], onAutoDetect, firstRawRow
}) => {
    const mappedCount = columns.filter(c => c.mapped).length;
    const totalCount = columns.length;
    // Get column names for table header
    const columnNames = columns.map(c => c.name);

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? `border-${color}-500/50` : 'border-slate-700/50'}`}>
            {/* Header - Always Visible */}
            <div
                onClick={onToggle}
                className={`w-full p-4 flex items-center justify-between bg-slate-800/80 hover:bg-slate-800 transition-colors cursor-pointer`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-${color}-400 to-${color}-600 flex items-center justify-center shadow-lg`}>
                        {icon}
                    </div>
                    <div className="text-left">
                        <h3 className="text-white font-bold text-lg">{title}</h3>
                        <p className="text-xs text-slate-400">
                            <span className="text-emerald-400 font-bold">{count}</span> records → <code className="bg-slate-700 px-1 rounded text-[10px]">{tableName}</code>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Auto Detect Button */}
                    {onAutoDetect && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                // Map display table names back to internal keys for auto-detect
                                let internalKey = tableName;
                                if (tableName === 'normalized_customers') internalKey = 'customers';
                                else if (tableName === 'route_visits') internalKey = 'visits';
                                else if (tableName === 'company_branches') internalKey = 'branches';

                                onAutoDetect(internalKey);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-600/50 text-xs font-medium z-10"
                            title="Auto-detect columns for this table"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span className="hidden sm:inline">Auto Detect</span>
                        </button>
                    )}

                    {/* Mapping Status Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${mappedCount === totalCount
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                        {mappedCount === totalCount ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {mappedCount}/{totalCount} Columns
                    </div>

                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
            </div>

            {/* Expandable Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-slate-900/50 border-t border-slate-700/50 space-y-4">


                            {/* Sample Data Table Preview */}
                            {sampleRows.length > 0 && (
                                <div>
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Table2 className="w-3 h-3" /> Sample Data Preview (First {sampleRows.length} rows as will be inserted)
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-800 text-slate-400 border-b border-slate-700">
                                                    {columns.map((col, idx) => (
                                                        <th key={idx} className="text-left px-3 py-3 border-r border-slate-700/50 min-w-[140px] align-top">
                                                            <div className="flex flex-col gap-1.5">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                                                    {col.name}
                                                                </span>

                                                                {(col as any).mappingKey && onUpdateMapping ? (
                                                                    <div className="relative">
                                                                        <select
                                                                            value={col.csvHeader || ''}
                                                                            onChange={(e) => onUpdateMapping((col as any).mappingKey, e.target.value)}
                                                                            className="w-full bg-slate-950 border border-slate-700 text-emerald-400 text-[11px] rounded px-2 py-1.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none cursor-pointer hover:bg-slate-900 transition-colors"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            title={`Map ${col.name} to a CSV column`}
                                                                        >
                                                                            <option value="" className="text-slate-500">(Unmapped)</option>
                                                                            {availableHeaders.map(h => (
                                                                                <option key={h} value={h} className="text-white">
                                                                                    {h} {firstRawRow && firstRawRow[h] ? `(${String(firstRawRow[h]).substring(0, 15)}${String(firstRawRow[h]).length > 15 ? '...' : ''})` : ''}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        {/* Chevron icon for styling */}
                                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                                            <ChevronDown className="w-3 h-3" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="px-2 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded text-[10px] text-slate-400 italic">
                                                                        {col.csvHeader || 'Auto-generated'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sampleRows.slice(0, 3).map((row, rowIdx) => (
                                                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-900/30'}>
                                                        {columnNames.map((colName, colIdx) => (
                                                            <td key={colIdx} className="px-3 py-2 border border-slate-700/50 text-white truncate max-w-[150px]" title={String(row[colName] || '')}>
                                                                {row[colName] || <span className="text-slate-500 italic">—</span>}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const DataUploadConfirmation: React.FC<DataUploadConfirmationProps> = ({
    data,
    fileName,
    onConfirm,
    onCancel,
    isUploading,
    progress,
    mapping,
    onUpdateMapping,
    availableHeaders,
    onAutoDetect,
    firstRawRow
}) => {
    // Expanded state for each section
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        branches: true,
        routes: false,
        customers: false,
        visits: false
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Calculate detailed statistics for each table
    const tableStats = useMemo(() => {
        const uniqueBranches: Record<string, { code: string; name: string; region: string }> = {};
        const uniqueRoutes: Record<string, { name: string; repCode: string; branch: string; branchCode: string }> = {};
        const uniqueRepCodes = new Set<string>();
        const uniqueCustomers: Record<string, Customer> = {};
        const visitSet: Record<string, { route: string; client: string; week: string; day: string; userCode: string }> = {};
        let missingGpsCount = 0;

        data.forEach(c => {
            const clientKey = c.clientCode || c.reachCustomerCode || c.name || `Row-${c.id}`;

            // Branches - now correctly mapped:
            // c.branch = Branch NAME (e.g., "Jeddah Consumer")
            // c.regionCode = Branch CODE (e.g., "21")
            // c.regionDescription = REGION (e.g., "West Region")
            const branchName = c.branch || 'Unassigned';
            const branchCode = c.regionCode || branchName; // Use name as fallback code
            const region = c.regionDescription || '';

            if (branchCode && !uniqueBranches[branchCode]) {
                uniqueBranches[branchCode] = {
                    code: branchCode,
                    name: branchName,
                    region: region
                };
            }

            // Routes
            const routeName = c.routeName || '(Unmapped Route)';
            const routeKey = `${branchCode}| ${routeName} `;
            const repCode = c.userCode || '';

            if (repCode) uniqueRepCodes.add(repCode);

            if (!uniqueRoutes[routeKey]) {
                uniqueRoutes[routeKey] = {
                    name: routeName,
                    repCode: repCode,
                    branch: branchName, // Name
                    branchCode: branchCode // Code
                };
            }

            // Customers
            const customerKey = `${branchCode}| ${clientKey} `;
            if (!uniqueCustomers[customerKey]) {
                uniqueCustomers[customerKey] = c;

                // Missing GPS
                if (!c.lat || !c.lng || (c.lat === 0 && c.lng === 0)) {
                    missingGpsCount++;
                }
            }

            // Visits (route + customer + week + day)
            const week = c.week || 'W1';
            const day = c.day || 'Sunday';
            const visitKey = `${routeName}| ${clientKey}| ${week}| ${day} `;

            // Only add if not exists (or update if needed)
            if (!visitSet[visitKey]) {
                visitSet[visitKey] = {
                    route: routeName,
                    client: clientKey,
                    week: week,
                    day: day,
                    userCode: repCode
                };
            }
        });

        const branchValues = Object.values(uniqueBranches);
        const routeValues = Object.values(uniqueRoutes);
        const customerValues = Object.values(uniqueCustomers);
        const visitValues = Object.values(visitSet);

        return {
            branches: {
                count: branchValues.length,
                // Full row data for table preview
                sampleRows: branchValues.slice(0, 3).map(b => ({
                    code: b.code,
                    name_en: b.name,
                    region: b.region // Now populated from c.regionDescription
                }))
            },
            routes: {
                count: uniqueRepCodes.size, // User requested distinct count of User Codes
                sampleRows: routeValues.slice(0, 3).map(r => ({
                    route_name: r.name,
                    rep_code: r.repCode,
                    branch_id: r.branchCode
                }))
            },
            customers: {
                count: customerValues.length,
                sampleRows: customerValues.slice(0, 3).map(c => ({
                    client_code: c.clientCode || '',
                    name_en: c.name || '',
                    name_ar: c.nameAr || '',
                    branch_code: c.regionCode || '', // Map region_code to c.regionCode (e.g. "21")
                    lat: c.lat,
                    lng: c.lng,
                    address: c.address || '',
                    phone: c.phone || '',
                    classification: c.classification || '',
                    vat: c.vat || '',
                    district: c.district || '',
                    buyer_id: c.buyerId || '',
                    store_type: c.storeType || ''
                })),
                missingGps: missingGpsCount
            },
            visits: {
                count: visitValues.length,
                sampleRows: visitValues.slice(0, 3).map(v => ({
                    route_id: v.route,
                    customer_id: v.client,
                    week_number: v.week,
                    day_name: v.day,
                    user_code: v.userCode
                }))
            }
        };
    }, [data]);

    // Define columns for each table with mapping status
    const getColumnMappings = (table: string) => {
        const m = mapping || {};

        switch (table) {
            case 'branches':
                return [
                    { name: 'code', mapped: !!m.branch_code, csvHeader: m.branch_code, mappingKey: 'branch_code' },
                    { name: 'name_en', mapped: !!m.branch_name, csvHeader: m.branch_name, mappingKey: 'branch_name' },
                    { name: 'region', mapped: !!m.region, csvHeader: m.region, mappingKey: 'region' },
                ];
            case 'routes':
                return [
                    { name: 'route_name', mapped: !!m.route_name, csvHeader: m.route_name, mappingKey: 'route_name' },
                    { name: 'rep_code', mapped: !!m.rep_code, csvHeader: m.rep_code, mappingKey: 'rep_code' },
                    { name: 'branch_id', mapped: !!m.branch_code, csvHeader: m.branch_code, mappingKey: 'branch_code' }, // branch_id in routes is derived from branch_code/region
                ];
            case 'customers':
                return [
                    { name: 'client_code', mapped: !!m.client_code, csvHeader: m.client_code, mappingKey: 'client_code' },
                    { name: 'name_en', mapped: !!m.customer_name_en, csvHeader: m.customer_name_en, mappingKey: 'customer_name_en' },
                    { name: 'name_ar', mapped: !!m.customer_name_ar, csvHeader: m.customer_name_ar, mappingKey: 'customer_name_ar' },
                    { name: 'branch_code', mapped: !!m.branch_code, csvHeader: m.branch_code, mappingKey: 'branch_code' }, // Allow changing branch code here
                    { name: 'lat', mapped: !!m.lat, csvHeader: m.lat, mappingKey: 'lat' },
                    { name: 'lng', mapped: !!m.lng, csvHeader: m.lng, mappingKey: 'lng' },
                    { name: 'address', mapped: !!m.address, csvHeader: m.address, mappingKey: 'address' },
                    { name: 'phone', mapped: !!m.phone, csvHeader: m.phone, mappingKey: 'phone' },
                    { name: 'classification', mapped: !!m.classification, csvHeader: m.classification, mappingKey: 'classification' },
                    { name: 'vat', mapped: !!m.vat, csvHeader: m.vat, mappingKey: 'vat' },
                    { name: 'district', mapped: !!m.district, csvHeader: m.district, mappingKey: 'district' },
                    { name: 'buyer_id', mapped: !!m.buyer_id, csvHeader: m.buyer_id, mappingKey: 'buyer_id' },
                    { name: 'store_type', mapped: !!m.store_type, csvHeader: m.store_type, mappingKey: 'store_type' },
                ];
            case 'visits':
                return [
                    { name: 'route_id', mapped: !!m.route_name, csvHeader: 'Linked via route_name' },
                    { name: 'customer_id', mapped: !!m.client_code, csvHeader: 'Linked via client_code' },
                    { name: 'week_number', mapped: !!m.week_number, csvHeader: m.week_number, mappingKey: 'week_number' },
                    { name: 'day_name', mapped: !!m.day_name, csvHeader: m.day_name, mappingKey: 'day_name' },
                    { name: 'visit_order', mapped: !!m.visit_order, csvHeader: m.visit_order, mappingKey: 'visit_order' },
                    { name: 'user_code', mapped: !!m.rep_code, csvHeader: m.rep_code, mappingKey: 'rep_code' },
                ];
            default:
                return [];
        }
    };

    const totalRecords = tableStats.branches.count + tableStats.routes.count + tableStats.customers.count + tableStats.visits.count;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-lg animate-in fade-in duration-300 p-4">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[#0f172a] border border-slate-700/50 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden relative flex flex-col max-h-[95vh]"
            >
                {/* Top Gradient Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500" />

                {/* Header */}
                <div className="p-6 pb-4 text-center shrink-0 border-b border-slate-800 relative">

                    <div className="mx-auto w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-3">
                        <Database className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-1">Data Import Preview</h2>
                    <p className="text-slate-400 text-sm">
                        <span className="text-white font-bold">{fileName}</span> •
                        <span className="text-emerald-400 font-bold ml-2">{totalRecords.toLocaleString()}</span> total records to sync
                    </p>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar">

                    {/* SYNC INDICATOR */}
                    <div className="bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-purple-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-sm text-emerald-400 font-bold">All tables will be synced simultaneously</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Building2 className="w-4 h-4" />
                            <ArrowRight className="w-3 h-3" />
                            <Route className="w-4 h-4" />
                            <ArrowRight className="w-3 h-3" />
                            <Users className="w-4 h-4" />
                            <ArrowRight className="w-3 h-3" />
                            <CalendarCheck className="w-4 h-4" />
                        </div>
                    </div>

                    {/* BRANCHES */}
                    <TableSection
                        title="Branches"
                        icon={<Building2 className="w-5 h-5 text-white" />}
                        color="purple"
                        count={tableStats.branches.count}
                        tableName="company_branches"
                        columns={getColumnMappings('branches')}
                        sampleRows={tableStats.branches.sampleRows}
                        isExpanded={expandedSections.branches}
                        onToggle={() => toggleSection('branches')}
                        onUpdateMapping={onUpdateMapping}
                        availableHeaders={availableHeaders}
                        onAutoDetect={onAutoDetect}
                        firstRawRow={firstRawRow}
                    />


                    {/* ROUTES */}
                    <TableSection
                        title="Routes & Users"
                        icon={<Route className="w-5 h-5 text-white" />}
                        color="indigo"
                        count={tableStats.routes.count}
                        tableName="routes"
                        columns={getColumnMappings('routes')}
                        sampleRows={tableStats.routes.sampleRows}
                        isExpanded={expandedSections.routes}
                        onToggle={() => toggleSection('routes')}
                        onUpdateMapping={onUpdateMapping}
                        availableHeaders={availableHeaders}
                        onAutoDetect={onAutoDetect}
                        firstRawRow={firstRawRow}
                    />

                    {/* CUSTOMERS */}
                    <TableSection
                        title="Customers"
                        icon={<Users className="w-5 h-5 text-white" />}
                        color="blue"
                        count={tableStats.customers.count}
                        tableName="normalized_customers"
                        columns={getColumnMappings('customers')}
                        sampleRows={tableStats.customers.sampleRows}
                        isExpanded={expandedSections.customers}
                        onToggle={() => toggleSection('customers')}
                        onUpdateMapping={onUpdateMapping}
                        availableHeaders={availableHeaders}
                        onAutoDetect={onAutoDetect}
                        firstRawRow={firstRawRow}
                    />

                    {/* VISITS */}
                    <TableSection
                        title="Visit Schedule"
                        icon={<CalendarCheck className="w-5 h-5 text-white" />}
                        color="emerald"
                        count={tableStats.visits.count}
                        tableName="route_visits"
                        columns={getColumnMappings('visits')}
                        sampleRows={tableStats.visits.sampleRows}
                        isExpanded={expandedSections.visits}
                        onToggle={() => toggleSection('visits')}
                        onUpdateMapping={onUpdateMapping}
                        availableHeaders={availableHeaders}
                        onAutoDetect={onAutoDetect}
                        firstRawRow={firstRawRow}
                    />

                    {/* Warnings */}
                    {tableStats.customers.missingGps > 0 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                            <div>
                                <p className="text-amber-400 font-bold text-sm">Missing GPS Coordinates</p>
                                <p className="text-amber-400/70 text-xs">
                                    {tableStats.customers.missingGps} customers have no latitude/longitude. They will be imported but won't appear on the map.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions or Progress */}
                <div className="p-6 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between gap-4 backdrop-blur-sm shrink-0">
                    {isUploading ? (
                        <div className="w-full flex flex-col gap-2 animate-in fade-in">
                            <div className="flex justify-between text-sm text-slate-300 font-medium">
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    {progress?.stepName || 'Processing...'}
                                </span>
                                <span>{progress?.percent || 0}%</span>
                            </div>
                            <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress?.percent || 0}% ` }}
                                    transition={{ type: 'spring', stiffness: 50 }}
                                />
                            </div>
                            <div className="text-xs text-slate-500 text-center mt-1">
                                Syncing all tables: Branches → Routes → Customers → Visits
                            </div>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={onCancel}
                                disabled={isUploading}
                                className="px-6 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={onConfirm}
                                disabled={isUploading}
                                className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Confirm & Sync All Tables
                            </button>
                        </>
                    )}
                </div>

            </motion.div>
        </div>
    );
};

export default DataUploadConfirmation;
