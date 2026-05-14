import React from 'react';
import { OptimizationSuggestion } from '../../../types/optimizer';
import { Users, Calendar, Shuffle, ArrowRight, Lightbulb, User, Route } from 'lucide-react';

interface SuggestionsListProps {
    suggestions: OptimizationSuggestion[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}

const SuggestionsList: React.FC<SuggestionsListProps> = ({ suggestions, selectedId, onSelect }) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/95 sticky top-0 z-10 backdrop-blur-sm">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Suggestions ({suggestions.length})
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                    Ranked by highest efficiency impact
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {suggestions.length === 0 && (
                    <div className="text-center py-10 text-gray-500 text-sm">
                        No optimization opportunities found for current filters.
                    </div>
                )}

                {suggestions.map((suggestion, idx) => {
                    const isSelected = selectedId === suggestion.id;
                    return (
                        <div
                            key={suggestion.id}
                            onClick={() => onSelect(suggestion.id)}
                            className={`
                group rounded-xl border p-4 cursor-pointer transition-all duration-200 relative overflow-hidden
                ${isSelected
                                    ? 'bg-blue-900/10 border-blue-500/50 ring-1 ring-blue-500/20 shadow-lg shadow-blue-900/20'
                                    : 'bg-gray-800/30 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'}
              `}
                        >
                            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}

                            {/* Header Badge */}
                            <div className="flex items-center justify-between mb-3">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase font-bold rounded-md tracking-wider border
                    ${suggestion.type === 'USER_SWAP'
                                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                        suggestion.type === 'DAY_SWAP'
                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                    {suggestion.type === 'USER_SWAP' ? <Users size={10} /> :
                                        suggestion.type === 'DAY_SWAP' ? <Calendar size={10} /> :
                                            <Shuffle size={10} />}
                                    {suggestion.type === 'USER_SWAP' ? 'User Swap' :
                                        suggestion.type === 'DAY_SWAP' ? 'Day Swap' :
                                            'User + Day'}
                                </span>
                                <span className="text-[10px] font-mono text-gray-600 group-hover:text-gray-500 transition-colors">#{idx + 1}</span>
                            </div>

                            {/* Client Info */}
                            <div className="mb-3">
                                <div className="text-sm font-bold text-white mb-0.5 truncate pr-2">
                                    {suggestion.clientName}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
                                    <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 border border-gray-700">
                                        {suggestion.clientCode}
                                    </span>
                                    <span>•</span>
                                    <span>{suggestion.district || 'Unknown District'}</span>
                                </div>
                            </div>

                            {/* Swap Logistics */}
                            <div className="bg-black/20 rounded-lg p-2.5 mb-3 border border-gray-800/50">
                                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                                    {/* FROM */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1 text-[9px] text-gray-500 uppercase font-bold mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> From
                                        </div>
                                        <div className="text-xs text-gray-300 font-medium truncate flex items-center gap-1.5">
                                            <User size={10} className="text-gray-500" />
                                            {suggestion.from.userCode}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate pl-4">
                                            {suggestion.from.day}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center">
                                        <ArrowRight className="text-gray-600" size={14} />
                                    </div>

                                    {/* TO */}
                                    <div className="min-w-0 text-right">
                                        <div className="flex items-center gap-1 text-[9px] text-gray-500 uppercase font-bold mb-1 justify-end">
                                            To <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        </div>
                                        <div className="text-xs text-green-300 font-medium truncate flex items-center justify-end gap-1.5">
                                            {suggestion.to.userCode}
                                            <User size={10} className="text-green-500/50" />
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate pr-4">
                                            {suggestion.to.day}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="text-center p-1.5 bg-green-900/10 rounded border border-green-500/10">
                                    <div className="text-[9px] text-green-500/70 font-bold uppercase">Save</div>
                                    <div className="text-xs font-bold text-green-400">
                                        {suggestion.impact.distanceSaved.toFixed(1)} <span className="text-[9px]">km</span>
                                    </div>
                                </div>
                                <div className="text-center p-1.5 bg-blue-900/10 rounded border border-blue-500/10">
                                    <div className="text-[9px] text-blue-500/70 font-bold uppercase">Time</div>
                                    <div className="text-xs font-bold text-blue-400">
                                        {Math.round(suggestion.impact.timeSaved)} <span className="text-[9px]">min</span>
                                    </div>
                                </div>
                                <div className="text-center p-1.5 bg-orange-900/10 rounded border border-orange-500/10">
                                    <div className="text-[9px] text-orange-500/70 font-bold uppercase">Score</div>
                                    <div className="text-xs font-bold text-orange-400">
                                        {suggestion.impact.impactScore}
                                    </div>
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="text-[10px] text-gray-400 bg-gray-800/50 rounded px-2.5 py-2 border border-gray-700/50 flex items-start gap-2">
                                <Lightbulb size={12} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                                <span className="leading-snug">{suggestion.reason}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SuggestionsList;
