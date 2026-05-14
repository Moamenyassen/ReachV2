import React from 'react';
import { OptimizationSuggestion } from '../../../types/optimizer';
import { Navigation, Clock, Check, Target, AlertCircle, TrendingUp, Info } from 'lucide-react';

interface ImpactCalculatorProps {
    suggestion: OptimizationSuggestion;
    onApply: () => void;
}

const ImpactCalculator: React.FC<ImpactCalculatorProps> = ({ suggestion, onApply }) => {
    const { impact, reason, clientName, clientCode, classification } = suggestion;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-10">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={16} className="text-green-500" />
                    Impact Analysis
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                {/* Customer Snapshot */}
                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Target Customer</div>
                    <div className="text-base font-bold text-white mb-0.5">{clientName}</div>
                    <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-400 font-mono">{clientCode}</div>
                        {classification && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${classification === 'A' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                    classification === 'B' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                        'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                }`}>Class {classification}</span>
                        )}
                    </div>
                </div>

                {/* Distance Metric */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Distance</span>
                        <span className="text-xs font-bold text-green-400">-{impact.distanceSaved.toFixed(1)} km</span>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-1 relative h-8 flex items-center">
                        {/* Progress Bar Background */}
                        <div className="absolute inset-0 bg-gray-700/30 rounded-lg"></div>

                        {/* Bar */}
                        <div
                            className="h-6 bg-blue-600 rounded flex items-center justify-center text-[10px] font-bold text-white relative z-10 transition-all duration-500"
                            style={{ width: `${(impact.optimizedDistance / impact.currentDistance) * 100}%` }}
                        >
                            New
                        </div>
                        <div className="flex-1 text-right pr-3 text-[10px] text-gray-500 z-10 relative font-medium">
                            was {impact.currentDistance.toFixed(1)} km
                        </div>
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-gray-500 px-1">
                        <span>{impact.optimizedDistance.toFixed(1)} km</span>
                        <span>Current Path</span>
                    </div>
                </div>

                {/* Time Metric */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={14} className="text-blue-500" />
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Time Save</span>
                        </div>
                        <div className="text-xl font-black text-white">{Math.round(impact.timeSaved)} <span className="text-sm font-medium text-gray-500">min</span></div>
                    </div>

                    <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Target size={14} className="text-orange-500" />
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Confidence</span>
                        </div>
                        <div className="text-xl font-black text-white">{impact.confidence}%</div>
                    </div>
                </div>

                {/* Detailed Logic */}
                <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-700/50">
                    <div className="flex items-start gap-3">
                        <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <div className="text-xs font-bold text-gray-300 mb-1">Why this optimization?</div>
                            <p className="text-xs text-gray-400 leading-relaxed">{reason}</p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm space-y-3">
                <button
                    onClick={onApply}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                    <Check size={18} />
                    Apply Optimization
                </button>

                <button className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                    <AlertCircle size={14} />
                    Report Issue
                </button>
            </div>
        </div>
    );
};

export default ImpactCalculator;
