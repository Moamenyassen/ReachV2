import React, { useState } from 'react';
import Papa from 'papaparse';
import {
    UserRole, Company, CompanySettings, BranchConfig, NormalizedBranch, NormalizedRoute
} from '../types';
import {
    X, Settings, Palette, Zap, Gauge, Map as MapIcon,
    Save, CheckCircle2, Sliders, DollarSign, Workflow, Bell,
    Globe, LayoutGrid, Search, TrendingUp, Truck, ShieldCheck, Crown, Info, MapPin, Plus, Trash2,
    ChevronRight, AlertCircle, Building2, Download, Radar
} from 'lucide-react';
import { updateCompany, detectAndAddBranches, getBranches, upsertBranch, deleteBranch } from '../services/supabase';
import { DEFAULT_COMPANY_SETTINGS, COUNTRIES_DATA } from '../config/constants';
import CompanyBrandingSettings from './CompanyBrandingSettings';

interface CompanySettingsModalProps {
    company: Company;
    onClose: () => void;
}

// --- Utility Display Components ---

const Tooltip = ({ text }: { text: string }) => (
    <div className="group relative flex items-center ml-1.5">
        <Info className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-400 cursor-help transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-slate-200 text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10 font-medium tracking-wide min-w-[150px] text-center">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
    </div>
);

const SectionHeader = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="mb-8 p-6 bg-gradient-to-r from-indigo-900/20 to-transparent border-b border-white/5 -mx-10 -mt-10 pt-10 px-10">
        <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <Icon className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-2xl font-black text-white tracking-tight">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm pl-[52px] max-w-2xl">{description}</p>
    </div>
);

const SettingCard = ({ children, title, icon: Icon, className = "" }: { children: React.ReactNode, title?: string, icon?: any, className?: string }) => (
    <div className={`bg-white/[0.03] shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-2xl p-6 ${className}`}>
        {title && (
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-white/5 pb-3">
                {Icon && <Icon className="w-4 h-4 text-indigo-500" />}
                {title}
            </h4>
        )}
        {children}
    </div>
);

// --- Form Components ---

const FeatureToggle = ({ label, desc, checked, onChange, disabled = false }: { label: string, desc: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean }) => (
    <div className={`flex items-center justify-between p-4 bg-white/[0.04] shadow-lg rounded-xl transition-all ${!disabled && 'hover:bg-white/[0.08] hover:shadow-indigo-500/10'} group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <div>
            <div className={`text-sm font-bold transition-colors ${checked ? 'text-white' : 'text-slate-400'} ${!disabled && 'group-hover:text-indigo-300'}`}>{label}</div>
            {desc && <div className="text-[11px] text-slate-500 leading-tight mt-1 group-hover:text-slate-400 transition-colors">{desc}</div>}
        </div>
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`w-11 h-6 rounded-full transition-all relative focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${checked ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-700 shadow-inner'}`}
            title={`Toggle ${label}`}
            aria-label={`Toggle ${label}`}
        >
            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-md ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
);

const RangeInput = ({ label, value, min, max, step = 1, onChange, unit = '', tooltip }: any) => (
    <div className="bg-black/20 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
        <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
                <label
                    htmlFor={`range-${label.replace(/\s+/g, '-').toLowerCase()}`}
                    className="text-xs font-bold text-slate-400 uppercase tracking-wide"
                >
                    {label}
                </label>
                {tooltip && <Tooltip text={tooltip} />}
            </div>
            <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{value}{unit}</span>
        </div>
        <input
            id={`range-${label.replace(/\s+/g, '-').toLowerCase()}`}
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-0 shadow-inner"
            title={label}
            aria-label={label}
        />
        <div className="flex justify-between mt-2 text-[10px] text-slate-600 font-mono">
            <span>{min}{unit}</span>
            <span>{max}{unit}</span>
        </div>
    </div>
);

const SelectInput = ({ label, value, options, onChange, tooltip }: any) => (
    <div className="space-y-2">
        <div className="flex items-center">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</label>
            {tooltip && <Tooltip text={tooltip} />}
        </div>
        <div className="relative">
            <select
                id={label.replace(/\s+/g, '-').toLowerCase()}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-indigo-500 transition-colors text-sm appearance-none cursor-pointer hover:bg-black/50 shadow-inner"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                title={label}
                aria-label={label}
            >
                {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
        </div>
    </div>
);

const TextInput = ({ label, value, onChange, placeholder, type = "text", tooltip, subtext }: any) => (
    <div className="space-y-2">
        <div className="flex items-center">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</label>
            {tooltip && <Tooltip text={tooltip} />}
        </div>
        <input
            id={label.replace(/\s+/g, '-').toLowerCase()}
            type={type}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-indigo-500 focus:bg-black/60 transition-colors text-sm placeholder:text-slate-600 shadow-inner"
            value={value}
            onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
            placeholder={placeholder}
            title={label}
            aria-label={label}
        />
        {subtext && <div className="text-[10px] text-slate-500">{subtext}</div>}
    </div>
);


const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({ company, onClose }) => {
    // Single source of truth for navigation
    const [activeTab, setActiveTab] = useState<'global' | 'locations' | 'subscription' | 'optimizer' | 'insights' | 'market' | 'map' | 'themes'>('global');

    // Initialize settings from received company data or defaults
    const [settings, setSettings] = useState<CompanySettings>(() => {
        const def = JSON.parse(JSON.stringify(DEFAULT_COMPANY_SETTINGS));
        if (company.settings && (company.settings as any).common) {
            const c = company.settings;
            return {
                common: { ...def.common, ...c.common },
                modules: {
                    insights: { ...def.modules.insights, ...c.modules?.insights },
                    market: { ...def.modules.market, ...c.modules?.market },
                    optimizer: { ...def.modules.optimizer, ...c.modules?.optimizer },
                    map: { ...def.modules.map, ...c.modules?.map },
                    scannerV2: { ...def.modules.scannerV2, ...c.modules?.scannerV2 }
                }
            };
        }
        return def;
    });

    // --- State for Branch Management ---
    const [editingBranch, setEditingBranch] = useState<BranchConfig | null>(null);
    const [tempBranch, setTempBranch] = useState<Partial<BranchConfig>>({});
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [dbBranches, setDbBranches] = useState<NormalizedBranch[]>([]);
    const [isLoadingDbBranches, setIsLoadingDbBranches] = useState(false);
    const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
    const [coordString, setCoordString] = useState("");

    // --- Effects ---

    // Fetch DB Branches when locations tab is opened
    React.useEffect(() => {
        if (activeTab === 'locations' && company.id) {
            loadDbBranches();
        }
    }, [activeTab, company.id]);

    const loadDbBranches = async () => {
        setIsLoadingDbBranches(true);
        try {
            const branches = await getBranches(company.id);
            setDbBranches(branches);
        } catch (error) {
            console.error("Failed to load DB branches:", error);
        } finally {
            setIsLoadingDbBranches(false);
        }
    };

    // --- Handlers ---

    const updateCommon = (section: 'general' | 'theme', key: string, val: any) => {
        setSettings(prev => ({ ...prev, common: { ...prev.common, [section]: { ...prev.common[section], [key]: val } } }));
    };

    const updateModule = (mod: keyof CompanySettings['modules'], key: string, val: any) => {
        setSettings(prev => ({ ...prev, modules: { ...prev.modules, [mod]: { ...prev.modules[mod], [key]: val } } }));
    };

    const handleCoordStringChange = (val: string) => {
        setCoordString(val);
        // Try to parse "lat, lng"
        const parts = val.split(',').map(p => p.trim());
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
                setTempBranch(prev => ({
                    ...prev,
                    coordinates: { lat, lng }
                }));
            }
        }
    };

    // Sync coordString when showBranchModal or tempBranch.coordinates change
    React.useEffect(() => {
        if (showBranchModal) {
            const lat = tempBranch.coordinates?.lat;
            const lng = tempBranch.coordinates?.lng;
            const hasCoords = lat !== undefined && lng !== undefined;
            if (hasCoords) {
                const newStr = `${lat}, ${lng}`;
                const parts = coordString.split(',').map(p => p.trim());
                const pLat = parseFloat(parts[0]);
                const pLng = parseFloat(parts[1]);
                if (pLat !== lat || pLng !== lng) {
                    setCoordString(newStr);
                }
            } else {
                setCoordString("");
            }
        }
    }, [showBranchModal, tempBranch.coordinates?.lat, tempBranch.coordinates?.lng]);

    const handleSaveBranch = async () => {
        if (!tempBranch.name) return;
        setIsSaving(true);
        try {
            const branchToSave: Partial<NormalizedBranch> = {
                id: editingBranch?.id,
                name_en: tempBranch.name,
                name_ar: tempBranch.nameAr || '',
                code: tempBranch.code || tempBranch.name?.toUpperCase().replace(/\s+/g, '_'),
                company_id: company.id,
                is_active: tempBranch.isActive !== false,
                lat: tempBranch.coordinates?.lat,
                lng: tempBranch.coordinates?.lng
            };

            const savedBranch = await upsertBranch(branchToSave);

            // Re-load DB branches
            await loadDbBranches();

            // Update JSON settings for legacy support
            const currentBranches = settings.common.general.branches || [];
            let updatedBranches;
            const newBranchConfig: BranchConfig = {
                id: savedBranch.id,
                name: savedBranch.name_en,
                nameAr: savedBranch.name_ar || undefined,
                code: savedBranch.code,
                coordinates: savedBranch.lat && savedBranch.lng ? { lat: savedBranch.lat, lng: savedBranch.lng } : undefined,
                address: tempBranch.address,
                isActive: savedBranch.is_active
            };

            if (editingBranch?.id) {
                updatedBranches = currentBranches.map(b => b.id === editingBranch.id ? newBranchConfig : b);
            } else {
                updatedBranches = [...currentBranches, newBranchConfig];
            }

            const legacyList = updatedBranches.filter(b => b.isActive).map(b => b.name);
            setSettings(prev => ({
                ...prev,
                common: {
                    ...prev.common,
                    general: {
                        ...prev.common.general,
                        branches: updatedBranches,
                        allowedBranches: legacyList
                    }
                }
            }));

            setShowBranchModal(false);
            setEditingBranch(null);
            setTempBranch({});
        } catch (error: any) {
            alert("Failed to save branch: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBranch = async (id: string) => {
        if (!confirm('Are you sure you want to delete this location?')) return;

        setIsSaving(true);
        try {
            await deleteBranch(id);
            const updatedBranches = (settings.common.general.branches || []).filter(b => b.id !== id);
            const legacyList = updatedBranches.filter(b => b.isActive).map(b => b.name);

            const newSettings = {
                ...settings,
                common: {
                    ...settings.common,
                    general: {
                        ...settings.common.general,
                        branches: updatedBranches,
                        allowedBranches: legacyList
                    }
                }
            };
            setSettings(newSettings);
            await updateCompany(company.id, { ...company, settings: newSettings });
            setSelectedBranchIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            await loadDbBranches();
        } catch (error: any) {
            console.error("Failed to delete branch:", error);
            alert(`Failed to delete: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedBranchIds.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedBranchIds.size} selected locations?`)) return;

        setIsSaving(true);
        try {
            const idsToDelete = Array.from(selectedBranchIds);
            for (const id of idsToDelete) {
                await deleteBranch(id);
            }

            const updatedBranches = (settings.common.general.branches || []).filter(b => !selectedBranchIds.has(b.id));
            const legacyList = updatedBranches.filter(b => b.isActive).map(b => b.name);

            const newSettings = {
                ...settings,
                common: {
                    ...settings.common,
                    general: {
                        ...settings.common.general,
                        branches: updatedBranches,
                        allowedBranches: legacyList
                    }
                }
            };

            setSettings(newSettings);
            await updateCompany(company.id, { ...company, settings: newSettings });
            setSelectedBranchIds(new Set());
            await loadDbBranches();
            alert(`Successfully deleted ${idsToDelete.length} locations.`);
        } catch (error: any) {
            console.error("Failed to delete selected branches:", error);
            alert(`Batch delete failed: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleBranchSelection = (id: string) => {
        setSelectedBranchIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const filtered = dbBranches.filter(b => !searchQuery || b.name_en.toLowerCase().includes(searchQuery.toLowerCase()) || b.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()));
        if (selectedBranchIds.size === filtered.length && filtered.length > 0) {
            setSelectedBranchIds(new Set());
        } else {
            setSelectedBranchIds(new Set(filtered.map(b => b.id)));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateCompany(company.id, { ...company, settings });
            onClose();
        } catch (e: any) {
            alert("Failed to save settings: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Renderers ---

    const renderSidebarItem = (id: typeof activeTab, label: string, Icon: any) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`w-full p-3 rounded-xl flex items-center justify-between group transition-all duration-200 ${isActive
                    ? 'bg-indigo-600/20 text-indigo-400 shadow-[0_8px_20px_rgba(0,0,0,0.4)] ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    <span className={`text-sm font-bold ${isActive ? 'text-indigo-100' : ''}`}>{label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-[#0f172a] rounded-[2rem] shadow-2xl w-full max-w-7xl h-[90vh] flex overflow-hidden border border-white/10 relative">

                {/* Left Sidebar */}
                <div className="w-72 bg-[#020617]/50 border-r border-white/5 flex flex-col shrink-0 backdrop-blur-md hidden lg:flex">
                    <div className="p-6 pb-2">
                        <h2 className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
                            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-500/30">
                                <Settings className="w-5 h-5 text-white" />
                            </div>
                            Configuration
                        </h2>
                        <p className="text-xs text-slate-500 mt-2 pl-1 leading-relaxed">
                            Manage global parameters, fleet modules, and subscription preferences.
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8">
                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Core Settings</div>
                            <div className="space-y-1">
                                {renderSidebarItem('global', 'Global Settings', Globe)}
                                {renderSidebarItem('locations', 'Locations & Depots', MapPin)}
                                {renderSidebarItem('themes', 'Themes & Branding', Palette)}
                                {renderSidebarItem('subscription', 'Modules & Account', Crown)}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-3">Module Configuration</div>
                            <div className="space-y-1">
                                {renderSidebarItem('optimizer', 'AI Optimizer', Zap)}
                                {renderSidebarItem('insights', 'Insights & KPI', TrendingUp)}
                                {renderSidebarItem('market', 'Market Scanner', Search)}
                                {renderSidebarItem('map', 'Route Sequence', LayoutGrid)}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/5 bg-[#020617]/80">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                        >
                            {isSaving ? <span className="animate-spin text-lg">⏳</span> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                            <span>Save Changes</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation (Visible on screen < lg) */}
                <div className="lg:hidden absolute top-0 left-0 right-0 bg-[#0f172a] z-50 p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 p-1.5 rounded-lg">
                            <Settings className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="font-bold text-white">Settings</h2>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-900/40 active:scale-95 transition-all"
                            title="Save all changes"
                            aria-label="Save all changes"
                        >
                            {isSaving ? '...' : 'Save'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/10 rounded-lg text-white shadow-md hover:bg-white/20 transition-all"
                            title="Close settings"
                            aria-label="Close settings"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Horizontal Scroll Tab Nav for Mobile */}
                <div className="lg:hidden absolute top-[60px] left-0 right-0 z-40 bg-[#0f172a]/95 border-b border-white/10 overflow-x-auto whitespace-nowrap p-2 flex gap-2">
                    {['global', 'locations', 'themes', 'subscription', 'optimizer', 'insights', 'market', 'map'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400'}`}
                            title={`Switch to ${tab.charAt(0).toUpperCase() + tab.slice(1)} tab`}
                            aria-label={`Switch to ${tab.charAt(0).toUpperCase() + tab.slice(1)} tab`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>


                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative bg-gradient-to-br from-[#0f172a] via-[#1e1b4b]/20 to-[#0f172a] lg:pt-0 pt-[110px]">
                    {/* Close Button (Desktop) */}
                    <div className="absolute top-6 right-6 z-20 hidden lg:block">
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white bg-black/20 hover:bg-white/10 border border-white/5 rounded-full transition-all hover:rotate-90"
                            title="Close settings"
                            aria-label="Close settings"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
                        <div className="max-w-5xl mx-auto min-h-full animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* --- GLOBAL SETTINGS --- */}
                            {activeTab === 'global' && (
                                <>
                                    <SectionHeader
                                        icon={Globe}
                                        title="Global Settings"
                                        description="Configure basic localization, currency, and regional preferences for your workspaces."
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <SettingCard title="Localization & Branding" icon={Palette} className="md:col-span-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Language</label>
                                                    <div className="flex bg-black/40 rounded-xl p-1.5 border border-white/5">
                                                        <button onClick={() => updateCommon('general', 'language', 'en')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${settings.common.general.language === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`} title="Set language to English" aria-label="Set language to English">English</button>
                                                        <button onClick={() => updateCommon('general', 'language', 'ar')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${settings.common.general.language === 'ar' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`} title="Set language to Arabic" aria-label="Set language to Arabic">Arabic</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Distance Unit</label>
                                                    <div className="flex bg-black/40 rounded-xl p-1.5 border border-white/5">
                                                        <button onClick={() => updateCommon('general', 'distanceUnit', 'km')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${settings.common.general.distanceUnit === 'km' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`} title="Set distance unit to Kilometers" aria-label="Set distance unit to Kilometers">Kilometers (KM)</button>
                                                        <button onClick={() => updateCommon('general', 'distanceUnit', 'mi')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${settings.common.general.distanceUnit === 'mi' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`} title="Set distance unit to Miles" aria-label="Set distance unit to Miles">Miles</button>
                                                    </div>
                                                </div>
                                                <TextInput
                                                    label="Currency Symbol"
                                                    value={settings.common.general.currency}
                                                    onChange={(e: any) => updateCommon('general', 'currency', e)}
                                                    placeholder="$, €, SAR, etc."
                                                />
                                                <SelectInput
                                                    label="Operating Country"
                                                    value={settings.common.general.country || ''}
                                                    onChange={(val: string) => {
                                                        updateCommon('general', 'country', val);
                                                        // Explicitly reset allowedBranches if country changes to force review
                                                        updateCommon('general', 'allowedBranches', []);
                                                    }}
                                                    options={[
                                                        { value: "", label: "Select Country..." },
                                                        ...Object.keys(COUNTRIES_DATA).map(c => ({ value: c, label: c }))
                                                    ]}
                                                    tooltip="Primary region for geocoding and map constraints."
                                                />
                                            </div>
                                        </SettingCard>
                                    </div>
                                </>
                            )}

                            {/* --- LOCATIONS & DEPOTS (LIST VIEW) --- */}
                            {activeTab === 'locations' && (
                                <>
                                    <SectionHeader
                                        icon={MapPin}
                                        title="Locations & Depots"
                                        description="Manage your physical branch network, warehouses, and starting points for drivers."
                                    />

                                    {/* Stats & Actions Toolbar */}
                                    <div className="flex flex-wrap gap-6 mb-8 items-end justify-between">
                                        <div className="flex-1 min-w-[300px] grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                                                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400"><Building2 className="w-6 h-6" /></div>
                                                <div>
                                                    <div className="text-3xl font-black text-white leading-none">{dbBranches.length}</div>
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total Branches</div>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                                                <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400"><CheckCircle2 className="w-6 h-6" /></div>
                                                <div>
                                                    <div className="text-3xl font-black text-white leading-none">{dbBranches.filter(b => b.is_active).length}</div>
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Active Locations</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
                                            <div className="relative group w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Search branches..."
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 focus:bg-black/60"
                                                    title="Search branches"
                                                    aria-label="Search branches"
                                                />
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    id="branch-upload"
                                                    accept=".csv"
                                                    className="hidden"
                                                    title="Select CSV file to upload branches"
                                                    aria-label="Select CSV file to upload branches"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;

                                                        // Check for likely Excel file by extension
                                                        if (file.name.match(/\.(xlsx|xls)$/i)) {
                                                            alert("Excel (.xlsx/.xls) files are not directly supported yet. Please Save As > CSV (Comma delimited) in Excel and upload the CSV file.");
                                                            return;
                                                        }

                                                        Papa.parse(file, {
                                                            header: true,
                                                            skipEmptyLines: true,
                                                            dynamicTyping: true,
                                                            // Strip UTF-8 BOM and trim whitespace from headers — Excel's "Save as CSV"
                                                            // adds a BOM that would otherwise corrupt the first header name.
                                                            transformHeader: (h: string) => h.replace(/^\uFEFF/, '').trim(),
                                                            complete: (results) => {
                                                                const data = results.data as any[];
                                                                const meta = results.meta;
                                                                const headers = meta.fields || [];

                                                                console.log("Parsed CSV Headers:", headers);
                                                                console.log("Parsed CSV Data (First 3):", data.slice(0, 3));

                                                                const newBranches: BranchConfig[] = [];

                                                                // Helper to find key fuzzily.
                                                                // Iterates keys from most-specific to least-specific, exact match first then partial.
                                                                // This prevents short keys like "region" from grabbing "Region_Code"
                                                                // before "region_description" gets a chance to match "Region_Description".
                                                                const findKey = (possibleKeys: string[]) => {
                                                                    const lowerHeaders = headers.map(h => ({ raw: h, lower: h.toLowerCase().trim() }));
                                                                    // 1) Exact match (case-insensitive)
                                                                    for (const k of possibleKeys) {
                                                                        const kk = k.toLowerCase().trim();
                                                                        const hit = lowerHeaders.find(h => h.lower === kk);
                                                                        if (hit) return hit.raw;
                                                                    }
                                                                    // 2) Substring match — keys earlier in the list win
                                                                    for (const k of possibleKeys) {
                                                                        const kk = k.toLowerCase().trim();
                                                                        const hit = lowerHeaders.find(h => h.lower.includes(kk));
                                                                        if (hit) return hit.raw;
                                                                    }
                                                                    return undefined;
                                                                };

                                                                // Identify mapped column names once.
                                                                // Order matters: check more specific keys before generic ones (e.g. "region_code" before "code").
                                                                const codeKey = findKey(['region_code', 'region code', 'branch_code', 'branch code', 'site_code', 'code', 'id']);
                                                                const nameKey = findKey(['region_description', 'region description', 'branch_name', 'branch name', 'description', 'region', 'name', 'branch', 'label', 'site', 'location name']);
                                                                const latKey = findKey(['latitude', 'lat', 'gps_lat', 'y']);
                                                                const lngKey = findKey(['longitude', 'lng', 'lon', 'long', 'gps_long', 'gps_lng', 'x']);
                                                                const addressKey = findKey(['address', 'street', 'location', 'city']);
                                                                const nameArKey = findKey(['name_ar', 'name ar', 'name (ar)', 'description_ar', 'الاسم', 'اسم الفرع']);

                                                                if (!nameKey || !latKey || !lngKey) {
                                                                    console.warn(`Auto-detect failed. Headers found: ${headers.join(', ')}. Retrying without headers...`);

                                                                    // Retry properly without headers to get raw arrays
                                                                    Papa.parse(file, {
                                                                        header: false,
                                                                        skipEmptyLines: true,
                                                                        dynamicTyping: true,
                                                                        complete: (nestedResults) => {
                                                                            const rawData = nestedResults.data as any[][];
                                                                            if (!rawData || rawData.length === 0) {
                                                                                alert("File appears to be empty.");
                                                                                return;
                                                                            }

                                                                            const confirmMessage = `Could not find standard headers(Name, Lat, Lng).\n\nDetected Headers: ${headers.join(', ') || 'None'} \n\nDo you want to attempt importing assuming: \nColumn 1 = Name\nColumn 2 = Lat\nColumn 3 = Lng ? `;

                                                                            if (confirm(confirmMessage)) {
                                                                                setIsLoadingDbBranches(true);
                                                                                loadDbBranches().then(() => {
                                                                                    const normalizeString = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, ' ').trim();
                                                                                    const currentBranches = [...(settings.common.general.branches || [])];

                                                                                    // Pre-index known branch names for faster/easier matching
                                                                                    const existingNamesMap = new Set(currentBranches.map(b => normalizeString(b.name)));
                                                                                    const dbNamesMap = new Set(dbBranches.map(b => normalizeString(b.name_en)));

                                                                                    let addedCount = 0;
                                                                                    let updatedCount = 0;

                                                                                    rawData.forEach((row, rowIndex) => {
                                                                                        // Skip potential header row if it looks like strings
                                                                                        if (rowIndex === 0 && typeof row[1] === 'string' && isNaN(parseFloat(row[1]))) return;

                                                                                        const name = row[0];
                                                                                        const lat = parseFloat(row[1]);
                                                                                        const lng = parseFloat(row[2]);

                                                                                        if (name) {
                                                                                            const normalizedName = String(name).trim();
                                                                                            const searchKey = normalizeString(normalizedName);

                                                                                            const existingIdx = currentBranches.findIndex(b =>
                                                                                                normalizeString(b.name) === searchKey
                                                                                            );

                                                                                            if (existingIdx > -1) {
                                                                                                const existing = currentBranches[existingIdx];
                                                                                                const updated = { ...existing };
                                                                                                if (!isNaN(lat) && !isNaN(lng)) {
                                                                                                    updated.coordinates = { lat, lng };
                                                                                                }
                                                                                                currentBranches[existingIdx] = updated;
                                                                                                updatedCount++;
                                                                                            } else if (!dbNamesMap.has(searchKey)) {
                                                                                                // Only add if it doesn't exist in DB either
                                                                                                currentBranches.push({
                                                                                                    id: crypto.randomUUID(),
                                                                                                    name: normalizedName,
                                                                                                    coordinates: (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : undefined,
                                                                                                    address: '',
                                                                                                    isActive: true
                                                                                                });
                                                                                                addedCount++;
                                                                                                existingNamesMap.add(searchKey);
                                                                                            }
                                                                                        }
                                                                                    });

                                                                                    if (addedCount > 0 || updatedCount > 0) {
                                                                                        if (confirm(`Fallback Mode: ${addedCount} new, ${updatedCount} updated. Save?`)) {
                                                                                            const updatedBranches = [...currentBranches];
                                                                                            const legacyList = updatedBranches.filter(b => b.isActive).map(b => b.name);

                                                                                            const newSettings = {
                                                                                                ...settings,
                                                                                                common: {
                                                                                                    ...settings.common,
                                                                                                    general: {
                                                                                                        ...settings.common.general,
                                                                                                        branches: updatedBranches,
                                                                                                        allowedBranches: legacyList
                                                                                                    }
                                                                                                }
                                                                                            };

                                                                                            setSettings(newSettings);
                                                                                            updateCompany(company.id, { ...company, settings: newSettings })
                                                                                                .then(async () => {
                                                                                                    try {
                                                                                                        for (const b of updatedBranches) {
                                                                                                            await upsertBranch({
                                                                                                                id: b.id,
                                                                                                                name_en: b.name,
                                                                                                                code: b.id,
                                                                                                                company_id: company.id,
                                                                                                                is_active: b.isActive,
                                                                                                                lat: b.coordinates?.lat,
                                                                                                                lng: b.coordinates?.lng
                                                                                                            });
                                                                                                        }
                                                                                                        await loadDbBranches();
                                                                                                        alert(`Successfully saved ${updatedBranches.length} branches (Fallback Mode).`);
                                                                                                    } catch (err: any) {
                                                                                                        alert(`Settings saved, but DB sync failed: ${err.message}`);
                                                                                                    }
                                                                                                })
                                                                                                .catch(err => alert(`Failed to save: ${err.message} `))
                                                                                                .finally(() => setIsSaving(false));
                                                                                        }
                                                                                    } else {
                                                                                        alert('No valid branches extracted in fallback mode.');
                                                                                    }
                                                                                });
                                                                            }
                                                                        }
                                                                    });
                                                                    return;
                                                                }
                                                                setIsLoadingDbBranches(true);
                                                                loadDbBranches().then(() => {
                                                                    const normalizeString = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, ' ').trim();
                                                                    const currentBranches = [...(settings.common.general.branches || [])];

                                                                    // Build name-and-code lookup over BOTH the settings list and DB-only branches
                                                                    // so a row matching a DB branch (but not yet in settings) gets pulled in
                                                                    // and updated — instead of being silently skipped.
                                                                    const dbByName = new Map<string, typeof dbBranches[number]>();
                                                                    const dbByCode = new Map<string, typeof dbBranches[number]>();
                                                                    dbBranches.forEach(b => {
                                                                        if (b.name_en) dbByName.set(normalizeString(b.name_en), b);
                                                                        if (b.code) dbByCode.set(String(b.code).trim(), b);
                                                                    });

                                                                    let addedCount = 0;
                                                                    let updatedCount = 0;

                                                                    data.forEach((row: any) => {
                                                                        const name = row[nameKey];
                                                                        const lat = parseFloat(row[latKey]);
                                                                        const lng = parseFloat(row[lngKey]);
                                                                        const address = addressKey ? String(row[addressKey] || '').trim() : '';
                                                                        const code = codeKey ? String(row[codeKey] || '').trim() : '';
                                                                        const nameAr = nameArKey ? String(row[nameArKey] || '').trim() : '';

                                                                        if (!name && !code) return;

                                                                        const normalizedName = name ? String(name).trim() : '';
                                                                        const searchKey = normalizedName ? normalizeString(normalizedName) : '';

                                                                        // 1) Match against current settings list
                                                                        const existingIdx = currentBranches.findIndex(b =>
                                                                            (code && (String(b.code || '') === code || String(b.id) === code)) ||
                                                                            (searchKey && normalizeString(b.name) === searchKey)
                                                                        );

                                                                        if (existingIdx > -1) {
                                                                            const existing = currentBranches[existingIdx];
                                                                            const updated = { ...existing };
                                                                            if (!isNaN(lat) && !isNaN(lng)) updated.coordinates = { lat, lng };
                                                                            if (address && (!existing.address || existing.address.trim() === '')) updated.address = address;
                                                                            if (nameAr && !existing.nameAr) updated.nameAr = nameAr;
                                                                            if (code && !existing.code) updated.code = code;
                                                                            currentBranches[existingIdx] = updated;
                                                                            updatedCount++;
                                                                            return;
                                                                        }

                                                                        // 2) Match against DB-only branches → pull into settings using the DB record's id
                                                                        const dbHit = (code && dbByCode.get(code)) || (searchKey && dbByName.get(searchKey)) || null;
                                                                        if (dbHit) {
                                                                            currentBranches.push({
                                                                                id: dbHit.id,
                                                                                name: normalizedName || dbHit.name_en,
                                                                                nameAr: nameAr || dbHit.name_ar || '',
                                                                                code: code || dbHit.code || '',
                                                                                coordinates: (!isNaN(lat) && !isNaN(lng))
                                                                                    ? { lat, lng }
                                                                                    : (dbHit.lat != null && dbHit.lng != null ? { lat: dbHit.lat, lng: dbHit.lng } : undefined),
                                                                                address: address,
                                                                                isActive: dbHit.is_active !== false
                                                                            });
                                                                            updatedCount++;
                                                                            return;
                                                                        }

                                                                        // 3) Brand new branch — add it
                                                                        if (normalizedName) {
                                                                            currentBranches.push({
                                                                                id: crypto.randomUUID(),
                                                                                name: normalizedName,
                                                                                nameAr: nameAr,
                                                                                code: code,
                                                                                coordinates: (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : undefined,
                                                                                address: address,
                                                                                isActive: true
                                                                            });
                                                                            addedCount++;
                                                                        }
                                                                    });

                                                                    if (addedCount > 0 || updatedCount > 0) {
                                                                        if (confirm(`CSV processed: ${addedCount} new, ${updatedCount} updated. Save changes?`)) {
                                                                            const updatedBranches = [...currentBranches];
                                                                            const legacyList = updatedBranches.filter(b => b.isActive).map(b => b.name);

                                                                            const newSettings = {
                                                                                ...settings,
                                                                                common: {
                                                                                    ...settings.common,
                                                                                    general: {
                                                                                        ...settings.common.general,
                                                                                        branches: updatedBranches,
                                                                                        allowedBranches: legacyList
                                                                                    }
                                                                                }
                                                                            };

                                                                            setSettings(newSettings);
                                                                            setIsSaving(true);
                                                                            updateCompany(company.id, { ...company, settings: newSettings })
                                                                                .then(async () => {
                                                                                    try {
                                                                                        for (const b of updatedBranches) {
                                                                                            await upsertBranch({
                                                                                                id: b.id,
                                                                                                name_en: b.name,
                                                                                                name_ar: b.nameAr || '',
                                                                                                code: b.code || b.id,
                                                                                                company_id: company.id,
                                                                                                is_active: b.isActive,
                                                                                                lat: b.coordinates?.lat,
                                                                                                lng: b.coordinates?.lng
                                                                                            });
                                                                                        }
                                                                                        await loadDbBranches();
                                                                                        alert(`Successfully synchronized ${updatedBranches.length} branches to database.`);
                                                                                    } catch (err: any) {
                                                                                        console.error("Sync to DB failed:", err);
                                                                                        alert(`Settings saved, but DB sync failed: ${err.message}`);
                                                                                    }
                                                                                })
                                                                                .catch(err => alert(`Failed to save settings: ${err.message}`))
                                                                                .finally(() => setIsSaving(false));
                                                                        }
                                                                    } else {
                                                                        alert('No valid branches found in the file.');
                                                                    }
                                                                });

                                                                e.target.value = '';
                                                            },
                                                            error: (err: any) => {
                                                                console.error("Papa Parse Error:", err);
                                                                alert("Failed to parse CSV file.");
                                                            }
                                                        });
                                                    }}
                                                />
                                                <button
                                                    onClick={() => document.getElementById('branch-upload')?.click()}
                                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold flex items-center justify-center gap-2 border border-white/10 transition-all hover:border-white/20"
                                                    title="Upload branches from CSV"
                                                    aria-label="Upload branches from CSV"
                                                >
                                                    <Download className="w-5 h-5 rotate-180" /> Upload List
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingBranch(null);
                                                    setTempBranch({});
                                                    setShowBranchModal(true);
                                                }}
                                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-95 transition-all whitespace-nowrap"
                                                title="Add a new branch"
                                                aria-label="Add a new branch"
                                            >
                                                <Plus className="w-5 h-5" /> Add Branch
                                            </button>
                                        </div>
                                    </div>

                                    {/* Location List View */}
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                                        {/* Table Header */}
                                        <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-white/[0.02] text-xs font-bold text-slate-500 uppercase tracking-wider items-center">
                                            <div className="col-span-4 md:col-span-3 pl-2 flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer"
                                                    checked={dbBranches.length > 0 && selectedBranchIds.size === dbBranches.filter(b => !searchQuery || b.name_en.toLowerCase().includes(searchQuery.toLowerCase())).length}
                                                    onChange={toggleSelectAll}
                                                    title="Select all"
                                                    aria-label="Select all"
                                                />
                                                Branch Name
                                            </div>
                                            <div className="col-span-2 hidden md:block">Status</div>
                                            <div className="col-span-4 md:col-span-3">Coordinates</div>
                                            <div className="col-span-4 md:col-span-3 hidden sm:block">Address</div>
                                            <div className="col-span-4 sm:col-span-2 md:col-span-1 text-right pr-2">
                                                {selectedBranchIds.size > 0 ? (
                                                    <button
                                                        onClick={handleDeleteSelected}
                                                        className="text-rose-500 hover:text-rose-400 flex items-center justify-end gap-1 transition-colors"
                                                        title="Delete selected"
                                                    >
                                                        <Trash2 className="w-4 h-4" /> ({selectedBranchIds.size})
                                                    </button>
                                                ) : (
                                                    'Actions'
                                                )}
                                            </div>
                                        </div>

                                        {/* List Items */}
                                        <div className="divide-y divide-white/5">
                                            {isLoadingDbBranches ? (
                                                <div className="p-10 text-center text-slate-500 text-sm">Loading branches...</div>
                                            ) : dbBranches
                                                .filter(b => !searchQuery || b.name_en.toLowerCase().includes(searchQuery.toLowerCase()) || b.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .map((branch) => (
                                                    <div key={branch.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors group ${selectedBranchIds.has(branch.id) ? 'bg-indigo-500/10' : 'hover:bg-white/[0.04]'}`}>
                                                        {/* Name */}
                                                        <div className="col-span-4 md:col-span-3 pl-2 flex items-center gap-3 overflow-hidden">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-all cursor-pointer"
                                                                checked={selectedBranchIds.has(branch.id)}
                                                                onChange={() => toggleBranchSelection(branch.id)}
                                                                title={`Select ${branch.name_en}`}
                                                                aria-label={`Select ${branch.name_en}`}
                                                            />
                                                            <div className={`w-2 h-2 rounded-full shrink-0 ${branch.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
                                                            <div className="truncate font-bold text-white text-sm" title={branch.name_en}>{branch.name_en}{branch.name_ar ? ` (${branch.name_ar})` : ''}</div>
                                                        </div>

                                                        {/* Status (Hidden on small mobile) */}
                                                        <div className="col-span-2 hidden md:flex items-center">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded border ${branch.is_active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 border-white/5 text-slate-500'}`}>
                                                                {branch.is_active ? 'OPERIAL' : 'INACTIVE'}
                                                            </span>
                                                        </div>

                                                        {/* Coordinates */}
                                                        <div className="col-span-4 md:col-span-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                                                            {branch.lat && branch.lng ? (
                                                                <>
                                                                    <span className="bg-black/30 px-1.5 py-0.5 rounded text-indigo-300">{branch.lat.toFixed(4)}</span>
                                                                    <span className="text-slate-600">,</span>
                                                                    <span className="bg-black/30 px-1.5 py-0.5 rounded text-indigo-300">{branch.lng.toFixed(4)}</span>
                                                                </>
                                                            ) : (
                                                                <span className="opacity-50 italic">--</span>
                                                            )}
                                                        </div>

                                                        {/* Address (Hidden on mobile) */}
                                                        <div className="col-span-4 md:col-span-3 hidden sm:flex text-xs text-slate-500 truncate" title={branch.code}>
                                                            <span className="opacity-50 tracking-wider">CODE: </span>{branch.code}
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="col-span-4 sm:col-span-2 md:col-span-1 flex justify-end gap-1 pr-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingBranch(branch as any);
                                                                    setTempBranch({
                                                                        name: branch.name_en,
                                                                        nameAr: branch.name_ar,
                                                                        code: branch.code,
                                                                        isActive: branch.is_active,
                                                                        coordinates: branch.lat && branch.lng ? { lat: branch.lat, lng: branch.lng } : undefined,
                                                                        id: branch.id
                                                                    });
                                                                    setShowBranchModal(true);
                                                                }}
                                                                className="p-1.5 hover:bg-indigo-500/20 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                                                                title="Edit Branch"
                                                                aria-label="Edit Branch"
                                                            >
                                                                <Sliders className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteBranch(branch.id)}
                                                                className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                                title="Delete Branch"
                                                                aria-label="Delete Branch"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                            {/* Empty State */}
                                            {(!isLoadingDbBranches && dbBranches.length === 0) && (
                                                <div className="col-span-full py-16 text-center flex flex-col items-center justify-center">
                                                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4 text-slate-600">
                                                        <MapIcon className="w-6 h-6" />
                                                    </div>
                                                    <h3 className="text-lg font-bold text-white mb-1">No Locations Found</h3>
                                                    <p className="text-slate-400 text-xs max-w-xs mx-auto mb-6">Start by adding your first branch manually.</p>
                                                    <button onClick={() => { setEditingBranch(null); setTempBranch({}); setShowBranchModal(true); }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all shadow-lg text-sm">
                                                        Create First Branch
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* --- SUBSCRIPTION --- */}
                            {activeTab === 'subscription' && (
                                <>
                                    <SectionHeader
                                        icon={Crown}
                                        title="Subscription & Modules"
                                        description="Manage your subscription plan and activate/deactivate specific system modules."
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[
                                            { id: 'insights', label: 'Insights & KPI', icon: TrendingUp, desc: 'Historical analysis, route efficiency scoring, and business intelligence dashboards.' },
                                            { id: 'market', label: 'Market Scanner', icon: Search, desc: 'AI-lead generation tool using geospatial data to find potential customers.' },
                                            { id: 'optimizer', label: 'AI Optimizer', icon: Zap, desc: 'Advanced route optimization engine with territory balancing.' },
                                            { id: 'map', label: 'Route Sequence', icon: LayoutGrid, desc: 'Interactive map visualization for daily dispatch and sequencing.' },
                                            { id: 'scannerV2', label: 'Opportunity Scanner', icon: Radar, desc: 'Field-based opportunity hunting tool to discover and convert new leads.' }
                                        ].map((mod) => (
                                            <div key={mod.id} className={`p - 6 rounded - 2xl border transition - all duration - 300 ${settings.modules[mod.id as keyof CompanySettings['modules']].enabled
                                                ? 'bg-indigo-900/10 border-indigo-500/40 shadow-lg shadow-indigo-900/10'
                                                : 'bg-white/[0.02] border-white/5 opacity-80 hover:opacity-100 hover:bg-white/5'
                                                } `}>
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex gap-4 items-center">
                                                        <div className={`p - 3 rounded - xl ${settings.modules[mod.id as keyof CompanySettings['modules']].enabled ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'} `}>
                                                            <mod.icon className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-lg">{mod.label}</div>
                                                            <div className={`text - xs font - bold uppercase tracking - wider ${settings.modules[mod.id as keyof CompanySettings['modules']].enabled ? 'text-indigo-400' : 'text-slate-500'} `}>
                                                                {settings.modules[mod.id as keyof CompanySettings['modules']].enabled ? 'Active Module' : 'Disabled'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <FeatureToggle
                                                        label=""
                                                        desc=""
                                                        checked={settings.modules[mod.id as keyof CompanySettings['modules']].enabled}
                                                        onChange={(v) => updateModule(mod.id as any, 'enabled', v)}
                                                    />
                                                </div>
                                                <p className="text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-4 mt-2">
                                                    {mod.desc}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* --- OPTIMIZER --- */}
                            {activeTab === 'optimizer' && (
                                <>
                                    <SectionHeader
                                        icon={Zap}
                                        title="AI Optimizer Configuration"
                                        description="Tune the physics engine and constraints used for route calculation."
                                    />
                                    <div className="space-y-6">
                                        <SettingCard title="Constraints & Objectives" icon={Sliders}>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <SelectInput
                                                    label="Start Location"
                                                    value={settings.modules.optimizer.startLocation}
                                                    onChange={(e: any) => updateModule('optimizer', 'startLocation', e)}
                                                    options={[
                                                        { value: "DEPOT", label: "Central Depot" },
                                                        { value: "HOME", label: "Driver Home Location" }
                                                    ]}
                                                    tooltip="Where vehicles begin their shift."
                                                />
                                                <SelectInput
                                                    label="Optimization Goal"
                                                    value={settings.modules.optimizer.costObjective}
                                                    onChange={(e: any) => updateModule('optimizer', 'costObjective', e)}
                                                    options={[
                                                        { value: "BALANCED", label: "Balanced (Time & Dist)" },
                                                        { value: "DISTANCE", label: "Minimize Distance" },
                                                        { value: "TIME", label: "Minimize Time" }
                                                    ]}
                                                    tooltip="Primary objective function for the algorithm."
                                                />
                                            </div>
                                        </SettingCard>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <SettingCard title="Time Factors" icon={TrendingUp} className="h-full">
                                                <div className="space-y-6">
                                                    <RangeInput
                                                        label="Service Time"
                                                        value={settings.modules.optimizer.serviceTimeMin}
                                                        min={5} max={60}
                                                        onChange={(v: number) => updateModule('optimizer', 'serviceTimeMin', v)}
                                                        unit=" min"
                                                        tooltip="Time spent at each stop."
                                                    />
                                                    <RangeInput
                                                        label="Mandatory Break"
                                                        value={settings.modules.optimizer.breakTimeMin}
                                                        min={0} max={60} step={5}
                                                        onChange={(v: number) => updateModule('optimizer', 'breakTimeMin', v)}
                                                        unit=" min"
                                                        tooltip="Rest period per shift."
                                                    />
                                                </div>
                                            </SettingCard>
                                            <SettingCard title="Physics & Limits" icon={Truck} className="h-full">
                                                <div className="space-y-6">
                                                    <RangeInput
                                                        label="Avg Speed"
                                                        value={settings.modules.optimizer.avgSpeedKmh}
                                                        min={10} max={100} step={5}
                                                        onChange={(v: number) => updateModule('optimizer', 'avgSpeedKmh', v)}
                                                        unit=" km/h"
                                                        tooltip="Average fleet travel speed."
                                                    />
                                                    <RangeInput
                                                        label="Max Distance"
                                                        value={settings.modules.optimizer.maxDistancePerRouteKm}
                                                        min={50} max={500} step={10}
                                                        onChange={(v: number) => updateModule('optimizer', 'maxDistancePerRouteKm', v)}
                                                        unit=" km"
                                                        tooltip="Max km per single route."
                                                    />
                                                </div>
                                            </SettingCard>
                                            <SettingCard title="Shift Parameters" icon={BriefcaseClockIcon} className="h-full">
                                                <div className="space-y-6">
                                                    <RangeInput
                                                        label="Max Work Hours"
                                                        value={settings.modules.optimizer.maxWorkingHours}
                                                        min={4} max={16} step={0.5}
                                                        onChange={(v: number) => updateModule('optimizer', 'maxWorkingHours', v)}
                                                        unit=" hr"
                                                        tooltip="Max duration of driver shift."
                                                    />
                                                    <RangeInput
                                                        label="Traffic Multiplier"
                                                        value={settings.modules.optimizer.trafficFactor}
                                                        min={1.0} max={2.5} step={0.1}
                                                        onChange={(v: number) => updateModule('optimizer', 'trafficFactor', v)}
                                                        tooltip="1.0 = Free flow. 1.5 = +50% delays."
                                                    />
                                                </div>
                                            </SettingCard>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* --- INSIGHTS --- */}
                            {activeTab === 'insights' && (
                                <>
                                    <SectionHeader
                                        icon={TrendingUp}
                                        title="Insights & KPI Benchmarks"
                                        description="Set the performance thresholds used to grade route health and driver efficiency."
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <SettingCard title="Route Capacity Benchmarks" icon={Truck}>
                                            <div className="space-y-6">
                                                <RangeInput
                                                    label="Min Clients / Route"
                                                    value={settings.modules.insights.minClientsPerRoute}
                                                    min={5} max={100} step={5}
                                                    onChange={(v: number) => updateModule('insights', 'minClientsPerRoute', v)}
                                                />
                                                <RangeInput
                                                    label="Max Clients / Route"
                                                    value={settings.modules.insights.maxClientsPerRoute}
                                                    min={10} max={300} step={5}
                                                    onChange={(v: number) => updateModule('insights', 'maxClientsPerRoute', v)}
                                                />
                                                <div className="text-xs text-slate-500 bg-white/5 p-3 rounded-lg border border-white/5 mt-4">
                                                    Routes with fewer than <strong>{settings.modules.insights.minClientsPerRoute}</strong> stops are marked <span className="text-yellow-400">Underutilized</span>, while those over <strong>{settings.modules.insights.maxClientsPerRoute}</strong> are <span className="text-red-400">Overloaded</span>.
                                                </div>
                                            </div>
                                        </SettingCard>

                                        <SettingCard title="Efficiency & Operations" icon={Gauge}>
                                            <div className="space-y-6">
                                                <RangeInput
                                                    label="Efficiency Score Target"
                                                    value={settings.modules.insights.efficiencyThreshold}
                                                    min={50} max={99} step={1}
                                                    onChange={(v: number) => updateModule('insights', 'efficiencyThreshold', v)}
                                                    unit="%"
                                                    tooltip="Target score for 'Healthy' routes."
                                                />
                                                <RangeInput
                                                    label="Visit Frequency"
                                                    value={settings.modules.insights.visitFrequencyDays}
                                                    min={1} max={60} step={1}
                                                    onChange={(v: number) => updateModule('insights', 'visitFrequencyDays', v)}
                                                    unit=" days"
                                                    tooltip="Avg days between customer visits."
                                                />
                                                <RangeInput
                                                    label="Nearby Radius"
                                                    value={settings.modules.insights.nearbyRadiusMeters || 100}
                                                    min={50} max={2000} step={50}
                                                    onChange={(v: number) => updateModule('insights', 'nearbyRadiusMeters', v)}
                                                    unit=" m"
                                                    tooltip="Radius to alert if customers are too close."
                                                />
                                            </div>
                                        </SettingCard>
                                    </div>
                                </>
                            )}

                            {/* --- MARKET SCANNER --- */}
                            {activeTab === 'market' && (
                                <>
                                    <SectionHeader
                                        icon={Search}
                                        title="Market Scanner Config"
                                        description="Configure the Lead Generation tool."
                                    />
                                    <div className="space-y-6">
                                        <SettingCard title="Scanner Defaults">
                                            <div className="space-y-4">
                                                <FeatureToggle
                                                    label="Deep Scan Enabled"
                                                    desc="Allow searching external Overpass/OpenStreetMap extended databases."
                                                    checked={settings.modules.market.enableDeepScan}
                                                    onChange={(v) => updateModule('market', 'enableDeepScan', v)}
                                                />
                                                <div className="pt-4">
                                                    <TextInput
                                                        label="Default Search Keywords"
                                                        value={settings.modules.market.defaultKeywords}
                                                        onChange={(e: any) => updateModule('market', 'defaultKeywords', e)}
                                                        placeholder="grocery; pharmacy; store"
                                                        subtext="Separate multiple keywords with a semicolon (;)"
                                                    />
                                                </div>
                                            </div>
                                        </SettingCard>
                                        <div className="grid grid-cols-2 gap-6">
                                            <SettingCard>
                                                <RangeInput
                                                    label="Max Leads / Batch"
                                                    value={settings.modules.market.maxLeadsPerScan}
                                                    min={20} max={500} step={10}
                                                    onChange={(v: number) => updateModule('market', 'maxLeadsPerScan', v)}
                                                />
                                            </SettingCard>
                                            <SettingCard>
                                                <RangeInput
                                                    label="Search Timeout"
                                                    value={settings.modules.market.searchTimeoutSeconds}
                                                    min={10} max={120} step={5}
                                                    onChange={(v: number) => updateModule('market', 'searchTimeoutSeconds', v)}
                                                    unit=" sec"
                                                />
                                            </SettingCard>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* --- MAP SETTINGS --- */}
                            {activeTab === 'map' && (
                                <>
                                    <SectionHeader
                                        icon={LayoutGrid}
                                        title="Map Visualization"
                                        description="Customize the look and feel of the map interface."
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <SettingCard title="Behavioral Toggles">
                                            <div className="space-y-4">
                                                <FeatureToggle
                                                    label="Show Traffic Layer"
                                                    desc="Overlay live traffic data on map load."
                                                    checked={settings.modules.map.showTraffic}
                                                    onChange={(v) => updateModule('map', 'showTraffic', v)}
                                                />
                                                <FeatureToggle
                                                    label="Cluster Markers"
                                                    desc="Group nearby markers at low zoom levels."
                                                    checked={settings.modules.map.clusterMarkers}
                                                    onChange={(v) => updateModule('map', 'clusterMarkers', v)}
                                                />
                                                <FeatureToggle
                                                    label="Show Unassigned"
                                                    desc="Display unserved customers on the map."
                                                    checked={settings.modules.map.showUnassignedCustomers}
                                                    onChange={(v) => updateModule('map', 'showUnassignedCustomers', v)}
                                                />
                                            </div>
                                        </SettingCard>

                                        <SettingCard title="Visual Preference">
                                            <div className="space-y-6">
                                                <SelectInput
                                                    label="Default Map Style"
                                                    value={settings.modules.map.defaultMapStyle}
                                                    onChange={(e: any) => updateModule('map', 'defaultMapStyle', e)}
                                                    options={[
                                                        { value: "STREETS", label: "Streets (Light)" },
                                                        { value: "SATELLITE", label: "Satellite" },
                                                        { value: "DARK", label: "Dark Mode" }
                                                    ]}
                                                />
                                                <RangeInput
                                                    label="Initial Zoom"
                                                    value={settings.modules.map.defaultZoom}
                                                    min={3} max={18}
                                                    onChange={(v: number) => updateModule('map', 'defaultZoom', v)}
                                                />
                                            </div>
                                        </SettingCard>
                                    </div>
                                </>
                            )}

                            {/* --- THEMES & BRANDING --- */}
                            {activeTab === 'themes' && (
                                <CompanyBrandingSettings />
                            )}

                        </div>
                    </div>
                </div>

                {/* --- Branch Edit Modal --- */}
                {showBranchModal && (
                    <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-[#1e293b] rounded-2xl shadow-2xl border border-white/10 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-indigo-900/10">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    {editingBranch ? <Sliders className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-emerald-400" />}
                                    {editingBranch ? 'Edit Branch' : 'New Branch'}
                                </h3>
                                <button
                                    onClick={() => setShowBranchModal(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                    title="Close modal"
                                    aria-label="Close modal"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <TextInput
                                    label="Branch Name"
                                    value={tempBranch.name || ''}
                                    onChange={(val: string) => setTempBranch(prev => ({ ...prev, name: val }))}
                                    placeholder="e.g. Riyadh HQ"
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <TextInput
                                        label="Branch Name (Arabic)"
                                        value={tempBranch.nameAr || ''}
                                        onChange={(val: string) => setTempBranch(prev => ({ ...prev, nameAr: val }))}
                                        placeholder="الفرع الرئيسي"
                                    />
                                    <TextInput
                                        label="Branch Code"
                                        value={tempBranch.code || ''}
                                        onChange={(val: string) => setTempBranch(prev => ({ ...prev, code: val }))}
                                        placeholder="e.g. RYH_HQ"
                                        subtext="Used for system integrations"
                                    />
                                </div>
                                <TextInput
                                    label="Quick Coordinates (Lat, Lng)"
                                    value={coordString}
                                    onChange={handleCoordStringChange}
                                    placeholder="24.7136, 46.6753"
                                    subtext="Paste 'Latitude, Longitude' from Maps for easy setup"
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <TextInput
                                        type="number"
                                        label="Latitude"
                                        value={tempBranch.coordinates?.lat || ''}
                                        onChange={(val: number) => setTempBranch(prev => ({ ...prev, coordinates: { lat: val, lng: prev.coordinates?.lng || 0 } }))}
                                    />
                                    <TextInput
                                        type="number"
                                        label="Longitude"
                                        value={tempBranch.coordinates?.lng || ''}
                                        onChange={(val: number) => setTempBranch(prev => ({ ...prev, coordinates: { lat: prev.coordinates?.lat || 0, lng: val } }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label
                                        htmlFor="branch-address"
                                        className="text-xs font-bold text-slate-500 uppercase"
                                    >
                                        Address / Notes
                                    </label>
                                    <textarea
                                        id="branch-address"
                                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 text-sm h-24 resize-none shadow-inner"
                                        placeholder="Full address..."
                                        value={tempBranch.address || ''}
                                        onChange={(e) => setTempBranch(prev => ({ ...prev, address: e.target.value }))}
                                        title="Branch address or notes"
                                        aria-label="Branch address or notes"
                                    />
                                </div>
                                <div className="pt-2">
                                    <FeatureToggle
                                        label="Branch Active Status"
                                        desc="Inactive branches do not receive allocations."
                                        checked={tempBranch.isActive !== false}
                                        onChange={(v) => setTempBranch(prev => ({ ...prev, isActive: v }))}
                                    />
                                </div>
                            </div>
                            <div className="p-4 border-t border-white/10 bg-black/20 flex gap-3">
                                <button
                                    onClick={() => setShowBranchModal(false)}
                                    className="flex-1 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl font-bold transition-all text-sm"
                                    title="Cancel editing"
                                    aria-label="Cancel editing"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveBranch}
                                    disabled={!tempBranch.name}
                                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
                                    title="Save branch changes"
                                    aria-label="Save branch changes"
                                >
                                    Save Branch
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Start Icon for settings section
function BriefcaseClockIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 22h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
            <path d="M6 7V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
            <circle cx="10" cy="16" r="6" />
            <path d="M10 12v4l3 3" />
        </svg>
    )
}


export default CompanySettingsModal;
