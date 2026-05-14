// @ts-nocheck
import React from 'react';
import { Zap, Activity, ArrowRight, AlertTriangle, TrendingUp, TrendingDown, Target, GitCompare, CheckCircle2 } from 'lucide-react';
import { OptimizationSuggestion } from '../../../services/clientOptimizer';

interface ImpactPanelProps {
    suggestion: OptimizationSuggestion | null;
    onApply: () => void;
}

// Donut chart component
const EfficiencyDonut: React.FC<{ score: number }> = ({ score }) => {
    const size = 140;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    // Color based on score
    const getColor = () => {
        if (score >= 80) return { stroke: '#10b981', bg: 'from-emerald-500/20' };
        if (score >= 60) return { stroke: '#6366f1', bg: 'from-indigo-500/20' };
        if (score >= 40) return { stroke: '#f59e0b', bg: 'from-amber-500/20' };
        return { stroke: '#ef4444', bg: 'from-red-500/20' };
    };

    const colors = getColor();

    return (
        <div className={`relative bg-gradient-to-b ${colors.bg} to-transparent rounded-2xl p-6 border border-white/5`}>
            <div className="flex justify-center">
                <svg width={size} height={size} className="transform -rotate-90">
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                        style={{
                            filter: `drop-shadow(0 0 8px ${colors.stroke}50)`
                        }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white">{score}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Score</span>
                </div>
            </div>
        </div>
    );
};

// Comparison bar
const ComparisonBar: React.FC<{
    label: string;
    before: number;
    after: number;
    unit: string;
    color: string;
}> = ({ label, before, after, unit, color }) => {
    const improvement = before - after;
    const percentChange = ((improvement / before) * 100).toFixed(0);

    return (
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
                <span className={`text-xs font-bold ${color} flex items-center gap-1`}>
                    <TrendingDown size={12} />
                    {percentChange}% better
                </span>
            </div>
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12">Before</span>
                    <div className="flex-1 h-2 bg-red-500/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-red-500/50 rounded-full transition-all duration-500"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <span className="text-xs font-mono text-gray-400 w-16 text-right">{before} {unit}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12">After</span>
                    <div className="flex-1 h-2 bg-emerald-500/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${(after / before) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs font-mono text-emerald-400 w-16 text-right">{after} {unit}</span>
                </div>
            </div>
        </div>
    );
};

const ImpactPanel: React.FC<ImpactPanelProps> = ({ suggestion, onApply }) => {
    if (!suggestion) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Target size={32} className="text-indigo-400/50" />
                    </div>
                    <div className="absolute inset-0 animate-ping w-20 h-20 rounded-full bg-indigo-500/10" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Select an Opportunity</h3>
                <p className="text-sm text-gray-500 max-w-[200px] leading-relaxed">
                    Click on any optimization suggestion to view its detailed impact analysis.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-5 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Activity className="text-white" size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Impact Analysis</h3>
                    <p className="text-[10px] text-indigo-300 font-mono truncate max-w-[150px]">{suggestion.id}</p>
                </div>
            </div>

            {/* Efficiency Score */}
            <EfficiencyDonut score={suggestion.impactScore} />

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-2 my-5">
                <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/10">
                    <div className="text-lg font-black text-emerald-400">-{suggestion.distanceSaved}</div>
                    <div className="text-[9px] text-emerald-400/60 uppercase font-bold">km saved</div>
                </div>
                <div className="bg-blue-500/10 rounded-xl p-3 text-center border border-blue-500/10">
                    <div className="text-lg font-black text-blue-400">-{suggestion.timeSaved}</div>
                    <div className="text-[9px] text-blue-400/60 uppercase font-bold">min saved</div>
                </div>
                <div className="bg-purple-500/10 rounded-xl p-3 text-center border border-purple-500/10">
                    <div className="text-lg font-black text-purple-400">{suggestion.confidence}%</div>
                    <div className="text-[9px] text-purple-400/60 uppercase font-bold">confidence</div>
                </div>
            </div>

            {/* Before/After Comparison */}
            <div className="mb-5">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <GitCompare size={12} className="text-indigo-400" />
                    Route Comparison
                </h4>
                <ComparisonBar
                    label="Avg Distance to Neighbors"
                    before={suggestion.currentRouteAvgDist}
                    after={suggestion.newRouteAvgDist}
                    unit="km"
                    color="text-emerald-400"
                />
            </div>

            {/* Route Impact Details */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-5">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Activity size={12} className="text-indigo-400" />
                    Why This Matters
                </h4>

                <div className="space-y-4">
                    {/* Source Route */}
                    <div className="relative pl-4 border-l-2 border-emerald-500/50">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 size={12} className="text-emerald-400" />
                            <span className="text-xs font-bold text-gray-300">{suggestion.fromUser}'s Route</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                            Removing this stop eliminates a <strong className="text-white">{suggestion.currentRouteAvgDist} km</strong> outlier,
                            significantly improving route density.
                        </p>
                    </div>

                    {/* Target Route */}
                    <div className="relative pl-4 border-l-2 border-blue-500/50">
                        <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 size={12} className="text-blue-400" />
                            <span className="text-xs font-bold text-gray-300">{suggestion.toUser}'s Route</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                            Adding this stop only adds <strong className="text-white">{suggestion.newRouteAvgDist} km</strong> deviation.
                            It fits naturally in the existing pattern.
                        </p>
                    </div>
                </div>
            </div>

            {/* Alert */}
            {suggestion.type === 'USER_SWAP' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 mb-5">
                    <AlertTriangle className="text-amber-500 w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-amber-200/80 leading-relaxed">
                        This is a <strong>cross-user optimization</strong>. May require manager approval.
                    </p>
                </div>
            )}

            {/* Spacer to push button to bottom */}
            <div className="flex-1" />

            {/* Apply Button */}
            <button
                onClick={onApply}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 group"
            >
                <span>Apply Optimization</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
    );
};

export default ImpactPanel;
