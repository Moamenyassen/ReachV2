import React, { useState, useEffect } from 'react';
import { AlertCircle, Database, Loader2 } from 'lucide-react';
import { User, HistoryLog, Customer } from '../../../types';
import HierarchyTab from './tabs/HierarchyTab';
import RouteSummaryTab from './tabs/RouteSummaryTab';
import VisitFrequencyTab from './tabs/VisitFrequencyTab';
import RouteEfficiencyTab from './tabs/RouteEfficiencyTab';
import UserWorkloadTab from './tabs/UserWorkloadTab';
import DataQualityTab from './tabs/DataQualityTab';
import WeeklyCoverageTab from './tabs/WeeklyCoverageTab';
import FilterSection from './FilterSection';
import { ReportFilterState } from './types';
import { fetchReportData } from '../../../services/reportService';

interface DetailedReportsProps {
  currentUser?: User;
  allCustomers?: Customer[];
  uploadHistory?: HistoryLog[];
  onBack: () => void;
  isDarkMode: boolean;
  language: 'en' | 'ar';
  onToggleTheme: () => void;
  onToggleLang: () => void;
  hideHeader?: boolean;
  currentFilters?: {
    region?: string;
    route?: string;
    day?: string;
    week?: string;
  };
}

const DetailedReports: React.FC<DetailedReportsProps> = ({
  currentUser,
  currentFilters: initialFilters,
}) => {
  const isAdmin = !currentUser?.role || ['ADMIN', 'MANAGER', 'SYSADMIN'].includes(
    currentUser?.role?.toUpperCase?.() || ''
  );
  const userBranchIds = currentUser?.branchIds || [];

  const [activeTab, setActiveTab] = useState('tab1');
  const [filters, setFilters] = useState<ReportFilterState>({
    company_id: currentUser?.companyId || '',
    region: initialFilters?.region,
    branchIds: !isAdmin && userBranchIds.length > 0 ? userBranchIds : undefined,
  });

  // Shared data fetched once — each tab computes its own view
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filters.company_id) return;
    setLoading(true);
    setError(null);
    fetchReportData(filters.company_id, filters.branchIds)
      .then(data => setRawData(data))
      .catch(err => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [filters.company_id, filters.branchIds?.join(',')]);

  // Filter by region client-side (shared across tabs)
  const filteredData = React.useMemo(() => {
    if (!filters.region || filters.region === 'All') return rawData;
    return rawData.filter(r => r.branch === filters.region);
  }, [rawData, filters.region]);

  const tabs = [
    { id: 'tab1', label: 'Hierarchical View',  Component: HierarchyTab },
    { id: 'tab2', label: 'Route Summary',       Component: RouteSummaryTab },
    { id: 'tab3', label: 'Visit Frequency',     Component: VisitFrequencyTab },
    { id: 'tab4', label: 'Route Efficiency',    Component: RouteEfficiencyTab },
    { id: 'tab5', label: 'User Workload',       Component: UserWorkloadTab },
    { id: 'tab6', label: 'Data Quality',        Component: DataQualityTab },
    { id: 'tab7', label: 'Weekly Coverage',     Component: WeeklyCoverageTab },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col font-sans relative z-10 text-gray-100">
      <FilterSection
        filters={filters}
        onFilterChange={setFilters}
        onExport={() => {/* CSV export placeholder */}}
      />

      {/* Diagnostic bar */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-6 py-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1 text-gray-500">
          <Database size={12} />
          <span className="font-mono">{filters.company_id || 'no-company-id'}</span>
        </span>
        {loading && (
          <span className="flex items-center gap-1 text-cyan-400">
            <Loader2 size={12} className="animate-spin" /> Loading…
          </span>
        )}
        {!loading && !error && (
          <span className="text-gray-400">
            <span className="text-emerald-400 font-bold">{rawData.length}</span> rows loaded
            {filters.region && filters.region !== 'All' && (
              <> · <span className="text-cyan-400 font-bold">{filteredData.length}</span> after region filter</>
            )}
          </span>
        )}
        {error && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle size={12} /> {error}
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800 bg-gray-900 sticky top-0 z-20">
        <div className="px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-[1920px] mx-auto">
          {tabs.map(({ id, Component }) => {
            if (id !== activeTab) return null;
            return (
              <Component
                key={id}
                companyId={filters.company_id || ''}
                filters={filters}
                data={filteredData}
                loading={loading}
                error={error}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DetailedReports;
