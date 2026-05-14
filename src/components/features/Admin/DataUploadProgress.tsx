import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2, Route, Users, CalendarCheck, CheckCircle2,
    Loader2, AlertCircle, Database, ArrowRight, Sparkles, UserCheck
} from 'lucide-react';

export interface UploadStep {
    id: string;
    name: string;
    table: string;
    icon: React.ReactNode;
    status: 'pending' | 'processing' | 'complete' | 'error';
    count?: number;
    totalCount?: number;
    percent?: number;
    message?: string;
}

interface DataUploadProgressProps {
    steps: UploadStep[];
    currentStep: number;
    fileName: string;
    isComplete: boolean;
    error?: string;
    onComplete?: () => void;
}

const stepVariants = {
    pending: { scale: 1, opacity: 0.5 },
    processing: { scale: 1.02, opacity: 1 },
    complete: { scale: 1, opacity: 1 },
    error: { scale: 1, opacity: 1 }
};

const iconVariants = {
    pending: { rotate: 0 },
    processing: { rotate: 360, transition: { repeat: Infinity, duration: 1, ease: 'linear' } },
    complete: { rotate: 0, scale: [1, 1.2, 1], transition: { duration: 0.3 } },
    error: { rotate: 0 }
};

const pulseDelayStyle1: React.CSSProperties = { animationDelay: '1s' };
const pulseDelayStyle2: React.CSSProperties = { animationDelay: '0.5s' };

const DataUploadProgress: React.FC<DataUploadProgressProps> = ({
    steps,
    currentStep,
    fileName,
    isComplete,
    error,
    onComplete
}) => {
    const completedSteps = steps.filter(s => s.status === 'complete').length;
    const overallProgress = Math.round((completedSteps / steps.length) * 100);

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950 backdrop-blur-xl">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={pulseDelayStyle1} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={pulseDelayStyle2} />
            </div>

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative w-full max-w-2xl mx-4"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="inline-flex items-center gap-3 bg-slate-800/50 rounded-full px-6 py-3 border border-slate-700/50 mb-6"
                    >
                        <Database className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm text-slate-300 font-medium">Syncing Data</span>
                        <ArrowRight className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-white font-bold">{fileName}</span>
                    </motion.div>

                    <motion.h1
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-3xl font-black text-white mb-2"
                    >
                        {isComplete ? '✨ Import Complete!' : 'Importing Your Data...'}
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-400"
                    >
                        {isComplete
                            ? 'All tables have been synchronized successfully'
                            : 'Building your normalized database structure'}
                    </motion.p>
                </div>

                {/* Overall Progress Bar */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    className="mb-8"
                >
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span>Overall Progress</span>
                        <span className="text-white font-bold">{overallProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${overallProgress}%` }}
                            transition={{ ease: 'easeOut', duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full"
                        />
                    </div>
                </motion.div>

                {/* Steps List */}
                <div className="bg-slate-900/80 rounded-2xl border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-center gap-4 p-5 border-b border-slate-800 last:border-b-0 transition-all ${step.status === 'processing' ? 'bg-indigo-500/10' : ''
                                }`}
                        >
                            {/* Step Icon */}
                            <motion.div
                                variants={stepVariants}
                                animate={step.status}
                                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${step.status === 'complete'
                                    ? 'bg-emerald-500/20 border border-emerald-500/50'
                                    : step.status === 'processing'
                                        ? 'bg-indigo-500/20 border border-indigo-500/50'
                                        : step.status === 'error'
                                            ? 'bg-red-500/20 border border-red-500/50'
                                            : 'bg-slate-800 border border-slate-700'
                                    }`}
                            >
                                {step.status === 'complete' ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                                    </motion.div>
                                ) : step.status === 'processing' ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                    >
                                        <Loader2 className="w-6 h-6 text-indigo-400" />
                                    </motion.div>
                                ) : step.status === 'error' ? (
                                    <AlertCircle className="w-6 h-6 text-red-400" />
                                ) : (
                                    <div className="text-slate-500">{step.icon}</div>
                                )}
                            </motion.div>

                            {/* Step Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className={`font-bold ${step.status === 'complete'
                                        ? 'text-emerald-400'
                                        : step.status === 'processing'
                                            ? 'text-white'
                                            : step.status === 'error'
                                                ? 'text-red-400'
                                                : 'text-slate-500'
                                        }`}>
                                        {step.name}
                                    </h3>
                                    {step.count !== undefined && (
                                        <span className={`text-sm font-bold ${step.status === 'complete' ? 'text-emerald-400' : 'text-white'
                                            }`}>
                                            {step.count.toLocaleString()} {step.totalCount ? `/ ${step.totalCount.toLocaleString()}` : ''} records
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <code className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                                        → {step.table}
                                    </code>
                                    {step.status === 'processing' && step.message && (
                                        <span className="text-xs text-indigo-400 animate-pulse">
                                            {step.message}
                                        </span>
                                    )}
                                </div>

                                {/* Progress bar for processing step */}
                                {step.status === 'processing' && step.percent !== undefined && (
                                    <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${step.percent}%` }}
                                            className="h-full bg-indigo-500 rounded-full"
                                        />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Error Display */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
                    >
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-red-400">Error During Import</h4>
                            <p className="text-sm text-red-300/80">{error}</p>
                        </div>
                    </motion.div>
                )}

                {/* Completion Animation */}
                {isComplete && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-8 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.5 }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3 rounded-full text-white font-bold shadow-lg shadow-emerald-500/25"
                        >
                            <Sparkles className="w-5 h-5" />
                            Data Successfully Imported!
                        </motion.div>
                        {onComplete && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                                onClick={onComplete}
                                className="mt-4 block mx-auto text-slate-400 hover:text-white transition-colors text-sm"
                            >
                                Continue to Dashboard →
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

export function createUploadSteps(): UploadStep[] {
    return [
        {
            id: 'raw_backup',
            name: 'Raw Data Backup',
            table: 'company_uploaded_data',
            icon: <Database className="w-5 h-5" />,
            status: 'pending'
        },
        {
            id: 'branches',
            name: 'Branches',
            table: 'company_branches', // Updated
            icon: <Building2 className="w-5 h-5" />,
            status: 'pending'
        },

        {
            id: 'routes',
            name: 'Routes',
            table: 'routes',
            icon: <Route className="w-5 h-5" />,
            status: 'pending'
        },
        {
            id: 'customers',
            name: 'Customers',
            table: 'normalized_customers',
            icon: <Users className="w-5 h-5" />,
            status: 'pending'
        },
        {
            id: 'visits',
            name: 'Visit Schedule',
            table: 'route_visits',
            icon: <CalendarCheck className="w-5 h-5" />,
            status: 'pending'
        }
    ];
}

export default DataUploadProgress;
