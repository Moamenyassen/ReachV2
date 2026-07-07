import React, { useEffect, useState } from 'react';
import SysAdminOverview from './SysAdmin/SysAdminOverview';
import SysAdminCustomers from './SysAdmin/SysAdminCustomers';
import SysAdminLeads from './SysAdmin/SysAdminLeads';
import SysAdminUsers from './SysAdmin/SysAdminUsers';
import SysAdminPromos from './SysAdmin/SysAdminPromos';
import SysAdminAffiliates from './SysAdmin/SysAdminAffiliates';
import SysAdminLicenseRequests from './SysAdmin/SysAdminLicenseRequests';
import SysAdminPlans from './SysAdmin/SysAdminPlans';
import SysAdminTeam from './SysAdmin/SysAdminTeam';
import {
    SysAdminApiUsage,
    SysAdminScannerUsage,
    SysAdminUploadAudit,
    SysAdminSessions,
    SysAdminSystemLog,
    SysAdminEnforcement,
    SysAdminSecurityCenter,
} from './SysAdmin/SysAdminObservability';
import { sysadminApi, VerifyResponse, Permission } from '../../services/sysadminApi';
import {
    LayoutDashboard,
    Activity,
    Building2,
    Users,
    Ticket,
    CreditCard,
    LogOut,
    Zap,
    Megaphone,
    FileText,
    ScanSearch,
    Upload,
    FileWarning,
    AlertTriangle,
    ShieldCheck,
    UserCog,
    Crown,
    Home,
    Rocket,
    Wallet,
    BarChart3,
    Cog,
} from 'lucide-react';

interface SysAdminDashboardProps {
    onLogout: () => void;
}

const SysAdminDashboard: React.FC<SysAdminDashboardProps> = ({ onLogout }) => {
    // Current View State - Default to Overview
    const [viewMode, setViewMode] = useState<string>('OVERVIEW');
    const [me, setMe] = useState<VerifyResponse | null>(null);
    const [meErr, setMeErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const v = await sysadminApi.verify();
                if (!cancelled) setMe(v);
            } catch (e: any) {
                if (!cancelled) setMeErr(e?.message || 'Could not load permissions');
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const can = (p: Permission) => !!me?.permissions?.[p];
    const meSysadminId = me?.sysadmin_id;

    // Render Content Based on View
    const renderContent = () => {
        switch (viewMode) {
            case 'OVERVIEW':
                return <SysAdminOverview onNavigate={setViewMode} />;
            case 'COMPANIES':
                return <SysAdminCustomers />;
            case 'LEADS':
                return <SysAdminLeads />;
            case 'LICENSE_REQUESTS':
                return <SysAdminLicenseRequests />;
            case 'REACH_CRM':
                return <SysAdminUsers />;
            case 'PROMOS':
                return <SysAdminPromos />;
            case 'AFFILIATES':
                return <SysAdminAffiliates />;
            case 'PLANS':
                return <SysAdminPlans />;
            case 'API_USAGE':
                return <SysAdminApiUsage />;
            case 'SCANNER_USAGE':
                return <SysAdminScannerUsage />;
            case 'UPLOAD_AUDIT':
                return <SysAdminUploadAudit />;
            case 'SESSIONS':
                return <SysAdminSessions />;
            case 'SYSTEM_LOG':
                return <SysAdminSystemLog />;
            case 'ENFORCEMENT':
                return <SysAdminEnforcement />;
            case 'SECURITY':
                return <SysAdminSecurityCenter />;
            case 'TEAM':
                if (!me) return <div className="text-slate-500 text-sm p-6">Loading permissions…</div>;
                return <SysAdminTeam currentRole={me.role} currentSysadminId={meSysadminId} />;
            default:
                return <SysAdminOverview onNavigate={setViewMode} />;
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 2-LEVEL NAV: 6 top-level sections, each with one or more sub-tabs.
    // Sub-tab bar only renders when a section has more than one entry.
    // ─────────────────────────────────────────────────────────────────────────
    type SubTab = { id: string; label: string; icon: any; requires?: Permission };
    type Section = { id: string; label: string; icon: any; tabs: SubTab[] };

    const SECTIONS: Section[] = [
        {
            id: 'HOME', label: 'Overview', icon: Home,
            tabs: [{ id: 'OVERVIEW', label: 'Overview', icon: Activity }],
        },
        {
            id: 'TENANTS', label: 'Tenants', icon: Building2,
            tabs: [
                { id: 'COMPANIES',   label: 'Companies',   icon: Building2,    requires: 'manage_companies' },
                { id: 'ENFORCEMENT', label: 'Enforcement', icon: AlertTriangle },
                { id: 'SESSIONS',    label: 'Sessions',    icon: Users },
            ],
        },
        {
            id: 'GROWTH', label: 'Growth', icon: Rocket,
            tabs: [
                { id: 'LEADS',      label: 'Reach Leads', icon: Zap },
                { id: 'REACH_CRM',  label: 'CRM',         icon: Users },
                { id: 'AFFILIATES', label: 'Affiliates',  icon: Megaphone,  requires: 'manage_affiliates' },
                { id: 'PROMOS',     label: 'Promos',      icon: Ticket,     requires: 'manage_promos' },
            ],
        },
        {
            id: 'BILLING', label: 'Billing', icon: Wallet,
            tabs: [
                { id: 'LICENSE_REQUESTS', label: 'Licenses', icon: FileText,    requires: 'manage_licenses' },
                { id: 'PLANS',            label: 'Plans',    icon: CreditCard,  requires: 'manage_plans' },
            ],
        },
        {
            id: 'USAGE', label: 'Usage', icon: BarChart3,
            tabs: [
                { id: 'API_USAGE',     label: 'AI / Gemini', icon: Zap,        requires: 'view_usage' },
                { id: 'SCANNER_USAGE', label: 'Scanner',     icon: ScanSearch, requires: 'view_usage' },
                { id: 'UPLOAD_AUDIT',  label: 'Uploads',     icon: Upload,     requires: 'view_usage' },
            ],
        },
        {
            id: 'SYSTEM', label: 'System', icon: Cog,
            tabs: [
                { id: 'TEAM',       label: 'Users',    icon: UserCog,      requires: 'manage_sysadmins' },
                { id: 'SYSTEM_LOG', label: 'Logs',     icon: FileWarning,  requires: 'view_audit_log' },
                { id: 'SECURITY',   label: 'Security', icon: ShieldCheck },
            ],
        },
    ];

    // Strip sub-tabs the caller lacks permission for; drop sections that end up empty.
    const visibleSections: Section[] = SECTIONS
        .map(s => ({ ...s, tabs: s.tabs.filter(t => !me || !t.requires || can(t.requires)) }))
        .filter(s => s.tabs.length > 0);

    // Find which section owns the current viewMode (defaults to first).
    const currentSection: Section =
        visibleSections.find(s => s.tabs.some(t => t.id === viewMode))
        ?? visibleSections[0];

    return (
        <div className="min-h-screen bg-[var(--bg-main)] text-slate-200 font-sans">
            {/* Top Brand Bar */}
            <header className="bg-[var(--bg-sidebar)] border-b border-white/5 relative z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo / Brand */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <LayoutDashboard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Reach Sysadmin Portal</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {me && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                                {me.role === 'owner' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                                <span className="text-xs font-bold text-slate-300">{me.display_name}</span>
                                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-bold">
                                    {me.role}
                                </span>
                            </div>
                        )}
                        {meErr && <span className="text-[10px] text-red-400 font-bold">{meErr}</span>}
                        <button
                            onClick={onLogout}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Sticky Two-Level Navigation */}
            <div className="sticky top-0 z-40 bg-[var(--bg-main)]/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
                {/* TOP LEVEL — sections */}
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center h-14 overflow-x-auto no-scrollbar">
                        <nav className="flex items-center gap-1">
                            {visibleSections.map(sec => {
                                const Icon = sec.icon;
                                const isActive = currentSection?.id === sec.id;
                                return (
                                    <button
                                        key={sec.id}
                                        onClick={() => setViewMode(sec.tabs[0].id)}
                                        className={`group relative py-3 px-4 text-sm font-bold flex items-center gap-2 rounded-xl transition-all whitespace-nowrap ${
                                            isActive
                                                ? 'text-white bg-white/5'
                                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]'
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : ''}`} />
                                        {sec.label}
                                        {isActive && (
                                            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* SECOND LEVEL — sub-tab pills (only if the section has more than one tab) */}
                {currentSection && currentSection.tabs.length > 1 && (
                    <div className="max-w-7xl mx-auto px-6 border-t border-white/5">
                        <div className="flex items-center h-11 gap-1 overflow-x-auto no-scrollbar">
                            {currentSection.tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = viewMode === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setViewMode(tab.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                            isActive
                                                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto px-6 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {renderContent()}
            </main>
        </div>
    );
};

export default SysAdminDashboard;
