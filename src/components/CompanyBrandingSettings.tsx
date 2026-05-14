import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Globe, Sparkles, Palette, Type, Image, CheckCircle2,
    Upload, RefreshCw, Eye, Save, Wand2, X, ChevronDown,
    BarChart3, Users, TrendingUp, Menu, Bell, Search, Settings, RotateCcw
} from 'lucide-react';
import { useBrandTheme, THEME_PRESETS, ThemePreset } from '../contexts/BrandThemeContext';

// ============================================================================
// TYPES
// ============================================================================

interface BrandAssets {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    faviconUrl: string;
    fontFamily: string;
    companyName: string;
}

interface ScanStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'complete';
}

// ============================================================================
// MOCK DATA - Simulated brand extractions
// ============================================================================

const MOCK_BRANDS: Record<string, BrandAssets> = {
    'aramco': {
        primaryColor: '#00A3E0',
        secondaryColor: '#003D6B',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c5/Aramco_Logo.svg/1200px-Aramco_Logo.svg.png',
        faviconUrl: 'https://www.aramco.com/favicon.ico',
        fontFamily: 'Cairo',
        companyName: 'Saudi Aramco'
    },
    'stc': {
        primaryColor: '#4F2D7F',
        secondaryColor: '#00B5E2',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/STC_Logo.svg/2560px-STC_Logo.svg.png',
        faviconUrl: 'https://www.stc.com.sa/favicon.ico',
        fontFamily: 'Inter',
        companyName: 'STC'
    },
    'sabic': {
        primaryColor: '#0033A0',
        secondaryColor: '#78BE20',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/SABIC_logo.svg/2560px-SABIC_logo.svg.png',
        faviconUrl: 'https://www.sabic.com/favicon.ico',
        fontFamily: 'Roboto',
        companyName: 'SABIC'
    },
    'default': {
        primaryColor: '#06B6D4',
        secondaryColor: '#7C3AED',
        logoUrl: '/logo.png',
        faviconUrl: '/favicon.ico',
        fontFamily: 'Inter',
        companyName: 'Your Company'
    }
};

const AVAILABLE_FONTS = [
    'Inter', 'Cairo', 'Roboto', 'Outfit', 'Poppins', 'Open Sans', 'Montserrat', 'Tajawal'
];

const SCAN_STEPS: ScanStep[] = [
    { id: 'connect', label: 'Connecting to website...', status: 'pending' },
    { id: 'css', label: 'Extracting CSS variables...', status: 'pending' },
    { id: 'logo', label: 'Locating SVG logo...', status: 'pending' },
    { id: 'favicon', label: 'Fetching favicon...', status: 'pending' },
    { id: 'fonts', label: 'Detecting typography...', status: 'pending' },
    { id: 'finalize', label: 'Finalizing brand assets...', status: 'pending' }
];

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const ColorSwatch = ({
    color,
    label,
    onChange
}: {
    color: string;
    label: string;
    onChange: (color: string) => void;
}) => (
    <div className="space-y-3">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-3">
            <div className="relative group">
                <div
                    className="w-14 h-14 rounded-xl border-2 border-white/20 shadow-lg cursor-pointer transition-all hover:scale-105 hover:border-white/40"
                    style={{ backgroundColor: color }}
                />
                <input
                    type="color"
                    value={color}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Palette className="w-3 h-3 text-white" />
                </div>
            </div>
            <input
                type="text"
                value={color.toUpperCase()}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none focus:border-cyan-500 transition-colors uppercase"
                placeholder="#000000"
            />
        </div>
    </div>
);

const AnimatedProgress = ({ progress }: { progress: number }) => (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-cyan-500 bg-[length:200%_100%]"
            initial={{ width: 0, backgroundPosition: '0% 0%' }}
            animate={{
                width: `${progress}%`,
                backgroundPosition: ['0% 0%', '100% 0%', '0% 0%']
            }}
            transition={{
                width: { duration: 0.3, ease: 'easeOut' },
                backgroundPosition: { duration: 2, repeat: Infinity, ease: 'linear' }
            }}
        />
    </div>
);

// ============================================================================
// LIVE PREVIEW COMPONENT
// ============================================================================

const LivePreviewDashboard = ({ brandAssets }: { brandAssets: BrandAssets }) => {
    const { primaryColor, secondaryColor, logoUrl, fontFamily, companyName } = brandAssets;

    return (
        <div
            className="h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ fontFamily: `'${fontFamily}', sans-serif` }}
        >
            {/* Mini Sidebar */}
            <div className="flex h-full">
                <div
                    className="w-16 flex flex-col items-center py-4 gap-4"
                    style={{ backgroundColor: primaryColor }}
                >
                    {/* Logo */}
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center overflow-hidden">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt="Logo"
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '';
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <span className="text-white font-bold text-sm">{companyName?.charAt(0) || 'R'}</span>
                        )}
                    </div>

                    {/* Nav Items */}
                    <div className="flex-1 flex flex-col gap-2 mt-4">
                        {[BarChart3, Users, TrendingUp, Settings].map((Icon, i) => (
                            <div
                                key={i}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${i === 0 ? 'bg-white/30' : 'hover:bg-white/20'
                                    }`}
                            >
                                <Icon className="w-5 h-5 text-white" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 bg-slate-900/95 flex flex-col">
                    {/* Header */}
                    <div className="h-14 border-b border-white/5 flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <Menu className="w-5 h-5 text-slate-400" />
                            <span className="text-white font-bold text-sm">{companyName} Portal</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Search className="w-4 h-4 text-slate-500" />
                            <Bell className="w-4 h-4 text-slate-500" />
                            <div
                                className="w-7 h-7 rounded-full"
                                style={{ backgroundColor: secondaryColor }}
                            />
                        </div>
                    </div>

                    {/* Dashboard Content */}
                    <div className="flex-1 p-4 space-y-3">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Revenue', value: '24.5K' },
                                { label: 'Orders', value: '1,234' },
                                { label: 'Growth', value: '+12%' }
                            ].map((stat, i) => (
                                <div
                                    key={i}
                                    className="bg-white/5 rounded-lg p-2 border border-white/5"
                                >
                                    <div className="text-[10px] text-slate-500 uppercase">{stat.label}</div>
                                    <div
                                        className="text-lg font-bold"
                                        style={{ color: i === 2 ? secondaryColor : primaryColor }}
                                    >
                                        {stat.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Mini Chart */}
                        <div className="bg-white/5 rounded-lg p-3 border border-white/5 flex-1">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-slate-400 font-medium">Performance</span>
                                <span
                                    className="text-xs font-bold"
                                    style={{ color: primaryColor }}
                                >
                                    Live
                                </span>
                            </div>

                            {/* Fake Chart Bars */}
                            <div className="flex items-end gap-1 h-16 mt-2">
                                {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((height, i) => (
                                    <motion.div
                                        key={i}
                                        className="flex-1 rounded-t-sm"
                                        style={{
                                            backgroundColor: i === 11 ? primaryColor : secondaryColor,
                                            opacity: i === 11 ? 1 : 0.4
                                        }}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${height}%` }}
                                        transition={{ delay: i * 0.05, duration: 0.5, ease: 'easeOut' }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CompanyBrandingSettings: React.FC = () => {
    // State
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanSteps, setScanSteps] = useState<ScanStep[]>(SCAN_STEPS);
    const [currentStepIndex, setCurrentStepIndex] = useState(-1);
    const [hasFetched, setHasFetched] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [brandAssets, setBrandAssets] = useState<BrandAssets>({
        primaryColor: '#06B6D4',
        secondaryColor: '#7C3AED',
        logoUrl: '',
        faviconUrl: '',
        fontFamily: 'Inter',
        companyName: 'Reach AI'
    });

    // Helper function to extract domain and company info from URL
    const parseWebsiteUrl = (url: string): { domain: string; companyName: string; cleanDomain: string } => {
        let cleanUrl = url.trim().toLowerCase();

        // Add protocol if missing
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }

        try {
            const urlObj = new URL(cleanUrl);
            let domain = urlObj.hostname;

            // Remove www. prefix
            domain = domain.replace(/^www\./, '');

            // Extract company name from domain (before first dot, or handle multi-part names)
            const parts = domain.split('.');
            let companyName = parts[0];

            // Handle special cases like "co.uk", "com.sa", etc.
            if (parts.length >= 3 && (parts[parts.length - 2] === 'com' || parts[parts.length - 2] === 'co')) {
                companyName = parts[0];
            }

            // Capitalize first letter of each word and handle special cases
            companyName = companyName
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            return {
                domain,
                companyName,
                cleanDomain: domain
            };
        } catch {
            // Fallback: try to extract from raw string
            const domainMatch = url.match(/(?:www\.)?([a-zA-Z0-9-]+)\.(?:com|org|net|sa|ae|io|co)/i);
            if (domainMatch) {
                return {
                    domain: domainMatch[0],
                    companyName: domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1),
                    cleanDomain: domainMatch[0]
                };
            }
            return { domain: url, companyName: 'Company', cleanDomain: url };
        }
    };

    // Generate a color palette based on company name (deterministic hash)
    const generateColorPalette = (name: string): { primary: string; secondary: string } => {
        // Simple hash function for consistent colors
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        // Pre-defined professional color palettes
        const palettes = [
            { primary: '#0066CC', secondary: '#00A3E0' }, // Blue tech
            { primary: '#1E3A5F', secondary: '#4A90D9' }, // Corporate blue
            { primary: '#2D5016', secondary: '#7CB342' }, // Green eco
            { primary: '#6B21A8', secondary: '#A855F7' }, // Purple modern
            { primary: '#DC2626', secondary: '#FB923C' }, // Red energy
            { primary: '#0D9488', secondary: '#2DD4BF' }, // Teal fresh
            { primary: '#C2410C', secondary: '#EA580C' }, // Orange warm
            { primary: '#4338CA', secondary: '#818CF8' }, // Indigo deep
            { primary: '#0F766E', secondary: '#14B8A6' }, // Cyan ocean
            { primary: '#7C3AED', secondary: '#A78BFA' }, // Violet creative
        ];

        const index = Math.abs(hash) % palettes.length;
        return palettes[index];
    };

    // Smart fetch handler that analyzes any URL
    const handleFetchMock = useCallback(async () => {
        if (!websiteUrl.trim()) return;

        setIsScanning(true);
        setScanProgress(0);
        setCurrentStepIndex(-1);
        setScanSteps(SCAN_STEPS.map(s => ({ ...s, status: 'pending' })));

        // Parse the URL to extract domain and company info
        const { domain, companyName, cleanDomain } = parseWebsiteUrl(websiteUrl);

        // Check if we have hardcoded brand data first
        const urlLower = websiteUrl.toLowerCase();
        let selectedBrand: BrandAssets | null = null;

        if (urlLower.includes('aramco')) {
            selectedBrand = MOCK_BRANDS['aramco'];
        } else if (urlLower.includes('stc')) {
            selectedBrand = MOCK_BRANDS['stc'];
        } else if (urlLower.includes('sabic')) {
            selectedBrand = MOCK_BRANDS['sabic'];
        }

        // Animate through steps
        for (let i = 0; i < SCAN_STEPS.length; i++) {
            setCurrentStepIndex(i);
            setScanSteps(prev => prev.map((s, idx) => ({
                ...s,
                status: idx < i ? 'complete' : idx === i ? 'active' : 'pending'
            })));
            setScanProgress(((i + 1) / SCAN_STEPS.length) * 100);

            await new Promise(resolve => setTimeout(resolve, 400));
        }

        // Mark all complete
        setScanSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));

        // If we have hardcoded brand data, use it
        if (selectedBrand) {
            setBrandAssets(selectedBrand);
        } else {
            // Generate intelligent brand assets from the URL
            const colors = generateColorPalette(companyName);

            // Use real external services for favicon and logo
            // Google's favicon service (works for most sites)
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;

            // Clearbit Logo API (free for many popular companies)
            const logoUrl = `https://logo.clearbit.com/${cleanDomain}`;

            // Alternative logo sources if Clearbit fails
            const alternativeLogoUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=256`;

            setBrandAssets({
                primaryColor: colors.primary,
                secondaryColor: colors.secondary,
                logoUrl: logoUrl,
                faviconUrl: faviconUrl,
                fontFamily: 'Inter',
                companyName: companyName
            });
        }

        setHasFetched(true);
        setIsScanning(false);
    }, [websiteUrl]);

    // Update brand asset
    const updateBrandAsset = <K extends keyof BrandAssets>(key: K, value: BrandAssets[K]) => {
        setBrandAssets(prev => ({ ...prev, [key]: value }));
    };

    // Get brand theme context
    const { applyCustomTheme, setPreset, activePreset, revertToDefault } = useBrandTheme();

    // Handle save - applies theme globally via context
    const handleApplyTheme = () => {
        // Apply to global context
        applyCustomTheme({
            primaryColor: brandAssets.primaryColor,
            secondaryColor: brandAssets.secondaryColor,
            accentColor: brandAssets.secondaryColor, // Use secondary as accent
            logoUrl: brandAssets.logoUrl,
            faviconUrl: brandAssets.faviconUrl,
            fontFamily: brandAssets.fontFamily,
            companyName: brandAssets.companyName
        });

        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    // Handle preset selection
    const handleSelectPreset = (preset: ThemePreset) => {
        setPreset(preset);
        // Update local state to match preset
        const presetTheme = THEME_PRESETS[preset];
        setBrandAssets({
            primaryColor: presetTheme.primaryColor,
            secondaryColor: presetTheme.secondaryColor,
            logoUrl: presetTheme.logoUrl,
            faviconUrl: presetTheme.faviconUrl,
            fontFamily: presetTheme.fontFamily,
            companyName: presetTheme.companyName
        });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
    };

    // Handle logo upload
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateBrandAsset('logoUrl', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-8">
            {/* Success Toast */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-emerald-500 text-white rounded-xl shadow-2xl shadow-emerald-500/30"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold">Brand Theme Applied Globally!</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header Section */}
            <div className="mb-8 p-6 bg-gradient-to-r from-cyan-900/20 via-violet-900/10 to-transparent border-b border-white/5 -mx-6 -mt-6 pt-10 px-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-violet-500/20 rounded-lg border border-cyan-500/20">
                        <Palette className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white tracking-tight">Company Branding</h3>
                </div>
                <p className="text-slate-400 text-sm pl-[52px] max-w-2xl">
                    White-label your portal by importing brand identity from your official website or customize manually.
                </p>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">

                {/* Left Column - Controls */}
                <div className="xl:col-span-3 space-y-6">

                    {/* URL Input Section */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Wand2 className="w-5 h-5 text-cyan-400" />
                            <h4 className="text-lg font-bold text-white">Auto-Customize Your Portal</h4>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="url"
                                    value={websiteUrl}
                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                    placeholder="Paste your Official Website URL (e.g., www.aramco.com)"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600 text-sm"
                                    disabled={isScanning}
                                />
                            </div>

                            <button
                                onClick={handleFetchMock}
                                disabled={isScanning || !websiteUrl.trim()}
                                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${isScanning
                                    ? 'bg-slate-800 text-slate-400 cursor-wait'
                                    : 'bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white shadow-lg shadow-cyan-900/30 active:scale-[0.98]'
                                    }`}
                            >
                                {isScanning ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        <span>Scanning website...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        <span>🔮 Analyze & Fetch Brand Assets</span>
                                    </>
                                )}
                            </button>

                            {/* Scanning Progress */}
                            <AnimatePresence>
                                {isScanning && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-3 pt-4"
                                    >
                                        <AnimatedProgress progress={scanProgress} />
                                        <div className="space-y-1.5">
                                            {scanSteps.map((step, i) => (
                                                <motion.div
                                                    key={step.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{
                                                        opacity: step.status === 'pending' ? 0.4 : 1,
                                                        x: 0
                                                    }}
                                                    className="flex items-center gap-2 text-xs"
                                                >
                                                    {step.status === 'complete' && (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                    )}
                                                    {step.status === 'active' && (
                                                        <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                                                    )}
                                                    {step.status === 'pending' && (
                                                        <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
                                                    )}
                                                    <span className={`${step.status === 'complete' ? 'text-emerald-400' :
                                                        step.status === 'active' ? 'text-cyan-400' : 'text-slate-500'
                                                        }`}>
                                                        {step.label}
                                                    </span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Extraction Results / Editor */}
                    <AnimatePresence>
                        {hasFetched && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        <h4 className="text-lg font-bold text-white">Extracted Brand Assets</h4>
                                    </div>
                                    <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full">
                                        Click any value to adjust
                                    </span>
                                </div>

                                {/* Colors Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ColorSwatch
                                        color={brandAssets.primaryColor}
                                        label="Primary Brand Color"
                                        onChange={(c) => updateBrandAsset('primaryColor', c)}
                                    />
                                    <ColorSwatch
                                        color={brandAssets.secondaryColor}
                                        label="Accent / Secondary Color"
                                        onChange={(c) => updateBrandAsset('secondaryColor', c)}
                                    />
                                </div>

                                {/* Assets Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Logo */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Logo</label>
                                        <div className="relative group">
                                            <div className="w-full h-28 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
                                                {brandAssets.logoUrl ? (
                                                    <img
                                                        src={brandAssets.logoUrl}
                                                        alt="Company Logo"
                                                        className="max-h-20 max-w-[80%] object-contain"
                                                    />
                                                ) : (
                                                    <div className="text-slate-500 text-sm">No logo detected</div>
                                                )}
                                            </div>
                                            <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                                                <div className="flex items-center gap-2 text-white text-sm font-medium">
                                                    <Upload className="w-4 h-4" />
                                                    <span>Upload Manual</span>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Favicon */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Favicon</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center">
                                                {brandAssets.faviconUrl ? (
                                                    <img
                                                        src={brandAssets.faviconUrl}
                                                        alt="Favicon"
                                                        className="w-8 h-8 object-contain"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                ) : (
                                                    <Image className="w-6 h-6 text-slate-600" />
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                value={brandAssets.faviconUrl}
                                                onChange={(e) => updateBrandAsset('faviconUrl', e.target.value)}
                                                placeholder="Favicon URL"
                                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500 transition-colors placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Typography */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Type className="w-4 h-4" />
                                        Detected Font
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={brandAssets.fontFamily}
                                            onChange={(e) => updateBrandAsset('fontFamily', e.target.value)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 transition-colors text-sm appearance-none cursor-pointer hover:bg-black/50"
                                        >
                                            {AVAILABLE_FONTS.map(font => (
                                                <option key={font} value={font}>
                                                    Detected: {font}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Company Name */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
                                    <input
                                        type="text"
                                        value={brandAssets.companyName}
                                        onChange={(e) => updateBrandAsset('companyName', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 transition-colors text-sm"
                                        placeholder="Company Name"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Preset Theme Selector */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/[0.02] border border-white/5 rounded-2xl p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Palette className="w-5 h-5 text-violet-400" />
                            <h4 className="text-lg font-bold text-white">Theme Presets</h4>
                            <span className="ml-auto text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full">
                                Active: {activePreset === 'custom' ? 'Custom' : activePreset === 'modern' ? 'Modern' : 'Classic'}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {/* Modern Preset */}
                            <button
                                onClick={() => handleSelectPreset('modern')}
                                className={`group p-4 rounded-xl border transition-all ${activePreset === 'modern'
                                        ? 'bg-cyan-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                                        : 'bg-black/30 border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500" />
                                    <span className="text-sm font-bold text-white">Modern</span>
                                </div>
                                <p className="text-[10px] text-slate-500">Cyan + Violet gradient theme</p>
                            </button>

                            {/* Classic Preset */}
                            <button
                                onClick={() => handleSelectPreset('classic')}
                                className={`group p-4 rounded-xl border transition-all ${activePreset === 'classic'
                                        ? 'bg-blue-500/20 border-blue-500/50 shadow-lg shadow-blue-500/20'
                                        : 'bg-black/30 border-white/10 hover:border-blue-500/30 hover:bg-blue-500/10'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-slate-500" />
                                    <span className="text-sm font-bold text-white">Classic</span>
                                </div>
                                <p className="text-[10px] text-slate-500">Blue + Slate corporate theme</p>
                            </button>

                            {/* Revert Button */}
                            <button
                                onClick={revertToDefault}
                                className="group p-4 rounded-xl border bg-black/30 border-white/10 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <RotateCcw className="w-4 h-4 text-amber-400 group-hover:animate-spin" />
                                    <span className="text-sm font-bold text-white">Revert</span>
                                </div>
                                <p className="text-[10px] text-slate-500">Reset to default theme</p>
                            </button>
                        </div>
                    </motion.div>

                    {/* Apply Button */}
                    {hasFetched && (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={handleApplyTheme}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            <Save className="w-5 h-5" />
                            <span>Apply Brand Theme Globally</span>
                        </motion.button>
                    )}
                </div>

                {/* Right Column - Live Preview */}
                <div className="xl:col-span-2">
                    <div className="sticky top-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Eye className="w-5 h-5 text-violet-400" />
                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Live Preview</h4>
                        </div>

                        <div className="h-[400px] xl:h-[500px]">
                            <LivePreviewDashboard brandAssets={brandAssets} />
                        </div>

                        <p className="text-[11px] text-slate-500 text-center">
                            Preview updates instantly as you modify values above
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyBrandingSettings;
