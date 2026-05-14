import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { UserWorkloadData } from '../types';
import { StatusBadge } from '../SharedComponents';
import { fetchReportData, computeUserWorkload } from '../../../../services/reportService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UserWorkloadTabProps {
    companyId: string;
    filters: any;
}

const UserWorkloadTab: React.FC<UserWorkloadTabProps> = ({ companyId, filters }) => {
    const [data, setData] = useState<UserWorkloadData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        setIsLoading(true);
        fetchReportData(companyId, filters?.branchIds)
            .then(raw => setData(computeUserWorkload(raw)))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [companyId, filters?.branchIds?.join(',')]);

    const getWorkloadStatus = (weekly: number) => {
        if (weekly > 50) return { status: 'red' as const, text: 'Overloaded' };
        if (weekly >= 30) return { status: 'green' as const, text: 'Balanced' };
        return { status: 'yellow' as const, text: 'Underutilized' };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
                <p className="text-sm text-gray-400">Sales rep workload comparison — ensure fair distribution and prevent burnout</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-64">
                <h3 className="text-sm font-bold text-gray-300 mb-4">Client Distribution by Rep</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.slice(0, 20)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="rep_code" stroke="#9CA3AF" fontSize={10} />
                        <YAxis stroke="#9CA3AF" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }} />
                        <Bar dataKey="total_clients" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex justify-center items-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading Workload...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800 border-b border-gray-700 text-xs uppercase font-medium text-gray-300">
                                <tr>
                                    <th className="px-6 py-4 text-left">Sales Rep</th>
                                    <th className="px-6 py-4 text-left">Clients</th>
                                    <th className="px-6 py-4 text-left">Weekly Visits</th>
                                    <th className="px-6 py-4 text-left">Avg/Day</th>
                                    <th className="px-6 py-4 text-left">Class (A/B/C)</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data.length === 0 && (
                                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No data available</td></tr>
                                )}
                                {data.map((row, i) => {
                                    const { status, text } = getWorkloadStatus(row.weekly_visits);
                                    return (
                                        <tr key={i} className="hover:bg-white/5 transition-colors text-sm">
                                            <td className="px-6 py-4 font-medium text-white">{row.rep_code}</td>
                                            <td className="px-6 py-4 text-gray-300">{row.total_clients}</td>
                                            <td className="px-6 py-4 text-gray-300">{row.weekly_visits}</td>
                                            <td className="px-6 py-4 text-gray-400">{row.avg_clients_per_day}</td>
                                            <td className="px-6 py-4 font-mono text-xs">
                                                <span className="text-emerald-500 font-bold">{row.a_class_count}</span> /
                                                <span className="text-yellow-500 font-bold"> {row.b_class_count}</span> /
                                                <span className="text-rose-500 font-bold"> {row.c_class_count}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={status} text={text} />
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

export default UserWorkloadTab;
