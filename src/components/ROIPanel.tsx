import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight, DollarSign, Clock } from 'lucide-react';
import { formatPrice } from '../utils/currency';

interface ROIPanelProps {
    userCount: number;
}

const ROIPanel: React.FC<ROIPanelProps> = ({ userCount }) => {
    // Assumptions for ROI Calculation
    const tripsPerUser = 15; // daily
    const costPerTrip = 25; // SAR
    const efficiencyGain = 0.22; // 22%

    // Monthly Calculations
    const monthlyTrips = userCount * tripsPerUser * 22; // 22 working days
    const currentCost = monthlyTrips * costPerTrip;

    // Optimized
    const optimizedTrips = monthlyTrips; // Same trips, but less cost? No, usually less distance/time.
    // Let's say cost reduction
    const savings = currentCost * efficiencyGain;
    const optimizedCost = currentCost - savings;

    const data = [
        { name: 'Before', cost: currentCost, color: '#334155' }, // Slate 700
        { name: 'With Reach', cost: optimizedCost, color: '#06b6d4' }, // Cyan 500
    ];

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 w-full min-h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                            dy={10}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl">
                                            <p className="text-white font-bold text-xs">{formatPrice(payload[0].value as number, 'SA').value}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="cost" radius={[8, 8, 0, 0]} barSize={60} animationDuration={1500}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Monthly Savings</p>
                            <p className="text-lg font-black text-white leading-none mt-1">
                                {formatPrice(savings, 'SA').value}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-3 bg-brand-primary/10 rounded-xl border border-brand-primary/20 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] text-brand-primary font-bold uppercase mb-0.5">Efficiency Boost</p>
                        <p className="text-xs text-slate-300 leading-tight">
                            Save approx. <span className="text-white font-bold">{Math.round(userCount * 22 * 1.5)} hours</span> per month with optimized route planning.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ROIPanel;
