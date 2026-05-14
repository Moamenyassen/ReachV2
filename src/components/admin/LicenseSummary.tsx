import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
    ShieldCheck, Users, MapPin, Navigation, 
    ArrowLeft, Zap, Info, AlertTriangle, CheckCircle2,
    TrendingUp, ShieldAlert, CreditCard, Loader2
} from 'lucide-react';
import { User, Customer, Company, ViewMode } from '../../types';
import { getLicenseUsageStats } from '../../services/supabase';

interface LicenseSummaryProps {
    currentUser: User;
    currentCompany: Company | null;
    users: User[];
    allCustomers: Customer[];
    availableRoutes: string[];
    onNavigate: (view: ViewMode) => void;
    isDarkMode: boolean;
    language: 'en' | 'ar';
}

const LicenseSummary: React.FC<LicenseSummaryProps> = ({
    currentUser, currentCompany, users, allCustomers, availableRoutes,
    onNavigate, isDarkMode, language
}) => {
    const isRtl = language === 'ar';
    const [dbStats, setDbStats] = React.useState<{ customers: number, routes: number } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (currentCompany?.id) {
            setIsLoading(true);
            getLicenseUsageStats(currentCompany.id).then(stats => {
                setDbStats(stats);
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [currentCompany?.id]);

    // Calculate usage stats
    const stats = useMemo(() => {
        const caps = {
            users: currentCompany?.maxUsers || 5,
            customers: currentCompany?.maxCustomers || 1000,
            routes: currentCompany?.maxRoutes || 20
        };

        const usage = {
            users: users.length,
            customers: dbStats?.customers ?? allCustomers.length,
            routes: dbStats?.routes ?? availableRoutes.length
        };

        const getStatus = (used: number, total: number) => {
            const ratio = used / total;
            if (ratio >= 0.95) return 'critical';
            if (ratio >= 0.8) return 'warning';
            return 'healthy';
        };

        return [
            {
                id: 'users',
                label: isRtl ? 'تراخيص المستخدمين' : 'User Licenses',
                icon: Users,
                used: usage.users,
                total: caps.users,
                percentage: Math.round((usage.users / caps.users) * 100),
                status: getStatus(usage.users, caps.users),
                color: 'from-blue-500 to-indigo-600',
                details: isRtl ? 'المستخدمين النشطين في المؤسسة' : 'Active organizational members'
            },
            {
                id: 'customers',
                label: isRtl ? 'قاعدة بيانات العملاء' : 'Customer Database',
                icon: MapPin,
                used: usage.customers,
                total: caps.customers,
                percentage: Math.round((usage.customers / caps.customers) * 100),
                status: getStatus(usage.customers, caps.customers),
                color: 'from-cyan-500 to-blue-600',
                details: isRtl ? 'إجمالي العملاء المخصصين' : 'Total assigned accounts'
            },
            {
                id: 'routes',
                label: isRtl ? 'مسارات التوزيع' : 'Distribution Routes',
                icon: Navigation,
                used: usage.routes,
                total: caps.routes,
                percentage: Math.round((usage.routes / caps.routes) * 100),
                status: getStatus(usage.routes, caps.routes),
                color: 'from-indigo-500 to-purple-600',
                details: isRtl ? 'المسارات النشطة حالياً' : 'Currently active paths'
            }
        ];
    }, [currentCompany, users, allCustomers, availableRoutes, isRtl]);

    const overallHealth = stats.every(s => s.status === 'healthy') ? 'Elite' : stats.some(s => s.status === 'critical') ? 'High Risk' : 'Capacity Warning';

    return (
        <div className={`flex-1 flex flex-col p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <button 
                        onClick={() => onNavigate(ViewMode.DASHBOARD)}
                        className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4 font-bold text-xs uppercase tracking-widest"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        {isRtl ? 'العودة للرئيسية' : 'Back to Workspace'}
                    </button>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2">
                        {isRtl ? 'ملخص التراخيص' : 'License Intelligence'}
                    </h1>
                    <p className="text-muted-foreground font-medium text-lg max-w-2xl">
                        {isRtl 
                            ? 'إدارة مراقبة الموارد والحدود التشغيلية لمؤسستك في الوقت الفعلي.' 
                            : 'Real-time monitoring of resource allocation and operational boundaries for your organization.'}
                    </p>
                </div>

                <div className={`px-6 py-4 rounded-3xl border flex items-center gap-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${overallHealth === 'Elite' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {overallHealth === 'Elite' ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-0.5">Deployment Health</p>
                        <p className="text-xl font-black tracking-tight">{overallHealth}</p>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full mb-6"
                    />
                    <p className="text-xl font-bold opacity-50">Synchronizing License Intelligence...</p>
                    <p className="text-sm opacity-30 mt-2">Connecting to organizational data nodes</p>
                </div>
            ) : (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {stats.map((stat, idx) => (
                            <motion.div
                                key={stat.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`group relative p-8 rounded-3xl border transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-slate-900/40 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg shadow-indigo-500/20`}>
                                        <stat.icon className="w-7 h-7" />
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        stat.status === 'critical' ? 'bg-red-500/10 text-red-500' : 
                                        stat.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                                        'bg-emerald-500/10 text-emerald-500'
                                    }`}>
                                        {stat.percentage}% Used
                                    </div>
                                </div>

                                <h3 className="text-2xl font-black mb-1">{stat.label}</h3>
                                <p className="text-sm text-muted-foreground font-medium mb-6">{stat.details}</p>

                                <div className="space-y-4">
                                    <div className="flex items-end justify-between font-mono">
                                        <span className="text-3xl font-black tracking-tight">{stat.used}</span>
                                        <span className="text-slate-500 font-bold mb-1">/ {stat.total}</span>
                                    </div>
                                    <div className="h-3 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${stat.percentage}%` }}
                                            transition={{ duration: 1, delay: idx * 0.1 + 0.3 }}
                                            className={`h-full rounded-full bg-gradient-to-r ${stat.color}`}
                                        />
                                    </div>
                                </div>

                                {stat.status !== 'healthy' && (
                                    <div className="mt-6 flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-500">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Capacity Warning: Upgrade Recommended</span>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* Detailed Info Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className={`p-8 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <h4 className="text-xl font-bold">Plan Efficiency</h4>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5">
                                    <div>
                                        <p className="text-xs font-black uppercase text-muted-foreground mb-1">Subscription Tier</p>
                                        <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
                                            {currentCompany?.subscriptionTier || 'PROFESSIONAL'}
                                        </p>
                                    </div>
                                    <Zap className="w-6 h-6 text-yellow-400" />
                                </div>

                                <div className="p-4 rounded-xl border border-white/5 bg-white/5 space-y-3">
                                    <div className="flex items-center gap-3 text-xs font-medium opacity-80">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        AI Route Sequencing Protocol: Active
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-medium opacity-80">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        High-Density Scanner API: 15,000 requests/mo
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-medium opacity-80">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        Multi-Region Management: Enabled
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`p-8 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-indigo-600/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                            <div>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-xl font-bold">Scaling Required?</h4>
                                </div>
                                <p className="text-muted-foreground font-medium mb-8">
                                    Need to expand your team or customer portfolio? Our Elite plans offer unlimited capacity and enterprise-grade support.
                                </p>
                            </div>

                            <button 
                                onClick={() => onNavigate(ViewMode.PRICING)}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/25 active:scale-95"
                            >
                                Explore Upgrade Options
                            </button>
                        </div>
                    </div>

                    {/* Footer Tip */}
                    <div className="mt-12 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">
                        <Info className="w-4 h-4" />
                        Limits are refreshed daily at 00:00 UTC. Contact support for temporary limit increases.
                    </div>
                </>
            )}
        </div>
    );
};

export default LicenseSummary;
