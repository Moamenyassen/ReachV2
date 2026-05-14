// @ts-nocheck
import React from 'react';
import { Zap, Play, RefreshCw, Settings, TrendingUp } from 'lucide-react';

interface OptimizerHeaderProps {
    stats: {
        distance: number;
        time: number;
        optimizations: number;
    };
    avgConfidence: number;
    onAutoOptimize: () => void;
    onRefresh: () => void;
    loading: boolean;
}

// Animated counter component
const AnimatedNumber: React.FC<{ value: number; suffix?: string; prefix?: string }> = ({ value, suffix = '', prefix = '' }) => {
    const [displayValue, setDisplayValue] = React.useState(0);

    React.useEffect(() => {
        const duration = 1000;
        const steps = 30;
        const increment = value / steps;
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.round(current * 10) / 10);
            }
        }, duration / steps);
        return () => clearInterval(timer);
    }, [value]);

    return <span>{prefix}{displayValue}{suffix}</span>;
};

const OptimizerHeader: React.FC<OptimizerHeaderProps> = ({
    stats,
    avgConfidence,
    onAutoOptimize,
    onRefresh,
    loading
}) => {
    // Estimate cost savings (assuming $0.15/km average fuel cost)
    const estimatedSavings = Math.round(stats.distance * 0.15);

    return (
        <div className="bg-gradient-to-r from-[#0a0b0f] via-[#12141c] to-[#0a0b0f] border-b border-white/10">
            {/* Main Header */}
            <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <Zap className="text-white w-6 h-6 fill-white/20" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0a0b0f] flex items-center justify-center">
                                <span className="text-[8px] font-bold text-white">AI</span>
                            </div>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Route Intelligence</h1>
                            <p className="text-xs text-indigo-400 font-medium flex items-center gap-1.5">
                                <TrendingUp size={12} />
                                AI-Powered Optimization Engine
                            </p>
                        </div>
                    </div>

                    {/* Metrics Cards */}
                    <div className="flex items-center gap-3">
                        {/* Distance Saved */}
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-5 py-3 min-w-[120px] text-center group hover:bg-emerald-500/15 transition-all cursor-default">
                            <div className="text-[10px] text-emerald-400/70 uppercase font-bold tracking-wider mb-1">Distance Saved</div>
                            <div className="text-2xl font-black text-emerald-400 tabular-nums">
                                <AnimatedNumber value={stats.distance} suffix=" km" />
                            </div>
                        </div>

                        {/* Time Saved */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-3 min-w-[120px] text-center group hover:bg-blue-500/15 transition-all cursor-default">
                            <div className="text-[10px] text-blue-400/70 uppercase font-bold tracking-wider mb-1">Time Recovered</div>
                            <div className="text-2xl font-black text-blue-400 tabular-nums">
                                <AnimatedNumber value={stats.time} suffix=" hrs" />
                            </div>
                        </div>

                        {/* Cost Savings */}
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 min-w-[120px] text-center group hover:bg-amber-500/15 transition-all cursor-default">
                            <div className="text-[10px] text-amber-400/70 uppercase font-bold tracking-wider mb-1">Est. Savings</div>
                            <div className="text-2xl font-black text-amber-400 tabular-nums">
                                <AnimatedNumber value={estimatedSavings} prefix="$" />
                            </div>
                        </div>

                        {/* AI Confidence */}
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-5 py-3 min-w-[100px] text-center group hover:bg-purple-500/15 transition-all cursor-default relative overflow-hidden">
                            <div className="text-[10px] text-purple-400/70 uppercase font-bold tracking-wider mb-1">AI Score</div>
                            <div className="text-2xl font-black text-purple-400 tabular-nums">
                                <AnimatedNumber value={avgConfidence} suffix="%" />
                            </div>
                            {/* Pulse effect */}
                            <div className="absolute inset-0 bg-purple-500/5 animate-pulse pointer-events-none" />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className={`p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all ${loading ? 'animate-spin' : ''}`}
                            title="Refresh Analysis"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={onAutoOptimize}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-2 group"
                        >
                            <Play size={16} className="fill-current group-hover:scale-110 transition-transform" />
                            Auto-Optimize
                        </button>
                        <button
                            className="p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                            title="Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Actions count indicator */}
            <div className="px-6 pb-3">
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Found</span>
                    <span className="text-white font-bold">{stats.optimizations}</span>
                    <span className="text-gray-500">optimization opportunities across your network</span>
                    {stats.optimizations > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase">
                            Ready to apply
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OptimizerHeader;
