import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { registerGlobalUser } from '../../services/supabase';
import { signIn as supabaseSignIn, signUp as supabaseSignUp, resetPassword } from '../../services/authService';
import { validateRegistrationForm, isValidEmail } from '../../utils';
import {
  Lock, User as UserIcon, AlertCircle, Truck, Network, Zap, Building2,
  ShieldCheck, Globe, ArrowRight, Cpu, Eye, EyeOff, Mail, Timer
} from 'lucide-react';
import BrandLogo from '../common/BrandLogo';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  if (password.length === 0) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Good', color: 'bg-blue-500' };
  return { score, label: 'Strong', color: 'bg-emerald-500' };
};

const backgroundGridStyle: React.CSSProperties = {
  backgroundImage: `linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)`,
  backgroundSize: '50px 50px',
  perspective: '1000px',
  transform: 'rotateX(60deg) scale(2)'
};

const JOB_ROLES = [
  'CEO / Founder',
  'General Manager',
  'Operations Manager',
  'Sales Manager',
  'Regional Manager',
  'Branch Manager',
  'Logistics Manager',
  'Distribution Manager',
  'Supervisor',
  'Sales Representative',
  'IT Manager',
  'Other',
];

interface LoginProps {
  onAttemptLogin: (companyNameIgnored: string, username: string, password: string) => Promise<User[] | void>;
  onSysAdminLogin: () => void;
  isDarkMode: boolean;
  language: 'en' | 'ar';
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onSelectUser?: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onAttemptLogin, onSysAdminLogin, language, onSelectUser }) => {
  const isDarkMode = true;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [ambiguousUsers, setAmbiguousUsers] = useState<User[]>([]);

  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [isRegistering, setIsRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [regData, setRegData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    phone: '',
    country: 'United Arab Emirates',
    role: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => { if (lockoutTimer.current) clearInterval(lockoutTimer.current); };
  }, []);

  const startLockout = () => {
    setLockoutRemaining(LOCKOUT_SECONDS);
    lockoutTimer.current = setInterval(() => {
      setLockoutRemaining(prev => {
        if (prev <= 1) {
          clearInterval(lockoutTimer.current!);
          lockoutTimer.current = null;
          setLoginAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail || !isValidEmail(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail);
      setForgotSuccess('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setForgotError(err.message || 'Failed to send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const validation = validateRegistrationForm({
      email: regData.email,
      password: regData.password,
      confirmPassword: regData.confirmPassword,
      firstName: regData.firstName,
      lastName: regData.lastName,
    });
    if (!validation.isValid) {
      setError(Object.values(validation.errors)[0]);
      setIsLoading(false);
      return;
    }
    if (!tosAccepted) {
      setError('Please accept the Terms of Service to continue.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await supabaseSignUp(regData.email, regData.password, {
        firstName: regData.firstName,
        lastName: regData.lastName,
        phone: regData.phone,
        country: regData.country,
        role: regData.role,
        companyName: regData.companyName,
      });
      if (result.needsEmailConfirmation) {
        setSuccessMsg('Check your email to confirm your account before signing in.');
        setRegData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } else {
        setSuccessMsg('Account created! Signing you in...');
        setTimeout(() => {
          if (onSelectUser && result.user) onSelectUser(result.user);
          else { setIsRegistering(false); setUsername(regData.email); setPassword(''); }
        }, 1500);
        setRegData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      }
    } catch (err: any) {
      try {
        const fallbackUser = await registerGlobalUser({
          firstName: regData.firstName,
          lastName: regData.lastName,
          email: regData.email,
          phone: regData.phone,
          password: regData.password,
          role: regData.role,
          country: regData.country,
          companyName: regData.companyName,
        });
        setSuccessMsg('Account created! Signing you in...');
        setTimeout(() => {
          if (onSelectUser && fallbackUser) onSelectUser(fallbackUser);
          else { setIsRegistering(false); setUsername(regData.email); setPassword(''); }
        }, 1500);
        setRegData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } catch (fallbackErr: any) {
        setError(fallbackErr?.message || err?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (lockoutRemaining > 0) return;
    setIsLoading(true);
    setAmbiguousUsers([]);
    try {
      const results = await onAttemptLogin('', username, password);
      setLoginAttempts(0);
      if (results && Array.isArray(results) && results.length > 1) {
        setAmbiguousUsers(results);
        setIsLoading(false);
      }
    } catch (err: any) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setError(`Too many failed attempts. Locked for ${LOCKOUT_SECONDS}s.`);
        startLockout();
      } else {
        const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
        setError(`${err.message || 'Login failed'}. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
      setIsLoading(false);
    }
  };

  // --- SPLASH SCREEN ---
  if (showSplash) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-[#0a0a0f] text-white cursor-pointer select-none"
        onClick={() => setShowSplash(false)}
      >
        <div className="relative mb-8 group">
          <div className="absolute -inset-12 blur-[60px] rounded-full animate-pulse-slow bg-blue-500/30"></div>
          <div className="relative z-10 animate-[float_6s_ease-in-out_infinite] flex flex-col items-center">
            <BrandLogo size="xl" animated showText={false} variant="algorax" isDarkMode={true} />
            <div className="mt-6 text-2xl font-black tracking-[0.3em] animate-pulse text-blue-200">ALGORAX</div>
          </div>
        </div>
        <p className="font-mono text-xs tracking-[0.4em] animate-pulse text-center text-blue-400/80">
          INITIALIZING CORE SYSTEMS...
        </p>
        <p className="mt-6 text-[10px] text-white/20 font-mono">tap to skip</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#0a0a0f] to-[#050510]"></div>
      <div className="absolute inset-0 opacity-20" style={backgroundGridStyle}></div>
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] animate-pulse bg-indigo-600/20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] animate-pulse delay-1000 bg-blue-600/10"></div>
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-20 animate-[float_10s_ease-in-out_infinite] opacity-30">
          <Network className="w-24 h-24 text-indigo-500" />
        </div>
        <div className="absolute bottom-40 right-20 animate-[float_15s_ease-in-out_infinite_reverse] opacity-20">
          <Zap className="w-32 h-32 text-blue-400" />
        </div>
        <div className="absolute top-1/2 left-[-20%] animate-[slideRight_30s_linear_infinite] opacity-10 blur-sm">
          <Truck className="w-64 h-64 text-white" />
        </div>
      </div>

      {/* Ambiguous Company Selector */}
      {ambiguousUsers.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="text-xl font-black text-white mb-2">Select Account</h3>
            <p className="text-gray-400 text-sm mb-6">Multiple accounts found. Select the company you want to access.</p>
            <div className="space-y-3">
              {ambiguousUsers.map((u, idx) => (
                <button
                  key={`${u.username}_${u.companyId}_${idx}`}
                  onClick={() => onSelectUser && onSelectUser(u)}
                  className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/50 rounded-xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-white">{u.companyId ? `Company — ${String(u.companyId).slice(0, 8).toUpperCase()}` : 'Personal Workspace'}</p>
                      <p className="text-xs text-gray-500 group-hover:text-gray-400 capitalize">{u.role?.toLowerCase()}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                </button>
              ))}
            </div>
            <button onClick={() => setAmbiguousUsers([])} className="mt-6 w-full py-3 text-sm font-bold text-gray-500 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col md:flex-row rounded-[2rem] border shadow-2xl overflow-hidden min-h-[600px] bg-white/5 backdrop-blur-2xl border-white/10">

        {/* LEFT: Always Marketing Panel */}
        <div className="hidden md:flex flex-col justify-between p-12 w-[45%] relative overflow-hidden bg-gradient-to-br from-indigo-900/40 to-black/40">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

          <div className="z-10">
            <div className="mb-10 relative group">
              <div className="absolute -inset-8 bg-indigo-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              <div className="relative transform transition-transform duration-700 hover:scale-105 preserve-3d">
                <BrandLogo size="xl" animated variant="algorax" isDarkMode={true} />
                <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] animate-[shine_5s_infinite_linear]"></div>
              </div>
              <div className="absolute -right-4 -bottom-4 bg-blue-950/80 border border-blue-500/30 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-blue-300 tracking-widest uppercase shadow-lg transform rotate-[-2deg] group-hover:rotate-0 transition-all">
                Enterprise AI
              </div>
            </div>

            <h2 className="text-4xl font-black leading-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
              The Future of<br />Retail Intelligence
            </h2>
            <p className="text-base text-indigo-200/70 max-w-sm leading-relaxed">
              AI-driven route optimization that helps retail sales teams cut costs, save time, and grow faster.
            </p>

            <div className="mt-8 space-y-3">
              {['Cut route planning time by 80%', 'Maximize daily customer visits', 'Real-time analytics & insights'].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-indigo-200/60">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></div>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="z-10 mt-auto">
            <div className="flex gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500/50 w-full animate-[loading_3s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.5}s` }}></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-mono text-blue-400/50">SYSTEM STATUS: OPTIMAL</p>
          </div>
        </div>

        {/* RIGHT: All Forms */}
        <div className={`flex-1 flex flex-col ${isRegistering ? 'overflow-y-auto' : 'justify-center'} bg-black/20`}>

          {/* ---- LOGIN FORM ---- */}
          {!isRegistering && !isForgotPassword && (
            <div className="p-8 md:p-12 flex flex-col justify-center h-full">
              <div className="mb-10 text-center md:text-left">
                <div className="inline-flex md:hidden items-center justify-center w-12 h-12 rounded-xl mb-4 bg-blue-600/20 border border-blue-500/30">
                  <Cpu className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-xs font-bold text-indigo-400 tracking-widest uppercase mb-2">Flagship Application</p>
                <h1
                  onDoubleClick={onSysAdminLogin}
                  className="text-3xl md:text-4xl font-black mb-2 tracking-tight flex items-center md:justify-start justify-center gap-3 cursor-default select-none text-white"
                >
                  Reach <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-bold self-start mt-1 pointer-events-none">AI</span>
                </h1>
                <p className="text-sm text-slate-400">{language === 'ar' ? 'قم بتسجيل الدخول للمتابعة' : 'Sign in to access your dashboard'}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5 max-w-sm mx-auto md:mx-0 w-full">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-4 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium block">{error}</span>
                      {lockoutRemaining > 0 && (
                        <span className="flex items-center gap-1.5 mt-1 text-xs text-red-300">
                          <Timer className="w-3.5 h-3.5" /> Retry in {lockoutRemaining}s
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2 group">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-300/70">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 group-focus-within:text-white transition-colors" />
                    <input
                      type="email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl py-4 pl-12 pr-4 bg-white/5 border border-white/10 text-white placeholder-white/20 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      placeholder="you@company.com"
                      required
                      disabled={lockoutRemaining > 0}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-300/70">Password</label>
                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 group-focus-within:text-white transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl py-4 pl-12 pr-12 bg-white/5 border border-white/10 text-white placeholder-white/20 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                      placeholder="Your password"
                      required
                      disabled={lockoutRemaining > 0}
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-white transition-colors" tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || lockoutRemaining > 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-900 disabled:to-indigo-900 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-3 group"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : lockoutRemaining > 0 ? (
                    <><Timer className="w-5 h-5" /> Locked ({lockoutRemaining}s)</>
                  ) : (
                    <>Sign In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center max-w-sm mx-auto md:mx-0 w-full">
                <p className="text-sm text-slate-400">
                  New to Reach AI?{' '}
                  <button onClick={() => { setIsRegistering(true); setError(''); }} className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                    Create an account
                  </button>
                </p>
              </div>

              <div className="mt-auto pt-8 px-8 md:px-12 flex items-center gap-2 text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                <span>Secure Connection</span>
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}

          {/* ---- FORGOT PASSWORD FORM ---- */}
          {isForgotPassword && (
            <div className="p-8 md:p-12 flex flex-col justify-center h-full">
              <form onSubmit={handleForgotPassword} className="space-y-6 max-w-sm mx-auto md:mx-0 w-full animate-in fade-in duration-300">
                <div className="mb-2">
                  <h2 className="text-2xl font-black text-white mb-1">Reset Password</h2>
                  <p className="text-sm text-gray-400">Enter your email and we'll send a reset link.</p>
                </div>

                {forgotError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{forgotError}</span>
                  </div>
                )}
                {forgotSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm p-4 rounded-lg flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{forgotSuccess}</span>
                  </div>
                )}

                {!forgotSuccess && (
                  <>
                    <div className="space-y-2 group">
                      <label className="text-xs font-bold uppercase tracking-wider text-indigo-300/70">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className="w-full rounded-xl py-4 pl-12 pr-4 bg-white/5 border border-white/10 text-white placeholder-white/20 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                          placeholder="your@company.com"
                          required
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      {forgotLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Mail className="w-5 h-5" /> Send Reset Link</>}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(false); setForgotEmail(''); setForgotSuccess(''); setForgotError(''); }}
                  className="w-full text-sm text-slate-400 hover:text-white transition-colors font-medium py-2"
                >
                  ← Back to Login
                </button>
              </form>
            </div>
          )}

          {/* ---- REGISTRATION FORM ---- */}
          {isRegistering && (
            <div className="p-8 md:p-10 flex flex-col">
              <div className="max-w-lg mx-auto md:mx-0 w-full">
                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-2xl font-black text-white mb-1">Create Your Account</h2>
                  <p className="text-sm text-slate-400">Join thousands of retail teams already using Reach AI.</p>
                </div>

                {successMsg && (
                  <div className="mb-4 bg-green-500/10 border border-green-500/20 text-green-200 text-sm p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{successMsg}</span>
                  </div>
                )}
                {error && (
                  <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                <form onSubmit={handleRegisterUser} className="space-y-4">
                  {/* Name Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">First Name</label>
                      <input required value={regData.firstName} onChange={e => setRegData({ ...regData, firstName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all"
                        placeholder="First name" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Last Name</label>
                      <input required value={regData.lastName} onChange={e => setRegData({ ...regData, lastName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all"
                        placeholder="Last name" />
                    </div>
                  </div>

                  {/* Company Name */}
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Company Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                      <input required value={regData.companyName} onChange={e => setRegData({ ...regData, companyName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pl-10 text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all"
                        placeholder="e.g. Acme Logistics" />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Work Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                      <input required type="email" value={regData.email} onChange={e => setRegData({ ...regData, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pl-10 text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all"
                        placeholder="name@company.com" />
                    </div>
                  </div>

                  {/* Phone + Job Role Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Mobile</label>
                      <input required value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all"
                        placeholder="+966 5..." />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Job Role</label>
                      <select required value={regData.role} onChange={e => setRegData({ ...regData, role: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all appearance-none">
                        <option value="" disabled className="bg-[#0a0a0f]">Select role...</option>
                        {JOB_ROLES.map(r => <option key={r} value={r} className="bg-[#0a0a0f]">{r}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Country */}
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Country</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                      <select required value={regData.country} onChange={e => setRegData({ ...regData, country: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pl-10 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all appearance-none">
                        {['United Arab Emirates','Saudi Arabia','Qatar','Bahrain','Kuwait','Oman','Egypt','Jordan','United States','United Kingdom','Other'].map(c => (
                          <option key={c} value={c} className="bg-[#0a0a0f]">{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Password — separate rows */}
                  <div className="pt-2 border-t border-white/10 space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Password</label>
                      <input type="password" required value={regData.password} onChange={e => setRegData({ ...regData, password: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all"
                        placeholder="Min. 8 characters" minLength={8} />
                      {regData.password.length > 0 && (() => {
                        const s = getPasswordStrength(regData.password);
                        return (
                          <div className="mt-2">
                            <div className="flex gap-1 mb-1">
                              {[1,2,3,4].map(i => <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= s.score ? s.color : 'bg-white/10'}`} />)}
                            </div>
                            <p className="text-[10px] font-bold text-right" style={{ color: s.score <= 1 ? '#ef4444' : s.score <= 2 ? '#f59e0b' : s.score <= 3 ? '#3b82f6' : '#10b981' }}>
                              {s.label}
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400 mb-1.5 block">Confirm Password</label>
                      <input type="password" required value={regData.confirmPassword} onChange={e => setRegData({ ...regData, confirmPassword: e.target.value })}
                        className={`w-full bg-white/5 border rounded-xl p-3 text-sm text-white placeholder-white/20 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none hover:bg-white/10 transition-all ${regData.confirmPassword && regData.confirmPassword !== regData.password ? 'border-red-500/50' : 'border-white/10'}`}
                        placeholder="Repeat your password" minLength={8} />
                      {regData.confirmPassword && regData.confirmPassword !== regData.password && (
                        <p className="text-[10px] text-red-400 mt-1 font-medium">Passwords do not match</p>
                      )}
                    </div>
                  </div>

                  {/* Terms of Service */}
                  <label className="flex items-start gap-3 cursor-pointer group pt-1">
                    <div className={`w-5 h-5 rounded-md border-2 mt-0.5 flex items-center justify-center shrink-0 transition-all ${tosAccepted ? 'bg-blue-600 border-blue-600' : 'border-white/20 group-hover:border-blue-500/50'}`}
                      onClick={() => setTosAccepted(!tosAccepted)}>
                      {tosAccepted && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className="text-xs text-slate-400 leading-relaxed" onClick={() => setTosAccepted(!tosAccepted)}>
                      I agree to the{' '}
                      <a href="#" onClick={e => e.stopPropagation()} className="text-blue-400 hover:text-blue-300 underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" onClick={e => e.stopPropagation()} className="text-blue-400 hover:text-blue-300 underline">Privacy Policy</a>
                    </span>
                  </label>

                  <button type="submit" disabled={isLoading || !tosAccepted}
                    className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-blue-900 disabled:to-indigo-900 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-95">
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                  </button>
                </form>

                <div className="mt-6 text-center pb-6">
                  <p className="text-sm text-slate-400">
                    Already have an account?{' '}
                    <button onClick={() => { setIsRegistering(false); setError(''); setSuccessMsg(''); }}
                      className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
                      Sign in
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(100vw); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes shine { 0% { transform: translateX(-200%) skewX(-12deg); } 20% { transform: translateX(200%) skewX(-12deg); } 100% { transform: translateX(200%) skewX(-12deg); } }
      `}</style>
    </div>
  );
};

export default Login;
