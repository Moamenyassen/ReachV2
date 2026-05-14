/**
 * ConfirmDialog — Reach AI
 * Replaces all window.confirm() calls with a beautiful, accessible modal.
 *
 * Usage:
 *   const { confirm } = useConfirm();
 *   const ok = await confirm({ title: 'Delete version?', description: '...', danger: true });
 *   if (ok) { ... }
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmOptions {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface PendingConfirm extends ConfirmOptions {
    resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pending, setPending] = useState<PendingConfirm | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            setPending({ ...options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        pending?.resolve(true);
        setPending(null);
    };

    const handleCancel = () => {
        pending?.resolve(false);
        setPending(null);
    };

    // Close on Escape
    React.useEffect(() => {
        if (!pending) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter') handleConfirm();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [pending]);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {pending && (
                <div
                    className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={handleCancel}
                >
                    <div
                        className="bg-gray-900 border border-white/10 rounded-3xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200 relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={handleCancel}
                            className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                            aria-label="Cancel"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                            pending.danger ? 'bg-red-500/15' : 'bg-amber-500/15'
                        }`}>
                            {pending.danger
                                ? <Trash2 className="w-6 h-6 text-red-400" />
                                : <AlertTriangle className="w-6 h-6 text-amber-400" />
                            }
                        </div>

                        {/* Content */}
                        <h3 className="text-lg font-black text-white mb-2 pr-8">{pending.title}</h3>
                        {pending.description && (
                            <p className="text-sm text-gray-400 leading-relaxed mb-6">{pending.description}</p>
                        )}
                        {!pending.description && <div className="mb-4" />}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleCancel}
                                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold text-sm transition-all active:scale-95"
                            >
                                {pending.cancelLabel || 'Cancel'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg ${
                                    pending.danger
                                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
                                        : 'bg-amber-500 hover:bg-amber-400 text-gray-900 shadow-amber-500/20'
                                }`}
                            >
                                {pending.confirmLabel || (pending.danger ? 'Delete' : 'Confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};

export const useConfirm = (): ConfirmContextValue => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
    return ctx;
};
