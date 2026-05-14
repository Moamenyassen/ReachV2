/**
 * SmartWorkflows — AI-translated mini-ETL ("Daily Tasks").
 *
 * Two phases:
 *   Phase 1 (Setup):
 *     pick samples → name slots → write prompt → AI returns a workflow JSON
 *     → review/save to Supabase
 *
 *   Phase 2 (Run):
 *     pick saved task → drop today's files → confirm column re-map (drift)
 *     → step-by-step preview with "Confirm & Next" → final xlsx download
 *
 * AI is called ONCE at setup. Daily runs are deterministic Python.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Sparkles, Plus, Loader2, ChevronLeft, Save, FileSpreadsheet, Search, Tag,
    Upload, AlertCircle, CheckCircle2, X, Trash2, ArrowRight, RefreshCw,
    Workflow, Wand2, Layers, Download, Eye, Pencil, Link2, Hash, FileText, Table2,
} from 'lucide-react';
import { ViewMode } from '../../../types';
import { supabase } from '../../../services/supabase';

const API_BASE = (typeof window !== 'undefined' && (window as any).REACH_API_BASE) || 'http://localhost:8000';

// Network failure messages vary by browser engine: Chrome → "Failed to fetch",
// Safari/WebKit → "Load failed", Firefox → "NetworkError when attempting to fetch".
// Surface a single actionable hint regardless of which engine the user is on.
const prettifyFetchError = (e: any, fallback: string): string => {
    const m: string = e?.message || fallback;
    if (
        m === 'Failed to fetch' ||
        m === 'Load failed' ||
        m.toLowerCase().includes('networkerror') ||
        m.toLowerCase().includes('network request failed')
    ) {
        return 'Cannot reach the backend. Is FastAPI running on port 8000?';
    }
    return m;
};

// Read the error body from a non-OK Response, preferring a clean `detail` field.
const readErrorBody = async (r: Response): Promise<string> => {
    const raw = await r.text();
    try {
        const j = JSON.parse(raw);
        return typeof j.detail === 'string' ? j.detail : (j.message || raw);
    } catch {
        return raw;
    }
};

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

type StepOp = 'join' | 'fill' | 'rename' | 'select';

interface JoinStep   { op: 'join';   left: string; right: string; on_left: string; on_right: string; how: 'left' | 'inner'; as: string; }
interface FillStep   { op: 'fill';   input: string; column: string; value: any; as: string; }
interface RenameStep { op: 'rename'; input: string; map: Record<string, string>; as: string; }
interface SelectStep { op: 'select'; input: string; columns: string[]; as: string; }
type WorkflowStep = JoinStep | FillStep | RenameStep | SelectStep;

interface InputSlot { slot: string; filename?: string; sheet?: string; description?: string; }

type OutputType = 'records' | 'value' | 'template';
type AggFunc = 'sum' | 'count' | 'avg' | 'min' | 'max';

interface WorkflowJson {
    inputs: InputSlot[];
    steps: WorkflowStep[];
    output: {
        final_step: string;
        columns?: string[];
        filename: string;
        sheet: string;
        output_type?: OutputType;
        agg_func?: AggFunc;
        agg_column?: string;
        template_title?: string;
    };
}

interface RelationshipSuggestion { left_column: string; right_column: string; overlap: number; name_similarity: number; score: number; }
interface SlotRelationship { left_slot: string; right_slot: string; suggestions: RelationshipSuggestion[]; }
interface ConfirmedRelationship { left_slot: string; right_slot: string; left_column: string; right_column: string; }

interface ColumnSchema { name: string; dtype: string; sample: string[]; }
interface SlotSchema { filename: string; sheet: string; columns: ColumnSchema[]; row_count: number; }
type InputSchemas = Record<string, SlotSchema>;

interface SavedWorkflow {
    id: string;
    name: string;
    description?: string;
    category?: string;
    is_shared?: boolean;
    prompt: string;
    workflow_json: WorkflowJson;
    input_schemas: InputSchemas;
    created_at?: string;
    updated_at?: string;
}

interface MissingCol { original: string; suggestions: string[]; }
interface DriftReport { filename: string; original_columns: string[]; current_columns: string[]; missing_columns: MissingCol[]; extra_columns: string[]; row_count: number; }

interface StepResult {
    index: number;
    op: StepOp;
    as: string;
    stats: { matched_rows: number; unmatched_rows: number; total_rows: number; note: string };
    preview_columns: string[];
    preview_rows: Record<string, any>[];
    row_count: number;
}

// ----------------------------------------------------------------
// Top-level component
// ----------------------------------------------------------------

interface Props {
    companyId?: string;
    userId?: string;
    isDarkMode?: boolean;
    language?: 'en' | 'ar';
    onBack?: () => void;
    hideHeader?: boolean;
}

const SmartWorkflows: React.FC<Props> = ({ companyId, userId, language = 'en', onBack, hideHeader }) => {
    const isAr = language === 'ar';
    type Mode = 'list' | 'setup' | 'run';
    const [mode, setMode] = useState<Mode>('list');

    const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');

    const [activeWorkflow, setActiveWorkflow] = useState<SavedWorkflow | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchList = useCallback(async () => {
        if (!companyId) return;
        setLoadingList(true);
        try {
            const { data, error } = await supabase
                .from('excel_workflows')
                .select('*')
                .eq('company_id', companyId)
                .or(`user_id.eq.${userId},is_shared.eq.true`)
                .order('updated_at', { ascending: false });
            if (error) throw error;
            setWorkflows((data as SavedWorkflow[]) || []);
        } catch (e: any) {
            console.warn('[SmartWorkflows] list fetch failed:', e?.message);
            setWorkflows([]);
        } finally {
            setLoadingList(false);
        }
    }, [companyId, userId]);

    useEffect(() => { void fetchList(); }, [fetchList]);

    const allCategories = useMemo(() => {
        const s = new Set<string>();
        workflows.forEach(w => { if (w.category) s.add(w.category); });
        return Array.from(s).sort();
    }, [workflows]);

    const filtered = useMemo(() => {
        let list = workflows;
        if (filterCategory !== 'All') list = list.filter(w => w.category === filterCategory);
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(w =>
                w.name?.toLowerCase().includes(q) ||
                w.category?.toLowerCase().includes(q) ||
                w.description?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [workflows, filterCategory, searchTerm]);

    const startNew = () => { setActiveWorkflow(null); setErrorMsg(null); setMode('setup'); };
    const openRun = (wf: SavedWorkflow) => { setActiveWorkflow(wf); setErrorMsg(null); setMode('run'); };

    const deleteWorkflow = async (id: string) => {
        if (!confirm(isAr ? 'هل تريد حذف هذه المهمة؟' : 'Delete this workflow?')) return;
        try {
            const { error } = await supabase.from('excel_workflows').delete().eq('id', id);
            if (error) throw error;
            setWorkflows(prev => prev.filter(w => w.id !== id));
        } catch (e: any) {
            alert(`Delete failed: ${e?.message}`);
        }
    };

    return (
        <div data-reach-screen className="flex-1 flex flex-col w-full bg-[#0a0a14] font-sans transition-colors overflow-x-hidden min-h-screen relative">
            <div className="fixed inset-0 pointer-events-none opacity-25 z-0">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-3xl" />
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
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl blur-md opacity-60" />
                            <div className="relative p-2.5 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 rounded-2xl shadow-lg">
                                <Workflow className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                                {mode === 'run' && activeWorkflow ? activeWorkflow.name : (isAr ? 'المهام الذكية' : 'Smart Workflows')}
                            </h2>
                            <p className="text-[11px] text-white/50 font-medium hidden sm:block">
                                {isAr ? 'حوّل المهام اليومية في إكسل إلى أتمتة بنقرة واحدة' : 'Turn repetitive Excel work into one-click automation'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
                {errorMsg && (
                    <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        <div className="flex-1 text-sm text-rose-300">{errorMsg}</div>
                        <button onClick={() => setErrorMsg(null)} className="text-rose-400/60 hover:text-rose-300">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {mode === 'list' && (
                    <WorkflowsList
                        isAr={isAr}
                        workflows={filtered}
                        loadingList={loadingList}
                        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                        filterCategory={filterCategory} setFilterCategory={setFilterCategory}
                        allCategories={allCategories}
                        onNew={startNew}
                        onRun={openRun}
                        onDelete={deleteWorkflow}
                    />
                )}

                {mode === 'setup' && (
                    <SetupWizard
                        isAr={isAr}
                        userId={userId}
                        companyId={companyId}
                        allCategories={allCategories}
                        onCancel={() => setMode('list')}
                        onSaved={() => { setMode('list'); void fetchList(); }}
                        onError={setErrorMsg}
                    />
                )}

                {mode === 'run' && activeWorkflow && (
                    <RunWizard
                        isAr={isAr}
                        workflow={activeWorkflow}
                        onCancel={() => setMode('list')}
                        onError={setErrorMsg}
                    />
                )}
            </div>
        </div>
    );
};

// ============================================================
// List view
// ============================================================

const WorkflowsList: React.FC<any> = ({ isAr, workflows, loadingList, searchTerm, setSearchTerm, filterCategory, setFilterCategory, allCategories, onNew, onRun, onDelete }) => (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder={isAr ? 'ابحث في مهامك...' : 'Search your workflows...'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
            </div>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-sm focus:outline-none">
                <option value="All">{isAr ? 'كل التصنيفات' : 'All Categories'}</option>
                {allCategories.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={onNew} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:brightness-110 text-white text-sm font-black rounded-xl shadow-lg shadow-fuchsia-500/30 flex items-center gap-2 whitespace-nowrap transition-all active:scale-95">
                <Plus className="w-4 h-4" /> {isAr ? 'مهمة جديدة' : 'New Workflow'}
            </button>
        </div>

        {loadingList ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Loader2 className="w-10 h-10 text-fuchsia-400 animate-spin mb-4" />
                <p className="text-white/50 font-bold">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
            </div>
        ) : workflows.length === 0 ? (
            <EmptyList isAr={isAr} onNew={onNew} />
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workflows.map((w: SavedWorkflow) => (
                    <WorkflowCard key={w.id} isAr={isAr} workflow={w} onRun={() => onRun(w)} onDelete={() => onDelete(w.id)} />
                ))}
            </div>
        )}
    </div>
);

const EmptyList: React.FC<{ isAr: boolean; onNew: () => void }> = ({ isAr, onNew }) => (
    <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative w-32 h-32 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-indigo-500/10 border border-fuchsia-500/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Wand2 className="w-14 h-14 text-fuchsia-300" />
            </div>
        </div>
        <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">
            {isAr ? 'أتمت مهامك اليومية في إكسل' : 'Automate your daily Excel work'}
        </h3>
        <p className="text-white/50 max-w-md mb-8 leading-relaxed">
            {isAr
                ? 'صف مهمتك بلغة طبيعية، حمّل ملفات نموذجية، وسيقوم الذكاء الاصطناعي ببناء سير عمل قابل لإعادة الاستخدام يومياً بنقرة واحدة.'
                : 'Describe your task in plain English, upload sample files, and AI builds a workflow you can re-run every day in one click.'}
        </p>
        <button onClick={onNew} className="px-8 py-3.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:brightness-110 text-white text-sm font-black rounded-xl shadow-lg shadow-fuchsia-500/30 flex items-center gap-2 transition-all active:scale-95">
            <Plus className="w-5 h-5" /> {isAr ? 'ابدأ' : 'Get Started'}
        </button>
    </div>
);

const WorkflowCard: React.FC<{ isAr: boolean; workflow: SavedWorkflow; onRun: () => void; onDelete: () => void }> = ({ isAr, workflow, onRun, onDelete }) => {
    const updated = workflow.updated_at ? new Date(workflow.updated_at).toLocaleDateString() : '';
    const inputCount = workflow.workflow_json?.inputs?.length || 0;
    const stepCount = workflow.workflow_json?.steps?.length || 0;
    return (
        <div className="group relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 hover:border-fuchsia-500/40 rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-fuchsia-500/10">
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-start gap-3 mb-3">
                <div className="p-2.5 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-fuchsia-500/30 rounded-xl shrink-0">
                    <Workflow className="w-5 h-5 text-fuchsia-300" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-white truncate">{workflow.name}</h4>
                    {workflow.category && (
                        <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-fuchsia-300/80 bg-fuchsia-500/10 rounded border border-fuchsia-500/20">
                            <Tag className="w-2.5 h-2.5" /> {workflow.category}
                        </span>
                    )}
                </div>
            </div>
            {workflow.description && (
                <p className="text-[11px] text-white/55 mb-3 line-clamp-2 leading-snug">{workflow.description}</p>
            )}
            <div className="flex items-center justify-between text-[10px] text-white/40 mb-3">
                <span>{inputCount} {isAr ? 'ملف' : inputCount === 1 ? 'file' : 'files'} · {stepCount} {isAr ? 'خطوة' : 'steps'}</span>
                {updated && <span>{isAr ? 'محدّث:' : 'Updated:'} {updated}</span>}
            </div>
            <button
                onClick={onRun}
                className="w-full px-3 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:brightness-110 text-white text-xs font-black rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
                <ArrowRight className="w-3.5 h-3.5" />
                {isAr ? 'تشغيل اليوم' : 'Run Today'}
            </button>
        </div>
    );
};

// ============================================================
// Setup — Phase 1, single-page form (no wizard)
// ============================================================

const SetupWizard: React.FC<{
    isAr: boolean;
    userId?: string;
    companyId?: string;
    allCategories: string[];
    onCancel: () => void;
    onSaved: () => void;
    onError: (msg: string | null) => void;
}> = ({ isAr, userId, companyId, allCategories, onCancel, onSaved, onError }) => {
    // Sample slot uploads
    const [slots, setSlots] = useState<Array<{ slotName: string; file: File | null }>>([
        { slotName: 'prices', file: null },
        { slotName: 'master', file: null },
    ]);
    const addSlot = () => setSlots(prev => [...prev, { slotName: `input${prev.length + 1}`, file: null }]);
    const removeSlot = (i: number) => setSlots(prev => prev.filter((_, idx) => idx !== i));
    const updateSlot = (i: number, patch: Partial<{ slotName: string; file: File | null }>) =>
        setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

    const [prompt, setPrompt] = useState('');
    const [translating, setTranslating] = useState(false);
    const [workflow, setWorkflow] = useState<WorkflowJson | null>(null);
    const [inputSchemas, setInputSchemas] = useState<InputSchemas>({});

    // Relationships (VLookup-style join hints between input files)
    const [relSuggestions, setRelSuggestions] = useState<SlotRelationship[]>([]);
    const [confirmedRels, setConfirmedRels] = useState<ConfirmedRelationship[]>([]);
    const [slotColumns, setSlotColumns] = useState<Record<string, string[]>>({});
    const [detectingRels, setDetectingRels] = useState(false);
    const [relsDetected, setRelsDetected] = useState(false);

    // Prompt enhancement
    const [enhancing, setEnhancing] = useState(false);
    const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);

    // Save fields (always visible — pre-fill once AI returns)
    const [saveName, setSaveName] = useState('');
    const [saveCategory, setSaveCategory] = useState('');
    const [saveShared, setSaveShared] = useState(false);
    const [saving, setSaving] = useState(false);

    const filesReady = slots.every(s => s.file && s.slotName.trim().length > 0);
    const promptReady = prompt.trim().length > 5;
    const canTranslate = filesReady && promptReady;

    const deriveDefaultName = (p: string): string => {
        const first = (p.split(/[.\n!?]/)[0] || '').trim();
        return first.slice(0, 60) || 'Untitled Workflow';
    };

    // Auto-trigger relationship detection once every slot has a file
    useEffect(() => {
        if (!filesReady) {
            setRelSuggestions([]);
            setConfirmedRels([]);
            setSlotColumns({});
            setRelsDetected(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setDetectingRels(true);
            try {
                const fd = new FormData();
                fd.append('slot_names', JSON.stringify(slots.map(s => s.slotName.trim())));
                for (const s of slots) {
                    if (s.file) fd.append('files', s.file, s.file.name);
                }
                const r = await fetch(`${API_BASE}/etl/detect-relationships`, { method: 'POST', body: fd });
                if (!r.ok) throw new Error(await readErrorBody(r));
                const data = await r.json();
                if (cancelled) return;
                setRelSuggestions(data.relationships || []);
                const cols: Record<string, string[]> = {};
                (data.files || []).forEach((f: any) => { cols[f.slot] = f.columns || []; });
                setSlotColumns(cols);
                // Auto-confirm the top suggestion per pair
                const auto: ConfirmedRelationship[] = (data.relationships || []).map((r: SlotRelationship) => {
                    const top = r.suggestions?.[0];
                    return top ? { left_slot: r.left_slot, right_slot: r.right_slot, left_column: top.left_column, right_column: top.right_column } : null;
                }).filter(Boolean) as ConfirmedRelationship[];
                setConfirmedRels(auto);
                setRelsDetected(true);
            } catch (e: any) {
                if (!cancelled) onError(prettifyFetchError(e, 'Relationship detection failed'));
            } finally {
                if (!cancelled) setDetectingRels(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filesReady, slots.map(s => s.slotName + ':' + (s.file?.name || '')).join('|')]);

    const updateConfirmedRel = (idx: number, patch: Partial<ConfirmedRelationship>) => {
        setConfirmedRels(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    };
    const removeConfirmedRel = (idx: number) => setConfirmedRels(prev => prev.filter((_, i) => i !== idx));
    const addConfirmedRel = () => {
        if (slots.length < 2) return;
        const a = slots[0].slotName.trim();
        const b = slots[1].slotName.trim();
        setConfirmedRels(prev => [...prev, { left_slot: a, right_slot: b, left_column: '', right_column: '' }]);
    };

    const callEnhancePrompt = async () => {
        if (!prompt.trim()) return;
        onError(null);
        setEnhancing(true);
        try {
            const slotMeta = slots.map(s => ({
                slot: s.slotName.trim(),
                filename: s.file?.name || '',
                columns: slotColumns[s.slotName.trim()] || [],
            }));
            const r = await fetch(`${API_BASE}/etl/enhance-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt.trim(), slots: slotMeta, relationships: confirmedRels }),
            });
            if (!r.ok) throw new Error(await readErrorBody(r));
            const data = await r.json();
            setEnhancedPrompt(data.enhanced_prompt || null);
        } catch (e: any) {
            onError(prettifyFetchError(e, 'Enhance failed'));
        } finally {
            setEnhancing(false);
        }
    };

    const acceptEnhanced = () => {
        if (enhancedPrompt) {
            setPrompt(enhancedPrompt);
            setEnhancedPrompt(null);
        }
    };

    const callTranslate = async () => {
        onError(null);
        setTranslating(true);
        try {
            const fd = new FormData();
            fd.append('prompt', prompt.trim());
            fd.append('slot_names', JSON.stringify(slots.map(s => s.slotName.trim())));
            fd.append('relationships', JSON.stringify(confirmedRels));
            for (const s of slots) {
                if (s.file) fd.append('files', s.file, s.file.name);
            }
            const r = await fetch(`${API_BASE}/etl/translate`, { method: 'POST', body: fd });
            if (!r.ok) throw new Error(await readErrorBody(r));
            const data = await r.json();
            const wf: WorkflowJson = data.workflow_json;
            // Default output_type to "records" so existing UI works
            wf.output = { ...wf.output, output_type: wf.output.output_type || 'records' };
            setWorkflow(wf);
            setInputSchemas(data.input_schemas);
            if (!saveName.trim()) setSaveName(deriveDefaultName(prompt));
        } catch (e: any) {
            onError(prettifyFetchError(e, 'Translation failed'));
        } finally {
            setTranslating(false);
        }
    };

    const removeStep = (i: number) => {
        if (!workflow) return;
        const next = { ...workflow, steps: workflow.steps.filter((_, idx) => idx !== i) };
        if (next.output.final_step && !next.steps.some(s => s.as === next.output.final_step)) {
            next.output.final_step = next.steps[next.steps.length - 1]?.as || '';
        }
        setWorkflow(next);
    };

    const saveWorkflow = async () => {
        if (!companyId || !userId) { alert('Missing company / user context'); return; }
        if (!workflow) return;
        if (!saveName.trim()) { alert(isAr ? 'الاسم مطلوب' : 'Name is required'); return; }
        setSaving(true);
        try {
            const payload = {
                user_id: userId,
                company_id: companyId,
                name: saveName.trim(),
                description: prompt.trim().slice(0, 500),
                category: saveCategory.trim() || null,
                is_shared: saveShared,
                prompt: prompt.trim(),
                workflow_json: workflow,
                input_schemas: inputSchemas,
            };
            const { error } = await supabase.from('excel_workflows').insert(payload);
            if (error) throw error;
            onSaved();
        } catch (e: any) {
            alert(`Save failed: ${e?.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Output config — editable, pre-filled from AI's suggestion when available.
    const outputColumnsText = workflow?.output?.columns?.join(', ') || '';
    const outputFilename = workflow?.output?.filename || 'result.xlsx';
    const outputSheet = workflow?.output?.sheet || 'Result';

    const updateOutput = (patch: Partial<WorkflowJson['output']>) => {
        if (!workflow) return;
        setWorkflow({ ...workflow, output: { ...workflow.output, ...patch } });
    };

    return (
        <div className="space-y-5 pb-20">
            {/* ════════ ① INPUTS ════════ */}
            <SectionCard
                step={1}
                label={isAr ? 'الإدخالات' : 'Inputs'}
                isAr={isAr}
                title={isAr ? 'الملفات النموذجية' : 'Sample Files'}
                hint={isAr
                    ? 'أعطِ كل ملف اسماً قصيراً (مثل "prices") واسحب ملف نموذجياً. سيرى الذكاء الاصطناعي الأعمدة الفعلية لبناء سير العمل.'
                    : 'Name each slot (e.g. "prices") and drop a sample file. AI sees the real columns when building the workflow.'}
                done={filesReady}
            >
                <div className="space-y-3">
                    {slots.map((s, i) => (
                        <SlotRow key={i} isAr={isAr} index={i} slot={s} onChange={(p) => updateSlot(i, p)} onRemove={slots.length > 1 ? () => removeSlot(i) : undefined} />
                    ))}
                    <button onClick={addSlot} className="w-full px-3 py-2.5 border border-dashed border-white/15 hover:border-fuchsia-400 hover:bg-fuchsia-500/5 text-white/60 hover:text-fuchsia-300 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all">
                        <Plus className="w-3.5 h-3.5" /> {isAr ? 'إضافة ملف' : 'Add another file'}
                    </button>
                </div>

                {/* Relationships diagram — VLookup-style join hints between files */}
                {filesReady && slots.length >= 2 && (
                    <RelationshipsPanel
                        isAr={isAr}
                        detecting={detectingRels}
                        detected={relsDetected}
                        suggestions={relSuggestions}
                        confirmed={confirmedRels}
                        slotColumns={slotColumns}
                        slotNames={slots.map(s => s.slotName.trim())}
                        onUpdate={updateConfirmedRel}
                        onRemove={removeConfirmedRel}
                        onAdd={addConfirmedRel}
                    />
                )}
            </SectionCard>

            {/* ════════ ② DIRECTIONS ════════ */}
            <SectionCard
                step={2}
                label={isAr ? 'التوجيهات' : 'Directions'}
                isAr={isAr}
                title={isAr ? 'وجّه الذكاء الاصطناعي' : 'AI Prompt'}
                hint={isAr
                    ? 'اشرح ما يجب أن يحدث بين الإدخالات والمخرج. سيقرأ الذكاء الاصطناعي ملفاتك ويبني خطوات العمل.'
                    : 'Describe what should happen between Inputs and Output. AI reads your files and builds the pipeline steps.'}
                done={promptReady && !!workflow}
            >
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 mb-3">
                    <textarea
                        value={prompt} onChange={e => setPrompt(e.target.value)}
                        placeholder={isAr
                            ? 'مثال: ادمج قائمة الأسعار مع قائمة المنتجات للحصول على أسماء الأصناف، ثم اضمّ المخزون من ملف الفانات. إذا كان المخزون فارغاً ضع صفر.'
                            : 'e.g. Join today\'s price list with the Product Master to get item names, then join with the Cash Vans stock. If stock is empty, put 0.'}
                        rows={5}
                        className="w-full bg-transparent text-white text-sm placeholder-white/30 focus:outline-none resize-none leading-relaxed"
                    />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <p className="text-[11px] text-white/40 flex-1">
                        {!filesReady
                            ? (isAr ? 'حمّل كل ملفات العينة أولاً.' : 'Upload all sample files first.')
                            : !promptReady
                                ? (isAr ? 'اكتب توجيهاً (٥+ أحرف).' : 'Write a direction (5+ chars).')
                                : workflow
                                    ? (isAr ? 'يمكنك تعديل التوجيه وإعادة التوليد.' : 'You can tweak the prompt and regenerate.')
                                    : (isAr ? 'حسّن صياغتك ثم وَلّد الخطوات.' : 'Polish the prompt, then generate steps.')}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={callEnhancePrompt}
                            disabled={!promptReady || enhancing || !filesReady}
                            title={isAr ? 'حسّن الصياغة احترافياً' : 'Rewrite the prompt professionally'}
                            className="px-4 py-2.5 border border-fuchsia-500/40 hover:border-fuchsia-400 hover:bg-fuchsia-500/10 text-fuchsia-200 disabled:opacity-40 text-xs font-black rounded-xl flex items-center gap-2 transition-all active:scale-95"
                        >
                            {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {isAr ? 'تحسين الصياغة' : 'Enhance Prompt'}
                        </button>
                        <button
                            onClick={callTranslate}
                            disabled={!canTranslate || translating}
                            className="px-5 py-2.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:brightness-110 disabled:opacity-40 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-fuchsia-500/30 transition-all active:scale-95"
                        >
                            {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            {translating
                                ? (isAr ? 'يبني سير العمل...' : 'Building...')
                                : workflow
                                    ? (isAr ? 'إعادة التوليد' : 'Regenerate')
                                    : (isAr ? 'توليد الخطوات' : 'Generate Steps')}
                        </button>
                    </div>
                </div>

                {/* Enhanced-prompt preview — shown after Enhance returns, user accepts or rejects */}
                {enhancedPrompt && (
                    <div className="mt-3 p-3 bg-gradient-to-br from-fuchsia-500/[0.08] to-violet-500/[0.05] border border-fuchsia-500/30 rounded-xl">
                        <div className="text-[10px] font-black text-fuchsia-300/90 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            {isAr ? 'الصياغة الاحترافية المقترحة' : 'AI-polished version'}
                        </div>
                        <p className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap mb-3">{enhancedPrompt}</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={acceptEnhanced}
                                className="px-3 py-1.5 bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:brightness-110 text-white text-[11px] font-black rounded-lg flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" /> {isAr ? 'استبدل صياغتي' : 'Use this version'}
                            </button>
                            <button
                                onClick={() => setEnhancedPrompt(null)}
                                className="px-3 py-1.5 border border-white/10 hover:bg-white/5 text-white/60 text-[11px] font-black rounded-lg"
                            >
                                {isAr ? 'تجاهل' : 'Dismiss'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Translated pipeline preview — appears inline below the prompt */}
                {workflow && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="text-[10px] font-black text-emerald-300/80 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            {isAr ? 'الخطوات المُولَّدة' : 'AI-translated steps'}
                        </div>
                        {workflow.steps.length === 0 ? (
                            <p className="text-xs text-amber-300 italic">{isAr ? 'لم تُولَّد خطوات. حاول إعادة الصياغة.' : 'No steps generated. Try rephrasing.'}</p>
                        ) : (
                            <div className="space-y-2">
                                {workflow.steps.map((step, i) => (
                                    <StepReviewCard key={i} isAr={isAr} index={i} step={step} onRemove={() => removeStep(i)} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </SectionCard>

            {/* ════════ ③ OUTPUT ════════ */}
            <SectionCard
                step={3}
                label={isAr ? 'المخرج' : 'Output'}
                isAr={isAr}
                title={isAr ? 'الملف النهائي' : 'Final File'}
                hint={workflow
                    ? (isAr ? 'حدد ما تريد في الملف النهائي. الذكاء الاصطناعي ملأ هذه الحقول — يمكنك التعديل.' : 'Specify what you want in the final file. AI pre-filled these — you can edit.')
                    : (isAr ? 'سيظهر هنا ما يقترحه الذكاء الاصطناعي بعد التوليد.' : 'Will populate after you generate the steps above.')}
                done={!!workflow && !!outputFilename.trim()}
            >
                {!workflow ? (
                    <div className="text-xs text-white/40 italic py-3">
                        {isAr ? '— في انتظار التوليد —' : '— waiting for generation —'}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Output type selector — Value | Template | Records */}
                        <OutputTypePicker
                            isAr={isAr}
                            value={workflow.output.output_type || 'records'}
                            onChange={(t) => updateOutput({ output_type: t })}
                        />

                        {/* Value-mode controls */}
                        {workflow.output.output_type === 'value' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-cyan-500/[0.05] border border-cyan-500/20 rounded-xl">
                                <div>
                                    <label className="block text-[10px] font-black text-cyan-200/80 uppercase tracking-widest mb-1.5">
                                        {isAr ? 'دالة التجميع' : 'Aggregation'}
                                    </label>
                                    <select
                                        value={workflow.output.agg_func || 'count'}
                                        onChange={e => updateOutput({ agg_func: e.target.value as AggFunc })}
                                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                    >
                                        <option value="count">COUNT</option>
                                        <option value="sum">SUM</option>
                                        <option value="avg">AVG</option>
                                        <option value="min">MIN</option>
                                        <option value="max">MAX</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-cyan-200/80 uppercase tracking-widest mb-1.5">
                                        {isAr ? 'العمود' : 'Column'}
                                    </label>
                                    <input
                                        value={workflow.output.agg_column || ''}
                                        onChange={e => updateOutput({ agg_column: e.target.value })}
                                        list="value-cols"
                                        placeholder={isAr ? 'مثال: السعر الجديد' : 'e.g. New Price'}
                                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                                    />
                                    <datalist id="value-cols">
                                        {(workflow.output.columns || []).map(c => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                                <p className="sm:col-span-2 text-[10px] text-cyan-200/70 leading-snug">
                                    {isAr
                                        ? 'سيُحسب رقم واحد من العمود المحدد. اترك العمود فارغاً مع COUNT لعَدّ كل الصفوف.'
                                        : 'Computes a single number from the chosen column. Leave column empty with COUNT to count all rows.'}
                                </p>
                            </div>
                        )}

                        {/* Template-mode title */}
                        {workflow.output.output_type === 'template' && (
                            <div className="p-3 bg-amber-500/[0.05] border border-amber-500/20 rounded-xl">
                                <label className="block text-[10px] font-black text-amber-200/80 uppercase tracking-widest mb-1.5">
                                    {isAr ? 'عنوان القالب' : 'Template heading'}
                                </label>
                                <input
                                    value={workflow.output.template_title || ''}
                                    onChange={e => updateOutput({ template_title: e.target.value })}
                                    placeholder={isAr ? 'مثال: تقرير الأسعار الأسبوعي' : 'e.g. Weekly Pricing Report'}
                                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                />
                                <p className="mt-1.5 text-[10px] text-amber-200/70">
                                    {isAr ? 'يُطبع كصف عنوان مدمج فوق الجدول، مع رأس عمود مُنسَّق وأعمدة بعرض تلقائي.' : 'Printed as a merged title row above the data, with styled header and auto-width columns.'}
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5">{isAr ? 'اسم الملف' : 'Filename'}</label>
                                <input
                                    value={outputFilename}
                                    onChange={e => updateOutput({ filename: e.target.value })}
                                    placeholder="result.xlsx"
                                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5">{isAr ? 'اسم الورقة' : 'Sheet name'}</label>
                                <input
                                    value={outputSheet}
                                    onChange={e => updateOutput({ sheet: e.target.value })}
                                    placeholder="Result"
                                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                                />
                            </div>
                        </div>
                        {workflow.output.output_type !== 'value' && (
                            <div>
                                <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5">
                                    {isAr ? 'الأعمدة (مفصولة بفاصلة)' : 'Columns (comma-separated)'}
                                </label>
                                <textarea
                                    value={outputColumnsText}
                                    onChange={e => {
                                        const cols = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                        updateOutput({ columns: cols });
                                    }}
                                    rows={2}
                                    placeholder={isAr ? 'كود الصنف, الاسم, السعر الجديد, مخزون الفان' : 'Item Code, Name, New Price, Van Stock'}
                                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
                                />
                                <p className="mt-1 text-[10px] text-white/40">
                                    {isAr ? 'اترك الحقل فارغاً لإبقاء كل أعمدة الخطوة النهائية.' : 'Leave empty to keep all columns from the final step.'}
                                </p>
                            </div>
                        )}
                        <div className="text-[11px] text-white/50 bg-white/[0.02] border border-white/5 rounded px-2.5 py-1.5">
                            <span className="text-white/30 uppercase tracking-widest text-[9px] mr-1.5">{isAr ? 'مصدر:' : 'from:'}</span>
                            <span className="font-mono text-fuchsia-300">{workflow.output.final_step || '—'}</span>
                            <span className="text-white/30 mx-1.5">·</span>
                            <span className="text-white/40">{workflow.steps.length} {isAr ? 'خطوة' : 'steps'}</span>
                        </div>
                    </div>
                )}
            </SectionCard>

            {/* ════════ Save bar (inline before sticky CTA) ════════ */}
            {workflow && (
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4">
                    <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2.5">
                        {isAr ? 'تفاصيل الحفظ' : 'Save details'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                        <div>
                            <label className="block text-[10px] font-bold text-white/40 mb-1">{isAr ? 'الاسم' : 'Name'}</label>
                            <input value={saveName} onChange={e => setSaveName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-white/40 mb-1">{isAr ? 'التصنيف' : 'Category'}</label>
                            <input value={saveCategory} onChange={e => setSaveCategory(e.target.value)} list="wf-cats" placeholder="e.g. Pricing" className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
                            <datalist id="wf-cats">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                        <input type="checkbox" checked={saveShared} onChange={e => setSaveShared(e.target.checked)} className="accent-fuchsia-500" />
                        {isAr ? 'مشاركة مع زملاء الشركة' : 'Share with company colleagues'}
                    </label>
                </div>
            )}

            {/* ════════ Sticky action bar ════════ */}
            <div className="sticky bottom-3 flex items-center justify-between gap-3 bg-[#0a0a14]/90 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-xl">
                <button onClick={onCancel} className="px-5 py-2 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-black rounded-lg">
                    {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                    onClick={saveWorkflow}
                    disabled={!workflow || saving || !saveName.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isAr ? 'حفظ في المكتبة' : 'Save to Library'}
                </button>
            </div>
        </div>
    );
};

// Reusable section card with a numbered badge + title + hint + completion mark
const SectionCard: React.FC<{
    step: number;
    label?: string;          // big section label — "Inputs" / "Directions" / "Output"
    isAr: boolean;
    title: string;
    hint?: string;
    done?: boolean;
    children: React.ReactNode;
}> = ({ step, label, title, hint, done, children }) => (
    <section className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${done ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-200'}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : step}
            </div>
            <div className="flex-1 min-w-0">
                {label && (
                    <div className="text-[10px] font-black text-fuchsia-300/80 uppercase tracking-[0.25em] mb-0.5">{label}</div>
                )}
                <h3 className="text-sm font-black text-white tracking-tight">{title}</h3>
                {hint && <p className="text-[11px] text-white/50 leading-snug mt-0.5">{hint}</p>}
            </div>
        </div>
        {children}
    </section>
);

// ─── Relationships panel ────────────────────────────────────────────
// Shows file-to-file VLookup-style join hints. Each row is a confirmed
// relationship: leftSlot.col ↔ rightSlot.col. Auto-populated from the
// /etl/detect-relationships heuristic; user can adjust columns or remove.

const RelationshipsPanel: React.FC<{
    isAr: boolean;
    detecting: boolean;
    detected: boolean;
    suggestions: SlotRelationship[];
    confirmed: ConfirmedRelationship[];
    slotColumns: Record<string, string[]>;
    slotNames: string[];
    onUpdate: (idx: number, patch: Partial<ConfirmedRelationship>) => void;
    onRemove: (idx: number) => void;
    onAdd: () => void;
}> = ({ isAr, detecting, detected, suggestions, confirmed, slotColumns, slotNames, onUpdate, onRemove, onAdd }) => {
    const allSuggestionsByPair = useMemo(() => {
        const m: Record<string, RelationshipSuggestion[]> = {};
        suggestions.forEach(s => { m[`${s.left_slot}::${s.right_slot}`] = s.suggestions; });
        return m;
    }, [suggestions]);

    return (
        <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-black text-violet-300/80 uppercase tracking-widest flex items-center gap-1.5">
                    <Link2 className="w-3 h-3" />
                    {isAr ? 'العلاقات بين الملفات (VLookup)' : 'File Relationships (VLookup)'}
                </div>
                {detecting && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-300" />}
            </div>

            {!detected && !detecting && (
                <p className="text-[11px] text-white/40 italic">
                    {isAr ? 'سيُكتشف تلقائياً بمجرد رفع كل الملفات.' : 'Will be detected automatically once all files are uploaded.'}
                </p>
            )}

            {detected && confirmed.length === 0 && (
                <div className="p-3 bg-amber-500/[0.05] border border-amber-500/20 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-200/80 leading-snug flex-1">
                        {isAr
                            ? 'لم نعثر على عمود مشترك بين الملفات. يمكنك إضافة علاقة يدوياً.'
                            : 'No shared key column detected. You can add a relationship manually.'}
                    </p>
                </div>
            )}

            <div className="space-y-2">
                {confirmed.map((rel, i) => {
                    const pairKey = `${rel.left_slot}::${rel.right_slot}`;
                    const altSuggestions = allSuggestionsByPair[pairKey] || [];
                    const leftCols = slotColumns[rel.left_slot] || [];
                    const rightCols = slotColumns[rel.right_slot] || [];
                    return (
                        <div key={i} className="bg-gradient-to-br from-violet-500/[0.06] to-fuchsia-500/[0.04] border border-violet-500/30 rounded-xl p-3">
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                                {/* LEFT */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <FileSpreadsheet className="w-3 h-3 text-violet-300" />
                                        <select
                                            value={rel.left_slot}
                                            onChange={e => onUpdate(i, { left_slot: e.target.value, left_column: '' })}
                                            className="bg-transparent text-[11px] font-black text-violet-200 focus:outline-none cursor-pointer"
                                        >
                                            {slotNames.map(s => <option key={s} value={s} className="bg-[#0a0a14]">{s}</option>)}
                                        </select>
                                    </div>
                                    <select
                                        value={rel.left_column}
                                        onChange={e => onUpdate(i, { left_column: e.target.value })}
                                        className="w-full px-2 py-1 rounded border border-white/10 bg-white/5 text-white text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                                    >
                                        <option value="">— {isAr ? 'اختر العمود' : 'pick column'} —</option>
                                        {leftCols.map(c => <option key={c} value={c} className="bg-[#0a0a14]">{c}</option>)}
                                    </select>
                                </div>

                                {/* JOIN ARROW */}
                                <div className="flex flex-col items-center justify-center px-1">
                                    <Link2 className="w-4 h-4 text-fuchsia-300" />
                                    <span className="text-[8px] font-black text-fuchsia-300/70 uppercase tracking-widest mt-0.5">
                                        {isAr ? 'يساوي' : 'matches'}
                                    </span>
                                </div>

                                {/* RIGHT */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <FileSpreadsheet className="w-3 h-3 text-fuchsia-300" />
                                        <select
                                            value={rel.right_slot}
                                            onChange={e => onUpdate(i, { right_slot: e.target.value, right_column: '' })}
                                            className="bg-transparent text-[11px] font-black text-fuchsia-200 focus:outline-none cursor-pointer"
                                        >
                                            {slotNames.map(s => <option key={s} value={s} className="bg-[#0a0a14]">{s}</option>)}
                                        </select>
                                    </div>
                                    <select
                                        value={rel.right_column}
                                        onChange={e => onUpdate(i, { right_column: e.target.value })}
                                        className="w-full px-2 py-1 rounded border border-white/10 bg-white/5 text-white text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                    >
                                        <option value="">— {isAr ? 'اختر العمود' : 'pick column'} —</option>
                                        {rightCols.map(c => <option key={c} value={c} className="bg-[#0a0a14]">{c}</option>)}
                                    </select>
                                </div>

                                <button
                                    onClick={() => onRemove(i)}
                                    title={isAr ? 'إزالة العلاقة' : 'Remove relationship'}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-white/40 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Alt suggestions for this pair */}
                            {altSuggestions.length > 1 && (
                                <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                                        {isAr ? 'مقترحات أخرى:' : 'Other suggestions:'}
                                    </span>
                                    {altSuggestions.slice(0, 3).map((s, k) => {
                                        const isCurrent = s.left_column === rel.left_column && s.right_column === rel.right_column;
                                        return (
                                            <button
                                                key={k}
                                                disabled={isCurrent}
                                                onClick={() => onUpdate(i, { left_column: s.left_column, right_column: s.right_column })}
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isCurrent ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 hover:bg-fuchsia-500/15 text-white/60 hover:text-fuchsia-200 border border-white/10'}`}
                                            >
                                                {s.left_column} ↔ {s.right_column}
                                                <span className="ml-1 text-white/30">{Math.round(s.overlap * 100)}%</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {detected && (
                <button
                    onClick={onAdd}
                    className="mt-2 w-full px-3 py-2 border border-dashed border-white/15 hover:border-violet-400 hover:bg-violet-500/5 text-white/50 hover:text-violet-300 text-[11px] font-black rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                    <Plus className="w-3 h-3" /> {isAr ? 'إضافة علاقة يدوياً' : 'Add a relationship manually'}
                </button>
            )}
        </div>
    );
};

// ─── Output type picker — Value | Template | Records ─────────────────
const OutputTypePicker: React.FC<{
    isAr: boolean;
    value: OutputType;
    onChange: (t: OutputType) => void;
}> = ({ isAr, value, onChange }) => {
    const opts: Array<{ id: OutputType; en: string; ar: string; desc_en: string; desc_ar: string; icon: React.ReactNode; gradient: string }> = [
        { id: 'value',    en: 'Value',    ar: 'قيمة',  desc_en: 'A single number (KPI)', desc_ar: 'رقم واحد (مؤشر)',   icon: <Hash className="w-4 h-4" />,    gradient: 'from-cyan-500 to-teal-500' },
        { id: 'template', en: 'Template', ar: 'قالب',  desc_en: 'Branded xlsx report',   desc_ar: 'تقرير منسق بشعار',   icon: <FileText className="w-4 h-4" />, gradient: 'from-amber-500 to-orange-500' },
        { id: 'records',  en: 'Records',  ar: 'سجلات', desc_en: 'Raw rows xlsx',         desc_ar: 'صفوف خام',           icon: <Table2 className="w-4 h-4" />,    gradient: 'from-violet-500 to-fuchsia-500' },
    ];
    return (
        <div>
            <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">
                {isAr ? 'نوع المخرج' : 'Output type'}
            </div>
            <div className="grid grid-cols-3 gap-2">
                {opts.map(o => {
                    const active = value === o.id;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => onChange(o.id)}
                            className={`relative p-3 rounded-xl border transition-all text-left ${active
                                ? `bg-gradient-to-br ${o.gradient} border-white/20 shadow-lg`
                                : 'bg-white/[0.03] border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                        >
                            <div className={`flex items-center gap-1.5 ${active ? 'text-white' : 'text-white/70'}`}>
                                {o.icon}
                                <span className="text-xs font-black">{isAr ? o.ar : o.en}</span>
                            </div>
                            <p className={`mt-1 text-[10px] leading-snug ${active ? 'text-white/85' : 'text-white/45'}`}>
                                {isAr ? o.desc_ar : o.desc_en}
                            </p>
                            {active && (
                                <CheckCircle2 className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-white" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const SlotRow: React.FC<{
    isAr: boolean;
    index: number;
    slot: { slotName: string; file: File | null };
    onChange: (p: Partial<{ slotName: string; file: File | null }>) => void;
    onRemove?: () => void;
}> = ({ isAr, index, slot, onChange, onRemove }) => {
    const [drag, setDrag] = useState(false);
    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="flex flex-col gap-1.5 sm:w-48 shrink-0">
                <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">
                    {isAr ? 'اسم القائمة' : 'Slot name'}
                </label>
                <input
                    value={slot.slotName} onChange={e => onChange({ slotName: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                    placeholder={`input${index + 1}`}
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
            </div>
            <div
                className={`flex-1 border-2 border-dashed rounded-lg p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors ${drag ? 'border-fuchsia-400 bg-fuchsia-500/10' : 'border-white/15 hover:border-fuchsia-500/40 hover:bg-white/[0.05]'}`}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onChange({ file: f }); }}
                onClick={() => document.getElementById(`slot-input-${index}`)?.click()}
            >
                <input
                    id={`slot-input-${index}`} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) onChange({ file: f }); }}
                />
                {slot.file ? (
                    <>
                        <FileSpreadsheet className="w-4 h-4 text-emerald-300 shrink-0" />
                        <span className="text-xs text-emerald-200 font-bold truncate">{slot.file.name}</span>
                        <span className="text-[10px] text-white/30 shrink-0 ml-auto">{(slot.file.size / 1024).toFixed(0)} KB</span>
                    </>
                ) : (
                    <>
                        <Upload className="w-4 h-4 text-white/40 shrink-0" />
                        <span className="text-xs text-white/50">{isAr ? 'انقر أو اسحب ملف Excel/CSV/PDF' : 'Click or drop .xlsx / .csv / .pdf'}</span>
                    </>
                )}
            </div>
            {onRemove && (
                <button onClick={onRemove} className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 text-white/40 self-start">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
};


const STEP_OP_LABEL: Record<StepOp, { en: string; ar: string; gradient: string }> = {
    join:   { en: 'Join Tables',     ar: 'دمج جداول',    gradient: 'from-violet-500 to-fuchsia-500' },
    fill:   { en: 'Fill Empty',      ar: 'تعبئة فارغ',   gradient: 'from-amber-500 to-orange-500' },
    rename: { en: 'Rename Columns',  ar: 'إعادة تسمية',  gradient: 'from-cyan-500 to-blue-500' },
    select: { en: 'Select Columns',  ar: 'اختيار أعمدة', gradient: 'from-emerald-500 to-teal-500' },
};

const StepReviewCard: React.FC<{ isAr: boolean; index: number; step: WorkflowStep; onRemove: () => void }> = ({ isAr, index, step, onRemove }) => {
    const lab = STEP_OP_LABEL[step.op];
    const summary = (() => {
        if (step.op === 'join')   return isAr ? `دمج ${step.left} مع ${step.right} على ${step.on_left} = ${step.on_right} (${step.how})` : `Join ${step.left} with ${step.right} on ${step.on_left} = ${step.on_right} (${step.how})`;
        if (step.op === 'fill')   return isAr ? `املأ "${step.column}" الفارغ بـ ${JSON.stringify(step.value)}` : `Fill empty "${step.column}" with ${JSON.stringify(step.value)}`;
        if (step.op === 'rename') return `${Object.entries(step.map).map(([k, v]) => `${k} → ${v}`).join(', ')}`;
        if (step.op === 'select') return `${step.columns.length} ${isAr ? 'عمود' : 'columns'}: ${step.columns.join(', ')}`;
        return '';
    })();
    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-start gap-3 group">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${lab.gradient} shrink-0`}>
                <span className="text-xs font-black text-white">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">{isAr ? lab.ar : lab.en}</span>
                    <span className="text-[9px] text-white/30 font-mono">→ {step.as}</span>
                </div>
                <p className="text-xs text-white/80 mt-1 break-words">{summary}</p>
            </div>
            <button onClick={onRemove} className="p-1.5 rounded text-white/30 hover:text-rose-300 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

// ============================================================
// Run wizard — Phase 2
// ============================================================

const RunWizard: React.FC<{
    isAr: boolean;
    workflow: SavedWorkflow;
    onCancel: () => void;
    onError: (msg: string | null) => void;
}> = ({ isAr, workflow, onCancel, onError }) => {
    type RunStage = 'upload' | 'mapping' | 'preview' | 'done';
    const [stage, setStage] = useState<RunStage>('upload');

    const slots = workflow.workflow_json.inputs;
    const [files, setFiles] = useState<Record<string, File | null>>(() => Object.fromEntries(slots.map(s => [s.slot, null])));
    const [runId, setRunId] = useState<string>('');
    const [drift, setDrift] = useState<Record<string, DriftReport>>({});
    const [columnRemap, setColumnRemap] = useState<Record<string, Record<string, string>>>({});
    const [stepIndex, setStepIndex] = useState<number>(-1);
    const [stepResults, setStepResults] = useState<StepResult[]>([]);
    const [busy, setBusy] = useState(false);
    const [final, setFinal] = useState<{ filename: string; row_count: number; columns: string[]; preview_rows: any[]; xlsx_base64: string; output_type?: OutputType; scalar_value?: number | string; agg_func?: string; agg_column?: string } | null>(null);

    const totalSteps = workflow.workflow_json.steps.length;
    const allFilesPicked = slots.every(s => !!files[s.slot]);

    // Upload + drift detection
    const submitUploads = async () => {
        onError(null); setBusy(true);
        try {
            const fd = new FormData();
            fd.append('workflow_json', JSON.stringify(workflow.workflow_json));
            fd.append('input_schemas', JSON.stringify(workflow.input_schemas));
            const slotNames = slots.map(s => s.slot);
            fd.append('slot_names', JSON.stringify(slotNames));
            for (const slot of slotNames) {
                const f = files[slot];
                if (f) fd.append('files', f, f.name);
            }
            const r = await fetch(`${API_BASE}/etl/run-init`, { method: 'POST', body: fd });
            if (!r.ok) throw new Error(await readErrorBody(r));
            const data = await r.json();
            setRunId(data.run_id);
            setDrift(data.drift || {});
            // Pre-populate columnRemap with the AI-suggested fuzzy match (top suggestion).
            const initialRemap: Record<string, Record<string, string>> = {};
            for (const [slot, d] of Object.entries(data.drift as Record<string, DriftReport>)) {
                if (d.missing_columns.length === 0) continue;
                const map: Record<string, string> = {};
                for (const m of d.missing_columns) {
                    if (m.suggestions.length > 0) map[m.suggestions[0]] = m.original;
                }
                if (Object.keys(map).length > 0) initialRemap[slot] = map;
            }
            setColumnRemap(initialRemap);
            const hasDrift = Object.values(data.drift as Record<string, DriftReport>).some((d) => d.missing_columns.length > 0);
            setStage(hasDrift ? 'mapping' : 'preview');
            if (!hasDrift) await runStep(0);
        } catch (e: any) {
            onError(prettifyFetchError(e, 'Upload failed'));
        } finally {
            setBusy(false);
        }
    };

    const runStep = async (idx: number) => {
        onError(null); setBusy(true);
        try {
            const r = await fetch(`${API_BASE}/etl/run-step`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ run_id: runId, step_index: idx, column_remap: columnRemap }),
            });
            if (!r.ok) throw new Error(await readErrorBody(r));
            const data = await r.json();
            setStepResults(data.step_results || []);
            setStepIndex(idx);
        } catch (e: any) {
            onError(prettifyFetchError(e, 'Step failed'));
        } finally {
            setBusy(false);
        }
    };

    const finalize = async () => {
        onError(null); setBusy(true);
        try {
            const r = await fetch(`${API_BASE}/etl/run-finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ run_id: runId, column_remap: columnRemap }),
            });
            if (!r.ok) throw new Error(await readErrorBody(r));
            const data = await r.json();
            setFinal(data);
            setStage('done');
        } catch (e: any) {
            onError(prettifyFetchError(e, 'Finalize failed'));
        } finally {
            setBusy(false);
        }
    };

    const downloadXlsx = () => {
        if (!final) return;
        const bytes = atob(final.xlsx_base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = final.filename || 'result.xlsx';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-5">
            <RunStageBar isAr={isAr} stage={stage} stepIndex={stepIndex} totalSteps={totalSteps} />

            {stage === 'upload' && (
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">
                        {isAr ? 'حمّل ملفات اليوم' : 'Upload today\'s files'}
                    </h3>
                    {slots.map(slot => {
                        const original = workflow.input_schemas[slot.slot];
                        return (
                            <RunSlotRow
                                key={slot.slot}
                                isAr={isAr}
                                slot={slot.slot}
                                originalFilename={original?.filename}
                                originalCols={original?.columns?.length || 0}
                                file={files[slot.slot]}
                                onChange={f => setFiles(prev => ({ ...prev, [slot.slot]: f }))}
                            />
                        );
                    })}
                    <div className="flex justify-between gap-3">
                        <button onClick={onCancel} className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-black rounded-xl">
                            {isAr ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                            onClick={submitUploads}
                            disabled={!allFilesPicked || busy}
                            className="px-6 py-2.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:brightness-110 disabled:opacity-40 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-fuchsia-500/30"
                        >
                            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                            {isAr ? 'متابعة' : 'Continue'}
                        </button>
                    </div>
                </div>
            )}

            {stage === 'mapping' && (
                <DriftMapping
                    isAr={isAr}
                    drift={drift}
                    columnRemap={columnRemap}
                    setColumnRemap={setColumnRemap}
                    onBack={() => setStage('upload')}
                    onContinue={async () => { setStage('preview'); await runStep(0); }}
                    busy={busy}
                />
            )}

            {stage === 'preview' && (
                <RunPreview
                    isAr={isAr}
                    stepResults={stepResults}
                    stepIndex={stepIndex}
                    totalSteps={totalSteps}
                    busy={busy}
                    onPrev={() => stepIndex > 0 && void runStep(stepIndex - 1)}
                    onNext={() => stepIndex < totalSteps - 1 && void runStep(stepIndex + 1)}
                    onFinalize={finalize}
                />
            )}

            {stage === 'done' && final && (
                <RunDone
                    isAr={isAr}
                    final={final}
                    onDownload={downloadXlsx}
                    onRunAgain={() => { setStage('upload'); setFinal(null); setStepResults([]); setStepIndex(-1); setRunId(''); setDrift({}); }}
                    onClose={onCancel}
                />
            )}
        </div>
    );
};

const RunStageBar: React.FC<{ isAr: boolean; stage: 'upload' | 'mapping' | 'preview' | 'done'; stepIndex: number; totalSteps: number }> = ({ isAr, stage, stepIndex, totalSteps }) => {
    const steps: Array<{ id: string; en: string; ar: string }> = [
        { id: 'upload',  en: 'Upload',         ar: 'رفع' },
        { id: 'mapping', en: 'Map Columns',    ar: 'ربط أعمدة' },
        { id: 'preview', en: `Preview ${stepIndex >= 0 ? `(${stepIndex + 1}/${totalSteps})` : ''}`, ar: `معاينة ${stepIndex >= 0 ? `(${stepIndex + 1}/${totalSteps})` : ''}` },
        { id: 'done',    en: 'Download',       ar: 'تحميل' },
    ];
    const idx = steps.findIndex(s => s.id === stage);
    return (
        <div className="flex items-center gap-2 mb-2 overflow-x-auto">
            {steps.map((s, i) => (
                <React.Fragment key={s.id}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg shrink-0 ${i === idx ? 'bg-fuchsia-500/15 border border-fuchsia-500/40' : i < idx ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-white/[0.03] border border-white/10'}`}>
                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${i === idx ? 'bg-fuchsia-500 text-white' : i < idx ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/40'}`}>
                            {i < idx ? '✓' : i + 1}
                        </span>
                        <span className={`text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${i === idx ? 'text-fuchsia-200' : i < idx ? 'text-emerald-300' : 'text-white/40'}`}>
                            {isAr ? s.ar : s.en}
                        </span>
                    </div>
                    {i < steps.length - 1 && <div className="flex-1 h-px bg-white/10 min-w-[8px]" />}
                </React.Fragment>
            ))}
        </div>
    );
};

const RunSlotRow: React.FC<{
    isAr: boolean;
    slot: string;
    originalFilename?: string;
    originalCols: number;
    file: File | null;
    onChange: (f: File | null) => void;
}> = ({ isAr, slot, originalFilename, originalCols, file, onChange }) => {
    const [drag, setDrag] = useState(false);
    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="sm:w-56 shrink-0">
                <div className="text-[10px] font-black text-fuchsia-300 uppercase tracking-widest">{slot}</div>
                <div className="text-xs text-white/60 truncate font-mono mt-0.5">{originalFilename || '—'}</div>
                <div className="text-[10px] text-white/30 mt-0.5">
                    {isAr ? 'عينة الإعداد:' : 'Setup sample:'} {originalCols} {isAr ? 'عمود' : 'cols'}
                </div>
            </div>
            <div
                className={`flex-1 border-2 border-dashed rounded-lg p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors ${drag ? 'border-fuchsia-400 bg-fuchsia-500/10' : 'border-white/15 hover:border-fuchsia-500/40 hover:bg-white/[0.05]'}`}
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onChange(f); }}
                onClick={() => document.getElementById(`run-slot-${slot}`)?.click()}
            >
                <input id={`run-slot-${slot}`} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
                {file ? (
                    <>
                        <FileSpreadsheet className="w-4 h-4 text-emerald-300 shrink-0" />
                        <span className="text-xs text-emerald-200 font-bold truncate">{file.name}</span>
                        <span className="text-[10px] text-white/30 shrink-0 ml-auto">{(file.size / 1024).toFixed(0)} KB</span>
                    </>
                ) : (
                    <>
                        <Upload className="w-4 h-4 text-white/40 shrink-0" />
                        <span className="text-xs text-white/50">{isAr ? `حمّل ملف "${slot}" اليومي` : `Drop today's "${slot}" file`}</span>
                    </>
                )}
            </div>
        </div>
    );
};

const DriftMapping: React.FC<{
    isAr: boolean;
    drift: Record<string, DriftReport>;
    columnRemap: Record<string, Record<string, string>>;
    setColumnRemap: (r: Record<string, Record<string, string>>) => void;
    onBack: () => void;
    onContinue: () => void;
    busy: boolean;
}> = ({ isAr, drift, columnRemap, setColumnRemap, onBack, onContinue, busy }) => {
    const updateMap = (slot: string, originalName: string, newName: string) => {
        // Remove any prior mapping that pointed at this original
        const existing = { ...(columnRemap[slot] || {}) };
        for (const k of Object.keys(existing)) {
            if (existing[k] === originalName) delete existing[k];
        }
        if (newName) existing[newName] = originalName;
        setColumnRemap({ ...columnRemap, [slot]: existing });
    };

    return (
        <div className="space-y-4">
            <div className="bg-amber-500/[0.05] border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-white/70 leading-relaxed">
                    <span className="font-black text-amber-300">{isAr ? 'تم تعديل بعض الأعمدة' : 'Some columns look different today.'}</span>{' '}
                    {isAr
                        ? 'اختر العمود المقابل من القائمة لكي يستمر سير العمل بدون أخطاء.'
                        : 'Pick the matching column from each dropdown so the workflow can continue.'}
                </div>
            </div>

            {Object.entries(drift).map(([slot, d]) => (
                d.missing_columns.length === 0 ? null : (
                    <div key={slot} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-[10px] font-black text-fuchsia-300 uppercase tracking-widest">{slot}</div>
                                <div className="text-xs text-white/60 font-mono">{d.filename}</div>
                            </div>
                            <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 font-black uppercase tracking-widest">
                                {d.missing_columns.length} {isAr ? 'مفقود' : 'missing'}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {d.missing_columns.map(m => {
                                // Find which "current" column is mapped to this original (if any)
                                const reverseMap = columnRemap[slot] || {};
                                const currentPick = Object.keys(reverseMap).find(k => reverseMap[k] === m.original) || '';
                                return (
                                    <div key={m.original} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                                        <div className="text-xs text-white/80 font-mono">
                                            <span className="text-white/40">{isAr ? 'متوقع:' : 'Expected:'}</span>{' '}
                                            <span className="font-bold">{m.original}</span>
                                        </div>
                                        <div className="sm:col-span-2 flex items-center gap-2">
                                            <ArrowRight className="w-3.5 h-3.5 text-white/30" />
                                            <select
                                                value={currentPick}
                                                onChange={e => updateMap(slot, m.original, e.target.value)}
                                                className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                                            >
                                                <option value="">— {isAr ? 'اختر العمود الحالي' : 'pick current column'} —</option>
                                                {d.current_columns.map(c => (
                                                    <option key={c} value={c}>
                                                        {c} {m.suggestions.includes(c) ? (isAr ? '(اقتراح)' : '(suggested)') : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            ))}

            <div className="flex justify-between gap-3">
                <button onClick={onBack} className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-black rounded-xl flex items-center gap-2">
                    <ChevronLeft className="w-3.5 h-3.5" /> {isAr ? 'رجوع' : 'Back'}
                </button>
                <button onClick={onContinue} disabled={busy} className="px-6 py-2.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:brightness-110 disabled:opacity-40 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-fuchsia-500/30">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    {isAr ? 'متابعة' : 'Continue'}
                </button>
            </div>
        </div>
    );
};

const RunPreview: React.FC<{
    isAr: boolean;
    stepResults: StepResult[];
    stepIndex: number;
    totalSteps: number;
    busy: boolean;
    onPrev: () => void;
    onNext: () => void;
    onFinalize: () => void;
}> = ({ isAr, stepResults, stepIndex, totalSteps, busy, onPrev, onNext, onFinalize }) => {
    const current = stepResults[stepIndex];
    if (!current) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin mb-3" />
                <p className="text-white/50 text-sm">{isAr ? 'يحسب الخطوة...' : 'Computing step...'}</p>
            </div>
        );
    }
    const isLast = stepIndex === totalSteps - 1;
    return (
        <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <div className="text-[10px] font-black text-fuchsia-300 uppercase tracking-widest">
                            {isAr ? `الخطوة ${stepIndex + 1} من ${totalSteps}` : `Step ${stepIndex + 1} of ${totalSteps}`}
                        </div>
                        <div className="text-sm font-black text-white mt-0.5">
                            {STEP_OP_LABEL[current.op]?.[isAr ? 'ar' : 'en'] || current.op} → <span className="font-mono text-fuchsia-300">{current.as}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-emerald-300">{current.row_count.toLocaleString()}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-widest">{isAr ? 'صف' : 'rows'}</div>
                    </div>
                </div>

                {current.op === 'join' && current.stats.total_rows > 0 && (
                    <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                            <div className="text-lg font-black text-emerald-300">{current.stats.matched_rows.toLocaleString()}</div>
                            <div className="text-[9px] text-white/40 uppercase tracking-widest">{isAr ? 'متطابق' : 'matched'}</div>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2">
                            <div className="text-lg font-black text-amber-300">{current.stats.unmatched_rows.toLocaleString()}</div>
                            <div className="text-[9px] text-white/40 uppercase tracking-widest">{isAr ? 'غير متطابق' : 'unmatched'}</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded p-2">
                            <div className="text-lg font-black text-white">
                                {current.stats.total_rows > 0 ? `${((current.stats.matched_rows / current.stats.total_rows) * 100).toFixed(1)}%` : '—'}
                            </div>
                            <div className="text-[9px] text-white/40 uppercase tracking-widest">{isAr ? 'معدل التطابق' : 'match rate'}</div>
                        </div>
                    </div>
                )}

                {current.stats.note && current.op !== 'join' && (
                    <div className="mb-3 text-[11px] text-white/60 italic">{current.stats.note}</div>
                )}

                <PreviewTable rows={current.preview_rows} columns={current.preview_columns} />
            </div>

            <div className="flex justify-between gap-3">
                <button
                    onClick={onPrev}
                    disabled={stepIndex === 0 || busy}
                    className="px-5 py-2.5 border border-white/10 hover:bg-white/5 disabled:opacity-30 text-white/70 text-xs font-black rounded-xl flex items-center gap-2"
                >
                    <ChevronLeft className="w-3.5 h-3.5" /> {isAr ? 'الخطوة السابقة' : 'Previous Step'}
                </button>
                {isLast ? (
                    <button onClick={onFinalize} disabled={busy} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 disabled:opacity-40 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/30">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {isAr ? 'إنهاء وتوليد الملف' : 'Finalize & Generate File'}
                    </button>
                ) : (
                    <button onClick={onNext} disabled={busy} className="px-6 py-2.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:brightness-110 disabled:opacity-40 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg shadow-fuchsia-500/30">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isAr ? 'تأكيد والتالي' : 'Confirm & Next'}
                    </button>
                )}
            </div>
        </div>
    );
};

const PreviewTable: React.FC<{ rows: any[]; columns: string[] }> = ({ rows, columns }) => {
    if (!rows || rows.length === 0) {
        return <div className="text-xs text-white/40 italic py-4">No rows.</div>;
    }
    const cols = columns.length ? columns : Object.keys(rows[0] || {});
    return (
        <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full text-xs">
                <thead className="bg-white/[0.04]">
                    <tr>
                        {cols.map(c => (
                            <th key={c} className="px-3 py-2 text-left font-black text-white/60 uppercase tracking-widest text-[10px] whitespace-nowrap">{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                            {cols.map(c => {
                                const v = row[c];
                                const display = v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
                                return (
                                    <td key={c} className={`px-3 py-1.5 whitespace-nowrap ${v === null || v === undefined ? 'text-white/30 italic' : 'text-white/80'}`}>
                                        {display.length > 60 ? display.slice(0, 60) + '…' : display}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const RunDone: React.FC<{
    isAr: boolean;
    final: { filename: string; row_count: number; columns: string[]; preview_rows: any[]; output_type?: OutputType; scalar_value?: number | string; agg_func?: string; agg_column?: string };
    onDownload: () => void;
    onRunAgain: () => void;
    onClose: () => void;
}> = ({ isAr, final, onDownload, onRunAgain, onClose }) => (
    <div className="space-y-4">
        {final.output_type === 'value' ? (
            <div className="bg-gradient-to-br from-cyan-500/[0.08] to-teal-500/[0.05] border border-cyan-500/30 rounded-2xl p-8 text-center">
                <div className="inline-block p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl mb-4">
                    <Hash className="w-7 h-7 text-white" />
                </div>
                <div className="text-[10px] font-black text-cyan-300/80 uppercase tracking-widest mb-2">
                    {(final.agg_func || 'value').toUpperCase()}{final.agg_column ? `(${final.agg_column})` : ''}
                </div>
                <div className="text-5xl sm:text-6xl font-black text-white mb-3 tracking-tight tabular-nums">
                    {typeof final.scalar_value === 'number' ? final.scalar_value.toLocaleString() : (final.scalar_value ?? '—')}
                </div>
                <p className="text-xs text-white/55 mb-5">
                    {isAr ? 'محسوب من' : 'computed from'} {final.row_count.toLocaleString()} {isAr ? 'صف' : 'rows'}
                </p>
                <button onClick={onDownload} className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:brightness-110 text-white text-xs font-black rounded-xl flex items-center gap-2 mx-auto">
                    <Download className="w-3.5 h-3.5" /> {isAr ? 'تنزيل كملف إكسل' : 'Download as xlsx'}
                </button>
            </div>
        ) : (
            <div className="bg-emerald-500/[0.05] border border-emerald-500/30 rounded-2xl p-6 text-center">
                <div className="inline-block p-4 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl mb-4">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-black text-white mb-1">
                    {isAr ? 'الملف جاهز للتحميل' : 'Your file is ready'}
                    {final.output_type === 'template' && <span className="ml-2 px-2 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded uppercase tracking-widest">{isAr ? 'قالب' : 'Template'}</span>}
                </h3>
                <p className="text-xs text-white/60 mb-4">
                    {final.row_count.toLocaleString()} {isAr ? 'صف' : 'rows'} · {final.columns.length} {isAr ? 'عمود' : 'columns'} · {final.filename}
                </p>
                <button onClick={onDownload} className="px-6 py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-teal-500 hover:brightness-110 text-white text-sm font-black rounded-xl flex items-center gap-2 mx-auto shadow-lg shadow-emerald-500/30">
                    <Download className="w-4 h-4" /> {isAr ? 'تحميل الملف' : 'Download xlsx'}
                </button>
            </div>
        )}

        {final.output_type !== 'value' && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
                <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">{isAr ? 'معاينة المخرج' : 'Output preview (top rows)'}</div>
                <PreviewTable rows={final.preview_rows} columns={final.columns} />
            </div>
        )}

        <div className="flex justify-between gap-3">
            <button onClick={onClose} className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-white/70 text-xs font-black rounded-xl">
                {isAr ? 'إغلاق' : 'Close'}
            </button>
            <button onClick={onRunAgain} className="px-6 py-2.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:brightness-110 text-white text-xs font-black rounded-xl flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> {isAr ? 'تشغيل مرة أخرى' : 'Run Again'}
            </button>
        </div>
    </div>
);

export default SmartWorkflows;
