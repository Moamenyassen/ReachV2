import React from 'react';
import { LucideIcon, Info } from 'lucide-react';

interface RedFlagCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    type?: 'critical' | 'warning';
    size?: 'default' | 'compact';
    tooltip?: string;
    onClick?: () => void;
}

const RedFlagCard: React.FC<RedFlagCardProps> = ({
    title,
    value,
    icon: Icon,
    type = 'critical',
    size = 'default',
    tooltip,
    onClick
}) => {
    const isCritical = type === 'critical';
    const isCompact = size === 'compact';

    return (
        <div
            onClick={onClick}
            className={`
                flex items-center justify-between rounded-xl border relative group transition-all duration-300
                ${isCompact ? 'p-2' : 'p-3'}
                ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-95' : ''}
                ${isCritical
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-200 hover:bg-rose-500/20'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-200 hover:bg-amber-500/20'
                }
            `}
        >
            <div className="flex items-center gap-2">
                <div className={`
                    rounded-lg flex items-center justify-center
                    ${isCompact ? 'p-1.5' : 'p-2'}
                    ${isCritical ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}
                `}>
                    <Icon className={isCompact ? "w-3 h-3" : "w-4 h-4"} />
                </div>
                <span className={`font-bold uppercase tracking-wider opacity-90 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>{title}</span>
            </div>

            <span className={`
                font-black font-mono
                ${isCompact ? 'text-sm' : 'text-lg'}
                ${isCritical ? 'text-rose-400' : 'text-amber-400'}
            `}>
                {value}
            </span>

            {tooltip && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    <div className="absolute bottom-full mb-3 bg-slate-900/95 text-indigo-200 text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur-md border border-white/10 whitespace-nowrap">
                        {tooltip}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900/95" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default RedFlagCard;
