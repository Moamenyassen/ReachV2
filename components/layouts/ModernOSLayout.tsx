
import React, { useState, useEffect, useRef } from 'react';
import {
    LayoutGrid, Map as MapIcon, Zap, BarChart3, FileText,
    Crosshair, Crown, Database, Settings, LayoutTemplate,
    LogOut, ChevronLeft, Search, Bell, Wifi, Battery,
    User, Clock, Sun, Moon, Languages, KeyRound, Globe,
    Users,      // Added Users
    UserCog,    // Added UserCog for User Management
    ClipboardList, // Added ClipboardList
    Maximize, Minimize, Monitor, CloudSun, RefreshCw, CheckCircle2,
    CalendarDays,
    Megaphone,
    Sparkles,
    Radar,
    ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import LogisticsNetworkBackground from './LogisticsNetworkBackground';
import BrandLogo from '../common/BrandLogo';
import AppContent, { AppContentProps } from '../AppContent';
import { ViewMode, UserRole } from '../../types';
import { TRANSLATIONS } from '../../config/constants';
import { useBrandTheme } from '../../contexts/BrandThemeContext';
import { updateUserPreferences } from '../../services/supabase';

export interface ModernLayoutProps extends AppContentProps {
    onToggleUiMode: () => void;
    onToggleAiTheme: () => void;
    onOpenCompanySettings?: () => void;
    children?: React.ReactNode;
}

// --- Animations ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.8 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 20 }
    }
};

type IconSize = 'sm' | 'md' | 'lg';
type WidgetType = 'clock' | 'weather' | 'status';

// --- Sortable Item Component ---
const SortableItem = ({ id, app, iconDims, textSize, controlProps, onClick, brandTheme }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: id });

    // Check if we should use custom brand theme colors
    const useCustomTheme = brandTheme?.activePreset === 'custom';

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    // Dynamic gradient style for custom theme
    const iconStyle = useCustomTheme ? {
        background: `linear-gradient(135deg, ${brandTheme.theme.primaryColor}, ${brandTheme.theme.secondaryColor})`,
        boxShadow: `0 8px 24px ${brandTheme.theme.primaryColor}40`
    } : {};

    const Icon = app.icon;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="flex flex-col items-center gap-4 cursor-grab active:cursor-grabbing touch-none outline-none"
            onClick={(e) => {
                if (!isDragging) {
                    console.log("SortableItem Clicked:", id);
                    onClick();
                }
            }}
        >
            <div
                className={`${iconDims} rounded-[2rem] ${!useCustomTheme ? `bg-gradient-to-br ${app.color}` : ''} shadow-lg flex items-center justify-center relative overflow-hidden group hover:shadow-[0_0_50px_rgba(255,255,255,0.25)] transition-all duration-300 ring-1 ring-white/10 hover:ring-white/30`}
                style={iconStyle}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                {Icon && <Icon className="w-1/2 h-1/2 text-white drop-shadow-md transition-transform duration-300 group-hover:scale-110" />}
            </div>
            <span className={`font-medium ${textSize} tracking-wide drop-shadow-md transition-colors ${controlProps.isDarkMode ? 'text-white/90 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'} text-center w-28 truncate`}>{app.label}</span>
        </div>
    );
};


const UserMenu = ({
    currentUser, onLogout, controlProps, onToggleUiMode, setIsPwdModalOpen,
    iconSize, setIconSize, activeWidgets, toggleWidget, onOpenCompanySettings,
    setView, setIsHome, t
}: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isRtl = controlProps.language === 'ar';

    return (
        <div className="relative" ref={menuRef}>
            <div className="flex flex-col items-end gap-1">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 py-1.5 px-3 rounded-full transition-all backdrop-blur-md active:scale-95 border border-main glass-panel"
                >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-500 p-[1.5px]">
                        <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden bg-sidebar">
                            <span className="text-[9px] font-bold text-main">{currentUser.username.substring(0, 2).toUpperCase()}</span>
                        </div>
                    </div>
                    <span className="text-xs font-bold tracking-wide text-main">{currentUser.username}</span>
                </button>

                {/* Partner Program Link */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setView('REFERRAL_HUB');
                        setIsOpen(false);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 hover:text-emerald-400 transition-colors mr-1"
                >
                    <Megaphone className="w-3 h-3" />
                    <span>{t?.partnerProgram || "Partner Program"}</span>
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full right-0 mt-3 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-main rounded-2xl shadow-2xl overflow-hidden p-2 z-[10001] text-main"
                        dir={isRtl ? 'rtl' : 'ltr'}
                    >
                        <div className="space-y-1">
                            {/* --- Customization Section --- */}
                            <div className="px-3 py-2">
                                <p className="text-[10px] uppercase font-bold tracking-wider opacity-50 mb-2">Display</p>

                                {/* Icon Size */}
                                <div className="flex bg-black/5 rounded-lg p-1 mb-3">
                                    {(['sm', 'md', 'lg'] as IconSize[]).map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => setIconSize(size)}
                                            className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${iconSize === size ? (controlProps.isDarkMode ? 'bg-white text-black shadow-sm' : 'bg-black text-white shadow-sm') : 'hover:bg-black/5'}`}
                                        >
                                            {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                        </button>
                                    ))}
                                </div>

                                {/* Widgets */}
                                <div className="space-y-1">
                                    <button onClick={() => toggleWidget('clock')} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeWidgets.includes('clock') ? (controlProps.isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-black') : 'hover:bg-black/5 opacity-70'}`}>
                                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Clock</div>
                                        {activeWidgets.includes('clock') && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500" />}
                                    </button>
                                    <button onClick={() => toggleWidget('weather')} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeWidgets.includes('weather') ? (controlProps.isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-black') : 'hover:bg-black/5 opacity-70'}`}>
                                        <div className="flex items-center gap-2"><CloudSun className="w-3.5 h-3.5" /> Forecast</div>
                                        {activeWidgets.includes('weather') && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500" />}
                                    </button>
                                    <button onClick={() => toggleWidget('status')} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeWidgets.includes('status') ? (controlProps.isDarkMode ? 'bg-white/10 text-white' : 'bg-black/5 text-black') : 'hover:bg-black/5 opacity-70'}`}>
                                        <div className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5" /> Last Update</div>
                                        {activeWidgets.includes('status') && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500" />}
                                    </button>
                                </div>
                            </div>

                            <div className={`h-px my-1 mx-2 ${controlProps.isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`}></div>

                            {/* --- System Actions --- */}
                            <button onClick={controlProps.onToggleLang} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10 text-main">
                                <Globe className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-medium">{controlProps.language === 'en' ? 'Arabic' : 'English'}</span>
                            </button>
                            <button onClick={controlProps.onToggleTheme} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10 text-main">
                                {controlProps.isDarkMode ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
                                <span className="text-sm font-medium">{controlProps.isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                            </button>
                            <button onClick={() => setIsPwdModalOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10 text-main">
                                <KeyRound className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium">Change Password</span>
                            </button>
                            {(currentUser.role === UserRole.ADMIN) && (
                                <>
                                    <button onClick={onOpenCompanySettings || controlProps.onOpenCompanySettings || (() => { })} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10 text-main">
                                        <Settings className="w-4 h-4 text-cyan-400" />
                                        <span className="text-sm font-medium">Company Settings</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setView(ViewMode.LICENSE_SUMMARY);
                                            setIsHome(false);
                                            setIsOpen(false);
                                            localStorage.setItem(`modern_is_home_${currentUser?.id || 'guest'}`, 'false');
                                        }} 
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10 text-main"
                                    >
                                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                                        <span className="text-sm font-medium">License Summary</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setView(ViewMode.PRICING);
                                            setIsHome(false);
                                            setIsOpen(false);
                                            localStorage.setItem(`modern_is_home_${currentUser?.id || 'guest'}`, 'false');
                                        }} 
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10 text-main"
                                    >
                                        <Crown className="w-4 h-4 text-yellow-400" />
                                        <span className="text-sm font-medium">Subscription Plans</span>
                                    </button>
                                </>
                            )}
                            <button onClick={onToggleUiMode} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/10 text-main">
                                <LayoutTemplate className="w-4 h-4 text-violet-400" />
                                <span className="text-sm font-medium">Switch to Classic</span>
                            </button>
                            <div className="h-px my-1 mx-2 border-b border-main opacity-30"></div>
                            <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group hover:bg-red-500/10 text-main hover:text-red-500">
                                <LogOut className="w-4 h-4 text-muted group-hover:text-red-400" />
                                <span className={`text-sm font-medium ${isRtl ? 'mr-2' : ''}`}>Log Out</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};



const ModernOSLayout: React.FC<ModernLayoutProps> = (props) => {
    const {
        view, setView, currentUser, onToggleUiMode, onLogout,
        controlProps, setIsPwdModalOpen, uploadHistory
    } = props;

    // Get global brand theme
    const { theme, activePreset } = useBrandTheme();

    const isRtl = controlProps.language === 'ar';

    // Keys for persistence
    const STORAGE_KEYS = {
        ICON_SIZE: `modern_icon_size_${currentUser?.id || 'guest'}`,
        WIDGETS: `modern_widgets_${currentUser?.id || 'guest'}`,
        APP_ORDER: `modern_app_order_${currentUser?.id || 'guest'}`
    };

    // Guide State


    // Limbo State Calculation
    const isLimbo = React.useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.username === 'sysadmin') return false;
        return !currentUser.companyId;
    }, [currentUser]);

    const t = TRANSLATIONS[controlProps.language || 'en'];

    // Apps Configuration - Memoized
    const allApps = React.useMemo(() => [
        {
            id: ViewMode.LEGACY_INSIGHTS,
            label: t.insights,
            icon: BarChart3,
            color: 'from-violet-500 to-fuchsia-600',
            enabled: props.currentUser?.companyId // Always enabled if logged in
        },
        {
            id: ViewMode.DASHBOARD,
            label: t.mapView,
            icon: MapIcon,
            color: 'from-cyan-400 to-blue-500',
            enabled: props.currentCompany?.settings?.modules?.map?.enabled !== false
        },
        {
            id: ViewMode.AI_SUGGESTIONS,
            label: t.routeOptimizer,
            icon: Zap,
            color: 'from-amber-400 to-orange-500',
            enabled: props.currentCompany?.settings?.modules?.optimizer?.enabled !== false
        },
        {
            id: ViewMode.MARKET_SCANNER,
            label: t.marketScanner,
            icon: Globe,
            color: 'from-emerald-400 to-teal-500',
            enabled: props.currentCompany?.settings?.modules?.market?.enabled !== false
        },
        {
            id: ViewMode.CUSTOMERS,
            label: t.customers,
            icon: Users,
            color: 'from-fuchsia-500 to-purple-600',
            enabled: true
        },
        {
            id: ViewMode.FULL_SUMMARY,
            label: t.detailedReports,
            icon: ClipboardList,
            color: 'from-pink-500 to-rose-500',
            enabled: true
        },
        {
            id: ViewMode.PRICING,
            label: t.pricing,
            icon: Crown,
            color: 'from-yellow-400 to-amber-300',
            enabled: false // Hidden from grid, moved to User Menu
        },
        {
            id: ViewMode.SYSADMIN_DASHBOARD,
            label: t.system,
            icon: Database,
            color: 'from-red-500 to-rose-600',
            enabled: currentUser.username === 'sysadmin' // Only visible to the actual System Admin
        },
        {
            id: ViewMode.USER_MANAGEMENT,
            label: t.userManagement,
            icon: UserCog,
            color: 'from-indigo-500 to-blue-600',
            enabled: currentUser.role === UserRole.ADMIN
        },
        {
            id: ViewMode.ANALYZE_DATA,
            label: "Analyze Own Data",
            icon: BarChart3,
            color: 'from-blue-500 to-indigo-600',
            enabled: true
        },
        {
            id: ViewMode.REFERRAL_HUB,
            label: t.partnerProgram,
            icon: Megaphone,
            color: 'from-emerald-400 to-green-500',
            enabled: false // Hidden from grid, moved to User Menu
        },
        {
            id: ViewMode.SCANNER_V2,
            label: t.opportunityScanner,
            icon: Radar,
            color: 'from-orange-500 to-amber-600',
            enabled: props.currentCompany?.settings?.modules?.scannerV2?.enabled !== false
        },
        {
            id: 'COMPANY_SETTINGS', // Special ID for Modal
            label: t.settings,
            icon: Settings,
            color: 'from-slate-500 to-slate-600',
            enabled: currentUser.role === UserRole.ADMIN
        },
        {
            id: ViewMode.LICENSE_SUMMARY,
            label: isRtl ? 'ملخص التراخيص' : 'License Summary',
            icon: ShieldCheck,
            color: 'from-indigo-500 to-purple-600',
            enabled: false // Hidden from grid, moved to User Menu
        }
    ], [props.currentUser, props.currentCompany, controlProps.language, isRtl]);

    const apps = React.useMemo(() => {
        if (!isLimbo) return allApps;

        // In Limbo, strictly limit apps: Only "Start Setup" and "Partners"
        return [
            {
                id: ViewMode.DASHBOARD,
                label: 'Start Setup',
                icon: Sparkles,
                color: 'from-cyan-600 to-blue-700',
                enabled: true
            },
            ...allApps.filter(app => [ViewMode.REFERRAL_HUB].includes(app.id as ViewMode))
        ];
    }, [isLimbo, allApps]);

    // State with Persistence
    const [isHome, setIsHome] = useState(() => {
        // Persistence for Home/App state
        const saved = localStorage.getItem(`modern_is_home_${currentUser?.id || 'guest'}`);
        if (saved !== null) return saved === 'true';

        // Default fallback
        return view === ViewMode.DASHBOARD || view === 'LOGIN' ? true : false;
    });

    // Effect: Switch to App Mode if View Changes to specific apps (external triggers)
    useEffect(() => {
        if (view === ViewMode.REFERRAL_HUB) {
            setIsHome(false);
            localStorage.setItem(`modern_is_home_${currentUser?.id || 'guest'}`, 'false');
        }
    }, [view, currentUser]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Initialize from DB if available, else LocalStorage, else Default
    const [iconSize, setIconSize] = useState<IconSize>(() => {
        if (currentUser?.preferences?.iconSize) return currentUser.preferences.iconSize;
        const saved = localStorage.getItem(STORAGE_KEYS.ICON_SIZE);
        return (saved as IconSize) || 'sm';
    });

    const [activeWidgets, setActiveWidgets] = useState<WidgetType[]>(() => {
        if (currentUser?.preferences?.activeWidgets) return currentUser.preferences.activeWidgets;
        const saved = localStorage.getItem(STORAGE_KEYS.WIDGETS);
        return saved ? JSON.parse(saved) : [];
    });

    // Filter apps based on settings and visibility
    const [appsOrder, setAppsOrder] = useState<string[]>(() => {
        const currentIds = apps.filter(a => a.enabled).map(a => a.id);

        // 1. PRIMARY: LocalStorage (always the freshest snapshot on this device;
        //    the DB sync runs in the background and may lag behind local drag actions)
        const savedLocal = localStorage.getItem(STORAGE_KEYS.APP_ORDER);
        if (savedLocal) {
            try {
                const parsed = JSON.parse(savedLocal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const currentIdSet = new Set(currentIds);
                    const validSaved = parsed.filter((id: string) => currentIdSet.has(id as ViewMode));
                    const missing = currentIds.filter(id => !new Set(validSaved).has(id));
                    return [...validSaved, ...missing];
                }
            } catch {/* fall through */}
        }

        // 2. FALLBACK: cloud-stored user preferences (first visit on a new device)
        if (currentUser?.preferences?.dockLayout && currentUser.preferences.dockLayout.length > 0) {
            const savedOrder = currentUser.preferences.dockLayout;
            const currentIdSet = new Set(currentIds);
            const validSaved = savedOrder.filter((id: string) => currentIdSet.has(id as ViewMode));
            const missing = currentIds.filter(id => !new Set(validSaved).has(id));
            return [...validSaved, ...missing];
        }

        return currentIds;
    });

    // Track if first render finished; avoid writing the initial value back to the DB
    // (that race was clobbering just-saved preferences on reload).
    const didMountRef = useRef(false);

    const toggleWidget = (widget: WidgetType) => {
        setActiveWidgets(prev => {
            const next = prev.includes(widget) ? prev.filter(w => w !== widget) : [...prev, widget];
            return next;
        });
    };

    // Persistence (Local + DB) — skip the first run so we don't clobber the
    // just-loaded state with its own initial value. Triggers only after an
    // actual user-driven change.
    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        localStorage.setItem(STORAGE_KEYS.ICON_SIZE, iconSize);
        localStorage.setItem(STORAGE_KEYS.WIDGETS, JSON.stringify(activeWidgets));
        localStorage.setItem(STORAGE_KEYS.APP_ORDER, JSON.stringify(appsOrder));

        const saveToDb = setTimeout(() => {
            if (currentUser && currentUser.username && currentUser.username !== 'guest') {
                updateUserPreferences(currentUser.username, {
                    ...(currentUser.preferences || {}),
                    dockLayout: appsOrder,
                    iconSize: iconSize,
                    activeWidgets: activeWidgets,
                    isDarkMode: controlProps.isDarkMode,
                    language: controlProps.language,
                })
                    .then(() => {
                        // Keep the cached user object in sync so a later login
                        // pull cannot serve up a stale dockLayout.
                        try {
                            const cached = localStorage.getItem('rg_v2_user');
                            if (cached) {
                                const parsed = JSON.parse(cached);
                                parsed.preferences = {
                                    ...(parsed.preferences || {}),
                                    dockLayout: appsOrder,
                                    iconSize,
                                    activeWidgets,
                                };
                                localStorage.setItem('rg_v2_user', JSON.stringify(parsed));
                            }
                        } catch {/* ignore */}
                    })
                    .catch(err => console.error('Failed to sync preferences', err));
            }
        }, 1000);

        return () => clearTimeout(saveToDb);
    }, [iconSize, activeWidgets, appsOrder, controlProps.isDarkMode, controlProps.language, currentUser?.username]);

    // Ensure order stays synced if apps change (WITHOUT duplicates)
    useEffect(() => {
        const currentActiveIds = apps.filter(a => a.enabled).map(a => a.id);

        setAppsOrder(prev => {
            const prevSet = new Set(prev);
            const missing = currentActiveIds.filter(id => !prevSet.has(id));
            const validCurrent = prev.filter(id => currentActiveIds.includes(id as ViewMode));

            if (missing.length === 0 && validCurrent.length === prev.length) return prev;
            return [...validCurrent, ...missing];
        });
    }, [apps]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleAppLaunch = (mode: ViewMode | string) => {
        console.log("App Launch:", mode);
        if (mode === 'COMPANY_SETTINGS') {
            const handler = props.onOpenCompanySettings || controlProps.onOpenCompanySettings;
            if (handler) {
                console.log("Opening Company Settings via Handler");
                handler();
            } else {
                console.error("onOpenCompanySettings function is missing in props AND controlProps!");
                alert("Error: Settings handler missing. Please refresh.");
            }
            return;
        }
        setView(mode as ViewMode);
        setIsHome(false);
        localStorage.setItem(`modern_is_home_${currentUser?.id || 'guest'}`, 'false');
    };

    const handleBackToHome = () => {
        setIsHome(true);
        localStorage.setItem(`modern_is_home_${currentUser?.id || 'guest'}`, 'true');
    };

    // --- DND KIT SENSORS ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require movement of 8px to start drag (prevents accidental drags on click)
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setAppsOrder((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                
                // Immediate local save for responsiveness
                localStorage.setItem(STORAGE_KEYS.APP_ORDER, JSON.stringify(newOrder));
                
                return newOrder;
            });
        }
    };

    // Responsive Grid Config
    const gridCols = {
        'sm': 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
        'md': 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        'lg': 'grid-cols-3 md:grid-cols-3 lg:grid-cols-4'
    }[iconSize];

    const iconDims = {
        'sm': 'w-16 h-16 md:w-20 md:h-20',
        'md': 'w-20 h-20 md:w-28 md:h-28',
        'lg': 'w-24 h-24 md:w-36 md:h-36'
    }[iconSize];

    const textSize = {
        'sm': 'text-xs md:text-sm',
        'md': 'text-sm md:text-base',
        'lg': 'text-base md:text-lg'
    }[iconSize];

    // Get latest upload info
    const lastUpload = React.useMemo(() => {
        if (uploadHistory && uploadHistory.length > 0) {
            return uploadHistory[0]; // Assuming most recent is first
        }
        return null;
    }, [uploadHistory]);

    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden transition-colors duration-500 bg-main text-main">


            {/* Logistics Network Background (Maps & Trucks) */}
            <LogisticsNetworkBackground isDarkMode={controlProps.isDarkMode} />

            {/* Main Application Layer - sits above canvas */}
            <div className="relative z-10 w-full h-full flex flex-col">
                <AnimatePresence mode='wait'>
                    {isHome ? (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                            transition={{ duration: 0.4 }}
                            className="flex-1 flex flex-col relative h-full overflow-hidden"
                            id="dashboard-content"
                        >
                            {/* Home Screen Header (Floating) */}
                            <div className={`h-16 w-full flex items-center justify-between px-6 z-50 shrink-0 pt-4`}>
                                {/* Left Logo */}
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <BrandLogo size="sm" showText={true} isDarkMode={controlProps.isDarkMode} />
                                    </div>
                                    {props.currentCompany && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`text-[10px] font-medium ml-1 mt-0.5 whitespace-nowrap ${controlProps.isDarkMode ? 'text-cyan-400/80' : 'text-cyan-600/80'}`}
                                        >
                                            Welcome to {props.currentCompany.name}
                                        </motion.span>
                                    )}
                                </div>

                                {/* Center (Subscription Info) */}
                                <div className="flex flex-col items-center opacity-0 md:opacity-100 transition-opacity">
                                    {props.currentCompany?.subscriptionTier && (
                                        <div className="px-4 py-1.5 rounded-full border border-main shadow-sm flex items-center gap-2 glass-panel text-main">
                                            <div className={`w-2 h-2 rounded-full ${String(props.currentCompany.subscriptionTier).toUpperCase() === 'ENTERPRISE' ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500'}`} />
                                            <span className="text-xs font-bold uppercase tracking-wider">
                                                {props.currentCompany.subscriptionTier} PLAN
                                            </span>
                                            {props.currentCompany.expirationDate && (
                                                <>
                                                    <span className="w-px h-3 border-r border-main" />
                                                    <span className="text-[10px] font-medium text-muted">
                                                        Exp: {new Date(props.currentCompany.expirationDate).toLocaleDateString()}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right User Menu */}
                                <div className="flex items-center gap-4">


                                    <UserMenu {...{ currentUser, onLogout, controlProps, onToggleUiMode, setIsPwdModalOpen, iconSize, setIconSize, activeWidgets, toggleWidget, onOpenCompanySettings: props.onOpenCompanySettings, setView, setIsHome, t }} />
                                </div>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
                                {/* Widgets Container */}
                                <AnimatePresence>
                                    {activeWidgets.length > 0 && (
                                        <motion.div
                                            layout
                                            className="flex flex-wrap items-center justify-center gap-6 mb-12 w-full max-w-4xl shrink-0"
                                            id="kpi-stats-grid"
                                        >
                                            {activeWidgets.includes('clock') && (
                                                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="p-6 rounded-3xl border border-main flex flex-col items-center shadow-xl glass-panel text-main">
                                                    <span className="text-4xl font-black tracking-tighter">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <span className="text-xs font-bold uppercase tracking-widest mt-1 text-brand-primary">{currentTime.toLocaleDateString([], { weekday: 'long' })}</span>
                                                </motion.div>
                                            )}
                                            {activeWidgets.includes('weather') && (
                                                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="p-6 rounded-3xl border border-main flex items-center gap-4 shadow-xl glass-panel text-main">
                                                    <div className="w-12 h-12 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400">
                                                        <CloudSun className="w-8 h-8" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold opacity-60">Forecast</div>
                                                        <div className="text-xs font-medium text-muted">Live data not configured</div>
                                                    </div>
                                                </motion.div>
                                            )}
                                            {activeWidgets.includes('status') && (
                                                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="p-6 rounded-3xl border border-main flex items-center gap-4 shadow-xl glass-panel text-main">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                                                        <CalendarDays className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold">Last Updated</div>
                                                        <div className="flex justify-between items-center text-xs font-bold text-main mb-2">
                                                            <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-cyan-400" /> {lastUpload ? new Date(lastUpload.uploadDate).toLocaleDateString() : 'No Data'}</div>
                                                            <div className="flex items-center gap-2"><User className="w-3 h-3 text-cyan-400" /> {lastUpload ? lastUpload.uploader : 'No Data'}</div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Drag & Drop Grid */}
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div id="sidebar-nav">
                                        <SortableContext
                                            items={appsOrder}
                                            strategy={rectSortingStrategy}
                                        >
                                            <div
                                                className={`grid ${gridCols || 'grid-cols-3'} gap-8 md:gap-14 max-w-7xl mx-auto transition-all duration-300 pb-20`}
                                            >
                                                {appsOrder.map(appId => {
                                                    const app = apps.find(a => a.id === appId);
                                                    if (!app || !app.enabled) return null;
                                                    return (
                                                        <SortableItem
                                                            key={appId}
                                                            id={appId}
                                                            app={app}
                                                            iconDims={iconDims || 'w-20 h-20'}
                                                            textSize={textSize || 'text-sm'}
                                                            controlProps={controlProps}
                                                            onClick={() => handleAppLaunch(app.id)}
                                                            brandTheme={{ theme, activePreset }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </SortableContext>
                                    </div>
                                </DndContext>
                            </div>

                            {/* Company Branding Badge - Bottom Right (only when custom theme is active) */}
                            {activePreset === 'custom' && theme.logoUrl && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="fixed bottom-6 right-6 z-50"
                                >
                                    <div
                                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-2xl ${controlProps.isDarkMode
                                            ? ''
                                            : 'bg-white/80'
                                            }`}
                                        style={{
                                            backgroundColor: controlProps.isDarkMode
                                                ? `${theme.primaryColor}15`
                                                : `${theme.primaryColor}08`,
                                            borderColor: `${theme.primaryColor}40`,
                                            boxShadow: `0 8px 32px ${theme.primaryColor}30`
                                        }}
                                    >
                                        {/* Company Logo */}
                                        <div
                                            className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center"
                                            style={{
                                                outline: `2px solid ${theme.primaryColor}`,
                                                background: controlProps.isDarkMode
                                                    ? `linear-gradient(135deg, ${theme.primaryColor}20, ${theme.secondaryColor}20)`
                                                    : `linear-gradient(135deg, ${theme.primaryColor}10, ${theme.secondaryColor}10)`
                                            }}
                                        >
                                            <img
                                                src={theme.logoUrl}
                                                alt={theme.companyName}
                                                className="w-10 h-10 object-contain"
                                                onError={(e) => {
                                                    if (theme.faviconUrl) {
                                                        (e.target as HTMLImageElement).src = theme.faviconUrl;
                                                    }
                                                }}
                                            />
                                        </div>

                                        {/* Company Info */}
                                        <div className="flex flex-col">
                                            <span
                                                className="text-sm font-bold"
                                                style={{ color: theme.primaryColor }}
                                            >
                                                {theme.companyName}
                                            </span>
                                            <span className={`text-[10px] font-medium tracking-wide ${controlProps.isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                                }`}>
                                                Powered by Reach AI
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                        </motion.div>
                    ) : (
                        /* --- APP "WINDOW" --- */
                        <motion.div
                            key="app"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 relative flex flex-col h-full bg-main text-main"
                        >
                            {/* App Header */}
                            <div className="h-16 flex items-center justify-between px-6 sticky top-0 z-[10000] shrink-0 border-b border-main bg-panel backdrop-blur-xl" dir={controlProps.language === 'ar' ? 'rtl' : 'ltr'}>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleBackToHome}
                                        className={`p-2 rounded-xl transition-all flex items-center gap-2 ${controlProps.isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}
                                    >
                                        {controlProps.language === 'ar' ? <ChevronLeft className="w-6 h-6 rotate-180" /> : <ChevronLeft className="w-6 h-6" />}
                                    </button>

                                    <div className={`h-6 w-px ${controlProps.isDarkMode ? 'bg-white/10' : 'bg-slate-300'}`}></div>

                                    {(() => {
                                        const activeApp = apps.find(a => a.id === view);
                                        const Icon = activeApp?.icon;
                                        return (
                                            <h1 className={`text-lg font-bold tracking-wide flex items-center gap-3 ${controlProps.isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                                {Icon && <Icon className={`w-5 h-5 ${activeApp?.color ? activeApp.color.split(' ')[1].replace('to-', 'text-') : ''}`} />}
                                                {activeApp?.label}
                                            </h1>
                                        );
                                    })()}
                                </div>

                                <div className="flex items-center gap-3">
                                    <UserMenu {...{ currentUser, onLogout, controlProps, onToggleUiMode, setIsPwdModalOpen, iconSize, setIconSize, activeWidgets, toggleWidget, onOpenCompanySettings: props.onOpenCompanySettings, setView, setIsHome, t }} />
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className={`flex-1 ${[
                                ViewMode.CUSTOMERS,
                                ViewMode.USER_MANAGEMENT,
                                ViewMode.ADMIN_DASHBOARD,
                                ViewMode.LEGACY_INSIGHTS
                            ].includes(view) ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden relative custom-scrollbar`}>
                                {props.children ? props.children : <AppContent {...props} />}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};


export default ModernOSLayout;

