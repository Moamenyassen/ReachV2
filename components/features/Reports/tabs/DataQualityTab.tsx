import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DataQualityData } from '../types';
import { ColorIndicator } from '../SharedComponents';
import { fetchReportData, computeDataQuality } from '../../../../services/reportService';

interface DataQualityTabProps {
    companyId: string;
    filters: any;
}

const DataQualityTab: React.FC<DataQualityTabProps> = ({ companyId, filters }) => {
    const [data, setData] = useState<DataQualityData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        setIsLoading(true);
        fetchReportData(companyId, filters?.branchIds)
            .then(raw => {
                let rows = computeDataQuality(raw);
                if (filters?.region && filters.region !== 'All') {
                    rows = rows.filter(r => r.branch_name === filters.region);
                }
                setData(rows);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [companyId, filters?.region, filters?.branchIds?.join(',')]);

    const getQualityStatus = (score: number) => score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red';

    const totalRecords = data.reduce((s, r) => s + r.total_records, 0);
    const calcWtdAvg = (key: keyof DataQualityData) => {
        if (!totalRecords) return 0;
        return Math.round(data.reduce((s, r) => s + (r[key] as number) * r.total_records, 0) / totalRecords);
    };

    const processedData = data.map(row => ({
        ...row,
        score: Math.round((row.gps_coverage + row.phone_coverage + row.classification_coverage +
            row.store_type_coverage + row.schedule_coverage + row.vat_coverage) / 6),
    }));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
                <p className="text-sm text-gray-400">Data completeness monitoring — identify and fix missing critical information</p>
            </div>

            {totalRecords > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-gray-900 p-4 rounded-lg border border-gray-800 text-xs text-gray-400">
                    {[
                        { label: 'Missing GPS',   val: Math.round(totalRecords * (100 - calcWtdAvg('gps_coverage')) / 100) },
                        { label: 'Missing Phone', val: Math.round(totalRecords * (100 - calcWtdAvg('phone_coverage')) / 100) },
                        { label: 'Missing Class', val: Math.round(totalRecords * (100 - calcWtdAvg('classification_coverage')) / 100) },
                        { label: 'Missing Type',  val: Math.round(totalRecords * (100 - calcWtdAvg('store_type_coverage')) / 100) },
                        { label: 'Missing Sched', val: Math.round(totalRecords * (100 - calcWtdAvg('schedule_coverage')) / 100) },
                        { label: 'Missing VAT',   val: Math.round(totalRecords * (100 - calcWtdAvg('vat_coverage')) / 100) },
                    ].map(({ label, val }) => (
                        <div key={label} className="flex flex-col gap-1 items-center p-2 bg-gray-800 rounded">
                            <span>{label}</span>
                            <span className="text-white font-bold">{val}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                {isLoading ? (
                    <div className="p-12 flex justify-center items-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading Quality...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800 border-b border-gray-700 text-xs uppercase font-medium text-gray-300">
                                <tr>
                                    <th className="px-6 py-4 text-left">Route</th>
                                    <th className="px-6 py-4 text-left">Records</th>
                                    <th className="px-6 py-4 text-left">GPS %</th>
                                    <th className="px-6 py-4 text-left">Phone %</th>
                                    <th className="px-6 py-4 text-left">Class %</th>
                                    <th className="px-6 py-4 text-left">Type %</th>
                                    <th className="px-6 py-4 text-left">Sched %</th>
                                    <th className="px-6 py-4 text-left">Overall %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {processedData.length === 0 && (
                                    <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No data available</td></tr>
                                )}
                                {processedData.map((row, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors text-sm">
                                        <td className="px-6 py-4">
                                            <div className="text-white font-medium">{row.route_name}</div>
                                            <div className="text-xs text-gray-500">{row.branch_name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{row.total_records}</td>
                                        <td className="px-6 py-4 text-gray-400">{row.gps_coverage}%</td>
                                        <td className="px-6 py-4 text-gray-400">{row.phone_coverage}%</td>
                                        <td className="px-6 py-4 text-gray-400">{row.classification_coverage}%</td>
                                        <td className="px-6 py-4 text-gray-400">{row.store_type_coverage}%</td>
                                        <td className="px-6 py-4 text-gray-400">{row.schedule_coverage}%</td>
                                        <td className="px-6 py-4">
                                            <ColorIndicator value={`${row.score}%`} status={getQualityStatus(row.score)} />
                                        </td>
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

export default DataQualityTab;
