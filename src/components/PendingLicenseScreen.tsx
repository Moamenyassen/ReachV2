import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Mail, Clock, Copy, Check, MessageCircle } from 'lucide-react';
import BrandLogo from './common/BrandLogo';

interface PendingLicenseScreenProps {
    onLogout: () => void;
    currentUser: any;
    licenseTicket?: string;
}

const SUPPORT_EMAIL = 'support@algorax.ai';

const PendingLicenseScreen: React.FC<PendingLicenseScreenProps> = ({ onLogout, currentUser, licenseTicket }) => {
    const [copied, setCopied] = useState(false);

    // Derive a reference code: use licenseTicket if provided, else first 8 chars of user ID
    const refCode = licenseTicket
        ? licenseTicket.toUpperCase()
        : currentUser?.id
            ? `RCH-${currentUser.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
            : null;

    const handleCopyRef = () => {
        if (!refCode) return;
        navigator.clipboard.writeText(refCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="min-h-screen w-full bg-[#0f172a] flex flex-col items-center justify-center relative overflow-hidden font-sans">
            {/* Background Ambience */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center text-center">
                {/* Brand */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="mb-12 scale-125"
                >
                    <BrandLogo variant="reach" size="lg" animated />
                </motion.div>

                {/* Status Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="w-full bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden"
                >
                    {/* Scanning Line */}
                    <div
                        className="absolute top-0 left-0 w-full h-[2px] opacity-50"
                        style={{
                            background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
                            animation: 'scanLine 3s ease-in-out infinite',
                        }}
                    />

                    {/* Icon */}
                    <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <div className="absolute inset-0 border border-cyan-500/30 rounded-full animate-ping opacity-20" />
                        <Clock className="w-8 h-8 text-cyan-400" />
                    </div>

                    <h1 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">
                        Request Under Review
                    </h1>
                    <p className="text-slate-400 text-base mb-6 leading-relaxed">
                        Hi {currentUser?.firstName || 'there'}, we've received your workspace request.
                        Our team is reviewing your application.
                    </p>

                    {/* Reference Number */}
                    {refCode && (
                        <div className="mb-6 bg-slate-800/60 border border-white/10 rounded-2xl p-4">
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-2">Your Reference Number</p>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xl font-black text-white font-mono tracking-widest">{refCode}</span>
                                <button
                                    onClick={handleCopyRef}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
                                    title="Copy reference number"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">Keep this number handy when contacting support.</p>
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5 mb-4 text-left">
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Typical Processing Time</p>
                                <p className="text-sm text-white font-semibold">Within 24 business hours</p>
                                <p className="text-xs text-slate-400 mt-0.5">You'll receive an email at <span className="text-white font-bold">{currentUser?.email}</span> once your workspace is ready.</p>
                            </div>
                        </div>
                    </div>

                    {/* Support Contact */}
                    <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5 text-left">
                        <div className="flex items-start gap-3">
                            <MessageCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">Need Help?</p>
                                <p className="text-sm text-slate-300">
                                    Contact our team at{' '}
                                    <a
                                        href={`mailto:${SUPPORT_EMAIL}?subject=Request%20${refCode || ''}&body=My%20reference%20number%20is%3A%20${refCode || ''}`}
                                        className="text-cyan-400 hover:text-cyan-300 font-bold underline transition-colors"
                                    >
                                        {SUPPORT_EMAIL}
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8"
                >
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold text-sm px-6 py-3 rounded-full hover:bg-white/5"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </motion.div>
            </div>

            <style>{`
                @keyframes scanLine {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default PendingLicenseScreen;
