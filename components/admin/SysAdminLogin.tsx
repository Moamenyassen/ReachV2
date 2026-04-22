
import React, { useState, useRef } from 'react';
import { ShieldCheck, Lock, ArrowRight, AlertTriangle, Eye, EyeOff, Timer } from 'lucide-react';

interface SysAdminLoginProps {
    onLoginSuccess: () => void;
    onBack: () => void;
    isDarkMode: boolean;
}

// Basic credential check
const checkSysAdminCredentials = (username: string, password: string): boolean => {
    return username === 'sysadmin' && password === 'Moamen224!';
};

const SysAdminLogin: React.FC<SysAdminLoginProps> = ({ onLoginSuccess, onBack, isDarkMode }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        const isValid = checkSysAdminCredentials(username, password);

        if (isValid) {
            onLoginSuccess();
        } else {
            setError('Invalid credentials.');
            setPassword('');
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans ${isDarkMode ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            {/* Background Effects */}
            <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isDarkMode ? 'from-indigo-900/20 via-[#020617] to-[#020617]' : 'from-indigo-100/50 via-slate-50 to-slate-50'}`} />

            <div className="relative z-10 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 mb-6 shadow-2xl shadow-indigo-500/30">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className={`text-3xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>System Core Access</h1>
                    <p className={`font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Restricted to authorized personnel only.</p>
                </div>

                <div className={`${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl'} backdrop-blur-xl border p-8 rounded-3xl`}>
                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm font-bold animate-in slide-in-from-top-2 duration-200">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <div className="flex-1">
                                    {error}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className={`text-xs font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>SysAdmin ID</label>
                            <div className="relative">
                                <ShieldCheck className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoComplete="username"
                                    className={`w-full border rounded-xl py-4 pl-12 pr-4 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                    placeholder="Enter ID"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className={`text-xs font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Security Key</label>
                            <div className="relative">
                                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    className={`w-full border rounded-xl py-4 pl-12 pr-12 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-600/25"
                        >
                            Authenticate <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <button onClick={onBack} className="text-slate-500 hover:text-white text-sm font-bold transition-colors">
                            Return to Tenant Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SysAdminLogin;
