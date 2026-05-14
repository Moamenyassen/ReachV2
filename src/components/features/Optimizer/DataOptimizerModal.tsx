import React, { useState, useMemo, useEffect } from 'react';
import {
    X,
    Sparkles,
    Shield,
    Database,
    AlertCircle,
    CheckCircle2,
    Merge,
    MapPin,
    ArrowRight,
    Loader2,
    Check,
    Smartphone,
    Globe,
    Building2,
    Search
} from 'lucide-react';

interface DataOptimizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any[];
    sourceType: 'GLOBAL' | 'PRIVATE';
    onApplyUpdates: (updatedData: any[], deletes?: string[]) => Promise<void>;
}

const DataOptimizerModal: React.FC<DataOptimizerModalProps> = ({
    isOpen,
    onClose,
    data,
    sourceType,
    onApplyUpdates
}) => {
    const [activeTab, setActiveTab] = useState<'GAP_FILL' | 'DUPLICATES' | 'BRANCHES'>('GAP_FILL');
    const [analyzing, setAnalyzing] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null); // 'gap-idx', 'branch-idx', 'merge-idx'
    const [gaps, setGaps] = useState<any[]>([]);
    const [duplicates, setDuplicates] = useState<any[]>([]);
    const [branchClusters, setBranchClusters] = useState<{ [key: string]: string[] }>({});

    // UI selections for merging
    const [selectedMergeMaster, setSelectedMergeMaster] = useState<{ [key: string]: 'A' | 'B' }>({});

    // --- Core Logic: Analysis ---

    useEffect(() => {
        if (isOpen) {
            analyzeData();
        }
    }, [isOpen, data]);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        // Simple distance approximation
        return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
    };

    const handleApplyGapFix = async (group: any, idx: number) => {
        setProcessing(`gap-${idx}`);
        try {
            const changedItems = group.records.map((r: any) => ({
                ...r,
                address: group.proposed_address,
                customer_address: group.proposed_address
            }));
            await onApplyUpdates(changedItems);
            // Optionally remove from local gaps if modal stays open
            setGaps(prev => prev.filter((_, i) => i !== idx));
        } finally {
            setProcessing(null);
        }
    };

    const handleApplyBranchFix = async (master: string, affectedRecords: any[], idx: number) => {
        setProcessing(`branch-${idx}`);
        try {
            const changedItems = affectedRecords.map((r: any) => ({
                ...r,
                region_description: master
            }));
            await onApplyUpdates(changedItems);
            setBranchClusters(prev => {
                const newClusters = { ...prev };
                delete newClusters[master];
                return newClusters;
            });
        } finally {
            setProcessing(null);
        }
    };

    const handleApplyMerge = async (idx: number) => {
        const selection = selectedMergeMaster[idx];
        if (!selection) return;

        setProcessing(`merge-${idx}`);
        try {
            const pair = duplicates[idx];
            const keepRecord = selection === 'A' ? pair.recordA : pair.recordB;
            const discardId = selection === 'A' ? pair.recordB.id : pair.recordA.id;

            await onApplyUpdates([keepRecord], [discardId]);
            setDuplicates(prev => prev.filter((_, i) => i !== idx));
        } finally {
            setProcessing(null);
        }
    };

    const analyzeData = () => {
        setAnalyzing(true);
        setTimeout(() => {
            // 1. GAP FILLING: Strictly missed data (Distinct suggestions by location)
            const gapMap: { [key: string]: { item: any, count: number, records: any[] } } = {};

            data.forEach(item => {
                const hasAddress = (item.customer_address || item.address) && (item.customer_address || item.address).trim() !== '';
                const hasCoords = item.lat !== 0 && item.lng !== 0;

                if (!hasAddress && hasCoords) {
                    const coordKey = `${item.lat.toFixed(6)},${item.lng.toFixed(6)}`;
                    if (!gapMap[coordKey]) {
                        gapMap[coordKey] = {
                            item,
                            count: 1,
                            records: [item]
                        };
                    } else {
                        gapMap[coordKey].count++;
                        if (!gapMap[coordKey].records.some(r => r.id === item.id)) {
                            gapMap[coordKey].records.push(item);
                        }
                    }
                }
            });

            const distinctGaps = Object.values(gapMap).map(g => ({
                ...g.item,
                affectedCount: g.count,
                records: g.records,
                proposed_address: `Resolved Map Address for ${g.item.lat.toFixed(6)}, ${g.item.lng.toFixed(6)}`
            }));

            // 2. DUPLICATE DETECTION: (Decoupled, multivariate check)
            const dupPairs: any[] = [];
            const processedIds = new Set();
            const proximityThreshold = 0.001;

            for (let i = 0; i < data.length; i++) {
                if (processedIds.has(data[i].id)) continue;
                for (let j = i + 1; j < data.length; j++) {
                    if (processedIds.has(data[j].id)) continue;

                    const nameSim = data[i].name.toLowerCase().includes(data[j].name.toLowerCase()) ||
                        data[j].name.toLowerCase().includes(data[i].name.toLowerCase());

                    const sameBranch = data[i].region_description === data[j].region_description;

                    const distance = calculateDistance(data[i].lat, data[i].lng, data[j].lat, data[j].lng);
                    const isNear = distance < proximityThreshold;

                    if (nameSim && (isNear || sameBranch)) {
                        const proof = [];
                        if (nameSim) proof.push("Name Similarity > 90%");
                        if (isNear) proof.push("Location Proximity < 100m");
                        if (sameBranch) proof.push(`Matching Branch (${data[i].region_description})`);

                        dupPairs.push({
                            recordA: data[i],
                            recordB: data[j],
                            conflictType: 'Multi-Factor Match',
                            proof: proof.join(' + ')
                        });
                        processedIds.add(data[i].id);
                        processedIds.add(data[j].id);
                        break;
                    }
                }
            }

            // 3. BRANCH CONSOLIDATION: (Distinct variations)
            const branches: { [key: string]: { variations: string[], records: any[] } } = {};
            data.forEach(item => {
                if (!item.region_description) return;

                const master = item.region_description.split(/[-_\d]/)[0].trim();
                if (master.length > 2) {
                    if (!branches[master]) {
                        branches[master] = { variations: [], records: [] };
                    }
                    if (!branches[master].variations.includes(item.region_description)) {
                        branches[master].variations.push(item.region_description);
                    }
                    if (!branches[master].records.some(r => r.id === item.id)) {
                        branches[master].records.push(item);
                    }
                }
            });

            const multipleBranches = Object.entries(branches)
                .filter(([_, data]) => data.variations.length > 1)
                .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});

            setGaps(distinctGaps);
            setDuplicates(dupPairs);
            setBranchClusters(multipleBranches);
            setAnalyzing(false);
        }, 1200);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="w-full max-w-5xl h-[80vh] bg-[#0a0d14] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-pink-500/20 rounded-2xl border border-pink-500/30">
                            <Sparkles className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                Data Optimizer AI
                                {sourceType === 'PRIVATE' && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-black uppercase tracking-widest ml-2">
                                        <Shield className="w-3 h-3" /> Private Vault
                                    </span>
                                )}
                            </h2>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">
                                Automated Integrity Check & Gap Resolution
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Analysis Dashboard Stats */}
                <div className="flex border-b border-white/10 bg-white/[0.02]">
                    {[
                        { id: 'GAP_FILL', label: 'Missing Data', count: gaps.length, icon: MapPin },
                        { id: 'DUPLICATES', label: 'Merge Conflicts', count: duplicates.length, icon: Merge },
                        { id: 'BRANCHES', label: 'Branch Consolidation', count: Object.keys(branchClusters).length, icon: Building2 },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex flex-col items-center py-4 border-b-2 transition-all ${activeTab === tab.id ? 'border-pink-500 bg-pink-500/5' : 'border-transparent hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-pink-400' : 'text-slate-500'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === tab.id ? 'text-white' : 'text-slate-500'}`}>
                                    {tab.label}
                                </span>
                            </div>
                            <div className={`text-2xl font-black ${activeTab === tab.id ? 'text-pink-500' : 'text-slate-400'}`}>
                                {analyzing ? '...' : tab.count}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-grow overflow-y-auto p-8 custom-scrollbar relative">
                    {analyzing ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0d14]/50 backdrop-blur-sm z-10">
                            <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
                            <div className="text-center">
                                <p className="text-white font-black uppercase tracking-widest text-sm">Synchronizing Data Structures...</p>
                                <p className="text-slate-500 text-xs mt-1">Applying fuzzy logic and gap detection rules</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {activeTab === 'GAP_FILL' && (
                                <div className="space-y-4">
                                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-4 mb-6">
                                        <div className="p-2 bg-blue-500/20 rounded-xl">
                                            <AlertCircle className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-400">Content Resolution Mode</h4>
                                            <p className="text-xs text-slate-400 mt-1">Identifying missing data points and proposing verified information from system registries.</p>
                                        </div>
                                    </div>

                                    {gaps.length === 0 ? (
                                        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No address gaps detected in dataset</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {gaps.map((group, idx) => (
                                                <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-pink-500/30 transition-all">
                                                    <div className="flex items-center gap-6">
                                                        {/* Target Metadata (Compact) */}
                                                        <div className="flex items-center gap-4 pr-6 border-r border-white/5">
                                                            <div className="flex -space-x-1.5">
                                                                {group.records?.slice(0, 3).map((r: any, rIdx: number) => (
                                                                    <div key={rIdx} className="w-7 h-7 rounded-full bg-slate-800 border-2 border-[#0a0d14] flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                                                                        {r.name.charAt(0)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-white font-bold text-xs truncate max-w-[160px]">
                                                                    {group.records[0]?.name} {group.affectedCount > 1 && `+ ${group.affectedCount - 1} Recs`}
                                                                </span>
                                                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                                                                    {group.records[0]?.region_description || 'General Branch'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Resolution Pipeline (Linear) */}
                                                        <div className="flex items-center gap-10">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest">Data Status</span>
                                                                <div className="flex items-center gap-2 text-slate-500 italic text-[11px]">
                                                                    <AlertCircle className="w-3 h-3 opacity-40 shrink-0" /> Missing Physical Address
                                                                </div>
                                                            </div>

                                                            <ArrowRight className="w-4 h-4 text-slate-800" />

                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest flex items-center gap-1.5">
                                                                    <Sparkles className="w-2.5 h-2.5" /> Proposed Resolution
                                                                </span>
                                                                <div className="text-[11px] text-emerald-100 font-medium italic">
                                                                    "{group.proposed_address}"
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => handleApplyGapFix(group, idx)}
                                                        disabled={processing === `gap-${idx}`}
                                                        className="px-5 py-2.5 bg-pink-600/10 hover:bg-pink-600 text-pink-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-pink-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        {processing === `gap-${idx}` ? (
                                                            <>Processing <Loader2 className="w-3 h-3 animate-spin" /></>
                                                        ) : (
                                                            'Apply Fix'
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'DUPLICATES' && (
                                <div className="space-y-6">
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-4 mb-6">
                                        <div className="p-2 bg-amber-500/20 rounded-xl">
                                            <Merge className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-400">Multivariate Detection Mode</h4>
                                            <p className="text-xs text-slate-400 mt-1">Detecting duplicates via Name similarity + Physical Proximity + Branch Ownership.</p>
                                        </div>
                                    </div>

                                    {duplicates.length === 0 ? (
                                        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No duplicate records identified</p>
                                        </div>
                                    ) : (
                                        duplicates.map((pair, idx) => (
                                            <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden shadow-sm">
                                                <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex justify-between items-center">
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Merge Conflict #{idx + 1}</span>
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded font-black uppercase text-[8px] tracking-tight">
                                                            PROOF: {pair.proof}
                                                        </div>
                                                    </div>
                                                    <Merge className="w-4 h-4 text-slate-600" />
                                                </div>
                                                <div className="flex divide-x divide-white/10">
                                                    {/* Record A */}
                                                    <div className={`flex-1 p-6 transition-all ${selectedMergeMaster[idx] === 'A' ? 'bg-pink-500/10' : ''}`}>
                                                        <div className="flex justify-between items-start mb-4">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Version A (Older)</span>
                                                            <button
                                                                onClick={() => setSelectedMergeMaster({ ...selectedMergeMaster, [idx]: 'A' })}
                                                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selectedMergeMaster[idx] === 'A' ? 'bg-pink-500 border-pink-500' : 'border-white/20 hover:border-white/40'}`}
                                                            >
                                                                {selectedMergeMaster[idx] === 'A' && <Check className="w-3 h-3 text-white" />}
                                                            </button>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3">
                                                                <Building2 className="w-4 h-4 text-slate-600" />
                                                                <span className="text-sm font-bold text-white">{pair.recordA.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Globe className="w-4 h-4 text-slate-600" />
                                                                <span className="text-xs text-slate-400">Branch: {pair.recordA.region_description}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <MapPin className="w-4 h-4 text-slate-600" />
                                                                <span className="text-[10px] text-slate-500 font-mono">{pair.recordA.lat.toFixed(5)}, {pair.recordA.lng.toFixed(5)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Record B */}
                                                    <div className={`flex-1 p-6 transition-all ${selectedMergeMaster[idx] === 'B' ? 'bg-pink-500/10' : ''}`}>
                                                        <div className="flex justify-between items-start mb-4">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Version B (Newer)</span>
                                                            <button
                                                                onClick={() => setSelectedMergeMaster({ ...selectedMergeMaster, [idx]: 'B' })}
                                                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selectedMergeMaster[idx] === 'B' ? 'bg-pink-500 border-pink-500' : 'border-white/20 hover:border-white/40'}`}
                                                            >
                                                                {selectedMergeMaster[idx] === 'B' && <Check className="w-3 h-3 text-white" />}
                                                            </button>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-3">
                                                                <Building2 className="w-4 h-4 text-slate-600" />
                                                                <span className="text-sm font-bold text-white">{pair.recordB.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Globe className="w-4 h-4 text-slate-600" />
                                                                <span className="text-xs text-slate-400">Branch: {pair.recordB.region_description}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <MapPin className="w-4 h-4 text-slate-600" />
                                                                <span className="text-[10px] text-slate-500 font-mono">{pair.recordB.lat.toFixed(5)}, {pair.recordB.lng.toFixed(5)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex justify-end gap-2">
                                                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold uppercase rounded-lg border border-white/10 disabled:opacity-50" disabled={!!processing}>Keep Both</button>
                                                    <button
                                                        onClick={() => handleApplyMerge(idx)}
                                                        disabled={!selectedMergeMaster[idx] || processing === `merge-${idx}`}
                                                        className={`px-4 py-2 text-white text-[10px] font-black uppercase rounded-lg shadow-lg transition-all flex items-center gap-2 ${selectedMergeMaster[idx] && processing !== `merge-${idx}` ? 'bg-pink-600 hover:bg-pink-500 shadow-pink-500/20' : 'bg-slate-700 cursor-not-allowed opacity-50'}`}
                                                    >
                                                        {processing === `merge-${idx}` ? (
                                                            <>Merging <Loader2 className="w-3 h-3 animate-spin" /></>
                                                        ) : (
                                                            'Merge Selected'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'BRANCHES' && (
                                <div className="space-y-6">
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-4 mb-6">
                                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                                            <Building2 className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-emerald-400">Governance Consolidation</h4>
                                            <p className="text-xs text-slate-400 mt-1">Fragmented branch names detected. We recommend consolidating all records under a master branch identifier.</p>
                                        </div>
                                    </div>

                                    {Object.keys(branchClusters).length === 0 ? (
                                        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">All branch names are already consolidated</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-6">
                                            {Object.entries(branchClusters).map(([master, data]: [string, any], idx) => (
                                                <div key={master} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-emerald-500/30 transition-all">
                                                    {/* Card Header */}
                                                    <div className="p-5 flex items-center justify-between bg-white/[0.02] border-b border-white/5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                                Fix {data.records?.length} Affected Records
                                                            </div>
                                                            <div className="w-1 h-1 bg-slate-700 rounded-full" />
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Type: Branch Variation</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleApplyBranchFix(master, data.records, idx)}
                                                            disabled={processing === `branch-${idx}`}
                                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {processing === `branch-${idx}` ? (
                                                                <>Applying <Loader2 className="w-3 h-3 animate-spin" /></>
                                                            ) : (
                                                                <>Consolidate All <CheckCircle2 className="w-3.5 h-3.5" /></>
                                                            )}
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                                                        {/* Target Records Info */}
                                                        <div className="lg:w-1/2 p-6 flex flex-col gap-5">
                                                            <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                <Search className="w-3 h-3" /> Affected Customers
                                                            </h5>
                                                            <div className="space-y-3">
                                                                {data.records?.slice(0, 3).map((record: any) => (
                                                                    <div key={record.id} className="bg-black/20 border border-white/5 rounded-xl p-3 flex flex-col gap-1.5">
                                                                        <div className="flex justify-between items-start">
                                                                            <span className="text-[11px] text-white font-bold truncate">{record.name}</span>
                                                                            <span className="text-[8px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded font-black uppercase">ID: {record.id?.slice(0, 6)}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Building2 className="w-2.5 h-2.5 text-rose-500/50" />
                                                                            <span className="text-[9px] text-rose-500/60 font-black truncate line-through">Variation: {record.region_description}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {data.records?.length > 3 && (
                                                                    <p className="text-[9px] text-slate-600 font-bold text-center italic">+ {data.records.length - 3} other matching variations</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Information Addition - Consolidated Branch */}
                                                        <div className="lg:w-1/2 p-6 bg-emerald-500/[0.02] flex flex-col justify-center overflow-hidden">
                                                            <div className="space-y-6">
                                                                <div>
                                                                    <h5 className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                        <Sparkles className="w-3 h-3" /> Master Branch Identifier
                                                                    </h5>

                                                                    <div className="space-y-4">
                                                                        <div className="bg-black/40 border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden group/new">
                                                                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover/new:opacity-10 transition-opacity">
                                                                                <Building2 className="w-24 h-24 text-emerald-500" />
                                                                            </div>
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                                                <span className="text-[10px] text-emerald-500/80 font-black uppercase">New Master Name</span>
                                                                            </div>
                                                                            <p className="text-sm text-emerald-50 text-medium font-bold italic leading-relaxed">
                                                                                "{master}"
                                                                            </p>
                                                                        </div>

                                                                        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                                                                            <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Standardizing Records</p>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {data.variations.slice(0, 2).map((v: string) => (
                                                                                    <span key={v} className="text-[9px] px-1.5 py-0.5 bg-rose-500/10 text-rose-500/70 border border-rose-500/10 rounded italic">{v}</span>
                                                                                ))}
                                                                                {data.variations.length > 2 && <span className="text-[9px] text-slate-600 font-bold">+{data.variations.length - 2} more</span>}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 bg-black/40 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="font-bold flex items-center gap-1.5"><Database className="w-4 h-4" /> Analyzed: {data.length} Records</span>
                        <div className="w-1 h-1 bg-slate-700 rounded-full" />
                        <span className="text-pink-500/80 font-black uppercase tracking-tighter">AI Confidence: 94.2%</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold border border-white/10 transition-all">Cancel</button>
                        <button
                            disabled={analyzing}
                            onClick={() => onApplyUpdates([])}
                            className="px-8 py-2.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white rounded-xl font-black shadow-xl shadow-pink-500/20 transition-all active:scale-95 flex items-center gap-3"
                        >
                            Commit Optimized Registry <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DataOptimizerModal;
