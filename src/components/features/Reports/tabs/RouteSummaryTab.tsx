import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { ColorIndicator } from '../SharedComponents';
import { computeRouteSummary } from '../../../../services/reportService';

interface Props {
    companyId: string;
    filters: any;
    data: any[];
    loading: boolean;
    error: string | null;
}

const RouteSummaryTab: React.FC<Props> = ({ data, loading, error }) => {
    const rows = useMemo(() => computeRouteSummary(data), [data]);

    const getClassAStatus  = (p: number) => p >= 50 ? 'green' : p >= 30 ? 'yellow' : 'red';
    const getLocationStatus = (p: number) => p >= 90 ? 'green' : p >= 70 ? 'yellow' : 'red';
    const getClientStatus  = (c: number) => c > 100 ? 'green' : c >= 50 ? 'yellow' : 'red';
    const getWeeklyStatus  = (w: number) => w >= 4 ? 'green' : w >= 3 ? 'yellow' : 'red';
    const getDailyStatus   = (d: number) => d > 5 ? 'green' : d >= 3 ? 'yellow' : 'red';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
                <p className="text-sm text-gray-400">Quick performance overview with color-coded KPIs</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center items-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800 border-b border-gray-700 text-xs uppercase font-medium text-gray-300">
                                <tr>
                                    <th className="px-6 py-4 text-left">Route</th>
                                    <th className="px-6 py-4 text-left">Clients</th>
                                    <th className="px-6 py-4 text-left">Class A %</th>
                                    <th className="px-6 py-4 text-left">GPS %</th>
                                    <th className="px-6 py-4 text-left">Weeks</th>
                                    <th className="px-6 py-4 text-left">Days</th>
                                    <th className="px-6 py-4 text-left">Reps</th>
                                    <th className="px-6 py-4 text-left">Visits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {rows.length === 0 && (
                                    <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                        {error ? <span className="text-red-400">{error}</span> : 'No data available'}
                                    </td></tr>
                                )}
                                {rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors text-sm">
                                        <td className="px-6 py-4">
                                            <div className="text-white font-medium">{row.route_name}</div>
                                            <div className="text-xs text-gray-500">{row.branch_name}</div>
                                        </td>
                                        <td className="px-6 py-4"><ColorIndicator value={row.total_clients} status={getClientStatus(row.total_clients)} /></td>
                                        <td className="px-6 py-4"><ColorIndicator value={`${row.class_a_pct}%`} status={getClassAStatus(row.class_a_pct)} /></td>
                                        <td className="px-6 py-4"><ColorIndicator value={`${row.location_coverage_pct}%`} status={getLocationStatus(row.location_coverage_pct)} /></td>
                                        <td className="px-6 py-4"><ColorIndicator value={`${row.weeks_active}`} status={getWeeklyStatus(row.weeks_active)} /></td>
                                        <td className="px-6 py-4"><ColorIndicator value={`${row.days_active}`} status={getDailyStatus(row.days_active)} /></td>
                                        <td className="px-6 py-4 text-gray-400">{row.sales_reps_count}</td>
                                        <td className="px-6 py-4 text-gray-400 font-mono">{row.total_planned_visits}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RouteSummaryTab;
