import React from 'react';
import {
    Users,
    Ticket,
    LayoutDashboard,
    Zap,
    LogOut,
    Layers,
    UserCog,
    Megaphone,
    ShieldCheck
} from 'lucide-react';

interface SysAdminSidebarProps {
    currentView: string;
    onViewChange: (view: any) => void;
    onLogout: () => void;
}

const SysAdminSidebar: React.FC<SysAdminSidebarProps> = ({ currentView, onViewChange, onLogout }) => {

    const menuItems = [
        { id: 'CUSTOMERS', label: 'Customers', icon: Users, color: 'text-indigo-400' },
        { id: 'LEADS', label: 'Reach Leads', icon: Zap, color: 'text-pink-400' },
        { id: 'LICENSE_REQUESTS', label: 'License Management', icon: ShieldCheck, color: 'text-orange-400' }, // New Screen
        { id: 'USERS', label: 'Reach Users', icon: UserCog, color: 'text-cyan-400' },
        { id: 'AFFILIATES', label: 'Affiliates', icon: Megaphone, color: 'text-yellow-400' },
        { id: 'PROMOS', label: 'Promos', icon: Ticket, color: 'text-emerald-400' },
        { id: 'PLANS', label: 'Plans', icon: Layers, color: 'text-blue-400' },
    ];

    return (
        <div className="w-64 bg-[#0f172a] border-r border-white/5 flex flex-col h-full fixed left-0 top-0 bottom-0 z-20">
            {/* Logo Area */}
            <div className="p-6 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-white tracking-tight">SysAdmin</h1>
                        <p className="text-xs text-slate-500">Reach Portal v2.0</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
                <div className="text-xs font-bold text-slate-500 uppercase px-3 mb-2 tracking-wider">Management</div>
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-white/10 text-white shadow-lg border border-white/5'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? item.color : 'text-slate-500 group-hover:text-white transition-colors'}`} />
                            <span className="font-medium text-sm">{item.label}</span>
                            {isActive && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${item.color.replace('text-', 'bg-')}`} />}
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/5 bg-black/20">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm font-bold border border-red-500/20"
                >
                    <LogOut className="w-4 h-4" /> Sign Out
                </button>
            </div>
        </div>
    );
};

export default SysAdminSidebar;
