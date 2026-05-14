import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Company, RouteAssignment } from '../../../types';
import { TRANSLATIONS } from '../../../config/constants';
import {
    fetchUniqueRoutes,
    fetchRouteAssignments,
    assignUserToRoute,
    unassignRoute,
    getRouteMeta,
    fetchCompanyBranches,
    fetchCompanyRoutes,
    fetchCompanyRegions,
    fetchCompanyReps
} from '../../../services/supabase';
import {
    Users,
    UserPlus,
    Edit2,
    ShieldCheck,
    X,
    ChevronDown,
    Search,
    Filter,
    Shield,
    Key,
    UserCheck,
    UserX,
    LogIn,
    Download,
    Truck,
    LayoutDashboard,
    Map
} from 'lucide-react';

interface UserManagementProps {
    currentUser: User;
    userList: User[];
    currentCompany?: Company | null;
    onAddUser: (user: User) => void;
    onUpdateUser: (user: User) => void;
    onToggleUserStatus: (username: string) => void;
    onLoginAs: (user: User) => void;
    isDarkMode: boolean;
    language: 'en' | 'ar';
    onNavigate: (view: string) => void;
    hideHeader?: boolean;
}

type TabType = 'DASHBOARD' | 'FIELD' | 'ROUTES';

const UserManagement: React.FC<UserManagementProps> = ({
    currentUser,
    userList,
    currentCompany,
    onAddUser,
    onUpdateUser,
    onToggleUserStatus,
    onLoginAs,
    isDarkMode,
    language,
    onNavigate,
    hideHeader
}) => {
    const t = TRANSLATIONS[language];
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole>(UserRole.SUPERVISOR);
    const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
    const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
    const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
    const [isActive, setIsActive] = useState(true);

    // Data Source State
    const [availableRegions, setAvailableRegions] = useState<{ code: string; description: string }[]>([]);
    const [availableBranches, setAvailableBranches] = useState<string[]>([]);
    const [availableRoutes, setAvailableRoutes] = useState<{ routeName: string; userCode: string }[]>([]);
    const [availableReps, setAvailableReps] = useState<{ userCode: string; name: string }[]>([]);
    const [selectedRepCodes, setSelectedRepCodes] = useState<string[]>([]);

    const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const [isRouteDropdownOpen, setIsRouteDropdownOpen] = useState(false);
    const [isRepDropdownOpen, setIsRepDropdownOpen] = useState(false);

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: keyof User | 'lastActive'; direction: 'asc' | 'desc' } | null>(null);

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setRole(UserRole.SUPERVISOR);
        setSelectedRegionIds([]);
        setSelectedBranchIds([]);
        setSelectedRouteIds([]);
        setSelectedRepCodes([]);
        setIsActive(true);
        setIsUserModalOpen(false);
        setIsRegionDropdownOpen(false);
        setIsBranchDropdownOpen(false);
        setIsRouteDropdownOpen(false);
        setIsRepDropdownOpen(false);
    };

    const handleOpenAddUser = () => {
        resetForm();
        setModalMode('ADD');
        setIsUserModalOpen(true);
    };

    const handleOpenEditUser = (user: User) => {
        setUsername(user.username);
        setPassword(user.password);
        setRole(user.role);
        setSelectedRegionIds(user.regionIds || []);
        setSelectedBranchIds(user.branchIds || []);
        setSelectedRouteIds(user.routeIds || []);
        setSelectedRepCodes(user.repCodes || []);
        setIsActive(user.isActive);
        setModalMode('EDIT');
        setIsUserModalOpen(true);
    };

    // --- FETCH DATA ---
    useEffect(() => {
        if (currentCompany?.id) {
            fetchCompanyRegions(currentCompany.id).then(setAvailableRegions);
        }
    }, [currentCompany?.id]);

    useEffect(() => {
        if (currentCompany?.id) {
            fetchCompanyBranches(currentCompany.id, selectedRegionIds).then(dbBranches => {
                // Merge with Configured Branches from Settings if no regions or matches?
                // For simplicity, we filter db branches by region, but show all configured branches if no region selected
                const configuredBranches = (currentCompany.settings?.common?.general?.branches || []).map((b: any) => b.name || b.code || b);
                const deprecatedBranches = currentCompany.settings?.common?.general?.allowedBranches || [];

                const allBranches = new Set([...dbBranches, ...configuredBranches, ...deprecatedBranches]);
                setAvailableBranches(Array.from(allBranches).sort());
            });
        }
    }, [currentCompany?.id, currentCompany?.settings, selectedRegionIds]);

    useEffect(() => {
        if (currentCompany?.id) {
            fetchCompanyRoutes(currentCompany.id, selectedBranchIds).then(routes => {
                const mappedRoutes = (routes || []).map((r: any) => {
                    if (typeof r === 'string') return { routeName: r, userCode: '' };
                    return { routeName: r.name || r.routeName, userCode: r.userCode || '' };
                });
                setAvailableRoutes(mappedRoutes);
            });
        }
    }, [currentCompany?.id, selectedBranchIds]);

    useEffect(() => {
        if (currentCompany?.id && (selectedBranchIds.length > 0 || selectedRouteIds.length > 0)) {
            fetchCompanyReps(currentCompany.id, selectedBranchIds, selectedRouteIds).then(setAvailableReps);
        } else {
            setAvailableReps([]);
        }
    }, [currentCompany?.id, selectedBranchIds, selectedRouteIds]);

    const handleRegionToggle = (code: string) => {
        setSelectedRegionIds(prev =>
            prev.includes(code) ? prev.filter(id => id !== code) : [...prev, code]
        );
        // We don't necessarily want to reset branches if it's multi-select, 
        // but it's safer to keep the current selection and just update available ones via useEffect.
    };

    const handleBranchToggle = (code: string) => {
        setSelectedBranchIds(prev =>
            prev.includes(code) ? prev.filter(id => id !== code) : [...prev, code]
        );
    };

    const handleRouteToggle = (routeKey: string) => {
        setSelectedRouteIds(prev =>
            prev.includes(routeKey) ? prev.filter(id => id !== routeKey) : [...prev, routeKey]
        );
    };

    const handleRepToggle = (userCode: string) => {
        setSelectedRepCodes(prev =>
            prev.includes(userCode) ? prev.filter(c => c !== userCode) : [...prev, userCode]
        );
    };

    const [isSaving, setIsSaving] = useState(false);

    const handleSubmitUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (username && password) {
            setIsSaving(true);
            try {
                const userData: Partial<User> = {
                    username,
                    password,
                    role,
                    branchIds: selectedBranchIds,
                    routeIds: selectedRouteIds,
                    regionIds: selectedRegionIds,
                    repCodes: selectedRepCodes,
                    isActive: isActive
                };

                if (modalMode === 'ADD') await onAddUser(userData as User);
                else if (modalMode === 'EDIT' && onUpdateUser) await onUpdateUser(userData as User);

                resetForm();
            } catch (error: any) {
                console.error("Failed to save user:", error);
                alert("Failed to save user: " + (error.message || "Unknown error"));
            } finally {
                setIsSaving(false);
            }
        }
    };

    const filteredUsers = useMemo(() => {
        return userList.filter(u => {
            const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
            const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? u.isActive : !u.isActive);

            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [userList, searchTerm, roleFilter, statusFilter]);

    const handleSort = (key: keyof User | 'lastActive') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = useMemo(() => {
        if (!sortConfig) return filteredUsers;
        return [...filteredUsers].sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof User];
            let bVal: any = b[sortConfig.key as keyof User];

            if (sortConfig.key === 'lastActive') {
                aVal = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
                bVal = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredUsers, sortConfig]);

    const isUserOnline = (lastLogin?: string) => {
        if (!lastLogin) return false;
        const loginTime = new Date(lastLogin).getTime();
        const now = new Date().getTime();
        return (now - loginTime) < 30 * 60 * 1000;
    };

    // Export Users
    const handleExportUsers = () => {
        const headers = ['Username', 'Role', 'Status', 'Last Active', 'Branches'];
        const rows = sortedUsers.map(u => {
            const branchNames = u.branchIds && u.branchIds.length > 0
                ? u.branchIds.join('|')// IDs are names in this legacy context, or we map them if IDs are UUIDs
                : 'All';
            return [
                `"${u.username}"`,
                u.role,
                u.isActive ? 'Active' : 'Inactive',
                u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
                `"${branchNames}"`
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={`h-full flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} `}>
            {/* Header/Stats Area */}
            <div className="shrink-0 p-8 pb-4 border-b border-gray-200 dark:border-gray-800">
                {!hideHeader && (
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                                <Users className="w-8 h-8 text-indigo-600" />
                                User Management
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
                                Control access, manage roles, and monitor user activity.
                            </p>
                        </div>
                        <button
                            onClick={handleOpenAddUser}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
                        >
                            <UserPlus className="w-5 h-5" />
                            {t.addNewUser}
                        </button>
                    </div>
                )}

                {/* Stats Cards (Always Visible) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Total Users</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{userList.length}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Active Now</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                {userList.filter(u => isUserOnline(u.lastLogin)).length}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Admins</p>
                            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
                                {userList.filter(u => u.role === UserRole.ADMIN).length}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={handleExportUsers}>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Export Data</p>
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-300 mt-1">
                                Download CSV
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center">
                            <Download className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Bar */}
            <div className="px-8 py-4 flex gap-4 overflow-x-auto shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>
                <div className="relative min-w-[140px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                        title="Filter by Role"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full pl-10 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                        <option value="ALL">All Roles</option>
                        {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative min-w-[140px]">
                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${statusFilter === 'ACTIVE' ? 'bg-emerald-500' : (statusFilter === 'INACTIVE' ? 'bg-red-500' : 'bg-gray-400')} `} />
                    <select
                        title="Filter by Status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full pl-8 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="INACTIVE">Inactive Only</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                {hideHeader && (
                    <button
                        onClick={handleOpenAddUser}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all whitespace-nowrap"
                    >
                        <UserPlus className="w-4 h-4" />
                        {t.addNewUser}
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4 sm:p-8">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-bold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                            <tr>
                                <th onClick={() => handleSort('username')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">User</th>
                                <th onClick={() => handleSort('role')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">Role & Access</th>
                                <th onClick={() => handleSort('isActive')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">Status</th>
                                <th onClick={() => handleSort('lastActive')} className="px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">Activity</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {sortedUsers.map(u => (
                                <tr key={u.username} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-black text-sm">
                                                {u.username.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{u.username}</p>
                                                <p className="text-xs text-gray-500 font-mono">ID: {u.username.toLowerCase()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold w-fit ${u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                                u.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                } `}>
                                                {u.role}
                                            </span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {u.regionIds && u.regionIds.length > 0 && (
                                                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                                                        {u.regionIds.length} Regions
                                                    </span>
                                                )}
                                                {u.branchIds && u.branchIds.length > 0 && (
                                                    <span className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                                        {u.branchIds.length} Branches
                                                    </span>
                                                )}
                                                {u.routeIds && u.routeIds.length > 0 && (
                                                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                                                        {u.routeIds.length} Routes
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => onToggleUserStatus(u.username)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${u.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'} `}
                                        >
                                            {u.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                            {u.isActive ? 'Active' : 'Suspended'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${isUserOnline(u.lastLogin) ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'} `}></span>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                                    {isUserOnline(u.lastLogin) ? 'Online Now' : 'Offline'}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never logged in'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onLoginAs(u)}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                                title="Login As User"
                                            >
                                                <LogIn className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditUser(u)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                title="Edit Details"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sortedUsers.length === 0 && (
                        <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                            <Users className="w-12 h-12 mb-3 opacity-20" />
                            <p>No users found matching your filters.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* User Modal */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-md w-full relative border border-gray-200 dark:border-gray-700 scale-100 animate-in zoom-in-95 duration-200">
                        <button onClick={() => setIsUserModalOpen(false)} title="Close Modal" aria-label="Close" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                {modalMode === 'ADD' ? <UserPlus className="w-6 h-6" /> : <Edit2 className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white">
                                    {modalMode === 'ADD' ? t.addNewUser : 'Edit User Profile'}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium">{modalMode === 'ADD' ? 'Create a new access account' : 'Update existing user details'}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitUser} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t.username}</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        disabled={modalMode === 'EDIT'}
                                        className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 text-gray-900 dark:text-white font-medium transition-all"
                                        required
                                        placeholder="j.doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t.password}</label>
                                <div className="relative">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"// Visible for admin convenience per request
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl pl-11 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white font-medium transition-all"
                                        required
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t.role}</label>
                                    <div className="relative">
                                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <select
                                            title="User Role"
                                            value={role}
                                            onChange={e => setRole(e.target.value as UserRole)}
                                            className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl pl-11 pr-8 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white font-medium appearance-none cursor-pointer"
                                        >
                                            <option value={UserRole.SUPERVISOR}>Supervisor</option>
                                            <option value={UserRole.MANAGER}>Manager</option>
                                            <option value={UserRole.USER}>User</option>
                                            <option value={UserRole.ADMIN}>Admin</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex items-end">
                                    <div className={`w-full p-3 rounded-xl text-center text-xs font-bold ${role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600' :
                                        role === UserRole.MANAGER ? 'bg-blue-100 text-blue-600' :
                                            'bg-gray-100 text-gray-500'
                                        } `}>
                                        {role === UserRole.ADMIN ? 'Admin Privileges' :
                                            role === UserRole.MANAGER ? 'Region Control' : 'Restricted'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Branch Selection */}
                                <div className="relative">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Assigned Branches</label>
                                    <button
                                        type="button"
                                        onClick={() => { setIsBranchDropdownOpen(!isBranchDropdownOpen); setIsRouteDropdownOpen(false); }}
                                        className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3.5 text-left text-sm font-medium flex justify-between items-center text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        <span className={selectedBranchIds.length === 0 ? 'text-gray-400' : ''}>
                                            {selectedBranchIds.length > 0 ? `${selectedBranchIds.length} Branches Selected` : 'Select Assigned Branches'}
                                        </span>
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    </button>

                                    {isBranchDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30 p-2 custom-scrollbar animate-in slide-in-from-top-2">
                                            {availableBranches.length > 0 && (
                                                <div className="flex justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-600 mb-1 sticky top-0 bg-white dark:bg-gray-700 z-10">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedBranchIds(availableBranches); }}
                                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                                    >
                                                        Select All
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedBranchIds([]); }}
                                                        className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                            {availableBranches.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-gray-500">
                                                    No branches found for selected regions.
                                                </div>
                                            ) : (
                                                availableBranches.map(branch => (
                                                    <label key={branch} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg cursor-pointer transition-colors" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedBranchIds.includes(branch)}
                                                            onChange={() => handleBranchToggle(branch)}
                                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-500 rounded"
                                                        />
                                                        <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">{branch}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Route Selection */}
                                <div className="relative">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Assigned Routes</label>
                                    <button
                                        type="button"
                                        onClick={() => { setIsRouteDropdownOpen(!isRouteDropdownOpen); setIsBranchDropdownOpen(false); }}
                                        className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3.5 text-left text-sm font-medium flex justify-between items-center text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        <span className={selectedRouteIds.length === 0 ? 'text-gray-400' : ''}>
                                            {selectedRouteIds.length > 0 ? `${selectedRouteIds.length} Routes Selected` : 'Select Assigned Routes'}
                                        </span>
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    </button>

                                    {isRouteDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-48 overflow-y-auto z-30 p-2 custom-scrollbar animate-in slide-in-from-top-2">
                                            {availableRoutes.length > 0 && (
                                                <div className="flex justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-600 mb-1 sticky top-0 bg-white dark:bg-gray-700 z-10">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRouteIds(availableRoutes.map(r => r.routeName)); }}
                                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                                    >
                                                        Select All
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRouteIds([]); }}
                                                        className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                            {availableRoutes.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-gray-500">
                                                    No routes found for selected branches.
                                                </div>
                                            ) : (
                                                availableRoutes.map(route => (
                                                    <label key={route.routeName} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg cursor-pointer transition-colors" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedRouteIds.includes(route.routeName)}
                                                            onChange={() => handleRouteToggle(route.routeName)}
                                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-500 rounded"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">{route.routeName}</span>
                                                            {route.userCode && <span className="text-[10px] text-gray-400 leading-tight">Rep: {route.userCode}</span>}
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-6 flex gap-3">
                                <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 bg-white dark:bg-transparent border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-bold py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">{t.cancel}</button>
                                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-95">
                                    {modalMode === 'ADD' ? t.createUser : t.saveChanges}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
