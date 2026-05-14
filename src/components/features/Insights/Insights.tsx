
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Route, MapPin, Milestone, Timer, BarChart3,
  Users, Repeat, Zap, AlertOctagon, Target, User, X, Search, ArrowUpDown
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

import { User as UserType, Company, Customer, NormalizedBranch } from '../../../types';
import { RouteHealthStats } from '../../../services/mockAnalytics';
import { getDashboardInsights, getBranches, fetchRouteHealthFromUploads, fetchBranchStatsFromUploads, fetchMissingGpsRows, fetchProximityIssueRows, DataAlertRow } from '../../../services/supabase';
import RedFlagCard from '../../common/RedFlagCard';
import ReachCommandMap from './ReachCommandMap';

// --- Components ---

// --- Portal Tooltip ---
const PortalTooltip = ({ content, triggerRect }: { content: string, triggerRect: DOMRect }) => {
  if (!content || !triggerRect) return null;

  // Position: Centered above the element
  const top = triggerRect.top - 10; // 10px spacing
  const left = triggerRect.left + (triggerRect.width / 2);

  return createPortal(
    <div
      className="fixed z-[9999] px-3 py-2 bg-panel text-main text-[10px] font-medium uppercase tracking-wider rounded-lg shadow-2xl backdrop-blur-md border border-main max-w-[260px] pointer-events-none transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-200"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-panel" />
    </div>,
    document.body
  );
};

const UniformKpiCard = ({ label, value, icon: Icon, color, delay, unit, tooltip }: any) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500/25 to-indigo-500/5 text-indigo-400',
    violet: 'from-violet-500/25 to-violet-500/5 text-violet-400',
    cyan: 'from-cyan-500/25 to-cyan-500/5 text-cyan-400',
    emerald: 'from-emerald-500/25 to-emerald-500/5 text-emerald-400',
    rose: 'from-rose-500/25 to-rose-500/5 text-rose-400',
    amber: 'from-amber-500/25 to-amber-500/5 text-amber-400',
    blue: 'from-blue-500/25 to-blue-500/5 text-blue-400',
    fuchsia: 'from-fuchsia-500/25 to-fuchsia-500/5 text-fuchsia-400',
    sky: 'from-sky-500/25 to-sky-500/5 text-sky-400',
  };
  const glowMap: Record<string, string> = {
    indigo: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(99,102,241,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    violet: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(139,92,246,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    cyan: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(6,182,212,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    emerald: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    rose: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(244,63,94,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    amber: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    blue: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(59,130,246,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    fuchsia: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(217,70,239,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
    sky: 'shadow-[0_12px_28px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3),0_0_18px_rgba(14,165,233,0.18),inset_0_1px_0_rgba(255,255,255,0.07)]',
  };

  const style = colorMap[color] || colorMap.indigo;
  const glow = glowMap[color] || glowMap.indigo;

  return (
    <>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, delay }}
        onMouseEnter={() => {
          if (cardRef.current) setRect(cardRef.current.getBoundingClientRect());
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative flex flex-col justify-center p-3 rounded-xl bg-gradient-to-br backdrop-blur-md
          h-22 w-full min-w-[100px]
          hover:-translate-y-1 transition-transform duration-200 cursor-default group
          ${style} ${glow}
        `}
      >
        <div className="flex items-center justify-between mb-2">
          <div className={`p-1.5 rounded-lg bg-white/5`}>
            <Icon className="w-3.5 h-3.5 opacity-80" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-60 ml-2 text-right leading-none">{label}</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-main tracking-tight">{value}</span>
          {unit && <span className="text-[10px] font-medium opacity-50 text-muted">{unit}</span>}
        </div>
      </motion.div>
      {isHovered && tooltip && rect && <PortalTooltip content={tooltip} triggerRect={rect} />}
    </>
  );
};

const HealthStatRow = ({ label, value, color, tooltip, onClick }: { label: string, value: number, color: 'emerald' | 'fuchsia' | 'amber', tooltip: string, onClick?: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const colors = {
    emerald: { bg: 'bg-emerald-500/10', glow: 'shadow-[0_8px_22px_rgba(0,0,0,0.4),0_0_14px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]', dot: 'bg-emerald-500', text: 'text-emerald-400', hover: 'hover:bg-emerald-500/20' },
    fuchsia: { bg: 'bg-fuchsia-500/10', glow: 'shadow-[0_8px_22px_rgba(0,0,0,0.4),0_0_14px_rgba(217,70,239,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]', dot: 'bg-fuchsia-500', text: 'text-fuchsia-400', hover: 'hover:bg-fuchsia-500/20' },
    amber: { bg: 'bg-amber-500/10', glow: 'shadow-[0_8px_22px_rgba(0,0,0,0.4),0_0_14px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]', dot: 'bg-amber-500', text: 'text-amber-400', hover: 'hover:bg-amber-500/20' },
  };
  const theme = colors[color];

  return (
    <>
      <div
        ref={rowRef}
        onClick={onClick}
        onMouseEnter={() => {
          if (rowRef.current) setRect(rowRef.current.getBoundingClientRect());
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        className={`flex items-center justify-between p-3 rounded-lg ${theme.bg} ${theme.glow} ${onClick ? `cursor-pointer transition-all hover:-translate-y-0.5 ${theme.hover}` : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${theme.dot} ${color === 'emerald' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold ${theme.text}`}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-main">{value}</span>
          {onClick && <span className="text-[8px] font-bold uppercase tracking-wider opacity-50">View</span>}
        </div>
      </div>
      {isHovered && rect && <PortalTooltip content={tooltip} triggerRect={rect} />}
    </>
  );
};

const HealthMonitor = ({ data, settings, onOpenList }: { data: RouteHealthStats, settings: any, onOpenList: (status: 'all' | 'stable' | 'under' | 'over') => void }) => {
  return (
    <div className="flex flex-col gap-4">
      <div
        className="h-40 w-full relative cursor-pointer group"
        onClick={() => onOpenList('all')}
        title="Click to view all routes"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Under', value: data.under, color: '#f43f5e' },
                { name: 'Stable', value: data.stable, color: '#10b981' },
                { name: 'Over', value: data.over, color: '#f59e0b' }
              ]}
              innerRadius={60}
              outerRadius={75}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={450}
            >
              <Cell key="cell-0" fill="#f43f5e" className="stroke-main stroke-4" />
              <Cell key="cell-1" fill="#10b981" className="stroke-main stroke-4" />
              <Cell key="cell-2" fill="#f59e0b" className="stroke-main stroke-4" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <Activity className="w-6 h-6 text-slate-600 mb-1 group-hover:text-emerald-400 transition-colors" />
          <span className="text-4xl font-black text-main">{data.stable + data.under + data.over}</span>
          <span className="text-[9px] uppercase tracking-widest text-muted font-bold">Monitored</span>
          <span className="mt-1 text-[8px] uppercase tracking-widest text-emerald-400/0 group-hover:text-emerald-400 font-bold transition-colors">Click to view list</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <HealthStatRow
          label="Stable"
          value={data.stable}
          color="emerald"
          tooltip={`Routes with ${settings?.minClientsPerRoute || 80} to ${settings?.maxClientsPerRoute || 120} customers — click to view`}
          onClick={() => onOpenList('stable')}
        />
        <HealthStatRow
          label="Under Utilized"
          value={data.under}
          color="fuchsia"
          tooltip={`Routes with less than ${settings?.minClientsPerRoute || 80} customers — click to view`}
          onClick={() => onOpenList('under')}
        />
        <HealthStatRow
          label="Overloaded"
          value={data.over}
          color="amber"
          tooltip={`Routes with more than ${settings?.maxClientsPerRoute || 120} customers — click to view`}
          onClick={() => onOpenList('over')}
        />
      </div>
    </div>
  )
}

// --- Route Health Details Modal ---
type HealthFilter = 'all' | 'stable' | 'under' | 'over';

const RouteHealthDetailsModal = ({
  isOpen,
  onClose,
  initialFilter,
  companyId,
  branchIds,
  thresholds,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialFilter: HealthFilter;
  companyId: string;
  branchIds?: string[];
  thresholds?: { min?: number; max?: number };
}) => {
  const [filter, setFilter] = useState<HealthFilter>(initialFilter);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'routeName' | 'distinctCustomers' | 'efficiency'>('distinctCustomers');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  React.useEffect(() => { if (isOpen) setFilter(initialFilter); }, [isOpen, initialFilter]);

  const branchKey = (branchIds || []).join(',');
  const { data: routeHealth, isLoading } = useQuery({
    queryKey: ['routeHealthDetailsUploads', companyId, branchKey, thresholds?.min, thresholds?.max],
    queryFn: () => fetchRouteHealthFromUploads(companyId, branchIds, thresholds),
    enabled: isOpen && !!companyId,
    staleTime: 1000 * 60 * 2,
  });

  const allRows = (routeHealth?.details || []) as Array<{
    routeName: string; branchName: string; distinctCustomers: number;
    region: string; status: string; efficiency: string;
  }>;

  // status normalization: backend uses 'healthy' for stable
  const normalizeStatus = (s: string) => (s === 'healthy' ? 'stable' : s);

  const filteredRows = React.useMemo(() => {
    let rows = allRows.map(r => ({ ...r, status: normalizeStatus(r.status) }));
    if (filter !== 'all') rows = rows.filter(r => r.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        (r.routeName || '').toLowerCase().includes(q) ||
        (r.branchName || '').toLowerCase().includes(q) ||
        (r.region || '').toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let av: any = a[sortKey], bv: any = b[sortKey];
      if (sortKey === 'efficiency') { av = parseInt((a.efficiency || '0').toString(), 10); bv = parseInt((b.efficiency || '0').toString(), 10); }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [allRows, filter, search, sortKey, sortDir]);

  const counts = React.useMemo(() => {
    const rows = allRows.map(r => normalizeStatus(r.status));
    return {
      all: rows.length,
      stable: rows.filter(s => s === 'stable').length,
      under: rows.filter(s => s === 'under').length,
      over: rows.filter(s => s === 'over').length,
    };
  }, [allRows]);

  if (!isOpen) return null;

  const statusBadge = (s: string) => {
    const status = normalizeStatus(s);
    const styles: Record<string, string> = {
      stable: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      under: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
      over: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    };
    return <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${styles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'}`}>{status}</span>;
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="rh-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="rh-panel"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-5xl max-h-[85vh] bg-panel rounded-2xl flex flex-col overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.65),0_10px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.04] bg-gradient-to-r from-indigo-500/10 to-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-main">Route Health Details</h2>
                <p className="text-[10px] text-muted mt-0.5">{counts.all} routes monitored · click any column to sort</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Close">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-panel/50">
            {(['all', 'stable', 'under', 'over'] as HealthFilter[]).map(f => {
              const active = filter === f;
              const styles: Record<HealthFilter, string> = {
                all: active ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-400 border-white/10',
                stable: active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-white/5 text-slate-400 border-white/10',
                under: active ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' : 'bg-white/5 text-slate-400 border-white/10',
                over: active ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-white/5 text-slate-400 border-white/10',
              };
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${styles[f]} hover:scale-105`}
                >
                  {f === 'all' ? 'All' : f === 'stable' ? 'Stable' : f === 'under' ? 'Under Utilized' : 'Overloaded'} · {counts[f]}
                </button>
              );
            })}
            <div className="flex-1" />
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search route, branch, region…"
                className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-main placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 w-56"
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-xs text-slate-400">
                <div className="w-5 h-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mr-2" />
                Loading route health…
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-xs text-slate-500 gap-2">
                <Route className="w-6 h-6 opacity-40" />
                <span>No routes match this filter.</span>
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-panel/95 backdrop-blur z-10 border-b border-white/[0.04]">
                  <tr className="text-left text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="px-4 py-2.5 cursor-pointer hover:text-indigo-400" onClick={() => toggleSort('routeName')}>
                      <div className="flex items-center gap-1">Route <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="px-4 py-2.5">Branch</th>
                    <th className="px-4 py-2.5">Region</th>
                    <th className="px-4 py-2.5 cursor-pointer hover:text-indigo-400 text-right" onClick={() => toggleSort('distinctCustomers')}>
                      <div className="flex items-center justify-end gap-1">Customers <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="px-4 py-2.5 cursor-pointer hover:text-indigo-400 text-right" onClick={() => toggleSort('efficiency')}>
                      <div className="flex items-center justify-end gap-1">Efficiency <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={`${r.routeName}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-main">{r.routeName}</td>
                      <td className="px-4 py-2.5 text-slate-300">{r.branchName}</td>
                      <td className="px-4 py-2.5 text-slate-400">{r.region}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-main">{r.distinctCustomers.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-300">{r.efficiency}</td>
                      <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-2.5 border-t border-white/[0.04] bg-panel/40 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Showing {filteredRows.length} of {counts.all}</span>
            <span className="opacity-60">ESC or click outside to close</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};





// --- Data Alerts Details Modal ---
type AlertType = 'gps' | 'proximity';

const DataAlertsDetailsModal = ({
  isOpen, onClose, type, companyId, branchIds, radiusMeters,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: AlertType;
  companyId: string;
  branchIds?: string[];
  radiusMeters?: number;
}) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'customerName' | 'branchName' | 'routeName' | 'distanceMeters'>('customerName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  React.useEffect(() => { setSearch(''); }, [type, isOpen]);

  const branchKey = (branchIds || []).join(',');
  const { data: rows = [], isLoading } = useQuery<DataAlertRow[]>({
    queryKey: ['dataAlertDetails', type, companyId, branchKey, radiusMeters],
    queryFn: () => type === 'gps'
      ? fetchMissingGpsRows(companyId, branchIds)
      : fetchProximityIssueRows(companyId, radiusMeters ?? 100, branchIds),
    enabled: isOpen && !!companyId,
    staleTime: 1000 * 60 * 2,
  });

  const filtered = React.useMemo(() => {
    let out = [...rows];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r =>
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.clientCode || '').toLowerCase().includes(q) ||
        (r.branchName || '').toLowerCase().includes(q) ||
        (r.routeName || '').toLowerCase().includes(q) ||
        (r.district || '').toLowerCase().includes(q)
      );
    }
    out.sort((a: any, b: any) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return out;
  }, [rows, search, sortKey, sortDir]);

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  if (!isOpen) return null;

  const isGps = type === 'gps';
  const accent = isGps ? 'rose' : 'amber';
  const Icon = isGps ? AlertOctagon : Target;
  const title = isGps ? 'Missing GPS' : 'Proximity Issues';
  const subtitle = isGps
    ? `${filtered.length} of ${rows.length} customers with no GPS coordinates`
    : `${filtered.length} of ${rows.length} customers within ${radiusMeters ?? 100}m of their branch`;

  const accentMap: Record<string, { bgGrad: string; iconBg: string; iconColor: string; chip: string }> = {
    rose: {
      bgGrad: 'from-rose-500/10 to-rose-500/5',
      iconBg: 'bg-rose-500/15',
      iconColor: 'text-rose-400',
      chip: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    },
    amber: {
      bgGrad: 'from-amber-500/10 to-amber-500/5',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      chip: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    },
  };
  const a = accentMap[accent];

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="da-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="da-panel"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-5xl max-h-[85vh] bg-panel rounded-2xl flex flex-col overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.65),0_10px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`shrink-0 flex items-center justify-between px-5 py-4 bg-gradient-to-r ${a.bgGrad}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${a.iconBg}`}>
                <Icon className={`w-4 h-4 ${a.iconColor}`} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-main">{title}</h2>
                <p className="text-[10px] text-muted mt-0.5">{subtitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Close">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Search bar */}
          <div className="shrink-0 flex items-center gap-2 px-5 py-3 bg-panel/50">
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${a.chip}`}>{rows.length.toLocaleString()} flagged</div>
            <div className="flex-1" />
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, branch, route…"
                className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 text-[11px] text-main placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-64"
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-xs text-slate-400">
                <div className={`w-5 h-5 rounded-full border-2 ${isGps ? 'border-rose-500' : 'border-amber-500'} border-t-transparent animate-spin mr-2`} />
                Loading {title.toLowerCase()}…
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-xs text-slate-500 gap-2">
                <Icon className="w-6 h-6 opacity-40" />
                <span>{rows.length === 0 ? 'No issues found.' : 'No matches for this search.'}</span>
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-panel/95 backdrop-blur z-10">
                  <tr className="text-left text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5 cursor-pointer hover:text-indigo-400" onClick={() => toggleSort('customerName')}>
                      <div className="flex items-center gap-1">Customer <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="px-4 py-2.5 cursor-pointer hover:text-indigo-400" onClick={() => toggleSort('branchName')}>
                      <div className="flex items-center gap-1">Branch <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="px-4 py-2.5 cursor-pointer hover:text-indigo-400" onClick={() => toggleSort('routeName')}>
                      <div className="flex items-center gap-1">Route <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                    </th>
                    <th className="px-4 py-2.5">District</th>
                    {isGps ? (
                      <th className="px-4 py-2.5 text-right">Coords</th>
                    ) : (
                      <th className="px-4 py-2.5 text-right cursor-pointer hover:text-indigo-400" onClick={() => toggleSort('distanceMeters')}>
                        <div className="flex items-center justify-end gap-1">Distance <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={`${r.clientCode || 'r'}-${i}`} className="border-b border-white/[0.04] hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-slate-300">{r.clientCode || '—'}</td>
                      <td className="px-4 py-2.5 font-bold text-main">{r.customerName || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-300">{r.branchName || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400 truncate max-w-[200px]" title={r.routeName || ''}>{r.routeName || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400">{r.district || '—'}</td>
                      {isGps ? (
                        <td className="px-4 py-2.5 text-right font-mono text-rose-300">missing</td>
                      ) : (
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-300">{r.distanceMeters?.toLocaleString()} m</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-2.5 border-t border-white/[0.04] bg-panel/40 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Showing {filtered.length} of {rows.length}</span>
            <span className="opacity-60">ESC or click outside to close</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

// --- Main Component ---

interface InsightsDashboardProps {
  currentUser: UserType;
  currentCompany: Company | null;
  allCustomers: Customer[];
  userList: UserType[];
  uploadHistory: any[];
  onNavigate: (view: any) => void;
  onLogout: () => void;
  hideHeader?: boolean;
  isDarkMode: boolean;
  language: 'en' | 'ar';
  isAiTheme: boolean;
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onOpenCompanySettings?: () => void;
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Insights Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">Something went wrong in Insights</h2>
          <p className="text-slate-400 mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const InsightsDashboardContent: React.FC<InsightsDashboardProps> = (props) => {
  const { currentCompany, currentUser } = props;

  // Route Health detail modal state
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [healthModalFilter, setHealthModalFilter] = useState<HealthFilter>('all');
  const openHealthList = (status: HealthFilter) => { setHealthModalFilter(status); setHealthModalOpen(true); };

  // Data Alerts modal state
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertType, setAlertType] = useState<AlertType>('gps');
  const openAlertList = (t: AlertType) => { setAlertType(t); setAlertModalOpen(true); };

  // ESC to close any open modal
  React.useEffect(() => {
    if (!healthModalOpen && !alertModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setHealthModalOpen(false); setAlertModalOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [healthModalOpen, alertModalOpen]);

  // NEW: Check if user is admin/manager (can see all data)
  const isAdmin = !currentUser?.role || ['ADMIN', 'MANAGER', 'SYSADMIN'].includes(currentUser?.role?.toUpperCase?.() || '');
  const userBranchIds = currentUser?.branchIds || [];

  // Safety extraction of settings with robust parsing check
  // stableSettingsKey ensures we only re-parse if the actual content changes, not just the object ref
  const settingsStr = typeof currentCompany?.settings === 'string'
    ? currentCompany.settings
    : JSON.stringify(currentCompany?.settings || {});

  const settings = React.useMemo(() => {
    try {
      return JSON.parse(settingsStr);
    } catch {
      return {};
    }
  }, [settingsStr]);

  const insightsSettings = settings?.modules?.insights || {};
  const optimizerSettings = settings?.modules?.optimizer || {};

  // --- NEW: Fetch Branches from company_branches table ---
  const { data: dbBranches = [] } = useQuery({
    queryKey: ['companyBranches', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      return await getBranches(currentCompany.id);
    },
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 60 * 5, // Cache branches for 5 mins
  });

  // Fetch per-branch stats (routes + distinct customers) for the map popup
  const { data: branchStats = {} } = useQuery({
    queryKey: ['branchStats', currentCompany?.id, isAdmin ? 'all' : userBranchIds.join(',')],
    queryFn: () => {
      if (!currentCompany?.id) return Promise.resolve({});
      const branchFilter = !isAdmin && userBranchIds.length > 0 ? userBranchIds : undefined;
      return fetchBranchStatsFromUploads(currentCompany.id, branchFilter);
    },
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 60 * 2,
  });

  const activeBranches = React.useMemo(() => {
    let branches = dbBranches.map(b => ({
      id: b.id,
      name: b.name_en,
      nameAr: b.name_ar,
      code: b.code,
      coordinates: { lat: b.lat || 0, lng: b.lng || 0 },
      isActive: b.is_active
    }));

    // NEW: Filter branches for non-admin users
    if (!isAdmin && userBranchIds.length > 0) {
      console.log('[Insights] Filtering branches for restricted user. Allowed:', userBranchIds);
      branches = branches.filter(b =>
        userBranchIds.includes(b.name) ||
        userBranchIds.includes(b.id) ||
        userBranchIds.includes(b.code)
      );
    }

    return branches;
  }, [dbBranches, isAdmin, userBranchIds]);

  // --- Server-Side Stats Fetching ---
  // PERFORMANCE FIX: 
  // 1. gcTime: 0 -> Clears cache/memory immediately on unmount
  // 2. retry: 3 -> Handles network glitches automatically
  // 3. signal -> Cancels pending request if user navigates away
  const {
    data: summary,
    isLoading: isCalculating,
    refetch: refreshInsights,
    isRefetching,
    isError,
    error: queryError
  } = useQuery({
    queryKey: ['dashboardInsights', currentCompany?.id, isAdmin ? 'all' : userBranchIds.join(',')],
    queryFn: async ({ signal }) => {
      if (!currentCompany?.id) throw new Error("No Company ID");
      // Pass branchIds for restricted users
      const branchFilter = !isAdmin && userBranchIds.length > 0 ? userBranchIds : undefined;
      console.log('[Insights] Fetching stats with branchFilter:', branchFilter);
      return await getDashboardInsights(currentCompany.id, branchFilter, signal);
    },
    enabled: !!currentCompany?.id,
    retry: 1, // Reduced retry for debugging
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 0, // Always fetch fresh data on mount
    gcTime: 0,    // Clear memory immediately when component unmounts (requires @tanstack/react-query v5)
    refetchOnWindowFocus: false,
  });

  if (isError) {
    return (
      <div className="p-8 text-center text-red-500">
        <h3 className="font-bold">Error Loading Data</h3>
        <p className="text-sm opacity-70 mb-4">{queryError?.message}</p>
        <button onClick={() => refreshInsights()} className="px-4 py-2 bg-white/10 rounded">Retry</button>
      </div>
    );
  }

  console.log('Insights Debug:', {
    companyId: currentCompany?.id,
    summary,
    isCalculating,
    activeBranchesLength: activeBranches.length,
    firstBranchCoords: activeBranches[0]?.coordinates
  });

  // Safe extraction of alerts to prevent crashes
  const alerts = summary?.alerts || { missingGps: 0, proximityIssues: 0 };

  const formatNum = (n: number) => n?.toLocaleString() || '0';

  // Prepare dynamic tooltips based on company settings
  const metrics = [
    {
      id: 1,
      label: 'Total Customers',
      value: formatNum(summary?.kpis.totalCustomers || 0),
      icon: Users,
      color: 'blue',
      tooltip: 'Distinct Count of "Client Code" across all records. (Fallback to Name+Location hash if missing)'
    },
    {
      id: 2,
      label: 'Active Routes',
      value: summary?.kpis.activeRoutes || 0,
      icon: Route,
      color: 'violet',
      tooltip: 'Distinct Count of unique "Route Names" in the uploaded dataset.'
    },
    {
      id: 3,
      label: 'Total Visits',
      value: formatNum(summary?.kpis.totalVisits || 0),
      icon: MapPin,
      color: 'cyan',
      tooltip: 'Total number of records/stops (including duplicate visits to same client).'
    },
    { id: 4, label: 'Total Distance', value: formatNum(summary?.kpis.totalDistance || 0), unit: 'km', icon: Milestone, color: 'emerald', tooltip: 'Calculated via GPS (Haversine) from customer to customer (North-to-South path).' },
    { id: 5, label: 'Total Time', value: Math.round((summary?.kpis.totalTime || 0) / 60), unit: 'hrs', icon: Timer, color: 'amber', tooltip: 'Total Duration = Travel Time (25km/h) + Service Time (10 mins/visit).' },
    { id: 6, label: 'Avg Visits', value: summary?.kpis.avgVisitsPerRoute || 0, icon: BarChart3, color: 'fuchsia', tooltip: 'Average number of stops per route (Total Visits / Active Routes)' },
    {
      id: 7,
      label: 'Time / User',
      value: summary?.kpis.timePerUser || 0,
      unit: 'hrs',
      icon: User,
      color: 'sky',
      tooltip: `Avg. working minutes per user (Limit: ${optimizerSettings?.maxWorkingHours || 9}h/day)`
    },
    {
      id: 8,
      label: 'Frequency',
      value: summary?.kpis.frequency || 0,
      icon: Repeat,
      color: 'indigo',
      tooltip: `Avg. visits per client (Target: ${insightsSettings?.visitFrequencyDays || 7} days)`
    },
    {
      id: 9,
      label: 'Efficiency',
      value: summary?.kpis.efficiency || 0,
      unit: '%',
      icon: Zap,
      color: 'rose',
      tooltip: `Route optimization score (Target: ${insightsSettings?.efficiencyThreshold || 85}%)`
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-main text-main font-sans overflow-hidden relative">
      {/* Floating Refresh Button — single header lives in the parent layout (ModernOSLayout) */}
      <button
        onClick={() => refreshInsights()}
        disabled={isCalculating || isRefetching}
        className={`absolute top-3 right-4 z-[80] flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel/70 hover:bg-panel/90 backdrop-blur-md transition-all shadow-[0_10px_30px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] ${isCalculating || isRefetching ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
        title="Refresh Insights data"
      >
        <Repeat className={`w-3.5 h-3.5 text-indigo-400 ${isCalculating || isRefetching ? 'animate-spin' : ''}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
          {isCalculating || isRefetching ? 'Refreshing…' : 'Refresh'}
        </span>
      </button>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto md:overflow-visible p-4 relative flex flex-col gap-4">


        {/* Background Grid */}
        <style>{`
          .insights-grid-bg {
            background-image: radial-gradient(circle at 1px 1px, #334155 1px, transparent 0);
            background-size: 24px 24px;
          }
        `}</style>
        <div className="absolute inset-0 pointer-events-none opacity-20 insights-grid-bg" />

        {/* 1. TOP ROW: KPI DECK (Exact Order 1-9) */}
        <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3 shrink-0 z-[60] relative">
          {(!summary || isCalculating) ? (
            Array(9).fill(0).map((_, i) => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />)
          ) : (
            metrics.map((m, i) => (
              <UniformKpiCard
                key={m.id}
                label={m.label}
                value={m.value}
                unit={m.unit}
                icon={m.icon}
                color={m.color}
                delay={i * 0.05}
                tooltip={m.tooltip}
              />
            ))
          )}
        </div>

        {/* 2. SPLIT VIEW: MAP (Left) | HEALTH & ALERTS (Right) */}
        <div className="flex-1 min-h-[500px] md:min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 z-10 relative">

          {/* Loading Overlay for Map/Stats */}
          {isCalculating && (
            <div className="absolute inset-0 z-[500] bg-main/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <span className="text-xs font-bold text-indigo-400 animate-pulse">Syncing Cloud Metrics...</span>
              </div>
            </div>
          )}

          {/* LEFT: MAP - Dominant View */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            className="lg:col-span-8 bg-panel rounded-2xl overflow-hidden relative h-full flex flex-col min-h-[400px] shadow-[0_24px_60px_rgba(0,0,0,0.55),0_8px_22px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <ReachCommandMap
              companyLocation={settings?.modules?.map?.defaultCenter || null}
              companyName={currentCompany?.name}
              branches={activeBranches}
              branchStats={branchStats}
              country={settings?.common?.general?.country || 'Saudi Arabia'}
            />
          </motion.div>

          {/* RIGHT: HEALTH & ALERTS SIDEBAR */}
          <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar h-full bg-panel/40 rounded-2xl p-4 glass-panel shadow-[0_24px_60px_rgba(0,0,0,0.55),0_8px_22px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">

            {/* SECTION A: ROUTE HEALTH CHECK */}
            <div className="shrink-0">
              <div className="flex items-center gap-2 mb-4 pb-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-black text-main uppercase tracking-wider">Route Health Check</h3>
              </div>

              {(!summary || isCalculating) ? (
                <div className="h-40 w-full bg-white/5 animate-pulse rounded-xl" />
              ) : (
                <HealthMonitor
                  data={summary?.routeHealth || { stable: 0, under: 0, over: 0, total: 0, details: [] }}
                  settings={insightsSettings}
                  onOpenList={openHealthList}
                />
              )}
            </div>

            {/* SECTION B: DATA ALERTS */}
            <div className="shrink-0 pt-2">
              <div className="flex items-center gap-2 mb-3 pb-2">
                <AlertOctagon className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-black text-main uppercase tracking-wider">Data Alerts</h3>
              </div>

              <div className="flex flex-col gap-2">
                {((alerts.missingGps || 0) === 0 && (alerts.proximityIssues || 0) === 0) ? (
                  <div className="p-4 rounded-lg bg-emerald-500/5 flex items-center gap-3 shadow-[0_8px_22px_rgba(0,0,0,0.4),0_0_14px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <div className="p-1 rounded-full bg-emerald-500/20"><Activity className="w-4 h-4 text-emerald-500" /></div>
                    <span className="text-[10px] text-emerald-400 font-medium">No critical alerts detected.</span>
                  </div>
                ) : (
                  <>
                    {alerts.missingGps > 0 && (
                      <RedFlagCard
                        title="Missing GPS"
                        value={formatNum(alerts.missingGps || 0)}
                        icon={AlertOctagon}
                        type="critical"
                        size="compact"
                        tooltip="Click to view customers with no GPS coordinates"
                        onClick={() => openAlertList('gps')}
                      />
                    )}
                    {alerts.proximityIssues > 0 && (
                      <RedFlagCard
                        title="Proximity Issues"
                        value={formatNum(alerts.proximityIssues || 0)}
                        icon={Target}
                        type="warning"
                        size="compact"
                        tooltip={`Click to view customers within ${insightsSettings?.nearbyRadiusMeters || 100}m of branch`}
                        onClick={() => openAlertList('proximity')}
                      />
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Route Health Details Modal */}
      <RouteHealthDetailsModal
        isOpen={healthModalOpen}
        onClose={() => setHealthModalOpen(false)}
        initialFilter={healthModalFilter}
        companyId={currentCompany?.id || ''}
        branchIds={!isAdmin && userBranchIds.length > 0 ? userBranchIds : undefined}
        thresholds={{
          min: insightsSettings?.minClientsPerRoute ?? 80,
          max: insightsSettings?.maxClientsPerRoute ?? 120,
        }}
      />

      {/* Data Alerts Details Modal (Missing GPS / Proximity) */}
      <DataAlertsDetailsModal
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        type={alertType}
        companyId={currentCompany?.id || ''}
        branchIds={!isAdmin && userBranchIds.length > 0 ? userBranchIds : undefined}
        radiusMeters={insightsSettings?.nearbyRadiusMeters ?? 100}
      />
    </div>
  );
};

const InsightsDashboard = (props: InsightsDashboardProps) => (
  <ErrorBoundary>
    <InsightsDashboardContent {...props} />
  </ErrorBoundary>
);

export default InsightsDashboard;
