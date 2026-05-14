import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, User, Mail, Globe, Megaphone } from 'lucide-react';
import { registerAsReachCustomer } from '../../../services/supabase';
import { User as UserType } from '../../../types';

interface PartnerRegistrationModalProps {
    currentUser: UserType;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedUser: UserType) => void;
}

const PartnerRegistrationModal: React.FC<PartnerRegistrationModalProps> = ({ currentUser, isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleJoin = async () => {
        setLoading(true);
        setError(null);
        try {
            await registerAsReachCustomer(currentUser);
            // Update local user object immediately
            const updatedUser = { ...currentUser, isRegisteredCustomer: true };
            onSuccess(updatedUser);
        } catch (err: any) {
            setError(err.message || "Failed to register. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 text-center border-b border-white/5 relative bg-gradient-to-b from-emerald-900/20 to-transparent">
                            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/10 rounded-full flex items-center justify-center ring-1 ring-emerald-500/30">
                                <Megaphone className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Join Partner Program</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Become a Reach Partner to earn verified commissions. Create your account to start generating referral links.
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {/* User Info Preview */}
                            <div className="space-y-3">
                                <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-white/5">
                                    <User className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Name</div>
                                        <div className="text-sm font-medium text-white">{currentUser.firstName || currentUser.username} {currentUser.lastName}</div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-white/5">
                                    <Mail className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Email</div>
                                        <div className="text-sm font-medium text-white">{currentUser.email || "No email linked"}</div>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-white/5">
                                    <Globe className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Status</div>
                                        <div className="text-sm font-medium text-emerald-400">Company Internal User</div>
                                    </div>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <span className="text-sm text-red-200">{error}</span>
                                </div>
                            )}

                            {/* Terms */}
                            <p className="text-[10px] text-slate-500 text-center px-4">
                                By joining, you agree to create a separate Reach Customer account linked to this email for payout and verification purposes.
                            </p>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleJoin}
                                    disabled={loading || !currentUser.email}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join Now"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PartnerRegistrationModal;
