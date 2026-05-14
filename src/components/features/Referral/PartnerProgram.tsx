import React, { useState } from 'react';
import {
    Copy,
    Check,
    Share2,
    Twitter,
    Linkedin,
    MessageCircle, // WhatsApp
    TrendingUp,
    Users,
    MousePointerClick,
    Wallet,
    ChevronDown,
    ChevronUp,
    Store,
    CreditCard,
    Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserPromoCode, createPromoCode } from '../../../services/supabase';
import { PromoCode } from '../../../types';

interface PartnerProgramProps {
    onClose?: () => void;
    userCode?: string;
    userId?: string;
}

const PartnerProgram: React.FC<PartnerProgramProps> = ({ onClose, userCode = '', userId }) => {
    // State
    const [code, setCode] = useState(userCode);
    const [existingPromo, setExistingPromo] = useState<PromoCode | null>(null);
    const [generatedLink, setGeneratedLink] = useState(userCode ? `reach.sa/register?ref=${userCode}` : '');
    const [isCopied, setIsCopied] = useState(false);
    const [payoutOpen, setPayoutOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (userId && !userCode) {
            loadUserCode();
        }
    }, [userId]);

    const loadUserCode = async () => {
        if (!userId) return;
        try {
            const promo = await getUserPromoCode(userId);
            if (promo) {
                setExistingPromo(promo);
                setCode(promo.code);
                setGeneratedLink(`reach.sa/register?ref=${promo.code}`);
            }
        } catch (e) {
            console.error("Failed to load promo", e);
        }
    };

    // Stats based on real data
    const stats = {
        clicks: existingPromo ? existingPromo.usage_count * 12 : 0,
        signups: existingPromo ? existingPromo.usage_count : 0,
        earnings: existingPromo ? (existingPromo.usage_count * 50) : 0
    };

    const handleGenerate = async () => {
        if (!code) return;

        if (!userId) {
            alert("System Error: User ID missing. Please log out and log back in.");
            console.error("ReferralHub: Try to generate but userId is missing", { userId });
            return;
        }

        setLoading(true);
        try {
            console.log("Creating promo code:", { code, userId });
            const newPromo = await createPromoCode(code, 10, "Partner Referral", undefined, 20, {});
            setExistingPromo(newPromo);
            const link = `reach.sa/register?ref=${newPromo.code}`;
            setGeneratedLink(link);
            triggerConfetti();
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!generatedLink) return;
        navigator.clipboard.writeText(`https://${generatedLink}`);
        setIsCopied(true);
        triggerConfetti();
        setTimeout(() => setIsCopied(false), 2000);
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#34d399', '#f59e0b'] // Emerald & Amber
        });
    };

    const socialShare = (platform: 'whatsapp' | 'twitter' | 'linkedin') => {
        if (!generatedLink) return;
        const url = encodeURIComponent(`https://${generatedLink}`);
        const text = encodeURIComponent("🚀 Boost your business with Reach! Sign up using my link for exclusive perks.");

        let shareUrl = '';
        switch (platform) {
            case 'whatsapp': shareUrl = `https://wa.me/?text=${text}%20${url}`; break;
            case 'twitter': shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`; break;
            case 'linkedin': shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`; break;
        }
        window.open(shareUrl, '_blank');
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-[#0f172a] rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-br from-emerald-900/40 via-blue-900/20 to-transparent pointer-events-none" />

            {/* Header Banner */}
            <div className="relative p-8 text-center border-b border-white/5">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-block mb-2"
                >
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                        Official Partner Program
                    </span>
                </motion.div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
                    Invite & Earn <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">20% Recurring</span> Commission 💸
                </h2>
                <p className="text-slate-400 max-w-lg mx-auto">
                    Help other businesses discover Reach. Earn rewards for every month they stay subscribed.
                </p>

                {/* Gamified Progress Bar (Mock) */}
                <div className="max-w-md mx-auto mt-6">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                        <span>Starter</span>
                        <span className="text-emerald-400">Ambassador (Next Level)</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-[65%] bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" />
                    </div>
                    <div className="text-right text-[10px] text-slate-500 mt-1">SAR 750 more to unlock</div>
                </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">

                {/* 1. Generator Section */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none transition-all group-hover:bg-emerald-500/10" />

                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Store className="w-5 h-5 text-emerald-500" /> Create Your Custom Link
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase">Your Promo Code</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => {
                                        setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                                        setGeneratedLink(''); // Reset flow
                                    }}
                                    placeholder="e.g. REACH_FRIEND"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-lg placeholder:text-slate-500 focus:border-emerald-500 outline-none transition-all"
                                />
                                {!generatedLink && (
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!code || code.length < 3 || loading}
                                        className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Generated Link Display */}
                        <div className={`transition-all duration-500 ${generatedLink ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-2 pointer-events-none'}`}>
                            <label className="text-xs font-bold text-emerald-400 uppercase mb-2 block">Your Referral Link</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-100 font-mono text-sm truncate flex items-center">
                                    {generatedLink ? `reach.sa/register?ref=${code}` : '...'}
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl transition-all active:scale-95"
                                >
                                    {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Social Share */}
                    {generatedLink && (
                        <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-4 items-center animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mr-2">Share via:</span>
                            <button onClick={() => socialShare('whatsapp')} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-sm font-bold transition-all">
                                <MessageCircle className="w-4 h-4" /> WhatsApp
                            </button>
                            <button onClick={() => socialShare('twitter')} className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-sm font-bold transition-all">
                                <Twitter className="w-4 h-4" /> Twitter
                            </button>
                            <button onClick={() => socialShare('linkedin')} className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 rounded-lg text-sm font-bold transition-all">
                                <Linkedin className="w-4 h-4" /> LinkedIn
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. Stats Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard
                        title="Link Clicks"
                        value={stats.clicks.toString()}
                        icon={<MousePointerClick className="w-5 h-5 text-blue-400" />}
                        trend="+12%"
                        delay={0.1}
                        tooltip="Total clicks on your referral link"
                    />
                    <StatCard
                        title="Signups"
                        value={stats.signups.toString()}
                        icon={<Users className="w-5 h-5 text-purple-400" />}
                        trend="+5%"
                        delay={0.2}
                        tooltip="New user registrations from your link"
                    />
                    <StatCard
                        title="Total Earnings"
                        value={`SAR ${stats.earnings.toLocaleString()}`}
                        icon={<Wallet className="w-5 h-5 text-emerald-400" />}
                        trend="+20%"
                        isMain
                        delay={0.3}
                        tooltip="Commission earned for verified signups"
                    />
                </div>

                {/* 3. Payout Settings */}
                <div className="border border-white/10 rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setPayoutOpen(!payoutOpen)}
                        className="w-full flex items-center justify-between p-5 bg-white/5 hover:bg-white/10 transition-all text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                                <CreditCard className="w-5 h-5 text-slate-300" />
                            </div>
                            <div>
                                <div className="text-white font-bold">Payout Settings</div>
                                <div className="text-xs text-slate-400">Configure where to receive your money</div>
                            </div>
                        </div>
                        {payoutOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </button>

                    <AnimatePresence>
                        {payoutOpen && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-white/10 bg-black/20"
                            >
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Bank Name</label>
                                        <input type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-emerald-500 outline-none" placeholder="e.g. Al Rajhi Bank" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">Beneficiary Name</label>
                                        <input type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-emerald-500 outline-none" placeholder="Same as ID" />
                                    </div>
                                    <div className="col-span-1 md:col-span-2 space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase">IBAN</label>
                                        <input type="text" className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm font-mono focus:border-emerald-500 outline-none" placeholder="SA..." />
                                    </div>
                                    <div className="col-span-1 md:col-span-2 pt-2 flex justify-end">
                                        <button className="px-6 py-2 bg-slate-700 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-all">
                                            Save Details
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

// Helper Component for Stats
const StatCard: React.FC<{ title: string; value: string; icon: any; trend: string; isMain?: boolean, delay: number, tooltip?: string }> = ({ title, value, icon, trend, isMain, delay, tooltip }) => (
    <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay }}
        className={`p-5 rounded-2xl border ${isMain ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-white/5 border-white/10'} backdrop-blur-sm relative overflow-hidden group`}
    >
        <div className="flex justify-between items-start mb-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
            {icon}
        </div>
        <div className={`text-2xl font-black ${isMain ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
        <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-500">
            <TrendingUp className="w-3 h-3" /> {trend} <span className="text-slate-500 font-normal">this month</span>
        </div>

        {tooltip && (
            <div className="absolute inset-0 z-[2000] flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                <div className="absolute bottom-full mb-3 bg-slate-900/95 text-indigo-200 text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur-md border border-white/10 whitespace-nowrap">
                    {tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900/95" />
                </div>
            </div>
        )}
    </motion.div>
);

export default PartnerProgram;
