import React, { ReactNode } from 'react';

// --- SUMMARY CARD ---
interface SummaryCardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    subValue?: string;
    color?: string; // Optional color override for value
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, subValue, color }) => {
    return (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 shadow-sm hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-400 font-medium">{title}</p>
                    <p className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
                    {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
                </div>
                <div className="p-2 bg-gray-800 rounded-lg text-blue-400">
                    {icon}
                </div>
            </div>
        </div>
    );
};

// --- COLOR INDICATOR ---
interface ColorIndicatorProps {
    value: string | number | ReactNode;
    status: 'green' | 'yellow' | 'red' | 'gray';
}

export const ColorIndicator: React.FC<ColorIndicatorProps> = ({ value, status }) => {
    const bgColors = {
        green: 'bg-emerald-500',
        yellow: 'bg-yellow-500',
        red: 'bg-rose-500',
        gray: 'bg-gray-500'
    };

    return (
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${bgColors[status]}`} />
            <span className="text-gray-300">{value}</span>
        </div>
    );
};

// --- STATUS BADGE ---
export const StatusBadge: React.FC<{ status: 'green' | 'yellow' | 'red'; text: string }> = ({ status, text }) => {
    const styles = {
        green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        red: 'bg-rose-500/10 text-rose-500 border-rose-500/20'
    };

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border ${styles[status]}`}>
            {text}
        </span>
    );
};
