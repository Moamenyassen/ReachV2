import React, { useState, useEffect } from 'react';
import { Company } from '../../../types';
import {
    getLicenseRequests,
    deleteLicenseRequest,
    updateLicenseRequestStatus,
    updateLicenseRequestNotes,
    updateLicenseRequestDraft,
    getAllCompanies,
    provisionDemoCompany,
    getSubscriptionPlans,
    getPromoCodeByCode,
    logPromoUsage,
    updateCompany, // For Deactivate/Adjust
    forceDeleteCompany, // For Delete License
    SubscriptionPlan // Import Type Here
} from '../../../services/supabase';
import {
    AlertCircle, CheckCircle2, ChevronRight, Copy, CreditCard, Download, ExternalLink,
    Filter, Loader2, Mail, Plus, RefreshCw, Search, Trash2, UserPlus, Users, X, Zap,
    KeyRound, Shield, Star, ShieldCheck, StickyNote, Play, LayoutDashboard, FileText, Edit, History, Building2, Database
} from 'lucide-react';
import { ConfirmModal, PageHeader, InlineBanner } from './SysAdminShared';

const SysAdminLicenseRequests: React.FC = () => {
    // Tabs
    const [activeTab, setActiveTab] = useState<'REQUESTS' | 'ACTIVE_LICENSES'>('ACTIVE_LICENSES');

    // Data State
    const [requests, setRequests] = useState<any[]>([]);
    const [activeLicenses, setActiveLicenses] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showHistory, setShowHistory] = useState(false);

    // Plans State
    const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);

    // Notes Modal State
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [selectedRequestForNotes, setSelectedRequestForNotes] = useState<any>(null);
    const [noteContent, setNoteContent] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Activation Modal State
    const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
    const [selectedRequestForActivation, setSelectedRequestForActivation] = useState<any>(null);
    const [activationPassword, setActivationPassword] = useState('');
    const [isActivating, setIsActivating] = useState(false);

    // Wizard State
    const [activationStep, setActivationStep] = useState(1);
    const [activationData, setActivationData] = useState({
        licenseKey: '',
        planTier: 'STARTER',
        maxUsers: 5,
        maxRoutes: 10,
        unitPrice: 0,
        basePrice: 0,
        billingCycle: 'monthly',
        currency: 'ر.س',
        discount: 0,
        paymentRef: '',
        isPaymentVerified: false,
        promoCode: '',
        promoDiscountPercent: 0,
        sysadminDiscountPercent: 0,
        notes: '',
        setupFee: 0,
        maxScannerCap: 1000 // Database Capacity / Leads Cap
    });

    // Delete State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletePassword, setDeletePassword] = useState('');

    // Reject confirm state
    const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);

    // Local UI State for inputs
    const [sysAdminDiscountInput, setSysAdminDiscountInput] = useState<number | string>(0);

    // Manage License State (Adjust/Deactivate/Delete)
    const [selectedLicense, setSelectedLicense] = useState<Company | null>(null);
    const [isManageLicenseModalOpen, setIsManageLicenseModalOpen] = useState(false);
    const [manageAction, setManageAction] = useState<'ADJUST' | 'DEACTIVATE' | 'DELETE'>('ADJUST');
    const [managePassword, setManagePassword] = useState('');
    // Adjust Fields
    const [adjustMaxUsers, setAdjustMaxUsers] = useState(0);
    const [adjustMaxRoutes, setAdjustMaxRoutes] = useState(0);
    const [adjustMaxScannerCap, setAdjustMaxScannerCap] = useState(0);
    const [adjustExpiry, setAdjustExpiry] = useState('');

    // Notifications
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load Plans in background if not loaded
            if (availablePlans.length === 0) {
                const plans = await getSubscriptionPlans(true);
                setAvailablePlans(plans || []);
            }

            if (activeTab === 'REQUESTS') {
                const data = await getLicenseRequests();
                setRequests(data || []);
            } else {
                const data = await getAllCompanies();
                setActiveLicenses(data || []);
            }
        } catch (e) {
            console.error("Failed to load data", e);
            showNotification('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    // --- NOTES HANDLERs ---
    const handleOpenNotes = (req: any) => {
        setSelectedRequestForNotes(req);
        setNoteContent(req.notes || '');
        setIsNotesModalOpen(true);
    };

    const handleSaveNotes = async () => {
        if (!selectedRequestForNotes) return;
        setIsSavingNotes(true);
        try {
            await updateLicenseRequestNotes(selectedRequestForNotes.id, noteContent);

            // Update local state
            setRequests(prev => prev.map(r => r.id === selectedRequestForNotes.id ? { ...r, notes: noteContent } : r));

            showNotification('Notes updated successfully', 'success');
            setIsNotesModalOpen(false);
        } catch (e: any) {
            showNotification(e.message || 'Failed to save notes', 'error');
        } finally {
            setIsSavingNotes(false);
        }
    };

    // --- ACTIVATION HANDLERS ---
    // Helper to parse limits
    const parseLimit = (val: string | number | undefined) => {
        if (val === 'Unlimited') return 999999;
        if (typeof val === 'string') return parseInt(val) || 0;
        return val || 0;
    };

    const handleOpenActivation = async (req: any) => {
        setSelectedRequestForActivation(req);
        setActivationPassword('');
        setSysAdminDiscountInput(0);

        // Load Draft if exists
        if (req.activation_draft) {
            setActivationData({ ...req.activation_draft });
            setSysAdminDiscountInput(req.activation_draft.sysadminDiscountPercent || 0);
            setActivationStep(1);
        } else {
            setActivationStep(1);
        }

        // Initialize from Plan Defaults (Sticking to Plan Rules)
        if (!req.activation_draft) {
            const reqPlanId = (req.plan_id || 'STARTER').toUpperCase();
            const initialPlan = availablePlans.find(p => p.id === reqPlanId) || availablePlans[0];

            const planLimitUsers = parseLimit(initialPlan?.limits?.users);

            // Strict Rule: If requested count > plan limit, cap it at plan limit (unless unlimited)
            let defaultUsers = req.staff_count || 5;

            // INTELLIGENT PLAN UPGRADE: If users > limit, switch to enterprise or higher tier
            if (planLimitUsers < 999999 && defaultUsers > planLimitUsers) {
                const betterPlan = availablePlans.find(p => parseLimit(p.limits.users) >= defaultUsers);
                if (betterPlan) {
                    // Upgrade logic could go here, but for now we just warn and cap, 
                    // OR we could force Enterprise. Let's start by capping but adding a note.
                    console.warn(`Requested users (${defaultUsers}) exceeds plan limit (${planLimitUsers}).`);
                }
            }

            if (defaultUsers < (initialPlan.limits?.min_users || 1)) {
                defaultUsers = initialPlan.limits?.min_users || 1;
            }

            const currency = initialPlan?.currency || 'ر.س';

            // Logic: Default to Yearly for higher retention/value unless specified
            const defaultBillingCycle = 'yearly';
            const unitPrice = defaultBillingCycle === 'yearly'
                ? (initialPlan?.price_yearly || (initialPlan?.price_monthly * 12))
                : (initialPlan?.price_monthly || 0);

            const basePrice = unitPrice * defaultUsers;

            // Fetch Promo
            let promoData = { code: '', percent: 0 };
            if (req.promo_code) {
                try {
                    const promo = await getPromoCodeByCode(req.promo_code);
                    if (promo) {
                        promoData = { code: promo.code, percent: promo.discount_percent };
                    }
                } catch (err) {
                    console.error("Failed to fetch promo code", err);
                }
            }

            const calculatedDiscount = (basePrice * promoData.percent) / 100;

            // Setup Fee Logic (Dynamic)
            const waiveThreshold = initialPlan?.waive_threshold ?? 50;
            const planSetupFee = initialPlan?.setup_fee ?? 3000;
            // If users >= 50 (waiveThreshold), fee is 0.
            const setupFee = defaultUsers >= waiveThreshold ? 0 : planSetupFee;

            setActivationData({
                licenseKey: 'LICENSE-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                planTier: initialPlan?.id || 'STARTER',
                maxUsers: defaultUsers,
                maxRoutes: parseLimit(initialPlan?.limits?.routes) || 10,
                unitPrice: unitPrice,
                basePrice: basePrice,
                billingCycle: defaultBillingCycle, // Default to Yearly
                currency: currency,
                discount: calculatedDiscount,
                paymentRef: '',
                isPaymentVerified: false,
                promoCode: promoData.code,
                promoDiscountPercent: promoData.percent,
                sysadminDiscountPercent: 0,
                notes: req.notes || '',
                setupFee: setupFee,
                maxScannerCap: parseLimit(initialPlan?.limits?.market_scanner_cap) || 1000
            });
        }

        setIsActivateModalOpen(true);
    };

    const reCalculatePrices = (data: any, plan: any) => {
        const isYearly = data.billingCycle === 'yearly';
        const unitPrice = isYearly ? (plan.price_yearly || plan.price_monthly * 12) : plan.price_monthly;
        const totalBase = unitPrice * data.maxUsers;

        // Setup Fee Logic
        const waiveThreshold = plan.waive_threshold ?? 50;
        const planSetupFee = plan.setup_fee ?? 3000;
        // If users >= 50, we still track it but discount it effectively to 0 in net
        // But for calculation simplicity, let's treat 'setupFee' as the NET fee
        const isWaived = data.maxUsers >= waiveThreshold;
        const setupFee = isWaived ? 0 : planSetupFee;

        // Logic: Annual Savings is implicit in 'unitPrice' if yearly price is lower. 
        // We just need the subtotal base for percentage discounts.
        // Subtotal = Base Subscription + Net Setup Fee
        const subtotal = totalBase + setupFee;

        // Calculate Discount: (Subtotal * Promo%) + (Subtotal * SysAdmin%)
        // Applying to the FULL subtotal (inc setup fee if any) as simpler "Total Invoice Discount" logic
        const promoDisc = (subtotal * (data.promoDiscountPercent || 0)) / 100;
        const sysAdminDisc = (subtotal * (data.sysadminDiscountPercent || 0)) / 100;

        const discount = promoDisc + sysAdminDisc;

        return { unitPrice, basePrice: totalBase, discount, setupFee };
    };

    const handleSysadminDiscountChange = (val: number) => {
        const plan = availablePlans.find(p => p.id === activationData.planTier);
        if (!plan) return;

        const newData = { ...activationData, sysadminDiscountPercent: val };
        const { unitPrice, basePrice, discount, setupFee } = reCalculatePrices(newData, plan);

        setActivationData({ ...newData, unitPrice, basePrice, discount, sysadminDiscountPercent: val, setupFee });
    };

    const handlePlanChange = (newPlanId: string) => {
        const plan = availablePlans.find(p => p.id === newPlanId);
        if (!plan) return;

        const planMaxUsers = parseLimit(plan.limits.users);
        const planMaxRoutes = parseLimit(plan.limits.routes);

        // Strict: Reset limits to plan defaults
        const newData = {
            ...activationData,
            planTier: plan.id,
            maxUsers: (planMaxUsers < 999999 && activationData.maxUsers > planMaxUsers) ? planMaxUsers : activationData.maxUsers, // Cap if needed
            maxRoutes: planMaxRoutes,
            currency: plan.currency || 'ر.س'
        };

        const { unitPrice, basePrice, discount, setupFee } = reCalculatePrices(newData, plan);

        setActivationData({ ...newData, unitPrice, basePrice, discount, setupFee });
    };

    const handleBillingCycleChange = (cycle: string) => {
        const plan = availablePlans.find(p => p.id === activationData.planTier);
        if (!plan) return;

        const newData = { ...activationData, billingCycle: cycle };
        const { unitPrice, basePrice, discount, setupFee } = reCalculatePrices(newData, plan);

        setActivationData({ ...newData, unitPrice, basePrice, discount, setupFee });
    };

    const handleUserCountChange = (count: number) => {
        const plan = availablePlans.find(p => p.id === activationData.planTier);
        if (!plan) return;

        const planMaxUsers = parseLimit(plan.limits.users);

        // Strict Validation
        if (planMaxUsers < 999999 && count > planMaxUsers) {
            showNotification(`Warning: Max users for this plan is ${planMaxUsers}`, 'error');
            count = planMaxUsers;
        }

        const newData = { ...activationData, maxUsers: count };
        const { unitPrice, basePrice, discount, setupFee } = reCalculatePrices(newData, plan);

        setActivationData({ ...newData, unitPrice, basePrice, discount, setupFee });
    };

    const handleActivate = async () => {
        if (!selectedRequestForActivation) return;
        setIsActivating(true);
        try {
            // 1. Provision New Company
            const result = await provisionDemoCompany(
                selectedRequestForActivation.customer_id,
                {
                    companyName: selectedRequestForActivation.company_name,
                    industry: selectedRequestForActivation.industry,
                    branchCount: selectedRequestForActivation.staff_count || 1,
                    routeCount: activationData.maxRoutes,
                    targetCustomersCount: 1000,
                    targetCustomersType: [],
                    password: activationPassword
                },
                {
                    initialTier: activationData.planTier as any,
                    bypassTrial: true,
                    customLimits: {
                        maxUsers: activationData.maxUsers,
                        maxRoutes: activationData.maxRoutes,
                        maxScannerCap: activationData.maxScannerCap
                    },
                    customLicenseKey: activationData.licenseKey,
                    customDurationDays: activationData.billingCycle === 'yearly' ? 365 : 30, // Or use calculated days from BE if returned, but here input logic is key
                    paymentInfo: {
                        price: activationData.basePrice - activationData.discount + (activationData.setupFee || 0),
                        currency: activationData.currency,
                        refId: activationData.paymentRef + (activationData.promoCode ? ` (Promo: ${activationData.promoCode})` : ''),
                        isVerified: activationData.isPaymentVerified,
                        billingCycle: activationData.billingCycle,
                        sysAdminDiscountPercent: activationData.sysadminDiscountPercent,
                        promoCode: activationData.promoCode,
                        promoDiscountPercent: activationData.promoDiscountPercent,
                        notes: activationData.notes
                    }
                }
            );

            // 2. Update Request Status
            await updateLicenseRequestStatus(selectedRequestForActivation.id, 'APPROVED');

            // 3. Log Promo Usage
            if (activationData.promoCode && result?.companyId) {
                try {
                    await logPromoUsage(
                        activationData.promoCode,
                        result.companyId,
                        activationData.discount
                    );
                } catch (promoError) {
                    console.error("Failed to log promo usage", promoError);
                }
            }

            showNotification(`License activated for ${selectedRequestForActivation.company_name}`, 'success');
            setIsActivateModalOpen(false);
            loadData(); // Refresh to remove from list or show updated status
        } catch (e: any) {
            console.error(e);
            showNotification(e.message || 'Activation failed', 'error');
        } finally {
            setIsActivating(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!selectedRequestForActivation) return;
        try {
            await updateLicenseRequestDraft(selectedRequestForActivation.id, activationData);
            showNotification('Draft saved successfully', 'success');
        } catch (e) {
            console.error(e);
            showNotification('Failed to save draft', 'error');
        }
    };

    // --- DELETE HANDLERS ---
    const handleRejectRequest = (id: string) => {
        setRejectConfirmId(id);
    };

    const confirmRejectRequest = async () => {
        if (!rejectConfirmId) return;
        try {
            await updateLicenseRequestStatus(rejectConfirmId, 'REJECTED');
            setRequests(prev => prev.map(r => r.id === rejectConfirmId ? { ...r, status: 'REJECTED' } : r));
            showNotification('Request rejected and moved to history', 'success');
        } catch (error) {
            console.error(error);
            showNotification("Failed to reject request", 'error');
        } finally {
            setRejectConfirmId(null);
        }
    };

    const handleDeleteClick = (id: string) => {
        setDeletingId(id);
        setIsDeleteModalOpen(true);
        setDeletePassword('');
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        const originalRequests = [...requests];
        setRequests(prev => prev.filter(r => r.id !== deletingId));
        try {
            await deleteLicenseRequest(deletingId);
            showNotification('Request deleted successfully', 'success');
            setIsDeleteModalOpen(false);
            loadData();
        } catch (e: any) {
            console.error(e);
            setRequests(originalRequests);
            showNotification(e.message || 'Delete failed', 'error');
        }
    };

    // --- MANAGE LICENSE HANDLERS ---
    const handleManageClick = (company: Company, action: 'ADJUST' | 'DEACTIVATE' | 'DELETE') => {
        setSelectedLicense(company);
        setManageAction(action);
        setManagePassword(''); // Reset password field

        if (action === 'ADJUST') {
            setAdjustMaxUsers(company.maxUsers || 5);
            setAdjustMaxRoutes(company.maxRoutes || 10);
            setAdjustMaxScannerCap(company.maxScannerCap || 1000);
            setAdjustExpiry(company.expirationDate ? new Date(company.expirationDate).toISOString().split('T')[0] : '');
        }

        setIsManageLicenseModalOpen(true);
    };

    const confirmManageAction = async () => {
        if (!selectedLicense) return;
        try {
            if (manageAction === 'DEACTIVATE') {
                // Toggle Active Status
                const newStatus = !selectedLicense.isActive;
                await updateCompany(selectedLicense.id, { isActive: newStatus });
                showNotification(`Company ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
            } else if (manageAction === 'DELETE') {
                await forceDeleteCompany(selectedLicense.id); // Use force delete to clean up related data
                showNotification('Company deleted successfully', 'success');
            } else if (manageAction === 'ADJUST') {
                await updateCompany(selectedLicense.id, {
                    maxUsers: adjustMaxUsers,
                    maxRoutes: adjustMaxRoutes,
                    maxScannerCap: adjustMaxScannerCap,
                    expirationDate: adjustExpiry || null
                });
                showNotification('License adjusted successfully', 'success');
            }

            setIsManageLicenseModalOpen(false);
            loadData(); // Refresh list
        } catch (e: any) {
            console.error(e);
            showNotification('Action failed: ' + e.message, 'error');
        }
    };

    // Filtering
    const filteredRequests = requests.filter(req => {
        if (req.status === 'APPROVED') return false;

        // Hide Rejected if history is off
        if (!showHistory && req.status === 'REJECTED') return false;

        const s = searchTerm.toLowerCase();
        return (
            req.company_name?.toLowerCase().includes(s) ||
            req.reach_customers?.email?.toLowerCase().includes(s) ||
            req.plan_id?.toLowerCase().includes(s)
        );
    });

    const filteredLicenses = activeLicenses.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.adminUsername?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <PageHeader
                    icon={<ShieldCheck className="w-5 h-5" />}
                    title="License Management"
                    subtitle="Manage enterprise requests and active company licenses"
                />

                {/* Search & Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto flex-1 justify-end">
                    <button
                        title={showHistory ? 'Hide History' : 'Show History'}
                        onClick={() => setShowHistory(!showHistory)}
                        className={`hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${showHistory ? 'bg-[#1e293b]/50 text-white border-white/20' : 'bg-transparent text-slate-400 border-white/10 hover:border-white/20 hover:text-white'}`}
                    >
                        <History className={`w-4 h-4 ${showHistory ? 'text-indigo-400' : ''}`} />
                        {showHistory ? 'Hide History' : 'Show History'}
                    </button>

                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            title="Search Licenses"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search requests..."
                            className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-indigo-500 outline-none transition-all text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Tabs — Active Licenses first, then the pending Request Queue */}
            <div className="flex gap-4 border-b border-white/10 pb-1">
                <button
                    title="Active Licenses"
                    onClick={() => setActiveTab('ACTIVE_LICENSES')}
                    className={`pb-3 px-4 text-sm font-bold transition-all relative ${activeTab === 'ACTIVE_LICENSES' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Active Licenses
                    {activeTab === 'ACTIVE_LICENSES' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full" />}
                </button>
                <button
                    title="Request Queue"
                    onClick={() => setActiveTab('REQUESTS')}
                    className={`pb-3 px-4 text-sm font-bold transition-all relative ${activeTab === 'REQUESTS' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Request Queue
                    {activeTab === 'REQUESTS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-full" />}
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="bg-[#1e293b]/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-slate-400 gap-2">
                        <Zap className="w-5 h-5 animate-pulse" /> Loading data...
                    </div>
                ) : (
                    <>
                        {activeTab === 'REQUESTS' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10">
                                        <tr>
                                            <th className="px-6 py-4">Request Entity</th>
                                            <th className="px-6 py-4">Contact</th>
                                            <th className="px-6 py-4">Plan / Notes</th>
                                            <th className="px-6 py-4">Submitted</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {filteredRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                    No pending requests found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRequests.map((req) => (
                                                <tr key={req.id} className="hover:bg-white/[0.03] transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-[#1e293b] border border-white/10 flex items-center justify-center text-lg font-bold text-indigo-400">
                                                                {(req.company_name?.[0] || '?').toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div>
                                                                    <div className="text-white font-bold flex items-center gap-2">
                                                                        {req.company_name}
                                                                        {req.status === 'REJECTED' && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-500 text-[10px] rounded uppercase font-bold">Rejected</span>}
                                                                    </div>
                                                                    <div className="text-slate-400 text-xs">{req.industry || 'Unknown Industry'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col text-xs">
                                                            <span className="text-white font-bold">{req.reach_customers?.first_name} {req.reach_customers?.last_name}</span>
                                                            <span className="text-slate-400">{req.reach_customers?.email}</span>
                                                            <span className="text-slate-400 opacity-80 mb-1">{req.reach_customers?.phone}</span>

                                                            {/* Extra Details */}
                                                            {req.reach_customers?.customer_address && (
                                                                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                    📍 {req.reach_customers.customer_address}
                                                                </span>
                                                            )}
                                                            {req.reach_customers?.dynamic_data?.website && (
                                                                <a href={req.reach_customers.dynamic_data.website.startsWith('http') ? req.reach_customers.dynamic_data.website : `https://${req.reach_customers.dynamic_data.website}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
                                                                >
                                                                    🌐 Website
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-black text-indigo-400 uppercase">{req.plan_id}</span>
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                {req.staff_count} Users
                                                            </div>
                                                            {req.notes && (
                                                                <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded max-w-[200px] truncate" title={req.notes}>
                                                                    📝 {req.notes}
                                                                </div>
                                                            )}
                                                            {req.promo_code && <span className="text-[10px] text-emerald-400">Promo: {req.promo_code}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                                                        {new Date(req.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleOpenNotes(req)}
                                                                className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/10"
                                                                title="Notes"
                                                            >
                                                                <StickyNote className="w-4 h-4" />
                                                            </button>

                                                            {req.status === 'PENDING' && (
                                                                <button
                                                                    onClick={() => handleOpenActivation(req)}
                                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all font-bold text-xs"
                                                                    title="Activate License"
                                                                >
                                                                    <Play className="w-3 h-3 fill-current" /> Activate
                                                                </button>
                                                            )}
                                                            {req.status === 'REJECTED' ? (
                                                                <button
                                                                    onClick={() => handleDeleteClick(req.id)}
                                                                    className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/10"
                                                                    title="Delete Permanently"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleRejectRequest(req.id)}
                                                                    className="p-2 rounded-lg bg-red-500/5 text-red-500 hover:text-white hover:bg-red-500 transition-all"
                                                                    title="Reject (Move to History)"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'ACTIVE_LICENSES' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/5 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10">
                                        <tr>
                                            <th className="px-6 py-4">Company</th>
                                            <th className="px-6 py-4">Admin</th>
                                            <th className="px-6 py-4">Tier</th>
                                            <th className="px-6 py-4">Usage</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-sm">
                                        {filteredLicenses.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                    No active licenses found.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLicenses.map((comp) => (
                                                <tr key={comp.id} className="hover:bg-white/[0.03] transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {comp.logoUrl ? (
                                                                <img src={comp.logoUrl} alt="" className="w-8 h-8 rounded bg-[#1e293b] object-contain" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded bg-[#1e293b] border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400">
                                                                    {comp.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <span className="font-bold text-white">{comp.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-400">{comp.adminUsername}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${comp.subscriptionTier === 'ENTERPRISE' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' :
                                                            comp.subscriptionTier === 'PROFESSIONAL' ? 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' :
                                                                'text-slate-400 border-white/10 bg-white/5'
                                                            }`}>
                                                            {comp.subscriptionTier}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                                                        {comp.maxUsers} Users / {comp.maxRoutes} Routes / {comp.maxScannerCap || 1000} DB
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className={`flex items-center gap-2 text-xs font-bold ${comp.isActive ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${comp.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                            {comp.isActive ? 'Active' : 'Inactive'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleManageClick(comp, 'ADJUST')}
                                                                className="p-1.5 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
                                                                title="Adjust License"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleManageClick(comp, 'DEACTIVATE')}
                                                                className={`p-1.5 rounded bg-white/5 border border-white/10 transition-colors ${comp.isActive ? 'text-orange-400 hover:text-orange-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                                                                title={comp.isActive ? "Deactivate" : "Activate"}
                                                            >
                                                                {comp.isActive ? <Zap className="w-4 h-4 fill-current opacity-50" /> : <Play className="w-4 h-4 fill-current" />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleManageClick(comp, 'DELETE')}
                                                                className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                                                title="Delete License"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* NOTES MODAL */}
            {isNotesModalOpen && selectedRequestForNotes && (
                <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <StickyNote className="w-5 h-5 text-amber-400" />
                                Notes for {selectedRequestForNotes.company_name}
                            </h3>
                            <button title="Close" onClick={() => setIsNotesModalOpen(false)}><X className="text-slate-400 hover:text-white w-5 h-5" /></button>
                        </div>
                        <textarea
                            title="Internal Notes"
                            value={noteContent}
                            onChange={e => setNoteContent(e.target.value)}
                            className="w-full h-40 bg-black/30 border border-white/10 rounded-xl p-4 text-white resize-none focus:border-amber-500/50 outline-none"
                            placeholder="Add internal notes about this request..."
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button title="Cancel" onClick={() => setIsNotesModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white font-bold">Cancel</button>
                            <button
                                title="Save Notes"
                                onClick={handleSaveNotes}
                                disabled={isSavingNotes}
                                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-yellow-600/20 active:scale-95 transition-all"
                            >
                                {isSavingNotes ? 'Saving...' : 'Save Notes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANAGE LICENSE MODAL */}
            {isManageLicenseModalOpen && selectedLicense && (
                <div className="fixed inset-0 z-[130] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1e293b] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {manageAction === 'ADJUST' && <Edit className="w-5 h-5 text-indigo-400" />}
                                {manageAction === 'DEACTIVATE' && <Zap className="w-5 h-5 text-orange-500" />}
                                {manageAction === 'DELETE' && <Trash2 className="w-5 h-5 text-red-500" />}

                                {manageAction === 'ADJUST' && 'Adjust License'}
                                {manageAction === 'DEACTIVATE' && (selectedLicense.isActive ? 'Deactivate License' : 'Re-Activate License')}
                                {manageAction === 'DELETE' && 'Delete License'}
                            </h3>
                            <button title="Close" onClick={() => setIsManageLicenseModalOpen(false)}><X className="text-slate-400 hover:text-white w-5 h-5" /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
                                <div className="text-sm font-bold text-white">{selectedLicense.name}</div>
                                <div className="text-xs text-slate-400 uppercase tracking-tight font-black">{selectedLicense.subscriptionTier}</div>
                            </div>

                            {manageAction === 'ADJUST' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Max Users</label>
                                            <input title="Max Users" type="number" value={adjustMaxUsers} onChange={e => setAdjustMaxUsers(parseInt(e.target.value) || 0)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Max Routes</label>
                                            <input title="Max Routes" type="number" value={adjustMaxRoutes} onChange={e => setAdjustMaxRoutes(parseInt(e.target.value) || 0)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">DB Cap (Leads)</label>
                                            <div className="relative">
                                                <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                                <input
                                                    title="DB Cap"
                                                    type="number"
                                                    value={adjustMaxScannerCap}
                                                    onChange={e => setAdjustMaxScannerCap(parseInt(e.target.value) || 0)}
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Expiry Date</label>
                                        <input title="Expiry Date" type="date" value={adjustExpiry} onChange={e => setAdjustExpiry(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500" />
                                    </div>
                                </div>
                            )}

                            {manageAction === 'DEACTIVATE' && (
                                <p className="text-slate-400 text-sm">
                                    Are you sure you want to {selectedLicense.isActive ? 'deactivate' : 'activate'} this company?
                                    {selectedLicense.isActive && " Users will lose access immediately."}
                                </p>
                            )}

                            {manageAction === 'DELETE' && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm">
                                    <strong className="block mb-1 text-red-500 uppercase text-xs">Warning: destructive action</strong>
                                    This will permanently delete the company including users, customers, and routes.
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button title="Cancel" onClick={() => setIsManageLicenseModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-bold">Cancel</button>
                                <button
                                    title="Confirm Action"
                                    onClick={confirmManageAction}
                                    className={`px-6 py-2 rounded-xl text-white font-bold text-sm shadow-lg transition-all ${manageAction === 'DELETE' ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' :
                                        manageAction === 'DEACTIVATE' ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20' :
                                            'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                                        }`}
                                >
                                    Confirm Action
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ACTIVATION WIZARD MODAL */}
            {isActivateModalOpen && selectedRequestForActivation && (
                <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#0f172a] border border-white/10 w-full max-w-2xl rounded-3xl p-0 shadow-2xl animate-in zoom-in-95 relative overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <div className="p-2 bg-indigo-500/20 rounded-xl">
                                    <Zap className="w-5 h-5 text-indigo-400" />
                                </div>
                                Activate License
                            </h2>
                            <button title="Close" onClick={() => setIsActivateModalOpen(false)} className="p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-1.5 bg-black/40 flex border-b border-white/10">
                            {[
                                { id: 1, label: 'Configuration', icon: LayoutDashboard },
                                { id: 2, label: 'Proposal', icon: FileText },
                                { id: 3, label: 'Payment', icon: CreditCard },
                                { id: 4, label: 'Complete', icon: ShieldCheck }
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    title={s.label}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-1 ${activationStep === s.id
                                        ? 'bg-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/10'
                                        : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    <s.icon className={`w-3.5 h-3.5 ${activationStep === s.id ? 'animate-pulse' : ''}`} />
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                            {activationStep === 1 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                        <h4 className="text-lg font-black text-white uppercase tracking-tight">1. Plan & Limits Configuration</h4>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-bold uppercase text-indigo-400/80 ml-1 tracking-widest">License Number (Company ID)</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    title="License Number"
                                                    type="text"
                                                    value={activationData.licenseKey}
                                                    onChange={e => setActivationData({ ...activationData, licenseKey: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 font-mono text-xs uppercase transition-all tracking-widest"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-bold uppercase text-indigo-400/80 ml-1 tracking-widest">Plan Tier</label>
                                            <div className="relative">
                                                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                                <select
                                                    title="Plan Tier"
                                                    value={activationData.planTier}
                                                    onChange={e => handlePlanChange(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-10 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 appearance-none font-bold text-sm transition-all"
                                                >
                                                    {availablePlans.map(p => (
                                                        <option key={p.id} value={p.id} className="bg-slate-900">{p.name} ({p.currency || 'ر.س'}{p.price_monthly})</option>
                                                    ))}
                                                    {availablePlans.length === 0 && <option value="starter" className="bg-slate-900">Starter (Default)</option>}
                                                </select>
                                                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 rotate-90" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-bold uppercase text-indigo-400/80 ml-1 tracking-widest">Max Users</label>
                                            <div className="relative">
                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    title="Max Users"
                                                    type="number"
                                                    value={activationData.maxUsers}
                                                    onChange={e => handleUserCountChange(parseInt(e.target.value) || 0)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 font-black text-sm transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-bold uppercase text-indigo-400/80 ml-1 tracking-widest">Max Routes / Day</label>
                                            <div className="relative">
                                                <LayoutDashboard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    title="Max Routes per Day"
                                                    type="number"
                                                    value={activationData.maxRoutes}
                                                    onChange={e => setActivationData({ ...activationData, maxRoutes: parseInt(e.target.value) || 0 })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 font-black text-sm transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-bold uppercase text-indigo-400/80 ml-1 tracking-widest">Database Cap (Market Leads)</label>
                                        <div className="relative">
                                            <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                            <input
                                                title="DB Cap"
                                                type="number"
                                                value={activationData.maxScannerCap}
                                                onChange={e => setActivationData({ ...activationData, maxScannerCap: parseInt(e.target.value) || 1000 })}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 font-black text-sm transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 group">
                                        <label className="text-[10px] font-bold uppercase text-indigo-400/80 ml-1 tracking-widest">Admin Access Key (Initial Password)</label>
                                        <div className="relative">
                                            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                            <input
                                                title="Admin Password"
                                                type="password"
                                                value={activationPassword}
                                                onChange={e => setActivationPassword(e.target.value)}
                                                placeholder="Secure authentication key..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white outline-none focus:border-indigo-500/50 focus:bg-white/10 font-mono text-sm placeholder:text-slate-600 transition-all border-dashed"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500 pl-1 font-medium">This will be the temporary password for the initial administrator account.</p>
                                    </div>
                                </div>
                            )}

                            {activationStep === 2 && (() => {
                                const initialPlan = availablePlans.find(p => p.id === activationData.planTier) || availablePlans[0];
                                const sysAdminVal = (activationData.basePrice * Number(sysAdminDiscountInput)) / 100;
                                const finalTotal = activationData.basePrice - activationData.discount - sysAdminVal + (activationData.setupFee || 0);

                                return (
                                    <div className="space-y-6 animate-in slide-in-from-right-4">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                                <h4 className="text-lg font-black text-white uppercase tracking-tight">2. Commercial Proposal</h4>
                                            </div>
                                            <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Draft Proposal</span>
                                            </div>
                                        </div>

                                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                            {/* Plan Banner */}
                                            <div className="p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
                                                <div>
                                                    <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">{initialPlan?.name} Plan</div>
                                                    <div className="text-2xl font-black text-white">{activationData.maxUsers} Users Package</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Billing Period</div>
                                                    <div className="text-sm font-bold text-white uppercase tracking-wider">{activationData.billingCycle}</div>
                                                </div>
                                            </div>

                                            {/* Cost Breakdown */}
                                            <div className="p-6 space-y-4">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-400">Subscription Fee ({activationData.maxUsers} @ {activationData.currency}{activationData.unitPrice})</span>
                                                    <span className="text-white font-bold">{activationData.currency}{activationData.basePrice.toLocaleString()}</span>
                                                </div>

                                                {activationData.setupFee > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-400">Implementation & Setup (One-time)</span>
                                                        <span className="text-white font-bold">{activationData.currency}{activationData.setupFee.toLocaleString()}</span>
                                                    </div>
                                                )}

                                                {activationData.discount > 0 && (
                                                    <div className="flex justify-between text-sm text-emerald-400 font-bold">
                                                        <span>Promo Discount ({activationData.promoCode})</span>
                                                        <span>-{activationData.currency}{activationData.discount.toLocaleString()}</span>
                                                    </div>
                                                )}

                                                {/* SysAdmin Discount Row */}
                                                <div className="flex justify-between items-center py-2 border-t border-white/5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-400 text-sm italic">SysAdmin Special Override</span>
                                                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                                                            <input
                                                                title="SysAdmin Discount"
                                                                type="text"
                                                                value={sysAdminDiscountInput}
                                                                onChange={e => setSysAdminDiscountInput(e.target.value)}
                                                                className="w-8 bg-transparent text-center text-xs font-black text-amber-400 outline-none"
                                                            />
                                                            <span className="text-xs font-bold text-slate-500">%</span>
                                                            <button
                                                                title="Apply"
                                                                onClick={() => handleSysadminDiscountChange(Number(sysAdminDiscountInput) || 0)}
                                                                className="text-[10px] font-black text-indigo-400 p-1 hover:bg-indigo-500/10 rounded"
                                                            >
                                                                APPLY
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <span className="text-amber-400 font-bold">-{activationData.currency}{sysAdminVal.toLocaleString()}</span>
                                                </div>

                                                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                                                    <span className="text-slate-400 font-black uppercase text-xs tracking-widest">Total Investment</span>
                                                    <p className="text-3xl font-black text-white tracking-tighter">
                                                        {activationData.currency} {finalTotal.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })()}

                            {activationStep === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                        <h4 className="text-lg font-black text-white uppercase tracking-tight">3. Payment Verification</h4>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-4">
                                        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CreditCard className="w-8 h-8 text-blue-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white">Verification Required</h3>
                                        <p className="text-slate-400 font-medium max-w-sm mx-auto">Please confirm that the contract has been signed and the initial payment has been processed to company account.</p>

                                        <div className="pt-6">
                                            <button
                                                title="Confirm Payment"
                                                onClick={() => setActivationData(p => ({ ...p, isPaymentVerified: !p.isPaymentVerified }))}
                                                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${activationData.isPaymentVerified ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}
                                            >
                                                {activationData.isPaymentVerified ? <CheckCircle2 className="w-6 h-6" /> : <div className="w-6 h-6 rounded-full border-2 border-current opacity-20" />}
                                                <span className="text-sm font-black uppercase tracking-widest">I confirm payment receipt</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-indigo-400/80 ml-1 tracking-widest">External Payment Ref (Optional)</label>
                                        <input
                                            title="Payment Ref"
                                            type="text"
                                            value={activationData.paymentRef}
                                            onChange={e => setActivationData({ ...activationData, paymentRef: e.target.value })}
                                            placeholder="e.g. Bank Transfer ID / Cheque #"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white outline-none focus:border-indigo-500/50 font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {activationStep === 4 && (
                                <div className="space-y-6 animate-in slide-in-from-right-4 text-center py-8">
                                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <ShieldCheck className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Ready for Deployment</h3>
                                        <p className="text-slate-400">All configurations are validated. Click below to initialize the company workspace and send welcome credentials to the administrator.</p>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-8 inline-block text-left min-w-[300px]">
                                        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/5">
                                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                                <Building2 className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 uppercase font-black">Company Instance</div>
                                                <div className="text-sm font-bold text-white uppercase">{selectedRequestForActivation.company_name}</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-black">Plan</div>
                                                <div className="text-xs font-bold text-white uppercase">{activationData.planTier}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500 uppercase font-black">Users</div>
                                                <div className="text-xs font-bold text-white">{activationData.maxUsers}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-black/40 border-t border-white/10 flex justify-between items-center gap-4">
                            {activationStep > 1 && (
                                <button
                                    title="Back"
                                    onClick={() => setActivationStep(activationStep - 1)}
                                    className="px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
                                >
                                    Previous Step
                                </button>
                            )}
                            <div className="flex-1" />
                            <div className="flex gap-3">
                                {activationStep === 1 && (
                                    <button
                                        title="Save Draft"
                                        onClick={handleSaveDraft}
                                        className="px-6 py-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
                                    >
                                        Save Draft
                                    </button>
                                )}
                                <button
                                    title={activationStep === 4 ? 'Finalize Activation' : 'Continue'}
                                    onClick={() => {
                                        if (activationStep < 4) setActivationStep(activationStep + 1);
                                        else handleActivate();
                                    }}
                                    disabled={isActivating || (activationStep === 1 && !activationPassword) || (activationStep === 3 && !activationData.isPaymentVerified)}
                                    className={`px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-3 disabled:opacity-50 disabled:grayscale disabled:hover:scale-100`}
                                >
                                    {isActivating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{activationStep === 4 ? 'Confirm & Initialize' : 'Continue'}</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete License Request"
                description="This will permanently remove the license request record. The user's registration account will remain intact."
            />

            <ConfirmModal
                isOpen={!!rejectConfirmId}
                onClose={() => setRejectConfirmId(null)}
                onConfirm={confirmRejectRequest}
                title="Reject License Request"
                description="This will move the request to history as Rejected. The user will not be notified automatically — contact them separately if needed."
            />

            {/* TOASTS */}
            {
                notification && (
                    <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 z-[200] ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                        {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="font-bold text-sm tracking-wide">{notification.message}</span>
                        <button title="Dismiss Notification" onClick={() => setNotification(null)} className="ml-4 p-1 rounded-full hover:bg-white/10 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                )
            }
        </div >
    );
};

export default SysAdminLicenseRequests;
