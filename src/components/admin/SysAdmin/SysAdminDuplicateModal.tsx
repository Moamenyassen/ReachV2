import React, { useState } from 'react';
import {
    X,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
    MapPin,
    Loader2
} from 'lucide-react';
import { deleteGlobalReachLead } from '../../../services/supabase';

interface SysAdminDuplicateModalProps {
    isOpen: boolean;
    onClose: () => void;
    duplicates: any[][]; // Array of groups
    onResolve: () => void; // Trigger reload after resolution
}

const SysAdminDuplicateModal: React.FC<SysAdminDuplicateModalProps> = ({ isOpen, onClose, duplicates, onResolve }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [resolving, setResolving] = useState(false);
    const [resolvedCount, setResolvedCount] = useState(0);

    if (!isOpen) return null;
    if (duplicates.length === 0) return null;

    // Current Group
    const group = duplicates[currentIndex];
    const isFinished = currentIndex >= duplicates.length;

    const handleKeep = async (keepId: string) => {
        setResolving(true);
        try {
            // Delete all others in the group
            const toDelete = group.filter(item => item.id !== keepId);
            await Promise.all(toDelete.map(item => deleteGlobalReachLead(item.id)));

            setResolvedCount(prev => prev + 1);
            if (currentIndex < duplicates.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                // Done
                onResolve();
                onClose();
            }
        } catch (err) {
            console.error("Failed to resolve duplicate", err);
            alert("Failed to resolve. Check console.");
        } finally {
            setResolving(false);
        }
    };

    const handleSkip = () => {
        if (currentIndex < duplicates.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onResolve();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">

                {/* HEAD */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1e293b]">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                        Resolve Duplicates
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-xs rounded-full border border-amber-500/20">
                            Group {currentIndex + 1} / {duplicates.length}
                        </span>
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>

                {/* BODY */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    <div className="text-center mb-8">
                        <h4 className="text-2xl font-black text-white mb-2">Duplicate Group Found</h4>
                        <p className="text-slate-400">Select the record you want to <span className="text-emerald-400 font-bold">KEEP</span>. The others will be permanently deleted.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {group.map(item => (
                            <div key={item.id} className="relative group/card">
                                <button
                                    onClick={() => handleKeep(item.id)}
                                    disabled={resolving}
                                    className="w-full text-left bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 flex flex-col h-full"
                                >
                                    <div className="mb-4">
                                        <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">ID: {item.id.split('-')[0]}</div>
                                        <div className="font-bold text-white text-lg line-clamp-2">{item.name}</div>
                                        <div className="text-slate-400 text-sm font-mono mt-1" dir="rtl">{item.name_ar || '-'}</div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <MapPin className="w-3 h-3 text-pink-500" />
                                            {Number(item.lat).toFixed(5)}, {Number(item.lng).toFixed(5)}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {item.region_description || 'No Region'}
                                        </div>
                                    </div>

                                    <div className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                        <div className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg">KEEP THIS</div>
                                    </div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-white/10 bg-[#1e293b] flex justify-between items-center">
                    <div className="text-xs text-slate-500 font-bold">
                        Resolved in this session: {resolvedCount}
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleSkip} className="px-6 py-2.5 font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
                            Skip Group <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SysAdminDuplicateModal;
