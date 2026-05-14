// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
    Company, CompanySettings, BranchConfig, NormalizedBranch, UserRole
} from '../types';
import { DEFAULT_COMPANY_SETTINGS, COUNTRIES_DATA } from '../config/constants';
import {
    updateCompany, getBranches, upsertBranch, deleteBranch, detectAndAddBranches
} from '../services/supabase';
import CompanyBrandingSettings from './CompanyBrandingSettings';
import {
    ArrowLeft, Search, Save, X, Check, Settings as SettingsIcon, Palette, Globe,
    Building2, LayoutGrid, TrendingUp, Truck, Radar, Map as MapIcon, Crown,
    AlertTriangle, ChevronRight, Plus, Trash2, MapPin, Info, Loader2, ShieldAlert,
    RotateCcw, Eye, EyeOff, Sparkles, Sliders, Download, Upload
} from 'lucide-react';

interface CompanySettingsV2Props {
    company: Company;
    onClose: () => void;
    isSysAdmin?: boolean;
    currentUserRole?: UserRole | string;
    onCompanyUpdated?: (company: Company) => void;
}

type TabId =
    | 'profile' | 'localization' | 'branches' | 'modules'
    | 'insights' | 'optimizer' | 'market' | 'map'
    | 'license' | 'danger';

interface TabDef {
    id: TabId;
    label: string;
    icon: React.ElementType;
    description: string;
    sysAdminOnly?: boolean;
    color: string;
    keywords: string[];     // for search filtering
}

const TABS: TabDef[] = [
    { id: 'profile',      label: 'Profile & Branding',    icon: Palette,        description: 'Company name, logo, colors, font, theme, UI mode',         color: 'from-pink-500 to-rose-500',         keywords: ['logo','branding','color','primary','secondary','font','dark','light','theme','classic','modern','favicon','company name'] },
    { id: 'localization', label: 'Localization',          icon: Globe,          description: 'Language, currency, distance unit, country, retention',     color: 'from-cyan-500 to-blue-500',         keywords: ['language','arabic','english','currency','sar','distance','km','mi','country','retention','data'] },
    { id: 'branches',     label: 'Branches & Locations',  icon: Building2,      description: 'Manage branches, depot coordinates, CSV import',            color: 'from-emerald-500 to-teal-500',      keywords: ['branch','location','depot','coordinates','lat','lng','address','warehouse'] },
    { id: 'modules',      label: 'Modules',               icon: LayoutGrid,     description: 'Enable / disable major app features',                       color: 'from-indigo-500 to-purple-500',     keywords: ['module','feature','enable','disable','toggle','insights','optimizer','market','map'] },
    { id: 'insights',     label: 'Insights',              icon: TrendingUp,     description: 'Route health thresholds, churn, visit frequency',           color: 'from-purple-500 to-fuchsia-500',    keywords: ['insights','health','clients','efficiency','churn','visit','frequency','working days','nearby'] },
    { id: 'optimizer',    label: 'AI Optimizer',          icon: Truck,          description: 'Speed, service time, costs, max hours, objective',          color: 'from-amber-500 to-orange-500',      keywords: ['optimizer','speed','service','traffic','hours','fuel','driver','depot','distance','break','objective','cost'] },
    { id: 'market',       label: 'Market Scanner',        icon: Radar,          description: 'Lead scan limits, zoom, keywords, export',                  color: 'from-cyan-500 via-purple-500 to-pink-500', keywords: ['market','scanner','leads','zoom','keywords','timeout','deep','export','csv','json'] },
    { id: 'map',          label: 'Map & Visualization',   icon: MapIcon,        description: 'Default center, zoom, traffic, clustering, heatmap',        color: 'from-blue-500 to-cyan-500',         keywords: ['map','center','zoom','traffic','cluster','heatmap','satellite','streets','dark','unassigned'] },
    { id: 'license',      label: 'License & Limits',      icon: Crown,          description: 'Tier, seat caps, expiry, promo, sysadmin discount',         color: 'from-yellow-500 to-amber-600',      sysAdminOnly: true, keywords: ['license','plan','subscription','tier','seats','users','routes','customers','expiry','promo','discount','starter','professional','enterprise'] },
    { id: 'danger',       label: 'Danger Zone',           icon: ShieldAlert,    description: 'Reset settings, deactivate company',                        color: 'from-red-500 to-rose-700',          sysAdminOnly: true, keywords: ['danger','reset','deactivate','delete','destroy'] },
];

// ─── Reusable Form Atoms ──────────────────────────────────────────────────────

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${
            checked ? 'bg-gradient-to-r from-cyan-500 to-purple-500 shadow-lg shadow-cyan-500/30' : 'bg-white/10'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-pressed={checked}
    >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-md ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
);

const SettingRow: React.FC<{
    label: string;
    description?: string;
    children: React.ReactNode;
    badge?: string;
}> = ({ label, description, children, badge }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-white">{label}</span>
                {badge && <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-white/50 uppercase tracking-widest">{badge}</span>}
            </div>
            {description && <div className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{description}</div>}
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

const NumberInput: React.FC<{
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    width?: string;
}> = ({ value, onChange, min, max, step = 1, suffix, width = 'w-24' }) => (
    <div className="flex items-center gap-1.5">
        <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={e => onChange(Number(e.target.value))}
            className={`${width} bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-sm text-right outline-none focus:border-cyan-500 transition-colors`}
        />
        {suffix && <span className="text-[11px] text-white/40 font-mono uppercase tracking-wider">{suffix}</span>}
    </div>
);

const TextField: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    width?: string;
}> = ({ value, onChange, placeholder, width = 'w-48' }) => (
    <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${width} bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-cyan-500 transition-colors placeholder:text-white/30`}
    />
);

const SelectField: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    width?: string;
}> = ({ value, onChange, options, width = 'w-48' }) => (
    <div className={`relative ${width}`}>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-2.5 pr-8 py-1.5 text-white text-sm outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer"
        >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 rotate-90 pointer-events-none" />
    </div>
);

const SectionTitle: React.FC<{ icon: React.ElementType; title: string; description: string; gradient: string }> = ({ icon: Icon, title, description, gradient }) => (
    <div className="mb-6 flex items-start gap-3">
        <div className={`relative w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
            <p className="text-sm text-white/50 mt-0.5">{description}</p>
        </div>
    </div>
);

const SubSection: React.FC<{ title: string; icon?: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="mb-6">
        <h3 className="flex items-center gap-2 text-[11px] font-black text-white/60 uppercase tracking-widest mb-3">
            {Icon && <Icon className="w-3.5 h-3.5 text-cyan-400" />}
            {title}
        </h3>
        <div className="space-y-2">{children}</div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const CompanySettingsV2: React.FC<CompanySettingsV2Props> = ({
    company, onClose, isSysAdmin = false, currentUserRole, onCompanyUpdated
}) => {
    const isAdminOrAbove =
        isSysAdmin ||
        currentUserRole === UserRole.ADMIN ||
        currentUserRole === 'ADMIN';

    const [activeTab, setActiveTab] = useState<TabId>('profile');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveOk, setSaveOk] = useState(false);

    // Settings state — initialize from company
    const initialSettings = useMemo<CompanySettings>(() => {
        const def = JSON.parse(JSON.stringify(DEFAULT_COMPANY_SETTINGS));
        const c = company.settings;
        if (!c || !c.common) return def;
        return {
            common: {
                general: { ...def.common.general, ...c.common?.general },
                theme:   { ...def.common.theme,   ...c.common?.theme   },
            },
            modules: {
                insights:  { ...def.modules.insights,  ...c.modules?.insights  },
                market:    { ...def.modules.market,    ...c.modules?.market    },
                optimizer: { ...def.modules.optimizer, ...c.modules?.optimizer },
                map:       { ...def.modules.map,       ...c.modules?.map       },
                scannerV2: { ...def.modules.scannerV2, ...c.modules?.scannerV2 },
            },
            subscription: { ...(def.subscription || {}), ...(c.subscription || {}) },
        };
    }, [company.id]);

    const [settings, setSettings] = useState<CompanySettings>(initialSettings);
    const [companyName, setCompanyName] = useState(company.name);
    const [companyMeta, setCompanyMeta] = useState({
        subscriptionTier:   company.subscriptionTier   ?? 'STARTER',
        maxUsers:           company.maxUsers           ?? 5,
        maxRoutes:          company.maxRoutes          ?? 0,
        maxCustomers:       company.maxCustomers       ?? 0,
        maxScannerCap:      company.maxScannerCap      ?? 500,
        expirationDate:     company.expirationDate     ?? '',
        subscriptionStatus: company.subscriptionStatus ?? 'ACTIVE',
        isActive:           company.isActive,
    });

    const isDirty = useMemo(() => {
        return JSON.stringify(settings) !== JSON.stringify(initialSettings)
            || companyName !== company.name
            || JSON.stringify(companyMeta) !== JSON.stringify({
                subscriptionTier:   company.subscriptionTier   ?? 'STARTER',
                maxUsers:           company.maxUsers           ?? 5,
                maxRoutes:          company.maxRoutes          ?? 0,
                maxCustomers:       company.maxCustomers       ?? 0,
                maxScannerCap:      company.maxScannerCap      ?? 500,
                expirationDate:     company.expirationDate     ?? '',
                subscriptionStatus: company.subscriptionStatus ?? 'ACTIVE',
                isActive:           company.isActive,
            });
    }, [settings, initialSettings, companyName, companyMeta, company]);

    // ── Helpers to update nested settings paths ─────────────────────────────
    const setCommonGeneral  = (patch: Partial<CompanySettings['common']['general']>)  => setSettings(s => ({ ...s, common: { ...s.common, general: { ...s.common.general, ...patch } } }));
    const setCommonTheme    = (patch: Partial<CompanySettings['common']['theme']>)    => setSettings(s => ({ ...s, common: { ...s.common, theme:   { ...s.common.theme,   ...patch } } }));
    const setInsights       = (patch: Partial<CompanySettings['modules']['insights']>)  => setSettings(s => ({ ...s, modules: { ...s.modules, insights:  { ...s.modules.insights,  ...patch } } }));
    const setMarket         = (patch: Partial<CompanySettings['modules']['market']>)    => setSettings(s => ({ ...s, modules: { ...s.modules, market:    { ...s.modules.market,    ...patch } } }));
    const setOptimizer      = (patch: Partial<CompanySettings['modules']['optimizer']>) => setSettings(s => ({ ...s, modules: { ...s.modules, optimizer: { ...s.modules.optimizer, ...patch } } }));
    const setMap            = (patch: Partial<CompanySettings['modules']['map']>)       => setSettings(s => ({ ...s, modules: { ...s.modules, map:       { ...s.modules.map,       ...patch } } }));
    const setSubscription   = (patch: NonNullable<CompanySettings['subscription']>)     => setSettings(s => ({ ...s, subscription: { ...(s.subscription || {}), ...patch } }));

    // ── Save handler ────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!isAdminOrAbove) return;
        setIsSaving(true);
        setSaveError(null);
        setSaveOk(false);
        try {
            const updates: Partial<Company> = {
                settings: settings as any,
                name: companyName,
            };
            if (isSysAdmin) {
                updates.subscriptionTier   = companyMeta.subscriptionTier;
                updates.maxUsers           = companyMeta.maxUsers;
                updates.maxRoutes          = companyMeta.maxRoutes;
                updates.maxCustomers       = companyMeta.maxCustomers;
                updates.maxScannerCap      = companyMeta.maxScannerCap;
                updates.expirationDate     = companyMeta.expirationDate || null;
                updates.subscriptionStatus = companyMeta.subscriptionStatus;
                updates.isActive           = companyMeta.isActive;
            }
            const updated = await updateCompany(company.id, updates);
            setSaveOk(true);
            onCompanyUpdated?.(updated as any);
            setTimeout(() => setSaveOk(false), 2500);
        } catch (e: any) {
            console.error('[CompanySettingsV2] save failed', e);
            setSaveError(e?.message || 'Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        setSettings(initialSettings);
        setCompanyName(company.name);
        setCompanyMeta({
            subscriptionTier:   company.subscriptionTier   ?? 'STARTER',
            maxUsers:           company.maxUsers           ?? 5,
            maxRoutes:          company.maxRoutes          ?? 0,
            maxCustomers:       company.maxCustomers       ?? 0,
            maxScannerCap:      company.maxScannerCap      ?? 500,
            expirationDate:     company.expirationDate     ?? '',
            subscriptionStatus: company.subscriptionStatus ?? 'ACTIVE',
            isActive:           company.isActive,
        });
        setSaveError(null);
    };

    // ── Visible tabs based on role + search ────────────────────────────────
    const visibleTabs = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return TABS.filter(t => {
            if (t.sysAdminOnly && !isSysAdmin) return false;
            if (!q) return true;
            return t.label.toLowerCase().includes(q)
                || t.description.toLowerCase().includes(q)
                || t.keywords.some(k => k.includes(q));
        });
    }, [searchQuery, isSysAdmin]);

    // Auto-switch to first visible tab if active is filtered out
    useEffect(() => {
        if (!visibleTabs.find(t => t.id === activeTab) && visibleTabs.length > 0) {
            setActiveTab(visibleTabs[0].id);
        }
    }, [visibleTabs, activeTab]);

    return (
        <div className="fixed inset-0 z-[9990] bg-[#020617] text-white font-sans flex flex-col overflow-hidden">
            {/* Background flair */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
            </div>

            {/* Top Bar */}
            <header className="relative z-10 flex items-center gap-3 px-6 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                    title="Back"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="relative w-10 h-10 shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl blur opacity-50" />
                        <div className="relative w-10 h-10 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <SettingsIcon className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-black uppercase tracking-widest leading-none truncate">Company Settings</h1>
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-[8px] font-black text-purple-300 uppercase tracking-widest">V2</span>
                            {isSysAdmin && <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[8px] font-black text-amber-300 uppercase tracking-widest">SysAdmin</span>}
                        </div>
                        <p className="text-[10px] text-cyan-400 font-bold mt-1 uppercase truncate">{companyName}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative hidden md:block w-72 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                        type="text"
                        placeholder="Search any setting…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-cyan-500 placeholder:text-white/30"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center"
                        >
                            <X className="w-3.5 h-3.5 text-white/40" />
                        </button>
                    )}
                </div>
            </header>

            {/* Body — left rail + content */}
            <div className="relative z-10 flex-1 flex overflow-hidden min-h-0">
                {/* Left rail */}
                <nav className="w-64 shrink-0 bg-slate-900/60 border-r border-white/5 overflow-y-auto p-3">
                    <div className="space-y-1">
                        {visibleTabs.map(t => {
                            const Icon = t.icon;
                            const active = t.id === activeTab;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                        active
                                            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/15 border border-cyan-500/30 text-white shadow-lg shadow-cyan-500/10'
                                            : 'border border-transparent hover:bg-white/[0.04] text-white/60 hover:text-white'
                                    }`}
                                >
                                    <div className={`w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center ${active ? '' : 'opacity-60'}`}>
                                        <Icon className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[12px] font-black uppercase tracking-widest leading-tight truncate">{t.label}</div>
                                        <div className="text-[10px] text-white/40 truncate mt-0.5">{t.description}</div>
                                    </div>
                                </button>
                            );
                        })}
                        {visibleTabs.length === 0 && (
                            <div className="px-3 py-6 text-center">
                                <Search className="w-6 h-6 text-white/20 mx-auto mb-2" />
                                <p className="text-[11px] text-white/40">No settings match your search.</p>
                            </div>
                        )}
                    </div>
                </nav>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-8 pb-32">
                    {!isAdminOrAbove && (
                        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <div className="text-sm font-black text-amber-300">Read-only view</div>
                                <p className="text-xs text-amber-200/80 mt-0.5">Only company admins can change these settings.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <ProfilePane
                            company={company}
                            companyName={companyName}
                            setCompanyName={setCompanyName}
                            settings={settings}
                            setCommonTheme={setCommonTheme}
                            disabled={!isAdminOrAbove}
                        />
                    )}
                    {activeTab === 'localization' && (
                        <LocalizationPane settings={settings} setCommonGeneral={setCommonGeneral} disabled={!isAdminOrAbove} />
                    )}
                    {activeTab === 'branches' && (
                        <BranchesPane company={company} disabled={!isAdminOrAbove} />
                    )}
                    {activeTab === 'modules' && (
                        <ModulesPane settings={settings} setSettings={setSettings} setActiveTab={setActiveTab} disabled={!isAdminOrAbove} />
                    )}
                    {activeTab === 'insights' && (
                        <InsightsPane settings={settings} setInsights={setInsights} disabled={!isAdminOrAbove} />
                    )}
                    {activeTab === 'optimizer' && (
                        <OptimizerPane settings={settings} setOptimizer={setOptimizer} disabled={!isAdminOrAbove} />
                    )}
                    {activeTab === 'market' && (
                        <MarketPane settings={settings} setMarket={setMarket} disabled={!isAdminOrAbove} />
                    )}
                    {activeTab === 'map' && (
                        <MapPane settings={settings} setMap={setMap} disabled={!isAdminOrAbove} />
                    )}
                    {activeTab === 'license' && isSysAdmin && (
                        <LicensePane company={company} meta={companyMeta} setMeta={setCompanyMeta} settings={settings} setSubscription={setSubscription} />
                    )}
                    {activeTab === 'danger' && isSysAdmin && (
                        <DangerPane
                            company={company}
                            meta={companyMeta}
                            setMeta={setCompanyMeta}
                            onResetSettings={() => {
                                if (window.confirm('Reset ALL company settings to defaults? This cannot be undone until you Save.')) {
                                    setSettings(JSON.parse(JSON.stringify(DEFAULT_COMPANY_SETTINGS)));
                                }
                            }}
                        />
                    )}
                </main>
            </div>

            {/* Save Bar */}
            {(isDirty || saveOk || saveError) && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
                    {saveOk ? (
                        <>
                            <Check className="w-5 h-5 text-emerald-400" />
                            <span className="text-sm font-black text-emerald-300">Settings saved</span>
                        </>
                    ) : saveError ? (
                        <>
                            <AlertTriangle className="w-5 h-5 text-rose-400" />
                            <span className="text-sm font-bold text-rose-300">{saveError}</span>
                            <button onClick={() => setSaveError(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-bold text-amber-300">You have unsaved changes</span>
                            <button
                                onClick={handleDiscard}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/60 transition-all"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !isAdminOrAbove}
                                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-purple-500/30 flex items-center gap-2 transition-all"
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {isSaving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Profile & Branding Pane ─────────────────────────────────────────────────

const ProfilePane: React.FC<any> = ({ company, companyName, setCompanyName, settings, setCommonTheme, disabled }) => (
    <div>
        <SectionTitle icon={Palette} title="Profile & Branding" description="Identity, logo, color palette, font, and theme" gradient="from-pink-500 to-rose-500" />

        <SubSection title="Identity" icon={Building2}>
            <SettingRow label="Company Name" description="Displayed in headers, reports, and email signatures.">
                <TextField value={companyName} onChange={setCompanyName} placeholder="Acme Distribution Co." width="w-64" />
            </SettingRow>
            <SettingRow label="Company ID" description="Internal Reach ID — read only." badge="System">
                <span className="text-[12px] font-mono text-white/50 px-2 py-1 rounded-md bg-white/5 border border-white/10">{company.id?.slice(0, 8)}…</span>
            </SettingRow>
        </SubSection>

        <SubSection title="Theme" icon={Sparkles}>
            <SettingRow label="Dark Mode" description="Default theme for new sessions; users can override per-account.">
                <Toggle checked={settings.common.theme.enableDarkMode} onChange={v => setCommonTheme({ enableDarkMode: v })} disabled={disabled} />
            </SettingRow>
        </SubSection>

        <SubSection title="Logo, Colors, Typography" icon={Palette}>
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
                <CompanyBrandingSettings />
            </div>
        </SubSection>
    </div>
);

// ─── Localization Pane ───────────────────────────────────────────────────────

const LocalizationPane: React.FC<any> = ({ settings, setCommonGeneral, disabled }) => (
    <div>
        <SectionTitle icon={Globe} title="Localization" description="Language, region, units, retention" gradient="from-cyan-500 to-blue-500" />

        <SubSection title="Region & Language">
            <SettingRow label="Default Language" description="Primary UI language for all users; users can override.">
                <SelectField value={settings.common.general.language} onChange={v => setCommonGeneral({ language: v as any })} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية (Arabic)' }]} width="w-48" />
            </SettingRow>
            <SettingRow label="Country" description="Drives map defaults, currency suggestions, and Overpass tile selection.">
                <SelectField
                    value={settings.common.general.country || ''}
                    onChange={v => setCommonGeneral({ country: v })}
                    options={[
                        { value: '', label: '— Not set —' },
                        ...Object.keys(COUNTRIES_DATA).map(name => ({ value: name, label: name }))
                    ]}
                    width="w-56"
                />
            </SettingRow>
        </SubSection>

        <SubSection title="Units & Currency">
            <SettingRow label="Currency" description="Used in Pricing screen, Optimizer cost displays, and exports.">
                <TextField value={settings.common.general.currency} onChange={v => setCommonGeneral({ currency: v })} placeholder="SAR" width="w-32" />
            </SettingRow>
            <SettingRow label="Distance Unit" description="Drives all distance fields across maps, optimizer, and reports.">
                <SelectField value={settings.common.general.distanceUnit} onChange={v => setCommonGeneral({ distanceUnit: v as any })} options={[{ value: 'km', label: 'Kilometers (km)' }, { value: 'mi', label: 'Miles (mi)' }]} width="w-48" />
            </SettingRow>
        </SubSection>

        <SubSection title="Data Retention">
            <SettingRow label="Retention Window" description="How long historical uploads & route runs stay queryable.">
                <NumberInput value={settings.common.general.dataRetentionDays} onChange={v => setCommonGeneral({ dataRetentionDays: v })} min={7} max={3650} suffix="days" />
            </SettingRow>
        </SubSection>
    </div>
);

// ─── Branches Pane ────────────────────────────────────────────────────────────

const BranchesPane: React.FC<any> = ({ company, disabled }) => {
    const [branches, setBranches] = useState<NormalizedBranch[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editing, setEditing] = useState<Partial<NormalizedBranch> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    const load = useCallback(async () => {
        if (!company.id) return;
        setIsLoading(true);
        try {
            const list = await getBranches(company.id);
            setBranches(list || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load branches.');
        } finally {
            setIsLoading(false);
        }
    }, [company.id]);

    useEffect(() => { load(); }, [load]);

    const handleSave = async () => {
        if (!editing || !editing.name_en) { setError('Branch name is required.'); return; }
        setError(null);
        try {
            await upsertBranch({
                id: editing.id,
                company_id: company.id,
                code: editing.code || (editing.name_en || '').slice(0, 16).toUpperCase().replace(/\s+/g, '_'),
                name_en: editing.name_en,
                name_ar: editing.name_ar || '',
                lat: editing.lat ?? null,
                lng: editing.lng ?? null,
                address: editing.address || '',
                is_active: editing.is_active ?? true,
            } as any);
            setEditing(null);
            await load();
        } catch (e: any) { setError(e?.message || 'Save failed.'); }
    };

    const handleDelete = async (id?: string) => {
        if (!id || !window.confirm('Delete this branch? Customers and routes attached to it will keep their references.')) return;
        try { await deleteBranch(id); await load(); }
        catch (e: any) { setError(e?.message || 'Delete failed.'); }
    };

    const handleCsvImport = (file: File) => {
        setImporting(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (res) => {
                try {
                    const rows = (res.data as any[]).filter(r => r.name_en || r.name);
                    let added = 0;
                    for (const r of rows) {
                        await upsertBranch({
                            company_id: company.id,
                            code: (r.code || (r.name_en || r.name).slice(0,16).toUpperCase().replace(/\s+/g,'_')),
                            name_en: r.name_en || r.name,
                            name_ar: r.name_ar || '',
                            lat: r.lat ? Number(r.lat) : null,
                            lng: r.lng ? Number(r.lng) : null,
                            address: r.address || '',
                            is_active: true,
                        } as any);
                        added++;
                    }
                    await load();
                    alert(`Imported ${added} branches.`);
                } catch (e: any) { setError(e?.message || 'CSV import failed.'); }
                finally { setImporting(false); }
            },
            error: (err) => { setImporting(false); setError(err.message); }
        });
    };

    return (
        <div>
            <SectionTitle icon={Building2} title="Branches & Locations" description="Each branch acts as a depot for routes" gradient="from-emerald-500 to-teal-500" />

            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={() => setEditing({ is_active: true })}
                    disabled={disabled}
                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 disabled:opacity-50 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                >
                    <Plus className="w-4 h-4" /> Add Branch
                </button>
                <label className={`px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/70 flex items-center gap-2 transition-all cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Import CSV
                    <input type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && handleCsvImport(e.target.files[0])} />
                </label>
                <button
                    onClick={load}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/70 flex items-center gap-2 transition-all"
                    title="Refresh"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
                <span className="ml-auto text-[11px] text-white/40">{branches.length} total</span>
            </div>

            {error && (
                <div className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {isLoading ? (
                <div className="py-12 text-center text-white/40 flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading branches…
                </div>
            ) : branches.length === 0 ? (
                <div className="py-12 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10">
                    <Building2 className="w-10 h-10 text-white/20 mx-auto mb-2" />
                    <p className="text-sm text-white/50">No branches yet. Add one or import via CSV.</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {branches.map(b => (
                        <div key={b.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4 text-emerald-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-white truncate">{b.name_en}</div>
                                <div className="text-[11px] text-white/40 truncate">
                                    {b.code} · {b.lat && b.lng ? `${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}` : 'No coordinates'}
                                    {b.name_ar && <span className="ml-2 text-indigo-300/70" dir="rtl">{b.name_ar}</span>}
                                </div>
                            </div>
                            <button
                                onClick={() => setEditing(b)}
                                disabled={disabled}
                                className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/70 disabled:opacity-50"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => handleDelete(b.id)}
                                disabled={disabled}
                                className="w-8 h-8 rounded-md hover:bg-rose-500/15 text-white/30 hover:text-rose-400 flex items-center justify-center transition-all disabled:opacity-50"
                                title="Delete"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {editing && (
                <BranchEditor
                    branch={editing}
                    onChange={setEditing}
                    onSave={handleSave}
                    onCancel={() => setEditing(null)}
                />
            )}
        </div>
    );
};

const BranchEditor: React.FC<any> = ({ branch, onChange, onSave, onCancel }) => (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-black text-white">{branch.id ? 'Edit Branch' : 'Add Branch'}</h3>
            </div>
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Name (EN) *</label>
                    <input
                        value={branch.name_en || ''}
                        onChange={e => onChange({ ...branch, name_en: e.target.value })}
                        className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                        placeholder="Riyadh North"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Name (AR)</label>
                    <input
                        value={branch.name_ar || ''}
                        onChange={e => onChange({ ...branch, name_ar: e.target.value })}
                        dir="rtl"
                        className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                        placeholder="فرع الرياض الشمالي"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Code</label>
                    <input
                        value={branch.code || ''}
                        onChange={e => onChange({ ...branch, code: e.target.value })}
                        className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500 font-mono uppercase"
                        placeholder="RUH_N"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Latitude</label>
                        <input
                            type="number"
                            step="0.000001"
                            value={branch.lat ?? ''}
                            onChange={e => onChange({ ...branch, lat: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                            placeholder="24.7136"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Longitude</label>
                        <input
                            type="number"
                            step="0.000001"
                            value={branch.lng ?? ''}
                            onChange={e => onChange({ ...branch, lng: e.target.value === '' ? null : Number(e.target.value) })}
                            className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                            placeholder="46.6753"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Address</label>
                    <input
                        value={branch.address || ''}
                        onChange={e => onChange({ ...branch, address: e.target.value })}
                        className="w-full mt-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500"
                        placeholder="King Fahd Rd, Riyadh"
                    />
                </div>
                <SettingRow label="Active" description="Inactive branches are hidden from filters and uploads.">
                    <Toggle checked={branch.is_active ?? true} onChange={v => onChange({ ...branch, is_active: v })} />
                </SettingRow>
            </div>
            <div className="mt-5 flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/60">Cancel</button>
                <button onClick={onSave} className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Save className="w-3.5 h-3.5" /> Save Branch
                </button>
            </div>
        </div>
    </div>
);

// ─── Modules Pane ─────────────────────────────────────────────────────────────

const ModulesPane: React.FC<any> = ({ settings, setSettings, setActiveTab, disabled }) => {
    const moduleDefs = [
        { id: 'insights',  label: 'Insights',         desc: 'KPIs, route health, alerts',          tab: 'insights',  icon: TrendingUp, color: 'from-purple-500 to-fuchsia-500' },
        { id: 'optimizer', label: 'AI Optimizer',     desc: 'Route optimization & sequencing',     tab: 'optimizer', icon: Truck,      color: 'from-amber-500 to-orange-500' },
        { id: 'market',    label: 'Market Scanner',   desc: 'Lead discovery & prospecting',        tab: 'market',    icon: Radar,      color: 'from-cyan-500 via-purple-500 to-pink-500' },
        { id: 'map',       label: 'Map & Visualization', desc: 'Map visuals, traffic, clustering', tab: 'map',       icon: MapIcon,    color: 'from-blue-500 to-cyan-500' },
        { id: 'scannerV2', label: 'Opportunity Scanner', desc: 'Advanced opportunity detection',  tab: null,        icon: Sparkles,   color: 'from-indigo-500 to-purple-500' },
    ];

    const setModuleEnabled = (id: string, val: boolean) => {
        setSettings(s => ({
            ...s,
            modules: { ...s.modules, [id]: { ...s.modules[id], enabled: val } }
        }));
    };

    return (
        <div>
            <SectionTitle icon={LayoutGrid} title="Modules" description="Enable or disable features across the app" gradient="from-indigo-500 to-purple-500" />

            <div className="grid gap-3">
                {moduleDefs.map(m => {
                    const enabled = settings.modules[m.id]?.enabled ?? true;
                    const Icon = m.icon;
                    return (
                        <div key={m.id} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                            <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center ${enabled ? '' : 'opacity-40'}`}>
                                <Icon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-black text-white">{m.label}</span>
                                    {enabled
                                        ? <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-widest">Enabled</span>
                                        : <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[9px] font-black text-rose-300 uppercase tracking-widest">Disabled</span>}
                                </div>
                                <div className="text-[12px] text-white/50 mt-0.5">{m.desc}</div>
                            </div>
                            {m.tab && enabled && (
                                <button
                                    onClick={() => setActiveTab(m.tab)}
                                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 flex items-center gap-1 transition-all"
                                >
                                    Configure <ChevronRight className="w-3 h-3" />
                                </button>
                            )}
                            <Toggle checked={enabled} onChange={v => setModuleEnabled(m.id, v)} disabled={disabled} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Insights Pane ────────────────────────────────────────────────────────────

const InsightsPane: React.FC<any> = ({ settings, setInsights, disabled }) => {
    const i = settings.modules.insights;
    return (
        <div>
            <SectionTitle icon={TrendingUp} title="Insights Module" description="Route health thresholds and visit cadence" gradient="from-purple-500 to-fuchsia-500" />

            <SubSection title="Route Health Thresholds">
                <SettingRow label="Min Clients per Route" description="Routes below this are flagged underutilized.">
                    <NumberInput value={i.minClientsPerRoute} onChange={v => setInsights({ minClientsPerRoute: v })} min={1} max={500} />
                </SettingRow>
                <SettingRow label="Max Clients per Route" description="Routes above this are flagged overloaded.">
                    <NumberInput value={i.maxClientsPerRoute} onChange={v => setInsights({ maxClientsPerRoute: v })} min={1} max={500} />
                </SettingRow>
                <SettingRow label="Efficiency Threshold" description="Target visit completion rate (%).">
                    <NumberInput value={i.efficiencyThreshold} onChange={v => setInsights({ efficiencyThreshold: v })} min={0} max={100} suffix="%" />
                </SettingRow>
            </SubSection>

            <SubSection title="Visit Cadence & Working Schedule">
                <SettingRow label="Visit Frequency" description="Target days between visits per customer.">
                    <NumberInput value={i.visitFrequencyDays} onChange={v => setInsights({ visitFrequencyDays: v })} min={1} max={90} suffix="days" />
                </SettingRow>
                <SettingRow label="Working Days per Week" description="Used for capacity calculations.">
                    <NumberInput value={i.workingDaysPerWeek} onChange={v => setInsights({ workingDaysPerWeek: v })} min={1} max={7} suffix="days" />
                </SettingRow>
                <SettingRow label="Churn Threshold" description="Customers without a visit in this window are flagged at-risk.">
                    <NumberInput value={i.churnThresholdDays} onChange={v => setInsights({ churnThresholdDays: v })} min={7} max={365} suffix="days" />
                </SettingRow>
            </SubSection>

            <SubSection title="Geographic Insights">
                <SettingRow label="Nearby Radius" description="Used by Insights and Market Scanner overlap detection.">
                    <NumberInput value={i.nearbyRadiusMeters} onChange={v => setInsights({ nearbyRadiusMeters: v })} min={10} max={5000} suffix="m" />
                </SettingRow>
            </SubSection>
        </div>
    );
};

// ─── Optimizer Pane ───────────────────────────────────────────────────────────

const OptimizerPane: React.FC<any> = ({ settings, setOptimizer, disabled }) => {
    const o = settings.modules.optimizer;
    return (
        <div>
            <SectionTitle icon={Truck} title="AI Optimizer" description="Speed, costs, working hours, and routing strategy" gradient="from-amber-500 to-orange-500" />

            <SubSection title="Vehicle & Service Profile">
                <SettingRow label="Average Speed" description="Used to compute drive-time estimates.">
                    <NumberInput value={o.avgSpeedKmh} onChange={v => setOptimizer({ avgSpeedKmh: v })} min={5} max={150} suffix="km/h" />
                </SettingRow>
                <SettingRow label="Service Time per Stop" description="Average time spent at each customer.">
                    <NumberInput value={o.serviceTimeMin} onChange={v => setOptimizer({ serviceTimeMin: v })} min={1} max={240} suffix="min" />
                </SettingRow>
                <SettingRow label="Traffic Factor" description="Multiplier on raw drive time (1.0 = none, 1.35 = typical city).">
                    <NumberInput value={o.trafficFactor} onChange={v => setOptimizer({ trafficFactor: v })} min={1} max={3} step={0.05} />
                </SettingRow>
                <SettingRow label="Driving Distance Factor" description="Air-distance to road-distance ratio (1.0 = highway, 1.4 = urban).">
                    <NumberInput value={o.drivingDistanceFactor || 1.4} onChange={v => setOptimizer({ drivingDistanceFactor: v })} min={1} max={2.5} step={0.05} />
                </SettingRow>
            </SubSection>

            <SubSection title="Working Schedule">
                <SettingRow label="Max Working Hours per Day" description="Hard cap on per-route duration.">
                    <NumberInput value={o.maxWorkingHours} onChange={v => setOptimizer({ maxWorkingHours: v })} min={1} max={24} suffix="hrs" />
                </SettingRow>
                <SettingRow label="Break Time" description="Mandatory daily break duration.">
                    <NumberInput value={o.breakTimeMin} onChange={v => setOptimizer({ breakTimeMin: v })} min={0} max={180} suffix="min" />
                </SettingRow>
                <SettingRow label="Max Distance per Route" description="Hard cap on per-route kilometers.">
                    <NumberInput value={o.maxDistancePerRouteKm} onChange={v => setOptimizer({ maxDistancePerRouteKm: v })} min={10} max={2000} suffix="km" />
                </SettingRow>
            </SubSection>

            <SubSection title="Cost Model">
                <SettingRow label="Fuel Cost per km" description="Used in cost displays and 'Balanced' optimization.">
                    <NumberInput value={o.fuelCostPerKm} onChange={v => setOptimizer({ fuelCostPerKm: v })} min={0} max={10} step={0.01} suffix={settings.common.general.currency} />
                </SettingRow>
                <SettingRow label="Driver Hourly Rate" description="Used in cost displays and 'Balanced' optimization.">
                    <NumberInput value={o.driverHourlyRate} onChange={v => setOptimizer({ driverHourlyRate: v })} min={0} max={500} step={0.5} suffix={`${settings.common.general.currency}/hr`} />
                </SettingRow>
            </SubSection>

            <SubSection title="Routing Strategy">
                <SettingRow label="Start Location" description="Where each driver begins the day.">
                    <SelectField
                        value={o.startLocation}
                        onChange={v => setOptimizer({ startLocation: v as any })}
                        options={[{ value: 'DEPOT', label: 'Branch / Depot' }, { value: 'HOME', label: 'Driver Home' }]}
                    />
                </SettingRow>
                <SettingRow label="Cost Objective" description="What the optimizer minimizes.">
                    <SelectField
                        value={o.costObjective}
                        onChange={v => setOptimizer({ costObjective: v as any })}
                        options={[
                            { value: 'DISTANCE', label: 'Minimize Distance' },
                            { value: 'TIME',     label: 'Minimize Time' },
                            { value: 'BALANCED', label: 'Balanced (recommended)' }
                        ]}
                    />
                </SettingRow>
            </SubSection>
        </div>
    );
};

// ─── Market Pane ──────────────────────────────────────────────────────────────

const MarketPane: React.FC<any> = ({ settings, setMarket, disabled }) => {
    const m = settings.modules.market;
    return (
        <div>
            <SectionTitle icon={Radar} title="Market Scanner" description="Lead discovery limits and behavior" gradient="from-cyan-500 via-purple-500 to-pink-500" />

            <SubSection title="Search Behavior">
                <SettingRow label="Minimum Zoom Level" description="Below this zoom, scanning is disabled (avoids huge results).">
                    <NumberInput value={m.minZoomLevel} onChange={v => setMarket({ minZoomLevel: v })} min={6} max={18} />
                </SettingRow>
                <SettingRow label="Search Timeout" description="Max wait per Overpass mirror before failover.">
                    <NumberInput value={m.searchTimeoutSeconds} onChange={v => setMarket({ searchTimeoutSeconds: v })} min={5} max={180} suffix="s" />
                </SettingRow>
                <SettingRow label="Deep Scan" description="Wider tag/regex coverage; slower but catches Arabic transliterations.">
                    <Toggle checked={m.enableDeepScan} onChange={v => setMarket({ enableDeepScan: v })} disabled={disabled} />
                </SettingRow>
                <SettingRow label="Default Keywords" description="Comma-separated search seeds for the scanner.">
                    <TextField value={m.defaultKeywords} onChange={v => setMarket({ defaultKeywords: v })} placeholder="grocery,supermarket,pharmacy" width="w-72" />
                </SettingRow>
            </SubSection>

            <SubSection title="Result Limits">
                <SettingRow label="Max Leads per Scan" description="Plan caps may further restrict this; this is the soft client cap.">
                    <NumberInput value={m.maxLeadsPerScan} onChange={v => setMarket({ maxLeadsPerScan: v })} min={10} max={5000} />
                </SettingRow>
                <SettingRow label="Export Format" description="Default format for the 'Export All' button.">
                    <SelectField value={m.exportFormat} onChange={v => setMarket({ exportFormat: v as any })} options={[{ value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }]} />
                </SettingRow>
            </SubSection>
        </div>
    );
};

// ─── Map Pane ─────────────────────────────────────────────────────────────────

const MapPane: React.FC<any> = ({ settings, setMap, disabled }) => {
    const m = settings.modules.map;
    return (
        <div>
            <SectionTitle icon={MapIcon} title="Map & Visualization" description="Default map state and overlays" gradient="from-blue-500 to-cyan-500" />

            <SubSection title="Default View">
                <SettingRow label="Default Latitude" description="Center of the map on first load.">
                    <NumberInput value={m.defaultCenter[0]} onChange={v => setMap({ defaultCenter: [v, m.defaultCenter[1]] as [number, number] })} step={0.0001} width="w-32" />
                </SettingRow>
                <SettingRow label="Default Longitude" description="Center of the map on first load.">
                    <NumberInput value={m.defaultCenter[1]} onChange={v => setMap({ defaultCenter: [m.defaultCenter[0], v] as [number, number] })} step={0.0001} width="w-32" />
                </SettingRow>
                <SettingRow label="Default Zoom" description="Initial zoom level (1 = world, 18 = building).">
                    <NumberInput value={m.defaultZoom} onChange={v => setMap({ defaultZoom: v })} min={1} max={18} />
                </SettingRow>
                <SettingRow label="Map Style" description="Base layer style; Dark works best with the modern UI.">
                    <SelectField value={m.defaultMapStyle} onChange={v => setMap({ defaultMapStyle: v as any })} options={[
                        { value: 'STREETS',   label: 'Streets' },
                        { value: 'SATELLITE', label: 'Satellite' },
                        { value: 'DARK',      label: 'Dark' }
                    ]} />
                </SettingRow>
            </SubSection>

            <SubSection title="Overlays & Behavior">
                <SettingRow label="Show Traffic Layer">
                    <Toggle checked={m.showTraffic} onChange={v => setMap({ showTraffic: v })} disabled={disabled} />
                </SettingRow>
                <SettingRow label="Cluster Markers" description="Group nearby pins at low zoom for performance.">
                    <Toggle checked={m.clusterMarkers} onChange={v => setMap({ clusterMarkers: v })} disabled={disabled} />
                </SettingRow>
                <SettingRow label="Show Unassigned Customers" description="Display customers without a route on Route Sequence.">
                    <Toggle checked={m.showUnassignedCustomers} onChange={v => setMap({ showUnassignedCustomers: v })} disabled={disabled} />
                </SettingRow>
                <SettingRow label="Heatmap Intensity" description="0 = off, 1 = full saturation.">
                    <NumberInput value={m.heatmapIntensity} onChange={v => setMap({ heatmapIntensity: v })} min={0} max={1} step={0.05} />
                </SettingRow>
            </SubSection>
        </div>
    );
};

// ─── License Pane (SysAdmin only) ─────────────────────────────────────────────

const LicensePane: React.FC<any> = ({ company, meta, setMeta, settings, setSubscription }) => (
    <div>
        <SectionTitle icon={Crown} title="License & Limits" description="Plan, capacity caps, expiry, and discounts" gradient="from-yellow-500 to-amber-600" />

        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
                <div className="text-sm font-black text-amber-300">SysAdmin-only controls</div>
                <p className="text-[11px] text-amber-200/70 mt-0.5">Changes here affect what the company can do — be careful.</p>
            </div>
        </div>

        <SubSection title="Plan & Status">
            <SettingRow label="Subscription Tier">
                <SelectField value={meta.subscriptionTier} onChange={v => setMeta(m => ({ ...m, subscriptionTier: v as any }))} options={[
                    { value: 'STARTER',      label: 'Starter' },
                    { value: 'PROFESSIONAL', label: 'Professional' },
                    { value: 'ENTERPRISE',   label: 'Enterprise' }
                ]} />
            </SettingRow>
            <SettingRow label="Subscription Status">
                <SelectField value={meta.subscriptionStatus} onChange={v => setMeta(m => ({ ...m, subscriptionStatus: v as any }))} options={[
                    { value: 'ACTIVE',  label: 'Active' },
                    { value: 'TRIAL',   label: 'Trial' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'EXPIRED', label: 'Expired' }
                ]} />
            </SettingRow>
            <SettingRow label="Expiration Date" description="Leave blank for no expiration.">
                <input
                    type="date"
                    value={meta.expirationDate ? meta.expirationDate.split('T')[0] : ''}
                    onChange={e => setMeta(m => ({ ...m, expirationDate: e.target.value }))}
                    className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-sm outline-none focus:border-cyan-500"
                />
            </SettingRow>
        </SubSection>

        <SubSection title="Capacity Limits">
            <SettingRow label="Max Users" description="User account seats.">
                <NumberInput value={meta.maxUsers} onChange={v => setMeta(m => ({ ...m, maxUsers: v }))} min={1} max={1000} />
            </SettingRow>
            <SettingRow label="Max Routes" description="Optional cap on routes (0 = unlimited).">
                <NumberInput value={meta.maxRoutes} onChange={v => setMeta(m => ({ ...m, maxRoutes: v }))} min={0} max={10000} />
            </SettingRow>
            <SettingRow label="Max Customers" description="Optional cap on customer records (0 = unlimited).">
                <NumberInput value={meta.maxCustomers} onChange={v => setMeta(m => ({ ...m, maxCustomers: v }))} min={0} max={1000000} />
            </SettingRow>
            <SettingRow label="Max Scanner Cap" description="Per-scan lead limit for Market Scanner.">
                <NumberInput value={meta.maxScannerCap} onChange={v => setMeta(m => ({ ...m, maxScannerCap: v }))} min={50} max={10000} />
            </SettingRow>
        </SubSection>

        <SubSection title="Discounts & Promo">
            <SettingRow label="SysAdmin Discount %" description="Manual discount applied for special deals.">
                <NumberInput value={settings.subscription?.sysAdminDiscountPercent || 0} onChange={v => setSubscription({ sysAdminDiscountPercent: v })} min={0} max={100} suffix="%" />
            </SettingRow>
            <SettingRow label="Promo Code" description="Affiliate or marketing code attached to this company.">
                <TextField value={settings.subscription?.promoCode || ''} onChange={v => setSubscription({ promoCode: v })} placeholder="REACH-2026" width="w-44" />
            </SettingRow>
            <SettingRow label="Promo Discount %" description="Discount tied to the promo code.">
                <NumberInput value={settings.subscription?.promoDiscountPercent || 0} onChange={v => setSubscription({ promoDiscountPercent: v })} min={0} max={100} suffix="%" />
            </SettingRow>
            <SettingRow label="Last Payment Reference" description="Manual payment ref / invoice number.">
                <TextField value={settings.subscription?.lastPaymentRef || ''} onChange={v => setSubscription({ lastPaymentRef: v })} placeholder="INV-12345" width="w-44" />
            </SettingRow>
            <SettingRow label="Verified Payment">
                <Toggle checked={!!settings.subscription?.isVerified} onChange={v => setSubscription({ isVerified: v })} />
            </SettingRow>
        </SubSection>
    </div>
);

// ─── Danger Pane (SysAdmin only) ──────────────────────────────────────────────

const DangerPane: React.FC<any> = ({ company, meta, setMeta, onResetSettings }) => (
    <div>
        <SectionTitle icon={ShieldAlert} title="Danger Zone" description="Destructive operations — proceed carefully" gradient="from-red-500 to-rose-700" />

        <div className="space-y-3">
            <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/30">
                <div className="flex items-start gap-3 mb-3">
                    <RotateCcw className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-rose-200">Reset all settings to defaults</h4>
                        <p className="text-[11px] text-rose-200/60 mt-1">Reverts every module config to factory defaults. Branches and license info are preserved. The change is staged — click Save to commit.</p>
                    </div>
                </div>
                <button
                    onClick={onResetSettings}
                    className="px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 text-[11px] font-black uppercase tracking-widest"
                >
                    Reset Settings
                </button>
            </div>

            <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/30">
                <div className="flex items-start gap-3 mb-3">
                    <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-rose-200">{meta.isActive ? 'Deactivate company' : 'Reactivate company'}</h4>
                        <p className="text-[11px] text-rose-200/60 mt-1">
                            {meta.isActive
                                ? 'Sign out all users and prevent new logins. The data is preserved.'
                                : 'Allow users to log in again. Existing data is unchanged.'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setMeta(m => ({ ...m, isActive: !m.isActive }))}
                    className={`px-4 py-2 rounded-lg border text-[11px] font-black uppercase tracking-widest ${
                        meta.isActive
                            ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-200'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-200'
                    }`}
                >
                    {meta.isActive ? 'Deactivate Company' : 'Reactivate Company'}
                </button>
            </div>
        </div>
    </div>
);

export default CompanySettingsV2;
