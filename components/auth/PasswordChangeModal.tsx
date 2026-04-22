
import React, { useState } from 'react';
import { KeyRound, X, AlertTriangle, ShieldCheck, Eye, EyeOff } from 'lucide-react';

// Password strength helper
const getStrength = (pw: string) => {
    if (!pw) return { score: 0, label: '', color: '' };
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    if (s <= 1) return { score: s, label: 'Weak', color: 'bg-red-500' };
    if (s <= 2) return { score: s, label: 'Fair', color: 'bg-amber-500' };
    if (s <= 3) return { score: s, label: 'Good', color: 'bg-blue-500' };
    return { score: s, label: 'Strong', color: 'bg-emerald-500' };
};

interface PasswordChangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    pwdError: string;
    pwdSuccess: string;
    currentPwd: string;
    setCurrentPwd: (val: string) => void;
    newPwd: string;
    setNewPwd: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    t: any;
}

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
    isOpen, onClose, pwdError, pwdSuccess, currentPwd, setCurrentPwd, newPwd, setNewPwd, onSubmit, t
}) => {
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    if (!isOpen) return null;

    const strength = getStrength(newPwd);

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full relative border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
                        <KeyRound className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.changePassword || 'Change Password'}</h3>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    {pwdError && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 border border-red-200 dark:border-red-800">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> {pwdError}
                        </div>
                    )}
                    {pwdSuccess && (
                        <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs p-3 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2 border border-green-200 dark:border-green-800">
                            <ShieldCheck className="w-4 h-4 shrink-0" /> {pwdSuccess}
                        </div>
                    )}

                    {/* Current Password */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">{t.currentPassword || 'Current Password'}</label>
                        <div className="relative">
                            <input
                                type={showCurrent ? 'text' : 'password'}
                                value={currentPwd}
                                onChange={e => setCurrentPwd(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(!showCurrent)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                tabIndex={-1}
                                aria-label={showCurrent ? 'Hide' : 'Show'}
                            >
                                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">{t.newPassword || 'New Password'}</label>
                        <div className="relative">
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPwd}
                                onChange={e => setNewPwd(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                required
                                minLength={8}
                                autoComplete="new-password"
                                placeholder="Min. 8 characters"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                tabIndex={-1}
                                aria-label={showNew ? 'Hide' : 'Show'}
                            >
                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Strength Meter */}
                        {newPwd.length > 0 && (
                            <div className="pt-1.5">
                                <div className="flex gap-1 mb-1">
                                    {[1, 2, 3, 4].map(i => (
                                        <div
                                            key={i}
                                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : 'bg-gray-200 dark:bg-gray-600'}`}
                                        />
                                    ))}
                                </div>
                                <p className="text-[10px] font-bold text-right text-gray-400">{strength.label}</p>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-100 dark:bg-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-slate-600 dark:text-slate-300"
                        >
                            {t.cancel || 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            {t.update || 'Update'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordChangeModal;
