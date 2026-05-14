import React, { useState, useEffect } from 'react';
import { PromoCode } from '../../../types';
import {
    getPromoCodes,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
    getPromoUsageLogs
} from '../../../services/supabase';
import {
    Ticket,
    Plus,
    Loader2,
    X,
    Activity,
    Calendar,
    Users,
    Pencil,
    Trash2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { ConfirmModal } from './SysAdminShared';

const SysAdminPromos: React.FC = () => {
    // ... state ...
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit Promo State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [editPromoId, setEditPromoId] = useState<string | null>(null);

    // Form Fields
    const [formData, setFormData] = useState({
        code: '',
        discount: 10,
        affiliatePercent: 0,
        description: '',
        expiresAt: '',
        partnerFirstName: '',
        partnerLastName: '',
        partnerCompany: '',
        partnerEmail: '',
        partnerPhone: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Delete confirm state
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null);

    // Notification
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // Usage Logs State
    const [selectedPromoForUsage, setSelectedPromoForUsage] = useState<PromoCode | null>(null);
    const [promoUsageLogs, setPromoUsageLogs] = useState<any[]>([]);
    const [loadingUsage, setLoadingUsage] = useState(false);


    useEffect(() => {
        loadPromoCodes();
    }, []);

    const loadPromoCodes = async () => {
        setLoading(true);
        try {
            const codes = await getPromoCodes();
            setPromoCodes(codes || []);
        } catch (e) {
            console.error("Failed to load promo codes", e);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditPromoId(null);
        setFormData({
            code: '',
            discount: 10,
            affiliatePercent: 0,
            description: '',
            expiresAt: '',
            partnerFirstName: '',
            partnerLastName: '',
            partnerCompany: '',
            partnerEmail: '',
            partnerPhone: ''
        });
        setIsPromoModalOpen(true);
    };

    const openEditModal = (promo: PromoCode, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        setEditPromoId(promo.id);
        const expires = promo.expires_at ? new Date(promo.expires_at).toISOString().split('T')[0] : '';
        setFormData({
            code: promo.code,
            discount: promo.discount_percent,
            affiliatePercent: promo.affiliate_percent || 0,
            description: promo.description || '',
            expiresAt: expires,
            partnerFirstName: promo.partner_first_name || '',
            partnerLastName: promo.partner_last_name || '',
            partnerCompany: promo.partner_company || '',
            partnerEmail: promo.partner_email || '',
            partnerPhone: promo.partner_phone || ''
        });
        setIsPromoModalOpen(true);
    };

    const handleDeletePromo = (id: string, code: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteTarget({ id, code });
    };

    const confirmDeletePromo = async () => {
        if (!deleteTarget) return;
        try {
            await deletePromoCode(deleteTarget.id);
            setPromoCodes(prev => prev.filter(p => p.id !== deleteTarget.id));
            if (selectedPromoForUsage?.id === deleteTarget.id) {
                setSelectedPromoForUsage(null);
                setPromoUsageLogs([]);
            }
            showNotification(`Promo code ${deleteTarget.code} deleted`, 'success');
        } catch (e: any) {
            showNotification('Failed to delete promo code: ' + e.message, 'error');
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (editPromoId) {
                // UPDATE
                await updatePromoCode(editPromoId, {
                    code: formData.code,
                    discount_percent: formData.discount,
                    affiliate_percent: formData.affiliatePercent,
                    description: formData.description,
                    expires_at: formData.expiresAt || null, // Handle empty date as null to remove expiry
                    partner_first_name: formData.partnerFirstName,
                    partner_last_name: formData.partnerLastName,
                    partner_company: formData.partnerCompany,
                    partner_email: formData.partnerEmail,
                    partner_phone: formData.partnerPhone
                });
            } else {
                // CREATE
                await createPromoCode(
                    formData.code,
                    formData.discount,
                    formData.description || undefined,
                    formData.expiresAt || undefined,
                    formData.affiliatePercent > 0 ? formData.affiliatePercent : undefined,
                    {
                        firstName: formData.partnerFirstName,
                        lastName: formData.partnerLastName,
                        company: formData.partnerCompany,
                        email: formData.partnerEmail,
                        phone: formData.partnerPhone
                    }
                );
            }

            // Cleanup
            setIsPromoModalOpen(false);
            loadPromoCodes();
            showNotification(editPromoId ? 'Promo code updated' : 'Promo code created', 'success');
        } catch (e: any) {
            showNotification('Error: ' + e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePromoStatus = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await updatePromoCode(id, { is_active: !currentStatus });
            loadPromoCodes();
        } catch (e: any) {
            showNotification('Failed to update status: ' + e.message, 'error');
        }
    };

    const handlePromoClick = async (promo: PromoCode) => {
        setSelectedPromoForUsage(promo);
        setLoadingUsage(true);
        try {
            const logs = await getPromoUsageLogs(promo.id);
            setPromoUsageLogs(logs);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingUsage(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title Action Bar */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Ticket className="w-6 h-6 text-emerald-500" /> Promotion Manager
                </h2>
                <button
                    onClick={openCreateModal}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all hover:-translate-y-1 active:scale-95"
                >
                    <Plus className="w-5 h-5" /> Create Code
                </button>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500">Loading promos...</div>
                    ) : promoCodes.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 bg-black/40 rounded-2xl border border-white/10">No promo codes active. Create one to get started.</div>
                    ) : (
                        promoCodes.map((promo) => (
                            <div
                                key={promo.id}
                                onClick={() => handlePromoClick(promo)}
                                className={`group bg-black/40 border transition-all rounded-2xl p-5 cursor-pointer relative overflow-hidden ${selectedPromoForUsage?.id === promo.id ? 'border-emerald-500 bg-emerald-900/10' : 'border-white/10 hover:bg-white/5'}`}
                            >
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-2xl font-black text-white tracking-widest">{promo.code}</span>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1">
                                                <button onClick={(e) => togglePromoStatus(promo.id, promo.is_active, e)}>
                                                    {promo.is_active
                                                        ? <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">ACTIVE</span>
                                                        : <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 hover:bg-red-500/30 transition-colors">INACTIVE</span>
                                                    }
                                                </button>

                                                <div className="w-px h-4 bg-white/10 mx-1"></div>

                                                <button
                                                    onClick={(e) => openEditModal(promo, e)}
                                                    className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                                                    title="Edit Promo"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeletePromo(promo.id, promo.code, e)}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all"
                                                    title="Delete Promo"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-400 max-w-md line-clamp-1">{promo.description || 'No description provided.'}</p>
                                    </div>
                                    <div className="text-right pl-4">
                                        <div className="text-3xl font-bold text-emerald-400">-{promo.discount_percent}%</div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Discount</div>
                                    </div>
                                </div>

                                {(promo.partner_first_name || promo.partner_company) && (
                                    <div className="mt-3 bg-white/5 rounded-lg p-2 flex items-center gap-2 text-xs">
                                        <Users className="w-3 h-3 text-emerald-400" />
                                        <span className="text-slate-300">
                                            Partner: <span className="text-white font-bold">
                                                {[promo.partner_first_name, promo.partner_last_name].filter(Boolean).join(' ')}
                                            </span>
                                            {promo.partner_company && <span className="text-slate-500"> • {promo.partner_company}</span>}
                                        </span>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                                    <div className="flex items-center gap-4">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {promo.usage_count} Uses</span>
                                        {promo.affiliate_percent && <span className="text-blue-400">+{promo.affiliate_percent}% Comm</span>}
                                        {promo.expires_at && <span className="flex items-center gap-1 text-orange-400"><Calendar className="w-3 h-3" /> Exp: {new Date(promo.expires_at).toLocaleDateString()}</span>}
                                    </div>
                                    <div className="flex items-center gap-1 group-hover:text-emerald-400 transition-colors">
                                        View Usage Logs <Activity className="w-3 h-3" />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Details / Logs Panel */}
                <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl p-6 h-fit backdrop-blur-xl">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Usage Activity
                    </h3>

                    {selectedPromoForUsage ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
                                <div className="text-xs font-bold text-emerald-400 uppercase opacity-70">Selected Code</div>
                                <div className="text-xl font-bold text-white">{selectedPromoForUsage.code}</div>
                            </div>

                            {loadingUsage ? (
                                <div className="text-center py-8"><Loader2 className="animate-spin w-6 h-6 mx-auto text-emerald-500" /></div>
                            ) : promoUsageLogs.length > 0 ? (
                                <div className="space-y-3 relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-white/5" />

                                    {promoUsageLogs.map((log) => (
                                        <div key={log.id} className="relative pl-6">
                                            <div className="absolute left-[3px] top-2 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#1e293b]" />
                                            <div className="bg-black/40 border border-white/5 rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-white text-sm">{log.company_name}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">{new Date(log.used_at).toLocaleDateString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <div className="text-xs text-slate-400">
                                                        Subscribed to <span className="text-emerald-400 font-bold">{log.plan_id}</span> saving <span className="text-white">${log.amount_discounted}</span>
                                                    </div>
                                                    {log.status === 'SUCCESS' && <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">SUCCESS</span>}
                                                    {log.status === 'FAILED' && <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">FAILED</span>}
                                                    {log.status === 'PENDING' && <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">PENDING</span>}
                                                    {!log.status && <span className="text-[10px] font-bold bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded-full border border-slate-500/30">UNKNOWN</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    No usage logs found for this code yet.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500 text-sm italic">
                            Select a promo code from the list to view detailed usage logs.
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDeletePromo}
                title="Delete Promo Code"
                description="This will permanently remove the promo code and all associated usage logs. Active users with this code will no longer be able to apply it."
                target={deleteTarget?.code}
            />

            {/* Toast notification */}
            {notification && (
                <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 z-[200] ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                    {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-bold">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* CREATE/EDIT PROMO MODAL */}
            {isPromoModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#1e293b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plus className="w-5 h-5 text-emerald-500" /> {editPromoId ? 'Edit Promo Code' : 'Create Promo Code'}
                            </h3>
                            <button onClick={() => setIsPromoModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Code</label>
                                <input required type="text" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-mono uppercase focus:border-emerald-500 outline-none" placeholder="e.g. SUMMER2024" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Discount (%)</label>
                                <input required type="number" min="1" max="100" value={formData.discount} onChange={e => setFormData({ ...formData, discount: parseInt(e.target.value) })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none" placeholder="10" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Affiliate Commission (%)</label>
                                <input type="number" min="0" max="100" value={formData.affiliatePercent} onChange={e => setFormData({ ...formData, affiliatePercent: parseInt(e.target.value) })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Description (Optional)</label>
                                <textarea rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none resize-none" placeholder="Campaign details..." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Expiration (Optional)</label>
                                <input type="date" value={formData.expiresAt} onChange={e => setFormData({ ...formData, expiresAt: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none" />
                            </div>
                            <div className="border-t border-white/10 my-4 pt-4">
                                <h4 className="text-[10px] font-black text-emerald-500 uppercase mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2 italic">
                                        <Users className="w-3 h-3" /> Affiliate Partner Details
                                    </div>
                                    <span className="text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded-full text-emerald-400/60 border border-emerald-500/20">Optional</span>
                                </h4>
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">First Name <span className="text-[9px] opacity-50 ml-1">(Optional)</span></label>
                                        <input type="text" value={formData.partnerFirstName} onChange={e => setFormData({ ...formData, partnerFirstName: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none text-sm" placeholder="John" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Name <span className="text-[9px] opacity-50 ml-1">(Optional)</span></label>
                                        <input type="text" value={formData.partnerLastName} onChange={e => setFormData({ ...formData, partnerLastName: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none text-sm" placeholder="Doe" />
                                    </div>
                                </div>
                                <div className="space-y-2 mb-3">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Company Name <span className="text-[9px] opacity-50 ml-1">(Optional)</span></label>
                                    <input type="text" value={formData.partnerCompany} onChange={e => setFormData({ ...formData, partnerCompany: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none text-sm" placeholder="Acme Inc." />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email <span className="text-[9px] opacity-50 ml-1">(Optional)</span></label>
                                        <input type="email" value={formData.partnerEmail} onChange={e => setFormData({ ...formData, partnerEmail: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none text-sm" placeholder="partner@example.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone <span className="text-[9px] opacity-50 ml-1">(Optional)</span></label>
                                        <input type="tel" value={formData.partnerPhone} onChange={e => setFormData({ ...formData, partnerPhone: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-emerald-500 outline-none text-sm" placeholder="+966..." />
                                    </div>
                                </div>
                            </div>

                            <button disabled={isSubmitting} type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 mt-4">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : (editPromoId ? 'Update Code & Partner' : 'Generate Code')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SysAdminPromos;
