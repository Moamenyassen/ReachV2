import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RouteEfficiencyData } from '../types';
import { fetchReportData, computeRouteEfficiency } from '../../../../services/reportService';

interface RouteEfficiencyTabProps {
    companyId: string;
    filters: any;
}

const RouteEfficiencyTab: React.FC<RouteEfficiencyTabProps> = ({ companyId, filters }) => {
    const [data, setData] = useState<RouteEfficiencyData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        setIsLoading(true);
        fetchReportData(companyId, filters?.branchIds)
            .then(raw => {
                let rows = computeRouteEfficiency(raw);
                if (filters?.region && filters.region !== 'All') {
                    rows = rows.filter(r => r.branch_name === filters.region);
                }
                setData(rows);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [companyId, filters?.region, filters?.branchIds?.join(',')]);

    const getEfficiencyScore = (avgPerDay: number) => {
        const totalMins = avgPerDay * 25;
        if (totalMins === 0) return 0;
        const ideal = 480;
        const score = totalMins <= ideal ? (totalMins / ideal) * 100 : (ideal / totalMins) * 100;
        return Math.min(100, Math.round(score));
    };

    const getFlag = (score: number, avgPerDay: number) => {
        const totalMins = avgPerDay * 25;
        if (score >= 85) return 'Optimized';
        if (totalMins < 400) return 'Under-utilized';
        if (totalMins > 520) return 'Over-utilized';
        return 'Needs Balancing';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
                <p className="text-sm text-gray-400">Route optimization insights — identify underutilized routes and geographic inefficiencies</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex justify-center items-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading Efficiency...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800 border-b border-gray-700 text-xs uppercase font-medium text-gray-300">
                                <tr>
                                    <th className="px-6 py-4 text-left">Route</th>
                                    <th className="px-6 py-4 text-left">Branch</th>
                                    <th className="px-6 py-4 text-left">Clients</th>
                                    <th className="px-6 py-4 text-left">Avg/Day</th>
                                    <th className="px-6 py-4 text-left">Districts</th>
                                    <th className="px-6 py-4 text-left">Efficiency %</th>
                                    <th className="px-6 py-4 text-left">Users</th>
                                    <th className="px-6 py-4 text-left">Optimization</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data.length === 0 && (
                                    <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No data available</td></tr>
                                )}
                                {data.map((row, i) => {
                                    const score = getEfficiencyScore(row.avg_clients_per_day);
                                    const flag = getFlag(score, row.avg_clients_per_day);
                                    const color = score >= 85 ? 'bg-emerald-500' : score >= 60 ? 'bg-yellow-500' : 'bg-rose-500';
                                    return (
                                        <tr key={i} className="hover:bg-white/5 transition-colors text-sm">
                                            <td className="px-6 py-4 font-medium text-white">{row.route_name}</td>
                                            <td className="px-6 py-4 text-gray-400">{row.branch_name}</td>
                                            <td className="px-6 py-4 text-gray-300">{row.total_clients}</td>
                                            <td className="px-6 py-4 text-gray-400">{row.avg_clients_per_day}</td>
                                            <td className="px-6 py-4 text-gray-400">{row.districts_covered}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                                                        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
                                                    </div>
                                                    <span className="text-gray-300 font-mono text-xs">{score}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">{row.users_assigned}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs ${flag === 'Optimized' ? 'text-emerald-500' : 'text-blue-400'}`}>{flag}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RouteEfficiencyTab;
