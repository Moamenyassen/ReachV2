import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, Zap, Globe, Rocket, Shield, ShieldCheck, Activity, Users, ChevronLeft, Crown, Minus, Plus, ChevronsRight, CreditCard, Ticket, Loader2 } from 'lucide-react';
import { validatePromoCode, logPromoUsage, updatePromoUsageStatus, SubscriptionPlan, getSubscriptionPlans } from '../../../services/supabase';
import { formatPrice, detectUserCountry } from '../../../utils/currency';

// Custom Currency Logo for SAR (Stylized)
const SaudiRiyalLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 100 40" className={className} fill="currentColor">
        {/* Simple stylized 'SAR' text path or shape */}
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontFamily="sans-serif" fontWeight="900" fontSize="30">SAR</text>
        <path d="M10 35 H90" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </svg>
);

const ICON_MAP: Record<string, any> = {
    'Rocket': Rocket,
    'Zap': Zap,
    'Crown': Crown
};

interface ReachPricingProps {
    onBack?: () => void;
    isAiTheme?: boolean;
    isDarkMode?: boolean;
    onSubscribe: (planId: string, billingCycle: 'monthly' | 'yearly', licenseCount: number) => void;
    hideHeader?: boolean;
    companyName?: string;
    preloadedPlans?: SubscriptionPlan[];

    countryCode?: string; // KEEP FOR INTERNAL USE IF NEEDED, but add userCountry
    userCountry?: string; // Added to match App.tsx usage
    currentTier?: string; // To prevent downgrade
}

const PLAN_RANK: Record<string, number> = {
    'STARTER': 1,
    'GROWTH': 2,
    'ELITE': 3,
    'NONE': 0
};

const DEFAULT_PLANS: SubscriptionPlan[] = [
    {
        id: 'starter',
        name: 'Starter',
        price_monthly: 0,
        price_yearly: 0,
        description: 'Essential tools for small fleets.',
        features: ["Core Route Planning", "Basic Analytics", "5 Users"],
        limits: { users: 5, routes: 1000, customers: 2500, market_scanner_cap: 0 },
        is_active: true,
        currency: 'USD',
        disabled_features: [],
        ui_config: { icon: 'Zap', color: 'blue' }
    },
    {
        id: 'growth',
        name: 'Growth',
        price_monthly: 49,
        price_yearly: 470,
        description: 'Advanced optimization for growing businesses.',
        features: ["Advanced Optimization", "Market Scanner (Basic)", "10 Users", "Unlimited Routes"],
        limits: { users: 10, routes: 999999, customers: 10000, market_scanner_cap: 1000 },
        is_active: true,
        currency: 'USD',
        disabled_features: [],
        ui_config: { icon: 'Rocket', color: 'amber' }
    },
    {
        id: 'elite',
        name: 'Elite',
        price_monthly: 99,
        price_yearly: 950,
        description: 'Full scale intelligence for enterprises.',
        features: ["Full Market Intelligence", "Dedicated Support", "Unlimited Users", "API Access"],
        limits: { users: 999999, routes: 999999, customers: 999999, market_scanner_cap: 999999 },
        is_active: true,
        currency: 'USD',
        disabled_features: [],
        ui_config: { icon: 'Crown', color: 'purple' }
    }
];

const ReachPricing: React.FC<ReachPricingProps> = ({
    onBack,
    onSubscribe,
    isAiTheme = false,
    isDarkMode = false,
    hideHeader = false,
    companyName = 'Guest',
    preloadedPlans,
    countryCode,
    userCountry: propUserCountry,
    currentTier = 'NONE'
}) => {
    // Combine themes: if either is active, use dark mode styling
    const isDark = true;

    // Determine Current Rank
    const currentRank = PLAN_RANK[currentTier?.toUpperCase()] || 0;

    // State
    const [step, setStep] = useState<'SELECTION' | 'CALCULATOR'>('SELECTION');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
    const [licenseCount, setLicenseCount] = useState(1);
    const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
    const [userCountry, setUserCountry] = useState(propUserCountry || countryCode || 'SA');

    useEffect(() => {
        if (!propUserCountry && !countryCode) {
            setUserCountry(detectUserCountry());
        }
    }, [propUserCountry, countryCode]);

    // ... Checkout State ...
    const [showCheckout, setShowCheckout] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [promoError, setPromoError] = useState('');
    const [discountDisplay, setDiscountDisplay] = useState(0); // For display
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);
    const [appliedPromo, setAppliedPromo] = useState<any>(null); // To store valid promo object
    const [isProcessing, setIsProcessing] = useState(false); // For checkout button

    // Dynamic Plans State
    const [plans, setPlans] = useState<SubscriptionPlan[]>(preloadedPlans || []);
    const [loadingPlans, setLoadingPlans] = useState(!preloadedPlans);

    useEffect(() => {
        // Debug Log
        console.log("ReachPricing: Plans update", { preloaded: preloadedPlans?.length, current: plans.length });

        if (!preloadedPlans) {
            loadPlans();
        } else {
            setPlans(preloadedPlans);
            setLoadingPlans(false);
        }
    }, [preloadedPlans]);

    const loadPlans = async () => {
        try {
            const data = await getSubscriptionPlans();
            console.log("ReachPricing: Fetched plans", data);
            if (data && data.length > 0) {
                let filtered = data.filter(p => p.is_active);
                if (currentTier && currentTier !== 'NONE') {
                    // Try to match current tier to plan ID (Starter -> starter, Professional -> growth, Enterprise -> elite)
                    const tierIdMap: Record<string, string> = {
                        'STARTER': 'starter',
                        'PROFESSIONAL': 'growth',
                        'ENTERPRISE': 'elite'
                    };
                    const currentPlanId = tierIdMap[currentTier.toUpperCase()];
                    if (currentPlanId) {
                        filtered = data.filter(p => p.id === currentPlanId);
                    }
                }
                setPlans(filtered);
            } else {
                console.warn("ReachPricing: No plans found in DB, using defaults.");
                let filtered = DEFAULT_PLANS;
                if (currentTier && currentTier !== 'NONE') {
                    const tierIdMap: Record<string, string> = {
                        'STARTER': 'starter',
                        'PROFESSIONAL': 'growth',
                        'ENTERPRISE': 'elite'
                    };
                    const currentPlanId = tierIdMap[currentTier.toUpperCase()];
                    if (currentPlanId) {
                        filtered = DEFAULT_PLANS.filter(p => p.id === currentPlanId);
                    }
                }
                setPlans(filtered);
            }
        } catch (e) {
            console.error("ReachPricing: Failed to load plans", e);
            setPlans(DEFAULT_PLANS); // Fallback
        } finally {
            setLoadingPlans(false);
        }
    };

    const maxSavings = plans.reduce((max, plan) => {
        if (plan.price_monthly > 0 && plan.price_yearly > 0) {
            const savings = Math.round((1 - (plan.price_yearly / (plan.price_monthly * 12))) * 100);
            return Math.max(max, savings);
        }
        return max;
    }, 0);

    // Helper to calculate price (Base is SAR)
    const calculateBasePrice = (basePrice: number) => {
        return basePrice * licenseCount;
    };

    const handleSubscribeClick = (planId: string) => {
        const plan = plans.find(p => p.id === planId);
        if (plan?.limits?.min_users && licenseCount < plan.limits.min_users) {
            setLicenseCount(plan.limits.min_users);
        }
        setSelectedPlanId(planId);
        setShowCheckout(true);
        // Do not reset promo, let it carry over
    };

    const handleApplyPromo = async () => {
        if (!promoCode) return;
        setIsApplyingPromo(true);
        setPromoError('');
        try {
            const promo = await validatePromoCode(promoCode);
            if (promo) {
                setAppliedPromo(promo);
                setDiscountDisplay(promo.discount_percent);
            } else {
                setPromoError('Invalid code');
                setAppliedPromo(null);
            }
        } catch (e) {
            setPromoError('Validation failed');
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const confirmSubscription = async () => {
        console.log("ReachPricing: confirmSubscription clicked", { selectedPlanId, billingCycle });
        setIsProcessing(true); // START LOCK
        let promoLogId: string | null = null;

        try {
            // Determine Plan (Safely)
            const plan = plans.find(p => p.id === selectedPlanId) || DEFAULT_PLANS.find(p => p.id === selectedPlanId);

            if (!plan) {
                console.error("Critical: Selected plan not found in registry", selectedPlanId);
                throw new Error("Invalid Plan Selection");
            }

            // 1. Log Promo Usage as PENDING
            if (appliedPromo) {
                try {
                    const base = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
                    let total = base * licenseCount;
                    total = total * (1 - appliedPromo.discount_percent / 100);

                    // Log as PENDING and get ID
                    const logEntry = await logPromoUsage(appliedPromo.code, companyName);
                    if (logEntry) promoLogId = logEntry.id;

                } catch (e) {
                    console.error("Failed to log promo usage (initial)", e);
                    // Continue anyway, don't block subscription
                }
            }

            // 2. Invoke subscription handler
            await onSubscribe(selectedPlanId, billingCycle, licenseCount);

            // 3. Update Promo Log to SUCCESS (if we have an ID)
            if (promoLogId) {
                // We import updatePromoUsageStatus dynamically or use the imported one (need to update imports)
                await updatePromoUsageStatus(promoLogId, 'SUCCESS');
            }

        } catch (e: any) {
            console.error("Subscription flow failed", e);

            // 4. Update Promo Log to FAILED
            if (promoLogId) {
                try {
                    await updatePromoUsageStatus(promoLogId, 'FAILED');
                } catch (logErr) {
                    console.error("Failed to update promo log status", logErr);
                }
            }

            setIsProcessing(false); // Only unlock on error. Success usually navigates/reloads.
            alert("Transaction Failed: " + (e.message || "Unknown error"));
        }
        // Note: If success implies reload/unmount, we might not need to setIsProcessing(false)
        // But for safety:
        // setIsProcessing(false);
    };

    // Helper to format limits (handle large numbers as Unlimited)
    const formatLimit = (val: any) => {
        if (typeof val === 'string' && val.toLowerCase() === 'unlimited') return 'Unlimited';
        if (typeof val === 'number' && val >= 100000) return 'Unlimited';
        return val || 0;
    };

    const handleSelectPlan = (planId: string) => {
        setSelectedPlanId(planId);
        setStep('CALCULATOR');
        // Reset defaults for calculator
        const plan = plans.find(p => p.id === planId);
        setLicenseCount(plan?.limits?.min_users || 5); // Set to min_users or default to 5
        setBillingCycle('yearly'); // Default to yearly for calculator
        setPromoCode('');
        setAppliedPromo(null);
        setPromoError('');
    }



    return (
        <div className={`relative w-full h-full flex flex-col overflow-hidden ${isDark ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-900'} transition-colors duration-500`}>

            {/* Header (Optional based on hideHeader prop) */}
            {!hideHeader && (
                <div className={`flex-none h-16 px-6 flex items-center justify-between border-b ${isDark ? 'border-white/10 bg-[#0f172a]/80' : 'border-white/80 bg-white'} backdrop-blur-xl z-20`}>
                    <div className="flex items-center gap-4">
                        {onBack && step === 'SELECTION' && (
                            <button onClick={onBack} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'}`}>
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        {step === 'CALCULATOR' && (
                            <button onClick={() => setStep('SELECTION')} className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'}`}>
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h1 className="text-lg font-bold flex items-center gap-2">
                            <Crown className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
                            Subscription & Pricing
                        </h1>
                    </div>
                </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
                <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">

                    {/* Step 1: PLAN SELECTION */}
                    {step === 'SELECTION' && (
                        <>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center mb-16 relative z-10"
                            >
                                <h2 className={`text-4xl md:text-5xl font-black mb-6 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {currentTier && currentTier !== 'NONE' ? 'Manage Your Plan' : 'Choose Your Power Level'}
                                </h2>
                                <p className={`text-lg md:text-xl max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {currentTier && currentTier !== 'NONE'
                                        ? 'Select a plan to upgrade or modify your subscription.'
                                        : 'Scale your logistics operations with a plan that fits your growth. Upgrade or downgrade at any time.'}
                                </p>
                            </motion.div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full relative z-10">
                                {loadingPlans ? (
                                    <div className="col-span-3 flex justify-center py-20">
                                        <Loader2 className={`w-12 h-12 animate-spin ${isDark ? 'text-white' : 'text-slate-900'}`} />
                                    </div>
                                ) : plans.length === 0 ? (
                                    <div className="col-span-3 text-center py-20 opacity-50">
                                        <p className="text-xl font-bold">No Active Plans Found</p>
                                        <p className="text-sm">Please create a plan in the dashboard.</p>
                                    </div>
                                ) : plans.map((plan, index) => {
                                    const planRank = PLAN_RANK[plan.id.toUpperCase()] || 0;
                                    const isDowngrade = planRank < currentRank;
                                    const isCurrent = planRank === currentRank;
                                    const isDisabled = isDowngrade;
                                    const isGrowth = plan.id === 'growth';

                                    const iconName = plan?.ui_config?.icon || 'Rocket';
                                    const Icon = ICON_MAP[iconName] || Rocket;

                                    return (
                                        <motion.div
                                            key={plan.id}
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 + 0.2 }}
                                            onMouseEnter={() => !isDisabled && setHoveredPlan(plan.id)}
                                            onMouseLeave={() => setHoveredPlan(null)}
                                            onClick={() => !isDisabled && !plan.contact_required && handleSelectPlan(plan.id)}
                                            className={`relative group rounded-[2.5rem] p-8 transition-all duration-300 cursor-pointer ${isDisabled
                                                ? `opacity-50 grayscale cursor-not-allowed ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-100 border-gray-200'}`
                                                : isGrowth
                                                    ? `border-2 scale-105 shadow-2xl ${isDark ? 'bg-white/10 border-amber-500/50 shadow-amber-900/20' : 'bg-white border-amber-400 shadow-orange-100'}`
                                                    : `border hover:scale-[1.02] ${isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 hover:border-slate-200 shadow-xl'}`
                                                }`}
                                        >
                                            {/* Disabled Overlay text */}
                                            {isDisabled && (
                                                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                                                    <div className="bg-black/80 text-white px-4 py-2 rounded-full font-bold text-sm backdrop-blur-md">
                                                        {isDowngrade ? 'Unavailable for Downgrade' : (isCurrent ? 'Current Plan' : 'Plan Limit Exceeded')}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Most Popular Badge */}
                                            {isGrowth && !isDisabled && (
                                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                                                    <Crown className="w-3 h-3 fill-current" /> Best Value
                                                </div>
                                            )}

                                            <div className="mb-6">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${isGrowth ? 'bg-gradient-to-br from-amber-400 to-orange-600 text-white' : (isDark ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600')}`}>
                                                    <Icon className="w-7 h-7" />
                                                </div>
                                                <h3 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                                                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{plan.description}</p>
                                            </div>

                                            {/* Base Price Display */}
                                            <div className="mb-8">
                                                {plan.contact_required ? (
                                                    <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Contact Sales</span>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                {formatPrice(plan.price_monthly, userCountry).value}
                                                            </span>
                                                            <span className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                / user / mo
                                                            </span>
                                                        </div>
                                                        {plan.limits?.min_users && plan.limits.min_users > 1 && (
                                                            <span className="text-xs font-bold text-amber-500 uppercase mt-1">
                                                                Min {plan.limits.min_users} Users Required
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Feature Highlights */}
                                            <div className="space-y-3 mb-8 pl-1">
                                                {(plan.features || []).slice(0, 4).map((feature, i) => (
                                                    <div key={i} className="flex items-start gap-3">
                                                        <div className={`mt-0.5 p-0.5 rounded-full ${isGrowth ? 'bg-emerald-500/20 text-emerald-500' : (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600')}`}>
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                        <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (plan.contact_required) {
                                                        window.location.href = 'mailto:sales@reach.sa';
                                                    } else {
                                                        handleSelectPlan(plan.id);
                                                    }
                                                }}
                                                disabled={isDisabled && !plan.contact_required}
                                                className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${isDisabled && !plan.contact_required
                                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                    : isGrowth
                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:shadow-orange-500/30'
                                                        : isDark
                                                            ? 'bg-white text-black hover:bg-slate-200'
                                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'
                                                    }`}
                                            >
                                                {plan.contact_required ? 'Contact Sales' : (isDisabled ? 'Limit Exceeded' : 'Select Plan')} <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {/* Step 2: CALCULATOR */}
                    {step === 'CALCULATOR' && selectedPlanId && (() => {
                        const plan = plans.find(p => p.id === selectedPlanId);
                        if (!plan) return null;

                        // Calculator Logic
                        const displayMonthlyRate = billingCycle === 'yearly' ? (plan.price_yearly / 12) : plan.price_monthly;
                        const startPrice = plan.price_monthly * 12;
                        const yearlyPrice = plan.price_yearly;

                        // Setup Fee Logic
                        const setupFee = plan.setup_fee || 3000;
                        const waiveThreshold = plan.waive_threshold || 50;
                        const applySetupFee = !plan.limits?.min_users || licenseCount < waiveThreshold;

                        // Totals
                        const subtotal = (billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly) * licenseCount;
                        const discountAmount = appliedPromo ? (subtotal * appliedPromo.discount_percent / 100) : 0;
                        const totalBeforeFee = subtotal - discountAmount;
                        const finalTotal = totalBeforeFee + (applySetupFee ? setupFee : 0);

                        return (
                            <div className="w-full max-w-lg mx-auto animate-in fade-in slide-in-from-right duration-500">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center mb-8"
                                >
                                    <h2 className={`text-3xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Customize Your Plan</h2>
                                    <p className={`text-slate-400`}>Configure limits for <span className="font-bold text-white">{plan.name}</span></p>
                                </motion.div>

                                <div className={`rounded-3xl p-6 shadow-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-100'}`}>
                                    {/* Configuration Controls */}
                                    <div className="space-y-6 mb-8">
                                        {/* Billing Cycle */}
                                        <div className="flex bg-black/20 p-1 rounded-xl">
                                            <button
                                                onClick={() => setBillingCycle('monthly')}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                Monthly
                                            </button>
                                            <button
                                                onClick={() => setBillingCycle('yearly')}
                                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${billingCycle === 'yearly' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                            >
                                                Yearly (Save ~20%)
                                            </button>
                                        </div>

                                        {/* License Count */}
                                        <div>
                                            <div className="flex justify-between text-sm mb-2">
                                                <label className="font-bold text-slate-300">Number of Licenses</label>
                                                <span className="font-mono text-emerald-400">{licenseCount} Users</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={plan.limits?.min_users || 1}
                                                max={100}
                                                value={licenseCount}
                                                onChange={(e) => setLicenseCount(parseInt(e.target.value))}
                                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                            {plan.limits?.min_users && plan.limits.min_users > 1 && (
                                                <p className="text-xs text-amber-500 mt-1">Minimum {plan.limits.min_users} users required for this plan.</p>
                                            )}
                                        </div>

                                        {/* Promo Code */}
                                        <div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Promo Code"
                                                    value={promoCode}
                                                    onChange={(e) => setPromoCode(e.target.value)}
                                                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                                />
                                                <button
                                                    onClick={handleApplyPromo}
                                                    disabled={isApplyingPromo || !promoCode}
                                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                                >
                                                    {isApplyingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                                                </button>
                                            </div>
                                            {promoError && <p className="text-red-400 text-xs mt-1">{promoError}</p>}
                                            {appliedPromo && <p className="text-emerald-400 text-xs mt-1">Code applied: {appliedPromo.discount_percent}% OFF</p>}
                                        </div>
                                    </div>

                                    {/* Summary Line Items */}
                                    <div className="space-y-3 mb-8 border-t border-white/10 pt-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Subscription ({billingCycle})</span>
                                            <span className="text-white font-medium">{formatPrice(subtotal, userCountry).value}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex justify-between text-sm text-emerald-500">
                                                <span>Discount</span>
                                                <span>-{formatPrice(discountAmount, userCountry).value}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Setup Fee</span>
                                            {applySetupFee ? (
                                                <span className="text-white font-medium">{formatPrice(setupFee, userCountry).value}</span>
                                            ) : (
                                                <span className="text-emerald-500 font-bold uppercase text-xs">WAIVED</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Total & Action */}
                                    <div className="flex justify-between items-end mb-6">
                                        <div>
                                            <p className="text-sm text-slate-400 mb-1">Total Due Today</p>
                                            <p className="text-3xl font-black text-white">{formatPrice(finalTotal, userCountry).value} <span className="text-sm text-slate-500 font-bold">{formatPrice(finalTotal, userCountry).code}</span></p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={confirmSubscription}
                                        disabled={isProcessing}
                                        className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 active:scale-95 ${isProcessing
                                            ? 'bg-slate-700 text-slate-400 cursor-wait'
                                            : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`}
                                    >
                                        {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : 'Proceed to Payment'}
                                    </button>

                                    <p className="text-center text-xs text-slate-500 mt-4">
                                        Secure payment powered by Stripe. You can cancel anytime.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}

                </div>
            </div>

        </div>
    );
};

export default ReachPricing;
