import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2,
    ArrowRight,
    CheckCircle,
    AlertCircle,
    ShieldCheck,
    Layout,
    Users,
    Sparkles,
    CreditCard,
    LayoutDashboard,
    Check,
    X,
    ExternalLink,
    Zap,
    Database,
    Megaphone,
    LogOut,
    Map as MapIcon,
    Radar,
    ChevronRight,
    Calculator,
    Activity,
    Globe,
    Lock,
    TrendingUp,
    Server,
    Route,
    Mail,
    Phone,
    FileText,
    Loader2,
    Minus,
    Plus
} from 'lucide-react';
import ROIPanel from './ROIPanel';
import { motion, AnimatePresence } from 'framer-motion';

import { User } from '../types';
import { createTenantForUser, getSubscriptionPlans, validatePromoCode, submitLicenseRequest, logPromoUsage } from '../services/supabase';
import { sendLicenseRequestEmail } from '../services/authService';
import { formatPrice, detectUserCountry } from '../utils/currency';
import MapVisualizer from './MapVisualizer';
import BrandLogo from './common/BrandLogo';

interface TenantSetupModalProps {
    currentUser: User;
    onComplete: (companyId: string | null) => void;
    onNavigateToPartner: () => void;
    onLogout?: () => void;
    onClose?: () => void;
}

// --- MOCK DATA FOR BACKGROUND MAP ---
const MOCK_OFFSET_LAT = 24.7136;
const MOCK_OFFSET_LNG = 46.6753;
const MOCK_MAP_DATA = Array.from({ length: 40 }).map((_, i) => ({
    id: `demo-${i}`,
    name: `Location ${i}`,
    lat: MOCK_OFFSET_LAT + (Math.random() - 0.5) * 0.1,
    lng: MOCK_OFFSET_LNG + (Math.random() - 0.5) * 0.1,
    clientCode: `L-${100 + i}`,
    day: ['Monday', 'Tuesday', 'Wednesday'][Math.floor(Math.random() * 3)],
    status: 'pending'
}));

const TenantSetupModal: React.FC<TenantSetupModalProps> = ({ currentUser, onComplete, onNavigateToPartner, onLogout, onClose }) => {
    const [step, setStep] = useState(0); // 0:Welcome, 1:Profile, 2:Pricing, 3:Calculator/Review
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [plans, setPlans] = useState<any[]>([]);

    // Form Data
    const [formData, setFormData] = useState({
        companyName: '',
        industry: '',
        location: '',
        country: 'Saudi Arabia',
        website: '',
        branchCount: 1,
        routeCount: 5,
        targetCustomersCount: 100,
        phone: currentUser.phone || '', // Initialize with user phone if available
    });

    // Selection state
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

    // Calculator & Review State
    const [licenseCount, setLicenseCount] = useState(5); // Default start
    const [adminPassword, setAdminPassword] = useState('');
    const [useSamePassword, setUseSamePassword] = useState(true);

    // Promo Code State
    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<any>(null);
    const [promoError, setPromoError] = useState('');
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);

    // Contact Sales Modal State
    const [showContactForm, setShowContactForm] = useState(false);
    const [contactNotes, setContactNotes] = useState('');

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const p = await getSubscriptionPlans();
            // Augment plans
            const augmentedPlans = p.map(plan => ({
                ...plan,
                price_yearly: plan.price_yearly || (plan.price_monthly * 10),
                limits: {
                    ...plan.limits,
                    min_users: plan.limits?.min_users || 1,
                    max_users: typeof plan.limits?.users === 'number' ? plan.limits.users : Infinity
                }
            }));
            setPlans(augmentedPlans);
        } catch (e) {
            console.error("Failed to load plans", e);
        }
    };

    const handleApplyPromo = async () => {
        if (!promoCode) return;
        setIsValidatingPromo(true);
        setPromoError('');
        try {
            const promo = await validatePromoCode(promoCode);
            if (promo) {
                setAppliedPromo(promo);
            } else {
                setPromoError('Invalid or expired code');
                setAppliedPromo(null);
            }
        } catch (e) {
            setPromoError('Validation failed');
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleCreateTenant = async () => {
        if (!selectedPlanId) {
            setError("Please select a subscription plan first.");
            setStep(2);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            if (!currentUser.id) throw new Error("User session invalid");

            const currentPlan = plans.find(p => p.id === selectedPlanId);

            if (currentPlan?.contact_required) {
                // Enterprise plan automatically triggers contact request flow (or handled here directly)
                await handleContactSubmit();
            } else {
                const result = await createTenantForUser(
                    currentUser.id,
                    { ...formData, licenseCount },
                    selectedPlanId,
                    useSamePassword ? undefined : adminPassword
                );

                if (appliedPromo && result.companyId) {
                    await logPromoUsage(appliedPromo.code, result.companyId);
                }

                setSuccess("Workspace Ready! Initializing...");
                setTimeout(() => {
                    onComplete(result.companyId);
                }, 1500);
            }

        } catch (err: any) {
            setError(err.message || "Failed to create workspace");
            setIsLoading(false);
        }
    };

    const handleContactSubmit = async () => {
        setIsLoading(true);
        setError('');
        try {
            await submitLicenseRequest(
                currentUser.id!,
                {
                    ...formData,
                    routeCount: 100, // Default estimate if not collected
                    targetCustomersCount: 1000, // Default estimate
                    licenseCount: licenseCount // Include the user count from step 3
                },
                selectedPlanId || 'enterprise', // Default to enterprise if no plan selected (from contact flow)
                appliedPromo?.code,
                contactNotes
            );

            // SEND EMAIL NOTIFICATION (Simulated)
            await sendLicenseRequestEmail({
                ...formData,
                notes: contactNotes,
                planId: selectedPlanId,
                user: {
                    name: `${currentUser.firstName || 'New'} ${currentUser.lastName || 'User'}`,
                    email: currentUser.email || currentUser.username,
                    phone: formData.phone || currentUser.phone
                }
            });

            setSuccess("Request Sent! Our team will contact you shortly.");
            setShowContactForm(false);

            // Reload to trigger the "Pending" screen in App.tsx
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Failed to send request");
        } finally {
            setIsLoading(false);
        }
    };


    // --- RENDER HELPERS ---

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-[#0a0e1a] to-[#1a1f2e] font-sans">
            {/* BACKGROUND MAP (Visible in Step 0) */}
            <AnimatePresence>
                {step === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0 z-0 opacity-20 grayscale-[50%]"
                    >
                        {/* @ts-ignore - Mock data match */}
                        <MapVisualizer route={MOCK_MAP_DATA} isDarkMode={true} settings={{}} />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-transparent to-[#0a0a0f]" />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`relative z-10 w-full h-full flex flex-col transition-all duration-700 ${step === 0 ? 'items-center justify-center' : 'bg-[#1e2433]/30 backdrop-blur-xl text-white'}`}>

                {/* CLOSE BUTTON (Only steps > 0) */}
                {step > 0 && onClose && (
                    <button
                        title="Close Modal"
                        onClick={onClose}
                        className="absolute top-6 right-6 z-50 p-2 rounded-full bg-panel hover:bg-main text-muted hover:text-main transition-all border border-main"
                    >
                        <X className="w-6 h-6" />
                    </button>
                )}

                {/* STEP 0: WELCOME SCREEN */}
                {step === 0 && (
                    <div className="relative z-20 flex flex-col items-center text-center max-w-5xl px-6 animate-in fade-in zoom-in duration-700">
                        {/* LOGOS INTEGRATION */}
                        <div className="flex items-center gap-12 mb-16 opacity-90 scale-110">
                            <BrandLogo variant="algorax" size="lg" animated />
                            <div className="h-16 w-[1px] bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>
                            <BrandLogo variant="reach" size="lg" animated />
                        </div>

                        <h1 className="text-6xl md:text-7xl font-black text-white tracking-tighter mb-6 drop-shadow-2xl font-inter">
                            Optimize <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-brand-primary to-purple-500">Every Mile.</span>
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mb-12 font-medium leading-relaxed drop-shadow-lg tracking-tight">
                            Join thousands of logistics leaders using AI to cut costs and boost efficiency.
                        </p>

                        <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 py-5 rounded-xl bg-white text-slate-900 font-bold text-lg hover:scale-[1.02] transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2 group ring-2 ring-white/50 ring-offset-2 ring-offset-black"
                            >
                                <LayoutDashboard className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                Create Workspace
                            </button>
                        </div>

                        <div className="mt-10 flex flex-col items-center gap-3">
                            {onLogout && (
                                <button
                                    title="Sign Out"
                                    onClick={onLogout}
                                    className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" /> Sign Out
                                </button>
                            )}
                            <button
                                onClick={onNavigateToPartner}
                                className="text-slate-500 hover:text-cyan-400 text-xs flex items-center gap-1.5 transition-colors"
                            >
                                <Users className="w-3.5 h-3.5" />
                                Interested in becoming a partner?
                            </button>
                        </div>
                    </div>
                )}

                {/* CONTENT CONTAINER FOR STEPS 1-3 */}
                {step > 0 && (
                    <div className="w-full h-full flex flex-col md:flex-row overflow-hidden relative">
                        {/* CONTACT MODAL OVERLAY */}
                        <AnimatePresence>
                            {showContactForm && (
                                <motion.div
                                    initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                                    animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
                                    exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                                    className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                                >
                                    <motion.div
                                        initial={{ scale: 0.9, y: 20 }}
                                        animate={{ scale: 1, y: 0 }}
                                        exit={{ scale: 0.9, y: 20 }}
                                        className="w-full max-w-2xl bg-[#0a0a0f]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-indigo-500/10 overflow-hidden relative"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-brand-primary"></div>
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[80px] rounded-full pointer-events-none" />

                                        <div className="mb-6 relative z-10">
                                            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Create Sales Request</h2>
                                            <p className="text-slate-400 text-sm">Review your details before submitting to our enterprise team.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 relative z-10">
                                            {/* User Details */}
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-4 flex items-center gap-2">
                                                    <Users className="w-3 h-3" /> User Info
                                                </h3>
                                                <div className="space-y-5">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                                            <Users className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5">Full Name</label>
                                                            <p className="text-white font-bold truncate leading-tight">{currentUser.firstName || 'New'} {currentUser.lastName || 'User'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                                                            <Mail className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5">Email Address</label>
                                                            <p className="text-white font-medium text-sm truncate leading-tight">{currentUser.email || currentUser.username}</p>
                                                        </div>
                                                    </div>

                                                    <InputField
                                                        label="Direct Contact Phone"
                                                        icon={Phone}
                                                        value={formData.phone}
                                                        onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
                                                        placeholder="e.g. +966 50..."
                                                    />
                                                </div>
                                            </div>

                                            {/* Company Details */}
                                            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                                                    <Building2 className="w-3 h-3" /> Company Info
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                                                            <Building2 className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5">Company</label>
                                                            <p className="text-white font-bold truncate leading-tight">{formData.companyName || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Industry</label>
                                                            <p className="text-slate-300 text-sm font-medium">{formData.industry || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Location</label>
                                                            <p className="text-slate-300 text-sm font-medium">{formData.location || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                                        <div>
                                                            <label className="text-[10px] uppercase text-slate-500 font-bold block">License Count</label>
                                                            <p className="text-xs text-slate-400 font-medium">{billingCycle === 'yearly' ? 'Yearly Billing' : 'Monthly Billing'}</p>
                                                        </div>
                                                        <span className="text-2xl font-black text-white">{licenseCount} <span className="text-[10px] font-bold text-slate-500">USERS</span></span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-8">
                                            <TextAreaField
                                                label="Additional Notes"
                                                value={contactNotes}
                                                onChange={(e: any) => setContactNotes(e.target.value)}
                                                placeholder="Tell us more about your requirements..."
                                            />
                                        </div>

                                        <div className="flex gap-4">
                                            <button
                                                title="Cancel Request"
                                                onClick={() => setShowContactForm(false)}
                                                className="px-6 py-4 rounded-xl text-slate-400 font-bold hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                title="Send Sales Request"
                                                onClick={handleContactSubmit}
                                                disabled={isLoading}
                                                className="flex-1 bg-brand-primary text-white rounded-xl font-black text-sm uppercase tracking-wide py-4 hover:opacity-90 transition-all shadow-lg shadow-brand-primary/10 flex items-center justify-center gap-2"
                                            >
                                                {isLoading ? 'Sending...' : 'Send Request'} <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </div>

                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* LEFT SIDEBAR: STEPS & INFO */}
                        <div className="w-full md:w-80 bg-[#1e2433]/40 border-r border-[#2d3748] p-8 flex flex-col relative overflow-hidden backdrop-blur-md">
                            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.05),transparent)] pointer-events-none" />

                            <div className="mb-12">
                                <BrandLogo variant="reach" size="sm" showText={true} />
                            </div>

                            <div className="space-y-8 z-10">
                                {[
                                    { num: 1, title: 'Company Profile', icon: Building2 },
                                    { num: 2, title: 'Select Plan', icon: CreditCard },
                                    { num: 3, title: 'Review & Launch', icon: RocketIcon },
                                ].map((s, idx) => (
                                    <div key={idx} className={`flex items-center gap-4 transition-all duration-300 ${step === s.num ? 'opacity-100 translate-x-2' : 'opacity-40'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${step === s.num ? 'border-brand-primary text-brand-primary bg-brand-primary/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : (step > s.num ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-main text-muted')}`}>
                                            {step > s.num ? <Check className="w-5 h-5" /> : <span className="font-bold font-mono">{s.num}</span>}
                                        </div>
                                        <div>
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${step === s.num ? 'text-cyan-400' : 'text-slate-500'}`}>Step {s.num}</p>
                                            <p className={`font-bold text-sm ${step === s.num ? 'text-white' : 'text-slate-400'}`}>{s.title}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-auto z-10 pt-8 border-t border-main">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-panel overflow-hidden border border-main">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                        {currentUser.firstName?.[0] || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold text-sm truncate">{currentUser.firstName} {currentUser.lastName}</p>
                                        <p className="text-slate-400 text-xs truncate">{currentUser.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT MAIN CONTENT AREA */}
                        <div className="flex-1 relative overflow-hidden bg-main">
                            <AnimatePresence mode="wait">
                                {step === 1 && (
                                    <Step1Profile
                                        formData={formData}
                                        setFormData={setFormData}
                                        onNext={() => setStep(2)}
                                        onBack={() => setStep(0)}
                                    />
                                )}
                                {step === 2 && (
                                    <Step2Pricing
                                        plans={plans}
                                        billingCycle={billingCycle}
                                        setBillingCycle={setBillingCycle}
                                        selectedPlanId={selectedPlanId}
                                        setSelectedPlanId={setSelectedPlanId}
                                        onNext={() => setStep(3)}
                                        onBack={() => setStep(1)}
                                    />
                                )}
                                {step === 3 && (
                                    <Step3Calculator
                                        selectedPlanId={selectedPlanId}
                                        plans={plans}
                                        billingCycle={billingCycle}
                                        licenseCount={licenseCount}
                                        setLicenseCount={setLicenseCount}
                                        adminPassword={adminPassword}
                                        setAdminPassword={setAdminPassword}
                                        useSamePassword={useSamePassword}
                                        setUseSamePassword={setUseSamePassword}
                                        isLoading={isLoading}
                                        error={error}
                                        success={success}
                                        onSubmit={handleCreateTenant}
                                        onBack={() => setStep(2)}
                                        promoCode={promoCode}
                                        setPromoCode={setPromoCode}
                                        appliedPromo={appliedPromo}
                                        handleApplyPromo={handleApplyPromo}
                                        isValidatingPromo={isValidatingPromo}
                                        promoError={promoError}
                                        setAppliedPromo={setAppliedPromo}
                                        onContactSales={() => setShowContactForm(true)}
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS with PROFESSIONAL STYLING ---

const InputField = ({ label, icon: Icon, value, onChange, placeholder, autoFocus, type = "text", className = "" }: any) => (
    <div className={`group ${className}`}>
        {label && <label className="text-xs font-semibold text-[#9ca3af] mb-2 block group-focus-within:text-[#00d4ff] transition-colors pl-1 uppercase tracking-wide">{label}</label>}
        <div className="relative">
            {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af] group-focus-within:text-[#00d4ff] transition-colors" />}
            <input
                title={label || placeholder}
                aria-label={label || placeholder}
                type={type}
                value={value}
                onChange={onChange}
                className={`w-full bg-[#0f1219]/60 border border-[#2d3748] hover:border-[#4b5563] rounded-xl py-4 ${Icon ? 'pl-12' : 'pl-5'} pr-5 text-[#e0e0e0] text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#00d4ff]/30 focus:border-[#00d4ff]/50 outline-none transition-all duration-200 placeholder:text-[#4b5563] focus:bg-[#0f1219]/80 focus:shadow-[0_4px_20px_-4px_rgba(0,212,255,0.1)]`}
                placeholder={placeholder}
                autoFocus={autoFocus}
            />
        </div>
    </div>
);

const TextAreaField = ({ label, value, onChange, placeholder, className = "" }: any) => (
    <div className={`group ${className}`}>
        {label && <label className="text-xs font-semibold text-[#9ca3af] mb-2 block group-focus-within:text-[#00d4ff] transition-colors pl-1 uppercase tracking-wide">{label}</label>}
        <textarea
            title={label || placeholder}
            aria-label={label || placeholder}
            value={value}
            onChange={onChange}
            className="w-full bg-[#0f1219]/60 border border-[#2d3748] hover:border-[#4b5563] rounded-xl p-4 text-[#e0e0e0] text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#00d4ff]/30 focus:border-[#00d4ff]/50 outline-none transition-all duration-200 placeholder:text-[#4b5563] focus:bg-[#0f1219]/80 h-24 resize-none"
            placeholder={placeholder}
        />
    </div>
);

const SelectField = ({ label, icon: Icon, value, onChange, options, placeholder, className = "" }: any) => (
    <div className={`group ${className}`}>
        {label && <label className="text-xs font-semibold text-[#9ca3af] mb-2 block group-focus-within:text-[#00d4ff] transition-colors pl-1 uppercase tracking-wide">{label}</label>}
        <div className="relative">
            {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af] group-focus-within:text-[#00d4ff] transition-colors" />}
            <select
                title={label || placeholder}
                aria-label={label || placeholder}
                value={value}
                onChange={onChange}
                className={`w-full bg-[#0f1219]/60 border border-[#2d3748] hover:border-[#4b5563] rounded-xl py-4 ${Icon ? 'pl-12' : 'pl-5'} pr-10 text-[#e0e0e0] text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#00d4ff]/30 focus:border-[#00d4ff]/50 outline-none transition-all appearance-none focus:bg-[#0f1219]/80`}
            >
                {placeholder && <option value="" disabled className="bg-[#0f1219] text-[#9ca3af]">{placeholder}</option>}
                {options.map((opt: any) => (
                    <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value} className="bg-[#0f1219] text-[#e0e0e0]">
                        {typeof opt === 'string' ? opt : opt.label}
                    </option>
                ))}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] rotate-90" />
        </div>
    </div>
);

const LicenseCounter = ({ count, onChange, min = 5 }: any) => (
    <div className="bg-[#0f1219] rounded-2xl p-4 border border-[#2d3748] shadow-inner">
        <label className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-3 flex justify-between items-center">
            <span>Licenses Needed</span>
            {count >= 100 && <a href="#" className="text-cyan-400 hover:text-cyan-300 normal-case flex items-center gap-1 text-[10px]">Need 100+? Contact us <ArrowRight className="w-3 h-3" /></a>}
        </label>
        <div className="flex items-center gap-4">
            <button
                onClick={() => onChange(Math.max(min, count - 1))}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#1e2433] text-white hover:bg-white/10 active:scale-95 transition-all border border-white/5 shadow-md flex-shrink-0"
                aria-label="Decrease license count"
            >
                <Minus className="w-5 h-5" />
            </button>
            <div className="flex-1 relative">
                <input
                    type="number"
                    min={min}
                    value={count}
                    onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
                    className="w-full bg-transparent text-center text-3xl font-black text-white outline-none font-mono"
                    aria-label="License count"
                />
                <span className="text-[10px] text-slate-500 absolute -bottom-3 left-1/2 -translate-x-1/2 font-medium whitespace-nowrap">Min. {min} users per subscription</span>
            </div>
            <button
                onClick={() => onChange(count + 1)}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#1e2433] text-white hover:bg-white/10 active:scale-95 transition-all border border-white/5 shadow-md flex-shrink-0"
                aria-label="Increase license count"
            >
                <Plus className="w-5 h-5" />
            </button>
        </div>
    </div>
);

const PlanInclusions = ({ plan }: { plan?: any }) => {
    const features: string[] = plan?.features?.length > 0
        ? plan.features
        : ["Route planning & optimization", "Analytics dashboard", "Data upload (CSV/Excel)", "User management", "Map visualization", "Email support"];

    return (
        <div className="my-6 p-5 bg-white/5 rounded-2xl border border-white/10">
            <h4 className="text-[10px] font-black text-[#9ca3af] uppercase tracking-widest mb-4">Included in {plan?.name || 'your'} plan</h4>
            <ul className="space-y-3">
                {features.map((item: string, i: number) => (
                    <li key={i} className="flex items-center gap-3 text-xs font-medium text-slate-300">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
};



const Step1Profile = ({ formData, setFormData, onNext, onBack }: any) => {

    // Expanded Industry List
    const INDUSTRIES = [
        "Logistics & Transportation", "Freight Forwarding", "Last Mile Delivery", "Courier Services",
        "Retail (General)", "E-Commerce", "FMCG Distribution", "Wholesale",
        "Manufacturing", "Food & Beverage", "Pharmaceuticals", "Construction & Building Materials",
        "Field Services", "Waste Management", "Oil & Gas", "Other"
    ].sort();

    // Standard Country List
    const COUNTRIES = [
        "Saudi Arabia", "United Arab Emirates", "Egypt", "Bahrain", "Kuwait", "Oman", "Qatar", "Jordan", "India", "Pakistan", "United Kingdom", "United States", "Other"
    ];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full h-full p-8 md:p-16 overflow-y-auto custom-scrollbar flex flex-col max-w-3xl mx-auto justify-center"
        >
            <div className="mb-10">
                <h2 className="text-3xl font-bold text-white mb-2">Company Profile</h2>
                <p className="text-slate-400">Tell us about your organization to personalize your workspace.</p>
            </div>

            <div className="space-y-6">
                <InputField
                    label="Company Legal Name"
                    icon={Building2}
                    value={formData.companyName}
                    onChange={(e: any) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g. Acme Logistics Global"
                    autoFocus
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SelectField
                        label="Industry Sector"
                        icon={Layout}
                        value={formData.industry}
                        onChange={(e: any) => setFormData({ ...formData, industry: e.target.value })}
                        options={INDUSTRIES}
                        placeholder="Select Industry"
                    />
                    <InputField
                        label="Headquarters City"
                        icon={MapIcon}
                        value={formData.location}
                        onChange={(e: any) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g. Riyadh"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SelectField
                        label="Country / Region"
                        icon={Globe}
                        value={formData.country}
                        onChange={(e: any) => setFormData({ ...formData, country: e.target.value })}
                        options={COUNTRIES}
                    />
                    <InputField
                        label="Company Website"
                        icon={ExternalLink}
                        value={formData.website}
                        onChange={(e: any) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="www.example.com"
                    />
                </div>

                <InputField
                    label="Initial Operational Branches"
                    icon={Server} // Or similar
                    type="number"
                    value={formData.branchCount}
                    onChange={(e: any) => setFormData({ ...formData, branchCount: parseInt(e.target.value) || 1 })}
                />
            </div>

            <div className="flex gap-4 mt-12">
                <button onClick={onBack} className="px-8 py-4 text-slate-500 font-bold hover:text-white transition-colors text-sm">Back</button>
                <button
                    disabled={!formData.companyName || !formData.industry}
                    onClick={onNext}
                    className="flex-1 bg-white text-slate-900 rounded-xl font-bold text-sm uppercase tracking-wide py-4 hover:bg-cyan-50 transition-colors shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Continue <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
};

const Step2Pricing = ({ plans, billingCycle, setBillingCycle, selectedPlanId, setSelectedPlanId, onNext, onBack }: any) => {
    const userCountry = detectUserCountry();
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full h-full p-6 md:p-10 overflow-y-auto custom-scrollbar flex flex-col"
        >
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-main mb-2">Select Your Plan</h2>
                    <p className="text-muted">Scalable solutions for every stage.</p>
                </div>
                <div className="bg-panel p-1 rounded-xl flex border border-main">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${billingCycle === 'monthly' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${billingCycle === 'yearly' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Yearly <span className="text-[9px] bg-emerald-500 text-white px-1.5 rounded py-0.5">-20%</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                {plans.map((plan: any) => {
                    const price = billingCycle === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly;
                    const isSelected = selectedPlanId === plan.id;
                    const isPopular = plan.ui_config?.isPopular || plan.is_popular || plan.name?.toLowerCase() === 'growth';

                    return (
                        <div
                            key={plan.id}
                            onClick={() => setSelectedPlanId(plan.id)}
                            className={`relative rounded-2xl p-8 border cursor-pointer transition-all duration-300 hover:scale-[1.02] flex flex-col
                                ${isSelected
                                    ? 'bg-brand-primary/5 border-brand-primary shadow-2xl shadow-brand-primary/10'
                                    : 'bg-panel/50 border-main hover:border-muted'
                                }
                            `}
                        >
                            {isPopular && <div className="absolute top-4 right-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-lg tracking-widest">Best Value</div>}

                            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 ${isSelected ? 'text-brand-primary' : 'text-muted'}`}>{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mb-6">
                                <span className="text-4xl font-black text-main tracking-tight">{formatPrice(price, userCountry).value}</span>
                                <span className="text-[10px] font-bold text-muted uppercase">{formatPrice(0, userCountry).code} / User / Mo</span>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {(plan.features || []).map((f: string, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-muted font-medium">
                                        <CheckCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-brand-primary' : 'text-muted'}`} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                title={isSelected ? "Plan Selected" : `Choose ${plan.name} Plan`}
                                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${isSelected ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/40' : 'bg-panel text-muted hover:text-main hover:bg-main border border-main'}`}>
                                {isSelected ? 'Selected' : 'Choose Plan'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-end gap-4 mt-8">
                <button onClick={onBack} className="px-8 py-4 text-slate-500 font-bold hover:text-white transition-colors text-sm">Back</button>
                <button
                    title="Next Step"
                    disabled={!selectedPlanId}
                    onClick={onNext}
                    className="px-10 py-4 bg-brand-primary text-white rounded-xl font-bold text-sm uppercase tracking-wide hover:opacity-90 transition-all shadow-lg shadow-brand-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    Next Step <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
};

const Step3Calculator = ({
    selectedPlanId, plans, billingCycle, licenseCount, setLicenseCount,
    adminPassword, setAdminPassword, useSamePassword, setUseSamePassword,
    isLoading, error, success, onSubmit, onBack,
    promoCode, setPromoCode, appliedPromo, handleApplyPromo, isValidatingPromo, promoError, setAppliedPromo,
    onContactSales
}: any) => {

    const plan = plans.find((p: any) => p.id === selectedPlanId);
    if (!plan) return <div className="p-10 text-center text-white">Select a plan to continue</div>;
    const userCountry = detectUserCountry();
    const currCode = formatPrice(0, userCountry).code;

    // --- PRICING LOGIC ---
    const monthlyRate = billingCycle === 'yearly' ? (plan.price_yearly / 12) : plan.price_monthly;
    // Enforce 5 user min visual logic (though slider used to do it, now counter does)
    const effectiveLicenses = Math.max(5, licenseCount);
    const baseSubtotal = (billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly) * effectiveLicenses;
    const discountAmount = appliedPromo ? (baseSubtotal * appliedPromo.discount_percent / 100) : 0;
    const totalBilled = baseSubtotal - discountAmount;

    // Setup fee logic
    const setupFee = plan.setup_fee || 3000;
    const waiveThreshold = plan.waive_threshold || 50;
    const isWaived = effectiveLicenses >= waiveThreshold;
    const finalTotal = totalBilled + (isWaived ? 0 : setupFee);

    // --- ROI CALCULATION ---
    // Metrics per user (Mock logic based on user request "137.5 hours/month" for what seems like a small team)
    // Let's assume the user sample given (137.5 hrs/mo) was for the minimum 5 users.
    // 137.5 / 5 = 27.5 hours/user/month.
    const HOURS_PER_USER_MO = 27.5;
    const hoursSavedMo = effectiveLicenses * HOURS_PER_USER_MO;
    const hoursSavedYr = hoursSavedMo * 12;

    // Financial ROI: "2.6x return"
    const costMo = monthlyRate * effectiveLicenses;
    const valueGeneratedMo = costMo * 2.6;
    const netBenefitMo = valueGeneratedMo - costMo;

    const valueYr = valueGeneratedMo * 12;
    // Efficiency: +40% capacity (Fixed metric)
    const routesDaily = effectiveLicenses * 30; // 30 routes per driver/user?

    if (success) {
        return (
            <div className="w-full h-full flex items-center justify-center flex-col text-center animate-in zoom-in duration-500 bg-main">
                <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/50">
                    <Check className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-black text-main mb-4">You're All Set!</h2>
                <p className="text-muted text-lg mb-8">{success}</p>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold animate-pulse">
                    Redirecting to dashboard...
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="w-full h-full p-6 md:p-8 flex flex-col overflow-hidden items-center justify-center"
        >
            <div className="w-full max-w-2xl flex flex-col h-full max-h-[90vh]">
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-1">Finalize Setup</h2>
                        <p className="text-slate-400 text-sm">Review limits and activate your workspace.</p>
                    </div>
                </div>

                <div className="bg-[#1e2433]/40 rounded-3xl p-8 backdrop-blur-md flex flex-col shadow-2xl overflow-y-auto custom-scrollbar flex-1">

                    {/* Plan Badge */}
                    <div className="flex justify-between items-center mb-8 pb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                <RocketIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl text-white font-bold">{plan.name} Plan</h3>
                                <p className="text-sm text-slate-400 capitalize">{billingCycle} Billing</p>
                            </div>
                        </div>
                        <button onClick={onBack} className="text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-4 py-2 rounded-lg hover:bg-cyan-500/10 transition-all">Change Plan</button>
                    </div>

                    {/* License Counter */}
                    <div className="mb-8">
                        <LicenseCounter count={effectiveLicenses} onChange={setLicenseCount} min={5} />
                    </div>

                    {/* Inclusions */}
                    <PlanInclusions plan={plan} />

                    {/* Totals Section */}
                    <div className="space-y-3 mt-4 bg-black/20 p-5 rounded-2xl">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Subtotal</span>
                            <span className="text-white font-medium">{formatPrice(baseSubtotal, userCountry).value} {currCode}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Setup Fee</span>
                            <div className="text-right">
                                {isWaived && (
                                    <span className="block text-[10px] text-slate-500 line-through decoration-slate-600">
                                        {formatPrice(setupFee, userCountry).value} {currCode}
                                    </span>
                                )}
                                <span className={isWaived ? "text-emerald-400 font-bold" : "text-white"}>
                                    {isWaived ? `0 ${currCode}` : `${formatPrice(setupFee, userCountry).value} ${currCode}`}
                                </span>
                            </div>
                        </div>

                        {appliedPromo && (
                            <div className="flex justify-between text-xs text-emerald-400 animate-pulse">
                                <span className="flex items-center gap-2"><Sparkles className="w-3 h-3" /> Discount ({appliedPromo.code})</span>
                                <span className="font-bold">-{formatPrice(discountAmount, userCountry).value} {currCode}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-end mt-4 pt-4 relative">
                            <span className="text-white font-bold text-base">Total</span>
                            <div className="text-right">
                                <span className="block text-3xl font-black text-white tracking-tight leading-none">{formatPrice(finalTotal, userCountry).value}<span className="text-xs text-slate-500 ml-1">{currCode}</span></span>
                                {(discountAmount > 0 || isWaived) && (
                                    <div className="flex flex-col items-end mt-1">
                                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                            You saved {formatPrice(discountAmount + (isWaived ? setupFee : 0), userCountry).value} {currCode}!
                                        </span>
                                        <span className="text-[9px] text-slate-500 font-medium">
                                            {isWaived && `(${formatPrice(setupFee, userCountry).value} Setup${discountAmount > 0 ? ' + ' : ''}`}
                                            {discountAmount > 0 && `${formatPrice(discountAmount, userCountry).value} Promo)`}
                                            {isWaived && discountAmount === 0 && ')'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Promo Input */}
                    <div className="mt-4 flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="PROMO CODE"
                                className="w-full bg-[#0f1219] border border-[#2d3748] rounded-xl py-2.5 pl-4 pr-10 text-white text-xs font-bold uppercase focus:ring-1 focus:ring-cyan-500 outline-none placeholder:normal-case placeholder:font-medium placeholder:text-slate-500"
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            />
                            {appliedPromo && <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-emerald-400" />}
                        </div>
                        <button
                            onClick={handleApplyPromo}
                            disabled={!promoCode || isValidatingPromo || appliedPromo}
                            className={`px-4 rounded-xl font-bold text-[10px] uppercase transition-all ${appliedPromo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
                        >
                            {appliedPromo ? 'Applied' : 'Apply'}
                        </button>
                    </div>

                    {error && <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

                    {/* Actions - Big Buttons */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={onContactSales}
                            className="w-full py-4 bg-[#1e2433] hover:bg-[#2d3748] border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 rounded-xl font-bold text-sm shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40 hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                        >
                            <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" /> Talk to Sales
                        </button>

                        <button
                            onClick={onSubmit}
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-brand-primary to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-black text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:-translate-y-0.5 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><RocketIcon className="w-4 h-4 group-hover:-translate-y-1 transition-transform" /> Launch Workspace</>}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// Icon helpers
const RocketIcon = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>;
const CalendarIcon = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;
const Tag = (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l5 5a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-5-5z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></svg>;

export default TenantSetupModal;
