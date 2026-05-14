import React, { useState, useEffect } from 'react';
import {
    Building2, Users, Zap, TrendingUp, Activity,
    Shield, Clock, ArrowUpRight, Plus, RefreshCw,
    CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import {
    getAllCompanies,
    getLicenseRequests,
    getGlobalReachLeads,
} from '../../../services/supabase';
import {
    PageHeader, StatCard, SysCard, BTN,
} from './SysAdminShared';

interface SysAdminOverviewProps {
    onNavigate: (tab: string) => void;
}

const SysAdminOverview: React.FC<SysAdminOverviewProps> = ({ onNavigate }) => {
    const [totalCompanies, setTotalCompanies]   = useState(0);
    const [activeCompanies, setActiveCompanies] = useState(0);
    const [totalLeads, setTotalLeads]           = useState(0);
    const [pendingLicenses, setPendingLicenses] = useState(0);
    const [totalRevenue, setTotalRevenue]       = useState(0);
    const [activeUsers, setActiveUsers]         = useState(0);
    const [loading, setLoading]                 = useState(true);
    const [lastRefresh, setLastRefresh]         = useState(new Date());
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error' | 'checking'>('checking');

    const loadStats = async () => {
        setLoading(true);
        setConnectionStatus('checking');
        try {
            const [companies, licenses, leadsResult] = await Promise.all([
                getAllCompanies(),
                getLicenseRequests(),
                getGlobalReachLeads(1, 1),
            ]);

            const active = companies.filter((c: any) => c.isActive);
            const pending = licenses.filter((l: any) => l.status !== 'APPROVED');
            const mrr = active.reduce((sum: number, c: any) => {
                const price = c.subscriptionTier === 'ENTERPRISE' ? 299
                    : c.subscriptionTier === 'PROFESSIONAL' ? 99 : 29;
                return sum + price * (c.maxUsers || 1);
            }, 0);

            setTotalCompanies(companies.length);
            setActiveCompanies(active.length);
            setTotalLeads((leadsResult as any)?.count ?? 0);
            setPendingLicenses(pending.length);
            setTotalRevenue(mrr);
            setActiveUsers(active.reduce((s: number, c: any) => s + (c.maxUsers || 0), 0));
            setConnectionStatus('connected');
            setLastRefresh(new Date());
        } catch {
            setConnectionStatus('error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const statusBadge = (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
            connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : connectionStatus === 'error'   ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
            {connectionStatus === 'connected' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {connectionStatus === 'error'     && <AlertCircle  className="w-3.5 h-3.5" />}
            {connectionStatus === 'checking'  && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {connectionStatus === 'connected' ? 'Connected'
             : connectionStatus === 'error'   ? 'Connection Error'
             : 'Checking…'}
        </div>
    );

    const refreshBtn = (
        <button
            onClick={loadStats}
            disabled={loading}
            className={BTN.secondary + ' disabled:opacity-40'}
        >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
        </button>
    );

    const healthDot = (ok: boolean) => (
        <div className={`w-3 h-3 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
    );
    const isOk = connectionStatus === 'connected';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                icon={<Activity className="w-5 h-5" />}
                title="Control Center"
                subtitle="System overview and quick actions"
                actions={<>{statusBadge}{refreshBtn}</>}
            />

            <div className="flex items-center gap-2 text-xs text-slate-600 -mt-4">
                <Clock className="w-3.5 h-3.5" />
                Last updated: {lastRefresh.toLocaleTimeString()}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                    icon={Building2}
                    label="Companies"
                    value={totalCompanies}
                    sub={`${activeCompanies} active`}
                    iconColor="text-indigo-400"
                    onClick={() => onNavigate('COMPANIES')}
                    loading={loading}
                />
                <StatCard
                    icon={Zap}
                    label="Global Leads"
                    value={totalLeads.toLocaleString()}
                    sub="Master database"
                    iconColor="text-cyan-400"
                    onClick={() => onNavigate('LEADS')}
                    loading={loading}
                />
                <StatCard
                    icon={Shield}
                    label="Pending Licenses"
                    value={pendingLicenses}
                    sub="Awaiting approval"
                    iconColor="text-emerald-400"
                    onClick={() => onNavigate('LICENSE_REQUESTS')}
                    loading={loading}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Est. MRR"
                    value={`${totalRevenue.toLocaleString()} ر.س`}
                    sub={`${activeUsers} total licensed users`}
                    iconColor="text-purple-400"
                    loading={loading}
                />
            </div>

            {/* Quick Actions */}
            <SysCard title="Quick Actions" titleIcon={<Zap className="w-4 h-4" />}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
                    {[
                        { icon: Plus,    label: 'Provision Company',       desc: 'Create a new tenant with admin access',    tab: 'COMPANIES',        color: 'text-indigo-400' },
                        { icon: Shield,  label: 'Process License Request', desc: 'Review and activate pending licenses',       tab: 'LICENSE_REQUESTS', color: 'text-emerald-400' },
                        { icon: Users,   label: 'Manage CRM Contacts',     desc: 'View and manage all customer contacts',      tab: 'REACH_CRM',        color: 'text-blue-400' },
                    ].map(({ icon: Icon, label, desc, tab, color }) => (
                        <button
                            key={tab}
                            onClick={() => onNavigate(tab)}
                            className="group flex items-center gap-4 p-5 bg-[#0f172a] hover:bg-white/5 transition-colors text-left"
                        >
                            <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 ${color} shrink-0`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white">{label}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
                        </button>
                    ))}
                </div>
            </SysCard>

            {/* System Health */}
            <SysCard title="System Health" titleIcon={<Activity className="w-4 h-4" />}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
                    {[
                        { label: 'Database',  sub: 'Supabase PostgreSQL', ok: isOk },
                        { label: 'Storage',   sub: isOk ? 'Active' : 'Unavailable', ok: isOk },
                        { label: 'Realtime',  sub: isOk ? 'Subscribed' : 'Disconnected', ok: isOk },
                    ].map(({ label, sub, ok }) => (
                        <div key={label} className="flex items-center gap-3 p-5 bg-[#0f172a]">
                            {healthDot(ok)}
                            <div>
                                <div className="text-sm font-bold text-white">{label}</div>
                                <div className="text-xs text-slate-500">{sub}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </SysCard>
        </div>
    );
};

export default SysAdminOverview;
