import React, { useState, useEffect, useMemo } from 'react';
import { getReachLeads, updateReachCustomer, deleteReachCustomer, updateReachCustomerNotes } from '../../../services/supabase';
import {
    Users, Search, Building2, Clock, CheckCircle2, Edit2, Trash2, X,
    Loader2, StickyNote, Globe, Phone, Mail, UserCheck, AlertCircle, Filter
} from 'lucide-react';
import { PageHeader, InlineBanner, ConfirmModal, StatCard } from './SysAdminShared';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    lead:              { label: 'Lead',              cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
    NEW:               { label: 'New',               cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
    CONTACTED:         { label: 'Contacted',         cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    QUALIFIED:         { label: 'Qualified',         cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    LICENSE_REQUEST:   { label: 'License Request',   cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
    PROVISIONED:       { label: 'Provisioned',       cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    provisioned:       { label: 'Provisioned',       cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    STALE:             { label: 'Stale',             cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
};

const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || { label: status || 'Unknown', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20' };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
};

const LIFECYCLE_STATUSES = ['lead', 'NEW', 'CONTACTED', 'QUALIFIED', 'LICENSE_REQUEST', 'PROVISIONED', 'STALE'];

const SysAdminUsers: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'LICENSE_REQUEST' | 'PROVISIONED' | 'lead'>('ALL');
    const [loading, setLoading] = useState(true);
    const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

    // Edit State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [editForm, setEditForm] = useState<any>({ first_name: '', last_name: '', email: '', phone: '', company_name: '', country: '', role: '', status: '' });
    const [isSaving, setIsSaving] = useState(false);

    // Notes State
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [selectedForNotes, setSelectedForNotes] = useState<any>(null);
    const [noteContent, setNoteContent] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getReachLeads();
            setUsers(data || []);
        } catch (e) {
            console.error('Failed to load CRM data', e);
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const stats = useMemo(() => ({
        total: users.length,
        pending: users.filter(u => u.status === 'LICENSE_REQUEST').length,
        provisioned: users.filter(u => u.status === 'PROVISIONED' || u.status === 'provisioned').length,
        leads: users.filter(u => !u.status || u.status === 'lead' || u.status === 'NEW').length,
    }), [users]);

    const filteredUsers = useMemo(() => {
        let list = users;
        if (activeFilter !== 'ALL') {
            if (activeFilter === 'lead') {
                list = list.filter(u => !u.status || u.status === 'lead' || u.status === 'NEW');
            } else {
                list = list.filter(u => u.status === activeFilter);
            }
        }
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            list = list.filter(u =>
                u.first_name?.toLowerCase().includes(s) ||
                u.last_name?.toLowerCase().includes(s) ||
                u.email?.toLowerCase().includes(s) ||
                u.company_name?.toLowerCase().includes(s) ||
                u.phone?.toLowerCase().includes(s) ||
                u.country?.toLowerCase().includes(s)
            );
        }
        return list;
    }, [users, activeFilter, searchTerm]);

    const handleEditClick = (user: any) => {
        setEditingUser(user);
        setEditForm({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            phone: user.phone || '',
            company_name: user.company_name || '',
            country: user.country || '',
            role: user.role || '',
            status: user.status || 'lead',
        });
        setIsEditModalOpen(true);
    };

    const handleSubmitEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSaving(true);
        try {
            await updateReachCustomer(editingUser.id, editForm);
            setBanner({ type: 'success', message: 'Record updated successfully' });
            setIsEditModalOpen(false);
            loadData();
        } catch (e: any) {
            setBanner({ type: 'error', message: e.message || 'Update failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteReachCustomer(deleteTarget.id);
            setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
            setBanner({ type: 'success', message: 'Record deleted from CRM.' });
        } catch (e: any) {
            setBanner({ type: 'error', message: e.message || 'Delete failed. Check RLS permissions.' });
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedForNotes) return;
        setIsSavingNotes(true);
        try {
            await updateReachCustomerNotes(selectedForNotes.id, noteContent);
            setUsers(prev => prev.map(u => u.id === selectedForNotes.id ? { ...u, notes: noteContent } : u));
            setBanner({ type: 'success', message: 'Notes saved.' });
            setIsNotesModalOpen(false);
        } catch (e: any) {
            setBanner({ type: 'error', message: 'Failed to save notes.' });
        } finally {
            setIsSavingNotes(false);
        }
    };

    const FILTERS = [
        { id: 'ALL',             label: 'All Users',       count: stats.total },
        { id: 'lead',            label: 'New Leads',       count: stats.leads },
        { id: 'LICENSE_REQUEST', label: 'Pending License', count: stats.pending },
        { id: 'PROVISIONED',     label: 'Provisioned',     count: stats.provisioned },
    ] as const;

    const INPUT_CLS = 'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-indigo-500 transition-all text-sm';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <PageHeader
                icon={<Users className="w-5 h-5" />}
                title="Reach CRM"
                subtitle={`${stats.total} registered users · ${stats.pending} pending license requests`}
            />

            {banner && <InlineBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Registered" value={stats.total} icon={Users} iconColor="text-indigo-400" />
                <StatCard label="New Leads" value={stats.leads} icon={UserCheck} iconColor="text-blue-400" />
                <StatCard label="Pending License" value={stats.pending} icon={Clock} iconColor="text-amber-400" />
                <StatCard label="Provisioned" value={stats.provisioned} icon={CheckCircle2} iconColor="text-emerald-400" />
            </div>

            {/* Filter + Search Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-1 bg-[#1e293b]/50 border border-white/10 rounded-xl p-1 flex-wrap">
                    {FILTERS.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setActiveFilter(f.id as any)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeFilter === f.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                            {f.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === f.id ? 'bg-white/20' : 'bg-white/10'}`}>{f.count}</span>
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by name, email, company, country…"
                        className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:border-indigo-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
                {/* Column Headers */}
                <div className="px-6 py-3 border-b border-white/5 grid grid-cols-12 gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3">Company / Contact</div>
                    <div className="col-span-2">Email</div>
                    <div className="col-span-2">Phone / Country</div>
                    <div className="col-span-2">Role</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-1">Joined</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Loading CRM data…
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        No records found.
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredUsers.map(user => (
                            <div key={user.id} className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-white/[0.03] transition-colors group">
                                {/* Company / Contact */}
                                <div className="col-span-3 flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg shrink-0">
                                        {(user.company_name?.[0] || user.first_name?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-white font-bold text-sm truncate flex items-center gap-1.5">
                                            <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                                            {user.company_name || <span className="text-slate-500 italic">No company</span>}
                                        </div>
                                        <div className="text-slate-400 text-xs truncate">
                                            {user.first_name} {user.last_name}
                                        </div>
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="col-span-2 min-w-0">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate">
                                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                                        <span className="truncate">{user.email || '—'}</span>
                                    </div>
                                </div>

                                {/* Phone / Country */}
                                <div className="col-span-2 min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                                        <span className="truncate">{user.phone || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Globe className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{user.country || '—'}</span>
                                    </div>
                                </div>

                                {/* Role */}
                                <div className="col-span-2">
                                    <span className="text-xs text-slate-400 truncate block">{user.role || '—'}</span>
                                </div>

                                {/* Status */}
                                <div className="col-span-1">
                                    <StatusBadge status={user.status} />
                                </div>

                                {/* Joined */}
                                <div className="col-span-1 text-xs text-slate-500 font-mono">
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                                </div>

                                {/* Actions */}
                                <div className="col-span-1 flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => { setSelectedForNotes(user); setNoteContent(user.notes || ''); setIsNotesModalOpen(true); }}
                                        className={`p-2 rounded-lg transition-all ${user.notes ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                        title="Notes"
                                    >
                                        <StickyNote className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-indigo-500/20 hover:text-indigo-400 transition-all"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget({ id: user.id, name: user.company_name || `${user.first_name} ${user.last_name}` })}
                                        className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/15 transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* EDIT MODAL */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-[#1e293b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-indigo-400" /> Edit CRM Record
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">First Name</label>
                                    <input className={INPUT_CLS} value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Last Name</label>
                                    <input className={INPUT_CLS} value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Company Name</label>
                                <input className={INPUT_CLS + ' font-bold'} value={editForm.company_name} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} placeholder="Company name from registration" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Email</label>
                                    <input type="email" className={INPUT_CLS} value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Phone</label>
                                    <input className={INPUT_CLS} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Country</label>
                                    <input className={INPUT_CLS} value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Role</label>
                                    <input className={INPUT_CLS} value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Lifecycle Status</label>
                                <select className={INPUT_CLS + ' appearance-none'} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                    {LIFECYCLE_STATUSES.map(s => <option key={s} value={s} className="bg-[#1e293b]">{s}</option>)}
                                </select>
                            </div>
                            <button type="submit" disabled={isSaving} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRM MODAL */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title="Delete CRM Record"
                description="This permanently removes the user's record from the CRM. This action cannot be undone."
                target={deleteTarget?.name}
            />

            {/* NOTES MODAL */}
            {isNotesModalOpen && selectedForNotes && (
                <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <StickyNote className="w-4 h-4 text-amber-400" /> Internal Notes
                            </h3>
                            <button onClick={() => setIsNotesModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
                            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                                    {(selectedForNotes.company_name?.[0] || selectedForNotes.first_name?.[0] || '?').toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">{selectedForNotes.company_name || 'Individual'}</p>
                                    <p className="text-xs text-slate-400">{selectedForNotes.first_name} {selectedForNotes.last_name} · {selectedForNotes.email}</p>
                                </div>
                            </div>
                            <textarea
                                value={noteContent}
                                onChange={e => setNoteContent(e.target.value)}
                                placeholder="Add internal notes about this contact, follow-ups, deal stage…"
                                className="flex-1 min-h-[180px] bg-black/30 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-slate-600 focus:border-amber-500/50 outline-none resize-none leading-relaxed"
                            />
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsNotesModalOpen(false)} className="px-5 py-2.5 text-slate-400 hover:text-white font-bold text-sm transition-colors">Cancel</button>
                                <button onClick={handleSaveNotes} disabled={isSavingNotes} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                                    {isSavingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Save Notes</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SysAdminUsers;
