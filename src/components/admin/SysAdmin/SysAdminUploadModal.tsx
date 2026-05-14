import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { X, Upload, FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle, Loader2, Database, Plus, Building2, Globe } from 'lucide-react';
import { insertGlobalLeadsSmart, generateCustomerHash, saveCompanyCustomersFromSysAdmin, getAllCompanies } from '../../../services/supabase';

interface SysAdminUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface ColumnMapping {
    csvHeader: string;
    dbField: string;
    isDynamic: boolean;
}

const DB_FIELDS = [
    { label: 'Business Name', value: 'name', required: true },
    { label: 'Name (Arabic)', value: 'name_ar', required: false },
    { label: 'Latitude', value: 'lat', required: true },
    { label: 'Longitude', value: 'lng', required: true },
    { label: 'Address', value: 'address', required: false },
    { label: 'Region/City', value: 'region_description', required: false },
    { label: 'Phone', value: 'phone', required: false },
    { label: 'Category', value: 'category', required: false },
];

const SysAdminUploadModal: React.FC<SysAdminUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
    // Pipeline Steps: UPLOAD -> MAPPING -> REVIEW -> UPLOADING -> DONE
    const [step, setStep] = useState<'UPLOAD' | 'MAPPING' | 'UPLOADING' | 'DONE'>('UPLOAD');

    // Data State
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping[]>([]);

    // Process State
    const [uploadStats, setUploadStats] = useState({ added: 0, skipped: 0, total: 0 });
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [useArabicEncoding, setUseArabicEncoding] = useState(false);

    // Company Selection for Route Data Upload
    const [uploadMode, setUploadMode] = useState<'global' | 'company'>('company'); // Default to company mode
    const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

    // Load companies on mount
    useEffect(() => {
        if (isOpen) {
            getAllCompanies().then(data => {
                if (data && data.length > 0) {
                    setCompanies(data);
                    setSelectedCompanyId(data[0].id); // Default to first company
                }
            }).catch(console.error);
        }
    }, [isOpen]);

    // 1. FILE DROP & PARSING LOGIC
    const processFile = useCallback((fileToParse: File) => {
        Papa.parse(fileToParse, {
            header: true,
            skipEmptyLines: true,
            encoding: useArabicEncoding ? 'Windows-1256' : 'UTF-8',
            complete: (results) => {
                if (results.data.length === 0) {
                    setError("File is empty or invalid CSV.");
                    return;
                }
                const headers = results.meta.fields || [];
                setCsvHeaders(headers);
                setParsedData(results.data);

                // Auto-Match Logic
                const newMapping: ColumnMapping[] = headers.map(header => {
                    // Keep Arabic characters (u0600-u06FF) and alphanumeric
                    const normalized = header.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');

                    // Simple fuzzy match
                    let match = DB_FIELDS.find(f => f.value === normalized || f.label.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized);

                    // Specific overrides
                    if (!match) {
                        if (normalized.includes('lat')) match = DB_FIELDS.find(f => f.value === 'lat');
                        if (normalized.includes('lng') || normalized.includes('long') || normalized.includes('lon')) match = DB_FIELDS.find(f => f.value === 'lng');
                        // Expanded Arabic Detection
                        if (normalized.includes('arabic') || normalized.includes('ar_') || normalized.includes('_ar')) match = DB_FIELDS.find(f => f.value === 'name_ar');

                        // Primary Name Detection (Arabic)
                        if (normalized.includes('اسم') || normalized.includes('متجر') || normalized.includes('عميل')) {
                            // If "name" isn't already taken or if it looks like a primary name
                            match = DB_FIELDS.find(f => f.value === 'name');
                        }

                        if (normalized.includes('city') || normalized.includes('branch') || normalized.includes('مدينة') || normalized.includes('فرع')) match = DB_FIELDS.find(f => f.value === 'region_description');
                        if (normalized === 'desc' || normalized === 'clientdescription' || normalized === 'وصف') match = DB_FIELDS.find(f => f.value === 'name');
                    }

                    return {
                        csvHeader: header,
                        dbField: match ? match.value : 'DYNAMIC_NEW', // Default to new field if unknown
                        isDynamic: !match
                    };
                });

                setMapping(newMapping);
                setStep('MAPPING');
                setError(null);
            },
            error: (err) => {
                setError(`Parse Error: ${err.message}`);
            }
        });
    }, [useArabicEncoding]);

    // Re-process file when encoding changes
    React.useEffect(() => {
        if (file) {
            processFile(file);
        }
    }, [useArabicEncoding, file, processFile]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const f = acceptedFiles[0];
        if (!f) return;
        setFile(f);
        processFile(f);
    }, [processFile]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/csv': ['.csv'] },
        maxFiles: 1
    });

    // 2. MAPPING LOGIC
    const handleMappingChange = (csvHeader: string, newDbField: string) => {
        setMapping(prev => prev.map(m => {
            if (m.csvHeader !== csvHeader) return m;

            if (newDbField === 'DYNAMIC_NEW') {
                return { ...m, dbField: 'DYNAMIC_NEW', isDynamic: true };
            } else if (newDbField === 'SKIP') {
                return { ...m, dbField: 'SKIP', isDynamic: false };
            } else {
                return { ...m, dbField: newDbField, isDynamic: false };
            }
        }));
    };

    // 3. EXECUTE UPLOAD
    const handleUpload = async () => {
        setStep('UPLOADING');
        try {
            // Transform Data based on mapping
            const transformedRows = parsedData.map(row => {
                const dbRow: any = {};

                mapping.forEach(m => {
                    const value = row[m.csvHeader];
                    if (!value || m.dbField === 'SKIP') return;

                    if (m.isDynamic || m.dbField === 'DYNAMIC_NEW') {
                        // Store in dynamic_data for global mode
                        if (!dbRow.dynamic_data) dbRow.dynamic_data = {};
                        dbRow.dynamic_data[m.csvHeader] = value;
                    } else {
                        // Store in strict column
                        if (m.dbField === 'lat' || m.dbField === 'lng') {
                            dbRow[m.dbField] = parseFloat(value) || 0;
                        } else {
                            dbRow[m.dbField] = value;
                        }
                    }
                });

                return dbRow;
            }).filter(r => r.name && r.lat !== 0 && r.lng !== 0); // Basic validation

            if (transformedRows.length === 0) throw new Error("No valid rows found (Name + Coordinates required)");

            let result: { added: number; skipped: number };

            if (uploadMode === 'company' && selectedCompanyId) {
                // COMPANY MODE: Upload to customers table with proper version_id
                const companyResult = await saveCompanyCustomersFromSysAdmin(
                    selectedCompanyId,
                    transformedRows,
                    (percent) => setProgress(percent)
                );
                result = { added: companyResult.added, skipped: companyResult.skipped };
            } else {
                // GLOBAL MODE: Upload to reach_global_leads table
                const globalRows = transformedRows.map(r => ({
                    ...r,
                    source_company_id: 'CVS_UPLOAD',
                    status: 'NEW',
                    original_customer_hash: generateCustomerHash(r.name, r.lat, r.lng)
                }));
                result = await insertGlobalLeadsSmart(globalRows, (percent) => setProgress(percent));
            }

            setUploadStats({
                added: result.added,
                skipped: result.skipped,
                total: transformedRows.length
            });
            setStep('DONE');
            onSuccess(); // Trigger parent refresh in background
        } catch (err: any) {
            setError(err.message || "Upload Failed");
            setStep('MAPPING');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                {/* HEAD */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1e293b]">
                    <h3 className="text-xl font-black text-white flex items-center gap-3">
                        <Upload className="w-6 h-6 text-pink-500" />
                        SysAdmin Import Wizard
                    </h3>
                    <button onClick={onClose} aria-label="Close modal" className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>

                {/* BODY */}
                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-bold">{error}</p>
                        </div>
                    )}

                    {step === 'UPLOAD' && (
                        <div className="space-y-4">
                            {/* Upload Mode & Company Selector */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Upload Destination</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setUploadMode('company')}
                                        className={`p-3 rounded-xl border text-left transition-all ${uploadMode === 'company'
                                            ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/50'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                        type="button"
                                        aria-label="Upload to company route data"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Building2 className={`w-4 h-4 ${uploadMode === 'company' ? 'text-emerald-400' : 'text-slate-400'}`} />
                                            <span className={`text-sm font-bold ${uploadMode === 'company' ? 'text-emerald-300' : 'text-white'}`}>Company Route Data</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500">Shows in Customers, Insights & Route screens</p>
                                    </button>
                                    <button
                                        onClick={() => setUploadMode('global')}
                                        className={`p-3 rounded-xl border text-left transition-all ${uploadMode === 'global'
                                            ? 'bg-pink-500/10 border-pink-500/30 ring-1 ring-pink-500/50'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                                        type="button"
                                        aria-label="Upload to global leads registry"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Globe className={`w-4 h-4 ${uploadMode === 'global' ? 'text-pink-400' : 'text-slate-400'}`} />
                                            <span className={`text-sm font-bold ${uploadMode === 'global' ? 'text-pink-300' : 'text-white'}`}>Global Leads Registry</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500">Master data grid (cross-company)</p>
                                    </button>
                                </div>

                                {/* Company Selector - Only show in company mode */}
                                {uploadMode === 'company' && (
                                    <div className="mt-3">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 block">Target Company</label>
                                        <select
                                            value={selectedCompanyId}
                                            onChange={(e) => setSelectedCompanyId(e.target.value)}
                                            className="w-full bg-black/30 border border-emerald-500/20 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-500"
                                            aria-label="Select target company"
                                        >
                                            {companies.map(c => (
                                                <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.name}</option>
                                            ))}
                                        </select>
                                        {companies.length === 0 && (
                                            <p className="text-[10px] text-amber-400 mt-1">No companies found. Create a company first.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* File Drop Zone */}
                            <div {...getRootProps()} className={`border-2 border-dashed rounded-3xl h-52 flex flex-col items-center justify-center cursor-pointer transition-all ${isDragActive ? 'border-pink-500 bg-pink-500/5' : 'border-white/10 hover:border-pink-500/50 hover:bg-white/5'}`}>
                                <input {...getInputProps()} />

                                <div className="flex flex-col items-center justify-center space-y-3">
                                    <div className="p-3 bg-pink-500/10 rounded-full">
                                        <FileSpreadsheet className="w-10 h-10 text-pink-500" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-white">Drop CSV file here</p>
                                        <p className="text-sm text-slate-500">or click to browse</p>
                                    </div>

                                    {/* Encoding Toggle */}
                                    <div className="mt-2 flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5" onClick={(e) => e.stopPropagation()}>
                                        <span className={`text-xs font-bold uppercase transition-colors ${!useArabicEncoding ? 'text-white' : 'text-slate-500'}`}>Standard (UTF-8)</span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setUseArabicEncoding(!useArabicEncoding);
                                            }}
                                            className={`relative w-10 h-5 rounded-full transition-colors ${useArabicEncoding ? 'bg-pink-600' : 'bg-slate-700'}`}
                                            aria-label="Toggle Arabic encoding"
                                        >
                                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${useArabicEncoding ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                        <span className={`text-xs font-bold uppercase transition-colors ${useArabicEncoding ? 'text-pink-400' : 'text-slate-500'}`}>Arabic (Excel/1256)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'MAPPING' && (
                        <div className="space-y-6 h-full flex flex-col">
                            <div className="flex items-center justify-between shrink-0">
                                <div>
                                    <h4 className="font-black text-white text-lg flex items-center gap-2">
                                        <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                                        Column Analysis & Schema Check
                                    </h4>
                                    <p className="text-xs text-slate-500">We compared your file columns against the database schema.</p>
                                </div>
                            </div>

                            {/* Required Fields Check - COMPACT */}
                            <div className="flex flex-wrap gap-2 p-3 bg-black/20 rounded-xl border border-white/5 shrink-0">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest py-1.5">Required:</span>
                                {DB_FIELDS.filter(f => f.required).map(f => {
                                    const isMapped = mapping.some(m => m.dbField === f.value);
                                    return (
                                        <div key={f.value} className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 transition-colors ${isMapped ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse'}`}>
                                            {isMapped ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                            {f.label}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* SPLIT VIEW */}
                            <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                                {/* LEFT: MATCHED COLUMNS */}
                                <div className="flex flex-col bg-emerald-500/5 rounded-2xl border border-emerald-500/10 overflow-hidden">
                                    <div className="p-4 border-b border-emerald-500/10 bg-emerald-500/5 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Database className="w-4 h-4 text-emerald-400" />
                                            <h5 className="font-bold text-emerald-100 text-sm">Matched System Columns</h5>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-xs font-black">
                                            {mapping.filter(m => !m.isDynamic && m.dbField !== 'SKIP').length}
                                        </span>
                                    </div>
                                    <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 flex-1">
                                        {mapping.filter(m => !m.isDynamic && m.dbField !== 'SKIP').map((m, idx) => (
                                            <div key={idx} className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex flex-col gap-2">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-0.5">File Header</div>
                                                        <div className="font-bold text-white text-sm break-all">{m.csvHeader}</div>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-emerald-500/50 mt-1" />
                                                </div>
                                                <div className="bg-black/20 rounded-lg p-2 flex items-center justify-between border border-emerald-500/10">
                                                    <span className="text-xs text-emerald-400 font-mono font-bold">{DB_FIELDS.find(f => f.value === m.dbField)?.label}</span>
                                                    <Database className="w-3 h-3 text-emerald-500" />
                                                </div>
                                            </div>
                                        ))}
                                        {mapping.filter(m => !m.isDynamic && m.dbField !== 'SKIP').length === 0 && (
                                            <div className="text-center py-8 text-slate-500 text-xs">No standard columns matched.</div>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT: NEW / DYNAMIC COLUMNS */}
                                <div className="flex flex-col bg-pink-500/5 rounded-2xl border border-pink-500/10 overflow-hidden">
                                    <div className="p-4 border-b border-pink-500/10 bg-pink-500/5 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Plus className="w-4 h-4 text-pink-400" />
                                            <h5 className="font-bold text-pink-100 text-sm">New Columns (Dynamic)</h5>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-400 text-xs font-black">
                                            {mapping.filter(m => m.isDynamic).length}
                                        </span>
                                    </div>

                                    <div className="p-3 bg-pink-500/5 border-b border-pink-500/10 text-[10px] text-pink-200/70 leading-relaxed">
                                        These columns do not exist in the standard schema. We will create new fields for them automatically to ensure no data is lost.
                                    </div>

                                    <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 flex-1">
                                        {mapping.filter(m => m.isDynamic).map((m, idx) => (
                                            <div key={idx} className="bg-pink-500/5 border border-pink-500/10 rounded-xl p-3 relative group">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="font-bold text-white text-sm break-all">{m.csvHeader}</div>
                                                    <span className="text-[10px] font-bold bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full uppercase tracking-wider">New Field</span>
                                                </div>

                                                {/* Sample Data */}
                                                <div className="text-[10px] text-slate-500 font-mono mb-3 bg-black/20 p-1.5 rounded truncate">
                                                    Sample: {parsedData[0]?.[m.csvHeader]?.toString().substring(0, 30)}...
                                                </div>

                                                {/* Action */}
                                                <select
                                                    value="DYNAMIC_NEW"
                                                    onChange={(e) => handleMappingChange(m.csvHeader, e.target.value)}
                                                    className="w-full bg-black/40 border border-pink-500/20 rounded-lg px-2 py-1.5 text-xs font-bold text-pink-400 outline-none focus:border-pink-500"
                                                    aria-label={`Column mapping for ${m.csvHeader}`}
                                                >
                                                    <option value="DYNAMIC_NEW">✨ Create New Column</option>
                                                    <option value="SKIP">🚫 Skip / Ignore</option>
                                                    <optgroup label="Map to Existing System Field">
                                                        {DB_FIELDS.map(f => (
                                                            <option key={f.value} value={f.value}>Map to: {f.label}</option>
                                                        ))}
                                                    </optgroup>
                                                </select>
                                            </div>
                                        ))}
                                        {mapping.filter(m => m.isDynamic).length === 0 && (
                                            <div className="text-center py-8 text-slate-500 text-xs">No new columns detected.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'UPLOADING' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-6">
                            <div className="relative w-20 h-20 flex items-center justify-center">
                                <svg className="w-full h-full -rotate-90">
                                    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/10" />
                                    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={226.2} strokeDashoffset={226.2 - (226.2 * progress) / 100} className="text-pink-500 transition-all duration-300 ease-out" />
                                </svg>
                                <span className="absolute text-xl font-black text-white">{progress}%</span>
                            </div>
                            <div className="text-center">
                                <h4 className="text-xl font-black text-white mb-2">Importing Data...</h4>
                                <p className="text-slate-500 font-bold">Standardizing, hashing, and verifying duplicates.</p>
                            </div>
                        </div>
                    )}

                    {step === 'DONE' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-6">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center ring-4 ring-emerald-500/10">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <div className="text-center space-y-2">
                                <h4 className="text-2xl font-black text-white">Import Complete!</h4>
                                <div className="flex gap-4 justify-center mt-4">
                                    <div className="px-5 py-3 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-black text-emerald-400">{uploadStats.added}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Added</div>
                                    </div>
                                    <div className="px-5 py-3 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-2xl font-black text-slate-400">{uploadStats.skipped}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Duplicates</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-white/10 bg-[#1e293b] flex justify-between">
                    {step === 'MAPPING' && (
                        <>
                            <button onClick={() => { setStep('UPLOAD'); setFile(null); }} className="px-6 py-3 font-bold text-slate-400 hover:text-white transition-colors">Back</button>
                            <button onClick={handleUpload} className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-black shadow-lg shadow-pink-500/20 transition-all active:scale-95 flex items-center gap-2">
                                <Database className="w-4 h-4" /> Start Import
                            </button>
                        </>
                    )}
                    {step === 'DONE' && (
                        <button onClick={onClose} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20 transition-all">
                            Close & Refresh Ledger
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default SysAdminUploadModal;
