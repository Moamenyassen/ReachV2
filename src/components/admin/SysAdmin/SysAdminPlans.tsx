import React, { useState, useEffect } from 'react';
import {
    SubscriptionPlan,
    getSubscriptionPlans,
    updateSubscriptionPlan,
    createSubscriptionPlan,
    deleteSubscriptionPlan
} from '../../../services/supabase';
import {
    CreditCard,
    Eye,
    Plus,
    Check,
    X,
    Edit,
    Rocket,
    Loader2,
    Save,
    Trash2,
    Settings
} from 'lucide-react';
import ReachPricing from '../../features/Pricing/ReachPricing';
import { ConfirmModal } from './SysAdminShared';

const SysAdminPlans: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewMode, setPreviewMode] = useState(false);

    // Plan Management State
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

    // Inline Edit State
    const [inlineEditId, setInlineEditId] = useState<string | null>(null);
    const [inlineForm, setInlineForm] = useState<Partial<SubscriptionPlan>>({});

    // Modal Form State
    const [planForm, setPlanForm] = useState({
        id: '',
        name: '',
        description: '',
        price_monthly: 0,
        price_yearly: 0,
        limits_routes: 0,
        limits_users: 0,
        limits_scanner: 0,
        limits_customers: 0,
        limits_min_users: 1, // New field
        ui_color: 'from-blue-400 to-cyan-400',
        ui_icon: 'Rocket',
        isPopular: false,
        contact_required: false,
        is_active: true,
        setup_fee: 3000,
        waive_threshold: 50
    });
    const [planFeatures, setPlanFeatures] = useState<string[]>([]);
    const [planDisabledFeatures, setPlanDisabledFeatures] = useState<string[]>([]);
    const [newFeatureText, setNewFeatureText] = useState('');
    const [newDisabledFeatureText, setNewDisabledFeatureText] = useState('');
    const [isCreatingPlan, setIsCreatingPlan] = useState(false);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        setLoading(true);
        try {
            const data = await getSubscriptionPlans(true);
            setPlans(data || []);
        } catch (e) {
            console.error("Failed to load plans", e);
        } finally {
            setLoading(false);
        }
    };

    const openPlanEdit = (plan: SubscriptionPlan) => {
        setEditingPlan(plan);
        setIsCreatingPlan(false);
        setPlanForm({
            id: plan.id,
            name: plan.name,
            description: plan.description || '',
            price_monthly: plan.price_monthly,
            price_yearly: plan.price_yearly,
            limits_routes: typeof plan.limits.routes === 'number' ? plan.limits.routes : 999999,
            limits_customers: typeof plan.limits.customers === 'number' ? plan.limits.customers : (typeof plan.limits.routes === 'number' ? plan.limits.routes : 999999),
            limits_users: typeof plan.limits.users === 'number' ? plan.limits.users : 999999,
            limits_scanner: typeof plan.limits.market_scanner_cap === 'number' ? plan.limits.market_scanner_cap : 999999,
            limits_min_users: typeof plan.limits.min_users === 'number' ? plan.limits.min_users : 1,
            ui_color: plan.ui_config?.color || 'from-blue-400 to-cyan-400',
            ui_icon: plan.ui_config?.icon || 'Rocket',
            isPopular: plan.ui_config?.isPopular || false,
            contact_required: plan.contact_required || false,
            is_active: plan.is_active,
            setup_fee: plan.setup_fee !== undefined ? plan.setup_fee : 3000,
            waive_threshold: plan.waive_threshold !== undefined ? plan.waive_threshold : 50
        } as any);
        setPlanFeatures(plan.features || []);
        setPlanDisabledFeatures(plan.disabled_features || []);
        setIsPlanModalOpen(true);
    };

    const openCreatePlan = () => {
        setIsCreatingPlan(true);
        setEditingPlan(null);
        setPlanForm({
            id: '',
            name: '',
            description: '',
            price_monthly: 49,
            price_yearly: 490,
            limits_routes: 100,
            limits_users: 5,
            limits_scanner: 50,
            limits_customers: 5000,
            limits_min_users: 1,
            ui_color: 'from-pink-500 to-purple-500',
            ui_icon: 'Rocket',
            isPopular: false,
            contact_required: false,
            is_active: true,
            setup_fee: 3000,
            waive_threshold: 50
        });
        setPlanFeatures(['Feature 1', 'Feature 2']);
        setPlanDisabledFeatures([]);
        setIsPlanModalOpen(true);
    };

    const handleAddFeature = (type: 'INCLUDED' | 'EXCLUDED') => {
        if (type === 'INCLUDED' && newFeatureText) {
            setPlanFeatures([...planFeatures, newFeatureText]);
            setNewFeatureText('');
        } else if (type === 'EXCLUDED' && newDisabledFeatureText) {
            setPlanDisabledFeatures([...planDisabledFeatures, newDisabledFeatureText]);
            setNewDisabledFeatureText('');
        }
    };

    const handleRemoveFeature = (type: 'INCLUDED' | 'EXCLUDED', index: number) => {
        if (type === 'INCLUDED') {
            const newF = [...planFeatures];
            newF.splice(index, 1);
            setPlanFeatures(newF);
        } else {
            const newF = [...planDisabledFeatures];
            newF.splice(index, 1);
            setPlanDisabledFeatures(newF);
        }
    };

    const [planBanner, setPlanBanner] = useState<string | null>(null);

    const handleSavePlan = async (e: React.FormEvent) => {
        e.preventDefault();

        const planData: Partial<SubscriptionPlan> = {
            name: planForm.name,
            description: planForm.description,
            price_monthly: planForm.price_monthly,
            price_yearly: planForm.price_yearly,
            features: planFeatures,
            disabled_features: planDisabledFeatures,
            limits: {
                routes: planForm.limits_routes > 100000 ? 'Unlimited' : planForm.limits_routes,
                users: planForm.limits_users > 100000 ? 'Unlimited' : planForm.limits_users,
                customers: planForm.limits_customers > 100000 ? 'Unlimited' : planForm.limits_customers,
                market_scanner_cap: planForm.limits_scanner > 100000 ? 'Unlimited' : planForm.limits_scanner,
                min_users: planForm.limits_min_users > 0 ? planForm.limits_min_users : 1
            },
            ui_config: {
                color: planForm.ui_color,
                icon: planForm.ui_icon,
                isPopular: planForm.isPopular,
                borderColor: planForm.isPopular ? '#ec4899' : undefined
            },
            is_active: planForm.is_active,
            contact_required: planForm.contact_required,
            setup_fee: planForm.setup_fee,
            waive_threshold: planForm.waive_threshold
        };

        try {
            if (isCreatingPlan) {
                if (!planForm.id) { setPlanBanner('Plan ID is required'); return; }
                await createSubscriptionPlan({
                    id: planForm.id.toLowerCase().replace(/\s/g, '-'),
                    ...planData
                } as any);
            } else if (editingPlan) {
                await updateSubscriptionPlan(editingPlan.id, planData);
            }
            setIsPlanModalOpen(false);
            loadPlans();
        } catch (error: any) {
            console.error(error);
            setPlanBanner('Failed to save plan: ' + (error?.message || 'Unknown error'));
        }
    };

    const startInlineEdit = (plan: SubscriptionPlan) => {
        setInlineEditId(plan.id);
        // Flatten limits for easier binding if needed, or keep object
        // For inline, we'll bind directly to object structure in render
        setInlineForm(JSON.parse(JSON.stringify(plan))); // Deep copy
    };

    const cancelInlineEdit = () => {
        setInlineEditId(null);
        setInlineForm({});
    };

    const saveInlineEdit = async () => {
        if (!inlineEditId || !inlineForm) return;

        setLoading(true);
        try {
            await updateSubscriptionPlan(inlineEditId, inlineForm);
            setInlineEditId(null);
            loadPlans();
        } catch (e: any) {
            console.error(e);
            setPlanBanner('Failed to save plan changes: ' + (e?.message || ''));
        } finally {
            setLoading(false);
        }
    };

    // Secure Delete State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleConfirmDelete = async () => {
        if (!editingPlan) return;
        setLoading(true);
        try {
            await deleteSubscriptionPlan(editingPlan.id);
            setIsDeleteModalOpen(false);
            setIsPlanModalOpen(false);
            loadPlans();
        } catch (e: any) {
            console.error("Failed to delete plan", e);
            setIsDeleteModalOpen(false);
            setPlanBanner('Failed to delete plan — it may still be in use by active companies.');
        } finally {
            setLoading(false);
        }
    };
    const initializeDefaults = async () => {
        setLoading(true);
        setPlanBanner(null);
        try {
            // Starter
            await createSubscriptionPlan({
                id: 'starter',
                name: 'Starter',
                description: 'Perfect for small fleets getting started.',
                price_monthly: 49,
                price_yearly: 490,
                currency: 'SAR',
                limits: { routes: 100, users: 5, customers: 5000, market_scanner_cap: 50, min_users: 1 },
                is_active: true,
                ui_config: { color: 'from-blue-500 to-indigo-500', icon: 'Rocket', isPopular: false },
                features: ['Smart Route Optimization', 'Real-time Tracking', 'Basic Analytics'],
                disabled_features: ['AI Market Scanner']
            });
            // Growth
            await createSubscriptionPlan({
                id: 'growth',
                name: 'Growth',
                description: 'Scale your operations with advanced AI.',
                price_monthly: 149,
                price_yearly: 1490,
                currency: 'SAR',
                limits: { routes: 500, users: 20, customers: 25000, market_scanner_cap: 200, min_users: 3 },
                is_active: true,
                ui_config: { color: 'from-amber-400 to-orange-500', icon: 'Crown', isPopular: true },
                features: ['Everything in Starter', 'AI Market Scanner', 'Advanced Insights', 'Priority Support'],
                disabled_features: []
            });
            // Elite
            await createSubscriptionPlan({
                id: 'elite',
                name: 'Elite',
                description: 'For large enterprises needing maximum power.',
                price_monthly: 299,
                price_yearly: 2990,
                currency: 'SAR',
                limits: { routes: 999999, users: 999999, customers: 999999, market_scanner_cap: 1000, min_users: 10 },
                is_active: true,
                ui_config: { color: 'from-purple-500 to-pink-500', icon: 'Zap', isPopular: false },
                features: ['Unlimited Everything', 'Dedicated Manager', 'API Access', 'Custom AI Training'],
                disabled_features: []
            });
            await loadPlans();
        } catch (e: any) {
            console.error(e);
            setPlanBanner('Failed to initialize defaults: ' + (e?.message || ''));
        } finally {
            setLoading(false);
        }
    };


    return (
        <>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Title Action Bar */}
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <CreditCard className="w-6 h-6 text-pink-500" /> Subscription Plans
                    </h2>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setPreviewMode(true)}
                            className="bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
                        >
                            <Eye className="w-5 h-5" /> Live Preview
                        </button>
                        <button
                            onClick={openCreatePlan}
                            className="bg-pink-600 hover:bg-pink-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-pink-500/25 flex items-center gap-2 transition-all hover:-translate-y-1 active:scale-95"
                        >
                            <Plus className="w-5 h-5" /> Add New Plan
                        </button>
                    </div>
                </div>

                {/* Plans Table View */}
                <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-white/5 uppercase font-bold text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 text-white">Plan Name</th>
                                    <th className="px-6 py-4">Monthly (SAR)</th>
                                    <th className="px-6 py-4">Yearly (SAR)</th>
                                    <th className="px-6 py-4">Routes</th>
                                    <th className="px-6 py-4">Users</th>
                                    <th className="px-6 py-4">DB Cap</th>
                                    <th className="px-6 py-4">Scanner</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {loading && plans.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                            Loading plans...
                                        </td>
                                    </tr>
                                )}
                                {!loading && plans.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                                            <Rocket className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            No plans found.
                                            <button onClick={initializeDefaults} className="block mx-auto mt-4 text-indigo-400 hover:text-indigo-300 font-bold">Initialize Defaults</button>
                                        </td>
                                    </tr>
                                )}
                                {plans.map((plan) => {
                                    const isEditing = inlineEditId === plan.id;
                                    const formData = isEditing ? inlineForm : null;

                                    // Helper to update inline form
                                    const updateInline = (field: string, val: any) => {
                                        setInlineForm(prev => ({ ...prev, [field]: val }));
                                    };
                                    const updateLimit = (field: string, val: any) => {
                                        setInlineForm(prev => ({
                                            ...prev,
                                            limits: {
                                                routes: prev.limits?.routes ?? 0,
                                                users: prev.limits?.users ?? 0,
                                                customers: prev.limits?.customers ?? 0,
                                                market_scanner_cap: prev.limits?.market_scanner_cap ?? 0,
                                                min_users: prev.limits?.min_users ?? 1,
                                                ...prev.limits,
                                                [field]: val
                                            }
                                        }));
                                    };

                                    return (
                                        <tr key={plan.id} className={`group transition-colors ${isEditing ? 'bg-white/5 border border-indigo-500/30' : 'hover:bg-white/5'}`}>
                                            {/* NAME */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        className="bg-black/30 w-full px-2 py-1 rounded border border-white/10 focus:border-indigo-500 outline-none text-white"
                                                        value={formData?.name || ''}
                                                        onChange={e => updateInline('name', e.target.value)}
                                                    />
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${plan.ui_config?.color || 'from-gray-700 to-gray-600'} flex items-center justify-center`}>
                                                            <Rocket className="w-4 h-4 text-white" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white">{plan.name}</div>
                                                            <div className="text-[10px] text-slate-500">{plan.id.toUpperCase()}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* MONTHLY */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        disabled={formData?.contact_required}
                                                        className={`bg-black/30 w-24 px-2 py-1 rounded border border-white/10 focus:border-indigo-500 outline-none text-white ${formData?.contact_required ? 'opacity-50' : ''}`}
                                                        value={formData?.price_monthly || 0}
                                                        onChange={e => updateInline('price_monthly', parseFloat(e.target.value))}
                                                    />
                                                ) : (
                                                    <span className={plan.contact_required ? "text-indigo-400 font-bold text-xs uppercase" : "text-slate-300 font-mono"}>
                                                        {plan.contact_required ? "Contact" : plan.price_monthly}
                                                    </span>
                                                )}
                                            </td>

                                            {/* YEARLY */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        disabled={formData?.contact_required}
                                                        className={`bg-black/30 w-24 px-2 py-1 rounded border border-white/10 focus:border-indigo-500 outline-none text-white ${formData?.contact_required ? 'opacity-50' : ''}`}
                                                        value={formData?.price_yearly || 0}
                                                        onChange={e => updateInline('price_yearly', parseFloat(e.target.value))}
                                                    />
                                                ) : (
                                                    <span className={plan.contact_required ? "text-indigo-400 font-bold text-xs uppercase" : "text-slate-300 font-mono"}>
                                                        {plan.contact_required ? "Contact" : plan.price_yearly}
                                                    </span>
                                                )}
                                            </td>

                                            {/* LIMITS - ROUTES */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        className="bg-black/30 w-20 px-2 py-1 rounded border border-white/10 focus:border-indigo-500 outline-none text-white"
                                                        value={formData?.limits?.routes}
                                                        onChange={e => updateLimit('routes', parseInt(e.target.value))}
                                                    />
                                                ) : (
                                                    <span className="text-slate-300">{plan.limits.routes}</span>
                                                )}
                                            </td>

                                            {/* LIMITS - USERS */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        className="bg-black/30 w-16 px-2 py-1 rounded border border-white/10 focus:border-indigo-500 outline-none text-white"
                                                        value={formData?.limits?.users}
                                                        onChange={e => updateLimit('users', parseInt(e.target.value))}
                                                    />
                                                ) : (
                                                    <span className="text-slate-300">{plan.limits.users}</span>
                                                )}
                                            </td>

                                            {/* LIMITS - DB */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        className="bg-black/30 w-20 px-2 py-1 rounded border border-white/10 focus:border-indigo-500 outline-none text-white"
                                                        value={formData?.limits?.customers ?? (formData?.limits?.routes as number * 5)}
                                                        onChange={e => updateLimit('customers', parseInt(e.target.value))}
                                                    />
                                                ) : (
                                                    <span className="text-slate-300">{plan.limits.customers ?? (typeof plan.limits.routes === 'number' ? plan.limits.routes * 5 : 'Unlimited')}</span>
                                                )}
                                            </td>

                                            {/* LIMITS - SCANNER */}
                                            <td className="px-6 py-4">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        className="bg-black/30 w-20 px-2 py-1 rounded border border-white/10 focus:border-indigo-500 outline-none text-white"
                                                        value={formData?.limits?.market_scanner_cap}
                                                        onChange={e => updateLimit('market_scanner_cap', parseInt(e.target.value))}
                                                    />
                                                ) : (
                                                    <span className="text-slate-300">{plan.limits.market_scanner_cap}</span>
                                                )}
                                            </td>

                                            {/* STATUS */}
                                            <td className="px-6 py-4 text-center">
                                                {isEditing ? (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${formData?.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${formData?.is_active ? 'translate-x-4' : ''}`} />
                                                            </div>
                                                            <span className="text-[10px] uppercase font-bold text-slate-500">Act</span>
                                                            <input type="checkbox" className="hidden" checked={formData?.is_active || false} onChange={e => updateInline('is_active', e.target.checked)} />
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${formData?.contact_required ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                                                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${formData?.contact_required ? 'translate-x-4' : ''}`} />
                                                            </div>
                                                            <span className="text-[10px] uppercase font-bold text-slate-500">Ctc</span>
                                                            <input type="checkbox" className="hidden" checked={formData?.contact_required || false} onChange={e => updateInline('contact_required', e.target.checked)} />
                                                        </label>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${plan.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                            {plan.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                        {plan.contact_required && (
                                                            <span className="text-[10px] text-indigo-400 font-bold">Contact Only</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* ACTIONS */}
                                            <td className="px-6 py-4 text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-2 text-white">
                                                        <button onClick={saveInlineEdit} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg">
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={cancelInlineEdit} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => startInlineEdit(plan)}
                                                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                                            title="Quick Edit"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openPlanEdit(plan)} // "Advanced Edit" opening modal
                                                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                            title="Edit Features & Details"
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>



            {/* PREVIEW MODE OVERLAY */}
            {
                previewMode && (
                    <div className="fixed inset-0 z-[200] bg-[#0f172a] overflow-y-auto">
                        <ReachPricing
                            onBack={() => setPreviewMode(false)}
                            hideHeader={false}
                            isDarkMode={true}
                            preloadedPlans={plans}
                            onSubscribe={() => { }}
                        />
                    </div>
                )
            }

            {/* PLAN EDIT MODAL */}
            {
                isPlanModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-[#0f172a] w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                    {isCreatingPlan ? <Plus className="w-5 h-5 text-emerald-400" /> : <Edit className="w-5 h-5 text-indigo-400" />}
                                    {isCreatingPlan ? "Create New Plan" : `Edit ${editingPlan?.name} Plan`}
                                </h2>
                                <button onClick={() => setIsPlanModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleSavePlan} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                                {planBanner && (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium bg-red-500/10 border-red-500/20 text-red-300">
                                        {planBanner}
                                        <button type="button" onClick={() => setPlanBanner(null)} className="ml-auto opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
                                    </div>
                                )}
                                {/* BASIC INFO */}
                                <div className="space-y-4">
                                    {isCreatingPlan && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Plan ID (Unique)</label>
                                            <input
                                                type="text"
                                                value={planForm.id}
                                                onChange={e => setPlanForm({ ...planForm, id: e.target.value })}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none font-mono"
                                                placeholder="e.g. enterprise-plus"
                                                required
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Plan Name</label>
                                        <input
                                            type="text"
                                            value={planForm.name}
                                            onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                            placeholder="e.g. Enterprise Plus"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                                        <textarea
                                            value={planForm.description}
                                            placeholder="Brief summary of the plan..."
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex gap-6 py-2">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${planForm.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${planForm.is_active ? 'translate-x-4' : ''}`} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">Active Plan</span>
                                            <input type="checkbox" className="hidden" checked={planForm.is_active} onChange={e => setPlanForm({ ...planForm, is_active: e.target.checked })} />
                                        </label>

                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${planForm.contact_required ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${planForm.contact_required ? 'translate-x-4' : ''}`} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">Contact Required</span>
                                            <input type="checkbox" className="hidden" checked={planForm.contact_required} onChange={e => setPlanForm({ ...planForm, contact_required: e.target.checked })} />
                                        </label>
                                    </div>
                                </div>

                                <div className="border-t border-white/10 my-4"></div>

                                {/* PRICING */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Monthly Price (SAR)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={planForm.price_monthly}
                                            onChange={e => setPlanForm({ ...planForm, price_monthly: parseFloat(e.target.value) })}
                                            disabled={planForm.contact_required}
                                            className={`w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none ${planForm.contact_required ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Yearly Price (Full Amount)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={planForm.price_yearly}
                                                onChange={e => setPlanForm({ ...planForm, price_yearly: parseFloat(e.target.value) })}
                                                disabled={planForm.contact_required}
                                                className={`w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none ${planForm.contact_required ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            />
                                            {planForm.price_monthly > 0 && planForm.price_yearly > 0 && (
                                                <div className="absolute right-3 top-3 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                    {Math.round((1 - (planForm.price_yearly / (planForm.price_monthly * 12))) * 100)}% OFF
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">One-Time Setup Fee (SAR)</label>
                                        <input
                                            type="number"
                                            value={planForm.setup_fee}
                                            onChange={e => setPlanForm({ ...planForm, setup_fee: parseFloat(e.target.value) })}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                            placeholder="3000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Waive Fee Threshold (Users)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={planForm.waive_threshold}
                                                onChange={e => setPlanForm({ ...planForm, waive_threshold: parseInt(e.target.value) })}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                                placeholder="50"
                                            />
                                            <div className="absolute right-3 top-3 text-[10px] text-slate-500">
                                                Users
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/10">
                                    <h3 className="text-sm font-bold text-white">Resource Limits</h3>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-4 items-center">
                                            <label className="text-sm text-slate-400">Total Users</label>
                                            <input
                                                type="number"
                                                value={planForm.limits_users}
                                                onChange={e => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setPlanForm({
                                                        ...planForm,
                                                        limits_users: val,
                                                        limits_routes: val, // Sync: Routes = Users
                                                        limits_customers: val * 150, // Auto-calc: 150 per user
                                                        limits_scanner: val * 50     // Auto-calc: 50 per user
                                                    });
                                                }}
                                                className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-indigo-500 outline-none flex-1"
                                                placeholder="999999 for Unlimited"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 items-center">
                                            <label className="text-sm font-bold text-amber-500">Min Users Policy</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={planForm.limits_min_users}
                                                onChange={e => setPlanForm({ ...planForm, limits_min_users: parseInt(e.target.value) })}
                                                className="bg-black/30 border border-amber-500/30 rounded-xl px-3 py-2 text-amber-500 font-bold focus:border-amber-500 outline-none flex-1"
                                                placeholder="Min Licenses"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 items-center">
                                            <label className="text-sm text-slate-400">Database Capacity</label>
                                            <div className="flex-1 relative">
                                                <input
                                                    type="number"
                                                    value={planForm.limits_customers}
                                                    onChange={e => setPlanForm({ ...planForm, limits_customers: parseInt(e.target.value) })}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                                    placeholder="Customers"
                                                />
                                                <span className="absolute right-3 top-2 text-[10px] text-slate-500 pointer-events-none">Auto (150x)</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 items-center">
                                            <label className="text-sm text-slate-400">Market Scanner Cap</label>
                                            <div className="flex-1 relative">
                                                <input
                                                    type="number"
                                                    value={planForm.limits_scanner}
                                                    onChange={e => setPlanForm({ ...planForm, limits_scanner: parseInt(e.target.value) })}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                                    placeholder="999999 for Unlimited"
                                                />
                                                <span className="absolute right-3 top-2 text-[10px] text-slate-500 pointer-events-none">Auto (50x)</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 text-center pt-2">Enter a very large number (e.g. 999999) for "Unlimited"</p>
                                    </div>
                                </div>

                                <div className="border-t border-white/10 my-4"></div>

                                {/* FEATURES EDITOR */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-white">Features List</h3>

                                    {/* INCLUDED */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-2"><Check className="w-3 h-3" /> Included</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={newFeatureText}
                                                onChange={e => setNewFeatureText(e.target.value)}
                                                placeholder="Add feature..."
                                                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddFeature('INCLUDED'))}
                                            />
                                            <button type="button" onClick={() => handleAddFeature('INCLUDED')} className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg hover:bg-emerald-500/30"><Plus className="w-4 h-4" /></button>
                                        </div>
                                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar p-1">
                                            {planFeatures.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg group">
                                                    <span className="text-sm text-slate-300">{f}</span>
                                                    <button type="button" onClick={() => handleRemoveFeature('INCLUDED', i)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* EXCLUDED */}
                                    <div className="space-y-2 pt-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><X className="w-3 h-3" /> Not Included</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={newDisabledFeatureText}
                                                onChange={e => setNewDisabledFeatureText(e.target.value)}
                                                placeholder="Add excluded feature..."
                                                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-500 outline-none"
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddFeature('EXCLUDED'))}
                                            />
                                            <button type="button" onClick={() => handleAddFeature('EXCLUDED')} className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600"><Plus className="w-4 h-4" /></button>
                                        </div>
                                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar p-1">
                                            {planDisabledFeatures.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg group text-slate-500">
                                                    <span className="text-sm line-through opacity-70">{f}</span>
                                                    <button type="button" onClick={() => handleRemoveFeature('EXCLUDED', i)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10 flex justify-between bg-[#0f172a] sticky bottom-0">
                                    {isCreatingPlan ? <div></div> : (
                                        <button
                                            type="button"
                                            onClick={() => setIsDeleteModalOpen(true)}
                                            className="px-6 py-3 rounded-xl font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            Delete Plan
                                        </button>
                                    )}
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsPlanModalOpen(false)}
                                            className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-1 active:scale-95"
                                        >
                                            {isCreatingPlan ? "Create Plan" : "Save Changes"}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                isLoading={loading}
                title={`Delete ${editingPlan?.name} Plan`}
                description="This action cannot be undone. Companies currently on this plan may lose access to their account features."
                target={editingPlan?.id}
            />
        </>
    );
};

export default SysAdminPlans;
