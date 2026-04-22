import React, { useEffect, useState } from 'react';
import { Filter, Download } from 'lucide-react';
import { ReportFilterState } from './types';
import { fetchReportBranches } from '../../../services/reportService';

interface FilterSectionProps {
    filters: ReportFilterState;
    onFilterChange: (filters: ReportFilterState) => void;
    onExport: () => void;
    isLoading?: boolean;
}

const FilterSection: React.FC<FilterSectionProps> = ({ filters, onFilterChange, onExport, isLoading }) => {
    const [regions, setRegions] = useState<string[]>([]);

    useEffect(() => {
        if (!filters.company_id) return;
        fetchReportBranches(filters.company_id)
            .then(setRegions)
            .catch(console.error);
    }, [filters.company_id]);

    return (
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <Filter size={18} className="text-gray-400 shrink-0" />
                    <select
                        value={filters.region || 'All'}
                        onChange={e => onFilterChange({ ...filters, region: e.target.value === 'All' ? undefined : e.target.value })}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                    >
                        <option value="All">All Regions</option>
                        {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>

                <button
                    onClick={onExport}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download size={18} />
                    {isLoading ? 'Exporting...' : 'Export CSV'}
                </button>
            </div>
        </div>
    );
};

export default FilterSection;
