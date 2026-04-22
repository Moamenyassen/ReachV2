import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { WeeklyCoverageData } from '../types';
import { ColorIndicator } from '../SharedComponents';
import { fetchReportData, computeWeeklyCoverage } from '../../../../services/reportService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface WeeklyCoverageTabProps {
    companyId: string;
    filters: any;
}

const WeeklyCoverageTab: React.FC<WeeklyCoverageTabProps> = ({ companyId, filters }) => {
    const [data, setData] = useState<WeeklyCoverageData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        setIsLoading(true);
        fetchReportData(companyId, filters?.branchIds)
            .then(raw => setData(computeWeeklyCoverage(raw)))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [companyId, filters?.branchIds?.join(',')]);

    const fullCoverage    = data.filter(d => d.weeks_covered === 4).length;
    const partialCoverage = data.filter(d => d.weeks_covered >= 1 && d.weeks_covered < 4).length;
    const noCoverage      = data.filter(d => d.weeks_covered === 0).length;

    const pieData = [
        { name: 'Full (4 Wks)',     value: fullCoverage },
        { name: 'Partial (1-3 Wks)', value: partialCoverage },
        { name: 'None (0 Wks)',      value: noCoverage },
    ];
    const COLORS = ['#10B981', '#F59E0B', '#EF4444'];

    const getStatus = (weeks: number) => weeks === 4 ? 'green' : weeks >= 2 ? 'yellow' : 'red';
    const getIssue  = (d: WeeklyCoverageData) => {
        if (d.weeks_covered === 0) return 'Missing all weeks';
        if (d.weeks_covered === 1) return 'Single week only';
        if (d.weeks_covered === 3) return 'Missing one week';
        return 'Inconsistent schedule';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
                <p className="text-sm text-gray-400">Identify scheduling gaps — ensure consistent weekly client service</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-64 flex flex-col items-center justify-center">
                    <h4 className="text-gray-300 text-sm font-bold mb-2">Coverage Distribution</h4>
                    <ResponsiveContainer width="100%" height="80%">
                        <PieChart>
                            <Pie data={pieData} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                                {pieData.map((_, idx) => (
                                    <Cell key={idx} fill={COLORS[idx]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff', borderRadius: '8px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Full</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400" /> Partial</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400" /> None</span>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                    {isLoading ? (
                        <div className="p-12 flex justify-center items-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading...</div>
                    ) : (
                        <div className="overflow-auto h-64">
                            <table className="w-full relative">
                                <thead className="bg-gray-800 border-b border-gray-700 text-xs uppercase font-medium text-gray-300 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Client</th>
                                        <th className="px-2 py-4 text-center">W1</th>
                                        <th className="px-2 py-4 text-center">W2</th>
                                        <th className="px-2 py-4 text-center">W3</th>
                                        <th className="px-2 py-4 text-center">W4</th>
                                        <th className="px-6 py-4 text-center">Coverage</th>
                                        <th className="px-6 py-4 text-left">Issue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {data.length === 0 && (
                                        <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No data available</td></tr>
                                    )}
                                    {data.map((row, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors text-sm">
                                            <td className="px-6 py-3">
                                                <div className="text-white font-medium">{row.client_name}</div>
                                                <div className="text-xs text-gray-500">{row.client_code}</div>
                                            </td>
                                            {[row.week_1_covered, row.week_2_covered, row.week_3_covered, row.week_4_covered].map((covered, wi) => (
                                                <td key={wi} className="px-2 py-3 text-center">
                                                    {covered
                                                        ? <Check size={14} className="text-emerald-500 mx-auto" />
                                                        : <div className="w-1 h-1 bg-gray-700 rounded-full mx-auto" />}
                                                </td>
                                            ))}
                                            <td className="px-6 py-3 flex justify-center">
                                                <ColorIndicator value={`${row.coverage_percent}%`} status={getStatus(row.weeks_covered)} />
                                            </td>
                                            <td className="px-6 py-3 text-gray-400 text-xs">{getIssue(row)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WeeklyCoverageTab;
