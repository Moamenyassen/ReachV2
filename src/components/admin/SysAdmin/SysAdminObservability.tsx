/**
 * SysAdmin observability tabs — the missing-feature coverage:
 *   - API Usage (Gemini)
 *   - Scanner Usage
 *   - Upload Audit (reads existing route_versions)
 *   - Sessions (active Supabase Auth sessions)
 *   - System Log (errors + sysadmin audit)
 *   - Enforcement (limit breaches)
 *   - Security Center (sysadmin accounts, login attempts)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity, AlertTriangle, BarChart3, Ban, CheckCircle, CircleSlash, FileWarning,
    LogOut, RefreshCw, ScanSearch, Shield, ShieldCheck, Unlock, Upload, Users, Zap,
} from 'lucide-react';
import { sysadminApi } from '../../../services/sysadminApi';
import {
    BTN, EmptyState, INPUT_CLS, PageHeader, StatCard, StatusBadge, SysCard, TABLE_CLS,
} from './SysAdminShared';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const fmtMoney = (n?: number | null) =>
    n == null ? '—' : `$${Number(n).toFixed(4)}`;

const useDataLoader = <T,>(loader: () => Promise<T>, deps: any[] = []) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        setErr(null);
        try {
            setData(await loader());
        } catch (e: any) {
            setErr(e?.message || 'Failed to load');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { refresh(); }, deps);  // eslint-disable-line react-hooks/exhaustive-deps
    return { data, loading, err, refresh };
};

// ─────────────────────────────────────────────────────────────────────────────
// API USAGE — Gemini calls per tenant
// ─────────────────────────────────────────────────────────────────────────────
export const SysAdminApiUsage: React.FC = () => {
    const [days, setDays] = useState(30);
    const { data, loading, err, refresh } = useDataLoader(
        async () => {
            const r = await sysadminApi.geminiUsage(days);
            return (r.rows || []) as any[];
        },
        [days]
    );
    const rows = (data || []) as any[];

    const totals = useMemo(() => {
        let cost = 0, calls = rows.length, fails = 0, inTok = 0, outTok = 0;
        const bySurface: Record<string, number> = {};
        const byCompany: Record<string, { calls: number; cost: number; fails: number }> = {};
        for (const r of rows) {
            cost += Number(r.estimated_cost_usd || 0);
            inTok += r.input_tokens || 0;
            outTok += r.output_tokens || 0;
            if (r.status === 'failure') fails++;
            bySurface[r.surface] = (bySurface[r.surface] || 0) + 1;
            const cid = r.company_id || 'unknown';
            byCompany[cid] = byCompany[cid] || { calls: 0, cost: 0, fails: 0 };
            byCompany[cid].calls++;
            byCompany[cid].cost += Number(r.estimated_cost_usd || 0);
            if (r.status === 'failure') byCompany[cid].fails++;
        }
        return { cost, calls, fails, inTok, outTok, bySurface, byCompany };
    }, [rows]);

    const topCompanies = Object.entries(totals.byCompany)
        .sort((a, b) => b[1].cost - a[1].cost)
        .slice(0, 10);

    return (
        <div className="space-y-6">
            <PageHeader
                icon={<Zap className="w-5 h-5 text-indigo-400" />}
                title="API Usage — Gemini"
                subtitle={`${rows.length} calls in the last ${days} days`}
                actions={
                    <div className="flex items-center gap-2">
                        <select className={INPUT_CLS} value={days} onChange={e => setDays(Number(e.target.value))}>
                            <option value={1}>Last 24h</option>
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                        <button onClick={refresh} className={BTN.secondary}><RefreshCw className="w-4 h-4" /> Refresh</button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={BarChart3} label="Total Calls" value={String(totals.calls)} />
                <StatCard icon={AlertTriangle} label="Failures" value={String(totals.fails)}
                          iconColor={totals.fails > 0 ? 'text-red-400' : 'text-indigo-400'} />
                <StatCard icon={Activity} label="Input Tokens" value={totals.inTok.toLocaleString()} />
                <StatCard icon={Zap} label="Est. Cost (USD)" value={`$${totals.cost.toFixed(4)}`} iconColor="text-cyan-400" />
            </div>

            <SysCard title="Top tenants by spend" titleIcon={<Users className="w-4 h-4" />}>
                {topCompanies.length === 0 ? (
                    <EmptyState icon={<Activity />} title="No usage yet" description="Once Gemini calls fire, they'll show up here." />
                ) : (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                            <div>Company ID</div><div>Calls</div><div>Failures</div><div>Est. Cost</div>
                        </div>
                        {topCompanies.map(([cid, v]) => (
                            <div key={cid} className={TABLE_CLS.row} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                                <div className="text-xs font-mono text-slate-400 truncate">{cid}</div>
                                <div className="text-white font-bold">{v.calls}</div>
                                <div className={v.fails > 0 ? 'text-red-400 font-bold' : 'text-slate-500'}>{v.fails}</div>
                                <div className="text-indigo-300 font-bold">{fmtMoney(v.cost)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>

            <SysCard title="Recent calls" titleIcon={<Activity className="w-4 h-4" />}>
                {loading && <div className="text-slate-500 p-6 text-sm">Loading…</div>}
                {err && <div className="text-red-400 p-6 text-sm">{err}</div>}
                {!loading && !err && rows.length === 0 && (
                    <EmptyState icon={<Activity />} title="No calls recorded" description="Try expanding the window." />
                )}
                {rows.length > 0 && (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <div>Time</div><div>Surface</div><div>Status</div><div>Model</div><div>Duration</div><div>Cost</div>
                        </div>
                        {rows.slice(0, 200).map(r => (
                            <div key={r.id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr 1fr' }}>
                                <div className="text-xs text-slate-400">{fmtDate(r.created_at)}</div>
                                <div className="text-slate-300 text-sm">{r.surface}</div>
                                <div><StatusBadge status={r.status === 'success' ? 'success' : 'danger'} label={r.status} /></div>
                                <div className="text-xs font-mono text-slate-500">{r.model}</div>
                                <div className="text-xs text-slate-400">{r.duration_ms ? `${r.duration_ms} ms` : '—'}</div>
                                <div className="text-xs text-indigo-300">{fmtMoney(r.estimated_cost_usd)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCANNER USAGE
// ─────────────────────────────────────────────────────────────────────────────
export const SysAdminScannerUsage: React.FC = () => {
    const [days, setDays] = useState(30);
    const { data: rows, loading, err, refresh } = useDataLoader(
        async () => {
            const r = await sysadminApi.scanUsage(days);
            return (r.rows || []) as any[];
        },
        [days]
    );
    const r = rows || [];

    const totals = useMemo(() => {
        const byCompany: Record<string, { scans: number; found: number; saved: number }> = {};
        let totalFound = 0, totalSaved = 0;
        for (const x of r) {
            const cid = x.company_id || 'unknown';
            byCompany[cid] = byCompany[cid] || { scans: 0, found: 0, saved: 0 };
            byCompany[cid].scans++;
            byCompany[cid].found += x.leads_found || 0;
            byCompany[cid].saved += x.leads_saved || 0;
            totalFound += x.leads_found || 0;
            totalSaved += x.leads_saved || 0;
        }
        return { byCompany, totalFound, totalSaved };
    }, [r]);

    const topCompanies = Object.entries(totals.byCompany)
        .sort((a, b) => b[1].scans - a[1].scans)
        .slice(0, 10);

    return (
        <div className="space-y-6">
            <PageHeader
                icon={<ScanSearch className="w-5 h-5 text-emerald-400" />}
                title="Market Scanner Usage"
                subtitle={`${r.length} scans in the last ${days} days`}
                actions={
                    <div className="flex items-center gap-2">
                        <select className={INPUT_CLS} value={days} onChange={e => setDays(Number(e.target.value))}>
                            <option value={1}>Last 24h</option>
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                        <button onClick={refresh} className={BTN.secondary}><RefreshCw className="w-4 h-4" /> Refresh</button>
                    </div>
                }
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={ScanSearch} label="Total Scans" value={String(r.length)} />
                <StatCard icon={BarChart3} label="Leads Found" value={totals.totalFound.toLocaleString()} />
                <StatCard icon={CheckCircle} label="Leads Saved" value={totals.totalSaved.toLocaleString()} iconColor="text-emerald-400" />
            </div>

            <SysCard title="Top scanners by activity">
                {topCompanies.length === 0 ? (
                    <EmptyState icon={<ScanSearch />} title="No scans recorded" description="Scanner usage will populate here." />
                ) : (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                            <div>Company ID</div><div>Scans</div><div>Found</div><div>Saved</div>
                        </div>
                        {topCompanies.map(([cid, v]) => (
                            <div key={cid} className={TABLE_CLS.row} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                                <div className="text-xs font-mono text-slate-400 truncate">{cid}</div>
                                <div className="text-white font-bold">{v.scans}</div>
                                <div className="text-emerald-300">{v.found}</div>
                                <div className="text-emerald-400 font-bold">{v.saved}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>

            {loading && <div className="text-slate-500 p-6 text-sm">Loading…</div>}
            {err && <div className="text-red-400 p-6 text-sm">{err}</div>}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD AUDIT — cross-tenant route_versions
// ─────────────────────────────────────────────────────────────────────────────
export const SysAdminUploadAudit: React.FC = () => {
    const [days, setDays] = useState(30);
    const { data: rows, loading, err, refresh } = useDataLoader(
        async () => {
            const r = await sysadminApi.routeVersions();
            const cutoff = new Date(Date.now() - days * 86400000);
            return (r.rows || []).filter((x: any) => new Date(x.uploaded_at) >= cutoff) as any[];
        },
        [days]
    );
    const r = rows || [];

    return (
        <div className="space-y-6">
            <PageHeader
                icon={<Upload className="w-5 h-5 text-cyan-400" />}
                title="Upload Audit"
                subtitle={`${r.length} uploads across all tenants — last ${days} days`}
                actions={
                    <div className="flex items-center gap-2">
                        <select className={INPUT_CLS} value={days} onChange={e => setDays(Number(e.target.value))}>
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Last 12 months</option>
                        </select>
                        <button onClick={refresh} className={BTN.secondary}><RefreshCw className="w-4 h-4" /> Refresh</button>
                    </div>
                }
            />
            <SysCard>
                {loading && <div className="text-slate-500 p-6 text-sm">Loading…</div>}
                {err && <div className="text-red-400 p-6 text-sm">{err}</div>}
                {!loading && !err && r.length === 0 && (
                    <EmptyState icon={<Upload />} title="No uploads in this window" />
                )}
                {r.length > 0 && (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '1.3fr 2fr 2fr 1fr 1fr' }}>
                            <div>When</div><div>Company</div><div>Filename</div><div>Rows</div><div>Status</div>
                        </div>
                        {r.map(x => (
                            <div key={x.id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '1.3fr 2fr 2fr 1fr 1fr' }}>
                                <div className="text-xs text-slate-400">{fmtDate(x.uploaded_at)}</div>
                                <div className="text-xs font-mono text-slate-400 truncate">{x.company_id}</div>
                                <div className="text-sm text-white truncate">{x.filename || '—'}</div>
                                <div className="text-white font-bold">{x.row_count?.toLocaleString() || '—'}</div>
                                <div><StatusBadge status={x.status === 'active' ? 'success' : 'neutral'} label={x.status} /></div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS — active sessions with force-logout
// ─────────────────────────────────────────────────────────────────────────────
export const SysAdminSessions: React.FC = () => {
    const { data: rows, loading, err, refresh } = useDataLoader(
        () => sysadminApi.sessions().then(r => r.rows),
        []
    );
    const [busy, setBusy] = useState<string | null>(null);
    const [msg, setMsg] = useState<string | null>(null);

    const forceLogout = async (authUserId: string) => {
        setBusy(authUserId);
        setMsg(null);
        try {
            await sysadminApi.forceLogout(authUserId);
            setMsg('Session(s) revoked.');
            refresh();
        } catch (e: any) {
            setMsg(`Failed: ${e?.message || 'unknown'}`);
        } finally {
            setBusy(null);
        }
    };

    const toggleBlock = async (authUserId: string, email: string, isBlocked: boolean) => {
        const action = isBlocked ? 'unblock' : 'block';
        const confirmMsg = isBlocked
            ? `Allow ${email} to sign in again?`
            : `Block ${email} from signing in? They'll be logged out immediately and can't return until unblocked.`;
        if (!window.confirm(confirmMsg)) return;
        setBusy(authUserId);
        setMsg(null);
        try {
            const r = await sysadminApi.blockUser(authUserId, !isBlocked);
            setMsg(isBlocked
                ? `${email} unblocked.`
                : `${email} blocked. ${r.sessions_revoked} session${r.sessions_revoked === 1 ? '' : 's'} revoked.`);
            refresh();
        } catch (e: any) {
            setMsg(`${action} failed: ${e?.message || 'unknown'}`);
        } finally {
            setBusy(null);
        }
    };

    const r = rows || [];
    return (
        <div className="space-y-6">
            <PageHeader
                icon={<Users className="w-5 h-5 text-amber-400" />}
                title="Active Sessions"
                subtitle={`${r.length} signed-in users right now`}
                actions={<button onClick={refresh} className={BTN.secondary}><RefreshCw className="w-4 h-4" /> Refresh</button>}
            />
            {msg && <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-sm">{msg}</div>}
            <SysCard>
                {loading && <div className="text-slate-500 p-6 text-sm">Loading…</div>}
                {err && <div className="text-red-400 p-6 text-sm">{err}</div>}
                {!loading && !err && r.length === 0 && <EmptyState icon={<Users />} title="No active sessions" />}
                {r.length > 0 && (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '1.4fr 1.5fr 1fr 1.4fr 1fr 1fr' }}>
                            <div>Email</div><div>Name / Role</div><div>IP</div><div>Last Activity</div><div>Scope</div><div className="text-right">Actions</div>
                        </div>
                        {r.map((s: any) => (
                            <div key={s.session_id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '1.4fr 1.5fr 1fr 1.4fr 1fr 1fr' }}>
                                <div className="text-sm text-white truncate flex items-center gap-2">
                                    <span className="truncate">{s.email || '—'}</span>
                                    {s.session_count > 1 && (
                                        <span title={`${s.session_count} active sessions`}
                                              className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                                            {s.session_count}×
                                        </span>
                                    )}
                                    {s.is_blocked && (
                                        <span title="Blocked from signing in"
                                              className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 font-bold">
                                            <Ban className="w-3 h-3" /> Blocked
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-300 truncate">
                                    {s.user_name || '—'} <span className="text-slate-500 text-xs">· {s.role || '—'}</span>
                                </div>
                                <div className="text-xs text-slate-400 font-mono">{s.ip || '—'}</div>
                                <div className="text-xs text-slate-400">{fmtDate(s.last_activity)}</div>
                                <div className="text-xs">
                                    {s.is_sysadmin ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                            SysAdmin
                                        </span>
                                    ) : (
                                        <span className="font-mono text-slate-500 truncate">{s.company_id || '—'}</span>
                                    )}
                                </div>
                                <div className="flex justify-end gap-1.5">
                                    <button
                                        onClick={() => forceLogout(s.auth_user_id)}
                                        disabled={busy === s.auth_user_id}
                                        className={`${BTN.secondary} text-xs px-2 py-1`}
                                        title={s.session_count > 1 ? `Revoke all ${s.session_count} sessions` : 'Revoke session'}
                                    >
                                        <LogOut className="w-3 h-3" />
                                        {busy === s.auth_user_id ? '…' : 'Logout'}
                                    </button>
                                    <button
                                        onClick={() => toggleBlock(s.auth_user_id, s.email || '(no email)', !!s.is_blocked)}
                                        disabled={busy === s.auth_user_id}
                                        className={`${s.is_blocked ? BTN.secondary : BTN.danger} text-xs px-2 py-1`}
                                        title={s.is_blocked ? 'Unblock — allow sign-in again' : 'Block — kick out and prevent sign-in'}
                                    >
                                        {s.is_blocked ? <Unlock className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                        {busy === s.auth_user_id ? '…' : (s.is_blocked ? 'Unblock' : 'Block')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM LOG — errors + audit log
// ─────────────────────────────────────────────────────────────────────────────
export const SysAdminSystemLog: React.FC = () => {
    const [view, setView] = useState<'errors' | 'audit'>('errors');
    const [days, setDays] = useState(7);
    const [unresolvedOnly, setUnresolvedOnly] = useState(false);

    const errors = useDataLoader(
        () => sysadminApi.errorsLog(days, unresolvedOnly).then(r => r.rows),
        [days, unresolvedOnly]
    );
    const audit = useDataLoader(() => sysadminApi.auditLog(days).then(r => r.rows), [days]);

    const resolveError = async (id: string) => {
        await sysadminApi.resolveError(id);
        errors.refresh();
    };

    return (
        <div className="space-y-6">
            <PageHeader
                icon={<FileWarning className="w-5 h-5 text-red-400" />}
                title="System Log"
                subtitle="Errors and sysadmin actions"
                actions={
                    <div className="flex items-center gap-2">
                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                            <button onClick={() => setView('errors')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${view === 'errors' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                                Errors {errors.data ? `(${(errors.data as any[]).length})` : ''}
                            </button>
                            <button onClick={() => setView('audit')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${view === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
                                Audit {audit.data ? `(${(audit.data as any[]).length})` : ''}
                            </button>
                        </div>
                        <select className={INPUT_CLS} value={days} onChange={e => setDays(Number(e.target.value))}>
                            <option value={1}>1d</option><option value={7}>7d</option><option value={30}>30d</option><option value={90}>90d</option>
                        </select>
                        {view === 'errors' && (
                            <label className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                                <input type="checkbox" checked={unresolvedOnly} onChange={e => setUnresolvedOnly(e.target.checked)} />
                                Unresolved only
                            </label>
                        )}
                    </div>
                }
            />

            {view === 'errors' && (
                <SysCard>
                    {errors.loading && <div className="text-slate-500 p-6 text-sm">Loading…</div>}
                    {errors.err && <div className="text-red-400 p-6 text-sm">{errors.err}</div>}
                    {!errors.loading && !errors.err && (errors.data as any[])?.length === 0 && (
                        <EmptyState icon={<CheckCircle />} title="No errors in this window" description="Quiet skies — keep it that way." />
                    )}
                    {(errors.data as any[])?.length > 0 && (
                        <div className={TABLE_CLS.wrapper}>
                            <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '1.2fr 1fr 1fr 3fr 1fr' }}>
                                <div>When</div><div>Source</div><div>Severity</div><div>Message</div><div>Status</div>
                            </div>
                            {(errors.data as any[]).map((e: any) => (
                                <div key={e.id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '1.2fr 1fr 1fr 3fr 1fr' }}>
                                    <div className="text-xs text-slate-400">{fmtDate(e.created_at)}</div>
                                    <div className="text-xs font-mono text-slate-500">{e.source}</div>
                                    <div><StatusBadge status={e.severity === 'critical' ? 'danger' : e.severity === 'error' ? 'danger' : 'warning'} label={e.severity} /></div>
                                    <div className="text-xs text-slate-300 line-clamp-2">{e.message}</div>
                                    <div>
                                        {e.resolved
                                            ? <StatusBadge status="success" label="Resolved" />
                                            : <button onClick={() => resolveError(e.id)} className={`${BTN.secondary} text-xs`}>Resolve</button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SysCard>
            )}

            {view === 'audit' && (
                <SysCard>
                    {audit.loading && <div className="text-slate-500 p-6 text-sm">Loading…</div>}
                    {audit.err && <div className="text-red-400 p-6 text-sm">{audit.err}</div>}
                    {!audit.loading && !audit.err && (audit.data as any[])?.length === 0 && (
                        <EmptyState icon={<Shield />} title="No actions recorded" />
                    )}
                    {(audit.data as any[])?.length > 0 && (
                        <div className={TABLE_CLS.wrapper}>
                            <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '1.2fr 1.4fr 1.4fr 1.2fr 1fr 1fr' }}>
                                <div>When</div><div>Actor</div><div>Action</div><div>Target</div><div>IP</div><div>Status</div>
                            </div>
                            {(audit.data as any[]).map((a: any) => (
                                <div key={a.id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '1.2fr 1.4fr 1.4fr 1.2fr 1fr 1fr' }}>
                                    <div className="text-xs text-slate-400">{fmtDate(a.created_at)}</div>
                                    <div className="text-xs text-slate-300 truncate">{a.actor_email || a.actor_id}</div>
                                    <div className="text-xs font-mono text-indigo-300">{a.action}</div>
                                    <div className="text-xs text-slate-500 truncate">{a.target_type ? `${a.target_type}:${a.target_id}` : '—'}</div>
                                    <div className="text-xs text-slate-500 font-mono">{a.ip_address || '—'}</div>
                                    <div><StatusBadge status={a.status === 'success' ? 'success' : 'danger'} label={a.status} /></div>
                                </div>
                            ))}
                        </div>
                    )}
                </SysCard>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// ENFORCEMENT — who's over their plan limits
// ─────────────────────────────────────────────────────────────────────────────
export const SysAdminEnforcement: React.FC = () => {
    const { data: rows, loading, err, refresh } = useDataLoader(
        () => sysadminApi.enforcement().then(r => r.rows),
        []
    );
    const r = (rows || []) as any[];

    type Row = typeof r[number] & {
        users_over: boolean; routes_over: boolean; customers_over: boolean; scans_over: boolean;
    };
    const flagged: Row[] = r.map(x => ({
        ...x,
        users_over:     x.max_users      != null && x.current_users      > x.max_users,
        routes_over:    x.max_routes     != null && x.current_routes     > x.max_routes,
        customers_over: x.max_customers  != null && x.current_customers  > x.max_customers,
        scans_over:     x.market_scan_limit != null && x.scans_this_month > x.market_scan_limit,
    })).filter(x => x.users_over || x.routes_over || x.customers_over || x.scans_over);

    return (
        <div className="space-y-6">
            <PageHeader
                icon={<AlertTriangle className="w-5 h-5 text-orange-400" />}
                title="Subscription Enforcement"
                subtitle={`${flagged.length} of ${r.length} tenants are over their limits`}
                actions={<button onClick={refresh} className={BTN.secondary}><RefreshCw className="w-4 h-4" /> Refresh</button>}
            />
            <SysCard>
                {loading && <div className="text-slate-500 p-6 text-sm">Loading…</div>}
                {err && <div className="text-red-400 p-6 text-sm">{err}</div>}
                {!loading && !err && flagged.length === 0 && (
                    <EmptyState icon={<CheckCircle />} title="All tenants within limits" description="No breaches detected." />
                )}
                {flagged.length > 0 && (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                            <div>Company</div><div>Users</div><div>Routes</div><div>Customers</div><div>Scans/mo</div><div>Tier</div>
                        </div>
                        {flagged.map((x: any) => (
                            <div key={x.company_id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr' }}>
                                <div className="text-sm text-white truncate">{x.company_name}</div>
                                <div className={x.users_over ? 'text-red-400 font-bold' : 'text-slate-300'}>{x.current_users} / {x.max_users ?? '∞'}</div>
                                <div className={x.routes_over ? 'text-red-400 font-bold' : 'text-slate-300'}>{x.current_routes} / {x.max_routes ?? '∞'}</div>
                                <div className={x.customers_over ? 'text-red-400 font-bold' : 'text-slate-300'}>{x.current_customers} / {x.max_customers ?? '∞'}</div>
                                <div className={x.scans_over ? 'text-red-400 font-bold' : 'text-slate-300'}>{x.scans_this_month} / {x.market_scan_limit ?? '∞'}</div>
                                <div className="text-xs uppercase font-bold text-indigo-300">{x.subscription_tier}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY CENTER — sysadmin accounts + login attempts
// ─────────────────────────────────────────────────────────────────────────────
export const SysAdminSecurityCenter: React.FC = () => {
    const sysadmins = useDataLoader(
        async () => {
            const r = await sysadminApi.teamList();
            return (r.rows || []) as any[];
        },
        []
    );
    const attempts = useDataLoader(
        async () => {
            const r = await sysadminApi.attempts();
            return (r.rows || []) as any[];
        },
        []
    );

    const failed = ((attempts.data || []) as any[]).filter(a => !a.success);
    return (
        <div className="space-y-6">
            <PageHeader
                icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
                title="Security Center"
                subtitle="SysAdmin accounts, login attempts, and security posture"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={ShieldCheck} label="Active Sysadmins"
                          value={String(((sysadmins.data || []) as any[]).filter(s => s.is_active).length)}
                          iconColor="text-emerald-400" />
                <StatCard icon={AlertTriangle} label="Failed logins (7d)" value={String(failed.length)}
                          iconColor={failed.length > 5 ? 'text-red-400' : 'text-indigo-400'} />
                <StatCard icon={Activity} label="Total attempts (7d)"
                          value={String(((attempts.data || []) as any[]).length)} />
            </div>

            <SysCard title="SysAdmin accounts">
                {((sysadmins.data || []) as any[]).length === 0 ? (
                    <EmptyState
                        icon={<ShieldCheck />}
                        title="No sysadmins configured"
                        description="Run the seed INSERT in db/migration_sysadmin_security_v1.sql to create the first sysadmin."
                    />
                ) : (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1fr' }}>
                            <div>Name</div><div>Email</div><div>MFA</div><div>Last login</div><div>Status</div>
                        </div>
                        {((sysadmins.data || []) as any[]).map(s => (
                            <div key={s.id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '2fr 2fr 1fr 1.5fr 1fr' }}>
                                <div className="text-sm text-white">{s.display_name}</div>
                                <div className="text-sm text-slate-400">{s.email}</div>
                                <div>{s.mfa_required ? <StatusBadge status="success" label="Required" /> : <StatusBadge status="warning" label="Optional" />}</div>
                                <div className="text-xs text-slate-400">{fmtDate(s.last_login_at)}</div>
                                <div>{s.is_active ? <StatusBadge status="success" label="Active" /> : <StatusBadge status="neutral" label="Disabled" />}</div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>

            <SysCard title="Recent login attempts">
                {((attempts.data || []) as any[]).length === 0 ? (
                    <EmptyState icon={<Activity />} title="No attempts yet" />
                ) : (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '1.2fr 2fr 1.2fr 1fr' }}>
                            <div>When</div><div>Email</div><div>IP</div><div>Result</div>
                        </div>
                        {((attempts.data || []) as any[]).map(a => (
                            <div key={a.id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '1.2fr 2fr 1.2fr 1fr' }}>
                                <div className="text-xs text-slate-400">{fmtDate(a.created_at)}</div>
                                <div className="text-sm text-slate-300">{a.email || '—'}</div>
                                <div className="text-xs font-mono text-slate-500">{a.ip_address}</div>
                                <div><StatusBadge status={a.success ? 'success' : 'danger'} label={a.success ? 'Success' : 'Failed'} /></div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>
        </div>
    );
};
