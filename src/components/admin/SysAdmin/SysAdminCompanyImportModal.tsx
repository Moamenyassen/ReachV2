import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Download,
    Search,
    Building2,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Database
} from 'lucide-react';
import {
    getAllCompanies,
    insertGlobalLeadsSmart,
    generateCustomerHash,
    fetchCompanyCustomers,
    getCompanyCustomerCounts
} from '../../../services/supabase';
import { Company } from '../../../types';

interface SysAdminCompanyImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const SysAdminCompanyImportModal: React.FC<SysAdminCompanyImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState<{ message: string; current: number; total: number } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [stats, setStats] = useState<{ added: number; skipped: number } | null>(null);
    const [companyStats, setCompanyStats] = useState<Record<string, number>>({});

    // Load Companies on Open
    useEffect(() => {
        if (isOpen) {
            loadCompanies();
            setStats(null);
            setSelectedIds(new Set());
        }
    }, [isOpen]);

    const loadCompanies = async () => {
        setLoading(true);
        try {
            const [data, stats] = await Promise.all([
                getAllCompanies(),
                getCompanyCustomerCounts()
            ]);
            setCompanies(data);
            setCompanyStats(stats);
        } catch (err) {
            console.error("Failed to fetch companies/stats", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredCompanies.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCompanies.map(c => c.id)));
        }
    };

    // 3. EXECUTE IMPORT
    const handleImport = async () => {
        if (selectedIds.size === 0) return;
        setImporting(true);
        setProgress({ message: 'Initializing...', current: 0, total: 100 });

        try {
            // Selected Companies
            const targets = companies.filter(c => selectedIds.has(c.id));
            let totalAdded = 0;
            let totalSkipped = 0;
            let processedCount = 0;
            const totalCompanies = targets.length;

            // Iterate and Fetch Customers Deeply
            for (const company of targets) {
                try {
                    processedCount++;
                    setProgress({ message: `Fetching from ${company.name}...`, current: (processedCount / totalCompanies) * 50, total: 100 });

                    // Deep fetch from routes
                    const companyLeads = await fetchCompanyCustomers(company.id, (curr, tot) => {
                        // Optional: detailed fetch progress
                    });

                    if (companyLeads.length > 0) {
                        setProgress({ message: `Importing from ${company.name}...`, current: 50 + (processedCount / totalCompanies) * 50, total: 100 });

                        const result = await insertGlobalLeadsSmart(companyLeads, (p) => {
                            // p is percentage 0-100
                            // Map to overall progress?
                        });
                        totalAdded += result.added;
                        totalSkipped += result.skipped;
                    }
                } catch (err) {
                    console.error(`Failed to import from company ${company.name}`, err);
                }
            }

            setStats({ added: totalAdded, skipped: totalSkipped });
            setProgress(null);
            onSuccess(); // Refresh parent in background
        } catch (err) {
            console.error("Import failed", err);
            alert("Import failed. Check console.");
            setProgress(null);
        } finally {
            setImporting(false);
            setProgress(null);
        }
    };

    const filteredCompanies = useMemo(() => {
        if (!searchTerm) return companies;
        const lower = searchTerm.toLowerCase();
        return companies.filter(c =>
            c.name.toLowerCase().includes(lower) ||
            c.adminUsername?.toLowerCase().includes(lower)
        );
    }, [companies, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">

                {/* HEAD */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1e293b]">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Database className="w-6 h-6 text-pink-500" />
                        Fetch from Company Database
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>

                {/* TOOLBAR */}
                <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between gap-4">
                    <div className="relative flex-grow max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search existing companies..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                    </div>
                    {filteredCompanies.length > 0 && (
                        <div className="text-xs font-bold text-slate-400">
                            {selectedIds.size} Selected / {filteredCompanies.length} Available
                        </div>
                    )}
                </div>

                {/* BODY (TABLE) */}
                <div className="flex-grow overflow-auto custom-scrollbar p-6">
                    {progress ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-6">
                            <div className="w-full max-w-sm space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-400">
                                    <span>{progress.message}</span>
                                    <span>{Math.round((progress.current / (progress.total || 1)) * 100)}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-pink-500 transition-all duration-300 ease-out"
                                        style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                            <Loader2 className="w-8 h-8 text-pink-500 animate-spin opacity-50" />
                        </div>
                    ) : loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-4">
                            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                            <span className="text-slate-500 font-bold uppercase tracking-widest text-xs">Accessing Company Registry...</span>
                        </div>
                    ) : stats ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center ring-4 ring-emerald-500/10">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <div className="text-center">
                                <h4 className="text-2xl font-black text-white mb-2">Import Successful!</h4>
                                <p className="text-slate-400">{stats.added} companies added as leads.</p>
                                <p className="text-slate-500 text-xs mt-1">({stats.skipped} duplicates skipped)</p>
                            </div>
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                            <thead className="bg-white/5 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 border-b border-white/10 w-12">
                                        <input
                                            type="checkbox"
                                            checked={filteredCompanies.length > 0 && selectedIds.size === filteredCompanies.length}
                                            onChange={toggleAll}
                                            className="w-4 h-4 rounded border-white/20 bg-white/5 accent-pink-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3 border-b border-white/10 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Company Name</th>
                                    <th className="px-4 py-3 border-b border-white/10 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Est. Leads</th>
                                    <th className="px-4 py-3 border-b border-white/10 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Admin / Contact</th>
                                    <th className="px-4 py-3 border-b border-white/10 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Tier</th>
                                    <th className="px-4 py-3 border-b border-white/10 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCompanies.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-500 font-bold text-sm">No companies found matching search.</td>
                                    </tr>
                                ) : (
                                    filteredCompanies.map(c => (
                                        <tr key={c.id} className={`hover:bg-white/5 transition-colors border-b border-white/5 ${selectedIds.has(c.id) ? 'bg-pink-500/5' : ''}`}>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(c.id)}
                                                    onChange={() => toggleSelection(c.id)}
                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-pink-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-bold text-white text-sm">{c.name}</td>
                                            <td className="px-4 py-3 font-mono text-emerald-400 text-xs shadow-black drop-shadow-sm">
                                                {companyStats[c.id] ? companyStats[c.id].toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-xs font-mono">{c.adminUsername || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${c.subscriptionTier === 'ENTERPRISE' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    c.subscriptionTier === 'PROFESSIONAL' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                    }`}>{c.subscriptionTier}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs font-mono">{new Date(c.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-white/10 bg-[#1e293b] flex justify-between items-center">
                    <div className="text-xs text-slate-500 font-bold">
                        Selecting companies will import them as new "Unverified" leads.
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button
                            onClick={handleImport}
                            disabled={selectedIds.size === 0 || importing}
                            className={`px-6 py-2.5 rounded-xl font-black shadow-lg flex items-center gap-2 transition-all ${selectedIds.size === 0
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-pink-600 hover:bg-pink-500 text-white shadow-pink-500/20 active:scale-95'
                                }`}
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {importing ? 'Importing...' : `Import ${selectedIds.size} Selected`}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SysAdminCompanyImportModal;
