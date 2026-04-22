import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Building, Truck, User, Calendar, CalendarDays, Loader2 } from 'lucide-react';
import { computeHierarchy } from '../../../../services/reportService';

interface HierarchyTabProps {
    companyId: string;
    filters: any;
    data: any[];
    loading: boolean;
    error: string | null;
}

const HierarchyTab: React.FC<HierarchyTabProps> = ({ data, loading, error }) => {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const tree = useMemo(() => computeHierarchy(data), [data]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const getLevelStyle = (level: string) => {
        switch (level) {
            case 'BRANCH': return { bg: 'bg-gray-800', pl: 'pl-4', icon: Building, color: 'text-blue-400' };
            case 'ROUTE':  return { bg: 'bg-gray-850', pl: 'pl-10', icon: Truck, color: 'text-orange-400' };
            case 'USER':   return { bg: 'bg-gray-900', pl: 'pl-16', icon: User, color: 'text-purple-400' };
            case 'WEEK':   return { bg: 'bg-gray-900', pl: 'pl-20', icon: Calendar, color: 'text-green-400' };
            case 'DAY':    return { bg: 'bg-gray-950', pl: 'pl-24', icon: CalendarDays, color: 'text-gray-400' };
            default:       return { bg: 'bg-gray-900', pl: 'pl-4', icon: Building, color: 'text-gray-400' };
        }
    };

    const renderRow = (item: any): React.ReactNode => {
        const isExpanded = expandedIds.has(item.id);
        const hasChildren = item._children && item._children.length > 0;
        const style = getLevelStyle(item.level_type);
        const Icon = style.icon;
        const isLeaf = item.level_type === 'DAY';

        return (
            <React.Fragment key={item.id}>
                <tr
                    className={`${style.bg} border-b border-gray-800 hover:bg-white/5 transition-colors cursor-pointer text-sm`}
                    onClick={() => !isLeaf && toggleExpand(item.id)}
                >
                    <td className={`py-3 pr-4 text-left ${style.pl} flex items-center gap-3`}>
                        {!isLeaf ? (
                            isExpanded
                                ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
                                : <ChevronRight size={14} className="text-gray-500 shrink-0" />
                        ) : <span className="w-3.5 shrink-0" />}
                        <Icon size={16} className={`${style.color} shrink-0`} />
                        <span className="font-medium text-gray-200">{item.name}</span>
                        <span className="text-[10px] text-gray-600 uppercase tracking-wider ml-2 border border-gray-700 rounded px-1">{item.level_type}</span>
                    </td>
                    <td className="px-6 py-3 text-white font-mono">{item.total_clients}</td>
                    <td className="px-6 py-3 text-gray-400 font-mono text-xs">
                        <span className="text-emerald-500 font-bold">{item.class_a_count}</span> /
                        <span className="text-yellow-500 font-bold"> {item.class_b_count}</span> /
                        <span className="text-rose-500 font-bold"> {item.class_c_count}</span>
                    </td>
                    <td className="px-6 py-3 text-gray-400 font-mono text-xs">
                        {item.supermarkets_count + item.retail_count + item.hypermarkets_count + item.minimarkets_count}
                    </td>
                    <td className="px-6 py-3 text-blue-300 font-mono">{item.total_visits}</td>
                </tr>
                {isExpanded && hasChildren && item._children.map((child: any) => renderRow(child))}
            </React.Fragment>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 border-b border-gray-800 px-6 py-3">
                <p className="text-sm text-gray-400">
                    Drill down through Branch → Route → User → Week → Day with complete KPI aggregation at every level.
                </p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex justify-center items-center text-gray-500">
                        <Loader2 className="animate-spin mr-2" /> Loading Hierarchy...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800 border-b border-gray-700 text-xs uppercase font-medium text-gray-300">
                                <tr>
                                    <th className="px-6 py-4 text-left w-1/3">Hierarchy Level</th>
                                    <th className="px-6 py-4 text-left">Total Clients</th>
                                    <th className="px-6 py-4 text-left">Class (A/B/C)</th>
                                    <th className="px-6 py-4 text-left">Stores</th>
                                    <th className="px-6 py-4 text-left">Total Visits</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tree.length > 0 ? tree.map(renderRow) : (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        {error ? <span className="text-red-400">{error}</span> : 'No data available'}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HierarchyTab;
