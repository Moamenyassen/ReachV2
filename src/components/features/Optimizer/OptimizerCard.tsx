// @ts-nocheck
import React from 'react';
import { Calendar, Users, ArrowRight, Lightbulb, MapPin, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { OptimizationSuggestion } from '../../../services/clientOptimizer';

interface OptimizerCardProps {
    suggestion: OptimizationSuggestion;
    index: number;
    isSelected: boolean;
    isExpanded: boolean;
    onClick: () => void;
    onApply?: () => void;
    onDismiss?: () => void;
}

// Priority based on impact score
const getPriority = (score: number): { level: 'high' | 'medium' | 'low'; color: string; bgColor: string; label: string } => {
    if (score >= 70) return { level: 'high', color: 'text-red-400', bgColor: 'bg-red-500', label: 'HIGH IMPACT' };
    if (score >= 40) return { level: 'medium', color: 'text-amber-400', bgColor: 'bg-amber-500', label: 'MEDIUM' };
    return { level: 'low', color: 'text-emerald-400', bgColor: 'bg-emerald-500', label: 'LOW' };
};

// Efficiency ring component
const EfficiencyRing: React.FC<{ score: number; size?: number }> = ({ score, size = 48 }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    const priority = getPriority(score);

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={priority.level === 'high' ? '#ef4444' : priority.level === 'medium' ? '#f59e0b' : '#10b981'}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-black ${priority.color}`}>{score}</span>
            </div>
        </div>
    );
};

const OptimizerCard: React.FC<OptimizerCardProps> = ({
    suggestion,
    index,
    isSelected,
    isExpanded,
    onClick,
    onApply,
    onDismiss
}) => {
    const priority = getPriority(suggestion.impactScore);

    return (
        <div
            onClick={onClick}
            className={`
                relative bg-[#12141c] border rounded-2xl overflow-hidden cursor-pointer
                transition-all duration-300 ease-out
                ${isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl shadow-indigo-500/10'
                    : 'border-white/10 hover:border-white/20 hover:shadow-lg'}
            `}
        >
            {/* Priority indicator bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${priority.bgColor}`} />

            <div className="p-4 pl-5">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        {/* Efficiency Ring */}
                        <EfficiencyRing score={suggestion.impactScore} />

                        {/* Customer Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`
                                    inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide
                                    ${suggestion.type === 'USER_SWAP'
                                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                                        : 'bg-purple-500/15 text-purple-400 border border-purple-500/20'}
                                `}>
                                    {suggestion.type === 'USER_SWAP' ? <Users size={10} /> : <Calendar size={10} />}
                                    {suggestion.type === 'USER_SWAP' ? 'User Swap' : 'Day Swap'}
                                </span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${priority.color}`}>
                                    {priority.label}
                                </span>
                            </div>
                            <h3 className="text-sm font-bold text-white truncate max-w-[180px]" title={suggestion.clientName}>
                                {suggestion.clientName}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
                                <MapPin size={10} />
                                <span className="truncate max-w-[150px]">{suggestion.district || 'Unknown District'}</span>
                                <span className="text-gray-600">•</span>
                                <span className="font-mono text-gray-400">{suggestion.clientCode}</span>
                            </div>
                        </div>
                    </div>

                    {/* Rank Badge */}
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-mono text-gray-500">#{index + 1}</span>
                        {isSelected && (
                            <ChevronUp size={14} className="text-indigo-400" />
                        )}
                    </div>
                </div>

                {/* Swap Flow */}
                <div className="bg-black/40 rounded-xl p-3 mb-3 border border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">From</div>
                            <div className="text-xs font-semibold text-gray-300 truncate">{suggestion.fromUser}</div>
                            <div className="text-[10px] text-gray-500">{suggestion.fromDay}</div>
                        </div>

                        <div className="px-3 flex flex-col items-center">
                            <div className="w-8 h-px bg-gradient-to-r from-gray-700 to-indigo-500 mb-1" />
                            <ArrowRight className="text-indigo-400 w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0 text-right">
                            <div className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">To</div>
                            <div className="text-xs font-semibold text-indigo-300 truncate">{suggestion.toUser}</div>
                            <div className="text-[10px] text-indigo-400/70">{suggestion.toDay}</div>
                        </div>
                    </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/10">
                        <div className="text-[9px] text-emerald-400/60 uppercase font-bold">Distance</div>
                        <div className="text-sm font-black text-emerald-400">-{suggestion.distanceSaved}km</div>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-2 text-center border border-blue-500/10">
                        <div className="text-[9px] text-blue-400/60 uppercase font-bold">Time</div>
                        <div className="text-sm font-black text-blue-400">-{suggestion.timeSaved}min</div>
                    </div>
                    <div className="bg-purple-500/10 rounded-lg p-2 text-center border border-purple-500/10">
                        <div className="text-[9px] text-purple-400/60 uppercase font-bold">Confidence</div>
                        <div className="text-sm font-black text-purple-400">{suggestion.confidence}%</div>
                    </div>
                </div>

                {/* Reason */}
                <div className="flex items-start gap-2 text-[10px] text-gray-400 bg-white/5 rounded-lg p-2.5 leading-relaxed">
                    <Lightbulb size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{suggestion.reason}</span>
                </div>

                {/* Action Buttons - Show when selected */}
                {isSelected && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                        <button
                            onClick={(e) => { e.stopPropagation(); onApply?.(); }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            <Check size={14} />
                            Apply Change
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
                            className="px-4 py-2.5 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/10 hover:border-red-500/30"
                        >
                            <X size={14} />
                            Dismiss
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OptimizerCard;
