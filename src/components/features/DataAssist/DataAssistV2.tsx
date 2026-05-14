/**
 * DataAssistV2 — magic AI data analysis screen.
 *
 * Flow (re-imagined): no wizard, just two screens.
 *   ProjectsList  →  Source pick (drop file or pull Reach)  →  DASHBOARD
 *
 * Dashboard contains everything in one view:
 *   • KPI strip (top)
 *   • Filter chips rail (every dimension auto-becomes a filter)
 *   • Insight grid (10-14 auto-generated charts + narratives)
 *   • Chat rail (ask the dataset questions, get a chart back)
 *   • Save / Edit-schema actions
 *
 * Backend cached the parsed DataFrame; we hold a datasetId on the client.
 * Filters re-run insights via /filter. Chat sends the question to /chat,
 * which plans + computes + narrates in one round-trip.
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors,
    closestCenter, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, rectSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Upload, Database, Plus, Loader2, ChevronLeft,
    Save, FileSpreadsheet, Search, Tag,
    BarChart3, LineChart as LineIcon, PieChart as PieIcon,
    AlertCircle, CheckCircle2, X, Trash2,
    ArrowRight, RefreshCw, Send, Settings as SettingsIcon,
    MessageSquare, Filter as FilterIcon, ChevronDown, ChevronRight as ChevronRightIcon,
    Info, TrendingUp, Layers, Trophy, FileText, Hash,
    Pencil, GripVertical, Maximize2, Eye, EyeOff,
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { ViewMode } from '../../../types';
import { supabase } from '../../../services/supabase';

// ---------- API base ----------
const API_BASE = (typeof window !== 'undefined' && (window as any).REACH_API_BASE)
    || 'http://localhost:8000';

// ---------- Types ----------
interface Column {
    name: string;
    dtype: string;
    role: 'dimension' | 'metric' | 'date' | 'identifier' | 'geo';
    semantic: string;
    unit?: string;
    stats?: any;
    sample?: string[];
}

interface AnalysisSpec {
    id: string;
    title: string;
    type: 'kpi' | 'bar' | 'line' | 'pie' | 'heatmap';
    metric?: string;
    groupBy?: string;
    agg?: 'sum' | 'mean' | 'count' | 'min' | 'max';
    sort?: 'asc' | 'desc';
    limit?: number;
}

interface Insight {
    id: string;
    title: string;
    type: string;
    narrative: string;
    data?: Array<{ name: string; value: number }>;
    value?: number;
    label?: string;
    metric?: string;
    groupBy?: string;
    warning?: string;
}

interface ProjectRecord {
    id: string;
    name: string;
    category?: string;
    dataset_type?: string;
    source_meta?: { filename?: string; size?: number };
    schema?: Column[];
    preview_rows?: any[];
    insights?: Insight[];
    kpis?: Record<string, any>;
    is_shared?: boolean;
    created_at?: string;
    updated_at?: string;
}

interface ProfileResponse {
    datasetId?: string;
    datasetType: string;
    suggestedTitle: string;
    narrative: string;
    columns: Column[];
    preview: any[];
    kpis: Record<string, any>;
    suggestedAnalyses: AnalysisSpec[];
    mapping?: Record<string, string>;          // AI-detected slot → column name
    mappingKeys?: Record<string, string[]>;    // backend's PRESET_MAPPING_KEYS
    insights: Insight[]; // empty until user confirms type
    rowCount: number;
    fileMeta: { filename?: string; size?: number };
}

type DatasetType = 'sales' | 'inventory' | 'customers' | 'routes' | 'financials' | 'marketing' | 'other';

const DATASET_TYPE_DEFS: Array<{ id: DatasetType; en: string; ar: string; icon: any; gradient: string }> = [
    { id: 'sales',      en: 'Sales',      ar: 'المبيعات',     icon: BarChart3,      gradient: 'from-emerald-500 to-teal-500' },
    { id: 'customers',  en: 'Customers',  ar: 'العملاء',      icon: PieIcon,        gradient: 'from-cyan-500 to-blue-500' },
    { id: 'inventory',  en: 'Inventory',  ar: 'المخزون',      icon: Database,       gradient: 'from-purple-500 to-indigo-500' },
    { id: 'routes',     en: 'Routes',     ar: 'المسارات',     icon: ArrowRight,     gradient: 'from-amber-500 to-orange-500' },
    { id: 'financials', en: 'Financials', ar: 'المالية',      icon: LineIcon,       gradient: 'from-rose-500 to-pink-500' },
    { id: 'marketing',  en: 'Marketing',  ar: 'التسويق',      icon: Sparkles,       gradient: 'from-fuchsia-500 to-purple-500' },
    { id: 'other',      en: 'Generic',    ar: 'عام',          icon: FileSpreadsheet,gradient: 'from-slate-500 to-zinc-500' },
];

const SLOT_LABELS: Record<string, { en: string; ar: string }> = {
    amount:      { en: 'Amount / Sales',     ar: 'المبلغ / المبيعات' },
    quantity:    { en: 'Quantity',           ar: 'الكمية' },
    item:        { en: 'Item / Product',     ar: 'الصنف / المنتج' },
    category:    { en: 'Category',           ar: 'الفئة' },
    customer:    { en: 'Customer',           ar: 'العميل' },
    invoice:     { en: 'Invoice / Order #',  ar: 'الفاتورة / الطلب' },
    date:        { en: 'Date',               ar: 'التاريخ' },
    value:       { en: 'Value',              ar: 'القيمة' },
    location:    { en: 'Location',           ar: 'الموقع' },
    segment:     { en: 'Segment',            ar: 'الشريحة' },
    region:      { en: 'Region',             ar: 'المنطقة' },
    route:       { en: 'Route',              ar: 'المسار' },
    status:      { en: 'Status',             ar: 'الحالة' },
    account:     { en: 'Account',            ar: 'الحساب' },
    channel:     { en: 'Channel',            ar: 'القناة' },
    spend:       { en: 'Spend',              ar: 'الإنفاق' },
    conversions: { en: 'Conversions',        ar: 'التحويلات' },
    audience:    { en: 'Audience',           ar: 'الجمهور' },
};

// Fallback if /profile didn't return mappingKeys (older backend / re-open of saved project)
const FALLBACK_MAPPING_KEYS: Record<DatasetType, string[]> = {
    sales:      ['amount', 'quantity', 'item', 'category', 'customer', 'invoice', 'date'],
    inventory:  ['item', 'quantity', 'category', 'value', 'location'],
    customers:  ['customer', 'segment', 'value', 'region', 'date'],
    routes:     ['route', 'customer', 'status', 'date'],
    financials: ['amount', 'account', 'category', 'date'],
    marketing:  ['channel', 'spend', 'conversions', 'audience', 'date'],
    other:      [],
};

// ----------------------------------------------------------------
// Insight explanations (shown in hover tooltips)
// ----------------------------------------------------------------
const EXPLANATIONS: Record<string, { en: string; ar: string }> = {
    // sales
    'total-sales':        { en: 'Sum of every value in the Amount column. The headline revenue figure.', ar: 'مجموع كل القيم في عمود المبلغ — الرقم الرئيسي للإيرادات.' },
    'avg-sale':           { en: 'Average value per row in the Amount column (mean transaction size).', ar: 'متوسط قيمة الصف في عمود المبلغ (متوسط حجم المعاملة).' },
    'distinct-customers': { en: 'Number of unique customers that appear in the dataset (deduplicated).', ar: 'عدد العملاء الفريدين الذين يظهرون في البيانات (بدون تكرار).' },
    'distinct-items':     { en: 'Number of unique items / SKUs across the dataset.', ar: 'عدد الأصناف / المنتجات الفريدة في البيانات.' },
    'total-qty':          { en: 'Sum of the Quantity column — total units moved.', ar: 'مجموع عمود الكمية — إجمالي الوحدات المباعة.' },
    'distinct-invoices':  { en: 'Number of unique invoice / order numbers — how many transactions.', ar: 'عدد الفواتير / الطلبات الفريدة — كم معاملة تمت.' },
    'avg-lines-invoice':  { en: 'Average number of line-items per invoice. Computed as total rows ÷ distinct invoices.', ar: 'متوسط عدد البنود في الفاتورة. يحسب كـ (إجمالي الصفوف ÷ عدد الفواتير الفريدة).' },
    'top-items-sales':    { en: 'The 10 items with the highest total Sales (Amount summed per item, descending).', ar: 'أعلى 10 أصناف من حيث إجمالي المبيعات (مجموع المبلغ لكل صنف، بترتيب تنازلي).' },
    'top-customers':      { en: 'The 10 customers contributing the most revenue (Amount summed per customer).', ar: 'أعلى 10 عملاء مساهمة في الإيرادات (مجموع المبلغ لكل عميل).' },
    'sales-by-category':  { en: 'Total sales aggregated by product / item category (share of revenue).', ar: 'إجمالي المبيعات مجمّعة حسب فئة المنتج (نصيب كل فئة من الإيرادات).' },
    'top-items-qty':      { en: 'The 10 items with the highest total Quantity sold (units, not value).', ar: 'أعلى 10 أصناف من حيث إجمالي الكمية المباعة (بالوحدات لا بالقيمة).' },
    'qty-by-category':    { en: 'Total quantity sold aggregated by category.', ar: 'إجمالي الكمية المباعة مجمّعة حسب الفئة.' },
    'sales-trend':        { en: 'Sales summed per day, ordered chronologically. Look for spikes, dips, and seasonality.', ar: 'المبيعات مجمّعة يومياً ومرتّبة زمنياً. ابحث عن القمم والفجوات والموسمية.' },
    // inventory
    'total-stock':        { en: 'Sum of the Quantity column — total units in stock.', ar: 'مجموع عمود الكمية — إجمالي الوحدات في المخزون.' },
    'avg-stock':          { en: 'Average stock per row.', ar: 'متوسط المخزون لكل صف.' },
    'total-value':        { en: 'Sum of the Value column — inventory book value.', ar: 'مجموع عمود القيمة — القيمة الدفترية للمخزون.' },
    'top-items-stock':    { en: '10 items with the highest stock quantity.', ar: '10 أصناف بأعلى كمية مخزون.' },
    'low-items-stock':    { en: '10 items with the lowest stock quantity — restock candidates.', ar: '10 أصناف بأقل كمية مخزون — مرشحة لإعادة التزويد.' },
    'stock-by-category':  { en: 'Total stock quantity grouped by category.', ar: 'إجمالي كمية المخزون مجمّعة حسب الفئة.' },
    'value-by-category':  { en: 'Total value grouped by category.', ar: 'إجمالي القيمة مجمّعة حسب الفئة.' },
    'stock-by-location':  { en: 'Total stock by warehouse / location.', ar: 'إجمالي المخزون حسب المستودع / الموقع.' },
    // customers
    'avg-value':          { en: 'Average value per customer (mean of the Value column).', ar: 'متوسط القيمة لكل عميل (متوسط عمود القيمة).' },
    'by-segment':         { en: 'Customer count by segment / tier — share of base.', ar: 'عدد العملاء حسب الشريحة — نصيب كل شريحة من القاعدة.' },
    'value-by-segment':   { en: 'Total value contributed by each segment.', ar: 'إجمالي القيمة المساهمة من كل شريحة.' },
    'by-region':          { en: 'Customer count by region / geography.', ar: 'عدد العملاء حسب المنطقة الجغرافية.' },
    'acquisition-trend':  { en: 'New customers added per day, chronologically.', ar: 'العملاء الجدد المضافون يومياً، بترتيب زمني.' },
    // routes
    'total-visits':       { en: 'Total number of visit rows in the dataset.', ar: 'إجمالي عدد صفوف الزيارة في البيانات.' },
    'distinct-routes':    { en: 'Number of unique route IDs.', ar: 'عدد معرّفات المسارات الفريدة.' },
    'avg-cust-per-route': { en: 'Average visits per route (rows ÷ distinct routes).', ar: 'متوسط الزيارات لكل مسار (الصفوف ÷ عدد المسارات الفريدة).' },
    'by-status':          { en: 'Visit count by status (e.g. completed, no-show, pending).', ar: 'عدد الزيارات حسب الحالة (مثل: مكتمل، لم يحضر، قيد الانتظار).' },
    'visits-by-route':    { en: 'Number of visits handled by each route.', ar: 'عدد الزيارات لكل مسار.' },
    'trend':              { en: 'Total visits per day, ordered chronologically.', ar: 'إجمالي الزيارات يومياً، بترتيب زمني.' },
    // financials
    'total-amount':       { en: 'Sum of every transaction Amount.', ar: 'مجموع كل قيم المعاملات.' },
    'avg-amount':         { en: 'Average transaction value (mean of Amount).', ar: 'متوسط قيمة المعاملة (متوسط المبلغ).' },
    'tx-count':           { en: 'Total number of transaction rows.', ar: 'إجمالي عدد صفوف المعاملات.' },
    'by-account':         { en: 'Total Amount by account.', ar: 'إجمالي المبلغ لكل حساب.' },
    'by-category':        { en: 'Total Amount by category — share of spend.', ar: 'إجمالي المبلغ لكل فئة — نصيب كل فئة من الإنفاق.' },
    // marketing
    'total-spend':        { en: 'Sum of all marketing Spend.', ar: 'مجموع الإنفاق التسويقي.' },
    'total-conv':         { en: 'Sum of all Conversions.', ar: 'مجموع التحويلات.' },
    'spend-by-channel':   { en: 'Spend distribution by marketing channel.', ar: 'توزيع الإنفاق حسب القناة التسويقية.' },
    'conv-by-channel':    { en: 'Conversions per channel — what is working.', ar: 'التحويلات لكل قناة — أي قناة تنجح.' },
    'by-audience':        { en: 'Conversions by audience / persona.', ar: 'التحويلات حسب الجمهور / الشخصية.' },
    'spend-trend':        { en: 'Marketing spend per day, chronologically.', ar: 'الإنفاق التسويقي يومياً، بترتيب زمني.' },
};

const explainInsight = (ins: Insight, isAr: boolean): string => {
    const direct = EXPLANATIONS[ins.id];
    if (direct) return isAr ? direct.ar : direct.en;
    // Fallback templated explanation built from the spec.
    const aggMap: Record<string, { en: string; ar: string }> = {
        sum:               { en: 'Sum of',           ar: 'مجموع' },
        mean:              { en: 'Average of',       ar: 'متوسط' },
        count:             { en: 'Count of',         ar: 'عدد' },
        min:               { en: 'Min of',           ar: 'أصغر قيمة في' },
        max:               { en: 'Max of',           ar: 'أكبر قيمة في' },
        nunique:           { en: 'Distinct count of',ar: 'عدد القيم الفريدة في' },
        rows_per_distinct: { en: 'Rows per distinct',ar: 'صفوف لكل قيمة فريدة في' },
    };
    const a = aggMap[(ins as any).agg || 'sum'] || aggMap.sum;
    const aLabel = isAr ? a.ar : a.en;
    const m = ins.metric || (isAr ? 'الصفوف' : 'rows');
    if (ins.type === 'kpi') return `${aLabel} ${m}.`;
    const gb = ins.groupBy || '';
    return isAr
        ? `${aLabel} ${m} مجمّعة حسب ${gb}.`
        : `${aLabel} ${m}, grouped by ${gb}.`;
};

// ----------------------------------------------------------------
// Calculation formula — shows "SUM(Net_Sales)", "DISTINCT(Client_Code)",
// "COUNT(rows) ÷ DISTINCT(Invoice_No)" etc on each card so users know
// exactly how the value was computed.
// ----------------------------------------------------------------
const formatFormula = (insight: Insight): string => {
    const agg = String((insight as any).agg || '').toLowerCase();
    const metric = insight.metric || '';
    const groupBy = insight.groupBy || '';
    const limit = (insight as any).limit;
    const sort = (insight as any).sort;
    const AGG_DISPLAY: Record<string, string> = {
        sum: 'SUM', mean: 'AVG', count: 'COUNT',
        min: 'MIN', max: 'MAX', nunique: 'DISTINCT',
    };
    if (agg === 'rows_per_distinct') {
        return `COUNT(rows) ÷ DISTINCT(${metric || '—'})`;
    }
    let base: string;
    if (!agg || agg === 'count') {
        base = metric ? `COUNT(${metric})` : 'COUNT(rows)';
    } else if (agg === 'nunique') {
        base = `DISTINCT(${metric || groupBy || 'rows'})`;
    } else {
        const aggName = AGG_DISPLAY[agg] || agg.toUpperCase();
        base = metric ? `${aggName}(${metric})` : `${aggName}(rows)`;
    }
    if (groupBy && insight.type !== 'kpi') {
        base += ` by ${groupBy}`;
    }
    if (limit && insight.type === 'bar' && sort === 'desc') {
        base += `, top ${limit}`;
    } else if (limit && insight.type === 'bar' && sort === 'asc') {
        base += `, bottom ${limit}`;
    }
    return base;
};

// ----------------------------------------------------------------
// Number formatting — compact for big values, locale separators otherwise.
// ----------------------------------------------------------------
const formatCompact = (n: number): string => {
    if (!isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (abs >= 1_000_000)     return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (abs >= 10_000)        return (n / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K';
    if (Number.isInteger(n))  return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// ----------------------------------------------------------------
// InfoTip — small (i) icon with hover/click tooltip.
// Tooltip is portalled to document.body so it isn't clipped by card overflow,
// and it auto-clamps to the viewport edges so it never goes off-screen.
// ----------------------------------------------------------------
const InfoTip: React.FC<{ text: string }> = ({ text }) => {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; flip: boolean }>({ top: 0, left: 0, flip: false });
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open || !btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        const TT_W = 280;
        const TT_H_EST = 80;
        const margin = 8;
        // Center horizontally on the icon, then clamp to viewport.
        let left = rect.left + rect.width / 2;
        left = Math.min(Math.max(left, TT_W / 2 + margin), window.innerWidth - TT_W / 2 - margin);
        // Place below by default; flip to above if not enough room.
        const spaceBelow = window.innerHeight - rect.bottom;
        const flip = spaceBelow < TT_H_EST + margin;
        const top = flip ? rect.top - margin : rect.bottom + margin;
        setCoords({ top, left, flip });
    }, [open]);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                aria-label="More info"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white/30 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
                <Info className="w-3.5 h-3.5" />
            </button>
            {open && typeof document !== 'undefined' && createPortal(
                <div
                    className={`pointer-events-none fixed z-[9999] w-[280px] px-3 py-2 rounded-lg bg-slate-900/95 border border-emerald-500/30 shadow-2xl text-[11px] text-white/85 leading-relaxed font-normal normal-case ${coords.flip ? '-translate-y-full' : ''}`}
                    style={{ top: coords.top, left: coords.left, transform: `translateX(-50%)${coords.flip ? ' translateY(-100%)' : ''}` }}
                >
                    {text}
                </div>,
                document.body,
            )}
        </>
    );
};

interface ChatTurn {
    role: 'user' | 'assistant';
    content: string;
    insight?: Insight | null;
}

// ---------- Component ----------
interface Props {
    companyId?: string;
    userId?: string;
    userBranchIds?: string[];
    isDarkMode?: boolean;
    language?: 'en' | 'ar';
    onBack?: () => void;
    hideHeader?: boolean;
}

const DataAssistV2: React.FC<Props> = ({
    companyId,
    userId,
    userBranchIds,
    language = 'en',
    onBack,
    hideHeader,
}) => {
    const isAr = language === 'ar';

    // mode = list | source-pick | confirm-type | dashboard
    const [mode, setMode] = useState<'list' | 'source' | 'confirm' | 'dashboard'>('list');

    // confirm-type state
    const [confirmType, setConfirmType] = useState<DatasetType>('other');
    const [confirmMapping, setConfirmMapping] = useState<Record<string, string>>({});

    // project list state
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');

    // dashboard state
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
    const [filteredKpis, setFilteredKpis] = useState<any | null>(null);
    const [filterApplying, setFilterApplying] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    // Per-card layout state (delete / resize / reorder). Persisted in localStorage by datasetId.
    const [hiddenCardIds, setHiddenCardIds] = useState<Set<string>>(new Set());
    const [cardSizes, setCardSizes] = useState<Record<string, 'compact' | 'normal' | 'wide'>>({});
    const [cardOrder, setCardOrder] = useState<string[]>([]);
    // End-user "clean" view — hides explanations, formulas, narratives, type badges.
    const [cleanView, setCleanView] = useState(false);
    const [schemaOpen, setSchemaOpen] = useState(false);

    // upload state
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [processingStage, setProcessingStage] = useState('');

    // save dialog state
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [saveCategory, setSaveCategory] = useState('');
    const [saveShared, setSaveShared] = useState(false);
    const [savingState, setSavingState] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');

    // ---------- list fetch ----------
    const fetchProjects = useCallback(async () => {
        if (!companyId) return;
        setLoadingList(true);
        try {
            const { data, error } = await supabase
                .from('data_assist_projects')
                .select('*')
                .eq('company_id', companyId)
                .or(`user_id.eq.${userId},is_shared.eq.true`)
                .order('updated_at', { ascending: false });
            if (error) throw error;
            setProjects((data as ProjectRecord[]) || []);
        } catch (e: any) {
            console.warn('[DataAssist] list fetch failed:', e?.message);
            setProjects([]);
        } finally {
            setLoadingList(false);
        }
    }, [companyId, userId]);

    useEffect(() => { void fetchProjects(); }, [fetchProjects]);

    const allCategories = useMemo(() => {
        const s = new Set<string>();
        projects.forEach(p => { if (p.category) s.add(p.category); });
        return Array.from(s).sort();
    }, [projects]);

    const filteredProjects = useMemo(() => {
        let list = projects;
        if (filterCategory !== 'All') list = list.filter(p => p.category === filterCategory);
        if (searchTerm.trim()) {
            const t = searchTerm.toLowerCase();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(t) ||
                p.category?.toLowerCase().includes(t) ||
                p.dataset_type?.toLowerCase().includes(t)
            );
        }
        return list;
    }, [projects, filterCategory, searchTerm]);

    // ---------- start a new project ----------
    const startNew = () => {
        setProfile(null);
        setInsights([]);
        setActiveFilters({});
        setFilteredKpis(null);
        setChatHistory([]);
        setErrorMsg(null);
        setMode('source');
    };

    const openProject = (p: ProjectRecord) => {
        // Re-open a saved project. Cache may be expired — flagged on chat/filter.
        setProfile({
            datasetId: undefined,
            datasetType: p.dataset_type || 'other',
            suggestedTitle: p.name,
            narrative: '',
            columns: p.schema || [],
            preview: p.preview_rows || [],
            kpis: p.kpis || {},
            suggestedAnalyses: [],
            insights: p.insights || [],
            rowCount: (p.preview_rows || []).length,
            fileMeta: p.source_meta || {},
        });
        setInsights(p.insights || []);
        setActiveFilters({});
        setFilteredKpis(null);
        setChatHistory([]);
        setSaveName(p.name);
        setSaveCategory(p.category || '');
        setSaveShared(!!p.is_shared);
        setMode('dashboard');
    };

    const deleteProject = async (id: string) => {
        if (!confirm(isAr ? 'هل تريد حذف هذا المشروع؟' : 'Delete this project?')) return;
        try {
            const { error } = await supabase.from('data_assist_projects').delete().eq('id', id);
            if (error) throw error;
            setProjects(prev => prev.filter(p => p.id !== id));
        } catch (e: any) {
            alert(`Delete failed: ${e?.message}`);
        }
    };

    // ---------- upload + auto-dashboard ----------
    const handleProfile = async (req: { file?: File; reachTable?: string }) => {
        setErrorMsg(null);
        setIsProcessing(true);
        setProcessingStage(isAr ? 'يقرأ الملف...' : 'Reading file...');
        try {
            let r: Response;
            if (req.file) {
                const fd = new FormData();
                fd.append('file', req.file);
                fd.append('user_id', userId || '');
                r = await fetch(`${API_BASE}/data-assist/profile`, { method: 'POST', body: fd });
            } else if (req.reachTable) {
                if (!companyId || !userId) throw new Error(isAr ? 'لا توجد بيانات شركة' : 'No company context');
                r = await fetch(`${API_BASE}/data-assist/from-reach-table`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId, company_id: companyId,
                        table: req.reachTable, branch_ids: userBranchIds,
                    }),
                });
            } else {
                throw new Error('Bad request');
            }

            setProcessingStage(isAr ? 'الذكاء يحلل البيانات...' : 'AI is analyzing the data...');
            if (!r.ok) throw new Error(await r.text());
            const data: ProfileResponse = await r.json();

            setProfile(data);
            setInsights([]);
            setActiveFilters({});
            setFilteredKpis(null);
            setChatHistory([]);
            setSaveName(data.suggestedTitle);
            // Default the confirm-type screen to whatever the AI detected.
            const detected = (data.datasetType as DatasetType) || 'other';
            setConfirmType(DATASET_TYPE_DEFS.some(d => d.id === detected) ? detected : 'other');
            setConfirmMapping(data.mapping || {});
            setMode('confirm');
        } catch (e: any) {
            setErrorMsg(e?.message || 'Failed');
        } finally {
            setIsProcessing(false);
            setProcessingStage('');
        }
    };

    // ---------- card layout handlers (delete / resize / reorder) ----------
    // Reset layout state when a fresh dataset is loaded.
    useEffect(() => {
        setHiddenCardIds(new Set());
        setCardSizes({});
        setCardOrder([]);
    }, [profile?.datasetId]);

    const onCardDelete = useCallback((id: string) => {
        setHiddenCardIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);
    const onCardResize = useCallback((id: string, size: 'compact' | 'normal' | 'wide') => {
        setCardSizes(prev => ({ ...prev, [id]: size }));
    }, []);
    const onCardReorder = useCallback((sourceId: string, targetId: string) => {
        if (!sourceId || sourceId === targetId) return;
        setCardOrder(prev => {
            const allIds = insights.map(i => i.id);
            // Seed order with current insight order if empty
            let order = prev.length ? [...prev] : [...allIds];
            // Make sure both ids exist
            if (!order.includes(sourceId)) order.push(sourceId);
            if (!order.includes(targetId)) order.push(targetId);
            const fromIdx = order.indexOf(sourceId);
            const toIdx = order.indexOf(targetId);
            if (fromIdx === -1 || toIdx === -1) return prev;
            order.splice(fromIdx, 1);
            order.splice(toIdx, 0, sourceId);
            return order;
        });
    }, [insights]);
    const onLayoutReset = useCallback(() => {
        setHiddenCardIds(new Set());
        setCardSizes({});
        setCardOrder([]);
    }, []);

    // Edit-calculation modal state. The user picks a card → modal opens with current spec.
    const [editingInsight, setEditingInsight] = useState<Insight | null>(null);
    const [editBusy, setEditBusy] = useState(false);
    const onCardEdit = useCallback((ins: Insight) => setEditingInsight(ins), []);
    const onCardEditSave = useCallback(async (originalId: string, newSpec: AnalysisSpec) => {
        if (!profile?.datasetId) return;
        setEditBusy(true);
        try {
            const r = await fetch(`${API_BASE}/data-assist/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: profile.datasetId,
                    schema_columns: profile.columns,
                    analyses: [newSpec],
                    dataset_type: profile.datasetType,
                    title: profile.suggestedTitle,
                }),
            });
            if (!r.ok) {
                if (r.status === 410) throw new Error(isAr ? 'انتهت صلاحية البيانات. أعد الرفع.' : 'Dataset cache expired. Re-upload.');
                throw new Error(await r.text());
            }
            const data = await r.json();
            const fresh: Insight | undefined = (data.insights || [])[0];
            if (!fresh) throw new Error('No insight returned');
            // Replace the original card in-place so its position is preserved.
            setInsights(prev => prev.map(i => i.id === originalId ? { ...fresh, id: originalId } : i));
            setEditingInsight(null);
        } catch (e: any) {
            alert(`Re-run failed: ${e?.message}`);
        } finally {
            setEditBusy(false);
        }
    }, [profile, isAr]);

    // ---------- confirm-type → run curated analyses ----------
    const runAnalyzeByType = async () => {
        if (!profile?.datasetId) {
            setErrorMsg(isAr ? 'انتهت صلاحية البيانات. أعد الرفع.' : 'Dataset cache expired. Re-upload.');
            return;
        }
        setIsProcessing(true);
        setProcessingStage(isAr ? 'يحسب الذكاء الاصطناعي مؤشرات الأداء...' : 'AI is computing KPIs...');
        setErrorMsg(null);
        try {
            const r = await fetch(`${API_BASE}/data-assist/analyze-by-type`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: profile.datasetId,
                    dataset_type: confirmType,
                    mapping: confirmMapping,
                    title: profile.suggestedTitle,
                    fallback_analyses: confirmType === 'other' ? profile.suggestedAnalyses : null,
                }),
            });
            if (!r.ok) {
                if (r.status === 410) throw new Error(isAr ? 'انتهت صلاحية البيانات. أعد الرفع.' : 'Dataset cache expired. Re-upload.');
                throw new Error(await r.text());
            }
            const data = await r.json();
            // Persist the confirmed type + applied analyses on the profile so saving / filtering use them.
            setProfile(prev => prev ? {
                ...prev,
                datasetType: confirmType,
                suggestedAnalyses: data.appliedAnalyses || prev.suggestedAnalyses,
            } : prev);
            setInsights(data.insights || []);
            setMode('dashboard');
        } catch (e: any) {
            setErrorMsg(e?.message || 'Failed');
        } finally {
            setIsProcessing(false);
            setProcessingStage('');
        }
    };

    // ---------- filter ----------
    // Debounce server calls so rapid checkbox clicks coalesce into one round-trip.
    // We also abort in-flight requests so old responses don't overwrite newer ones.
    const filterTimerRef = useRef<number | null>(null);
    const filterAbortRef = useRef<AbortController | null>(null);

    const runFilters = useCallback(async (next: Record<string, string[]>) => {
        if (!profile?.datasetId) return;
        // Cancel any in-flight request
        if (filterAbortRef.current) filterAbortRef.current.abort();
        const ctrl = new AbortController();
        filterAbortRef.current = ctrl;
        setFilterApplying(true);
        try {
            const r = await fetch(`${API_BASE}/data-assist/filter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: profile.datasetId,
                    filters: next,
                    analyses: profile.suggestedAnalyses,
                }),
                signal: ctrl.signal,
            });
            if (!r.ok) {
                if (r.status === 410) {
                    setErrorMsg(isAr ? 'انتهت صلاحية البيانات (ساعة). يرجى إعادة الرفع.' : 'Dataset cache expired (1 hour). Please re-upload.');
                    return;
                }
                throw new Error(await r.text());
            }
            const data = await r.json();
            setInsights(data.insights || []);
            setFilteredKpis(data.kpis);
        } catch (e: any) {
            if (e?.name === 'AbortError') return; // newer request superseded us
            console.warn('[DataAssist] filter failed:', e?.message);
        } finally {
            if (filterAbortRef.current === ctrl) {
                setFilterApplying(false);
                filterAbortRef.current = null;
            }
        }
    }, [profile, isAr]);

    const applyFilters = useCallback((next: Record<string, string[]>) => {
        // Optimistic UI: update active filters immediately so checkboxes feel instant.
        setActiveFilters(next);
        if (!profile?.datasetId) return;
        // Debounce — batch rapid clicks into a single server call after 250ms idle.
        if (filterTimerRef.current) window.clearTimeout(filterTimerRef.current);
        filterTimerRef.current = window.setTimeout(() => {
            filterTimerRef.current = null;
            void runFilters(next);
        }, 250);
    }, [profile?.datasetId, runFilters]);

    const toggleFilterValue = (col: string, val: string) => {
        const cur = activeFilters[col] || [];
        const next = { ...activeFilters };
        if (cur.includes(val)) {
            const nv = cur.filter(v => v !== val);
            if (nv.length === 0) delete next[col]; else next[col] = nv;
        } else {
            next[col] = [...cur, val];
        }
        applyFilters(next);
    };

    const setFilterValues = (col: string, values: string[]) => {
        const next = { ...activeFilters };
        if (values.length === 0) delete next[col]; else next[col] = values;
        applyFilters(next);
    };

    const clearAllFilters = () => {
        if (Object.keys(activeFilters).length === 0) return;
        applyFilters({});
    };

    // Click-to-filter from a chart object (bar, pie slice, line point).
    // Toggles the clicked value in the filter for that column.
    const onChartClick = useCallback((column: string, value: string) => {
        if (!column || value == null) return;
        const cur = activeFilters[column] || [];
        const next = { ...activeFilters };
        if (cur.includes(value)) {
            const nv = cur.filter(v => v !== value);
            if (nv.length === 0) delete next[column]; else next[column] = nv;
        } else {
            next[column] = [...cur, value];
        }
        applyFilters(next);
    }, [activeFilters, applyFilters]);

    // ---------- chat ----------
    const askQuestion = async () => {
        if (!chatInput.trim() || !profile?.datasetId) return;
        const q = chatInput.trim();
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', content: q }]);
        setChatBusy(true);
        try {
            const r = await fetch(`${API_BASE}/data-assist/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset_id: profile.datasetId,
                    question: q,
                    schema_columns: profile.columns,
                }),
            });
            if (!r.ok) {
                if (r.status === 410) throw new Error(isAr ? 'انتهت صلاحية البيانات. يرجى إعادة الرفع.' : 'Dataset cache expired. Please re-upload.');
                throw new Error(await r.text());
            }
            const data = await r.json();
            setChatHistory(prev => [...prev, { role: 'assistant', content: data.answer || '—', insight: data.insight }]);
            // Optional: also add the chart to the main grid
            if (data.insight) setInsights(prev => [data.insight, ...prev]);
        } catch (e: any) {
            setChatHistory(prev => [...prev, { role: 'assistant', content: `❗ ${e?.message || 'Failed'}` }]);
        } finally {
            setChatBusy(false);
        }
    };

    // ---------- save ----------
    const saveProject = async () => {
        if (!companyId || !userId) { alert('Missing context'); return; }
        if (!saveName.trim()) { alert(isAr ? 'يرجى إدخال اسم' : 'Please enter a name'); return; }
        setSavingState('saving');
        try {
            const payload = {
                user_id: userId, company_id: companyId,
                name: saveName.trim(),
                category: saveCategory.trim() || null,
                is_shared: saveShared,
                source_type: profile?.fileMeta?.filename?.endsWith('.reach') ? 'reach_table' : 'upload',
                source_meta: profile?.fileMeta || {},
                dataset_type: profile?.datasetType || null,
                schema: profile?.columns || [],
                preview_rows: (profile?.preview || []).slice(0, 200),
                insights: insights || [],
                kpis: filteredKpis || profile?.kpis || {},
            };
            const { error } = await supabase.from('data_assist_projects').insert(payload);
            if (error) throw error;
            setSavingState('ok');
            setTimeout(() => {
                setSavingState('idle'); setSaveOpen(false);
                setMode('list');
                void fetchProjects();
            }, 700);
        } catch (e: any) {
            console.warn(e);
            setSavingState('err');
            alert(`Save failed: ${e?.message}`);
            setTimeout(() => setSavingState('idle'), 1000);
        }
    };

    // ===================== RENDER =====================
    return (
        <div data-reach-screen className="flex-1 flex flex-col w-full bg-[#0a0a14] font-sans transition-colors overflow-x-hidden min-h-screen relative">
            <div className="fixed inset-0 pointer-events-none opacity-25 z-0">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-teal-500/10 rounded-full blur-3xl" />
            </div>

            {!hideHeader && (
                <div className="shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-b border-white/5 backdrop-blur-xl bg-[#0a0a14]/80 sticky top-0 z-30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        {(onBack && mode === 'list') && (
                            <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full">
                                <ChevronLeft className="w-5 h-5 text-white/60" />
                            </button>
                        )}
                        {mode !== 'list' && (
                            <button onClick={() => setMode('list')} className="p-2 hover:bg-white/5 rounded-full">
                                <ChevronLeft className="w-5 h-5 text-white/60" />
                            </button>
                        )}
                        <div className="relative shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl blur-md opacity-60" />
                            <div className="relative p-2.5 bg-gradient-to-br from-emerald-400 via-cyan-500 to-teal-500 rounded-2xl shadow-lg">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                                    {mode === 'dashboard' && profile ? profile.suggestedTitle : (isAr ? 'مساعد البيانات' : 'Data Assist')}
                                </h2>
                                {mode === 'dashboard' && profile && (
                                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-widest">
                                        {profile.datasetType}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-white/50 font-medium hidden sm:block">
                                {mode === 'dashboard' && profile
                                    ? (isAr ? `${(filteredKpis?.rows ?? profile.kpis?.rows ?? 0).toLocaleString()} صف · ${profile.columns.length} عمود` : `${(filteredKpis?.rows ?? profile.kpis?.rows ?? 0).toLocaleString()} rows · ${profile.columns.length} cols`)
                                    : (isAr ? 'حمّل بياناتك ودع الذكاء الاصطناعي يكتشف الأنماط' : 'Drop your data and let AI surface the insights')}
                            </p>
                        </div>
                    </div>
                    {mode === 'dashboard' && profile && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSchemaOpen(true)}
                                className="px-3 py-1.5 text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-1.5"
                                title={isAr ? 'المخطط' : 'Schema'}
                            >
                                <SettingsIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{isAr ? 'المخطط' : 'Schema'}</span>
                            </button>
                            <button
                                onClick={() => setSaveOpen(true)}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 text-white text-xs font-black rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-500/30"
                            >
                                <Save className="w-3.5 h-3.5" /> {isAr ? 'حفظ' : 'Save'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto w-full">
                {mode === 'list' && (
                    <ProjectsListView
                        isAr={isAr}
                        projects={filteredProjects}
                        loadingList={loadingList}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filterCategory={filterCategory}
                        setFilterCategory={setFilterCategory}
                        allCategories={allCategories}
                        onNew={startNew}
                        onOpen={openProject}
                        onDelete={deleteProject}
                    />
                )}

                {mode === 'source' && !isProcessing && (
                    <SourcePicker
                        isAr={isAr}
                        onUploadFile={(f) => handleProfile({ file: f })}
                        onPullReachTable={(t) => handleProfile({ reachTable: t })}
                    />
                )}

                {mode === 'confirm' && !isProcessing && profile && (
                    <ConfirmTypeStep
                        isAr={isAr}
                        profile={profile}
                        selectedType={confirmType}
                        setSelectedType={setConfirmType}
                        mapping={confirmMapping}
                        setMapping={setConfirmMapping}
                        onAnalyze={runAnalyzeByType}
                        onBack={() => setMode('source')}
                    />
                )}

                {isProcessing && <Processing isAr={isAr} stage={processingStage} />}

                {errorMsg && (
                    <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        <div className="flex-1 text-sm text-rose-300">{errorMsg}</div>
                        <button onClick={() => setErrorMsg(null)} className="text-rose-400/60 hover:text-rose-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {mode === 'dashboard' && profile && (
                    <Dashboard
                        isAr={isAr}
                        profile={profile}
                        insights={insights}
                        filteredKpis={filteredKpis}
                        activeFilters={activeFilters}
                        onToggleFilterValue={toggleFilterValue}
                        onSetFilterValues={setFilterValues}
                        onClearFilters={clearAllFilters}
                        filterApplying={filterApplying}
                        chatOpen={chatOpen}
                        setChatOpen={setChatOpen}
                        chatHistory={chatHistory}
                        chatInput={chatInput}
                        setChatInput={setChatInput}
                        chatBusy={chatBusy}
                        onAsk={askQuestion}
                        hiddenCardIds={hiddenCardIds}
                        cardSizes={cardSizes}
                        cardOrder={cardOrder}
                        onCardDelete={onCardDelete}
                        onCardResize={onCardResize}
                        onCardReorder={onCardReorder}
                        onCardEdit={onCardEdit}
                        onLayoutReset={onLayoutReset}
                        cleanView={cleanView}
                        setCleanView={setCleanView}
                        onChartClick={onChartClick}
                    />
                )}
            </div>

            {saveOpen && (
                <SaveDialog
                    isAr={isAr}
                    name={saveName} setName={setSaveName}
                    category={saveCategory} setCategory={setSaveCategory}
                    isShared={saveShared} setIsShared={setSaveShared}
                    allCategories={allCategories}
                    state={savingState}
                    onCancel={() => setSaveOpen(false)}
                    onSave={saveProject}
                />
            )}

            {schemaOpen && profile && (
                <SchemaModal
                    isAr={isAr}
                    columns={profile.columns}
                    onClose={() => setSchemaOpen(false)}
                />
            )}

            {editingInsight && profile && (
                <EditCalculationModal
                    isAr={isAr}
                    insight={editingInsight}
                    columns={profile.columns}
                    busy={editBusy}
                    onCancel={() => setEditingInsight(null)}
                    onSave={(spec) => onCardEditSave(editingInsight.id, spec)}
                />
            )}
        </div>
    );
};

// ============================================================
// Projects List
// ============================================================

const ProjectsListView: React.FC<any> = ({ isAr, projects, loadingList, searchTerm, setSearchTerm, filterCategory, setFilterCategory, allCategories, onNew, onOpen, onDelete }) => (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                    type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder={isAr ? 'ابحث في مشاريعك...' : 'Search your projects...'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
            </div>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm focus:outline-none">
                <option value="All">{isAr ? 'كل التصنيفات' : 'All Categories'}</option>
                {allCategories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={onNew} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 text-white text-sm font-black rounded-xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 whitespace-nowrap transition-all active:scale-95">
                <Plus className="w-4 h-4" /> {isAr ? 'مشروع جديد' : 'New Project'}
            </button>
        </div>
        {loadingList ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
                <p className="text-white/50 font-bold">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
            </div>
        ) : projects.length === 0 ? (
            <EmptyState isAr={isAr} onNew={onNew} />
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {projects.map((p: ProjectRecord) => (
                    <ProjectCard key={p.id} isAr={isAr} project={p} onOpen={() => onOpen(p)} onDelete={() => onDelete(p.id)} />
                ))}
            </div>
        )}
    </div>
);

const EmptyState: React.FC<{ isAr: boolean; onNew: () => void }> = ({ isAr, onNew }) => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative w-32 h-32 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-teal-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-14 h-14 text-emerald-300" />
            </div>
        </div>
        <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">
            {isAr ? 'دع الذكاء يحلل بياناتك' : 'Let AI analyze your data'}
        </h3>
        <p className="text-white/50 max-w-md mb-8 leading-relaxed">
            {isAr
                ? 'اسحب أي ملف Excel أو CSV. الذكاء الاصطناعي سيكتشف نوع البيانات تلقائياً وينشئ لك لوحة معلومات كاملة.'
                : 'Drop any Excel or CSV. AI auto-detects the data type and builds a full dashboard for you to explore — with filters, charts, and Q&A.'}
        </p>
        <button onClick={onNew} className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 text-white text-sm font-black rounded-xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all active:scale-95">
            <Plus className="w-5 h-5" /> {isAr ? 'ابدأ' : 'Start'}
        </button>
    </div>
);

const ProjectCard: React.FC<{ isAr: boolean; project: ProjectRecord; onOpen: () => void; onDelete: () => void }> = ({ isAr, project, onOpen, onDelete }) => {
    const insightCount = project.insights?.length || 0;
    const updated = project.updated_at ? new Date(project.updated_at).toLocaleDateString() : '';
    const fmtSize = (b?: number) => !b ? '' : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
    return (
        <div className="group relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-emerald-500/10" onClick={onOpen}>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" title={isAr ? 'حذف' : 'Delete'}>
                <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-3 mb-3">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl shrink-0">
                    {project.dataset_type === 'sales' ? <BarChart3 className="w-5 h-5 text-emerald-300" /> :
                     project.dataset_type === 'inventory' ? <Database className="w-5 h-5 text-cyan-300" /> :
                     <FileSpreadsheet className="w-5 h-5 text-teal-300" />}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-white truncate">{project.name}</h4>
                    {project.category && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300/80 bg-emerald-500/10 rounded border border-emerald-500/20">
                            <Tag className="w-2.5 h-2.5" /> {project.category}
                        </span>
                    )}
                </div>
            </div>
            <div className="space-y-1.5 text-[11px] text-white/40">
                {project.dataset_type && <div className="font-bold uppercase tracking-wider">{project.dataset_type}</div>}
                <div className="flex items-center justify-between text-[10px]">
                    <span>{insightCount} {isAr ? 'رؤية' : 'insights'}</span>
                    {project.source_meta?.size ? <span>{fmtSize(project.source_meta?.size)}</span> : null}
                </div>
                {updated && <div className="text-[10px] text-white/30">{isAr ? 'آخر تعديل:' : 'Updated:'} {updated}</div>}
            </div>
        </div>
    );
};

// ============================================================
// Source picker
// ============================================================

const SourcePicker: React.FC<{
    isAr: boolean;
    onUploadFile: (f: File) => void;
    onPullReachTable: (t: string) => void;
}> = ({ isAr, onUploadFile, onPullReachTable }) => {
    const [drag, setDrag] = useState(false);
    const [showReach, setShowReach] = useState(false);
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onUploadFile(f); }}
                className={`relative bg-gradient-to-br from-emerald-500/[0.04] to-cyan-500/[0.02] border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${drag ? 'border-emerald-400 bg-emerald-500/10' : 'border-emerald-500/30'}`}
            >
                <input id="data-assist-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFile(f); }} />
                <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl blur-xl opacity-50" />
                    <div className="relative p-4 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl">
                        <Upload className="w-10 h-10 text-white" />
                    </div>
                </div>
                <h3 className="text-xl font-black text-white mb-2">{isAr ? 'حمّل ملف بياناتك' : 'Drop your data file'}</h3>
                <p className="text-sm text-white/50 mb-5">{isAr ? 'Excel أو CSV — حتى 100 ميجا، 500,000 صف' : 'Excel or CSV — up to 100 MB, 500,000 rows'}</p>
                <label htmlFor="data-assist-file-input" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 text-white text-sm font-black rounded-xl shadow-lg cursor-pointer transition-all active:scale-95">
                    <FileSpreadsheet className="w-4 h-4" /> {isAr ? 'اختر ملفاً' : 'Choose file'}
                </label>
                <div className="mt-6 flex justify-center gap-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    <span>.xlsx</span><span>·</span><span>.xls</span><span>·</span><span>.csv</span>
                </div>
            </div>
            <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-8 sm:p-12">
                <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl blur-xl opacity-40" />
                    <div className="relative p-4 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl">
                        <Database className="w-10 h-10 text-white" />
                    </div>
                </div>
                <h3 className="text-xl font-black text-white mb-2">{isAr ? 'اسحب من بيانات Reach' : 'Pull from Reach Data'}</h3>
                <p className="text-sm text-white/50 mb-5">{isAr ? 'حلّل عملاءك أو زياراتك أو سجلاتك مباشرة (مع احترام صلاحياتك).' : 'Analyze customers, route visits, or upload history — subject to your access.'}</p>
                {showReach ? (
                    <div className="space-y-2">
                        {[
                            { id: 'normalized_customers', label: isAr ? 'العملاء' : 'Customers' },
                            { id: 'route_visits', label: isAr ? 'زيارات المسارات' : 'Route Visits' },
                            { id: 'history_logs', label: isAr ? 'سجل الرفع' : 'Upload History' },
                        ].map(t => (
                            <button key={t.id} onClick={() => onPullReachTable(t.id)} className="w-full px-4 py-3 bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-500/40 border border-white/10 rounded-xl text-left text-sm font-bold text-white flex items-center justify-between transition-all">
                                <span>{t.label}</span> <ArrowRight className="w-4 h-4 text-purple-300" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <button onClick={() => setShowReach(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:brightness-110 text-white text-sm font-black rounded-xl shadow-lg transition-all active:scale-95">
                        <Database className="w-4 h-4" /> {isAr ? 'اختر مصدراً' : 'Choose source'}
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================================
// Confirm Type step — user picks dataset type + maps slot → column
// ============================================================

const ConfirmTypeStep: React.FC<{
    isAr: boolean;
    profile: ProfileResponse;
    selectedType: DatasetType;
    setSelectedType: (t: DatasetType) => void;
    mapping: Record<string, string>;
    setMapping: (m: Record<string, string>) => void;
    onAnalyze: () => void;
    onBack: () => void;
}> = ({ isAr, profile, selectedType, setSelectedType, mapping, setMapping, onAnalyze, onBack }) => {
    const allKeys = profile.mappingKeys || FALLBACK_MAPPING_KEYS;
    const slotKeys: string[] = (allKeys as any)[selectedType] || [];
    const columns = profile.columns;

    // Auto-suggest a mapping when the user changes the dataset type.
    // Strategy: keep the user's existing slot assignments where the column still exists,
    // then for blank slots try a dtype-aware guess against the column list.
    const autoFillForType = (t: DatasetType): Record<string, string> => {
        const keys: string[] = (allKeys as any)[t] || [];
        const out: Record<string, string> = {};
        const NUMERIC_SLOTS = new Set(['amount', 'quantity', 'value', 'spend', 'conversions']);
        // CamelCase + underscore split so \b matches across SalesmanCode → "Salesman Code".
        const norm = (n: string) => n
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
            .replace(/[_\-]+/g, ' ');
        const isNumeric = (c: Column) => /int|float|double|number/i.test(c.dtype);
        const isDate = (c: Column) => /datetime|date/i.test(c.dtype) || c.role === 'date';
        const idLike = (n: string) => /\b(code|id|key|uuid)$|^(code|id|key)\b|\b(salesman|salesperson|rep|user|employee|owner|operator)\b/i.test(norm(n));
        const typeLike = (n: string) => /\b(type|status|class|kind|level)$|^(type|status|class|kind)\b/i.test(norm(n));

        const findFirst = (patterns: RegExp[], slot: string): string => {
            for (const p of patterns) {
                for (const c of columns) {
                    if (Object.values(out).includes(c.name)) continue;
                    const n = norm(c.name);
                    // Numeric slot: must be numeric and not an ID-like
                    if (NUMERIC_SLOTS.has(slot)) {
                        if (!isNumeric(c)) continue;
                        if (idLike(c.name)) continue;
                    }
                    // Invoice slot: not a type/status column
                    if (slot === 'invoice' && typeLike(c.name)) continue;
                    if (p.test(n)) return c.name;
                }
            }
            return '';
        };

        const SLOT_PATTERNS: Record<string, RegExp[]> = {
            amount:      [/^(net|gross)?\s*(sales|revenue|amount|total)$/i, /\b(net\s*sales|gross\s*sales|sales\s*value|revenue|amount|total\s*(amount|value)?|line\s*total|grand\s*total)\b/i],
            quantity:    [/^(qty|quantity|units|pcs|pieces|count)$/i, /\b(qty|quantity|units|pcs|pieces|sold)\b/i],
            value:       [/\b(value|amount|price|cost|total|worth)\b/i],
            spend:       [/\b(spend|cost|budget|investment)\b/i],
            conversions: [/\b(conv|conversion|leads|signup|click|orders?)\b/i],
            item:        [/\b(item|product|sku|material)\b/i],
            category:    [/\b(categ|class|group|family|sub\s*family|product\s*type|item\s*type|department)\b/i],
            customer:    [/\b(customer|client|account|cust)\b/i],
            invoice:     [/\b(invoice|order|bill|receipt|doc\s*(no|num|number)?|trans[a-z]*\s*(no|id|num|number))\b/i],
            location:    [/\b(location|warehouse|branch|store|site|depot|outlet)\b/i],
            segment:     [/\b(segment|tier|grade|level)\b/i],
            region:      [/\b(region|country|state|city|area|territory|zone)\b/i],
            route:       [/\b(route|trip|path|tour)\b/i],
            status:      [/\b(status|state|outcome|result)\b/i],
            account:     [/\b(account|gl|ledger)\b/i],
            channel:     [/\b(channel|source|medium|platform)\b/i],
            audience:    [/\b(audience|persona|target)\b/i],
        };

        // 1) Preserve user's prior pick if column still exists.
        // 2) Otherwise fall back to AI mapping returned from /profile.
        const existing = (k: string) => {
            if (mapping[k] && columns.some(c => c.name === mapping[k])) return mapping[k];
            if (profile.mapping?.[k] && columns.some(c => c.name === profile.mapping![k])) return profile.mapping![k];
            return '';
        };

        keys.forEach(k => {
            const ex = existing(k);
            if (ex) {
                // Re-validate: an existing pick might be wrong if the slot rules say so.
                const col = columns.find(c => c.name === ex)!;
                const ok = NUMERIC_SLOTS.has(k)
                    ? (isNumeric(col) && !idLike(ex))
                    : k === 'invoice' ? !typeLike(ex)
                    : k === 'date' ? (isDate(col) || (!isNumeric(col) && /\b(date|day|time)\b/i.test(norm(ex))))
                    : true;
                if (ok) { out[k] = ex; return; }
            }
            if (k === 'date') {
                // Prefer real datetime
                const dateCol = columns.find(c => isDate(c) && !Object.values(out).includes(c.name));
                if (dateCol) { out[k] = dateCol.name; return; }
                // Object-typed date-named
                const named = columns.find(c => !Object.values(out).includes(c.name) && !isNumeric(c) && /\b(date|day|time|created|invoiced|posted|timestamp)\b/i.test(norm(c.name)));
                out[k] = named?.name || '';
                return;
            }
            const patterns = SLOT_PATTERNS[k];
            out[k] = patterns ? findFirst(patterns, k) : '';
        });
        return out;
    };

    const handleSelectType = (t: DatasetType) => {
        setSelectedType(t);
        setMapping(autoFillForType(t));
        setEditingSlots(new Set());
    };

    const setSlot = (slot: string, col: string) => {
        setMapping({ ...mapping, [slot]: col });
    };

    // ---- Confidence detection — used to decide whether a slot shows a chip vs a dropdown ----
    const SLOT_SYNONYMS: Record<string, string[]> = {
        amount:      ['amount', 'sales', 'revenue', 'total', 'net sales', 'gross sales', 'sale value', 'sales value', 'sales amount', 'total amount', 'total sales', 'line total', 'grand total', 'sale'],
        quantity:    ['quantity', 'qty', 'units', 'pcs', 'pieces', 'units sold'],
        item:        ['item', 'product', 'sku', 'material', 'item code', 'product code', 'sku code', 'material code', 'item id', 'product id', 'item name', 'product name'],
        category:    ['category', 'categ', 'class', 'group', 'family', 'department', 'product category', 'item category', 'product type', 'item type', 'sub family', 'subfamily'],
        customer:    ['customer', 'client', 'account', 'cust', 'customer id', 'client id', 'customer code', 'client code', 'cust id', 'cust code', 'customer name', 'client name'],
        invoice:     ['invoice', 'invoice no', 'invoice number', 'invoice id', 'order', 'order no', 'order id', 'order number', 'transaction id', 'transaction no', 'transaction number', 'bill no', 'doc no'],
        date:        ['date', 'transaction date', 'invoice date', 'order date', 'sale date', 'posted date', 'created date', 'created at', 'timestamp', 'invoiced'],
        value:       ['value', 'amount', 'total', 'price', 'cost', 'worth', 'total value', 'line total'],
        spend:       ['spend', 'cost', 'budget', 'investment'],
        conversions: ['conversions', 'conv', 'leads', 'signups', 'clicks', 'orders'],
        location:    ['location', 'warehouse', 'branch', 'store', 'site', 'depot', 'outlet'],
        segment:     ['segment', 'tier', 'grade', 'level'],
        region:      ['region', 'country', 'state', 'city', 'area', 'territory', 'zone', 'governorate', 'gov'],
        route:       ['route', 'trip', 'path', 'tour', 'route id', 'route name', 'route code'],
        status:      ['status', 'state', 'outcome', 'result'],
        account:     ['account', 'gl', 'ledger', 'account id', 'account code'],
        channel:     ['channel', 'source', 'medium', 'platform'],
        audience:    ['audience', 'persona', 'target'],
    };
    const normName = (n: string) => n
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .replace(/[_\-]+/g, ' ')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const computeConfidence = (slot: string, colName: string | undefined): 'exact' | 'inferred' | 'none' => {
        if (!colName) return 'none';
        const c = normName(colName);
        const cNoTrailingDigits = c.replace(/\s*\d+$/, '').trim();
        const cNoSpace = c.replace(/\s/g, '');
        const synonyms = SLOT_SYNONYMS[slot] || [slot];
        for (const syn of synonyms) {
            const synNoSpace = syn.replace(/\s/g, '');
            if (c === syn || cNoTrailingDigits === syn || cNoSpace === synNoSpace) return 'exact';
        }
        return 'inferred';
    };

    // Track which slots the user explicitly chose to edit (so a chip becomes a dropdown).
    const [editingSlots, setEditingSlots] = useState<Set<string>>(new Set());
    const toggleEditing = (slot: string) => {
        const s = new Set(editingSlots);
        if (s.has(slot)) s.delete(slot); else s.add(slot);
        setEditingSlots(s);
    };

    const slotConfidences = slotKeys.map(k => ({ slot: k, conf: computeConfidence(k, mapping[k]) }));
    const exactSlots = slotConfidences.filter(s => s.conf === 'exact' && !editingSlots.has(s.slot));
    const reviewSlots = slotConfidences.filter(s => s.conf !== 'exact' || editingSlots.has(s.slot));
    const exactCount = exactSlots.length;
    const reviewCount = reviewSlots.length;

    const filledCount = slotKeys.filter(k => !!mapping[k]).length;
    const canAnalyze = selectedType === 'other' || filledCount >= 1;

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-500/[0.04] to-cyan-500/[0.02] border border-emerald-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-white mb-1">
                            {isAr ? 'تم رفع الملف بنجاح' : 'File uploaded successfully'}
                        </h3>
                        <p className="text-xs text-white/60 leading-relaxed">
                            {profile.fileMeta?.filename ? `${profile.fileMeta.filename} · ` : ''}
                            {profile.rowCount.toLocaleString()} {isAr ? 'صف' : 'rows'} · {profile.columns.length} {isAr ? 'عمود' : 'cols'}
                            {profile.narrative ? <span className="block mt-1.5 text-white/50 italic">{profile.narrative}</span> : null}
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">
                    {isAr ? '١. أكّد نوع البيانات' : '1. Confirm the data type'}
                </h3>
                <p className="text-xs text-white/50 mb-4">
                    {isAr
                        ? 'سنحلل بياناتك بمؤشرات أداء مخصصة لهذا النوع.'
                        : 'We\'ll analyze with KPIs curated for this type (e.g. total sales, top customers, items sold).'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    {DATASET_TYPE_DEFS.map(def => {
                        const Icon = def.icon;
                        const active = selectedType === def.id;
                        const wasDetected = profile.datasetType === def.id;
                        return (
                            <button
                                key={def.id}
                                onClick={() => handleSelectType(def.id)}
                                className={`relative p-3 rounded-2xl border transition-all text-left ${active
                                    ? 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border-emerald-400 shadow-lg shadow-emerald-500/20'
                                    : 'bg-white/[0.03] border-white/10 hover:border-white/30 hover:bg-white/[0.05]'}`}
                            >
                                {wasDetected && (
                                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[8px] font-black text-white uppercase tracking-widest shadow-md">
                                        {isAr ? 'مكتشف' : 'Detected'}
                                    </span>
                                )}
                                <div className={`inline-flex p-2 rounded-xl mb-2 bg-gradient-to-br ${def.gradient}`}>
                                    <Icon className="w-4 h-4 text-white" />
                                </div>
                                <div className={`text-xs font-black ${active ? 'text-white' : 'text-white/80'}`}>
                                    {isAr ? def.ar : def.en}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedType !== 'other' && slotKeys.length > 0 && (
                <div>
                    <div className="flex items-end justify-between mb-3 gap-3">
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">
                                {isAr ? '٢. ربط الأعمدة' : '2. Column mapping'}
                            </h3>
                            <p className="text-xs text-white/50">
                                {reviewCount === 0
                                    ? (isAr ? `كل الحقول متطابقة تلقائياً ✨ يمكنك المتابعة.` : `All ${exactCount} slots auto-matched ✨ You can analyze now.`)
                                    : (isAr
                                        ? `${exactCount} متطابق تلقائياً · ${reviewCount} بحاجة لمراجعة`
                                        : `${exactCount} auto-matched · ${reviewCount} need a quick check`)}
                            </p>
                        </div>
                    </div>

                    {reviewSlots.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                            {reviewSlots.map(({ slot, conf }) => {
                                const lab = SLOT_LABELS[slot] || { en: slot, ar: slot };
                                const value = mapping[slot] || '';
                                const isEmpty = !value;
                                return (
                                    <div key={slot} className={`relative rounded-xl p-3 border ${isEmpty ? 'bg-amber-500/5 border-amber-500/30' : 'bg-white/[0.03] border-white/10'}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                                                {isAr ? lab.ar : lab.en}
                                            </label>
                                            {conf === 'inferred' && value && (
                                                <span className="text-[8px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded px-1.5 py-0.5 uppercase tracking-widest">
                                                    {isAr ? 'مقترح' : 'Suggested'}
                                                </span>
                                            )}
                                            {isEmpty && (
                                                <span className="text-[8px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 uppercase tracking-widest">
                                                    {isAr ? 'فارغ' : 'Pick one'}
                                                </span>
                                            )}
                                        </div>
                                        <select
                                            value={value}
                                            onChange={e => setSlot(slot, e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg border bg-white/5 text-white text-xs focus:outline-none focus:ring-2 ${isEmpty ? 'border-amber-500/30 focus:ring-amber-500/40' : 'border-white/10 focus:ring-emerald-500/40'}`}
                                        >
                                            <option value="">— {isAr ? 'لا شيء' : 'none'} —</option>
                                            {columns.map(c => (
                                                <option key={c.name} value={c.name}>
                                                    {c.name} ({c.dtype})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {exactSlots.length > 0 && (
                        <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                                    {isAr ? 'متطابق تلقائياً' : 'Auto-matched'}
                                </span>
                                <span className="text-[10px] text-white/30">·</span>
                                <span className="text-[10px] text-white/40">
                                    {isAr ? 'انقر للتغيير' : 'Click to change'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {exactSlots.map(({ slot }) => {
                                    const lab = SLOT_LABELS[slot] || { en: slot, ar: slot };
                                    return (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => toggleEditing(slot)}
                                            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400 transition-colors"
                                            title={isAr ? 'انقر لتغيير العمود' : 'Click to change'}
                                        >
                                            <CheckCircle2 className="w-3 h-3 text-emerald-300 shrink-0" />
                                            <span className="text-[10px] font-black text-emerald-200/70 uppercase tracking-widest">
                                                {isAr ? lab.ar : lab.en}
                                            </span>
                                            <span className="text-white/30 text-[10px]">→</span>
                                            <span className="text-xs font-bold text-white">{mapping[slot]}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {selectedType === 'other' && (
                <div className="bg-amber-500/[0.05] border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-200/80 leading-relaxed">
                    {isAr
                        ? 'سنشغّل تحليل عام تلقائي يكتشف الأعمدة الرقمية والفئوية بدون قالب محدد.'
                        : 'We\'ll run a generic auto-analysis — auto-detects numeric & categorical columns with no preset template.'}
                </div>
            )}

            <div className="sticky bottom-3 flex gap-3 pt-3">
                <button
                    onClick={onBack}
                    className="flex-1 sm:flex-initial px-5 py-3 border border-white/10 hover:bg-white/5 text-white/70 text-sm font-black rounded-xl transition-all"
                >
                    {isAr ? 'رجوع' : 'Back'}
                </button>
                <button
                    onClick={onAnalyze}
                    disabled={!canAnalyze}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <Sparkles className="w-4 h-4" />
                    {isAr ? 'حلّل البيانات' : 'Analyze Data'}
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const Processing: React.FC<{ isAr: boolean; stage?: string }> = ({ isAr, stage }) => (
    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-16 flex flex-col items-center justify-center text-center min-h-[400px] backdrop-blur-sm">
        <div className="relative w-32 h-32 mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 blur-3xl animate-pulse" />
            <Loader2 className="w-full h-full text-emerald-400 animate-spin relative" />
            <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-14 h-14 text-emerald-300" />
            </div>
        </div>
        <h3 className="text-3xl font-black text-white mb-2 tracking-tight">
            {stage || (isAr ? 'يحسب الذكاء الاصطناعي...' : 'AI is computing your dashboard...')}
        </h3>
        <p className="text-sm text-white/50 font-bold uppercase tracking-widest">
            {isAr ? 'تحليل · تجميع · صياغة' : 'Detecting · Aggregating · Narrating'}
        </p>
    </div>
);

// ============================================================
// Dashboard (the main event)
// ============================================================

const Dashboard: React.FC<{
    isAr: boolean;
    profile: ProfileResponse;
    insights: Insight[];
    filteredKpis: any | null;
    activeFilters: Record<string, string[]>;
    onToggleFilterValue: (col: string, val: string) => void;
    onSetFilterValues: (col: string, values: string[]) => void;
    onClearFilters: () => void;
    filterApplying: boolean;
    chatOpen: boolean;
    setChatOpen: (b: boolean) => void;
    chatHistory: ChatTurn[];
    chatInput: string;
    setChatInput: (s: string) => void;
    chatBusy: boolean;
    onAsk: () => void;
    hiddenCardIds: Set<string>;
    cardSizes: Record<string, 'compact' | 'normal' | 'wide'>;
    cardOrder: string[];
    onCardDelete: (id: string) => void;
    onCardResize: (id: string, size: 'compact' | 'normal' | 'wide') => void;
    onCardReorder: (sourceId: string, targetId: string) => void;
    onCardEdit?: (insight: Insight) => void;
    onLayoutReset: () => void;
    cleanView: boolean;
    setCleanView: (v: boolean) => void;
    onChartClick: (column: string, value: string) => void;
}> = ({
    isAr, profile, insights, filteredKpis, activeFilters,
    onToggleFilterValue, onSetFilterValues, onClearFilters, filterApplying,
    chatOpen, setChatOpen, chatHistory, chatInput, setChatInput, chatBusy, onAsk,
    hiddenCardIds, cardSizes, cardOrder, onCardDelete, onCardResize, onCardReorder, onCardEdit, onLayoutReset,
    cleanView, setCleanView, onChartClick,
}) => {
    const kpis = filteredKpis || profile.kpis;
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const activeFilterCount = Object.values(activeFilters).reduce((a, v) => a + v.length, 0);

    // Pick top dimensions for filter rail (ones with reasonable cardinality)
    const filterableDims = useMemo(() => {
        return profile.columns
            .filter(c => c.role === 'dimension')
            .filter(c => {
                const distinct = c.stats?.distinct ?? 99;
                return distinct >= 2 && distinct <= 40;
            })
            .slice(0, 8);
    }, [profile.columns]);

    const datasetTypeDef = DATASET_TYPE_DEFS.find(d => d.id === profile.datasetType) || DATASET_TYPE_DEFS[6];
    const reportTitle = isAr
        ? `تقرير ${datasetTypeDef.ar}`
        : `${datasetTypeDef.en} Insights Report`;
    const reportDate = new Date().toLocaleDateString(isAr ? 'ar' : 'en', { year: 'numeric', month: 'short', day: 'numeric' });

    // dnd-kit sensors — start drag only after pointer moves 6px so quick clicks aren't misread.
    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            onCardReorder(String(active.id), String(over.id));
        }
    };

    return (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <div className="space-y-5">
                {/* Report header — title, source, generated date, dataset chips */}
                <ReportHeader
                    isAr={isAr}
                    title={reportTitle}
                    profile={profile}
                    kpis={kpis}
                    filteredKpis={filteredKpis}
                    insightCount={insights.length}
                    date={reportDate}
                    typeIcon={datasetTypeDef.icon}
                    typeGradient={datasetTypeDef.gradient}
                />

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Filter rail (left) */}
                <div className="xl:col-span-3">
                    <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl overflow-hidden sticky top-[88px]">
                        <button
                            onClick={() => setFiltersExpanded(!filtersExpanded)}
                            className="w-full px-4 py-3 border-b border-white/5 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <FilterIcon className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                                    {isAr ? 'الفلاتر' : 'Filters'}
                                </span>
                                {activeFilterCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-black text-emerald-300">
                                        {activeFilterCount}
                                    </span>
                                )}
                                {filterApplying && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />}
                            </div>
                            {filtersExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRightIcon className="w-3.5 h-3.5 text-white/40" />}
                        </button>
                        {filtersExpanded && (
                            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
                                {activeFilterCount > 0 && (
                                    <button onClick={onClearFilters} className="w-full px-2 py-1.5 text-[10px] font-black text-white/60 hover:text-white border border-white/10 hover:bg-white/5 rounded uppercase tracking-widest">
                                        {isAr ? 'مسح الفلاتر' : 'Clear all'}
                                    </button>
                                )}
                                {filterableDims.length === 0 ? (
                                    <p className="text-xs text-white/40 italic">
                                        {isAr ? 'لا توجد أبعاد قابلة للفلترة.' : 'No filterable dimensions.'}
                                    </p>
                                ) : filterableDims.map(c => (
                                    <FilterGroup
                                        key={c.name}
                                        isAr={isAr}
                                        column={c}
                                        active={activeFilters[c.name] || []}
                                        onToggle={(v) => onToggleFilterValue(c.name, v)}
                                        onSet={(vs) => onSetFilterValues(c.name, vs)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sectioned report (center) — takes full width when chat is hidden */}
                <div className={`${chatOpen ? 'xl:col-span-6' : 'xl:col-span-9'}`}>
                    {insights.length === 0 ? (
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-12 text-center text-white/50">
                            {filterApplying
                                ? (isAr ? 'يطبّق الفلاتر...' : 'Applying filters...')
                                : (isAr ? 'لا توجد رؤى حالياً. حاول تعديل الفلاتر أو طرح سؤال.' : 'No insights right now. Adjust filters or ask a question.')}
                        </div>
                    ) : (
                        <ReportView
                            isAr={isAr}
                            insights={insights}
                            narrative={profile.narrative}
                            hiddenCardIds={hiddenCardIds}
                            cardSizes={cardSizes}
                            cardOrder={cardOrder}
                            onCardDelete={onCardDelete}
                            onCardResize={onCardResize}
                            onCardReorder={onCardReorder}
                            onCardEdit={onCardEdit}
                            onLayoutReset={onLayoutReset}
                            cleanView={cleanView}
                            setCleanView={setCleanView}
                            onChartClick={onChartClick}
                            activeFilters={activeFilters}
                        />
                    )}
                </div>

                {/* Chat rail (right) — only takes column when open */}
                {chatOpen && (
                    <div className="xl:col-span-3">
                        <ChatRail
                            isAr={isAr}
                            open={chatOpen}
                            setOpen={setChatOpen}
                            history={chatHistory}
                            input={chatInput}
                            setInput={setChatInput}
                            busy={chatBusy}
                            onAsk={onAsk}
                            canChat={!!profile.datasetId}
                        />
                    </div>
                )}
            </div>

                {/* Floating Ask-AI FAB — only when rail is collapsed */}
                {!chatOpen && (
                    <button
                        onClick={() => setChatOpen(true)}
                        title={isAr ? 'اسأل بياناتك' : 'Ask your data'}
                        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 hover:brightness-110 shadow-2xl shadow-purple-500/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                    >
                        <MessageSquare className="w-6 h-6 text-white" />
                        {chatHistory.length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-400 text-[10px] font-black text-emerald-950 flex items-center justify-center border-2 border-[#0a0a14]">
                                {chatHistory.filter(t => t.role === 'user').length}
                            </span>
                        )}
                    </button>
                )}
            </div>
        </DndContext>
    );
};

// ============================================================
// Report Header — title, dataset chips, generated date
// ============================================================
const ReportHeader: React.FC<{
    isAr: boolean;
    title: string;
    profile: ProfileResponse;
    kpis: any;
    filteredKpis: any | null;
    insightCount: number;
    date: string;
    typeIcon: any;
    typeGradient: string;
}> = ({ isAr, title, profile, kpis, filteredKpis, insightCount, date, typeIcon: TypeIcon, typeGradient }) => (
    <div className="bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent border border-white/10 rounded-3xl p-5 sm:p-6 overflow-hidden relative">
        <div className={`absolute -top-20 -right-10 w-48 h-48 bg-gradient-to-br ${typeGradient} opacity-10 blur-3xl rounded-full pointer-events-none`} />
        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
            <div className={`p-3 bg-gradient-to-br ${typeGradient} rounded-2xl shrink-0 shadow-lg`}>
                <TypeIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.25em] mb-1">
                    {isAr ? 'تقرير ذكاء اصطناعي' : 'AI-Generated Report'}
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-1">{title}</h2>
                <div className="text-xs text-white/50 leading-relaxed">
                    {profile.fileMeta?.filename ? <span className="font-mono">{profile.fileMeta.filename}</span> : null}
                    {profile.fileMeta?.filename ? <span className="mx-1.5 text-white/20">·</span> : null}
                    <span>{(kpis?.rows ?? 0).toLocaleString()} {isAr ? 'صف' : 'rows'}</span>
                    {filteredKpis && (
                        <span className="ml-1.5 text-emerald-300/80">
                            ({isAr ? 'مفلتر من' : 'filtered from'} {(profile.kpis?.rows ?? 0).toLocaleString()})
                        </span>
                    )}
                    <span className="mx-1.5 text-white/20">·</span>
                    <span>{kpis?.columns ?? '—'} {isAr ? 'عمود' : 'cols'}</span>
                    <span className="mx-1.5 text-white/20">·</span>
                    <span>{insightCount} {isAr ? 'رؤية' : 'insights'}</span>
                    {kpis?.missingCells > 0 && (
                        <>
                            <span className="mx-1.5 text-white/20">·</span>
                            <span className="text-amber-300/80">{(kpis.missingCells).toLocaleString()} {isAr ? 'خلية فارغة' : 'missing'}</span>
                        </>
                    )}
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">{isAr ? 'تاريخ التوليد' : 'Generated'}</div>
                <div className="text-sm font-bold text-white/80 mt-0.5">{date}</div>
            </div>
        </div>
        {profile.narrative && (
            <div className="relative mt-4 pt-4 border-t border-white/5 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-sm text-white/75 leading-relaxed italic">{profile.narrative}</p>
            </div>
        )}
    </div>
);

// ============================================================
// Report View — group insights into Overview / Rankings / Distribution / Trends
// ============================================================
const ReportView: React.FC<{
    isAr: boolean;
    insights: Insight[];
    narrative?: string;
    hiddenCardIds: Set<string>;
    cardSizes: Record<string, 'compact' | 'normal' | 'wide'>;
    cardOrder: string[];
    onCardDelete: (id: string) => void;
    onCardResize: (id: string, size: 'compact' | 'normal' | 'wide') => void;
    onCardReorder: (sourceId: string, targetId: string) => void;
    onCardEdit?: (insight: Insight) => void;
    onLayoutReset: () => void;
    cleanView: boolean;
    setCleanView: (v: boolean) => void;
    onChartClick: (column: string, value: string) => void;
    activeFilters: Record<string, string[]>;
}> = ({ isAr, insights, hiddenCardIds, cardSizes, cardOrder, onCardDelete, onCardResize, onCardReorder, onCardEdit, onLayoutReset, cleanView, setCleanView, onChartClick, activeFilters }) => {
    // Filter out user-hidden cards
    const visible = insights.filter(i => !hiddenCardIds.has(i.id));

    // Apply user-defined order: items appearing in cardOrder come first in their relative order;
    // remaining items keep their natural position at the end.
    const ordered = useMemo(() => {
        if (!cardOrder.length) return visible;
        const idx: Record<string, number> = {};
        cardOrder.forEach((id, i) => { idx[id] = i; });
        return [...visible].sort((a, b) => {
            const ai = idx[a.id]; const bi = idx[b.id];
            if (ai === undefined && bi === undefined) return 0;
            if (ai === undefined) return 1;
            if (bi === undefined) return -1;
            return ai - bi;
        });
    }, [visible, cardOrder]);

    const kpiInsights = ordered.filter(i => i.type === 'kpi');
    const lineInsights = ordered.filter(i => i.type === 'line');
    const pieInsights = ordered.filter(i => i.type === 'pie');
    const isRanking = (i: Insight) => /^(top|bottom|أعلى|أقل)/i.test(i.title);
    const rankingInsights = ordered.filter(i => i.type === 'bar' && isRanking(i));
    const breakdownBars = ordered.filter(i => i.type === 'bar' && !isRanking(i));

    const hiddenCount = insights.length - visible.length;
    const hasCustomLayout = hiddenCount > 0 || Object.keys(cardSizes).length > 0 || cardOrder.length > 0;

    const sectionProps = { isAr, hiddenCardIds, cardSizes, cardOrder, onCardDelete, onCardResize, onCardReorder, onCardEdit, cleanView, onChartClick, activeFilters };

    return (
        <div className="space-y-7">
            {/* View-mode + layout-status bar */}
            <div className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                <button
                    onClick={() => setCleanView(!cleanView)}
                    title={isAr
                        ? (cleanView ? 'إظهار التفاصيل والصيغ' : 'إخفاء التفاصيل والصيغ')
                        : (cleanView ? 'Show explanations & formulas' : 'Hide explanations & formulas')}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-widest transition-colors ${
                        cleanView
                            ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-200'
                            : 'border border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                >
                    {cleanView ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isAr ? (cleanView ? 'وضع المستخدم' : 'وضع المحلل') : (cleanView ? 'Clean View' : 'Detailed View')}</span>
                </button>
                <span className="text-[11px] text-white/40 hidden sm:inline">
                    {cleanView
                        ? (isAr ? 'الصيغ والتلميحات مخفية' : 'Explanations & formulas hidden')
                        : (isAr ? 'انقر على الرسم البياني لتطبيق فلتر' : 'Click any bar / slice / point to filter')}
                </span>
                {hasCustomLayout && (
                    <button
                        onClick={onLayoutReset}
                        className="text-[10px] font-black text-emerald-300 hover:text-emerald-200 uppercase tracking-widest flex items-center gap-1 ml-auto"
                    >
                        <RefreshCw className="w-3 h-3" />
                        {isAr ? `استعادة (${hiddenCount} مخفي)` : `Reset (${hiddenCount} hidden)`}
                    </button>
                )}
            </div>

            {kpiInsights.length > 0 && (
                <ReportSection isAr={isAr} icon={Hash} title={isAr ? 'لمحة عامة' : 'Overview'} subtitle={isAr ? 'مؤشرات الأداء الرئيسية' : 'Headline metrics for this dataset'}>
                    <ReportGrid baseCols="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" itemIds={kpiInsights.map(k => k.id)}>
                        {kpiInsights.map(k => (
                            <BigKpiCard key={k.id} {...sectionProps} insight={k} size={cardSizes[k.id] || 'normal'} />
                        ))}
                    </ReportGrid>
                </ReportSection>
            )}

            {rankingInsights.length > 0 && (
                <ReportSection isAr={isAr} icon={Trophy} title={isAr ? 'الترتيبات' : 'Top Rankings'} subtitle={isAr ? 'أعلى وأقل المساهمين' : 'Best (and worst) performers'}>
                    <ReportGrid baseCols="grid-cols-1 lg:grid-cols-2" itemIds={rankingInsights.map(i => i.id)}>
                        {rankingInsights.map(i => (
                            <ChartCard key={i.id} {...sectionProps} insight={i} size={cardSizes[i.id] || 'normal'} />
                        ))}
                    </ReportGrid>
                </ReportSection>
            )}

            {(pieInsights.length > 0 || breakdownBars.length > 0) && (
                <ReportSection isAr={isAr} icon={Layers} title={isAr ? 'التوزيعات' : 'Distribution & Breakdowns'} subtitle={isAr ? 'كيف تتوزع البيانات عبر الأبعاد' : 'How values split across categories'}>
                    <ReportGrid baseCols="grid-cols-1 lg:grid-cols-2" itemIds={[...pieInsights, ...breakdownBars].map(i => i.id)}>
                        {pieInsights.map(i => (
                            <ChartCard key={i.id} {...sectionProps} insight={i} size={cardSizes[i.id] || 'normal'} />
                        ))}
                        {breakdownBars.map(i => (
                            <ChartCard key={i.id} {...sectionProps} insight={i} size={cardSizes[i.id] || 'normal'} />
                        ))}
                    </ReportGrid>
                </ReportSection>
            )}

            {lineInsights.length > 0 && (
                <ReportSection isAr={isAr} icon={TrendingUp} title={isAr ? 'الاتجاهات الزمنية' : 'Trends Over Time'} subtitle={isAr ? 'كيف تتطور الأرقام عبر الزمن' : 'How the numbers move chronologically'}>
                    <ReportGrid baseCols="grid-cols-1 lg:grid-cols-2" itemIds={lineInsights.map(i => i.id)}>
                        {lineInsights.map(i => (
                            <ChartCard key={i.id} {...sectionProps} insight={i} size={cardSizes[i.id] || 'wide'} wide />
                        ))}
                    </ReportGrid>
                </ReportSection>
            )}
        </div>
    );
};

// ReportGrid — grid + SortableContext + AnimatePresence so cards drag, swap, and fade smoothly.
const ReportGrid: React.FC<{ baseCols: string; itemIds: string[]; children: React.ReactNode }> = ({ baseCols, itemIds, children }) => (
    <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        <div className={`grid ${baseCols} gap-4`}>
            <AnimatePresence mode="popLayout" initial={false}>
                {children}
            </AnimatePresence>
        </div>
    </SortableContext>
);

// ============================================================
// Report Section wrapper
// ============================================================
// ============================================================
// Card-level controls (drag handle, resize, delete) + drag-and-drop helpers
// ============================================================

type CardSize = 'compact' | 'normal' | 'wide';

const SIZE_COL_SPAN: Record<CardSize, string> = {
    compact: 'col-span-1',
    normal:  'col-span-1',
    wide:    'col-span-1 sm:col-span-2 lg:col-span-2',
};

interface SharedCardProps {
    isAr: boolean;
    insight: Insight;
    size: CardSize;
    hiddenCardIds: Set<string>;
    cardSizes: Record<string, CardSize>;
    cardOrder: string[];
    onCardDelete: (id: string) => void;
    onCardResize: (id: string, size: CardSize) => void;
    onCardReorder: (sourceId: string, targetId: string) => void;
    onCardEdit?: (insight: Insight) => void;
    cleanView?: boolean;
    onChartClick?: (column: string, value: string) => void;
    activeFilters?: Record<string, string[]>;
}

// useSortableCard — wraps @dnd-kit's useSortable so each card gets smooth drag+swap.
// Returns refs/listeners to wire onto the card root + drag-handle button.
const useSortableCard = (id: string) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.6 : 1,
    };
    return { setNodeRef, style, isDragging, isOver, dragHandle: { ...attributes, ...listeners } };
};

const CardControls: React.FC<{
    isAr: boolean;
    id: string;
    size: CardSize;
    onDelete: () => void;
    onResize: (s: CardSize) => void;
    onEdit?: () => void;
    canWide?: boolean;
    dragHandleProps: any;
}> = ({ isAr, size, onDelete, onResize, onEdit, canWide = true, dragHandleProps }) => {
    const cycleSize = () => {
        const next: CardSize = size === 'compact' ? 'normal' : size === 'normal' && canWide ? 'wide' : 'compact';
        onResize(next);
    };
    return (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-white/10 shadow-lg">
            <button
                {...dragHandleProps}
                title={isAr ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
                className="cursor-grab active:cursor-grabbing p-1.5 rounded-l-lg text-white/40 hover:text-white/90 hover:bg-white/10 touch-none"
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="w-3.5 h-3.5" />
            </button>
            {onEdit && (
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(); }}
                    title={isAr ? 'تعديل الحساب' : 'Edit calculation'}
                    className="p-1.5 rounded text-white/40 hover:text-cyan-300 hover:bg-cyan-500/10"
                >
                    <Pencil className="w-3 h-3" />
                </button>
            )}
            <button
                onClick={(e) => { e.stopPropagation(); cycleSize(); }}
                title={isAr ? `الحجم: ${size}` : `Size: ${size} (click to cycle)`}
                className="p-1.5 rounded text-white/40 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
                <Maximize2 className="w-3 h-3" />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title={isAr ? 'إخفاء البطاقة' : 'Hide card'}
                className="p-1.5 rounded-r-lg text-white/40 hover:text-rose-300 hover:bg-rose-500/10"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
};

const ReportSection: React.FC<{
    isAr: boolean;
    icon: any;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, children }) => (
    <section>
        <div className="flex items-center gap-3 mb-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <Icon className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
                <h3 className="text-sm font-black text-white tracking-tight">{title}</h3>
                {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent ml-2" />
        </div>
        {children}
    </section>
);

// ============================================================
// Big KPI card — large value, label, info-tip
// ============================================================
const BigKpiCard: React.FC<SharedCardProps> = ({ isAr, insight, size, onCardDelete, onCardResize, onCardEdit, cleanView }) => {
    const v = typeof insight.value === 'number' ? insight.value : null;
    const display = v !== null ? formatCompact(v) : '—';
    const fullValue = v !== null ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '';
    const formula = formatFormula(insight);
    const sortable = useSortableCard(insight.id);
    const valueSize = size === 'compact' ? 'text-2xl' : size === 'wide' ? 'text-5xl' : 'text-3xl sm:text-4xl';
    return (
        <motion.div
            ref={sortable.setNodeRef}
            style={sortable.style}
            layout="position"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: sortable.isDragging ? 0.5 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`${SIZE_COL_SPAN[size]} group relative bg-gradient-to-br from-white/[0.05] to-white/[0.01] hover:from-emerald-500/[0.05] hover:to-cyan-500/[0.02] border ${sortable.isOver ? 'border-emerald-400 ring-2 ring-emerald-500/40' : 'border-white/10 hover:border-emerald-500/40'} rounded-2xl p-4`}
        >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />
            <CardControls
                isAr={isAr}
                id={insight.id}
                size={size}
                onDelete={() => onCardDelete(insight.id)}
                onResize={(s) => onCardResize(insight.id, s)}
                onEdit={onCardEdit ? () => onCardEdit(insight) : undefined}
                dragHandleProps={sortable.dragHandle}
            />
            <div className="flex items-start gap-1.5 pr-20 mb-2">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-tight flex-1 truncate">
                    {insight.title}
                </div>
                {!cleanView && <InfoTip text={explainInsight(insight, isAr)} />}
            </div>
            <div className={`${valueSize} font-black bg-gradient-to-br from-emerald-300 to-cyan-300 bg-clip-text text-transparent leading-none`} title={fullValue}>
                {display}
            </div>
            {!cleanView && (
                <div className="mt-1.5 text-[9px] font-mono text-white/40 truncate" title={formula}>
                    ƒ {formula}
                </div>
            )}
            {insight.label && size !== 'compact' && (
                <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1 truncate">{insight.label}</div>
            )}
            {!cleanView && insight.narrative && size !== 'compact' && (
                <p className="text-[11px] text-white/55 mt-2 leading-snug line-clamp-2" title={insight.narrative}>
                    {insight.narrative}
                </p>
            )}
            {insight.warning && (
                <div className="mt-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">{insight.warning}</div>
            )}
        </motion.div>
    );
};

const FilterGroup: React.FC<{
    isAr: boolean;
    column: Column;
    active: string[];
    onToggle: (v: string) => void;
    onSet: (values: string[]) => void;
}> = ({ isAr, column, active, onToggle, onSet }) => {
    const top = (column.stats?.top || []) as Array<{ value: string; count: number }>;
    const [expanded, setExpanded] = useState(active.length > 0);
    const [searchQ, setSearchQ] = useState('');

    const filteredValues = useMemo(() => {
        if (!searchQ.trim()) return top;
        const q = searchQ.toLowerCase();
        return top.filter(t => String(t.value).toLowerCase().includes(q));
    }, [top, searchQ]);

    const allChecked = active.length > 0 && top.every(t => active.includes(t.value));
    const someChecked = active.length > 0 && !allChecked;

    return (
        <div className="border border-white/5 rounded-lg overflow-hidden bg-white/[0.01]">
            <button onClick={() => setExpanded(!expanded)} className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-white/[0.03] transition-colors">
                <div className="text-left min-w-0 flex-1">
                    <div className="text-[11px] font-black text-white truncate">{column.name}</div>
                    <div className="text-[9px] text-white/30 uppercase tracking-widest">
                        {column.stats?.distinct} {column.stats?.distinct === 1 ? 'value' : 'values'}
                    </div>
                </div>
                {active.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-[9px] font-black text-emerald-300 mr-2 shrink-0">{active.length}</span>
                )}
                {expanded ? <ChevronDown className="w-3 h-3 text-white/30" /> : <ChevronRightIcon className="w-3 h-3 text-white/30" />}
            </button>
            {expanded && top.length > 0 && (
                <div className="px-2 pb-2">
                    {top.length > 6 && (
                        <div className="relative mb-1.5">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                            <input
                                value={searchQ}
                                onChange={e => setSearchQ(e.target.value)}
                                placeholder={isAr ? 'بحث...' : 'Search...'}
                                className="w-full pl-7 pr-2 py-1.5 rounded border border-white/10 bg-white/5 text-white text-[11px] placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2 mb-1 px-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onSet(allChecked ? [] : top.map(t => t.value)); }}
                            className="text-[9px] font-black text-emerald-300 hover:text-emerald-200 uppercase tracking-widest"
                        >
                            {allChecked ? (isAr ? 'إلغاء الكل' : 'Clear all') : (isAr ? 'تحديد الكل' : 'Select all')}
                        </button>
                        {someChecked && !allChecked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onSet([]); }}
                                className="text-[9px] font-black text-rose-300 hover:text-rose-200 uppercase tracking-widest"
                            >
                                {isAr ? 'مسح' : 'Clear'}
                            </button>
                        )}
                    </div>
                    <div className="space-y-0.5 max-h-56 overflow-y-auto">
                        {filteredValues.length === 0 ? (
                            <div className="text-[10px] text-white/30 px-2 py-1.5 italic">{isAr ? 'لا توجد نتائج' : 'No matches'}</div>
                        ) : filteredValues.slice(0, 50).map(t => {
                            const checked = active.includes(t.value);
                            return (
                                <label key={t.value} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[11px] transition-colors ${checked ? 'bg-emerald-500/15 text-emerald-200' : 'hover:bg-white/[0.04] text-white/70'}`}>
                                    <input type="checkbox" checked={checked} onChange={() => onToggle(t.value)} className="accent-emerald-500 shrink-0" />
                                    <span className="flex-1 truncate" title={t.value}>{t.value}</span>
                                    <span className="text-[9px] text-white/30 font-mono shrink-0">{t.count}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------- Insight card ----------
const PIE_COLORS = ['#10b981', '#06b6d4', '#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'];

// ============================================================
// Chart card — used in Rankings / Distribution / Trends sections
// ============================================================
const ChartCard: React.FC<SharedCardProps & { wide?: boolean }> = ({ isAr, insight, size, wide, onCardDelete, onCardResize, onCardEdit, cleanView, onChartClick, activeFilters }) => {
    const Icon = insight.type === 'line' ? LineIcon : insight.type === 'pie' ? PieIcon : BarChart3;
    const tooltipStyle = { background: '#0f172a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 11 };
    const isWide = size === 'wide' || (wide && size !== 'compact');
    const chartHeight = size === 'compact' ? 160 : isWide ? 280 : 220;
    const formula = formatFormula(insight);
    const sortable = useSortableCard(insight.id);

    // Click-to-filter — fires when the user clicks a bar / pie slice / line point.
    // Only enabled when the chart's `groupBy` column is known and onChartClick is wired.
    const filterColumn = insight.groupBy || '';
    const canFilter = Boolean(filterColumn && onChartClick);
    const filteredValues = (activeFilters && filterColumn ? activeFilters[filterColumn] : []) || [];
    const handlePointClick = (datum: any) => {
        if (!canFilter) return;
        // Recharts can pass either `{ name, value }` directly or wrapped in `{ payload: { name, ... } }`.
        const name = datum?.name ?? datum?.payload?.name;
        if (name == null) return;
        onChartClick!(filterColumn, String(name));
    };

    const renderChart = () => {
        if (!insight.data || insight.data.length === 0) {
            return <div className="py-12 text-center text-white/40 text-sm">{isAr ? 'لا توجد بيانات' : 'No data'}</div>;
        }
        if (insight.type === 'line') {
            return (
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <LineChart data={insight.data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} tickMargin={6} />
                        <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickFormatter={formatCompact} width={48} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v)} />
                        <Line
                            type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5}
                            dot={{ fill: '#10b981', r: 3, style: canFilter ? { cursor: 'pointer' } : undefined }}
                            activeDot={{ r: 6, onClick: (_e: any, payload: any) => handlePointClick(payload), style: canFilter ? { cursor: 'pointer' } : undefined }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            );
        }
        if (insight.type === 'pie') {
            const total = insight.data.reduce((s, d) => s + (d.value || 0), 0);
            return (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <div className="sm:col-span-3">
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <PieChart>
                                <Pie
                                    data={insight.data} dataKey="value" nameKey="name"
                                    cx="50%" cy="50%" outerRadius={chartHeight / 2 - 20} innerRadius={chartHeight / 2 - 60}
                                    paddingAngle={2}
                                    onClick={canFilter ? (d: any) => handlePointClick(d) : undefined}
                                    style={canFilter ? { cursor: 'pointer' } : undefined}
                                >
                                    {insight.data.map((d, i) => {
                                        const active = filteredValues.includes(String(d.name));
                                        return (
                                            <Cell
                                                key={i}
                                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                                                stroke={active ? '#ffffff' : 'rgba(0,0,0,0.2)'}
                                                strokeWidth={active ? 2.5 : 1}
                                                opacity={filteredValues.length > 0 && !active ? 0.45 : 1}
                                            />
                                        );
                                    })}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="sm:col-span-2 space-y-1 max-h-[260px] overflow-y-auto pr-1">
                        {insight.data.slice(0, 12).map((d, i) => {
                            const pct = total > 0 ? (d.value / total) * 100 : 0;
                            const active = filteredValues.includes(String(d.name));
                            return (
                                <button
                                    key={i}
                                    onClick={() => canFilter && handlePointClick(d)}
                                    disabled={!canFilter}
                                    className={`w-full flex items-center gap-2 text-[11px] px-1.5 py-1 rounded transition-colors ${canFilter ? 'cursor-pointer hover:bg-white/[0.05]' : 'cursor-default'} ${active ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40' : ''}`}
                                >
                                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                    <span className={`flex-1 min-w-0 truncate text-left ${active ? 'text-emerald-200 font-bold' : 'text-white/70'}`} title={d.name}>{d.name}</span>
                                    <span className="text-white/90 font-bold font-mono">{formatCompact(d.value)}</span>
                                    <span className="text-white/40 font-mono w-10 text-right">{pct.toFixed(1)}%</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }
        // bar chart
        return (
            <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={insight.data} margin={{ top: 18, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} tickFormatter={(v) => String(v).length > 12 ? String(v).slice(0, 12) + '…' : v} interval={0} angle={insight.data.length > 6 ? -25 : 0} textAnchor={insight.data.length > 6 ? 'end' : 'middle'} height={insight.data.length > 6 ? 50 : 30} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickFormatter={formatCompact} width={48} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v)} />
                    <Bar
                        dataKey="value" radius={[6, 6, 0, 0]}
                        onClick={canFilter ? (d: any) => handlePointClick(d) : undefined}
                        style={canFilter ? { cursor: 'pointer' } : undefined}
                    >
                        {insight.data.map((d, i) => {
                            const active = filteredValues.includes(String(d.name));
                            return (
                                <Cell
                                    key={i}
                                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                                    stroke={active ? '#ffffff' : 'transparent'}
                                    strokeWidth={active ? 2 : 0}
                                    opacity={filteredValues.length > 0 && !active ? 0.45 : 1}
                                />
                            );
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <motion.div
            ref={sortable.setNodeRef}
            style={sortable.style}
            layout="position"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: sortable.isDragging ? 0.5 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`${SIZE_COL_SPAN[size]} group relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border ${sortable.isOver ? 'border-emerald-400 ring-2 ring-emerald-500/40' : 'border-white/10 hover:border-white/20'} rounded-2xl p-5`}
        >
            <CardControls
                isAr={isAr}
                id={insight.id}
                size={size}
                onDelete={() => onCardDelete(insight.id)}
                onResize={(s) => onCardResize(insight.id, s)}
                onEdit={onCardEdit ? () => onCardEdit(insight) : undefined}
                dragHandleProps={sortable.dragHandle}
            />
            <div className="flex items-start justify-between gap-2 mb-2 pr-20">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon className="w-4 h-4 text-emerald-300 mt-0.5 shrink-0" />
                    <h4 className="text-sm font-black text-white tracking-tight leading-tight">{insight.title}</h4>
                    {!cleanView && <InfoTip text={explainInsight(insight, isAr)} />}
                </div>
                {!cleanView && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 uppercase tracking-widest shrink-0">
                        {insight.type}
                    </span>
                )}
            </div>
            {!cleanView && (
                <div className="text-[10px] font-mono text-white/40 mb-2 truncate" title={formula}>
                    ƒ {formula}
                </div>
            )}
            {insight.warning && (
                <div className="mb-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">{insight.warning}</div>
            )}
            {!cleanView && insight.narrative && size !== 'compact' && (
                <p className="text-xs text-white/60 mb-3 leading-relaxed">{insight.narrative}</p>
            )}
            {renderChart()}
            {canFilter && filteredValues.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-emerald-300/80">
                    <FilterIcon className="w-3 h-3" />
                    <span className="font-bold">{filteredValues.length} {isAr ? 'مفعل' : 'filtered'}:</span>
                    <span className="truncate">{filteredValues.join(', ')}</span>
                </div>
            )}
        </motion.div>
    );
};

// ---------- Chat rail ----------
const ChatRail: React.FC<{
    isAr: boolean;
    open: boolean;
    setOpen: (b: boolean) => void;
    history: ChatTurn[];
    input: string;
    setInput: (s: string) => void;
    busy: boolean;
    onAsk: () => void;
    canChat: boolean;
}> = ({ isAr, open, setOpen, history, input, setInput, busy, onAsk, canChat }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [history.length, busy]);

    if (!open) return null;  // Closed state is the floating FAB rendered by Dashboard.

    return (
        <div className="sticky top-[88px] bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 120px)', maxHeight: 720 }}>
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-purple-500/40 rounded-lg">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-200" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black text-white">{isAr ? 'اسأل بياناتك' : 'Ask your data'}</div>
                        <div className="text-[9px] text-white/40 uppercase tracking-widest">{isAr ? 'مدعوم بـ Gemini' : 'Powered by Gemini'}</div>
                    </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/5 rounded text-white/40">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length === 0 && (
                    <div className="text-center py-8">
                        <Sparkles className="w-10 h-10 text-purple-300/50 mx-auto mb-3" />
                        <p className="text-xs text-white/50 leading-relaxed">
                            {isAr ? 'اسأل أي شيء عن بياناتك. مثلاً:' : 'Ask anything about your data. Try:'}
                        </p>
                        <div className="mt-3 space-y-1.5">
                            {(isAr
                                ? ['ما أعلى ثلاث فئات؟', 'كيف يبدو الاتجاه عبر الزمن؟', 'ما القيمة الإجمالية؟']
                                : ['What are the top 3 categories?', 'How is the trend over time?', 'What\'s the total value?']
                            ).map(s => (
                                <button key={s} onClick={() => setInput(s)} className="block w-full px-3 py-1.5 text-[11px] text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-left transition-colors">
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {history.map((t, i) => (
                    <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${t.role === 'user' ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100' : 'bg-white/[0.04] border border-white/10 text-white/80'}`}>
                            {t.content}
                        </div>
                    </div>
                ))}
                {busy && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {isAr ? 'يفكر...' : 'Thinking...'}
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-white/5 shrink-0">
                {!canChat && (
                    <div className="mb-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                        {isAr ? 'الدردشة غير متاحة لمشروع محفوظ. يرجى إعادة الرفع.' : 'Chat unavailable for saved projects. Re-upload to enable.'}
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (canChat && input.trim() && !busy) onAsk();
                            }
                        }}
                        placeholder={isAr ? 'اطرح سؤالاً...' : 'Ask a question...'}
                        rows={2}
                        disabled={!canChat || busy}
                        className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-white text-xs placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none disabled:opacity-50"
                    />
                    <button
                        onClick={onAsk}
                        disabled={!canChat || !input.trim() || busy}
                        className="p-2 bg-gradient-to-br from-purple-500 to-cyan-500 hover:brightness-110 disabled:opacity-30 text-white rounded-lg transition-all active:scale-95"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ---------- Schema modal ----------
// ============================================================
// Edit Calculation Modal — change a card's spec (type/agg/metric/groupBy/sort/limit)
// ============================================================
const EditCalculationModal: React.FC<{
    isAr: boolean;
    insight: Insight;
    columns: Column[];
    busy: boolean;
    onCancel: () => void;
    onSave: (spec: AnalysisSpec) => void;
}> = ({ isAr, insight, columns, busy, onCancel, onSave }) => {
    const [title, setTitle] = useState(insight.title);
    const [type, setType] = useState<'kpi' | 'bar' | 'line' | 'pie'>(insight.type as any);
    const [metric, setMetric] = useState(insight.metric || '');
    const [groupBy, setGroupBy] = useState(insight.groupBy || '');
    const [agg, setAgg] = useState<string>((insight as any).agg || 'sum');
    const [sort, setSort] = useState<'asc' | 'desc'>(((insight as any).sort as any) || 'desc');
    const [limit, setLimit] = useState<number>((insight as any).limit || 10);

    const numericCols = columns.filter(c => /int|float|number|double/i.test(c.dtype));
    const dateCols = columns.filter(c => /datetime|date/i.test(c.dtype) || c.role === 'date');

    const previewSpec: AnalysisSpec = {
        id: insight.id,
        title: title.trim() || insight.title,
        type,
        metric,
        groupBy,
        agg: agg as any,
        sort,
        limit,
    };
    const previewFormula = formatFormula({ ...(previewSpec as any), value: 0, narrative: '' } as any);

    const aggOptions: Array<{ id: string; en: string; ar: string }> = [
        { id: 'sum',     en: 'Sum',                 ar: 'مجموع' },
        { id: 'mean',    en: 'Average (mean)',      ar: 'متوسط' },
        { id: 'count',   en: 'Count rows',          ar: 'عدد الصفوف' },
        { id: 'min',     en: 'Minimum',             ar: 'أصغر قيمة' },
        { id: 'max',     en: 'Maximum',             ar: 'أكبر قيمة' },
        { id: 'nunique', en: 'Distinct count',      ar: 'عدد القيم الفريدة' },
        { id: 'rows_per_distinct', en: 'Rows ÷ Distinct (e.g. avg lines/invoice)', ar: 'الصفوف ÷ القيم الفريدة' },
    ];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onCancel}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
            <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500" />
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-cyan-400" />
                        {isAr ? 'تعديل الحساب' : 'Edit Calculation'}
                    </h3>
                    <button onClick={onCancel} className="p-1.5 hover:bg-white/5 rounded text-white/40">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <Field isAr={isAr} en="Title" ar="العنوان">
                        <input value={title} onChange={e => setTitle(e.target.value)} className={MODAL_INPUT_CLS} />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field isAr={isAr} en="Visualization" ar="نوع الرسم">
                            <select value={type} onChange={e => setType(e.target.value as any)} className={MODAL_INPUT_CLS}>
                                <option value="kpi">KPI (single number)</option>
                                <option value="bar">Bar chart</option>
                                <option value="pie">Pie / donut</option>
                                <option value="line">Line / trend</option>
                            </select>
                        </Field>
                        <Field isAr={isAr} en="Aggregation" ar="نوع الحساب">
                            <select value={agg} onChange={e => setAgg(e.target.value)} className={MODAL_INPUT_CLS}>
                                {aggOptions.map(a => <option key={a.id} value={a.id}>{isAr ? a.ar : a.en}</option>)}
                            </select>
                        </Field>
                    </div>

                    <Field isAr={isAr} en="Metric column (what to measure)" ar="عمود القياس">
                        <select value={metric} onChange={e => setMetric(e.target.value)} className={MODAL_INPUT_CLS}>
                            <option value="">— {isAr ? 'لا شيء (يحسب الصفوف)' : 'none (counts rows)'} —</option>
                            {(['sum', 'mean', 'min', 'max'].includes(agg) ? numericCols : columns).map(c => (
                                <option key={c.name} value={c.name}>{c.name} ({c.dtype})</option>
                            ))}
                        </select>
                    </Field>

                    {type !== 'kpi' && (
                        <Field isAr={isAr} en="Group by column" ar="التجميع حسب">
                            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className={MODAL_INPUT_CLS}>
                                <option value="">— {isAr ? 'بدون تجميع' : 'none'} —</option>
                                {(type === 'line' ? [...dateCols, ...columns.filter(c => !dateCols.includes(c))] : columns).map(c => (
                                    <option key={c.name} value={c.name}>{c.name} ({c.dtype})</option>
                                ))}
                            </select>
                        </Field>
                    )}

                    {type === 'bar' && (
                        <div className="grid grid-cols-2 gap-3">
                            <Field isAr={isAr} en="Sort" ar="الترتيب">
                                <select value={sort} onChange={e => setSort(e.target.value as any)} className={MODAL_INPUT_CLS}>
                                    <option value="desc">{isAr ? 'الأعلى أولاً' : 'Highest first (Top N)'}</option>
                                    <option value="asc">{isAr ? 'الأقل أولاً' : 'Lowest first (Bottom N)'}</option>
                                </select>
                            </Field>
                            <Field isAr={isAr} en="Limit (top N)" ar="عدد البنود">
                                <input
                                    type="number" min={1} max={50} value={limit}
                                    onChange={e => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                                    className={MODAL_INPUT_CLS}
                                />
                            </Field>
                        </div>
                    )}

                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                        <div className="text-[10px] font-black text-emerald-300/80 uppercase tracking-widest mb-1">
                            {isAr ? 'معاينة الصيغة' : 'Formula preview'}
                        </div>
                        <div className="text-sm font-mono text-white">ƒ {previewFormula}</div>
                    </div>
                </div>

                <div className="border-t border-white/5 p-4 flex gap-2 shrink-0">
                    <button onClick={onCancel} disabled={busy} className="flex-1 px-4 py-2.5 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-black rounded-xl">
                        {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                        onClick={() => onSave(previewSpec)}
                        disabled={busy || (type !== 'kpi' && !groupBy && agg !== 'count')}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {busy ? (isAr ? 'يحسب...' : 'Recomputing...') : (isAr ? 'إعادة الحساب' : 'Recalculate')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const MODAL_INPUT_CLS = "w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

const Field: React.FC<{ isAr: boolean; en: string; ar: string; children: React.ReactNode }> = ({ isAr, en, ar, children }) => (
    <label className="block">
        <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5">{isAr ? ar : en}</div>
        {children}
    </label>
);

const SchemaModal: React.FC<{ isAr: boolean; columns: Column[]; onClose: () => void }> = ({ isAr, columns, onClose }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500" />
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <SettingsIcon className="w-4 h-4 text-emerald-400" /> {isAr ? 'مخطط البيانات' : 'Data Schema'}
                </h3>
                <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded text-white/40">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
                <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] sticky top-0 backdrop-blur-md">
                        <tr className="text-white/40">
                            <th className="px-3 py-2 font-black uppercase tracking-widest">{isAr ? 'العمود' : 'Column'}</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest">{isAr ? 'النوع' : 'Type'}</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest">{isAr ? 'الدور' : 'Role'}</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest">{isAr ? 'دلالة' : 'Semantic'}</th>
                            <th className="px-3 py-2 font-black uppercase tracking-widest">{isAr ? 'عيّنة' : 'Sample'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {columns.map(c => (
                            <tr key={c.name} className="hover:bg-white/[0.02]">
                                <td className="px-3 py-2.5 font-bold text-white">{c.name}</td>
                                <td className="px-3 py-2.5 text-white/40 font-mono text-[10px]">{c.dtype}</td>
                                <td className="px-3 py-2.5">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                                        {c.role}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-white/70 text-[11px]">{c.semantic || '—'}</td>
                                <td className="px-3 py-2.5 text-white/40 truncate max-w-[200px]">{(c.sample || []).slice(0, 3).join(', ')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

// ---------- Save dialog ----------
const SaveDialog: React.FC<{
    isAr: boolean; name: string; setName: (s: string) => void;
    category: string; setCategory: (s: string) => void;
    isShared: boolean; setIsShared: (b: boolean) => void;
    allCategories: string[];
    state: 'idle' | 'saving' | 'ok' | 'err';
    onCancel: () => void; onSave: () => void;
}> = ({ isAr, name, setName, category, setCategory, isShared, setIsShared, allCategories, state, onCancel, onSave }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onCancel}>
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500" />
            <div className="p-6">
                <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                    <Save className="w-4 h-4 text-emerald-400" /> {isAr ? 'حفظ المشروع' : 'Save Project'}
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5">{isAr ? 'اسم المشروع' : 'Project name'}</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5">{isAr ? 'التصنيف' : 'Category'}</label>
                        <input type="text" list="data-assist-cats" value={category} onChange={e => setCategory(e.target.value)} placeholder={isAr ? 'مثلاً: المبيعات' : 'e.g. Sales'} className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                        <datalist id="data-assist-cats">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)} className="accent-emerald-500" />
                        <span className="text-xs text-white/70">{isAr ? 'مشاركة مع زملاء الشركة' : 'Share with company colleagues'}</span>
                    </label>
                </div>
                <div className="mt-6 flex gap-2">
                    <button onClick={onCancel} disabled={state === 'saving'} className="flex-1 px-4 py-2.5 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-black rounded-xl">{isAr ? 'إلغاء' : 'Cancel'}</button>
                    <button onClick={onSave} disabled={state === 'saving'} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95">
                        {state === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {state === 'ok' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {state === 'idle' && <Save className="w-3.5 h-3.5" />}
                        {state === 'saving' ? (isAr ? 'يحفظ...' : 'Saving...') : state === 'ok' ? (isAr ? 'تم!' : 'Saved!') : (isAr ? 'حفظ' : 'Save')}
                    </button>
                </div>
            </div>
        </div>
    </div>
);

export default DataAssistV2;
