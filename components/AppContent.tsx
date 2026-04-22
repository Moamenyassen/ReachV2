import React from 'react';
import { ViewMode, User, Company, Customer, HistoryLog, CompanySettings, UserRole } from '../types';
import {
    Loader2, Users, MapPinOff, CheckCircle2, Zap, X, ShieldCheck, KeyRound, AlertTriangle, Sparkles, LogOut
} from 'lucide-react';
import {
    Insights,
    RouteSequence,
    DetailedReports,
    AIOptimizer,
    MarketScanner,
    Pricing,
    ReachPricing,
    AdminDashboard,
    Customers,
    UserManagement,
    PartnerProgram,
    ScannerV2,
    AnalyzeDataModule
} from './index';
import LicenseSummary from './admin/LicenseSummary';
import { DEFAULT_COMPANY_SETTINGS } from '../config/constants';
import { addCustomerFromScanner } from '../services/supabase';

export interface AppContentProps {
    view: ViewMode;
    setView: (view: ViewMode) => void;
    currentUser: User;
    currentCompany: Company | null;
    allCustomers: Customer[];
    users: User[];
    uploadHistory: HistoryLog[];
    activeVersionId: string;
    isUploading: boolean;
    uploadOverallProgress: number;
    uploadBranchStats: any;
    isCancelling: boolean;
    onCancelUpload: () => void;

    // Data Handlers
    onFetchData: (filters: any) => void;
    onLoadMore: (filters: any) => void;
    hasMore: boolean;
    isFetchingRoutes: boolean;
    isFullDataLoaded: boolean;
    currentFilters?: { region?: string, route?: string, week?: string, day?: string };


    // Admin Handlers
    onRouteUploaded: (data: Customer[], fileName: string, stats: any) => void;
    onUsersUploaded: (users: User[], fileName: string) => void;
    onAddUser: (u: User) => void;
    onUpdateUser: (u: User) => void;
    onUpdateCustomer: (c: Customer) => void;
    onToggleUserStatus: (username: string) => void;
    onLoginAs: (u: User) => void;
    onRestoreVersion: (id: string, date: string) => void;
    onDeleteVersion: (id: string) => void;

    // Auth / Misc
    onLogout: () => void;
    onSubscribe: (planId: string, billingCycle: 'monthly' | 'yearly') => void;
    onUpgradePlan?: () => void;

    // Password Modal
    isPwdModalOpen: boolean;
    setIsPwdModalOpen: (open: boolean) => void;
    pwdError: string;
    pwdSuccess: string;
    currentPwd: string;
    setCurrentPwd: (pwd: string) => void;
    newPwd: string;
    setNewPwd: (pwd: string) => void;
    onPasswordSubmit: (e: React.FormEvent) => void;
    t: any; // Translations

    // Control Props
    controlProps: {
        isDarkMode: boolean;
        language: 'en' | 'ar';
        isAiTheme: boolean;
        onToggleTheme: () => void;
        onToggleLang: () => void;
        onOpenCompanySettings?: () => void;
    };

    // Derived Data
    availableRegions: string[];
    availableRoutes: string[];
    hideHeader?: boolean;
    licenseRequestStatus?: string | null;
}

const AppContent: React.FC<AppContentProps> = (props) => {

    const {
        view, setView, currentUser, currentCompany, allCustomers, users, uploadHistory,
        activeVersionId, isUploading, uploadOverallProgress, uploadBranchStats, isCancelling, onCancelUpload,
        onFetchData, onLoadMore, hasMore, isFetchingRoutes, isFullDataLoaded,
        onRouteUploaded, onUsersUploaded, onAddUser, onUpdateUser, onToggleUserStatus, onLoginAs,
        onRestoreVersion, onDeleteVersion, onLogout, onSubscribe,
        isPwdModalOpen, setIsPwdModalOpen, pwdError, pwdSuccess, currentPwd, setCurrentPwd, newPwd, setNewPwd, onPasswordSubmit, t,
        controlProps, availableRegions, availableRoutes, licenseRequestStatus
    } = props;

    // Plan Badge Component
    const PlanBadge = () => {
        if (!currentCompany?.subscriptionTier) return null;

        let color = 'bg-slate-500';
        let name = 'Free';
        let icon = Zap;

        const tier = String(currentCompany.subscriptionTier).toUpperCase();

        if (tier === 'PROFESSIONAL' || tier === 'GROWTH') {
            color = 'bg-gradient-to-r from-amber-500 to-orange-600';
            name = 'Growth';
            icon = Zap;
        } else if (tier === 'ENTERPRISE' || tier === 'ELITE') {
            color = 'bg-gradient-to-r from-indigo-500 to-purple-600';
            name = 'Elite';
            icon = ShieldCheck;
        } else {
            color = 'bg-slate-600';
            name = 'Starter';
        }

        const Icon = icon;

        return (
            <div className={`fixed top-20 right-4 md:top-4 md:right-24 z-[90] flex items-center gap-2 pointer-events-none md:pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-700 ${props.hideHeader ? 'mr-12' : ''}`}>
                <div className={`px-3 md:px-4 py-1 sm:py-1.5 rounded-full ${color} text-white font-black uppercase shadow-lg shadow-black/20 flex items-center gap-2 border border-white/10 backdrop-blur-md`}>
                    <Icon className="w-3 h-3 md:w-3.5 md:h-3.5 fill-current" />
                    <span className="text-[10px] md:text-xs tracking-widest">{name}</span>

                </div>
            </div>
        );
    };

    // Deterministic ticket number for the License Request screen based on user properties
    const ticketNumber = React.useMemo(() => {
        const str = currentUser ? `${currentUser.username}-${currentUser.email}` : 'guest';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 9000 + 1000;
    }, [currentUser]);


    const isLimbo = React.useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.username === 'sysadmin') return false;
        // Optimization: If status is LICENSE_REQUEST, treat as NOT LIMBO for view rendering purposes so usage flows to LegacyInsights
        // But we must ensure view is set correctly.
        if (licenseRequestStatus === 'LICENSE_REQUEST') return false;
        return !currentUser.companyId;
    }, [currentUser, licenseRequestStatus]);


    // Use the prop directly since App.tsx already filters and de-duplicates
    const accessibleCustomers = React.useMemo(() => {
        return allCustomers || [];
    }, [allCustomers]);

    return (
        <>
            {/* -- UPLOAD OVERLAY -- */}
            {isUploading && (
                <div className="fixed inset-0 z-[9999] bg-main/95 backdrop-blur-xl flex flex-col font-mono animate-in fade-in duration-500">
                    <div className="flex-none p-6 border-b border-main bg-panel backdrop-blur-md z-30 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-8">
                            <div className="relative w-32 h-32 flex-none">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeOpacity="0.1" strokeWidth="6" fill="transparent" />
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-brand-primary transition-all duration-300 ease-out" strokeDasharray={365} strokeDashoffset={365 - (365 * uploadOverallProgress) / 100} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-main">
                                    <span className="text-3xl font-black">{uploadOverallProgress}%</span>
                                    <span className="text-[10px] text-brand-primary font-bold uppercase mt-1">UPLOADING</span>
                                </div>
                            </div>
                            <div><h2 className="text-2xl font-bold text-main uppercase tracking-widest flex items-center gap-3"><Zap className="w-6 h-6 text-brand-primary animate-pulse" />DATA INGESTION</h2></div>
                        </div>
                        {uploadOverallProgress < 100 && (
                            <button onClick={onCancelUpload} disabled={isCancelling} className={`group flex items-center gap-2 px-6 py-3 rounded-lg border transition-all uppercase tracking-widest text-xs font-bold ${isCancelling ? 'bg-red-500/10 border-red-500/50 text-red-400 cursor-wait' : 'bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10'}`}><Loader2 className="w-4 h-4 animate-spin" /> {isCancelling ? 'ABORTING...' : 'ABORT UPLOAD'}</button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
                        {uploadBranchStats && (
                            <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] max-w-[1920px] mx-auto">
                                {Object.entries(uploadBranchStats).map(([branch, stats]: [string, any]) => {
                                    const percent = stats.total > 0 ? Math.round((stats.uploaded / stats.total) * 100) : 0;
                                    const isDone = stats.done;
                                    return (
                                        <div key={branch} className={`relative overflow-hidden rounded-lg p-4 border transition-all duration-300 ${isDone ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-white/5 border-main text-main'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className={`font-bold text-xs uppercase tracking-wider truncate ${isDone ? 'text-emerald-500' : 'text-main'}`}>{branch}</h4>
                                                {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="text-[10px] text-brand-primary font-mono">{percent}%</div>}
                                            </div>
                                            <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3 relative"><div className={`h-full transition-all duration-300 ease-linear ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`} style={{ width: `${percent}%` }}></div></div>
                                            <div className="flex justify-between items-end text-[10px] font-mono text-muted">
                                                <div className="flex flex-col"><span className="uppercase text-[8px] tracking-wider opacity-60">Clients</span><span className={isDone ? 'text-emerald-500' : 'text-main'}>{stats.uploaded} / {stats.total}</span></div>
                                                <div className="flex gap-3">{stats.distinct > 0 && <div className="flex items-center gap-1"><Users className="w-3 h-3 text-blue-400" /> {stats.distinct}</div>}{stats.noGps > 0 && <div className="text-red-400 font-bold flex items-center gap-1"><MapPinOff className="w-3 h-3" /> {stats.noGps}</div>}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* -- WAITING SCREEN (LICENSE REQUEST) -- */}
            {licenseRequestStatus === 'LICENSE_REQUEST' && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500 bg-main">
                    <div className="w-24 h-24 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6 ring-1 ring-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                        <CheckCircle2 className="w-12 h-12 text-cyan-400" />
                    </div>
                    <h2 className="text-4xl font-black text-main mb-2 uppercase tracking-tighter">Request Received</h2>
                    <p className="text-brand-primary font-bold tracking-widest text-xs uppercase mb-6">Create Ticket #{ticketNumber}</p>

                    <div className="max-w-md border border-main rounded-2xl p-6 glass-panel mb-8">
                        <p className="text-muted leading-relaxed text-sm">
                            Thank you for your interest in our <span className="text-main font-bold">Enterprise Solutions</span>.
                            Our team has received your request and is currently reviewing your organization's requirements.
                        </p>
                        <div className="my-4 h-px border-b border-main opacity-20 w-full" />
                        <div className="flex items-center gap-3 text-left">
                            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted font-bold uppercase">Next Steps</p>
                                <p className="text-xs text-main">An account manager will contact you within 24 hours to finalize your setup.</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onLogout}
                        className="px-8 py-3 rounded-xl border border-main text-muted hover:text-main hover:bg-white/5 transition-all text-sm font-bold uppercase tracking-wider flex items-center gap-2"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            )}

            {/* -- CONTENT VIEWS -- */}
            {isLimbo && view !== ViewMode.PRICING && view !== ViewMode.REACH_PRICING && view !== ViewMode.REFERRAL_HUB && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500 bg-main">
                    <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 flex items-center justify-center mb-6 ring-1 ring-cyan-500/20">
                        <Sparkles className="w-10 h-10 text-cyan-400 animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-black text-main mb-4 uppercase tracking-tighter">Account Setup Required</h2>
                    <p className="text-muted max-w-md mb-8 leading-relaxed">
                        To access the full suite of Reach tools, please complete your company profile and subscription setup.
                    </p>
                    <button
                        onClick={() => setView(ViewMode.DASHBOARD)} // Dashboard re-opens the Setup Modal in App.tsx
                        className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl text-white font-black uppercase tracking-widest hover:shadow-lg hover:shadow-cyan-500/20 transition-all active:scale-95"
                    >
                        Return to Setup
                    </button>
                </div>
            )}

            {!isLimbo && view === ViewMode.LEGACY_INSIGHTS && <Insights currentUser={currentUser} currentCompany={currentCompany} allCustomers={allCustomers} userList={users} uploadHistory={uploadHistory} onNavigate={setView} onLogout={onLogout} hideHeader={props.hideHeader} {...controlProps} />}
            {!isLimbo && view === ViewMode.DASHBOARD && <RouteSequence onBack={() => setView(ViewMode.LEGACY_INSIGHTS)} settings={currentCompany?.settings || DEFAULT_COMPANY_SETTINGS} companyId={currentCompany?.id} activeVersionId={activeVersionId} userRole={currentUser?.role} userBranchIds={currentUser?.branchIds} lastUploadDate={uploadHistory?.[0]?.uploadDate} {...controlProps} hideHeader={props.hideHeader} />}
            {!isLimbo && view === ViewMode.FULL_SUMMARY && <DetailedReports currentUser={currentUser} allCustomers={accessibleCustomers} uploadHistory={uploadHistory} onBack={() => setView(ViewMode.LEGACY_INSIGHTS)} {...controlProps} hideHeader={props.hideHeader} currentFilters={props.currentFilters} />}
            {!isLimbo && view === ViewMode.AI_SUGGESTIONS && <AIOptimizer customers={accessibleCustomers} onBack={() => setView(ViewMode.LEGACY_INSIGHTS)} {...controlProps} hideHeader={props.hideHeader} companyId={currentCompany?.id} userBranchIds={currentUser?.branchIds} userRole={currentUser?.role} />}
            {!isLimbo && view === ViewMode.MARKET_SCANNER && <MarketScanner existingCustomers={accessibleCustomers} onBack={() => setView(ViewMode.LEGACY_INSIGHTS)} settings={currentCompany?.settings || DEFAULT_COMPANY_SETTINGS} maxScannerCap={currentCompany?.maxScannerCap} {...controlProps} hideHeader={props.hideHeader} />}
            {!isLimbo && (currentUser.role === UserRole.ADMIN) && view === ViewMode.PRICING && <Pricing onBack={() => setView(ViewMode.LEGACY_INSIGHTS)} hideHeader={props.hideHeader} isAiTheme={controlProps.isAiTheme} onSubscribe={(plan) => onSubscribe(plan, 'monthly')} />}
            {!isLimbo && (currentUser.role === UserRole.ADMIN) && view === ViewMode.REACH_PRICING && (
                <ReachPricing
                    onBack={() => setView(ViewMode.PRICING)}
                    isAiTheme={controlProps.isAiTheme}
                    isDarkMode={controlProps.isDarkMode}
                    onSubscribe={onSubscribe}
                    hideHeader={props.hideHeader}
                    companyName={currentCompany?.name}
                    currentTier={currentCompany?.subscriptionTier}
                />
            )}
            {!isLimbo && view === ViewMode.CUSTOMERS && <Customers
                companyId={currentCompany?.id}
                onNavigate={setView}
                hideHeader={props.hideHeader}
                onUpdateCustomer={props.onUpdateCustomer}
                companySettings={currentCompany?.settings || DEFAULT_COMPANY_SETTINGS}
                userRole={currentUser?.role} // Pass user role for access control
                userBranchIds={currentUser?.branchIds} // Pass user's assigned branches
                {...controlProps}
                onUpload={(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.MANAGER)
                    ? () => setView(ViewMode.ADMIN_DASHBOARD)
                    : undefined
                }
                isLoading={isFetchingRoutes}
            />}

            {view === ViewMode.ADMIN_DASHBOARD && (
                <AdminDashboard
                    currentUser={currentUser}
                    onLogout={onLogout}
                    onNavigateToInsights={() => setView(ViewMode.LEGACY_INSIGHTS)}
                    onNavigateToMap={() => setView(ViewMode.DASHBOARD)}
                    onRouteUploaded={onRouteUploaded}
                    onUsersUploaded={onUsersUploaded}
                    onAddUser={onAddUser}
                    onUpdateUser={onUpdateUser}
                    onToggleUserStatus={onToggleUserStatus}
                    onLoginAs={onLoginAs}
                    history={uploadHistory}
                    userList={users}
                    activeVersionId={activeVersionId}
                    onRestoreVersion={onRestoreVersion}
                    onDeleteVersion={onDeleteVersion}
                    hideHeader={props.hideHeader}
                    {...controlProps}
                    maxRouteCap={currentCompany?.maxRoutes}
                    maxCustomerCap={currentCompany?.maxCustomers}
                    existingRoutes={props.availableRoutes}
                    onUpgradePlan={props.onUpgradePlan}
                />
            )}
            {view === ViewMode.USER_MANAGEMENT && (
                <UserManagement
                    currentUser={currentUser}
                    userList={users}
                    currentCompany={currentCompany}
                    onAddUser={onAddUser}
                    onUpdateUser={onUpdateUser || (() => { })}
                    onToggleUserStatus={onToggleUserStatus}
                    onLoginAs={onLoginAs}
                    isDarkMode={controlProps.isDarkMode}
                    language={controlProps.language}
                    onNavigate={setView}
                    hideHeader={props.hideHeader}
                />
            )}
            {!isLimbo && view === ViewMode.SCANNER_V2 && (
                <ScannerV2
                    onBack={() => setView(ViewMode.LEGACY_INSIGHTS)}
                    allCustomers={accessibleCustomers}
                    onSaveCustomer={async (customerData) => {
                        if (!props.currentCompany?.id) {
                            throw new Error('No company selected');
                        }
                        await addCustomerFromScanner(props.currentCompany.id, customerData);
                    }}
                />
            )}



            {!isLimbo && view === ViewMode.ANALYZE_DATA && (
                <AnalyzeDataModule 
                    companyId={currentCompany?.id || ''} 
                    userId={currentUser?.id || ''} 
                />
            )}

            {view === ViewMode.REFERRAL_HUB && (
                <PartnerProgram
                    onClose={() => setView(ViewMode.LEGACY_INSIGHTS)}
                    userId={currentUser?.id}
                />
            )}

            {view === ViewMode.LICENSE_SUMMARY && (
                <LicenseSummary
                    currentUser={currentUser}
                    currentCompany={currentCompany}
                    users={users}
                    allCustomers={allCustomers}
                    availableRoutes={availableRoutes}
                    onNavigate={setView}
                    isDarkMode={controlProps.isDarkMode}
                    language={controlProps.language}
                />
            )}
        </>
    );
};

export default AppContent;
