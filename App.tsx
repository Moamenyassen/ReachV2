
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Customer, ViewMode, User, UserRole, HistoryLog, Company, UserPreferences, HistoryStats } from './types';
import { ReachPricing, ClassicLayout, ModernOSLayout, PasswordChangeModal } from './components';
import { Loader2, X } from 'lucide-react';
import { TRANSLATIONS, DEFAULT_COMPANY_SETTINGS } from './config/constants';
import { ToastProvider, useToast } from './components/common/Toast';
import { ConfirmProvider, useConfirm } from './components/common/ConfirmDialog';

import {
  Login,
  SysAdminLogin,
  SysAdminDashboard,
  PartnerProgram
} from './components';
import TenantSetupModal from './components/TenantSetupModal';
import CompanySettingsModal from './components/CompanySettingsModal';
import PendingLicenseScreen from './components/PendingLicenseScreen';
import PartnerRegistrationModal from './components/features/Referral/PartnerRegistrationModal';
import DataUploadConfirmation from './components/features/Admin/DataUploadConfirmation';
import DataUploadProgress, { UploadStep, createUploadSteps } from './components/features/Admin/DataUploadProgress';


import {
  supabase,
  subscribeToUsers,
  subscribeToGlobalUsers,
  subscribeToRoutes,
  subscribeToHistory,
  saveUsers,
  saveRouteData,
  addHistoryLog,
  updateUserLastLogin,
  subscribeToSystemMetadata,
  restoreRouteVersion,
  subscribeToCompany,
  BranchProgressMap,
  fetchFilteredRoutes,
  deleteHistoryLog,
  detectAndAddBranches,
  updateCustomer,
  updateCompany,
  getSubscriptionPlans,
  addGlobalUser,
  activateSubscription,
  updateUserPreferences,
  updateSupabaseHeaders
} from './services/supabase';

// ETL Service for normalized table uploads
import {
  processNormalizedCSVUpload,
  CSVColumnMapping,
  autoDetectColumnMapping,
  transformRowsToCustomers,
  ETLProgress
} from './services/etlService';

import { signIn as supabaseSignIn, signOut as supabaseSignOut, onAuthStateChange } from './services/authService';

const App: React.FC = () => {
  const { error: errorToast, success: successToast, warning: warningToast } = useToast();
  const { confirm } = useConfirm();

  // Initialize View State (with persistence)
  const [view, setViewState] = useState<string>(() => {
    // Try to restore last view, else default to LOGIN
    return localStorage.getItem('rg_v2_last_view') || ViewMode.LOGIN;
  });

  const setView = (v: string) => {
    setViewState(v);
    localStorage.setItem('rg_v2_last_view', v);
  };

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('rg_v2_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [currentCompany, setCurrentCompany] = useState<Company | null>(() => {
    try {
      const savedCompany = localStorage.getItem('rg_v2_company');
      const parsed = savedCompany ? JSON.parse(savedCompany) : null;
      // Initialize Supabase Headers for RLS (Legacy Mode)
      if (parsed && parsed.id) {
        updateSupabaseHeaders({ 'x-company-id': parsed.id });
      }
      return parsed;
    } catch (e) {
      return null;
    }
  });



  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1280);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- THEME & UI STATE ---
  // Prioritize Company Settings > Local Storage > Default
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('rg_v2_theme');
      return savedTheme ? savedTheme === 'dark' : true;
    } catch { return true; }
  });

  const [uiMode, setUiMode] = useState<'classic' | 'modern'>(() => {
    return (localStorage.getItem('rg_v2_ui_mode') as 'classic' | 'modern') || 'modern';
  });

  const [isAiTheme, setIsAiTheme] = useState(() => {
    try {
      return localStorage.getItem('rg_v2_ai_theme') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const t = TRANSLATIONS[language];

  // SUBSCRIPTION GATING LOGIC
  const isSubscriptionLocked = useMemo(() => {
    if (!currentUser || !currentCompany) return false;
    // Lock if subscription tier is missing or explicitly set to NONE
    // (sysadmin is never locked)
    if (currentUser.username === 'sysadmin') return false;
    return !currentCompany.subscriptionTier || (currentCompany.subscriptionTier as string) === 'NONE';
  }, [currentUser, currentCompany]);


  const isLimbo = useMemo(() => {
    // A user is in Limbo if they are logged in but have no companyId, 
    // unless they are the global System Administrator.
    if (!currentUser) return false;
    if (currentUser.username === 'sysadmin') return false;
    return !currentUser.companyId;
  }, [currentUser]);


  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [uploadHistory, setUploadHistory] = useState<HistoryLog[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingRoutes, setIsFetchingRoutes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadOverallProgress, setUploadOverallProgress] = useState(0);
  const [uploadDetailedProgress, setUploadDetailedProgress] = useState<{ percent: number; stepName: string; currentCount?: number; totalCount?: number } | undefined>(undefined);
  const [uploadBranchStats, setUploadBranchStats] = useState<BranchProgressMap | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>(createUploadSteps());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const cancellationRef = useRef<{ aborted: boolean }>({ aborted: false });
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string>('');
  const [isFullDataLoaded, setIsFullDataLoaded] = useState(false);
  const [startupProgress, setStartupProgress] = useState(0);
  const [licenseRequestStatus, setLicenseRequestStatus] = useState<string | null>(null);
  // Shared Filter State
  const [isCompanySettingsOpen, setIsCompanySettingsOpen] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<{ region?: string, route?: string, week?: string, day?: string }>({});

  // --- LICENSE REQUEST CHECK ---
  useEffect(() => {
    if (isLimbo && currentUser?.id) {
      import('./services/supabase').then(({ getReachCustomerStatus }) => {
        getReachCustomerStatus(currentUser.id).then(status => {
          if (status) setLicenseRequestStatus(status);
        });
      });
    }
  }, [isLimbo, currentUser]);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('rg_v2_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('rg_v2_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentCompany) {
      localStorage.setItem('rg_v2_company', JSON.stringify(currentCompany));
    } else {
      localStorage.removeItem('rg_v2_company');
    }
  }, [currentCompany]);

  // EFFECT: Fetch Data ONLY if we have a valid Company ID and User
  useEffect(() => {
    if (!currentCompany || !currentUser?.companyId) {
      // If we are logged in as SysAdmin we don't need these subs, 
      // SysAdmin dashboard handles its own subs.
      if (view === ViewMode.SYSADMIN_DASHBOARD) {
        setIsDataLoaded(true);
        return;
      }
      // If completely logged out
      setIsDataLoaded(true);
      return;
    }

    const cid = currentCompany.id;

    // Subsribe to company-specific collections
    const unsubUsers = subscribeToUsers(cid, (u) => setUsers(u));

    // RESTORED GLOBAL ROUTE FETCH (Required for Insights stats)
    // setIsFetchingRoutes(true);
    // const unsubRoutes = subscribeToRoutes(cid, (c) => {
    //   setAllCustomers(c);
    //   setIsFullDataLoaded(true);
    //   setIsFetchingRoutes(false);
    //   setHasMore(false); // Disable pagination since we have everything
    // }, (pct) => setStartupProgress(pct));

    // NEW ON-DEMAND FETCH LOGIC
    // We do NOT fetch routes automatically on startup anymore.
    // Instead, we wait for the user to click "View" or use filter controls.
    setIsDataLoaded(true);

    const unsubMeta = subscribeToSystemMetadata(cid, (data) => {
      setLastUpdatedDate(data.lastUpdated);
      setActiveVersionId(data.activeVersionId);
    });
    // Subscribe to full company object for realtime limits
    const unsubCompany = subscribeToCompany(cid, (comp) => {
      if (comp) setCurrentCompany(comp);
    });

    const unsubHistory = subscribeToHistory(cid, (logs) => {
      const sorted = [...logs].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      setUploadHistory(sorted);
      setIsDataLoaded(true);
    });

    return () => { unsubUsers(); unsubHistory(); unsubMeta(); unsubCompany(); };
  }, [currentUser, view]); // Removed currentCompany to prevent re-subscribe loop since we update it inside

  // SYNC: When Company Settings Change, Update Local State
  useEffect(() => {
    if (currentCompany?.settings?.common?.theme) {
      const themeSettings = currentCompany.settings.common.theme;

      // Sync Dark Mode
      if (themeSettings.enableDarkMode !== undefined && themeSettings.enableDarkMode !== isDarkMode) {
        setIsDarkMode(themeSettings.enableDarkMode);
      }

      // Sync UI Mode
      if (themeSettings.uiMode && themeSettings.uiMode !== uiMode) {
        setUiMode(themeSettings.uiMode);
      }
    }
  }, [currentCompany]);

  // SYNC: When User Logs In, Apply Stored Preferences
  useEffect(() => {
    if (currentUser?.preferences) {
      const p = currentUser.preferences;
      if (p.isDarkMode !== undefined) setIsDarkMode(p.isDarkMode);
      if (p.language) setLanguage(p.language);
      if (p.uiMode) setUiMode(p.uiMode);
    }
  }, [currentUser]);

  // ACTIONS: Update Company And Local
  const handleToggleUiMode = async () => {
    const newMode: 'classic' | 'modern' = uiMode === 'classic' ? 'modern' : 'classic';
    setUiMode(newMode); // Optimistic
    localStorage.setItem('rg_v2_ui_mode', newMode); // Local Fallback

    if (currentUser?.username) {
      const updatedPrefs: UserPreferences = {
        ...(currentUser.preferences || {}),
        uiMode: newMode
      };
      updateUserPreferences(currentUser.username, updatedPrefs)
        .catch(err => console.error("Failed to sync User UI Mode preference:", err));

      setCurrentUser(prev => prev ? { ...prev, preferences: updatedPrefs } : null);
    }

    if (currentCompany && currentCompany.settings) {
      const updatedSettings = {
        ...currentCompany.settings,
        common: {
          ...currentCompany.settings.common,
          theme: {
            ...currentCompany.settings.common.theme,
            uiMode: newMode
          }
        }
      };
      // Fire and forget update
      updateCompany(currentCompany.id, { settings: updatedSettings as any }).catch(err => console.error("Failed to sync UI mode:", err));
    }
  };

  const handleToggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme); // Optimistic
    localStorage.setItem('rg_v2_theme', newTheme ? 'dark' : 'light'); // Immediate UI reflect

    // 1. Save to User Preferences (Persistent across devices)
    if (currentUser?.username) {
      const updatedPrefs = {
        ...(currentUser.preferences || {}),
        isDarkMode: newTheme
      };
      updateUserPreferences(currentUser.username, updatedPrefs)
        .catch(err => console.error("Failed to sync User preferences:", err));

      // Update local user state too
      setCurrentUser(prev => prev ? { ...prev, preferences: updatedPrefs } : null);
    }

    // 2. Save to Company Settings (Optional/Historical fallback)
    if (currentCompany && currentCompany.settings) {
      const updatedSettings = {
        ...currentCompany.settings,
        common: {
          ...currentCompany.settings.common,
          theme: {
            ...currentCompany.settings.common.theme,
            enableDarkMode: newTheme
          }
        }
      };
      updateCompany(currentCompany.id, { settings: updatedSettings }).catch(err => console.error("Failed to sync Dark Mode:", err));
    }
  };

  const handleToggleLang = async () => {
    const newLang: 'en' | 'ar' = language === 'en' ? 'ar' : 'en';
    setLanguage(newLang);

    if (currentUser?.username) {
      const updatedPrefs: UserPreferences = {
        ...(currentUser.preferences || {}),
        language: newLang
      };
      updateUserPreferences(currentUser.username, updatedPrefs)
        .catch(err => console.error("Failed to sync User language preference:", err));

      setCurrentUser(prev => prev ? { ...prev, preferences: updatedPrefs } : null);
    }
  };

  useEffect(() => {
    const html = document.documentElement;
    if (isDarkMode) {
      html.classList.add('dark');
      localStorage.setItem('rg_v2_theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('rg_v2_theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const html = document.documentElement;
    if (isAiTheme) {
      html.classList.add('ai-theme');
      if (!isDarkMode) setIsDarkMode(true);
      localStorage.setItem('rg_v2_ai_theme', 'true');
    } else {
      html.classList.remove('ai-theme');
      localStorage.setItem('rg_v2_ai_theme', 'false');
    }
  }, [isAiTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  useEffect(() => {
    // Save view if user is logged in OR if we are in SysAdmin mode
    if (currentUser || view === ViewMode.SYSADMIN_DASHBOARD) {
      try {
        localStorage.setItem('rg_v2_view', view);
      } catch (e) {
        console.warn("Failed to save view state", e);
      }
    }
  }, [view, currentUser]);

  /* --- WELCOME MODAL MOVED DOWN --- */

  const handleSubscribe = async (planId: string, billingCycle: 'monthly' | 'yearly', licenseCount: number = 1) => {
    console.log("App: handleSubscribe called", { planId, billingCycle, licenseCount, companyId: currentCompany?.id });

    if (!currentCompany) {
      alert("Error: No active company found. Please log in again.");
      return;
    }
    try {
      await activateSubscription(currentCompany.id, planId, billingCycle, licenseCount);

      // Manually find the plan name
      const plans = await getSubscriptionPlans();
      const plan = plans.find(p => p.id === planId);

      // Optimistic Update
      const updatedCompany: Company = {
        ...currentCompany,
        isActive: true,
        subscriptionTier: planId === 'growth' ? 'PROFESSIONAL' : (planId === 'elite' ? 'ENTERPRISE' : 'STARTER'),
        maxUsers: (Number(plan?.limits?.users || currentCompany.maxUsers)) * licenseCount,
        maxRoutes: (Number(plan?.limits?.routes || currentCompany.maxRoutes)) * licenseCount,
        maxScannerCap: (Number(plan?.limits?.market_scanner_cap || currentCompany.maxScannerCap)) * licenseCount
      };

      setCurrentCompany(updatedCompany);

      // Redirect to App Dashboard
      setView(ViewMode.LEGACY_INSIGHTS);

      // Show Welcome Modal
      setTimeout(() => setShowWelcome(true), 500); // Small delay for smooth transition

    } catch (e: any) {
      console.error("Subscription activation failed:", e);
      // Re-throw to allow ReachPricing to handle the failure state (e.g. logging promo as FAILED)
      throw e;
    }
  };

  // --- LOGIN LOGIC ---

  const handleAttemptLogin = async (companyNameIgnored: string, username: string, password: string) => {
    // 0. SysAdmin route — handled by dedicated SysAdminLogin screen (not here)
    // The sysadmin check is done inside SysAdminLogin via env var VITE_SYSADMIN_SECRET.
    // We intentionally do NOT allow sysadmin credentials through this flow.

    // 1. Try Supabase Auth first (secure method)
    try {
      const user = await supabaseSignIn(username, password);
      if (user) {
        if (!user.companyId) {
          handleLoginSuccess(user, null);
        } else {
          handleLoginSuccess(user, { id: user.companyId, name: user.companyId });
        }
        return;
      }
    } catch (authError: any) {
      // If Supabase Auth fails with specific message, don't fallback
      if (authError.message?.includes('Email not confirmed')) {
        throw authError;
      }
      // Otherwise, try legacy auth as fallback
      console.log('Supabase Auth failed, trying legacy auth...');
    }

    // 2. Fallback to legacy Global User List (for unmigrated users)
    // Note: plaintext compare is kept here only for legacy-migrated users who haven't
    // set up Supabase Auth yet. This path will be removed once migration is complete.
    return new Promise<User[] | void>((resolve, reject) => {
      const unsub = subscribeToGlobalUsers((fetchedUsers) => {
        unsub();

        // Hash-compare would be ideal, but legacy rows only have plaintext.
        // Log a warning so we can track & migrate remaining users.
        const matches = fetchedUsers.filter(u => u.username === username && u.password === password);
        if (matches.length > 0) {
          console.warn('[Security] Legacy plaintext auth used for user:', username, '— migrate this account to Supabase Auth.');
        }
        if (matches.length === 0) {
          reject(new Error("Invalid username or password."));
          return;
        }

        const activeMatches = matches.filter(u => u.isActive);
        if (activeMatches.length === 0) {
          reject(new Error("Account is deactivated. Contact admin."));
          return;
        }

        // If exactly one match, login immediately
        if (activeMatches.length === 1) {
          const foundUser = activeMatches[0];
          // ALLOW LIMBO USERS if no companyId
          if (!foundUser.companyId) {
            handleLoginSuccess(foundUser, null);
            resolve();
            return;
          }
          handleLoginSuccess(foundUser, { id: foundUser.companyId, name: foundUser.companyId });
          resolve();
          return;
        }

        // If multiple matches, return them for selection
        resolve(activeMatches);
      });
    });
  };

  const handleSelectUser = (user: User) => {
    handleLoginSuccess(user, user.companyId ? { id: user.companyId, name: user.companyId } : null);
  };

  const handleLoginSuccess = (user: User, company: { id: string, name: string } | null) => {
    // If Limbo, set company to null
    if (!company) {
      setCurrentUser(user);
      setCurrentCompany(null);
      localStorage.setItem('rg_v2_user', JSON.stringify(user));
      localStorage.removeItem('rg_v2_company');
      // Stay on current view (which will likely default to Dashboard, but Modal will intercept)
      // Or force a view that is safe
      setView(ViewMode.DASHBOARD);
      return;
    }

    // Initial partial company data
    const partialCompany = { id: company.id, name: company.name, subscriptionTier: 'STARTER', maxUsers: 5, isActive: true, createdAt: '', features: [] } as Company;

    const userWithCid = { ...user, companyId: company.id };
    setCurrentUser(userWithCid);
    setCurrentCompany(partialCompany);

    // Set RLS Headers (Legacy Support)
    updateSupabaseHeaders({ 'x-company-id': company.id });

    localStorage.setItem('rg_v2_user', JSON.stringify(userWithCid));
    localStorage.setItem('rg_v2_company', JSON.stringify(partialCompany));

    updateUserLastLogin(company.id, user.username);

    // Force Modern Mode & Desktop View (Grid)
    setUiMode('modern');
    localStorage.setItem('rg_v2_ui_mode', 'modern');

    // Restore Theme preference if exists
    if (user.preferences) {
      if (user.preferences.isDarkMode !== undefined) {
        setIsDarkMode(user.preferences.isDarkMode);
        localStorage.setItem('rg_v2_theme', user.preferences.isDarkMode ? 'dark' : 'light');
      }
      if (user.preferences.language) {
        setLanguage(user.preferences.language);
      }
      if (user.preferences.uiMode) {
        setUiMode(user.preferences.uiMode);
        localStorage.setItem('rg_v2_ui_mode', user.preferences.uiMode);
      }
    }

    setView(ViewMode.DASHBOARD);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentCompany(null);
    // Clear RLS Headers & Supabase Session
    updateSupabaseHeaders({});
    supabaseSignOut().catch(console.error);

    localStorage.removeItem('rg_v2_user');
    localStorage.removeItem('rg_v2_company');
    localStorage.removeItem('rg_v2_view');
    setView(ViewMode.LOGIN);
  };

  // --- DATA ACTIONS ---

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (!currentUser || !currentCompany) return;

    if (newPwd.length < 8) {
      setPwdError('New password must be at least 8 characters.');
      return;
    }

    try {
      // 1. Try Supabase Auth update (secure path for migrated users)
      // Supabase validates the session internally — no need to pass currentPwd
      const { updatePassword: updateSupabasePassword } = await import('./services/authService');
      await updateSupabasePassword(newPwd);
      setPwdSuccess(t.passwordUpdated || 'Password updated successfully!');

    } catch (authErr: any) {
      // 2. Fallback: legacy plaintext check for unmigrated users
      if (currentUser.password !== currentPwd) {
        setPwdError(t.passwordMismatch || 'Current password is incorrect.');
        return;
      }
      // Update in legacy store
      const updatedUser = { ...currentUser, password: newPwd };
      setCurrentUser(updatedUser);
      try { localStorage.setItem('rg_v2_user', JSON.stringify(updatedUser)); } catch (_) {}
      await saveUsers(currentCompany.id, users.map(u => u.username === currentUser.username ? updatedUser : u));
      setPwdSuccess(t.passwordUpdated || 'Password updated successfully!');
    }

    setTimeout(() => {
      setIsPwdModalOpen(false);
      setCurrentPwd('');
      setNewPwd('');
      setPwdSuccess('');
      setPwdError('');
    }, 1500);
  };



  // NEW: Pending Upload State
  const [pendingUpload, setPendingUpload] = useState<{
    data: Customer[],
    rawRows: any[], // Store raw rows for re-mapping
    fileName: string,
    stats: any,
    mapping?: CSVColumnMapping // Mapping object
  } | null>(null);

  const handleRouteDataLoaded = async (data: any[], fileName: string, stats: any, detectedMapping?: any, rawData?: any[]) => {
    if (!currentCompany) return;
    setIsUploading(false);
    setIsCancelling(false);
    cancellationRef.current = { aborted: false };

    try {
      // Use Raw Data for detection if available, otherwise fall back to data (legacy)
      const rowsToAnalyze = rawData && rawData.length > 0 ? rawData : data;
      const firstRow = rowsToAnalyze[0];

      const hasNormalizedFields = rowsToAnalyze.length > 0 && (
        'branch_code' in firstRow ||
        'branchCode' in firstRow ||
        'BRANCH_CODE' in firstRow ||
        // Check for raw CSV headers commonly found
        'REGION_CODE' in firstRow ||
        'Region Code' in firstRow ||
        firstRow.regionCode // legacy fallback
      );


      let usedMapping: any = null; // Store mapping to pass to validation screen

      // ETL Path - Enabled since user ran migration
      if (hasNormalizedFields) {
        console.log('[Upload] Detected normalized fields. Using dual-write strategy (ETL + Legacy)...');
        console.log('[Upload] 1. Starting ETL pipeline for normalized tables...');

        // 1. Detect mapping
        const headers = Object.keys(rowsToAnalyze[0]);
        const autoMapping = autoDetectColumnMapping(headers);

        console.log('[Upload] CSV Headers:', headers);
        console.log('[Upload] Auto-detected mapping:', autoMapping);

        const mapping: CSVColumnMapping = {
          branch_code: autoMapping.branch_code || 'region_code',
          branch_name: autoMapping.branch_name || 'region_description',
          region: autoMapping.region, // NEW: Region as separate field
          route_name: autoMapping.route_name || 'route_name',
          rep_code: autoMapping.rep_code || 'user_code',
          client_code: autoMapping.client_code || 'client_code',
          customer_name_en: autoMapping.customer_name_en || 'name',
          customer_name_ar: autoMapping.customer_name_ar,
          lat: autoMapping.lat || 'lat',
          lng: autoMapping.lng || 'lng',
          address: autoMapping.address || 'address',
          phone: autoMapping.phone || 'phone',
          classification: autoMapping.classification || 'classification',
          week_number: autoMapping.week_number ? String(autoMapping.week_number) : 'week',
          day_name: autoMapping.day_name || 'day_of_week',
          visit_order: autoMapping.visit_order,
          vat: autoMapping.vat,
          district: autoMapping.district,
          buyer_id: autoMapping.buyer_id,
          store_type: autoMapping.store_type,
        };

        console.log('[Upload] Final mapping:', mapping);

        // Used for display
        usedMapping = mapping;

        /*
        try {
          const etlResult = await processNormalizedCSVUpload(
            data,
            mapping,
            currentCompany.id,
            (progress: ETLProgress) => {
              // Map 4-step progress to single percentage (0-90%, save last 10% for legacy write)
              const stepWeight = 22.5;
              const overallPercent = ((progress.step - 1) * stepWeight) + (progress.percent * 0.225);
              setUploadOverallProgress(Math.round(overallPercent));
            }
          );

          if (!etlResult.success) {
            console.error('ETL failed but continuing to legacy:', etlResult.error);
          } else {
            console.log('[Upload] ETL complete:', etlResult.stats);
          }
        } catch (e) {
          console.error('ETL exception (non-blocking):', e);
        }
        */
        console.log('[Upload] ETL Disabled (Timout Prevention). Using Legacy mapping only.');

        // 3. Transform Data
        const mappedData = transformRowsToCustomers(rowsToAnalyze, mapping);

        // 4. Calculate stats (re-use the logic from DataUploadConfirmation if possible, 
        // or just pass raw data and let component handle stats)
        // For now, we just pass the mapped data.

        usedMapping = mapping;

        setPendingUpload({
          data: mappedData,
          rawRows: rowsToAnalyze, // Store raw rows for re-mapping
          fileName,
          stats: stats || {},
          mapping
        });

      } else {
        // Fallback for files that are ALREADY in legacy format
        console.log('[Upload] Using legacy saveRouteData (no mapping needed)');

        // Even for legacy, we can deduce some "mapping" to show
        usedMapping = {
          'Customer Name': 'name',
          'Client Code': 'clientCode'
        };
        const legacyData = data as unknown as Customer[];

        setPendingUpload({
          data: legacyData,
          rawRows: rowsToAnalyze, // Use raw rows if available
          fileName,
          stats: stats || {},
          mapping: usedMapping
        });
      }

    } catch (e: any) {
      alert("Error preparing data: " + e.message);
    }
  };


  const handleMappingUpdate = (key: string, value: string) => {
    if (!pendingUpload || !pendingUpload.mapping) return;

    // Update local mapping state
    const newMapping = { ...pendingUpload.mapping, [key]: value };

    console.log(`[Upload] Updating mapping: ${key} -> ${value}`);

    // Re-run transformation
    const newData = transformRowsToCustomers(pendingUpload.rawRows, newMapping);

    setPendingUpload({
      ...pendingUpload,
      mapping: newMapping,
      data: newData
    });
  };

  // Handle Auto-Detect for specific table
  const handleAutoDetect = (table: string) => {
    if (!pendingUpload?.rawRows || pendingUpload.rawRows.length === 0) {
      console.warn("No raw rows available for auto-detection");
      return;
    }

    const rawHeaders = Object.keys(pendingUpload.rawRows[0]);
    console.log(`Auto-detecting for table: ${table} with headers:`, rawHeaders);

    // Re-run detection
    const detectedMapping = autoDetectColumnMapping(rawHeaders); // Pass headers, not raw rows

    // Create new mapping based on current mapping but updating specific table keys
    const newMapping = { ...pendingUpload.mapping };

    // Define keys for each table
    let keysToUpdate: string[] = [];
    switch (table) {
      case 'branches':
        keysToUpdate = ['branch_code', 'branch_name', 'region'];
        break;
      case 'routes':
        keysToUpdate = ['route_name', 'rep_code'];
        break;
      case 'customers':
        keysToUpdate = [
          'client_code', 'customer_name_en', 'customer_name_ar',
          'lat', 'lng', 'address', 'phone', 'classification',
          'vat', 'district', 'buyer_id', 'store_type'
        ];
        break;
      case 'visits':
        keysToUpdate = ['week_number', 'day_name', 'visit_order'];
        break;
    }

    // Update only the keys for this table
    keysToUpdate.forEach(key => {
      if (detectedMapping[key as keyof CSVColumnMapping]) {
        newMapping[key as keyof CSVColumnMapping] = detectedMapping[key as keyof CSVColumnMapping];
      } else {
        // If auto-detection doesn't find a match, clear the mapping for this key
        newMapping[key as keyof CSVColumnMapping] = undefined;
      }
    });

    // Re-transform data with new mapping
    const transformedData = transformRowsToCustomers(pendingUpload.rawRows, newMapping);

    setPendingUpload(prev => prev ? ({
      ...prev,
      mapping: newMapping,
      data: transformedData
    }) : null);
  };

  const handleConfirmUpload = async () => {
    if (!pendingUpload || !currentCompany) return;
    const { data, fileName, stats } = pendingUpload;
    const newVersionId = Date.now().toString();

    // Reset state for new upload
    setIsUploading(true);
    setUploadOverallProgress(0);
    setUploadBranchStats(null);
    setUploadFileName(fileName);
    setUploadError(null);
    setUploadSteps(createUploadSteps()); // Reset steps
    cancellationRef.current = { aborted: false };

    // Helper to update a specific step
    const updateStep = (stepId: string, updates: Partial<UploadStep>) => {
      setUploadSteps(prev => prev.map(s =>
        s.id === stepId ? { ...s, ...updates } : s
      ));
    };

    try {
      console.log('[Upload] Confirmed. Starting Normalized ETL Process...');

      // ADAPTER MAPPING: Maps 'Customer' interface properties to ETL expectation
      // This is CRITICAL - the data is already transformed into Customer objects
      // with property names like 'branch', 'regionCode', etc.
      const adapterMapping: CSVColumnMapping = {
        branch_code: 'regionCode',           // Customer.regionCode = Branch CODE (e.g., "21")
        branch_name: 'branch',               // Customer.branch = Branch NAME (e.g., "Jeddah Consumer")
        route_name: 'routeName',             // Customer.routeName
        rep_code: 'userCode',                // Customer.userCode
        client_code: 'clientCode',           // Customer.clientCode
        reach_customer_code: 'reachCustomerCode',
        customer_name_en: 'name',            // Customer.name
        customer_name_ar: 'nameAr',          // Customer.nameAr
        lat: 'lat',                          // Customer.lat
        lng: 'lng',                          // Customer.lng
        address: 'address',                  // Customer.address
        phone: 'phone',                      // Customer.phone
        classification: 'classification',   // Customer.classification
        week_number: 'week',                 // Customer.week
        day_name: 'day',                     // Customer.day
        visit_order: 'visitOrder',           // Customer.visitOrder
        // Extended fields
        vat: 'vat',
        district: 'district',
        buyer_id: 'buyerId',
        store_type: 'storeType',
        region: 'regionDescription'          // Customer.regionDescription = REGION (e.g., "West Region")
      };

      // DEBUG: Check if data actually has the keys we expect
      if (data.length > 0) {
        console.log('[Upload] Checking first row for Adapter Mapping:', {
          firstRow: data[0],
          hasRegionCode: !!data[0]['regionCode'],
          hasBranch: !!data[0]['branch'],
          hasRouteName: !!data[0]['routeName'],
          expectedKeys: Object.values(adapterMapping)
        });
      }

      if (!currentCompany || !currentCompany.id) {
        throw new Error("Session Invalid: No active company found. Please log out and log in again.");
      }

      console.log('[Upload] Starting processing for Company ID:', currentCompany.id);

      // VALIDATION: Check if company exists in database before upload
      const { data: companyCheck, error: companyError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', currentCompany.id)
        .single();

      if (companyError || !companyCheck) {
        console.error('[Upload] Company validation failed:', {
          attemptedId: currentCompany.id,
          error: companyError,
          companyInState: currentCompany
        });
        throw new Error(`Your company (ID: ${currentCompany.id}) was not found in the database. Please log out and log back in.`);
      }

      console.log('[Upload] Company validated:', companyCheck);

      // *** USE ADAPTER MAPPING (not pendingUpload.mapping) ***
      const result = await processNormalizedCSVUpload(
        data,
        adapterMapping, // FIXED: Use adapter mapping for Customer objects
        currentCompany.id,
        (progress) => {
          // Map step number to step ID
          const stepMap: Record<number, string> = {
            0: 'raw_backup', // Fixed: Map step 0 to raw_backup
            1: 'branches',
            2: 'reps',
            3: 'routes',  // Note: Routes and Customers both use step 3 in ETL
            4: 'customers',
            5: 'visits'
          };

          // Determine which step based on stepName
          let currentStepId = stepMap[progress.step] || 'branches';
          if (progress.stepName?.toLowerCase().includes('customer')) {
            currentStepId = 'customers';
          } else if (progress.stepName?.toLowerCase().includes('route')) {
            currentStepId = 'routes';
          } else if (progress.stepName?.toLowerCase().includes('rep')) {
            currentStepId = 'reps';
          } else if (progress.stepName?.toLowerCase().includes('visit')) {
            currentStepId = 'visits';
          } else if (progress.stepName?.toLowerCase().includes('raw') || progress.step === 0) {
            currentStepId = 'raw_backup';
          }

          // Update step progress
          setUploadSteps(prev => prev.map(s => {
            if (s.id === currentStepId) {
              const newTotal = progress.totalCount !== undefined ? progress.totalCount : s.totalCount;
              const newCurrent = progress.currentCount !== undefined ? progress.currentCount : s.count;

              return {
                ...s,
                status: progress.percent >= 100 ? 'complete' : 'processing',
                percent: progress.percent,
                count: newCurrent,
                totalCount: newTotal,
                message: `${(newCurrent || 0).toLocaleString()} / ${(newTotal ? newTotal.toLocaleString() : '?')}`
              };
            }
            // Mark previous steps as complete if they're still processing
            const stepOrder = ['raw_backup', 'branches', 'reps', 'routes', 'customers', 'visits'];
            const currentIdx = stepOrder.indexOf(currentStepId);
            const thisIdx = stepOrder.indexOf(s.id);
            if (thisIdx < currentIdx && s.status === 'processing') {
              return { ...s, status: 'complete', percent: 100 };
            }
            return s;
          }));

          // Update overall progress
          const stepWeight = 20;
          let overallPercent = ((progress.step - 1) * stepWeight) + (progress.percent * 0.2);
          setUploadOverallProgress(Math.round(overallPercent));
          setUploadDetailedProgress({
            percent: Math.round(overallPercent),
            stepName: progress.stepName || 'Processing...',
            currentCount: progress.currentCount,
            totalCount: progress.totalCount
          });
        }
      );

      if (!result.success) {
        throw new Error(result.error || "ETL Process Failed");
      }

      console.log('[Upload] ETL Success:', result.stats);

      // Mark all steps complete with final counts
      setUploadSteps(prev => prev.map(s => ({
        ...s,
        status: 'complete' as const,
        count: s.id === 'branches' ? result.stats.branches.total
          : s.id === 'reps' ? result.stats.reps.total
            : s.id === 'routes' ? result.stats.routes.total
              : s.id === 'customers' ? result.stats.customers.total
                : result.stats.visits.total
      })));

      if (!cancellationRef.current.aborted) {
        // Sanitize ETL stats for log
        const sanitizedStats: HistoryStats = {
          normalized: true,
          branches: result.stats.branches,
          routes: result.stats.routes,
          customers: result.stats.customers,
          visits: result.stats.visits
        };

        try {
          const newLog: HistoryLog = {
            id: newVersionId,
            fileName: String(fileName),
            uploadDate: new Date().toISOString(),
            recordCount: Number(data.length),
            uploader: String(currentUser?.username || 'Admin'),
            type: 'ROUTE',
            stats: sanitizedStats
          };
          await addHistoryLog(currentCompany.id, newLog);
          // Manually update local state for immediate feedback
          setUploadHistory(prev => [newLog, ...prev]);
        } catch (logErr) {
          console.error("Critical: Failed to save history log", logErr);
          errorToast("Upload Saved, but History Failed", "The data was processed but the audit log couldn't be saved. Please report this to support.");
        }
      }
    } catch (e: any) {
      if (e.message !== "Upload Cancelled") {
        console.error("Upload Error:", e);
        setUploadError(e.message || 'Unknown error during upload');

        // Mark current step as error
        setUploadSteps(prev => prev.map(s =>
          s.status === 'processing' ? { ...s, status: 'error' as const } : s
        ));
      }
    } finally {
      if (!cancellationRef.current.aborted) {
        // Wait longer to show completion animation
        setTimeout(() => {
          setIsUploading(false);
          setPendingUpload(null);
        }, 3000);
      } else {
        setIsUploading(false);
      }
    }
  };

  const handleCancelUpload = () => {
    if (window.confirm("Are you sure you want to abort the upload process?")) {
      setIsCancelling(true);
      cancellationRef.current.aborted = true;
    }
  };



  const handleUsersUploaded = async (newUsers: User[], fileName: string) => {
    if (!currentCompany) return;
    try {
      const updatedUsers = [...users];
      newUsers.forEach(nu => {
        if (!updatedUsers.find(u => u.username === nu.username)) {
          updatedUsers.push({ ...nu, isActive: true, companyId: currentCompany.id });
        }
      });
      await saveUsers(currentCompany.id, updatedUsers);
      const newLog: HistoryLog = {
        id: Date.now().toString(), fileName, uploadDate: new Date().toISOString(),
        recordCount: newUsers.length, uploader: currentUser?.username || 'Unknown', type: 'USERS'
      };
      await addHistoryLog(currentCompany.id, newLog);
      // Manually update local state for immediate feedback
      setUploadHistory(prev => [newLog, ...prev]);
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const handleAddUser = async (u: User) => {
    if (!currentCompany) return;

    // Check Max Users Limit — count ACTIVE users only
    const activeUserCount = users.filter(u => u.isActive !== false).length;
    if (currentCompany.maxUsers && activeUserCount >= currentCompany.maxUsers) {
      alert(`License Limit Reached! Your plan allows for ${currentCompany.maxUsers} active users. Please contact SysAdmin to upgrade.`);
      return;
    }

    await saveUsers(currentCompany.id, [...users, { ...u, isActive: true, companyId: currentCompany.id }]);
  };
  const handleUpdateUser = async (u: User) => {
    if (!currentCompany) return;
    await saveUsers(currentCompany.id, users.map(ex => ex.username === u.username ? u : ex));
  };
  const handleToggleUserStatus = async (username: string) => {
    if (!currentCompany) return;
    await saveUsers(currentCompany.id, users.map(u => u.username === username ? { ...u, isActive: !u.isActive } : u));
  };

  const handleLoginAs = (u: User) => {
    const uWithCid = { ...u, companyId: currentCompany?.id };
    setCurrentUser(uWithCid);
    try { localStorage.setItem('rg_v2_user', JSON.stringify(uWithCid)); } catch (e) { }
    setView(ViewMode.LEGACY_INSIGHTS);
  };

  // Derived Data
  const activeLog = useMemo(() => {
    if (!uploadHistory || uploadHistory.length === 0) return undefined;
    return uploadHistory.find(h => h.id === activeVersionId) || uploadHistory[0];
  }, [uploadHistory, activeVersionId]);

  // Derived Filter Options from Metadata (History)
  const { availableRegions, availableRoutes } = useMemo(() => {
    // Use the latest history stats to populate dropdowns
    if (!activeLog || !activeLog.stats) return { availableRegions: [], availableRoutes: [] };

    const regions = activeLog.stats.regions || [];
    const routes = new Set<string>();
    activeLog.stats.regionBreakdown?.forEach(r => {
      // @ts-ignore - routes might be missing in some types
      r.routes?.forEach((rt: any) => routes.add(rt.name));
    });

    return { availableRegions: regions, availableRoutes: Array.from(routes).sort() };
  }, [activeLog]);

  const handleFetchData = useCallback(async (filters: { region?: string, route?: string, week?: string, day?: string }) => {

    if (!currentCompany || !activeVersionId) {
      console.warn("Missing company or version", { currentCompany, activeVersionId });
      return;
    }
    setIsFetchingRoutes(true);
    setCurrentFilters(filters); // Save filters for Detail View
    setCurrentPage(0);
    setHasMore(true);
    try {
      // Initial fetch: page 0
      const data = await fetchFilteredRoutes(currentCompany.id, activeVersionId, filters, 0, 50, { branchIds: currentUser?.branchIds, routeIds: currentUser?.routeIds });
      setAllCustomers(data);
      if (data.length < 50) setHasMore(false);
    } catch (e) {
      console.error("Fetch failed", e);
    } finally {
      setIsFetchingRoutes(false);
    }
  }, [currentCompany, activeVersionId, currentUser]);

  const isLoadingMoreRef = useRef(false);

  const handleLoadMore = useCallback(async (filters: { region?: string, route?: string, week?: string, day?: string }) => {
    if (!currentCompany || !activeVersionId || !hasMore) return;
    // Prevent concurrent fetches
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;

    try {
      const nextPage = currentPage + 1;
      const data = await fetchFilteredRoutes(currentCompany.id, activeVersionId, filters, nextPage, 50, { branchIds: currentUser?.branchIds, routeIds: currentUser?.routeIds });

      if (data.length > 0) {
        setAllCustomers(prev => [...prev, ...data]);
        setCurrentPage(nextPage);
      }

      if (data.length < 50) {
        setHasMore(false);
      }
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [currentCompany, activeVersionId, hasMore, currentPage, currentUser]);


  const handleUpgradePlan = useCallback(() => {
    setView(ViewMode.REACH_PRICING);
  }, []);

  /* --- WELCOME MODAL DECLARED HERE TO AVOID TDZ --- */
  const [showWelcome, setShowWelcome] = useState(false);

  const WelcomeModal = () => (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0f172a] border border-cyan-500/30 rounded-3xl p-10 max-w-lg w-full text-center relative shadow-2xl shadow-cyan-500/20">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-lg transform scale-125">
          <span className="text-4xl">🚀</span>
        </div>
        <h2 className="text-3xl font-black text-white mt-8 mb-4">Welcome Aboard!</h2>
        <p className="text-lg text-slate-300 mb-8">Your subscription is active. You now have full access to <span className="text-cyan-400 font-bold">{currentCompany?.name}</span>'s powerful logistics tools.</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              setShowWelcome(false);
              // Force a light refresh of data if needed, or just close
              if (handleFetchData) handleFetchData({});
            }}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/40 transition-all active:scale-95"
          >
            Let's Get Started
          </button>
        </div>
      </div>
    </div>
  );

  const handleRestoreVersion = async (versionId: string, dateStr: string) => {
    if (!currentCompany) return;
    try {
      if (window.confirm("Are you sure you want to restore this version? This will replace the current active data.")) {
        await restoreRouteVersion(currentCompany.id, versionId, dateStr);
        window.location.reload();
      }
    } catch (e: any) {
      alert("Failed to restore: " + e.message);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!currentCompany) return;
    try {
      await deleteHistoryLog(currentCompany.id, versionId);
      setUploadHistory(prev => prev.filter(h => h.id !== versionId));
      alert("Version deleted.");
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    }
  };

  const accessibleCustomers = useMemo(() => {
    if (!allCustomers || !currentUser) return [];

    let baseList = allCustomers;

    // 1. Role-based filtering
    const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER;

    if (!isAdmin) {
      if (currentUser.branchIds && currentUser.branchIds.length > 0) {
        const branchIdsSafe = currentUser.branchIds.map(bid => bid.trim().toLowerCase());
        baseList = allCustomers.filter(c => {
          const branchName = (c.branch || '').trim().toLowerCase();
          const regionCode = (c.regionCode || '').trim().toLowerCase();
          const regionDesc = (c.regionDescription || '').trim().toLowerCase();

          return branchIdsSafe.includes(branchName) ||
            branchIdsSafe.includes(regionCode) ||
            branchIdsSafe.includes(regionDesc);
        });
      } else {
        // If not admin and no branches assigned, show nothing
        return [];
      }
    }

    // 2. Uniqueness — use best available key (priority: reachCustomerCode > clientCode > name+lat hash)
    const seen = new Set<string>();
    const uniqueList: Customer[] = [];

    for (const c of baseList) {
      const key = c.reachCustomerCode || c.clientCode || `${c.name}|${c.lat?.toFixed(4)}|${c.lng?.toFixed(4)}` || c.id;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push({
          ...c,
          addedBy: c.addedBy || activeLog?.uploader || 'System'
        });
      }
    }

    return uniqueList;
  }, [allCustomers, currentUser, activeLog]);


  const controlProps = {
    isDarkMode, language, isAiTheme,
    onToggleTheme: handleToggleTheme,
    onToggleLang: handleToggleLang,
    onOpenCompanySettings: () => setIsCompanySettingsOpen(true)
  };

  // --- RENDERING ---

  if (view === ViewMode.SYSADMIN_LOGIN) {
    return <SysAdminLogin onLoginSuccess={() => setView(ViewMode.SYSADMIN_DASHBOARD)} onBack={() => setView(ViewMode.LOGIN)} isDarkMode={isDarkMode} />;
  }

  if (view === ViewMode.SYSADMIN_DASHBOARD) {
    return <SysAdminDashboard onLogout={() => setView(ViewMode.LOGIN)} />;
  }

  if (!isDataLoaded && view !== ViewMode.LOGIN) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0f172a] text-center animate-in fade-in duration-500 z-[9999]">
        <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-t-[3px] border-cyan-500 rounded-full animate-[spin_1s_linear_infinite]"></div>
            <div className="absolute inset-2 border-r-[3px] border-blue-500 rounded-full animate-[spin_1.5s_linear_infinite]"></div>
            <div className="absolute inset-4 border-b-[3px] border-indigo-500 rounded-full animate-[spin_2s_linear_infinite]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">R</span>
            </div>
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-[0.2em]">Reach AI</h2>
        <div className="mt-6 flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className="fixed bottom-10 left-1/2 -translate-x-1/2 text-slate-400 dark:text-slate-500 font-mono text-[10px] uppercase tracking-widest animate-pulse">
            Initializing Workspace...
        </p>
      </div>
    );
  }

  if (view === ViewMode.LOGIN || !currentUser) {
    return <Login
      onAttemptLogin={handleAttemptLogin}
      onSysAdminLogin={() => setView(ViewMode.SYSADMIN_LOGIN)}
      onSelectUser={handleSelectUser}
      {...controlProps}
    />;
  }

  // Force Pricing Screen if Locked (No Plan)
  if (isSubscriptionLocked) {
    return (
      <ReachPricing
        hideHeader={false}
        userCountry={currentCompany?.settings?.common?.general?.country || 'SA'} // Pass country
        onBack={() => {
          // Logout if they try to go back
          handleLogout();
        }}
        onSubscribe={handleSubscribe}
      />
    );
  }

  const layoutProps = {
    view, setView, currentUser, currentCompany,
    allCustomers: accessibleCustomers, users, uploadHistory, activeVersionId,
    // Data Loading Props
    onFetchData: !isFullDataLoaded ? handleFetchData : () => { },
    onLoadMore: !isFullDataLoaded ? handleLoadMore : () => { },
    hasMore: !isFullDataLoaded && hasMore,
    isFetchingRoutes, isFullDataLoaded,
    availableRegions, availableRoutes,
    currentFilters, // Pass to AppContent
    // Upload Props
    isUploading, uploadOverallProgress, uploadBranchStats, isCancelling, onCancelUpload: handleCancelUpload,
    // Admin Props
    onRouteUploaded: handleRouteDataLoaded,
    onUsersUploaded: handleUsersUploaded,
    onAddUser: handleAddUser,
    onUpdateUser: handleUpdateUser,
    onUpdateCustomer: async (customer: Customer) => {
      if (!currentCompany) return;
      try {
        await updateCustomer(currentCompany.id, customer);
        // Optimistic update
        setAllCustomers(prev => prev.map(c => c.rowId === customer.rowId ? customer : c));
      } catch (e: any) {
        console.error("Failed to update customer:", e);
        alert("Failed to update: " + e.message);
      }
    },
    onToggleUserStatus: handleToggleUserStatus,
    onLoginAs: handleLoginAs,
    onRestoreVersion: handleRestoreVersion,
    onDeleteVersion: handleDeleteVersion,
    // Auth
    onLogout: handleLogout,
    onSubscribe: handleSubscribe,
    onUpgradePlan: handleUpgradePlan,
    // Password Modal
    isPwdModalOpen, setIsPwdModalOpen, pwdError, pwdSuccess, currentPwd, setCurrentPwd, newPwd, setNewPwd, onPasswordSubmit: handlePasswordSubmit, t,
    // Controls
    controlProps,
    isAiTheme,
    onToggleAiTheme: () => setIsAiTheme(!isAiTheme),
    // Sidebar State (Classic Only mostly, but passed to both just in case)
    isSidebarCollapsed, setIsSidebarCollapsed,
    isMobileMenuOpen, setIsMobileMenuOpen,
    lastUpdatedDate,
    // Dual Mode
    onToggleUiMode: handleToggleUiMode,
    hideHeader: uiMode === 'modern',
    licenseRequestStatus,
    onOpenCompanySettings: () => setIsCompanySettingsOpen(true),
  };


  return (
    <>
      {uiMode === 'modern' ? (
        <ModernOSLayout {...layoutProps} view={view as ViewMode} />
      ) : (
        <ClassicLayout {...layoutProps} view={view as ViewMode} />
      )}

      <PasswordChangeModal
        isOpen={isPwdModalOpen}
        onClose={() => setIsPwdModalOpen(false)}
        pwdError={pwdError}
        pwdSuccess={pwdSuccess}
        currentPwd={currentPwd}
        setCurrentPwd={setCurrentPwd}
        newPwd={newPwd}
        setNewPwd={setNewPwd}
        onSubmit={handlePasswordSubmit}
        t={t}
      />

      {/* Company Settings Modal - High Z-Index Wrapper */}
      {isCompanySettingsOpen && (
        <React.Fragment>
          <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
            <div className="pointer-events-auto w-full h-full">
              {currentCompany && (
                <CompanySettingsModal
                  company={currentCompany}
                  onClose={() => setIsCompanySettingsOpen(false)}
                />
              )}
            </div>
          </div>
        </React.Fragment>
      )}

      {/* MULTI-STEP ONBOARDING MIGRATION */}
      {isLimbo && view !== ViewMode.REFERRAL_HUB && view !== ViewMode.PRICING && (
        licenseRequestStatus === 'LICENSE_REQUEST' ? (
          <PendingLicenseScreen
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        ) : (
          <TenantSetupModal
            currentUser={currentUser!}
            onComplete={(newCompanyId) => {
              // Now that we have global state, we don't necessarily have to reload, but reloading ensures full App reset
              // Wait, instead of reload, we can just let App refetch.
              successToast("Setup Complete", `Welcome to your new workspace!`);
              setTimeout(() => window.location.reload(), 1500);
            }}
            onNavigateToPartner={() => setView(ViewMode.REFERRAL_HUB)}
            onLogout={handleLogout}
            onClose={handleLogout}
          />
        )
      )}

      {/* Referral Hub / Partner Register Overlay */}
      <AnimatePresence>
        {view === ViewMode.REFERRAL_HUB && currentUser && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="relative w-full max-w-4xl">
              <button
                onClick={() => setView(ViewMode.DASHBOARD)}
                className="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors flex items-center gap-2"
                aria-label="Close Partner Hub"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Close</span>
                <div className="bg-white/10 p-2 rounded-full"><X className="w-4 h-4" /></div>
              </button>

              {!currentUser.isRegisteredCustomer ? (
                <PartnerRegistrationModal
                  currentUser={currentUser}
                  isOpen={true}
                  onClose={() => setView(ViewMode.DASHBOARD)}
                  onSuccess={(updatedUser) => {
                    setCurrentUser(updatedUser);
                    try { localStorage.setItem('rg_v2_user', JSON.stringify(updatedUser)); } catch (e) { }
                  }}
                />
              ) : (
                <PartnerProgram
                  userId={currentUser.id}
                  userCode={currentUser.username ? currentUser.username.substring(0, 6).toUpperCase() : 'USER'}
                  onClose={() => setView(ViewMode.DASHBOARD)}
                />
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- WELCOME MODAL FOR NEW SUBSCRIBERS --- */}
      {showWelcome && <WelcomeModal />}
      <AnimatePresence>
        {pendingUpload && !isUploading && (
          <DataUploadConfirmation
            key={`confirm-${pendingUpload.fileName}`}
            data={pendingUpload.data}
            fileName={pendingUpload.fileName}
            mapping={pendingUpload.mapping as any}
            onConfirm={handleConfirmUpload}
            onCancel={() => setPendingUpload(null)}
            progress={uploadDetailedProgress}
            isUploading={isUploading}
            onUpdateMapping={handleMappingUpdate}
            onAutoDetect={handleAutoDetect}
            availableHeaders={pendingUpload.rawRows && pendingUpload.rawRows.length > 0 ? Object.keys(pendingUpload.rawRows[0]) : []}
            firstRawRow={pendingUpload.rawRows?.[0]}
          />
        )}
      </AnimatePresence>

      {/* Full-screen Upload Progress */}
      <AnimatePresence>
        {isUploading && (
          <DataUploadProgress
            steps={uploadSteps}
            currentStep={uploadSteps.findIndex(s => s.status === 'processing')}
            fileName={uploadFileName}
            isComplete={uploadSteps.every(s => s.status === 'complete')}
            error={uploadError || undefined}
            onComplete={() => {
              setIsUploading(false);
              setPendingUpload(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

const AppWithProviders: React.FC = () => (
  <ToastProvider>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </ToastProvider>
);

export default AppWithProviders;

