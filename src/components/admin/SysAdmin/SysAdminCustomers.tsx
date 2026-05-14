import React, { useState, useEffect } from 'react';
import { Company, UserRole } from '../../../types';
import {
    subscribeToCompanies,
    addCompany,
    updateCompany,
    deleteCompany,
    forceDeleteCompany,
    addGlobalUser,
    uploadCompanyLogo,
    getCustomerHistory,
    saveSystemSetting,
    getSubscriptionPlans,
    SubscriptionPlan
} from '../../../services/supabase';
import { formatPrice } from '../../../utils/currency';
import {
    Building2,
    Plus,
    Database,
    Settings,
    UserCog,
    Trash2,
    Edit,
    CheckCircle2,
    Calendar,
    HardDrive,
    X,
    Loader2,
    Activity,
    Ticket,
    Users,
    CreditCard
} from 'lucide-react';
import CompanySettingsModal from '../../CompanySettingsModal';
import SubscriptionConfig from '../SysAdmin/SubscriptionConfig';
import { AVAILABLE_FEATURES } from '../../../config/available_features';
import { ConfirmModal, PageHeader, InlineBanner } from './SysAdminShared';

const SysAdminCustomers: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);

    // Tenant Modal State
    const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
    const [isEditingTenant, setIsEditingTenant] = useState(false);
    const [creatingTenant, setCreatingTenant] = useState(false);
    const [tenantTab, setTenantTab] = useState<'GENERAL' | 'FEATURES' | 'SECURITY'>('GENERAL');

    // Tenant Form
    const [newName, setNewName] = useState('');
    const [newLogoUrl, setNewLogoUrl] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [newTier, setNewTier] = useState<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'>('STARTER');
    const [newMaxUsers, setNewMaxUsers] = useState(5);
    const [newMaxRoutes, setNewMaxRoutes] = useState(10);
    const [newMaxCustomers, setNewMaxCustomers] = useState(1000);
    const [newMaxScannerCap, setNewMaxScannerCap] = useState(100); // Default 100 leads/mo
    const [newExpirationDate, setNewExpirationDate] = useState('');
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
    const [forceWaiveFee, setForceWaiveFee] = useState(false);

    // Link Admin Modal
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [linkAdminUser, setLinkAdminUser] = useState('');
    const [linkAdminPass, setLinkAdminPass] = useState('');

    // Inline notifications
    const [banner, setBanner] = useState<{ type: 'error' | 'success' | 'warning'; message: string } | null>(null);
    const [linking, setLinking] = useState(false);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
    const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

    // Settings & Config
    const [settingsModalCompany, setSettingsModalCompany] = useState<Company | null>(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    // History Modal
    const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Company | null>(null);
    const [customerPromoHistory, setCustomerPromoHistory] = useState<any[]>([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    useEffect(() => {
        const unsub = subscribeToCompanies((data) => {
            setCompanies(data);
            setLoading(false);
        });
        getSubscriptionPlans().then(setPlans).catch(console.error);
        return () => unsub();
    }, []);

    // Load History
    useEffect(() => {
        if (isHistoryModalOpen && selectedCustomerForHistory) {
            getCustomerHistory(selectedCustomerForHistory.id).then(setCustomerPromoHistory).catch(console.error);
        }
    }, [isHistoryModalOpen, selectedCustomerForHistory]);

    // Handlers
    const resetTenantForm = () => {
        setNewName('');
        setNewLogoUrl('');
        setLogoFile(null);
        setNewTier('STARTER');
        setSelectedFeatures([]);
        setTenantTab('GENERAL');
        setNewMaxUsers(5);
        setNewMaxRoutes(5); // Default Sync 1:1
        setNewMaxCustomers(10000); // Annual 5 * 2000
        setNewMaxScannerCap(100);

        // Default expiry 1 year from now
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        setNewExpirationDate(nextYear.toISOString().split('T')[0]);

        setAdminUser('');
        setAdminPass('');
        setForceWaiveFee(false);
        setIsEditingTenant(false);
    };

    const handleCreateOrUpdateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingTenant(true);

        if (!newName.trim()) {
            setBanner({ type: 'error', message: 'Company Name is required' });
            setCreatingTenant(false);
            return;
        }

        if (!isEditingTenant && companies.find(c => c.name.toLowerCase() === newName.toLowerCase())) {
            setBanner({ type: 'error', message: 'A company with this name already exists' });
            setCreatingTenant(false);
            return;
        }

        try {
            let finalLogoUrl = newLogoUrl;
            if (logoFile) {
                try {
                    finalLogoUrl = await uploadCompanyLogo(logoFile, newName);
                } catch (uploadErr: any) {
                    console.error("Logo upload warning:", uploadErr);
                    setBanner({ type: 'error', message: `Logo upload failed: ${uploadErr.message}` });
                    setCreatingTenant(false);
                    return;
                }
            }

            if (isEditingTenant && selectedCompany) {
                await updateCompany(selectedCompany.id, {
                    name: newName,
                    subscriptionTier: newTier,
                    maxUsers: newMaxUsers,
                    maxRoutes: newMaxRoutes,
                    maxCustomers: newMaxCustomers,
                    maxScannerCap: newMaxScannerCap, // Save Scanner Cap
                    adminUsername: adminUser,
                    expirationDate: newExpirationDate || null,
                    logoUrl: finalLogoUrl,
                    features: selectedFeatures,
                    isActive: selectedCompany.isActive // Preserve status
                });
            } else {
                if (!adminUser.trim() || !adminPass.trim()) {
                    setBanner({ type: 'error', message: 'Admin username and password are required' });
                    return;
                }
                const newId = crypto.randomUUID(); // Generate proper UUID
                await addCompany({
                    id: newId,
                    name: newName,
                    subscriptionTier: newTier,
                    maxUsers: newMaxUsers,
                    maxRoutes: newMaxRoutes,
                    maxCustomers: newMaxCustomers,
                    maxScannerCap: newMaxScannerCap, // Save Scanner Cap
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    features: [],
                    adminUsername: adminUser,
                    expirationDate: newExpirationDate || null,
                    logoUrl: finalLogoUrl
                });
                await addGlobalUser({
                    username: adminUser,
                    password: adminPass,
                    role: UserRole.ADMIN,
                    isActive: true,
                    companyId: newId,
                    branchIds: []
                });
            }
            setIsTenantModalOpen(false);
            resetTenantForm();
        } catch (e: any) {
            setBanner({ type: 'error', message: e.message || 'Failed to save company' });
        } finally {
            setCreatingTenant(false);
        }
    };

    const handleEditTenantClick = (company: Company) => {
        setSelectedCompany(company); // Added for safety
        setIsEditingTenant(true);
        setNewName(company.name);
        setNewLogoUrl(company.logoUrl || '');
        setLogoFile(null);
        setNewTier(company.subscriptionTier);
        setNewMaxUsers(company.maxUsers);
        setNewMaxRoutes(company.maxRoutes || company.maxUsers); // Sync fallback
        setNewMaxCustomers(company.maxCustomers || company.maxUsers * 2000); // Sync fallback
        setNewMaxScannerCap(company.maxScannerCap || 100);
        setNewExpirationDate(company.expirationDate || '');
        setAdminUser(company.adminUsername || '');
        setAdminPass('');
        setSelectedFeatures(company.features || []);
        setForceWaiveFee(false); // Default to false on edit, or maybe we should store it? Assuming false for now.
        setTenantTab('GENERAL');
        setIsTenantModalOpen(true);
    };

    // Logic to handle User change -> Sync Routes & Customers
    const handleUsersChange = (val: number) => {
        setNewMaxUsers(val);
        setNewMaxRoutes(val); // 1:1 Sync
        setNewMaxCustomers(val * 2000); // Annual Capacity (approx 166/mo * 12)
    };

    const toggleCompanyActive = async (company: Company) => {
        try {
            await updateCompany(company.id, { isActive: !company.isActive });
        } catch (e: any) {
            setBanner({ type: 'error', message: e.message || 'Failed to update status' });
        }
    };

    const handleDeleteCompany = (company: Company) => {
        setCompanyToDelete(company);
        setDeleteConfirmationInput('');
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!companyToDelete) return;
        try {
            await forceDeleteCompany(companyToDelete.id);
            setIsDeleteModalOpen(false);
            setCompanyToDelete(null);
        } catch (e: any) {
            setBanner({ type: 'error', message: `Failed to delete company: ${e.message}` });
            setIsDeleteModalOpen(false);
        }
    };

    const handleLinkAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany) return;
        setLinking(true);
        try {
            await addGlobalUser({
                username: linkAdminUser,
                password: linkAdminPass,
                role: UserRole.ADMIN,
                isActive: true,
                companyId: selectedCompany.id,
                branchIds: []
            });
            await updateCompany(selectedCompany.id, { adminUsername: linkAdminUser });
            setIsLinkModalOpen(false);
            setSelectedCompany(null);
        } catch (e: any) {
            setBanner({ type: 'error', message: e.message || 'Failed to update admin access' });
        } finally {
            setLinking(false);
        }
    };

    const handleSaveConfig = async (config: any) => {
        try {
            await saveSystemSetting('subscription_config', config);
            setIsConfigModalOpen(false);
        } catch (e) {
            console.error(e);
            setBanner({ type: 'error', message: 'Failed to save config' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                icon={<Database className="w-5 h-5" />}
                title="Companies Database"
                subtitle={`${companies.filter(c => c.isActive).length} active · ${companies.length} total tenants`}
                actions={
                    <button onClick={() => { resetTenantForm(); setIsTenantModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
                        <Plus className="w-4 h-4" /> Provision Company
                    </button>
                }
            />

            {banner && (
                <InlineBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
            )}

            {/* Tenant Table */}
            <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4">Company Entity</th>
                                <th className="px-6 py-4">Admin User</th>
                                <th className="px-6 py-4">Last Upload</th>
                                <th className="px-6 py-4">Subscription</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Capacity (U/R/C)</th>
                                <th className="px-6 py-4 text-xs">License Expiry</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {companies.map(company => (
                                <tr key={company.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {company.logoUrl ? (
                                                <img src={company.logoUrl} alt={company.name} className="w-8 h-8 rounded-lg object-contain bg-white/10" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
                                                    {company.name.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-bold text-white">{company.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white">{company.adminUsername || 'N/A'}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedCompany(company);
                                                    setLinkAdminUser(company.adminUsername || `admin_${company.name.toLowerCase().replace(/\s+/g, '')}`);
                                                    setLinkAdminPass('');
                                                    setIsLinkModalOpen(true);
                                                }}
                                                className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
                                                title="Manage Admin Access"
                                            >
                                                <UserCog className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {company.lastUploadRecordCount ? `${company.lastUploadRecordCount} records` : 'Empty'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${company.subscriptionTier === 'ENTERPRISE' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : company.subscriptionTier === 'PROFESSIONAL' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                            {company.subscriptionTier}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleCompanyActive(company)}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold transition-all border ${company.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${company.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            {company.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-0.5 font-mono text-xs">
                                            <div className="flex items-center gap-1 text-blue-400">
                                                <Users className="w-3 h-3" /> {company.maxUsers}
                                            </div>
                                            <div className="flex items-center gap-1 text-emerald-400">
                                                <Building2 className="w-3 h-3" /> {company.maxRoutes || 0}
                                            </div>
                                            <div className="flex items-center gap-1 text-purple-400">
                                                <Database className="w-3 h-3" /> {company.maxCustomers || 0}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {company.expirationDate ? new Date(company.expirationDate).toLocaleDateString() : 'Lifetime'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setSelectedCustomerForHistory(company); setIsHistoryModalOpen(true); }}
                                                className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                                title="View History"
                                            >
                                                <Activity className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setSettingsModalCompany(company)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Settings">
                                                <Settings className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleEditTenantClick(company)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Edit">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteCompany(company)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALS */}
            {/* 1. Tenant Modal (Edit/Create) */}
            {isTenantModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    {/* Simplified for brevity - Assume standard layout but need content */}
                    <div className="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {isEditingTenant ? <Edit className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-emerald-400" />}
                                {isEditingTenant ? 'Edit Company Configuration' : 'Provision New Company'}
                            </h3>
                            <button onClick={() => setIsTenantModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" title="Close Modal" aria-label="Close Modal">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateOrUpdateCompany} className="flex-1 overflow-y-auto max-h-[70vh]">
                            {/* ... Content ... */}
                            <div className="p-6 space-y-6">
                                {/* BASIC INFO */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Company Name (ID)</label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                            placeholder="e.g. Acme Logistics"
                                            aria-label="Company Name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Company Logo</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="file"
                                                onChange={e => setLogoFile(e.target.files?.[0] || null)}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-2 py-2 text-white text-xs"
                                                aria-label="Upload Company Logo"
                                                title="Upload Company Logo"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Tier</label>
                                        <select value={newTier} onChange={e => setNewTier(e.target.value as any)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" aria-label="Select Subscription Tier">
                                            <option value="STARTER">Starter</option>
                                            <option value="PROFESSIONAL">Professional</option>
                                            <option value="ENTERPRISE">Enterprise</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Max Users</label>
                                        <input type="number" value={newMaxUsers} onChange={e => handleUsersChange(parseInt(e.target.value) || 0)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" aria-label="Max Users" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Max Routes (Agreed)</label>
                                        <input
                                            type="number"
                                            value={newMaxRoutes}
                                            onChange={(e) => setNewMaxRoutes(parseInt(e.target.value) || 0)}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                            aria-label="Max Routes"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Annual DB Cap</label>
                                        <input
                                            type="number"
                                            value={newMaxCustomers}
                                            onChange={(e) => setNewMaxCustomers(parseInt(e.target.value) || 0)}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                            aria-label="Annual Database Cap"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Max Scanner Leads</label>
                                        <input type="number" value={newMaxScannerCap} onChange={e => setNewMaxScannerCap(parseInt(e.target.value) || 0)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" aria-label="Max Scanner Leads" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">License Expiration</label>
                                        <input type="date" value={newExpirationDate} onChange={e => setNewExpirationDate(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" aria-label="License Expiration Date" />
                                    </div>
                                </div>

                                {/* Setup Fee Calculation */}
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-2">
                                            <CreditCard className="w-4 h-4" /> Setup Fee Status
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-slate-400">Force Waive</label>
                                            <input
                                                type="checkbox"
                                                checked={forceWaiveFee}
                                                onChange={e => setForceWaiveFee(e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                aria-label="Force Waive Setup Fee"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-sm text-slate-400">
                                            {(() => {
                                                if (forceWaiveFee) return "Fee manually waived by admin.";
                                                const planId = newTier === 'PROFESSIONAL' ? 'growth' : (newTier === 'ENTERPRISE' ? 'elite' : 'starter');
                                                const plan = plans.find(p => p.id === planId) || plans.find(p => p.name.toUpperCase() === newTier) || plans[0];
                                                const threshold = plan?.waive_threshold || 50;
                                                if (newMaxUsers >= threshold) return `Waived automatically (Users >= ${threshold})`;
                                                return `Charge applicable (< ${threshold} users)`;
                                            })()}
                                        </div>
                                        <div className="text-2xl font-black text-white">
                                            {(() => {
                                                if (forceWaiveFee) return "0 SAR";
                                                const planId = newTier === 'PROFESSIONAL' ? 'growth' : (newTier === 'ENTERPRISE' ? 'elite' : 'starter');
                                                const plan = plans.find(p => p.id === planId) || plans.find(p => p.name.toUpperCase() === newTier) || plans[0];
                                                const threshold = plan?.waive_threshold || 50;
                                                const fee = plan?.setup_fee || 3000;
                                                return newMaxUsers >= threshold ? "WAIVED" : `${fee.toLocaleString()} SAR`;
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-white/10 pt-4">
                                    <h4 className="text-sm font-bold text-white mb-4">Admin Credentials</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="text" value={adminUser} onChange={e => setAdminUser(e.target.value)} placeholder="Username" className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white" aria-label="Admin Username" />
                                        <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} placeholder={isEditingTenant ? "(Unchanged)" : "Password"} className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white" aria-label="Admin Password" />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsTenantModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:bg-white/5">Cancel</button>
                                    <button type="submit" disabled={creatingTenant} className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20">
                                        {creatingTenant ? <Loader2 className="animate-spin" /> : (isEditingTenant ? 'Save Changes' : 'Create Tenant')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Link Admin Modal */}
            {isLinkModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-8 space-y-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-white">Manage Admin Access</h3><button onClick={() => setIsLinkModalOpen(false)} title="Close" aria-label="Close"><X className="text-slate-500 hover:text-white w-6 h-6" /></button></div>
                        <form onSubmit={handleLinkAdmin} className="space-y-4">
                            <input type="text" value={linkAdminUser} onChange={e => setLinkAdminUser(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold" placeholder="Username" aria-label="Admin Username" />
                            <input type="text" value={linkAdminPass} onChange={e => setLinkAdminPass(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold" placeholder="Password" aria-label="Admin Password" />
                            <button type="submit" disabled={linking} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex justify-center items-center gap-2">{linking ? <Loader2 className="animate-spin" /> : 'Update Access'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Config & Settings */}
            {settingsModalCompany && <CompanySettingsModal company={settingsModalCompany} onClose={() => setSettingsModalCompany(null)} />}


            {/* History Modal */}
            {isHistoryModalOpen && selectedCustomerForHistory && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-[#1e293b] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-indigo-500" /> {selectedCustomerForHistory.name}
                                </h3>
                                <p className="text-slate-400 text-sm">Customer History & Usage</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 space-y-8">
                            {/* Overview Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Current Plan</div>
                                    <div className="text-white font-bold text-lg flex items-center gap-2">
                                        {selectedCustomerForHistory.subscriptionTier}
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCustomerForHistory.isActive ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                                            {selectedCustomerForHistory.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Joined Date</div>
                                    <div className="text-white font-bold text-lg">{new Date(selectedCustomerForHistory.createdAt).toLocaleDateString()}</div>
                                </div>
                            </div>

                            {/* History Table */}
                            <div>
                                <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Ticket className="w-4 h-4 text-emerald-500" /> Promo Code Usage</h4>
                                <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                                    {customerPromoHistory.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 text-sm">
                                            No usage history found for this customer.
                                        </div>
                                    ) : (
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                                <tr>
                                                    <th className="px-4 py-3">Date</th>
                                                    <th className="px-4 py-3">Action</th>
                                                    <th className="px-4 py-3 text-right">Records</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {customerPromoHistory.map((log: any) => (
                                                    <tr key={log.id}>
                                                        <td className="px-4 py-3 text-slate-300">{new Date(log.uploadDate).toLocaleDateString()}</td>
                                                        <td className="px-4 py-3 text-slate-300">{log.type}</td>
                                                        <td className="px-4 py-3 text-right font-mono text-emerald-400">{log.recordCount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen && !!companyToDelete}
                onClose={() => { setIsDeleteModalOpen(false); setCompanyToDelete(null); }}
                onConfirm={confirmDelete}
                title="Delete Company"
                description="This action cannot be undone. All users, customers, and routes belonging to this company will be permanently removed."
                target={companyToDelete?.name}
            />

        </div>
    );
};

export default SysAdminCustomers;
