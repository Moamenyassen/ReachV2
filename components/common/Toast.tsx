/**
 * Toast Notification System — Reach AI
 * Replaces all alert() calls with premium animated toasts.
 * Usage: import { useToast, ToastContainer } from './Toast'
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    toast: (type: ToastType, title: string, message?: string, duration?: number) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        if (timers.current[id]) {
            clearTimeout(timers.current[id]);
            delete timers.current[id];
        }
    }, []);

    const toast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }]);

        if (duration > 0) {
            timers.current[id] = setTimeout(() => dismiss(id), duration);
        }
    }, [dismiss]);

    const success = useCallback((title: string, msg?: string) => toast('success', title, msg), [toast]);
    const error = useCallback((title: string, msg?: string) => toast('error', title, msg, 6000), [toast]);
    const warning = useCallback((title: string, msg?: string) => toast('warning', title, msg, 5000), [toast]);
    const info = useCallback((title: string, msg?: string) => toast('info', title, msg), [toast]);

    return (
        <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

// --- Visual Component ---
const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: React.ElementType; iconColor: string }> = {
    success: {
        bg: 'bg-gray-900 dark:bg-gray-900',
        border: 'border-emerald-500/40',
        icon: CheckCircle2,
        iconColor: 'text-emerald-400',
    },
    error: {
        bg: 'bg-gray-900 dark:bg-gray-900',
        border: 'border-red-500/40',
        icon: XCircle,
        iconColor: 'text-red-400',
    },
    warning: {
        bg: 'bg-gray-900 dark:bg-gray-900',
        border: 'border-amber-500/40',
        icon: AlertTriangle,
        iconColor: 'text-amber-400',
    },
    info: {
        bg: 'bg-gray-900 dark:bg-gray-900',
        border: 'border-blue-500/40',
        icon: Info,
        iconColor: 'text-blue-400',
    },
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    const style = TOAST_STYLES[toast.type];
    const Icon = style.icon;

    return (
        <div
            className={`
                flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-2xl
                border shadow-2xl backdrop-blur-xl
                ${style.bg} ${style.border}
                animate-in slide-in-from-right-5 fade-in duration-300
            `}
            role="alert"
        >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{toast.title}</p>
                {toast.message && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{toast.message}</p>
                )}
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 text-gray-600 hover:text-white transition-colors p-0.5 rounded-lg hover:bg-white/10"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;

    return (
        <div
            aria-live="polite"
            aria-atomic="false"
            className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 items-end pointer-events-none"
        >
            {toasts.map(t => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onDismiss={onDismiss} />
                </div>
            ))}
        </div>
    );
};
