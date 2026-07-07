
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'; // useCallback used by InfoTooltip
import { createPortal } from 'react-dom';
import { TRANSLATIONS, DEFAULT_COMPANY_SETTINGS } from '../../../config/constants';
import { Customer, RouteSummary, CompanySettings, NormalizedBranch } from '../../../types';
import { optimizeRoute, countNearbyCustomers, OptimizerConfig } from '../../../services/optimizer';
import { supabase, fetchFilteredRoutes, fetchRoutePortfolioCount, fetchRouteCustomersNormalized, fetchCompanyRoutes, fetchFilterStats } from '../../../services/supabase';
import MapVisualizer from '../../MapVisualizer';
import ErrorBoundary from '../../ErrorBoundary';
import {
    ArrowLeft, Navigation, Clock, Map as MapIcon, Loader2, Zap, Briefcase,
    ChevronRight, Activity, Timer, UserCheck, MapPin, Info, MapPinned, Users,
    Target, Printer, Calendar, Hash, Building2, AlertTriangle, Check, ChevronsUpDown,
    Sparkles, Gauge, Flag, Radar, TrendingUp, TrendingDown, Fuel, Rocket,
    CircleDot, ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RouteSequenceV2Props {
    companyId?: string;
    activeVersionId?: string;
    onBack: () => void;
    isDarkMode: boolean;
    language: 'en' | 'ar';
    onToggleTheme: () => void;
    onToggleLang: () => void;
    settings?: CompanySettings;
    hideHeader?: boolean;
    userRole?: string;
    userBranchIds?: string[];
    lastUploadDate?: string;
}

/* ================================================================== */
/*  Reusable UI Primitives                                             */
/* ================================================================== */

// Portal-based tooltip — renders at document.body so it is never clipped by overflow-hidden parents
const InfoTooltip = ({ content }: { content: string }) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const show = useCallback(() => {
        if (!triggerRef.current) return;
        const r = triggerRef.current.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top + window.scrollY });
        setVisible(true);
    }, []);

    const hide = useCallback(() => setVisible(false), []);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={show}
                onMouseLeave={hide}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/5 hover:bg-indigo-500/20 transition-colors cursor-help border border-white/10 shrink-0 align-middle"
            >
                <Info className="w-2.5 h-2.5 text-white/40" />
            </div>
            {visible && createPortal(
                <div
                    style={{
                        position: 'absolute',
                        left: pos.x,
                        top: pos.y - 10,
                        transform: 'translate(-50%, -100%)',
                        zIndex: 999999,
                        pointerEvents: 'none',
                    }}
                    className="w-60 p-3 bg-[#0a0a18]/98 backdrop-blur-xl text-slate-200 text-[11px] leading-relaxed rounded-xl shadow-2xl border border-indigo-500/20 text-center font-medium animate-in fade-in duration-150"
                >
                    {content}
                    <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#0a0a18]" />
                </div>,
                document.body
            )}
        </>
    );
};

/* ================================================================== */
/*  Efficiency Gauge — radial SVG, the visual centerpiece              */
/* ================================================================== */

const EfficiencyGauge: React.FC<{ value: number; label?: string }> = ({ value, label }) => {
    const size = 220;
    const strokeWidth = 18;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    // 3/4 arc — from bottom-left to bottom-right
    const arcFraction = 0.75;
    const arcLength = circumference * arcFraction;
    const progress = Math.max(0, Math.min(100, value));
    const dash = (progress / 100) * arcLength;

    // Color based on score
    const gradientId = 'gauge-gradient';
    const stops =
        value >= 85 ? ['#10b981', '#34d399'] :
        value >= 65 ? ['#3b82f6', '#06b6d4'] :
        value >= 45 ? ['#f59e0b', '#fbbf24'] :
                      ['#ef4444', '#f43f5e'];

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size * 0.85 }}>
            <svg width={size} height={size} className="-rotate-[135deg] drop-shadow-2xl overflow-visible">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={stops[0]} />
                        <stop offset="100%" stopColor={stops[1]} />
                    </linearGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {/* Track */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${arcLength} ${circumference}`}
                />
                {/* Progress */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference}`}
                    filter="url(#glow)"
                    style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
            </svg>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Efficiency</div>
                <div className="text-6xl font-black tracking-tighter text-white leading-none">
                    {Math.round(value)}
                    <span className="text-2xl text-white/40">%</span>
                </div>
                {label && (
                    <div className="mt-2 text-[10px] font-bold tracking-widest uppercase text-white/60">{label}</div>
                )}
            </div>
        </div>
    );
};

/* ================================================================== */
/*  Route DNA Strip — segmented heatmap of all legs                    */
/* ================================================================== */

const RouteDnaPulse: React.FC<{
    segments: any[];
    timelineRoute: any[];
    onHover?: (i: number | null) => void;
    hoveredIndex?: number | null;
    onSelectLeg?: (stopId: string | null) => void;
    isAr?: boolean;
}> = ({ segments, timelineRoute, onHover, hoveredIndex, onSelectLeg, isAr }) => {
    if (!segments || segments.length === 0) return null;

    const distances = segments.map(s => s.distance);
    const sorted = [...distances].sort((a, b) => a - b);
    const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
    const max = Math.max(...distances);
    const min = Math.min(...distances);
    const median = sorted[Math.floor(sorted.length / 2)];
    const outlierThreshold = Math.max(avg * 2, median * 2.5);
    const outliersArr = segments
        .map((s, i) => ({ ...s, _idx: i }))
        .filter(s => s.distance > outlierThreshold)
        .sort((a, b) => b.distance - a.distance);

    // SVG dimensions — viewBox is logical; container handles scaling
    const W = 600;
    const H = 90;
    const PAD_X = 8;
    const PAD_Y = 10;
    const plotW = W - PAD_X * 2;
    const plotH = H - PAD_Y * 2;
    const stepX = segments.length > 1 ? plotW / (segments.length - 1) : 0;
    const toY = (d: number) => PAD_Y + plotH - (d / (max || 1)) * plotH;

    // Smooth cardinal-style polyline using Catmull-Rom → Bezier
    const pts = segments.map((s, i) => ({ x: PAD_X + i * stepX, y: toY(s.distance) }));

    let linePath = '';
    if (pts.length > 0) {
        linePath = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] || pts[i + 1];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
    }
    const areaPath = pts.length > 0
        ? `${linePath} L ${pts[pts.length - 1].x} ${H - PAD_Y} L ${pts[0].x} ${H - PAD_Y} Z`
        : '';

    const severity = (d: number) => {
        if (d > outlierThreshold) return { fill: '#f43f5e', stroke: '#fda4af', label: 'Extreme' };
        if (d > avg * 1.3) return { fill: '#f59e0b', stroke: '#fcd34d', label: 'Long' };
        if (d < avg * 0.5) return { fill: '#10b981', stroke: '#6ee7b7', label: 'Short' };
        return { fill: '#6366f1', stroke: '#a5b4fc', label: 'Normal' };
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Radar className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{isAr ? 'نبض مسار الطريق' : 'Route DNA — Pulse'}</span>
                </div>
                <InfoTooltip content={isAr ? 'كل نقطة تمثل مقطعاً بين توقفتين' : 'Each point is a leg. Y-axis = distance. Red peaks are outlier detours worth reviewing.'} />
            </div>

            <div className="relative bg-gradient-to-b from-black/40 to-black/10 rounded-xl p-2 border border-white/5">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[100px]" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="dna-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="50%" stopColor="#a78bfa" />
                            <stop offset="100%" stopColor="#f472b6" />
                        </linearGradient>
                        <linearGradient id="dna-fill-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                        </linearGradient>
                        <filter id="dna-glow">
                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Median baseline */}
                    <line x1={PAD_X} y1={toY(median)} x2={W - PAD_X} y2={toY(median)}
                        stroke="rgba(255,255,255,0.15)" strokeDasharray="2,3" strokeWidth="0.5" />
                    <text x={W - PAD_X - 2} y={toY(median) - 3} textAnchor="end"
                        fill="rgba(255,255,255,0.35)" fontSize="7" fontWeight="700" letterSpacing="0.5">
                        {isAr ? `الوسيط ${median.toFixed(1)} كم` : `MEDIAN ${median.toFixed(1)}km`}
                    </text>

                    {/* Outlier threshold line */}
                    {outliersArr.length > 0 && (
                        <>
                            <line x1={PAD_X} y1={toY(outlierThreshold)} x2={W - PAD_X} y2={toY(outlierThreshold)}
                                stroke="rgba(244,63,94,0.4)" strokeDasharray="1,3" strokeWidth="0.5" />
                            <text x={W - PAD_X - 2} y={toY(outlierThreshold) - 3} textAnchor="end"
                                fill="rgba(244,63,94,0.6)" fontSize="7" fontWeight="700" letterSpacing="0.5">
                                {isAr ? `شذوذ ${outlierThreshold.toFixed(1)} كم` : `OUTLIER ${outlierThreshold.toFixed(1)}km`}
                            </text>
                        </>
                    )}

                    {/* Area fill */}
                    {areaPath && <path d={areaPath} fill="url(#dna-fill-grad)" />}

                    {/* Main line */}
                    {linePath && (
                        <path d={linePath} fill="none" stroke="url(#dna-line-grad)" strokeWidth="1.5"
                            strokeLinejoin="round" strokeLinecap="round" filter="url(#dna-glow)" />
                    )}

                    {/* Data points */}
                    {pts.map((p, i) => {
                        const sev = severity(segments[i].distance);
                        const isOutlier = segments[i].distance > outlierThreshold;
                        const isHovered = hoveredIndex === i;
                        const r = isHovered ? 5 : isOutlier ? 3.5 : 2;
                        return (
                            <g key={i}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => onHover?.(i)}
                                onMouseLeave={() => onHover?.(null)}
                                onClick={() => onSelectLeg?.(timelineRoute[i + 1]?.id || null)}
                            >
                                {isOutlier && (
                                    <circle cx={p.x} cy={p.y} r={r + 3} fill={sev.fill} opacity="0.25" />
                                )}
                                <circle cx={p.x} cy={p.y} r={r} fill={sev.fill} stroke={sev.stroke} strokeWidth={isHovered ? 1.5 : 0.75} />
                                {/* Invisible larger hit target for easier hover */}
                                <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
                            </g>
                        );
                    })}
                </svg>

                {/* Hover tooltip */}
                {hoveredIndex !== null && hoveredIndex !== undefined && segments[hoveredIndex] && (
                    <div className="absolute top-2 left-2 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg px-2.5 py-1.5 shadow-2xl pointer-events-none">
                        <div className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">{isAr ? `مقطع ${hoveredIndex + 1}` : `Leg ${hoveredIndex + 1}`}</div>
                        <div className="text-xs font-black text-white">{segments[hoveredIndex].distance.toFixed(2)} km</div>
                        <div className="text-[9px] text-white/50 truncate max-w-[140px]">→ {segments[hoveredIndex].toName}</div>
                    </div>
                )}
            </div>

            {/* Stats + outliers row */}
            <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1.5">
                    <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">{isAr ? 'أدنى' : 'Min'}</div>
                    <div className="text-xs font-black text-white">{min.toFixed(1)}<span className="text-white/40 text-[9px] ml-0.5">km</span></div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1.5">
                    <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{isAr ? 'وسيط' : 'Med'}</div>
                    <div className="text-xs font-black text-white">{median.toFixed(1)}<span className="text-white/40 text-[9px] ml-0.5">km</span></div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1.5">
                    <div className="text-[8px] font-black text-amber-400 uppercase tracking-widest">{isAr ? 'أقصى' : 'Max'}</div>
                    <div className="text-xs font-black text-white">{max.toFixed(1)}<span className="text-white/40 text-[9px] ml-0.5">km</span></div>
                </div>
                <div className={`rounded-lg px-2 py-1.5 border ${outliersArr.length > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-white/[0.03] border-white/5'}`}>
                    <div className={`text-[8px] font-black uppercase tracking-widest ${outliersArr.length > 0 ? 'text-rose-400' : 'text-white/40'}`}>{isAr ? 'شواذ' : 'Outliers'}</div>
                    <div className="text-xs font-black text-white">{outliersArr.length}</div>
                </div>
            </div>

            {/* Top outliers list */}
            {outliersArr.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">{isAr ? 'أطول المقاطع الشاذة' : 'Top Outlier Legs'}</div>
                    {outliersArr.slice(0, 2).map(o => (
                        <div
                            key={o._idx}
                            onClick={() => onSelectLeg?.(timelineRoute[o._idx + 1]?.id || null)}
                            className="flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg bg-rose-500/5 border border-rose-500/15 hover:bg-rose-500/10 cursor-pointer transition-colors"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span className="font-black text-rose-300 shrink-0">{isAr ? `مقطع ${o._idx + 1}` : `Leg ${o._idx + 1}`}</span>
                            <span className="text-white/40 shrink-0">·</span>
                            <span className="font-bold text-white/80 truncate flex-1">→ {o.toName}</span>
                            <span className="font-mono font-black text-white shrink-0">{o.distance.toFixed(1)} km</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ================================================================== */
/*  Compact labeled multi-select                                       */
/* ================================================================== */

interface MultiSelectProps {
    label: string;
    options: { val: string; count?: number }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    icon?: React.ElementType;
    placeholder?: string;
    disabled?: boolean;
    isAr?: boolean;
}

const LabeledMultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange, icon: Icon, placeholder = 'Select...', disabled = false, isAr }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleOption = (val: string) => {
        let next;
        if (val === 'All') next = ['All'];
        else {
            const noAll = selected.filter(s => s !== 'All');
            next = noAll.includes(val) ? noAll.filter(s => s !== val) : [...noAll, val];
            if (next.length === 0) next = ['All'];
        }
        onChange(next);
    };

    const isAll = selected.includes('All') || selected.length === 0;
    const display = isAll ? placeholder : (isAr ? `${selected.length} محدد` : `${selected.length} Selected`);

    return (
        <div className="relative w-full" ref={containerRef}>
            <label className="block text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">{label}</label>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full bg-white/5 border ${isOpen ? 'border-indigo-400 ring-2 ring-indigo-500/20' : 'border-white/10'} rounded-xl py-2.5 pl-9 pr-8 text-xs font-bold text-left flex items-center justify-between outline-none transition-all text-white shadow-sm hover:border-white/20 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                {Icon && <Icon className="w-3.5 h-3.5 absolute left-3 top-[calc(50%+8px)] -translate-y-1/2 text-white/40 pointer-events-none" />}
                <span className="truncate">{display}</span>
                <ChevronsUpDown className="w-3 h-3 text-white/40 shrink-0" />
            </button>

            {isOpen && !disabled && (
                <div className="absolute top-full left-0 w-full mt-1 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[5000] max-h-60 overflow-y-auto p-1">
                    <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected.includes('All') ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-white/5 text-gray-300'}`}
                        onClick={() => toggleOption('All')}
                    >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.includes('All') ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'}`}>
                            {selected.includes('All') && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs font-bold">Select All</span>
                    </div>
                    {options.filter(o => o.val !== 'All').map(opt => {
                        const sel = selected.includes(opt.val);
                        return (
                            <div
                                key={opt.val}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${sel ? 'bg-indigo-500/10 text-indigo-300' : 'hover:bg-white/5 text-gray-300'}`}
                                onClick={() => toggleOption(opt.val)}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'}`}>
                                    {sel && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <span className="text-xs font-medium truncate flex-1">{opt.val}</span>
                                {opt.count !== undefined && <span className="text-[9px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded-md">{opt.count}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ================================================================== */
/*  Micro KPI — inline compact stat                                    */
/* ================================================================== */

const MicroKpi: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; accent: string; tooltip?: string; onClick?: () => void; clickable?: boolean }> = ({ icon: Icon, label, value, accent, tooltip, onClick, clickable }) => (
    <div
        onClick={onClick}
        className={`bg-white/[0.03] border border-white/5 rounded-xl p-3 transition-all group ${clickable ? 'cursor-pointer hover:bg-sky-500/10 hover:border-sky-500/30 active:scale-95' : 'hover:bg-white/[0.06] hover:border-white/10'}`}
    >
        <div className="flex items-center gap-2 mb-1.5">
            <div className={`p-1.5 rounded-lg ${accent} shrink-0`}>
                <Icon className="w-3 h-3" />
            </div>
            <span className="text-[9px] font-black text-white/50 uppercase tracking-widest truncate flex-1">{label}</span>
            {clickable && <span className="text-[8px] text-sky-400/70 font-bold uppercase tracking-widest shrink-0">tap</span>}
            {tooltip && <InfoTooltip content={tooltip} />}
        </div>
        <div className="text-lg font-black text-white tracking-tight leading-none">{value}</div>
    </div>
);

/* ================================================================== */
/*  Stop Card — rich card per stop in the sequence                     */
/* ================================================================== */

/* ================================================================== */
/*  Swap Suggestion — shared type + popup                              */
/* ================================================================== */

interface SwapSuggestion {
    stopId: string;
    stopName: string;
    stopNameAr?: string;
    clientCode?: string;
    stopIndex: number;
    incomingKm: number;
    outgoingKm: number;
    shortcutKm: number;
    savedKm: number;
    savedMin: number;
    efficiencyGainPct: number;
    altRoute?: string;
    altDay?: string;
    altNearby?: number;
    currentRoute: string;
    currentDay: string;
}

const SwapFlagPopup: React.FC<{ sug: SwapSuggestion; onClose: () => void; isAr?: boolean }> = ({ sug, onClose, isAr }) => {
    const hasAlt = !!sug.altRoute && !!sug.altDay;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                className="relative bg-[#0f0f1a] border border-white/15 rounded-2xl p-5 w-full max-w-sm shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />

                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-rose-500/15 border border-rose-500/30 rounded-xl shrink-0">
                            <Flag className="w-4 h-4 text-rose-400" />
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mb-0.5">{isAr ? 'مبادلة ذكية' : 'Smart Swap'}</div>
                            <h4 className="text-sm font-black text-white leading-tight truncate max-w-[200px]">{sug.stopName}</h4>
                            {sug.stopNameAr && <p className="text-[10px] text-indigo-300/70 font-bold mt-0.5" dir="rtl">{sug.stopNameAr}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors shrink-0">
                        <span className="text-white/50 text-sm leading-none">✕</span>
                    </button>
                </div>

                {/* Current detour */}
                <div className="mb-3 p-3 rounded-xl bg-rose-500/[0.06] border border-rose-500/20">
                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1.5">{isAr ? 'الانحراف الحالي' : 'Current Detour'}</div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-white/70 font-bold">
                            <span className="font-mono">+{sug.incomingKm.toFixed(1)}</span> {isAr ? 'داخل' : 'in'} · <span className="font-mono">+{sug.outgoingKm.toFixed(1)}</span> {isAr ? 'خارج كم' : 'out km'}
                        </span>
                        <span className="font-mono font-black text-rose-300">= {(sug.incomingKm + sug.outgoingKm).toFixed(1)} km</span>
                    </div>
                </div>

                {/* Better assignment */}
                {hasAlt ? (
                    <div className="mb-3 p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/25">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-3 h-3 text-indigo-300" />
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">{isAr ? 'تعيين أفضل' : 'Better Assignment'}</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                    <MapIcon className="w-3 h-3 text-indigo-300" />
                                </div>
                                <div>
                                    <div className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">{isAr ? 'المسار · المندوب' : 'Route · User'}</div>
                                    <div className="text-xs font-black text-white truncate">{sug.altRoute}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                                    <Calendar className="w-3 h-3 text-purple-300" />
                                </div>
                                <div>
                                    <div className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">{isAr ? 'أفضل يوم' : 'Best Day'}</div>
                                    <div className="text-xs font-black text-white">{sug.altDay}</div>
                                </div>
                            </div>
                            {sug.altNearby !== undefined && sug.altNearby > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-300 pt-1.5 border-t border-white/5">
                                    <Users className="w-2.5 h-2.5" />
                                    <span className="font-bold">{sug.altNearby} {isAr ? 'عملاء ضمن 2 كم' : 'customers already within 2 km'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                        <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">{isAr ? 'لا يوجد بديل' : 'No Swap Found'}</div>
                        <div className="text-[11px] text-white/50">{isAr ? 'معزول جغرافياً — لا توجد مسارات أخرى ضمن 2 كم.' : 'Geographically isolated — no other routes within 2 km.'}</div>
                    </div>
                )}

                {/* Savings grid */}
                {hasAlt && (
                    <div className="grid grid-cols-3 gap-1.5">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                            <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none">{isAr ? 'يوفر' : 'Saves'}</div>
                            <div className="text-sm font-black text-emerald-300 mt-1 leading-none">↓{sug.savedKm.toFixed(1)}</div>
                            <div className="text-[8px] text-emerald-400/70 mt-0.5">{isAr ? 'كم' : 'km'}</div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                            <div className="text-[8px] font-black text-amber-400 uppercase tracking-widest leading-none">{isAr ? 'يوفر' : 'Saves'}</div>
                            <div className="text-sm font-black text-amber-300 mt-1 leading-none">↓{Math.round(sug.savedMin)}</div>
                            <div className="text-[8px] text-amber-400/70 mt-0.5">{isAr ? 'دقيقة' : 'min'}</div>
                        </div>
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2 text-center">
                            <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none">{isAr ? 'كفاءة +' : 'Eff. +'}</div>
                            <div className="text-sm font-black text-indigo-300 mt-1 leading-none">+{sug.efficiencyGainPct}%</div>
                            <div className="text-[8px] text-indigo-400/70 mt-0.5">{isAr ? 'مسار' : 'route'}</div>
                        </div>
                    </div>
                )}

                <p className="mt-3 text-[9px] text-white/25 text-center">{isAr ? 'مبني على بيانات تقريبية · تحقق قبل التطبيق' : 'Heuristic-based · validate before action'}</p>
            </div>
        </div>
    );
};

const StopCard: React.FC<{
    stop: Customer; index: number; isBranch: boolean; isLast: boolean; isSelected: boolean;
    legStats: any; cumulativeMin: number; formatMins: (m: number) => string;
    onClick: () => void;
    swapSuggestion?: SwapSuggestion;
    onFlagClick?: (e: React.MouseEvent) => void;
    isAr?: boolean;
}> = ({ stop, index, isBranch, isLast, isSelected, legStats, cumulativeMin, formatMins, onClick, swapSuggestion, onFlagClick, isAr }) => {
    const hasSwap = !isBranch && !isLast && !!swapSuggestion;

    return (
        <div
            onClick={onClick}
            className={`group relative backdrop-blur-sm border rounded-2xl p-4 cursor-pointer transition-all duration-300 overflow-hidden ${
                isSelected
                    ? 'border-indigo-400/60 bg-indigo-500/[0.08] shadow-[0_0_30px_rgba(99,102,241,0.25)] scale-[1.02]'
                    : hasSwap
                    ? 'border-orange-500/40 bg-orange-500/[0.05] hover:border-orange-400/60 hover:bg-orange-500/[0.08] hover:-translate-y-0.5'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06] hover:-translate-y-0.5'
            }`}
        >
            {/* Accent rail */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                isBranch ? 'bg-gradient-to-b from-indigo-400 to-indigo-600' :
                isLast ? 'bg-gradient-to-b from-emerald-400 to-emerald-600' :
                hasSwap ? 'bg-gradient-to-b from-orange-400 to-amber-500' :
                'bg-gradient-to-b from-white/10 to-white/5 group-hover:from-indigo-500/50 group-hover:to-purple-500/50'
            } transition-all`} />

            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isBranch ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' :
                        isLast ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                        hasSwap ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' :
                        'bg-white/5 text-white/70 border border-white/10'
                    }`}>
                        {isBranch ? (isAr ? '⬢ المستودع' : '⬢ DEPOT') : isLast ? (isAr ? '◆ النهاية' : '◆ FINAL') : `#${String(index).padStart(2, '0')}`}
                    </span>
                    {!isBranch && stop.clientCode && (
                        <span className="inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/10 text-[10px] font-mono font-bold text-white/70">
                            <Hash className="w-2.5 h-2.5" />{stop.clientCode}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {hasSwap && (
                        <button
                            onClick={e => { e.stopPropagation(); onFlagClick?.(e); }}
                            title={isAr ? 'اقتراح مبادلة ذكية' : 'Smart Swap Suggestion'}
                            className="relative w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/50 flex items-center justify-center hover:bg-rose-500/40 hover:border-rose-400 transition-all active:scale-90 group/flag"
                        >
                            <Flag className="w-3.5 h-3.5 text-rose-400 group-hover/flag:text-rose-300" />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-[#0f0f1a] animate-ping opacity-70" />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-[#0f0f1a]" />
                        </button>
                    )}
                    {isSelected ? (
                        <div className="w-7 h-7 rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/50 flex items-center justify-center">
                            <CircleDot className="w-3.5 h-3.5 text-white" />
                        </div>
                    ) : (
                        <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center transition-colors">
                            <ArrowRight className="w-3.5 h-3.5 text-white/40 group-hover:text-indigo-300 transition-colors" />
                        </div>
                    )}
                </div>
            </div>

            <h4 className={`text-sm font-black leading-tight mb-0.5 truncate ${hasSwap ? 'text-orange-100' : 'text-white'}`}>{stop.name}</h4>
            {stop.nameAr && <p className="text-xs font-bold text-indigo-300/80 leading-tight truncate" dir="rtl">{stop.nameAr}</p>}

            {!isBranch && stop.reachCustomerCode && (
                <div className="mt-2 inline-flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    <span className="text-[9px] font-black text-indigo-300 uppercase tracking-wider">{isAr ? `رمز Reach: ${stop.reachCustomerCode}` : `REACH-ID: ${stop.reachCustomerCode}`}</span>
                </div>
            )}

            {/* Leg stats */}
            {legStats && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-white/60 font-bold">
                            <Navigation className="w-3 h-3 text-indigo-400" />{isAr ? `+${legStats.distanceKm} كم` : `+${legStats.distanceKm} km`}
                        </span>
                        <span className="flex items-center gap-1 text-white/60 font-bold">
                            <Timer className="w-3 h-3 text-amber-400" />{isAr ? `~${Math.round(legStats.estimatedTimeMin)}د` : `~${Math.round(legStats.estimatedTimeMin)}m`}
                        </span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-300 uppercase tracking-wider">
                        T+{formatMins(cumulativeMin)}
                    </span>
                </div>
            )}
        </div>
    );
};

/* ================================================================== */
/*  Chart tooltip                                                      */
/* ================================================================== */

const CustomGraphTooltip = ({ active, payload, isAr }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        return (
            <div className="bg-black/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-white/10 text-xs z-[9999] min-w-[220px]">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">{isAr ? `مقطع ${d.index}` : `Leg ${d.index}`}</span>
                </div>
                <div className="space-y-1.5">
                    <div><span className="text-[9px] text-white/40 uppercase font-bold">{isAr ? 'من' : 'From'}</span><div className="font-bold text-white/80 truncate">{d.fromName}</div></div>
                    <div><span className="text-[9px] text-white/40 uppercase font-bold">{isAr ? 'إلى' : 'To'}</span><div className="font-bold text-white truncate">{d.toName}</div></div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                    <div className="flex-1 text-center">
                        <span className="block text-[9px] text-white/40 uppercase font-bold">{isAr ? 'المسافة' : 'Distance'}</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">{isAr ? `${d.distance} كم` : `${d.distance} km`}</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex-1 text-center">
                        <span className="block text-[9px] text-white/40 uppercase font-bold">{isAr ? 'الوقت' : 'Time'}</span>
                        <span className="font-mono font-bold text-amber-400 text-sm">{isAr ? `${Math.round(d.time)} د` : `${Math.round(d.time)}m`}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface SwapCandidate {
    route: string;
    day: string;
    nearbyCount: number;
}

/**
 * Finds the best alternative (route, day) assignment for a given customer
 * by counting how many other customers within `radiusKm` are already served
 * on each route/day combination elsewhere in the company.
 *
 * A higher nearby-count implies the customer would slot into that assignment
 * with minimal added detour.
 */
const findSwapCandidate = async (
    supabaseClient: any,
    companyId: string,
    targetLat: number,
    targetLng: number,
    excludeRoute: string,
    excludeDay: string,
    radiusKm: number = 2
): Promise<SwapCandidate | null> => {
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return null;

    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(targetLat * Math.PI / 180));

    const { data: near } = await supabaseClient
        .from('normalized_customers')
        .select('id, lat, lng')
        .eq('company_id', companyId)
        .gte('lat', targetLat - latDelta)
        .lte('lat', targetLat + latDelta)
        .gte('lng', targetLng - lngDelta)
        .lte('lng', targetLng + lngDelta)
        .limit(500);

    if (!near || near.length === 0) return null;

    const nearbyIds = near
        .filter((c: any) => c.lat != null && c.lng != null && haversineKm(targetLat, targetLng, c.lat, c.lng) <= radiusKm)
        .map((c: any) => c.id);

    if (nearbyIds.length === 0) return null;

    const { data: visits } = await supabaseClient
        .from('route_visits')
        .select('day_name, customer_id, routes!inner(name)')
        .eq('company_id', companyId)
        .in('customer_id', nearbyIds);

    if (!visits || visits.length === 0) return null;

    const groups = new Map<string, SwapCandidate>();
    visits.forEach((v: any) => {
        const routeName = v.routes?.name;
        const day = v.day_name;
        if (!routeName || !day) return;
        if (routeName === excludeRoute && day === excludeDay) return;
        const key = `${routeName}|${day}`;
        if (!groups.has(key)) groups.set(key, { route: routeName, day, nearbyCount: 0 });
        groups.get(key)!.nearbyCount++;
    });

    const ranked = Array.from(groups.values()).sort((a, b) => b.nearbyCount - a.nearbyCount);
    return ranked[0] || null;
};

/**
 * A branch is only eligible as a depot / start-point if its coordinates
 * are (a) present, (b) finite numbers, and (c) not the sentinel 0,0.
 * Branches without configured locations must not anchor the route.
 */
const hasValidBranchLocation = (branch: { lat?: number | null; lng?: number | null } | null | undefined): boolean => {
    if (!branch) return false;
    const { lat, lng } = branch;
    if (lat == null || lng == null) return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    // Treat (0,0) as "not configured" — mid-Atlantic sentinel.
    if (lat === 0 && lng === 0) return false;
    // Out-of-range coordinates indicate bad data.
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
    return true;
};

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */

const RouteSequenceV2: React.FC<RouteSequenceV2Props> = ({ companyId, activeVersionId, onBack, isDarkMode, language, settings, hideHeader = false, userRole, userBranchIds, lastUploadDate }) => {
    const isAdmin = !userRole || ['ADMIN', 'MANAGER', 'SYSADMIN'].includes(userRole.toUpperCase());
    const t = TRANSLATIONS[language];
    const isAr = language === 'ar';

    const optimizerConfig: OptimizerConfig = useMemo(() => ({
        ...DEFAULT_COMPANY_SETTINGS.modules.optimizer,
        ...settings?.modules?.optimizer,
        drivingDistanceFactor: settings?.modules?.optimizer?.drivingDistanceFactor ?? 1.4
    } as OptimizerConfig), [settings]);

    // ========== STATE ==========
    const [selectedRegions, setSelectedRegions] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_regions');
        return saved ? JSON.parse(saved) : ['All'];
    });
    const [selectedRoutes, setSelectedRoutes] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_routes');
        return saved ? JSON.parse(saved) : ['All'];
    });
    const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
    const [availableDays, setAvailableDays] = useState<string[]>([]);
    const [selectedWeeks, setSelectedWeeks] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_weeks');
        return saved ? JSON.parse(saved) : ['All'];
    });
    const [selectedDays, setSelectedDays] = useState<string[]>(() => {
        const saved = localStorage.getItem('rg_dash_days');
        return saved ? JSON.parse(saved) : ['All'];
    });

    const [availableRegions, setAvailableRegions] = useState<{ val: string; count: number }[]>([]);
    const [availableRoutes, setAvailableRoutes] = useState<{ val: string; count: number }[]>([]);
    const [isExecuted, setIsExecuted] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [timelineRoute, setTimelineRoute] = useState<Customer[]>([]);
    const [summary, setSummary] = useState<RouteSummary | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isRoutesLoading, setIsRoutesLoading] = useState(false);
    const [routePortfolioCount, setRoutePortfolioCount] = useState<number>(0);
    const [dbBranches, setDbBranches] = useState<NormalizedBranch[]>([]);
    const [filterStats, setFilterStats] = useState<{ branches: Record<string, number>, routes: Record<string, number> }>({ branches: {}, routes: {} });
    const [hoveredLeg, setHoveredLeg] = useState<number | null>(null);

    // AI swap suggestions
    const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [activeSwapPopupId, setActiveSwapPopupId] = useState<string | null>(null);

    // Derived — quick lookups for rendering
    const swapCustomerIds = useMemo(() => new Set(swapSuggestions.map(s => s.stopId)), [swapSuggestions]);
    const swapByStopId = useMemo(() => {
        const m = new Map<string, SwapSuggestion>();
        swapSuggestions.forEach(s => m.set(s.stopId, s));
        return m;
    }, [swapSuggestions]);
    const activeSwapSuggestion = activeSwapPopupId ? swapByStopId.get(activeSwapPopupId) : undefined;

    // ========== EFFECTS (identical logic to original) ==========
    const prevUploadDate = useRef(lastUploadDate);
    useEffect(() => {
        if (!companyId) return;
        const loadStats = async () => {
            const isNewUpload = prevUploadDate.current !== lastUploadDate;
            if (isNewUpload) prevUploadDate.current = lastUploadDate;
            const stats = await fetchFilterStats(companyId, isNewUpload);
            setFilterStats(stats);
        };
        loadStats();
    }, [companyId, lastUploadDate]);

    useEffect(() => {
        if (!companyId) return;
        const loadBranches = async () => {
            try {
                const { getBranches } = await import('../../../services/supabase');
                let branches = await getBranches(companyId);
                if (!isAdmin && userBranchIds && userBranchIds.length > 0) {
                    branches = branches.filter(b =>
                        userBranchIds.includes(b.name_en) ||
                        userBranchIds.includes(b.id) ||
                        userBranchIds.includes(b.code)
                    );
                }
                setDbBranches(branches);

                const savedStr = localStorage.getItem('rg_dash_regions');
                const saved = savedStr ? JSON.parse(savedStr) : null;
                const branchNames = branches.map(b => b.name_en);
                const hasValid = saved && saved.some((r: string) => branchNames.includes(r));
                if (branches.length > 0 && selectedRegions.length === 1 && selectedRegions[0] === 'All' && !hasValid) {
                    setSelectedRegions([branchNames[0]]);
                }
            } catch (err) { console.error("Failed to load DB branches:", err); }
        };
        loadBranches();
    }, [companyId, isAdmin, userBranchIds]);

    // Derive branch dropdown options from loaded branches + filterStats.
    // Done as a memo (not state) so counts update once filterStats arrives,
    // regardless of whether branches loaded first.
    useEffect(() => {
        const options = dbBranches.map(b => ({ val: b.name_en, count: filterStats.branches[b.name_en] || 0 }));
        setAvailableRegions(options);
    }, [dbBranches, filterStats]);

    const [companyRouteNames, setCompanyRouteNames] = useState<string[]>([]);
    useEffect(() => {
        if (!companyId) return;
        const loadRoutes = async () => {
            setIsRoutesLoading(true);
            const branchFilter = selectedRegions.includes('All') ? undefined : selectedRegions;
            const data = await fetchCompanyRoutes(companyId, branchFilter);
            setCompanyRouteNames(data.map((r: any) => r.routeName));
            setIsRoutesLoading(false);
            if (data.length === 0) setSelectedRoutes(['All']);
        };
        loadRoutes();
    }, [companyId, selectedRegions]);

    // Same pattern for routes — counts come from filterStats which may arrive after the route list.
    useEffect(() => {
        setAvailableRoutes(companyRouteNames.map(name => ({ val: name, count: filterStats.routes[name] || 0 })));
    }, [companyRouteNames, filterStats]);

    useEffect(() => {
        if (!companyId) return;
        const load = async () => {
            const { data: weeksData } = await supabase.from('route_visits').select('week_number').eq('company_id', companyId);
            const weeks = Array.from(new Set((weeksData || []).map(w => w.week_number).filter(Boolean).filter((w: string) => w !== 'NULL')));
            setAvailableWeeks(weeks.sort() as string[]);
            const { data: daysData } = await supabase.from('route_visits').select('day_name').eq('company_id', companyId);
            const days = Array.from(new Set((daysData || []).map(d => d.day_name).filter(Boolean).filter((d: string) => d !== 'NULL')));
            setAvailableDays(days as string[]);
        };
        load();
    }, [companyId]);

    const handleExecute = async () => {
        if (!companyId) return;
        if (selectedRoutes.length === 0) { alert("Please select at least one Route."); return; }
        setIsLoading(true);
        setIsExecuted(true);
        localStorage.setItem('rg_dash_regions', JSON.stringify(selectedRegions));
        localStorage.setItem('rg_dash_routes', JSON.stringify(selectedRoutes));
        localStorage.setItem('rg_dash_weeks', JSON.stringify(selectedWeeks));
        localStorage.setItem('rg_dash_days', JSON.stringify(selectedDays));

        try {
            const routeList = selectedRoutes.includes('All') ? availableRoutes.map(r => r.val) : selectedRoutes;
            const branchName = selectedRegions.length === 1 && selectedRegions[0] !== 'All' ? selectedRegions[0] : 'All';
            const portfolios = await Promise.all(routeList.map(r => fetchRoutePortfolioCount(companyId, r, branchName)));
            setRoutePortfolioCount(portfolios.reduce((a, b) => a + b, 0));

            let data = await fetchRouteCustomersNormalized(companyId, { region: selectedRegions, route: selectedRoutes, week: selectedWeeks, day: selectedDays });
            if (data.length === 0) {
                data = await fetchFilteredRoutes(companyId, activeVersionId || 'active_routes',
                    { region: selectedRegions, route: selectedRoutes, week: selectedWeeks, day: selectedDays }, 0, -1);
            }
            setFilteredCustomers(data);
            if (data.length === 0) { setTimelineRoute([]); setSummary(null); }
        } catch (err) { console.error("Failed to load route sequence data", err); }
        finally { setIsLoading(false); }
    };

    const stats = useMemo(() => ({
        totalStops: new Set(filteredCustomers.map(c => c.clientCode)).size,
        portfolioCount: routePortfolioCount
    }), [filteredCustomers, routePortfolioCount]);

    useEffect(() => {
        if (filteredCustomers.length === 0) return;
        setIsProcessing(true);
        const timer = setTimeout(() => {
            let startNode: Customer | undefined;
            const targetRegion = (selectedRegions.length === 1 && selectedRegions[0] !== 'All') ? selectedRegions[0] : filteredCustomers[0]?.regionCode;
            if (targetRegion) {
                const branch = dbBranches.find(b =>
                    b.name_en.toLowerCase() === targetRegion.toLowerCase() ||
                    b.code?.toLowerCase() === targetRegion.toLowerCase()
                );
                // Only anchor the route to the branch if it has a real, configured location.
                // Branches without coords are invisible to both the optimizer and the map.
                if (branch && hasValidBranchLocation(branch)) {
                    startNode = {
                        id: `branch-${branch.id}`, name: `Start: ${branch.name_en}`,
                        lat: branch.lat as number, lng: branch.lng as number, day: 'All',
                        regionCode: branch.name_en, routeName: 'DEPOT', clientCode: 'BRANCH'
                    };
                }
            }
            const input = startNode ? [startNode, ...filteredCustomers] : [...filteredCustomers];
            const { orderedCustomers, summary: resSum } = optimizeRoute(input, startNode?.id, optimizerConfig);
            setTimelineRoute(orderedCustomers);
            setSummary(resSum);
            setIsProcessing(false);
        }, 100);
        return () => clearTimeout(timer);
    }, [filteredCustomers, optimizerConfig, settings]);

    // "Nearby" = customer within nearbyRadiusMeters of ANY configured branch depot
    const nearbyThresholdKm = (settings?.modules?.insights?.nearbyRadiusMeters || 100) / 1000;
    const configuredBranches = useMemo(() => dbBranches.filter(b => hasValidBranchLocation(b)), [dbBranches]);

    const nearbyCustomers = useMemo(() => {
        if (!configuredBranches.length || !filteredCustomers.length) return [];
        return filteredCustomers
            .filter(c => c.lat && c.lng)
            .map(c => {
                let minDist = Infinity;
                let nearest = configuredBranches[0];
                for (const b of configuredBranches) {
                    const d = haversineKm(b.lat as number, b.lng as number, c.lat, c.lng);
                    if (d < minDist) { minDist = d; nearest = b; }
                }
                return { customer: c, distM: Math.round(minDist * 1000), nearestBranch: nearest };
            })
            .filter(x => x.distM <= nearbyThresholdKm * 1000)
            .sort((a, b) => a.distM - b.distM);
    }, [filteredCustomers, configuredBranches, nearbyThresholdKm]);

    const nearbyCount = nearbyCustomers.length;

    const [showNearbyPanel, setShowNearbyPanel] = useState(false);

    const servingTimeMin = (stats.totalStops || 0) * (optimizerConfig?.serviceTimeMin || 20);
    const driveTimeMin = useMemo(() => summary ? Math.max(0, summary.totalTimeMin - servingTimeMin) : 0, [summary, servingTimeMin]);

    const efficiencyScore = useMemo(() => {
        if (!summary || !summary.totalTimeMin || summary.totalTimeMin === 0) return 0;
        const ideal = 480;
        const score = summary.totalTimeMin <= ideal
            ? (summary.totalTimeMin / ideal) * 100
            : (ideal / summary.totalTimeMin) * 100;
        return Math.min(100, Math.round(score));
    }, [summary]);

    const coveragePct = useMemo(() => stats.portfolioCount ? Math.round((stats.totalStops / stats.portfolioCount) * 100) : 0, [stats]);

    const healthMeta = useMemo(() => {
        if (efficiencyScore >= 85) return { label: 'Optimal', gradient: 'from-emerald-500 to-teal-500', icon: Rocket };
        if (efficiencyScore >= 65) return { label: 'Healthy', gradient: 'from-sky-500 to-blue-500', icon: TrendingUp };
        if (efficiencyScore >= 45) return { label: 'Needs Review', gradient: 'from-amber-500 to-orange-500', icon: Activity };
        return { label: 'Critical', gradient: 'from-rose-500 to-red-500', icon: TrendingDown };
    }, [efficiencyScore]);

    const formatMins = (mins: number) => {
        if (mins < 60) return `${Math.round(mins)}m`;
        return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
    };

    const graphData = useMemo(() => {
        if (!summary || !summary.segments) return [];
        return summary.segments.map((seg, i) => ({
            index: i + 1, distance: seg.distanceKm, time: seg.estimatedTimeMin,
            fromId: seg.fromId, toId: seg.toId,
            fromName: timelineRoute[i]?.name, toName: timelineRoute[i + 1]?.name
        }));
    }, [summary, timelineRoute]);

    // Longest / shortest leg
    const legExtremes = useMemo(() => {
        if (!graphData.length) return null;
        let longest = graphData[0], shortest = graphData[0];
        graphData.forEach(d => {
            if (d.distance > longest.distance) longest = d;
            if (d.distance < shortest.distance) shortest = d;
        });
        return { longest, shortest };
    }, [graphData]);

    // ========== AI Swap Suggestions ==========
    // After the route is optimized, find the top problem stops (those whose
    // in/out legs contribute disproportionately) and ask the DB for alternative
    // (route, day) assignments that would reduce detour.
    useEffect(() => {
        if (!summary || !companyId || timelineRoute.length < 3 || !graphData.length) {
            setSwapSuggestions([]);
            return;
        }

        // Rank candidate stops by their leg contribution (in + out) excluding the depot.
        const problems = timelineRoute
            .map((stop, i) => {
                if (!stop || stop.id?.startsWith('branch-')) return null;
                if (stop.lat == null || stop.lng == null) return null;
                const inLeg = i > 0 ? (summary.segments[i - 1]?.distanceKm || 0) : 0;
                const outLeg = i < summary.segments.length ? (summary.segments[i]?.distanceKm || 0) : 0;
                return { stop, index: i, inLeg, outLeg, total: inLeg + outLeg };
            })
            .filter(Boolean)
            .sort((a, b) => (b as any).total - (a as any).total)
            .slice(0, 3) as Array<{ stop: Customer; index: number; inLeg: number; outLeg: number; total: number }>;

        if (problems.length === 0) { setSwapSuggestions([]); return; }

        let cancelled = false;
        setSuggestionsLoading(true);

        (async () => {
            const speedKmH = 40; // approximate; consistent with optimizer's time math
            const serviceMin = optimizerConfig?.serviceTimeMin || 20;
            const currentRouteLabel = selectedRoutes.includes('All') ? '' : selectedRoutes[0] || '';
            const currentDayLabel = selectedDays.includes('All') ? '' : selectedDays[0] || '';

            const results: SwapSuggestion[] = [];

            for (const p of problems) {
                if (cancelled) return;
                const prev = timelineRoute[p.index - 1];
                const next = timelineRoute[p.index + 1];

                const directKm = (prev?.lat != null && prev?.lng != null && next?.lat != null && next?.lng != null)
                    ? haversineKm(prev.lat, prev.lng, next.lat, next.lng)
                    : 0;
                const savedKm = Math.max(0, p.inLeg + p.outLeg - directKm);
                const savedMin = (savedKm / speedKmH) * 60 + serviceMin; // driving + serving freed up

                // Efficiency gain
                const newTotal = Math.max(0, summary.totalTimeMin - savedMin);
                const ideal = 480;
                const newEff = newTotal > 0
                    ? Math.min(100, (newTotal <= ideal ? newTotal / ideal : ideal / newTotal) * 100)
                    : 0;
                const gain = Math.max(0, Math.round(newEff - efficiencyScore));

                let alt: SwapCandidate | null = null;
                try {
                    alt = await findSwapCandidate(
                        supabase, companyId,
                        p.stop.lat!, p.stop.lng!,
                        currentRouteLabel, currentDayLabel, 2
                    );
                } catch (err) {
                    console.warn('[SwapCandidate] failed:', err);
                }

                results.push({
                    stopId: p.stop.id,
                    stopName: p.stop.name,
                    stopNameAr: p.stop.nameAr,
                    clientCode: p.stop.clientCode,
                    stopIndex: p.index,
                    incomingKm: p.inLeg,
                    outgoingKm: p.outLeg,
                    shortcutKm: directKm,
                    savedKm,
                    savedMin,
                    efficiencyGainPct: gain,
                    altRoute: alt?.route,
                    altDay: alt?.day,
                    altNearby: alt?.nearbyCount,
                    currentRoute: currentRouteLabel || 'Current Route',
                    currentDay: currentDayLabel || 'Current Day'
                });
            }

            if (!cancelled) {
                setSwapSuggestions(results);
                setSuggestionsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [summary, timelineRoute, companyId, graphData.length, efficiencyScore, optimizerConfig, selectedRoutes, selectedDays]);

    // Cumulative time per stop (for stop cards)
    const cumulativeTimes = useMemo(() => {
        if (!summary || !summary.segments || timelineRoute.length === 0) return [];
        const result: number[] = [0];
        const serviceTime = optimizerConfig?.serviceTimeMin || 20;
        let running = 0;
        summary.segments.forEach((seg, i) => {
            running += seg.estimatedTimeMin;
            // First stop is the depot (no service time); subsequent stops add service time
            if (i > 0) running += serviceTime;
            result.push(running);
        });
        return result;
    }, [summary, timelineRoute, optimizerConfig]);

    const weeks = availableWeeks.length > 0 ? availableWeeks : ['Week One', 'Week Two', 'Week Three', 'Week Four'];
    const days = availableDays.length > 0 ? availableDays : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'];

    // Depot configuration status — drives the UI banner + map overlay
    const depotStatus = useMemo(() => {
        // Which branches are in scope for the current filter?
        const scope = selectedRegions.includes('All')
            ? dbBranches
            : dbBranches.filter(b => selectedRegions.includes(b.name_en));

        if (scope.length === 0) return { state: 'unknown' as const, configured: [], missing: [] };

        const configured = scope.filter(b => hasValidBranchLocation(b));
        const missing = scope.filter(b => !hasValidBranchLocation(b));

        if (configured.length === scope.length) return { state: 'configured' as const, configured, missing };
        if (configured.length === 0) return { state: 'missing' as const, configured, missing };
        return { state: 'partial' as const, configured, missing };
    }, [dbBranches, selectedRegions]);

    const mapBranchConfigs = useMemo(() => dbBranches
        .filter(b => selectedRegions.includes('All') || selectedRegions.includes(b.name_en))
        // Only render branches on the map if their location is actually configured.
        // Otherwise they'd pin to (0, 0) somewhere in the Atlantic.
        .filter(b => hasValidBranchLocation(b))
        .map(b => ({
            id: b.id, name: b.name_en, nameAr: b.name_ar, code: b.code,
            coordinates: { lat: b.lat as number, lng: b.lng as number }, isActive: b.is_active
        })), [dbBranches, selectedRegions]);

    // Scroll to selected stop card
    useEffect(() => {
        if (!selectedCustomerId) return;
        const el = document.getElementById(`stop-card-${selectedCustomerId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [selectedCustomerId]);

    const HealthIcon = healthMeta.icon;

    return (
        <div data-reach-screen className="flex-1 flex flex-col w-full bg-[#0a0a14] font-sans pb-20 transition-colors overflow-x-hidden min-h-screen relative">

            {/* Ambient glow backdrop */}
            <div className="fixed inset-0 pointer-events-none opacity-30 z-0">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-pink-500/5 rounded-full blur-3xl" />
            </div>

            {/* ========== COMMAND BAR ========== */}
            <div className="sticky top-0 z-[100] bg-[#0a0a14]/80 backdrop-blur-2xl border-b border-white/5 relative">
                <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-4 space-y-4">
                    {!hideHeader && (
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <button onClick={onBack} className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all active:scale-95 shrink-0">
                                    <ArrowLeft className="w-5 h-5 text-white/70" />
                                </button>
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="relative shrink-0">
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-md opacity-60" />
                                        <div className="relative p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg">
                                            <Navigation className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">{isAr ? 'مركز التوزيع' : 'Dispatch Cockpit'}</h2>
                                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-[9px] font-black text-indigo-300 uppercase tracking-widest">
                                                <Sparkles className="w-2.5 h-2.5" /> V2
                                            </span>
                                            {(isProcessing || isLoading) && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
                                        </div>
                                        <p className="text-[11px] text-white/50 font-medium hidden sm:block">{isAr ? 'ذكاء تسلسل المسارات · مدعوم من ReachAI' : 'Route Sequence Intelligence · Powered by ReachAI'}</p>
                                    </div>
                                </div>
                            </div>

                            {summary && (
                                <div className={`hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${healthMeta.gradient} shadow-lg`}>
                                    <HealthIcon className="w-4 h-4 text-white" />
                                    <span className="text-xs font-black text-white uppercase tracking-widest">{healthMeta.label}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Filters — command card with gradient accent border */}
                    <div className="relative rounded-2xl p-[1px]" style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}>
                        <div className="bg-[#0d0d1f]/95 rounded-[15px] p-3 space-y-3 overflow-visible relative z-auto">
                            {/* Title row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">⚡ {isAr ? 'فلاتر المسار' : 'Route Filters'}</span>
                                    {suggestionsLoading && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                                            <Loader2 className="w-3 h-3 animate-spin" />{isAr ? 'جارٍ التحليل…' : 'Analysing…'}
                                        </span>
                                    )}
                                </div>
                                {swapSuggestions.length > 0 && !suggestionsLoading && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-[10px] font-black text-amber-300 uppercase tracking-widest">
                                        🚩 {swapSuggestions.length} {isAr ? `نقطة ساخنة${swapSuggestions.length > 1 ? '' : ''}` : `Hotspot${swapSuggestions.length > 1 ? 's' : ''} Detected`}
                                    </span>
                                )}
                            </div>

                            {/* Filter grid */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
                                <div className="col-span-2 md:col-span-1">
                                    <LabeledMultiSelect
                                        label={isAr ? 'الفرع' : 'Branch'}
                                        placeholder={isAr ? 'كل الفروع' : 'All Branches'}
                                        options={[{ val: 'All', count: availableRegions.reduce((a, b) => a + b.count, 0) }, ...availableRegions]}
                                        selected={selectedRegions}
                                        onChange={(val) => { setSelectedRegions(val); setSelectedRoutes(['All']); }}
                                        icon={Building2}
                                        disabled={isLoading}
                                        isAr={isAr}
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <LabeledMultiSelect
                                        label={isAr ? 'المسار' : 'Route'}
                                        placeholder={isAr ? 'كل المسارات' : 'All Routes'}
                                        options={[{ val: 'All', count: availableRoutes.reduce((a, b) => a + b.count, 0) }, ...availableRoutes]}
                                        selected={selectedRoutes}
                                        onChange={setSelectedRoutes}
                                        icon={MapIcon}
                                        disabled={isLoading || isRoutesLoading}
                                        isAr={isAr}
                                    />
                                </div>
                                <LabeledMultiSelect
                                    label={isAr ? 'الأسبوع' : 'Week'}
                                    placeholder={t.allWeeks}
                                    options={[{ val: 'All' }, ...weeks.map(w => ({ val: w }))]}
                                    selected={selectedWeeks}
                                    onChange={setSelectedWeeks}
                                    icon={Calendar}
                                    disabled={isLoading}
                                    isAr={isAr}
                                />
                                <LabeledMultiSelect
                                    label={isAr ? 'اليوم' : 'Day'}
                                    placeholder={t.allDays}
                                    options={[{ val: 'All' }, ...days.map(d => ({ val: d }))]}
                                    selected={selectedDays}
                                    onChange={setSelectedDays}
                                    icon={Clock}
                                    disabled={isLoading}
                                    isAr={isAr}
                                />
                                <button
                                    onClick={handleExecute}
                                    disabled={isLoading}
                                    className="col-span-2 md:col-span-1 h-[44px] px-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:brightness-110 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                                    <span className="relative">{isAr ? 'توليد' : 'Analyse Route'}</span>
                                </button>
                            </div>

                            {/* Active-filter summary pills */}
                            {isExecuted && summary && (() => {
                                const activeBranch = !selectedRegions.includes('All') ? selectedRegions : null;
                                const activeRoute  = !selectedRoutes.includes('All')  ? selectedRoutes  : null;
                                const activeWeek   = !selectedWeeks.includes('All')   ? selectedWeeks   : null;
                                const activeDay    = !selectedDays.includes('All')    ? selectedDays    : null;
                                if (!activeBranch && !activeRoute && !activeWeek && !activeDay) return null;
                                return (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {activeBranch && activeBranch.map(v => (
                                            <span key={v} className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-black text-indigo-300 uppercase tracking-widest">{isAr ? `فرع: ${v}` : `Branch: ${v}`}</span>
                                        ))}
                                        {activeRoute && activeRoute.map(v => (
                                            <span key={v} className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[10px] font-black text-blue-300 uppercase tracking-widest">{isAr ? `مسار: ${v}` : `Route: ${v}`}</span>
                                        ))}
                                        {activeWeek && activeWeek.map(v => (
                                            <span key={v} className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] font-black text-purple-300 uppercase tracking-widest">{isAr ? `أسبوع: ${v}` : `Week: ${v}`}</span>
                                        ))}
                                        {activeDay && activeDay.map(v => (
                                            <span key={v} className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-black text-amber-300 uppercase tracking-widest">{isAr ? `يوم: ${v}` : `Day: ${v}`}</span>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== BODY ========== */}
            {!isExecuted ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-[70vh] relative z-10">
                    <div className="relative mb-8 group">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 blur-3xl rounded-full scale-150 animate-pulse" />
                        <div className="relative w-40 h-40 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-full flex flex-col items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform duration-700">
                            <Radar className="w-16 h-16 text-indigo-300 opacity-90 animate-pulse" />
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-full">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{isAr ? 'جاهز للتوزيع' : 'Ready to Dispatch'}</span>
                    </div>
                    <h3 className="text-5xl font-black text-white mb-3 tracking-tighter">{isAr ? 'مسارك. مُفكَّك.' : 'Your route. Decoded.'}</h3>
                    <p className="text-white/50 max-w-xl mb-8 leading-relaxed">
                        {isAr ? (
                            <>اختر <strong className="text-white/80">الفرع</strong> و<strong className="text-white/80">المسار</strong>، ثم حدد <strong className="text-white/80">الأسبوع / اليوم</strong> اختيارياً، واضغط <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold rounded-md uppercase tracking-widest text-[10px] mx-1">توليد</span> لحساب التسلسل الأمثل.</>
                        ) : (
                            <>Pick your <strong className="text-white/80">Branch</strong>, <strong className="text-white/80">Route</strong>, and optional <strong className="text-white/80">Week / Day</strong>, then press <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-bold rounded-md uppercase tracking-widest text-[10px] mx-1">Launch</span> to compute the optimal sequence.</>
                        )}
                    </p>
                    {isAdmin && (
                        <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest px-4 py-2 rounded-full border border-white/10 bg-white/5">
                            <Info className="w-3 h-3" />
                            {isAr ? 'تلميح — ارفع بيانات ETL حديثة من لوحة الإدارة' : 'Tip — upload fresh ETLs from the Admin Panel'}
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-3 sm:p-6 lg:p-8 space-y-6 max-w-[1920px] mx-auto w-full relative z-10">
                    {stats.totalStops > 1000 ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-red-500/5 rounded-3xl border border-red-500/20 text-center">
                            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="w-10 h-10 text-red-400" />
                            </div>
                            <h3 className="text-2xl font-black text-red-400 mb-2">{isAr ? `البيانات كثيرة جداً (${stats.totalStops} سجل)` : `Data too heavy (${stats.totalStops} records)`}</h3>
                            <p className="text-red-300/80 max-w-md font-medium text-lg">{isAr ? 'يرجى تضييق الفلتر لتجنب الإرهاق.' : 'Please narrow your filter to prevent overload.'}</p>
                        </div>
                    ) : (
                        <ErrorBoundary>
                            {isProcessing && (
                                <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                                    <div className="relative w-32 h-32 mb-8">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30 blur-3xl animate-pulse" />
                                        <Loader2 className="w-full h-full text-indigo-400 animate-spin relative" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Radar className="w-14 h-14 text-indigo-300" />
                                        </div>
                                    </div>
                                    <h3 className="text-3xl font-black text-white mb-2 tracking-tight">{isAr ? 'جارٍ حساب المسار الأمثل' : 'Computing optimal path'}</h3>
                                    <p className="text-sm text-white/50 font-bold uppercase tracking-widest">{isAr ? `جارٍ المعالجة على ${filteredCustomers.length} توقف…` : `Running TSP on ${filteredCustomers.length} stops…`}</p>
                                </div>
                            )}

                            {!isProcessing && filteredCustomers.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-16 text-center bg-white/[0.03] border border-white/10 rounded-[2rem]">
                                    <Target className="w-14 h-14 text-white/20 mb-4" />
                                    <p className="text-white/50 font-bold">{isAr ? 'لا توجد زيارات مطابقة لهذه الفلاتر.' : 'No visits found matching these filters.'}</p>
                                </div>
                            )}

                            {!isProcessing && summary && (
                                <div className="space-y-6">

                                    {/* ===================== HERO: MISSION BRIEF + MAP ===================== */}
                                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                                        {/* MISSION BRIEF — 5/12 cols */}
                                        <div className="xl:col-span-5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-6 backdrop-blur-sm relative overflow-hidden">
                                            <div className="absolute inset-0 pointer-events-none">
                                                <div className={`absolute -top-20 -left-20 w-64 h-64 bg-gradient-to-br ${healthMeta.gradient} opacity-10 rounded-full blur-3xl`} />
                                            </div>

                                            <div className="relative">
                                                {/* Header row */}
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Briefcase className="w-4 h-4 text-indigo-400" />
                                                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{isAr ? 'ملخص المهمة' : 'Mission Brief'}</span>
                                                    <InfoTooltip content="A full snapshot of today's route: efficiency score, total stops, distance covered, shift duration, and depot anchoring status." />
                                                </div>

                                                {/* Efficiency Gauge centerpiece */}
                                                <div className="flex flex-col items-center justify-center py-4 gap-2">
                                                    <EfficiencyGauge value={efficiencyScore} label={healthMeta.label} />
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/40">
                                                        {isAr ? 'مؤشر كفاءة المسار' : 'Route Efficiency Score'}
                                                        <InfoTooltip content="A composite score (0–100) combining route coverage, average leg distance, stop density, and sequencing quality. ≥85 = Optimal · 65–84 = Good · 45–64 = Fair · &lt;45 = Needs Review." />
                                                    </div>
                                                </div>

                                                {/* Header stats row */}
                                                <div className="flex items-center justify-around mb-5 py-3 border-y border-white/5">
                                                    <div className="text-center group relative cursor-default" title="Total number of customer stops in the optimized sequence">
                                                        <div className="text-2xl font-black text-white leading-none">{timelineRoute.length}</div>
                                                        <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                                                            {isAr ? 'توقف' : 'Stops'} <InfoTooltip content="Total number of customer stops in the optimized route sequence." />
                                                        </div>
                                                    </div>
                                                    <div className="w-px h-10 bg-white/10" />
                                                    <div className="text-center">
                                                        <div className="text-2xl font-black text-white leading-none">{summary.totalDistanceKm}<span className="text-sm text-white/40 ml-1">km</span></div>
                                                        <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                                                            {isAr ? 'المسافة' : 'Distance'} <InfoTooltip content="Total road distance across all legs, from the first stop (or depot) to the last." />
                                                        </div>
                                                    </div>
                                                    <div className="w-px h-10 bg-white/10" />
                                                    <div className="text-center">
                                                        <div className="text-2xl font-black text-white leading-none">{formatMins(summary.totalTimeMin)}</div>
                                                        <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1 flex items-center justify-center gap-1">
                                                            {isAr ? 'الوردية' : 'Shift'} <InfoTooltip content="Total shift duration = driving time + estimated service time at each stop." />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Depot status */}
                                                <div className="mb-4">
                                                    {depotStatus.state === 'configured' && depotStatus.configured.length > 0 && (
                                                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20">
                                                            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                                                <Flag className="w-3.5 h-3.5 text-indigo-300" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">{isAr ? 'المستودع مرتبط' : 'Depot Anchored'}</div>
                                                                <div className="text-xs font-bold text-white truncate">
                                                                    {depotStatus.configured.map(b => b.name_en).join(', ')}
                                                                </div>
                                                            </div>
                                                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                                        </div>
                                                    )}
                                                    {depotStatus.state === 'missing' && (
                                                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.08] border border-amber-500/25">
                                                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[9px] font-black text-amber-300 uppercase tracking-widest">{isAr ? 'المستودع غير مُضبوط' : 'Depot Not Configured'}</div>
                                                                <div className="text-[11px] font-medium text-white/70 leading-tight">{isAr ? 'يبدأ المسار من أول توقف. اضبط موقع الفرع في إعدادات الشركة لربط المستودع.' : 'Route starts from the first stop. Set branch location in Company Settings to anchor the depot.'}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {depotStatus.state === 'partial' && (
                                                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/[0.08] border border-amber-500/25">
                                                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                                                <Info className="w-3.5 h-3.5 text-amber-300" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[9px] font-black text-amber-300 uppercase tracking-widest">{isAr ? 'تغطية جزئية للمستودع' : 'Partial Depot Coverage'}</div>
                                                                <div className="text-[11px] font-medium text-white/70 leading-tight">
                                                                    {depotStatus.configured.length} configured · {depotStatus.missing.length} missing location
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Coverage bar */}
                                                <div className="mb-5">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Target className="w-3 h-3 text-indigo-400" />{isAr ? 'التغطية' : 'Coverage'}
                                                            <InfoTooltip content="How many of the route's assigned portfolio clients are included in today's sequence. Low coverage means some customers are skipped." />
                                                        </span>
                                                        <span className="text-xs font-black text-white">{stats.totalStops}<span className="text-white/30 mx-1">/</span>{stats.portfolioCount || '--'} <span className="text-indigo-300 ml-1">({coveragePct}%)</span></span>
                                                    </div>
                                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                        <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-1000 rounded-full"
                                                             style={{ width: `${Math.max(0, Math.min(100, coveragePct))}%` }} />
                                                    </div>
                                                </div>

                                                {/* Micro KPIs 2x3 */}
                                                <div className="grid grid-cols-3 gap-2 mb-5">
                                                    <MicroKpi icon={Timer} label={isAr ? 'القيادة' : 'Drive'} value={formatMins(driveTimeMin)} accent="bg-rose-500/20 text-rose-400" tooltip="Total behind-the-wheel time across all legs, excluding service time at stops." />
                                                    <MicroKpi icon={UserCheck} label={isAr ? 'الخدمة' : 'Serving'} value={formatMins(servingTimeMin)} accent="bg-emerald-500/20 text-emerald-400" tooltip="Estimated on-site service time across all stops. Configured via Optimizer settings." />
                                                    <MicroKpi icon={Users} label={isAr ? 'قريبون' : 'Nearby'} value={nearbyCount} accent="bg-sky-500/20 text-sky-400" tooltip={`Customers within ${settings?.modules?.insights?.nearbyRadiusMeters || 100}m of the branch depot. Click to see the full list.`} clickable onClick={() => setShowNearbyPanel(true)} />
                                                    <MicroKpi icon={Fuel} label={isAr ? 'متوسط المقطع' : 'Avg Leg'} value={<>{(summary.totalDistanceKm / (timelineRoute.length || 1)).toFixed(1)}<span className="text-[10px] text-white/40 ml-0.5">km</span></>} accent="bg-violet-500/20 text-violet-400" tooltip="Average distance per leg" />
                                                    <MicroKpi icon={TrendingUp} label={isAr ? 'الأطول' : 'Longest'} value={<>{legExtremes ? legExtremes.longest.distance.toFixed(1) : '--'}<span className="text-[10px] text-white/40 ml-0.5">km</span></>} accent="bg-amber-500/20 text-amber-400" tooltip={legExtremes ? `Leg ${legExtremes.longest.index}: ${legExtremes.longest.fromName} → ${legExtremes.longest.toName}` : ''} />
                                                    <MicroKpi icon={TrendingDown} label={isAr ? 'الأقصر' : 'Shortest'} value={<>{legExtremes ? legExtremes.shortest.distance.toFixed(1) : '--'}<span className="text-[10px] text-white/40 ml-0.5">km</span></>} accent="bg-teal-500/20 text-teal-400" tooltip={legExtremes ? `Leg ${legExtremes.shortest.index}: ${legExtremes.shortest.fromName} → ${legExtremes.shortest.toName}` : ''} />
                                                </div>

                                                {/* Route DNA — pulse chart */}
                                                <RouteDnaPulse
                                                    segments={graphData}
                                                    timelineRoute={timelineRoute}
                                                    onHover={setHoveredLeg}
                                                    hoveredIndex={hoveredLeg}
                                                    onSelectLeg={setSelectedCustomerId}
                                                    isAr={isAr}
                                                />
                                            </div>
                                        </div>

                                        {/* MAP — 7/12 cols */}
                                        <div className="xl:col-span-7 h-[500px] xl:h-auto xl:min-h-[640px] rounded-[2rem] shadow-2xl overflow-hidden relative z-0 ring-1 ring-white/10 border border-white/5">
                                            <MapVisualizer
                                                route={timelineRoute}
                                                branches={mapBranchConfigs}
                                                settings={settings}
                                                selectedCustomerId={selectedCustomerId}
                                                swapCustomerIds={swapCustomerIds}
                                            />

                                            {/* Top-right: depot status pill */}
                                            <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 items-end">
                                                {depotStatus.state === 'configured' ? (
                                                    <div className="bg-indigo-500/20 backdrop-blur-xl border border-indigo-400/40 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-2">
                                                        <Flag className="w-3.5 h-3.5 text-indigo-200" />
                                                        <div>
                                                            <div className="text-[8px] font-black text-indigo-200 uppercase tracking-widest leading-none">{isAr ? 'المستودع' : 'Depot'}</div>
                                                            <div className="text-xs font-black text-white leading-tight mt-0.5">{isAr ? 'مرتبط' : 'Anchored'}</div>
                                                        </div>
                                                    </div>
                                                ) : depotStatus.state === 'missing' ? (
                                                    <div className="bg-amber-500/20 backdrop-blur-xl border border-amber-400/40 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-2 max-w-[200px]">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                                                        <div>
                                                            <div className="text-[8px] font-black text-amber-200 uppercase tracking-widest leading-none">{isAr ? 'لا مستودع' : 'No Depot'}</div>
                                                            <div className="text-[10px] font-bold text-white/90 leading-tight mt-0.5">{isAr ? 'يبدأ من أول توقف' : 'Starts from first stop'}</div>
                                                        </div>
                                                    </div>
                                                ) : depotStatus.state === 'partial' ? (
                                                    <div className="bg-amber-500/20 backdrop-blur-xl border border-amber-400/40 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-2">
                                                        <Info className="w-3.5 h-3.5 text-amber-200" />
                                                        <div>
                                                            <div className="text-[8px] font-black text-amber-200 uppercase tracking-widest leading-none">{isAr ? 'المستودع' : 'Depot'}</div>
                                                            <div className="text-xs font-black text-white leading-tight mt-0.5">{isAr ? 'جزئي' : 'Partial'}</div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Bottom legend strip */}
                                            <div className="absolute bottom-3 left-3 z-[1000]">
                                                <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 flex items-center gap-3">
                                                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/70">
                                                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                                        {timelineRoute.length} {isAr ? 'توقف' : 'Stops'}
                                                    </span>
                                                    {swapCustomerIds.size > 0 && (
                                                        <>
                                                            <span className="w-px h-3 bg-white/15 shrink-0" />
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-orange-300">
                                                                <span className="text-[10px] leading-none">✦</span>
                                                                {swapCustomerIds.size} {isAr ? 'مقترح' : `Swap${swapCustomerIds.size !== 1 ? 's' : ''}`}
                                                            </span>
                                                        </>
                                                    )}
                                                    {depotStatus.state === 'configured' && (
                                                        <>
                                                            <span className="w-px h-3 bg-white/15 shrink-0" />
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/70">
                                                                <span className="text-[10px] leading-none">⬢</span>
                                                                {isAr ? 'مستودع مضبوط' : 'Depot Set'}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ===================== HORIZONTAL TIMELINE STRIP ===================== */}
                                    <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-5 sm:p-6 backdrop-blur-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Navigation className="w-4 h-4 text-indigo-400" />
                                                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{isAr ? 'خط زمني للتسلسل' : 'Sequence Timeline'}</span>
                                                <InfoTooltip content="The full ordered stop list from depot to last client. Orange-pulsing stops have a Smart Swap suggestion. Tap any stop to highlight it on the map." />
                                            </div>
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{isAr ? 'اضغط على توقف للتركيز' : 'Tap a stop to focus'}</span>
                                        </div>

                                        <div className="overflow-x-auto pb-2 -mx-2 px-2">
                                            <div className="flex items-start min-w-fit relative">
                                                {/* Gradient spine */}
                                                <div className="absolute top-3 left-4 right-4 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-40" />

                                                {timelineRoute.map((stop, i) => {
                                                    const isBranch = stop?.id?.startsWith('branch-') || false;
                                                    const isLast = i === timelineRoute.length - 1;
                                                    const isSelected = selectedCustomerId === stop.id;
                                                    const isSwap = !isBranch && !isLast && swapCustomerIds.has(stop.id);
                                                    return (
                                                        <div
                                                            key={stop.id}
                                                            onClick={() => setSelectedCustomerId(stop.id)}
                                                            className="flex flex-col items-center cursor-pointer group min-w-[72px] sm:min-w-[88px] shrink-0 relative"
                                                        >
                                                            {/* Outer glow ring for swap stops */}
                                                            {isSwap && (
                                                                <div className="absolute top-0 w-7 h-7 rounded-full border-2 border-orange-400/70 scale-[1.45] animate-ping opacity-50 z-10" />
                                                            )}
                                                            <div className={`relative w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all z-10 ${
                                                                isBranch ? 'bg-indigo-500 border-indigo-300 shadow-lg shadow-indigo-500/50' :
                                                                isLast ? 'bg-emerald-500 border-emerald-300 shadow-lg shadow-emerald-500/50' :
                                                                isSelected ? 'bg-white border-white scale-125 shadow-lg shadow-white/30' :
                                                                isSwap ? 'bg-orange-500 border-orange-300 shadow-lg shadow-orange-500/40' :
                                                                'bg-slate-800 border-indigo-500/50 group-hover:border-indigo-400 group-hover:scale-110'
                                                            }`}>
                                                                {isBranch && <Flag className="w-3 h-3 text-white" />}
                                                                {isLast && !isBranch && <Flag className="w-3 h-3 text-white" />}
                                                                {!isBranch && !isLast && (isSwap
                                                                    ? <Flag className="w-2.5 h-2.5 text-white" />
                                                                    : <span className={`text-[9px] font-black ${isSelected ? 'text-slate-900' : 'text-indigo-300'}`}>{i}</span>
                                                                )}
                                                            </div>
                                                            <div className={`mt-2 text-[9px] font-bold text-center leading-tight truncate w-full px-1 transition-colors ${isSelected ? 'text-white' : isSwap ? 'text-orange-300' : 'text-white/50 group-hover:text-white/80'}`}>
                                                                {isBranch ? 'DEPOT' : (stop.name || '').substring(0, 14)}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ===================== STOPS GRID ===================== */}
                                    <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-5 sm:p-8 backdrop-blur-sm">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                                    <MapPinned className="w-5 h-5 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-xl font-black text-white tracking-tight">{isAr ? 'بيان التوقفات' : 'Stop-by-Stop Manifest'}</h3>
                                                        <InfoTooltip content="The AI-optimized visit order for each customer. Orange-flagged stops have a nearby alternative that could reduce travel distance — click the flag to review the swap." />
                                                    </div>
                                                    <p className="text-xs text-white/50 font-medium">{isAr ? 'اتبع هذا الترتيب لتقليل وقت التنقل' : 'Follow this order to minimize travel time'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/70 uppercase tracking-widest">
                                                    {timelineRoute.length} {isAr ? 'توقف' : 'stops'}
                                                </div>
                                                <div className="px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                                                    {summary.totalDistanceKm} km
                                                </div>
                                                <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                                                    {formatMins(summary.totalTimeMin)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {timelineRoute.map((stop, i) => {
                                                const isBranch = stop?.id?.startsWith('branch-') || false;
                                                const isLast = i === timelineRoute.length - 1;
                                                const isSelected = selectedCustomerId === stop.id;
                                                const isSwap = !isBranch && !isLast && swapCustomerIds.has(stop.id);
                                                const legStats = i > 0 ? summary.segments[i - 1] : null;
                                                const cumMin = cumulativeTimes[i] || 0;
                                                const serviceMin = optimizerConfig?.serviceTimeMin || 20;

                                                return (
                                                    <React.Fragment key={stop.id}>
                                                        {/* Transit segment — drive between previous and this stop */}
                                                        {legStats && (
                                                            <div className="flex items-center gap-3 pl-6 py-1.5">
                                                                <div className="w-0.5 h-5 bg-gradient-to-b from-indigo-500/40 to-indigo-500/10" />
                                                                <div className="flex items-center gap-2.5 text-[10px] font-bold bg-white/[0.02] border border-white/5 rounded-full px-3 py-1">
                                                                    <Navigation className="w-3 h-3 text-indigo-400" />
                                                                    <span className="text-white/50">{isAr ? 'قيادة' : 'Drive'}</span>
                                                                    <span className="text-white font-black font-mono">{legStats.distanceKm} km</span>
                                                                    <span className="text-white/20">·</span>
                                                                    <Timer className="w-3 h-3 text-amber-400" />
                                                                    <span className="text-amber-300 font-black font-mono">~{Math.round(legStats.estimatedTimeMin)} min</span>
                                                                </div>
                                                                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                                                            </div>
                                                        )}

                                                        {/* Stop card */}
                                                        <div
                                                            id={`stop-card-${stop.id}`}
                                                            onClick={() => setSelectedCustomerId(stop.id)}
                                                            className={`relative group cursor-pointer rounded-2xl overflow-hidden transition-all ${
                                                                isSelected ? 'bg-indigo-500/10 border-2 border-indigo-400/60 shadow-[0_0_30px_rgba(99,102,241,0.2)]' :
                                                                isBranch ? 'bg-indigo-500/[0.06] border border-indigo-500/25 hover:bg-indigo-500/[0.1]' :
                                                                isLast ? 'bg-emerald-500/[0.06] border border-emerald-500/25 hover:bg-emerald-500/[0.1]' :
                                                                isSwap ? 'bg-rose-500/[0.05] border border-rose-500/25 hover:bg-rose-500/[0.08]' :
                                                                'bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                                                            }`}
                                                        >
                                                            <div className="flex items-stretch">
                                                                {/* Stop number rail */}
                                                                <div className={`flex flex-col items-center justify-center w-14 sm:w-16 shrink-0 py-4 border-r ${
                                                                    isBranch ? 'bg-indigo-500/10 border-indigo-500/20' :
                                                                    isLast ? 'bg-emerald-500/10 border-emerald-500/20' :
                                                                    isSwap ? 'bg-rose-500/10 border-rose-500/20' :
                                                                    'bg-white/[0.02] border-white/5'
                                                                }`}>
                                                                    {isBranch ? (
                                                                        <>
                                                                            <Flag className="w-4 h-4 text-indigo-300 mb-1" />
                                                                            <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">Start</span>
                                                                        </>
                                                                    ) : isLast ? (
                                                                        <>
                                                                            <Flag className="w-4 h-4 text-emerald-300 mb-1" />
                                                                            <span className="text-[8px] font-black text-emerald-300 uppercase tracking-widest">Final</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">Stop</div>
                                                                            <div className={`text-2xl font-black leading-none ${isSwap ? 'text-rose-300' : 'text-white'}`}>
                                                                                {String(i).padStart(2, '0')}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* Main content */}
                                                                <div className="flex-1 px-3 sm:px-4 py-3 min-w-0">
                                                                    {/* Top row: name + flag */}
                                                                    <div className="flex items-start justify-between gap-3 mb-2">
                                                                        <div className="min-w-0 flex-1">
                                                                            <h4 className={`text-sm sm:text-base font-black truncate leading-tight ${isSwap ? 'text-rose-100' : 'text-white'}`}>
                                                                                {stop.name}
                                                                            </h4>
                                                                            {stop.nameAr && (
                                                                                <p className="text-[11px] font-bold text-indigo-300/70 truncate mt-0.5" dir="rtl">
                                                                                    {stop.nameAr}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        {isSwap && (
                                                                            <button
                                                                                onClick={e => { e.stopPropagation(); setActiveSwapPopupId(stop.id); }}
                                                                                title={isAr ? 'اقتراح مبادلة ذكية' : 'Smart Swap Suggestion'}
                                                                                className="relative w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/50 flex items-center justify-center hover:bg-rose-500/40 transition-all active:scale-90 shrink-0"
                                                                            >
                                                                                <Flag className="w-4 h-4 text-rose-400" />
                                                                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-[#0a0a14] animate-ping opacity-70" />
                                                                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-[#0a0a14]" />
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Chips row */}
                                                                    {!isBranch && (stop.clientCode || stop.day || stop.reachCustomerCode) && (
                                                                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                                                            {stop.clientCode && (
                                                                                <span className="inline-flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/10 text-[9px] font-mono font-bold text-white/60">
                                                                                    <Hash className="w-2.5 h-2.5" />{stop.clientCode}
                                                                                </span>
                                                                            )}
                                                                            {stop.day && (
                                                                                <span className="inline-flex items-center gap-1 bg-indigo-500/10 px-1.5 py-0.5 rounded-md border border-indigo-500/25 text-[9px] font-bold text-indigo-300">
                                                                                    <Calendar className="w-2.5 h-2.5" />{stop.day}
                                                                                </span>
                                                                            )}
                                                                            {stop.reachCustomerCode && (
                                                                                <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/25 text-[9px] font-black text-emerald-300/80">
                                                                                    <Sparkles className="w-2.5 h-2.5" />{isAr ? `رمز Reach: ${stop.reachCustomerCode}` : `REACH-${stop.reachCustomerCode}`}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Time + nav row */}
                                                                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                                                                        <div className="flex items-center gap-3 min-w-0">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">
                                                                                    {isBranch ? 'Depart' : 'Arrive'}
                                                                                </span>
                                                                                <span className={`font-mono font-black leading-none mt-0.5 text-xs ${
                                                                                    isSelected ? 'text-indigo-300' : isSwap ? 'text-rose-200' : 'text-white'
                                                                                }`}>
                                                                                    T+{formatMins(cumMin)}
                                                                                </span>
                                                                            </div>
                                                                            {!isBranch && !isLast && (
                                                                                <>
                                                                                    <div className="h-7 w-px bg-white/10" />
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">Service</span>
                                                                                        <span className="font-mono font-black text-amber-300 leading-none mt-0.5 text-xs">
                                                                                            {serviceMin} min
                                                                                        </span>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                            {legStats && (
                                                                                <>
                                                                                    <div className="h-7 w-px bg-white/10 hidden sm:block" />
                                                                                    <div className="flex flex-col hidden sm:flex">
                                                                                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">Leg</span>
                                                                                        <span className="font-mono font-black text-indigo-300 leading-none mt-0.5 text-xs">
                                                                                            {legStats.distanceKm} km
                                                                                        </span>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        {!isBranch && stop.lat != null && stop.lng != null && (
                                                                            <a
                                                                                onClick={e => e.stopPropagation()}
                                                                                href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/40 text-[9px] font-black text-white/70 hover:text-indigo-300 uppercase tracking-widest transition-all active:scale-95 shrink-0"
                                                                            >
                                                                                <MapIcon className="w-3 h-3" />
                                                                                <span className="hidden sm:inline">Navigate</span>
                                                                                <span className="sm:hidden">Go</span>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ===================== DISTANCE FLOW CHART ===================== */}
                                    <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2rem] p-5 sm:p-6 backdrop-blur-sm">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                                    <Activity className="w-5 h-5 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-black text-white">{isAr ? 'تدفق المسافات' : 'Distance Flow'}</h3>
                                                        <InfoTooltip content="Bar chart of each leg's distance. Red bars = unusually long legs (detours). Orange bars = stops with a Smart Swap suggestion. Hover a bar for stop details." />
                                                    </div>
                                                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{isAr ? 'تباين لكل مقطع' : 'Per-leg variance'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest block">{isAr ? 'المتوسط' : 'Average'}</span>
                                                <span className="text-xl font-black text-white">{(summary.totalDistanceKm / (timelineRoute.length || 1)).toFixed(2)}<span className="text-xs text-white/40 ml-1">km</span></span>
                                            </div>
                                        </div>
                                        <div className="h-[200px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={graphData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                                    <XAxis dataKey="index" hide />
                                                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
                                                    <Tooltip content={<CustomGraphTooltip isAr={isAr} />} cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }} />
                                                    <Bar dataKey="distance" radius={[6, 6, 0, 0]}>
                                                        {graphData.map((entry, i) => {
                                                            const isSwapBar = swapCustomerIds.has(entry.toId);
                                                            const fill = isSwapBar
                                                                ? '#f97316'
                                                                : entry.distance > 5 ? '#ef4444'
                                                                : entry.distance > 2 ? '#f59e0b'
                                                                : '#6366f1';
                                                            return <Cell key={`c-${i}`} fill={fill} fillOpacity={isSwapBar ? 1 : 0.85} />;
                                                        })}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        {swapCustomerIds.size > 0 && (
                                            <div className="flex items-center gap-2 mt-2 text-[10px] text-white/50">
                                                <div className="w-3 h-3 rounded-sm bg-orange-500 shrink-0" />
                                                <span className="font-bold">{isAr ? 'الأشرطة البرتقالية = مقاطع تصل إلى نقطة مبادلة مقترحة' : 'Orange bars = legs arriving at a Smart Swap hotspot'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </ErrorBoundary>
                    )}
                </div>
            )}
            {/* ========== SWAP POPUP ========== */}
            {activeSwapSuggestion && (
                <SwapFlagPopup
                    sug={activeSwapSuggestion}
                    onClose={() => setActiveSwapPopupId(null)}
                    isAr={isAr}
                />
            )}

            {/* ========== NEARBY CUSTOMERS PANEL ========== */}
            {showNearbyPanel && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setShowNearbyPanel(false)}>
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
                    <div
                        className="relative bg-[#0c0c1a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Top accent */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-500" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-sky-500/15 border border-sky-500/30 rounded-xl">
                                    <Users className="w-4 h-4 text-sky-400" />
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-sky-400 uppercase tracking-widest leading-none mb-0.5">{isAr ? 'قريبون من المستودع' : 'Nearby Depot'}</div>
                                    <h4 className="text-sm font-black text-white">
                                        {nearbyCustomers.length > 0
                                            ? isAr ? `${nearbyCustomers.length} عميل قريب من المستودع` : `${nearbyCustomers.length} customer${nearbyCustomers.length !== 1 ? 's' : ''} near the depot`
                                            : isAr ? 'لا يوجد عملاء قريبون' : 'No customers near depot'}
                                    </h4>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowNearbyPanel(false)}
                                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                            >
                                <span className="text-white/50 text-sm leading-none">✕</span>
                            </button>
                        </div>

                        {/* Subheader */}
                        <div className="px-5 py-2.5 bg-sky-500/5 border-b border-white/5 text-[10px] text-sky-300/70 font-medium shrink-0">
                            {isAr
                                ? <>{`عملاء ضمن `}<span className="font-black text-sky-300">{settings?.modules?.insights?.nearbyRadiusMeters || 100}م</span>{` من المستودع — مرتبون بالمسافة.`}</>
                                : <>Customers within <span className="font-black text-sky-300">{settings?.modules?.insights?.nearbyRadiusMeters || 100}m</span> of the branch depot — sorted by distance from depot.</>}
                            {configuredBranches.length === 0 && <span className="text-amber-400 ml-2">⚠ {isAr ? 'لم يُضبط موقع الفرع.' : 'No branch location configured.'}</span>}
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
                            {nearbyCustomers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <Users className="w-10 h-10 text-white/10 mb-3" />
                                    <p className="text-sm font-bold text-white/30">
                                        {configuredBranches.length === 0
                                            ? (isAr ? 'لم يُضبط موقع المستودع للفرع' : 'No branch depot location configured')
                                            : (isAr ? 'لا يوجد عملاء ضمن النطاق القريب' : 'No customers within the nearby radius')}
                                    </p>
                                    <p className="text-[11px] text-white/20 mt-1">
                                        {configuredBranches.length === 0
                                            ? (isAr ? 'اضبط موقع الفرع في إعدادات الشركة ← الفروع' : 'Set the branch location in Company Settings → Branches')
                                            : (isAr ? 'جرب تكبير النطاق في إعدادات الشركة ← المحسّن' : 'Try increasing the nearby radius in Company Settings → Optimizer')}
                                    </p>
                                </div>
                            ) : nearbyCustomers.map(({ customer: c, distM, nearestBranch }, idx) => (
                                <div
                                    key={c.id}
                                    onClick={() => { setSelectedCustomerId(c.id); setShowNearbyPanel(false); }}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-sky-500/5 hover:border-sky-500/20 transition-all cursor-pointer"
                                >
                                    {/* Rank */}
                                    <div className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-[9px] font-black text-sky-400">{idx + 1}</span>
                                    </div>
                                    {/* Customer info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                                            <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
                                            <span className="truncate">{c.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-white/35 truncate">
                                            {c.routeName && <span>{c.routeName}</span>}
                                            {c.day && <><span>·</span><span>{c.day}</span></>}
                                            {nearestBranch && <><span>·</span><span className="text-indigo-300/50">{nearestBranch.name_en}</span></>}
                                        </div>
                                    </div>
                                    {/* Distance from depot */}
                                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                                        <div className="px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] font-black text-sky-300">
                                            {distM < 1000 ? `${distM}m` : `${(distM / 1000).toFixed(2)}km`}
                                        </div>
                                        <span className="text-[8px] text-white/20 font-bold uppercase tracking-wider">{isAr ? 'من المستودع' : 'from depot'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        {nearbyCustomers.length > 0 && (
                            <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02] shrink-0">
                                <p className="text-[10px] text-white/30 text-center font-medium">
                                    {isAr ? 'الأقرب:' : 'Closest:'} <span className="text-sky-400 font-black">{nearbyCustomers[0]?.distM}م</span>
                                    <span className="mx-2 text-white/10">·</span>
                                    {isAr ? 'الأبعد:' : 'Farthest:'} <span className="text-white/50 font-black">{nearbyCustomers[nearbyCustomers.length - 1]?.distM}م</span>
                                    <span className="mx-2 text-white/10">·</span>
                                    {isAr ? 'اضغط على صف للتركيز على الخريطة' : 'Tap a row to focus on map'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RouteSequenceV2;
