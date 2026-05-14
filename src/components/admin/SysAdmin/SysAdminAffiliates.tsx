import React, { useState, useEffect } from 'react';
import { PromoCode } from '../../../types';
import { getPromoCodes, updatePromoCode } from '../../../services/supabase';
import {
    Megaphone,
    TrendingUp,
    DollarSign,
    Users,
    Loader2,
    Briefcase,
    Pencil,
    X,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { PageHeader, InlineBanner } from './SysAdminShared';

const SysAdminAffiliates: React.FC = () => {
    const [affiliates, setAffiliates] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAffiliates();
    }, []);

    const loadAffiliates = async () => {
        setLoading(true);
        try {
            const codes = await getPromoCodes();
            // Filter for codes that are affiliate codes (have a commission %)
            const affiliateCodes = codes.filter(c => c.affiliate_percent && c.affiliate_percent > 0);
            setAffiliates(affiliateCodes);
        } catch (e) {
            console.error("Failed to load affiliates", e);
        } finally {
            setLoading(false);
        }
    };

    const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<PromoCode | null>(null);
    const [formData, setFormData] = useState({
        partnerFirstName: '',
        partnerLastName: '',
        partnerCompany: '',
        partnerEmail: '',
        partnerPhone: '',
        affiliatePercent: 0,
        isActive: true
    });

    const openEditModal = (partner: PromoCode) => {
        setEditingPartner(partner);
        setFormData({
            partnerFirstName: partner.partner_first_name || '',
            partnerLastName: partner.partner_last_name || '',
            partnerCompany: partner.partner_company || '',
            partnerEmail: partner.partner_email || '',
            partnerPhone: partner.partner_phone || '',
            affiliatePercent: partner.affiliate_percent || 0,
            isActive: partner.is_active
        });
        setIsEditModalOpen(true);
    };

    const handleSavePartner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPartner) return;

        try {
            await updatePromoCode(editingPartner.id, {
                partner_first_name: formData.partnerFirstName,
                partner_last_name: formData.partnerLastName,
                partner_company: formData.partnerCompany,
                partner_email: formData.partnerEmail,
                partner_phone: formData.partnerPhone,
                affiliate_percent: formData.affiliatePercent,
                is_active: formData.isActive
            });
            setIsEditModalOpen(false);
            setBanner({ type: 'success', message: 'Partner updated successfully' });
            loadAffiliates();
        } catch (error: any) {
            setBanner({ type: 'error', message: 'Failed to update partner: ' + error.message });
        }
    };

    const toggleStatus = async (partner: PromoCode) => {
        try {
            await updatePromoCode(partner.id, { is_active: !partner.is_active });
            loadAffiliates();
        } catch (error: any) {
            setBanner({ type: 'error', message: 'Failed to update status: ' + error.message });
        }
    };

    const totalPartners = affiliates.length;
    const totalRefers = affiliates.reduce((acc, curr) => acc + curr.usage_count, 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                icon={<Megaphone className="w-5 h-5" />}
                title="Affiliate Partners"
                subtitle={`${totalPartners} partners · ${totalRefers} total referrals`}
            />

            {banner && (
                <InlineBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
            )}

            {/* Content List */}
            <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
                <div className="p-4 border-b border-white/5 grid grid-cols-12 gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3">Partner Info</div>
                    <div className="col-span-2 text-center">Contact</div>
                    <div className="col-span-2 text-center">Referrals</div>
                    <div className="col-span-3">Commission %</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                        Loading partners...
                    </div>
                ) : affiliates.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        No affiliate partners found. Create a promo code with commission to see it here.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {affiliates.map((partner) => (
                            <div key={partner.id} className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-white/5 transition-colors group">
                                <div className="col-span-3">
                                    <div className="font-bold text-white text-lg font-mono">{partner.code}</div>
                                    <div className="text-sm text-slate-300">
                                        {[partner.partner_first_name, partner.partner_last_name].filter(Boolean).join(' ') || 'Unknown Partner'}
                                    </div>
                                    {partner.partner_company && <div className="text-xs text-slate-500">{partner.partner_company}</div>}
                                </div>
                                <div className="col-span-2 text-center">
                                    <div className="text-xs text-slate-400">{partner.partner_email || '-'}</div>
                                    <div className="text-xs text-slate-500">{partner.partner_phone || '-'}</div>
                                    <div className="mt-1 text-[10px] text-yellow-500 font-bold">{partner.affiliate_percent}% Cut</div>
                                </div>
                                <div className="col-span-2 text-center font-bold text-white flex items-center justify-center gap-2">
                                    <Users className="w-4 h-4 text-slate-500" /> {partner.usage_count}
                                </div>
                                <div className="col-span-3 font-mono text-yellow-400 font-bold">
                                    {partner.affiliate_percent ?? 0}%
                                    <span className="text-[10px] text-slate-500 font-sans font-normal ml-2">of deal value</span>
                                </div>
                                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => toggleStatus(partner)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${partner.is_active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'}`}
                                    >
                                        {partner.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                    <button
                                        onClick={() => openEditModal(partner)}
                                        className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#1e293b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Pencil className="w-5 h-5 text-yellow-400" /> Edit Partner
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSavePartner} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Partner Code</label>
                                <div className="text-xl font-black text-white px-4 py-2 bg-black/30 rounded-xl border border-white/10 font-mono">
                                    {editingPartner?.code}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">First Name</label>
                                    <input type="text" value={formData.partnerFirstName} onChange={e => setFormData({ ...formData, partnerFirstName: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Last Name</label>
                                    <input type="text" value={formData.partnerLastName} onChange={e => setFormData({ ...formData, partnerLastName: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Company Name</label>
                                <input type="text" value={formData.partnerCompany} onChange={e => setFormData({ ...formData, partnerCompany: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-yellow-500 outline-none" placeholder="Business Name" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                                    <input type="email" value={formData.partnerEmail} onChange={e => setFormData({ ...formData, partnerEmail: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-yellow-500 outline-none" placeholder="Email" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Phone</label>
                                    <input type="tel" value={formData.partnerPhone} onChange={e => setFormData({ ...formData, partnerPhone: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-yellow-500 outline-none" placeholder="Phone" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Commission %</label>
                                <input type="number" min="0" max="100" value={formData.affiliatePercent} onChange={e => setFormData({ ...formData, affiliatePercent: parseInt(e.target.value) })} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-yellow-500 outline-none" />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-3 cursor-pointer group p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-sm font-bold text-white">Partner Account Active</span>
                                    <input type="checkbox" className="hidden" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                                </label>
                            </div>

                            <button type="submit" className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded-xl font-bold mt-4">
                                Save Changes
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SysAdminAffiliates;
