/**
 * SysAdminShared — Unified design system for all SysAdmin screens.
 * Import PageHeader, StatusBadge, SysCard, EmptyState, ConfirmModal, and
 * the TABLE_CLS / INPUT_CLS constants to keep every screen looking identical.
 */

import React, { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

/** Single confirm phrase used across ALL destructive-action modals. */
export const CONFIRM_PHRASE = 'CONFIRM';

/** Shared Tailwind classes — import and apply these directly. */
export const TABLE_CLS = {
  wrapper:    'bg-white/5 border border-white/10 rounded-2xl overflow-hidden',
  header:     'grid gap-4 px-5 py-3 border-b border-white/10 bg-black/20 text-[11px] font-bold text-slate-500 uppercase tracking-wider',
  row:        'grid gap-4 px-5 py-4 border-b border-white/5 hover:bg-white/[0.03] transition-colors last:border-0',
  emptyCell:  'col-span-full py-14 flex flex-col items-center gap-3 text-slate-600',
} as const;

export const INPUT_CLS =
  'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all';

export const SELECT_CLS =
  'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-all appearance-none';

export const BTN = {
  primary:   'flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/20',
  secondary: 'flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-sm font-bold rounded-xl transition-all active:scale-95',
  danger:    'flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 text-sm font-bold rounded-xl transition-all active:scale-95',
  icon:      'p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/5 hover:border-white/10 active:scale-95',
} as const;

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  accentColor?: string;
}

export const SysModal: React.FC<ModalProps> = ({
  title, subtitle, onClose, children, width = 'max-w-lg', accentColor = 'from-indigo-500 to-purple-500'
}) => (
  <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
    <div className={`w-full ${width} bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
      {/* Accent bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${accentColor}`} />
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all ml-4 shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* Body */}
      <div>{children}</div>
    </div>
  </div>
);

// Modal footer helper
export const ModalFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3 bg-black/20">
    {children}
  </div>
);

// ─── PAGE HEADER ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, subtitle, actions, badge }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {badge}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

type StatusVariant =
  | 'active' | 'inactive' | 'pending' | 'approved' | 'rejected'
  | 'new' | 'contacted' | 'qualified' | 'provisioned' | 'stale'
  | 'starter' | 'growth' | 'elite' | 'enterprise' | 'professional';

const STATUS_STYLES: Record<StatusVariant, string> = {
  active:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  inactive:     'bg-red-500/10 text-red-400 border-red-500/20',
  pending:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  rejected:     'bg-slate-500/10 text-slate-400 border-slate-500/20',
  new:          'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  contacted:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
  qualified:    'bg-violet-500/10 text-violet-400 border-violet-500/20',
  provisioned:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  stale:        'bg-slate-600/20 text-slate-500 border-slate-600/20',
  starter:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  growth:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  elite:        'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  enterprise:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  professional: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const key = status?.toLowerCase() as StatusVariant;
  const styles = STATUS_STYLES[key] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
      {label ?? status}
    </span>
  );
};

// ─── SYS CARD ─────────────────────────────────────────────────────────────────

interface SysCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  titleIcon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SysCard: React.FC<SysCardProps> = ({ children, className = '', title, titleIcon, actions }) => (
  <div className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden ${className}`}>
    {title && (
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          {titleIcon && <span className="text-slate-400">{titleIcon}</span>}
          {title}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconColor?: string;
  onClick?: () => void;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon, label, value, sub, iconColor = 'text-indigo-400', onClick, loading
}) => (
  <div
    onClick={onClick}
    className={`bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4 ${onClick ? 'cursor-pointer hover:bg-white/8 hover:border-white/20 transition-all group' : ''}`}
  >
    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-0.5">{label}</p>
      {loading
        ? <Loader2 className="w-5 h-5 animate-spin text-slate-500 mt-1" />
        : <p className="text-2xl font-black text-white leading-tight">{value}</p>
      }
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="py-16 flex flex-col items-center gap-3 text-center">
    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-600 mb-2">
      {icon}
    </div>
    <p className="text-white font-bold text-sm">{title}</p>
    {description && <p className="text-slate-500 text-xs max-w-xs">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

// ─── CONFIRM MODAL ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isLoading?: boolean;
  /** Optional: show extra detail about what's being deleted */
  target?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen, onClose, onConfirm, title, description, isLoading, target
}) => {
  const [typed, setTyped] = useState('');
  const canConfirm = typed === CONFIRM_PHRASE;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0f172a] border border-red-500/20 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-0.5 w-full bg-gradient-to-r from-red-500 to-rose-600" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">{title}</h3>
              {target && <p className="text-xs text-slate-500 mt-0.5">{target}</p>}
            </div>
          </div>

          <p className="text-sm text-slate-400 mb-5 leading-relaxed">{description}</p>

          <div className="mb-5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
              Type <span className="text-red-400 font-mono">{CONFIRM_PHRASE}</span> to proceed
            </label>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value.toUpperCase())}
              placeholder={CONFIRM_PHRASE}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-700 focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 outline-none transition-all"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && canConfirm && !isLoading && onConfirm()}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || isLoading}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-900/30 disabled:text-red-800 disabled:cursor-not-allowed text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── INLINE ERROR / SUCCESS BANNER ───────────────────────────────────────────

interface InlineBannerProps {
  type: 'error' | 'success' | 'warning';
  message: string;
  onDismiss?: () => void;
}

const BANNER_STYLES = {
  error:   'bg-red-500/10 border-red-500/20 text-red-300',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
};

export const InlineBanner: React.FC<InlineBannerProps> = ({ type, message, onDismiss }) => (
  <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${BANNER_STYLES[type]}`}>
    <span>{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);
