import React, { useState, useMemo } from 'react';
import {
    X,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Sparkles,
    Split,
    Table2,
    Check,
    Ban,
    Maximize2,
    Minimize2
} from 'lucide-react';

// --- Types ---

interface CleaningStats {
    totalScanned: number;
    normalized: number;
    duplicatesFound: number;
}

interface CleaningReport {
    stats: CleaningStats;
    duplicatesGroups: string[][];
    normalizedRecords: {
        id: string;
        field: string;
        oldValue: string;
        newValue: string;
    }[];
}

interface DataCleaningWorkbenchProps {
    isOpen: boolean;
    onClose: () => void;
    cleaningReport: CleaningReport | null;
    allLeads: any[]; // Full data to resolve IDs
    onApply: (approvedStandardizations: Set<string>, resolvedMerges: Map<string, any>) => Promise<void>;
}

// --- Component ---

const DataCleaningWorkbench: React.FC<DataCleaningWorkbenchProps> = ({
    isOpen,
    onClose,
    cleaningReport,
    allLeads,
    onApply
}) => {
    const [activeTab, setActiveTab] = useState<'standardization' | 'duplicates'>('standardization');
    const [approvedStandardizations, setApprovedStandardizations] = useState<Set<string>>(new Set());
    const [rejectedStandardizations, setRejectedStandardizations] = useState<Set<string>>(new Set());
    const [resolvedMerges, setResolvedMerges] = useState<Map<string, 'KEEP_A' | 'KEEP_B' | 'SMART_MERGE'>>(new Map());

    // Initialize/Sync selection when report changes
    useMemo(() => {
        if (cleaningReport) {
            // Auto-approve all standardizations by default
            const allIds = new Set(cleaningReport.normalizedRecords.map(r => r.id + '_' + r.field));
            setApprovedStandardizations(allIds);
            setResolvedMerges(new Map());
        }
    }, [cleaningReport]);

    if (!isOpen || !cleaningReport) return null;

    // Helper to get record details
    const getRecord = (id: string) => allLeads.find(l => l.id === id);

    const handleMergeResolution = (groupIndex: number, resolution: 'KEEP_A' | 'KEEP_B' | 'SMART_MERGE') => {
        const newMap = new Map(resolvedMerges);
        // Key can be the group index or a unique identifier for the conflict pair. 
        // Since we map by group index in the render, let's use that stringified.
        newMap.set(groupIndex.toString(), resolution);
        setResolvedMerges(newMap);
    };

    // Filter Logic for Standardization Grid
    const standardizationRows = cleaningReport.normalizedRecords.map(item => {
        const record = getRecord(item.id);
        const uniqueKey = item.id + '_' + item.field;
        return {
            ...item,
            recordName: record?.name || 'Unknown',
            uniqueKey,
            isApproved: approvedStandardizations.has(uniqueKey),
            isRejected: rejectedStandardizations.has(uniqueKey)
        };
    });

    const toggleStandardization = (uniqueKey: string, status: 'approve' | 'reject') => {
        const newApproved = new Set(approvedStandardizations);
        const newRejected = new Set(rejectedStandardizations);

        if (status === 'approve') {
            newApproved.add(uniqueKey);
            newRejected.delete(uniqueKey);
        } else {
            newRejected.add(uniqueKey);
            newApproved.delete(uniqueKey);
        }

        setApprovedStandardizations(newApproved);
        setRejectedStandardizations(newRejected);
    };

    const handleBulkStandardizationAction = (action: 'approve_all' | 'reject_all') => {
        if (action === 'approve_all') {
            const all = new Set(standardizationRows.map(r => r.uniqueKey));
            setApprovedStandardizations(all);
            setRejectedStandardizations(new Set());
        } else {
            setRejectedStandardizations(new Set(standardizationRows.map(r => r.uniqueKey)));
            setApprovedStandardizations(new Set());
        }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-[#0f172a] animate-in fade-in duration-300 flex flex-col">
            {/* 1. Top Header Bar */}
            <div className="h-16 border-b border-white/10 bg-[#0f172a] flex items-center justify-between px-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                        <Sparkles className="w-5 h-5 text-pink-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">Data Cleaning Workbench</h1>
                        <p className="text-xs text-slate-400 font-medium">
                            <span className="text-pink-400">{cleaningReport.stats.totalScanned}</span> records analyzed •
                            <span className="text-emerald-400 ml-2">{cleaningReport.stats.normalized}</span> fixes proposed •
                            <span className="text-amber-400 ml-2">{cleaningReport.stats.duplicatesFound}</span> duplicates
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* 2. Main Content Area (Split) */}
            <div className="flex-grow flex overflow-hidden">
                {/* Sidebar / Tabs */}
                <div className="w-64 border-r border-white/10 bg-black/20 flex flex-col pt-6 px-3 gap-2">
                    <button
                        onClick={() => setActiveTab('standardization')}
                        className={`p-3 rounded-xl flex items-center gap-3 transition-all ${activeTab === 'standardization'
                            ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/20'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <Table2 className="w-4 h-4" />
                        <div className="text-left">
                            <div className="text-sm font-bold">Standardization</div>
                            <div className="text-[10px] opacity-70">Region & Typos</div>
                        </div>
                        <div className="ml-auto bg-black/20 px-2 py-0.5 rounded textxs font-mono">
                            {cleaningReport.normalizedRecords.length}
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveTab('duplicates')}
                        className={`p-3 rounded-xl flex items-center gap-3 transition-all ${activeTab === 'duplicates'
                            ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        <Split className="w-4 h-4" />
                        <div className="text-left">
                            <div className="text-sm font-bold">Duplicates</div>
                            <div className="text-[10px] opacity-70">Conflict Resolution</div>
                        </div>
                        <div className="ml-auto bg-black/20 px-2 py-0.5 rounded textxs font-mono">
                            {cleaningReport.duplicatesGroups.length}
                        </div>
                    </button>
                </div>

                {/* Content Panel */}
                <div className="flex-grow bg-[#0f172a] relative flex flex-col">

                    {/* Tab 1: Standardization */}
                    {activeTab === 'standardization' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Toolbar */}
                            <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.02]">
                                <div className="text-sm text-slate-400">
                                    <span className="text-white font-bold">{approvedStandardizations.size}</span> approved,
                                    <span className="text-rose-400 font-bold ml-2">{rejectedStandardizations.size}</span> rejected
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleBulkStandardizationAction('approve_all')}
                                        className="text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-colors"
                                    >
                                        Approve All
                                    </button>
                                    <button
                                        onClick={() => handleBulkStandardizationAction('reject_all')}
                                        className="text-xs font-bold text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors"
                                    >
                                        Reject All
                                    </button>
                                </div>
                            </div>

                            {/* Grid */}
                            <div className="flex-grow overflow-auto custom-scrollbar p-6">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#0f172a] z-10">
                                        <tr>
                                            <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/10">Record</th>
                                            <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/10">Field</th>
                                            <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/10">Original</th>
                                            <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/10">Proposed</th>
                                            <th className="p-3 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/10 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {standardizationRows.map((row) => (
                                            <tr key={row.uniqueKey} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="p-3 text-sm font-medium text-white">{row.recordName}</td>
                                                <td className="p-3 text-sm text-slate-400 font-mono text-xs">{row.field}</td>
                                                <td className="p-3 text-sm text-rose-300/70 line-through decoration-rose-500/50">{row.oldValue}</td>
                                                <td className="p-3 text-sm text-emerald-400 font-bold flex items-center gap-2">
                                                    {row.newValue}
                                                    <ArrowRight className="w-3 h-3 opacity-50" />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => toggleStandardization(row.uniqueKey, 'approve')}
                                                            className={`p-1.5 rounded-md transition-all ${row.isApproved
                                                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                                : 'text-slate-500 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleStandardization(row.uniqueKey, 'reject')}
                                                            className={`p-1.5 rounded-md transition-all ${row.isRejected
                                                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                                                                : 'text-slate-500 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Duplicates */}
                    {activeTab === 'duplicates' && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Toolbar */}
                            <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.02]">
                                <div className="text-sm text-slate-400">
                                    <span className="text-white font-bold">{cleaningReport.duplicatesGroups.length}</span> conflict groups detected
                                </div>
                            </div>

                            <div className="flex-grow overflow-auto custom-scrollbar p-6 space-y-8">
                                {cleaningReport.duplicatesGroups.map((group, groupIndex) => {
                                    // We only compare the first two for the visual split-view (Record A vs Record B)
                                    // In a real scenario, we might handle n-way merges, but side-by-side implies 2.
                                    const idA = group[0];
                                    const idB = group[1];
                                    const recordA = getRecord(idA);
                                    const recordB = getRecord(idB);

                                    if (!recordA || !recordB) return null;

                                    return (
                                        <div key={groupIndex} className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden">
                                            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 font-bold text-xs">
                                                        #{groupIndex + 1}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-white">Potential Duplicate Detected</h3>
                                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Confidence: High • Distance: ~5m</p>
                                                    </div>
                                                </div>

                                                <div className="flex bg-black/50 p-1 rounded-lg">
                                                    <button className="px-4 py-1.5 rounded-md text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                                                        Ignore
                                                    </button>
                                                    <button className="px-4 py-1.5 rounded-md text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                                                        Keep Both
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Split View */}
                                            <div className="grid grid-cols-[1fr_auto_1fr] relative">

                                                {/* Record A (Left) */}
                                                <div className="p-6 space-y-4 bg-red-500/5">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="text-xs font-black text-rose-400 uppercase tracking-widest">Existing Record (A)</div>
                                                        <div className="px-2 py-0.5 rounded border border-rose-500/30 text-[10px] text-rose-400 bg-rose-500/10">{recordA.id.split('-')[0]}</div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div>
                                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Business Name</div>
                                                            <div className="text-sm font-bold text-white">{recordA.name}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Address</div>
                                                            <div className="text-xs text-slate-300">{recordA.address}</div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Lat</div>
                                                                <div className="text-xs font-mono text-slate-400">{recordA.lat.toFixed(5)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Lng</div>
                                                                <div className="text-xs font-mono text-slate-400">{recordA.lng.toFixed(5)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Center (Middle) */}
                                                <div className="w-16 flex flex-col items-center justify-center gap-4 relative z-10">
                                                    <div className="absolute inset-0 bg-[#0f172a] border-x border-white/5" />
                                                    <button className="relative z-10 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:bg-white/10 hover:text-white transition-all">
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                    <div className="relative z-10">
                                                        <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent mx-auto" />
                                                    </div>
                                                    <button className="relative z-10 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:bg-white/10 hover:text-white transition-all" style={{ transform: 'rotate(180deg)' }}>
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Record B (Right) */}
                                                <div className="p-6 space-y-4 bg-emerald-500/5">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="text-xs font-black text-emerald-400 uppercase tracking-widest">Incoming / Duplicate (B)</div>
                                                        <div className="px-2 py-0.5 rounded border border-emerald-500/30 text-[10px] text-emerald-400 bg-emerald-500/10">{recordB.id.split('-')[0]}</div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div>
                                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Business Name</div>
                                                            <div className="text-sm font-bold text-white flex items-center justify-between">
                                                                {recordB.name}
                                                                {recordA.name !== recordB.name && <AlertCircle className="w-3 h-3 text-amber-500" />}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] text-slate-500 uppercase font-bold">Address</div>
                                                            <div className="text-xs text-slate-300 flex items-center justify-between">
                                                                {recordB.address}
                                                                {recordA.address !== recordB.address && <AlertCircle className="w-3 h-3 text-amber-500" />}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Lat</div>
                                                                <div className="text-xs font-mono text-slate-400">{recordB.lat.toFixed(5)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold">Lng</div>
                                                                <div className="text-xs font-mono text-slate-400">{recordB.lng.toFixed(5)}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>

                                            {/* Merge Controls */}
                                            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-center gap-4">
                                                <button
                                                    onClick={() => handleMergeResolution(groupIndex, 'KEEP_A')}
                                                    className={`px-6 py-2 rounded-lg font-bold text-xs transition-all border ${resolvedMerges.get(groupIndex.toString()) === 'KEEP_A'
                                                        ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                                                        : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'
                                                        }`}
                                                >
                                                    Keep A (Discard B)
                                                </button>
                                                <button
                                                    onClick={() => handleMergeResolution(groupIndex, 'KEEP_B')}
                                                    className={`px-6 py-2 rounded-lg font-bold text-xs transition-all border ${resolvedMerges.get(groupIndex.toString()) === 'KEEP_B'
                                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'
                                                        }`}
                                                >
                                                    Keep B (Overwrite A)
                                                </button>
                                                <button
                                                    onClick={() => handleMergeResolution(groupIndex, 'SMART_MERGE')}
                                                    className={`px-6 py-2 rounded-lg font-bold text-xs transition-all border flex items-center gap-2 ${resolvedMerges.get(groupIndex.toString()) === 'SMART_MERGE'
                                                        ? 'bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/20'
                                                        : 'bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500 hover:text-white'
                                                        }`}
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    Smart Merge
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* 3. Footer / Apply Bar */}
            <div className="h-20 border-t border-white/10 bg-[#0f172a] flex items-center justify-between px-8 flex-shrink-0">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Review Summary</span>
                    <span className="text-xs text-slate-400">
                        {approvedStandardizations.size} standardizations • {resolvedMerges.size} merges selected
                    </span>
                </div>
                <button
                    onClick={() => onApply(approvedStandardizations, resolvedMerges)}
                    className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-black shadow-lg shadow-pink-500/20 transition-all active:scale-95 flex items-center gap-2"
                >
                    <CheckCircle2 className="w-5 h-5" />
                    APPLY CHANGES ({approvedStandardizations.size + resolvedMerges.size})
                </button>
            </div>
        </div>
    );
};

export default DataCleaningWorkbench;
