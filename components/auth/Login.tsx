import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types';
import { registerGlobalUser } from '../../services/supabase';
import { signIn as supabaseSignIn, signUp as supabaseSignUp, resetPassword } from '../../services/authService';
import { validateRegistrationForm, isValidEmail } from '../../utils';
import { Lock, User as UserIcon, AlertCircle, Truck, Network, Zap, Building2, ShieldCheck, Globe, ArrowRight, Cpu, Eye, EyeOff, Mail, Timer } from 'lucide-react';
import BrandLogo from '../common/BrandLogo';

// --- Rate Limiting Constants ---
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

// --- Password Strength Helper ---
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

interface LoginProps {

  onAttemptLogin: (companyNameIgnored: string, username: string, password: string) => Promise<User[] | void>;
  onSysAdminLogin: () => void;
  // Controls
  isDarkMode: boolean;
  language: 'en' | 'ar';
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onSelectUser?: (user: User) => void;
}
const Login: React.FC<LoginProps> = ({ onAttemptLogin, onSysAdminLogin, language, onSelectUser }) => {

  const isDarkMode = true; // Always force dark mode for Login/Splash per brand design
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [ambiguousUsers, setAmbiguousUsers] = useState<User[]>([]);
  // Rate limiting
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Forgot password
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Splash screen effect
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup lockout timer on unmount
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
  const t = {

    title: language === 'ar' ? 'مرحبًا بعودتك' : 'Welcome Back',
    subtitle: language === 'ar' ? 'قم بتسجيل الدخول للوصول إلى لوحة التخطيط' : 'Sign in to access your route planning dashboard',
    // company: language === 'ar' ? 'اسم الشركة' : 'Company Name', // Removed
    username: language === 'ar' ? 'اسم المستخدم' : 'Username',
    usernamePlaceholder: language === 'ar' ? 'أدخل اسم المستخدم' : 'Enter username',
    password: language === 'ar' ? 'كلمة المرور' : 'Password',
    passwordPlaceholder: language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password',
    signIn: language === 'ar' ? 'تسجيل الدخول' : 'Sign In',
    processing: language === 'ar' ? 'جاري التحقق...' : 'Verifying...',
    brand: "Reach",
    tagline: language === 'ar' ? 'تحسين التوزيع الذكي' : 'Intelligent Distribution Optimization'
  };
  // Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  // RegStep removed - now single step for user reg
  const [successMsg, setSuccessMsg] = useState('');
  const [regData, setRegData] = useState({

    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: 'United Arab Emirates', // Default
    role: '',
    password: '',
    confirmPassword: ''
  });
  const handleRegisterUser = async (e: React.FormEvent) => {

    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate form with validation utility
    const validation = validateRegistrationForm({

      email: regData.email,
      password: regData.password,
      confirmPassword: regData.confirmPassword,
      firstName: regData.firstName,
      lastName: regData.lastName
    });
    if (!validation.isValid) {

      const firstError = Object.values(validation.errors)[0];
      setError(firstError);
      setIsLoading(false);
      return;
    }
    try {

      // Try Supabase Auth first (new secure method)
      const result = await supabaseSignUp(regData.email, regData.password, {

        firstName: regData.firstName,
        lastName: regData.lastName,
        phone: regData.phone,
        country: regData.country,
        role: regData.role
      });
      if (result.needsEmailConfirmation) {

        setSuccessMsg("Check your email to confirm your account!");
        // Do NOT close the form, so user sees the message
        // setIsRegistering(false);
        setRegData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } else {

        // Auto-login if email confirmation is not required (Direct Activation)
        setSuccessMsg("Account Created! Logging you in...");
        // Short delay to show the success message before switching view
        setTimeout(() => {

          if (onSelectUser && result.user) {

            onSelectUser(result.user);
          } else {

            // Fallback if no onSelectUser (shouldn't happen in main app)
            setIsRegistering(false);
            setUsername(regData.email);
            setPassword('');
          }
        }, 1500);
        setRegData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      }
    } catch (err: any) {
      console.error('Supabase Auth Error:', err);

      // Fallback to legacy registration if Supabase Auth not configured
      try {

        const fallbackUser = await registerGlobalUser({

          firstName: regData.firstName,
          lastName: regData.lastName,
          email: regData.email,
          phone: regData.phone,
          password: regData.password,
          role: regData.role,
          country: regData.country
        });

        setSuccessMsg("Account Created! Logging you in...");

        setTimeout(() => {

          if (onSelectUser && fallbackUser) {

            onSelectUser(fallbackUser);
          } else {

            setIsRegistering(false);
            setUsername(regData.email);
            setPassword('');
          }
        }, 1500);

        setRegData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } catch (fallbackErr: any) {

        console.error('Registration Error Structure:', err);
        console.error('Fallback Error Structure:', fallbackErr);
        // Prioritize fallback error as it likely contains the specific DB constraint info
        setError(fallbackErr?.message || err?.message || 'Registration failed');
      }
    } finally {

      setIsLoading(false);
    }
  };
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check lockout
    if (lockoutRemaining > 0) return;

    setIsLoading(true);
    setAmbiguousUsers([]);

    try {
      const results = await onAttemptLogin('', username, password);

      // Success — reset attempts
      setLoginAttempts(0);

      // Handle Multiple Matches (Ambiguous Login)
      if (results && Array.isArray(results) && results.length > 1) {
        setAmbiguousUsers(results);
        setIsLoading(false);
        return;
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
  const handleSelectAmbiguousUser = (user: User) => {

    if (onSelectUser) {

      onSelectUser(user);
    }
  };
  if (showSplash) {

    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center z-50 ${isDarkMode ? 'bg-[#0a0a0f] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="relative mb-8 group">
          {/* Ambient Glow */}
          <div className={`absolute -inset-12 blur-[60px] rounded-full animate-pulse-slow ${isDarkMode ? 'bg-blue-500/30' : 'bg-blue-500/10'}`}></div>

          {/* Hologram Elements */}
          <div className="relative z-10 animate-[float_6s_ease-in-out_infinite] flex flex-col items-center">
            <BrandLogo size="xl" animated showText={false} variant="algorax" isDarkMode={isDarkMode} />
            <div className={`mt-6 text-2xl font-black tracking-[0.3em] animate-pulse ${isDarkMode ? 'text-blue-200' : 'text-blue-600'}`}>
              ALGORAX
            </div>
            {/* Scanline Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-b w-full h-full -translate-y-full animate-[scan_4s_easeInOut_infinite] pointer-events-none ${isDarkMode ? 'from-transparent via-blue-400/10 to-transparent' : 'from-transparent via-blue-600/5 to-transparent'}`}></div>
          </div>

          {/* Reflection */}
          <div className={`absolute top-full left-0 w-full h-24 -scale-y-100 opacity-30 transform-gpu blur-sm ${isDarkMode ? 'bg-gradient-to-b from-blue-500/10 to-transparent' : 'bg-gradient-to-b from-blue-600/5 to-transparent'}`}></div>
        </div>
        <p className={`font-mono text-xs tracking-[0.4em] animate-pulse text-center ${isDarkMode ? 'text-blue-400/80' : 'text-blue-600/80'}`}>
          INITIALIZING CORE SYSTEMS...
        </p>
      </div >
    );
  }
  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden font-sans ${isDarkMode ? 'bg-[#0a0a0f] text-white' : 'bg-slate-50 text-slate-900'}`}>
      {/* --- BACKGROUND LAYERS --- */}
      {/* Base Abstract Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${isDarkMode ? 'from-gray-900 via-[#0a0a0f] to-[#050510]' : 'from-slate-50 via-white to-blue-50'}`}></div>
      {/* Animated Grid/Network */}
      <div className={`absolute inset-0 ${isDarkMode ? 'opacity-20' : 'opacity-5'}`} style={backgroundGridStyle}>
      </div >
      {/* Floating Orbs */}
      <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] animate-pulse ${isDarkMode ? 'bg-indigo-600/20' : 'bg-indigo-400/10'}`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] animate-pulse delay-1000 ${isDarkMode ? 'bg-blue-600/10' : 'bg-blue-400/10'}`}></div>
      {/* 3D Visual Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-20 animate-[float_10s_ease-in-out_infinite] opacity-30">
          <Network className={`w-24 h-24 ${isDarkMode ? 'text-indigo-500' : 'text-indigo-300'}`} />
        </div>
        <div className="absolute bottom-40 right-20 animate-[float_15s_ease-in-out_infinite_reverse] opacity-20">
          <Zap className={`w-32 h-32 ${isDarkMode ? 'text-blue-400' : 'text-blue-300'}`} />
        </div>

        {/* Moving Truck for context */}
        <div className="absolute top-1/2 left-[-20%] animate-[slideRight_30s_linear_infinite] opacity-10 blur-sm">
          <Truck className={`w-64 h-64 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} />
        </div>
      </div>
      {/* --- COMPANY SELECTION MODAL --- */}
      {
        ambiguousUsers.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
              <h3 className="text-xl font-black text-white mb-2">Select Account</h3>
              <p className="text-gray-400 text-sm mb-6">Multiple accounts found with these credentials. Please select the company you wish to access.</p>

              <div className="space-y-3">
                {ambiguousUsers.map((u, idx) => (
                  <button
                    key={`${u.username}_${u.companyId}_${idx}`}
                    onClick={() => handleSelectAmbiguousUser(u)}
                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/50 rounded-xl transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">{u.companyId || 'Personal Workspace'}</p>
                        <p className="text-xs text-gray-500 group-hover:text-gray-400">{u.role}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>

              <button
                onClick={() => setAmbiguousUsers([])}
                className="mt-6 w-full py-3 text-sm font-bold text-gray-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div >
          </div >
        )
      }
      {/* --- LOGIN CARD --- */}
      <div className={`relative z-10 w-full max-w-5xl flex flex-col md:flex-row rounded-[2rem] border shadow-2xl overflow-hidden min-h-[600px] ${isDarkMode ? 'bg-white/5 backdrop-blur-2xl border-white/10' : 'bg-white/80 backdrop-blur-xl border-white shadow-slate-200/50'}`}>

        {/* LEFT SIDE: Dynamic Panel (Brand OR Registration) */}
        <div className={`hidden md:flex flex-col justify-between p-12 w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-900/40 to-black/40 transition-all duration-500 ${isRegistering ? 'bg-indigo-950/80 items-start' : ''}`}>

          {/* Abstract Decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

          {!isRegistering ? (
            // --- MARKETING VIEW ---
            <>
              <div className="z-10">
                <div className="mb-10 relative group perspective-[1000px]">
                  {/* Backlight */}
                  <div className="absolute -inset-8 bg-indigo-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

                  {/* Logo Container */}
                  <div className="relative transform transition-transform duration-700 hover:scale-105 hover:rotate-y-12 preserve-3d">
                    <BrandLogo size="xl" animated variant="algorax" isDarkMode={isDarkMode} />

                    {/* Holographic Shine */}
                    <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] animate-[shine_5s_infinite_linear]"></div>
                  </div>

                  {/* Text Badge */}
                  <div className="absolute -right-4 -bottom-4 bg-blue-950/80 border border-blue-500/30 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-blue-300 tracking-widest uppercase shadow-lg transform rotate-[-2deg] group-hover:rotate-0 transition-all">
                    Enterprise AI
                  </div>
                </div>

                <h2 className="text-5xl font-black leading-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                  The Future of <br />Retail Intelligence
                </h2>
                <p className="text-lg text-indigo-200/70 max-w-sm leading-relaxed">
                  Merging advanced shelving units with AI-driven logistics to create a seamless supply chain ecosystem.
                </p>
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
            </>
          ) : (<>
            // --- REGISTRATION FORM ---
            <div className="mb-6">
              <h2 className="text-3xl font-black text-white mb-2">Create Account</h2>
              <p className="text-sm text-indigo-200">
                Join the network to start managing your logistics.
              </p>

              {successMsg && (
                <div className="mt-4 bg-green-500/10 border border-green-500/20 text-green-200 text-sm p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <span className="font-medium whitespace-pre-line">{successMsg}</span>
                </div>
              )}
              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleRegisterUser} className="space-y-4 pb-8">

              {/* PERSONAL INFO */}
              <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-400">First Name</label>
                    <input required value={regData.firstName} onChange={e => setRegData({ ...regData, firstName: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="First Name" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-400">Family Name</label>
                    <input required value={regData.lastName} onChange={e => setRegData({ ...regData, lastName: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Family Name" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-indigo-400">Work Email</label>
                  <input required type="email" value={regData.email} onChange={e => setRegData({ ...regData, email: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="name@company.com" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-400">Mobile Number</label>
                    <input required value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+966 5..." />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-indigo-400">Job Role</label>
                    <input required value={regData.role} onChange={e => setRegData({ ...regData, role: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Manager" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-indigo-400">Location (Country)</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 w-4 h-4 text-indigo-300 pointer-events-none" />
                    <select aria-label="Select Country" required value={regData.country} onChange={e => setRegData({ ...regData, country: e.target.value })} className="w-full bg-white/10 border border-white/10 rounded-lg p-3 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
                      <option value="United Arab Emirates">United Arab Emirates</option>
                      <option value="Saudi Arabia">Saudi Arabia</option>
                      <option value="Qatar">Qatar</option>
                      <option value="Bahrain">Bahrain</option>
                      <option value="Kuwait">Kuwait</option>
                      <option value="Oman">Oman</option>
                      <option value="Egypt">Egypt</option>
                      <option value="Jordan">Jordan</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* PASSWORD SETTING */}
                <div className="pt-4 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400">Password</label>
                      <input
                        type="password"
                        required
                        value={regData.password}
                        onChange={e => setRegData({ ...regData, password: e.target.value })}
                        className="w-full bg-white/10 border border-white/10 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Create Password"
                        minLength={8}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase text-indigo-400">Confirm</label>
                      <input
                        type="password"
                        required
                        value={regData.confirmPassword}
                        onChange={e => setRegData({ ...regData, confirmPassword: e.target.value })}
                        className="w-full bg-white/10 border border-white/10 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Repeat Password"
                        minLength={8}
                      />
                    </div>
                  </div>
                  {/* Password Strength Meter */}
                  {regData.password.length > 0 && (() => {
                    const strength = getPasswordStrength(regData.password);
                    return (
                      <div className="mt-3">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map(i => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                i <= strength.score ? strength.color : 'bg-white/10'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] font-bold text-right" style={{ color: strength.score <= 1 ? '#ef4444' : strength.score <= 2 ? '#f59e0b' : strength.score <= 3 ? '#3b82f6' : '#10b981' }}>
                          {strength.label}
                        </p>
                      </div>
                    );
                  })()}
                </div>

              </div>

              <button type="submit" disabled={isLoading} className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                {isLoading ?
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> :
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                }
              </button>
            </form>

          </>)}
        </div>

        {/* RIGHT SIDE: RouteGenius Login */}
        <div className={`flex-1 p-8 md:p-12 flex flex-col justify-center ${isDarkMode ? 'bg-black/20' : 'bg-white/50'}`}>

          {/* Header */}
          <div className="mb-10 text-center md:text-left">
            <div className={`inline-flex md:hidden items-center justify-center w-12 h-12 rounded-xl mb-4 ${isDarkMode ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-blue-100 border border-blue-200'}`}>
              <Cpu className="w-6 h-6 text-blue-400" />
            </div>

            <p className="text-xs font-bold text-indigo-400 tracking-widest uppercase mb-2">Flagship Application</p>
            <h1 
              onDoubleClick={onSysAdminLogin}
              className={`text-3xl md:text-4xl font-black mb-2 tracking-tight flex items-center md:justify-start justify-center gap-3 cursor-default select-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
            >
              {t.brand} <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-bold self-start mt-1 pointer-events-none">AI</span>
            </h1>
          </div>

          {/* Form — switches between Login, Forgot Password */}
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-6 max-w-sm mx-auto md:mx-0 w-full animate-in fade-in duration-300">
              <div className="mb-2">
                <h2 className="text-xl font-black text-white mb-1">Reset Password</h2>
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
                    {forgotLoading
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Mail className="w-5 h-5" /> Send Reset Link</>
                    }
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
          ) : (
          <form onSubmit={handleLogin} className="space-y-6 max-w-sm mx-auto md:mx-0 w-full">

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
              <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300/70' : 'text-slate-500'}`}>Username or Email</label>
              <div className="relative">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-indigo-400 group-focus-within:text-white' : 'text-slate-400 group-focus-within:text-blue-600'}`}>
                  <UserIcon className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all ${isDarkMode ? 'bg-white/5 border border-white/10 text-white placeholder-white/20 hover:bg-white/10' : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 hover:bg-slate-50 shadow-sm'}`}
                  placeholder="Authorized ID or Email"
                  required
                  disabled={lockoutRemaining > 0}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2 group">
              <div className="flex items-center justify-between">
                <label className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300/70' : 'text-slate-500'}`}>{t.password}</label>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-indigo-400 group-focus-within:text-white' : 'text-slate-400 group-focus-within:text-blue-600'}`}>
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all ${isDarkMode ? 'bg-white/5 border border-white/10 text-white placeholder-white/20 hover:bg-white/10' : 'bg-white border border-slate-200 text-slate-900 placeholder-slate-400 hover:bg-slate-50 shadow-sm'}`}
                  placeholder="Secure Key"
                  required
                  disabled={lockoutRemaining > 0}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
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
                <>{t.signIn}<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>
          )}


          {/* New Registration Toggle */}
          <div className="mt-6 text-center">
            <p className={`text-sm flex items-center justify-center gap-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {isRegistering ? "Already have an account?" : "New to Reach AI?"}
              <button onClick={() => setIsRegistering(!isRegistering)} className={`px-4 py-1.5 rounded-full border text-xs uppercase tracking-wide font-bold transition-all active:scale-95 ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-blue-600/20 hover:border-blue-500/50 hover:text-blue-300 text-blue-400' : 'bg-slate-100 border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-blue-600'}`}>
                {isRegistering ? "Back to Login" : "Create Account"}
              </button>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
              <span>Secure Connection</span>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            </div>


          </div>
        </div>
      </div >
      <style>{`
  @keyframes slideRight {
  from {transform: translateX(-100%); }
  to {transform: translateX(100vw); }
        }
  @keyframes float {
  0%, 100% {transform: translateY(0); }
  50% {transform: translateY(-15px); }
        }
  @keyframes loading {
  0% {transform: translateX(-100%); }
  100% {transform: translateX(100%); }
        }
  @keyframes fade-in-up {
  from {opacity: 0; transform: translateY(20px); }
  to {opacity: 1; transform: translateY(0); }
        }
  @keyframes scan {
  0% {transform: translateY(-100%); }
  100% {transform: translateY(200%); }
        }
  @keyframes shine {
  0% {transform: translateX(-200%) skewX(-12deg); }
  20% {transform: translateX(200%) skewX(-12deg); }
  100% {transform: translateX(200%) skewX(-12deg); }
        }
  @keyframes rotate-y-12 {
  0% {transform: rotateY(0deg); }
  100% {transform: rotateY(12deg); }
        }
      `}</style>
    </div >
  );
};
export default Login;
