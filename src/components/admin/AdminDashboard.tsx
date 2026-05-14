import React, { useState, useRef, useEffect, useMemo } from 'react';
// import { processCsvUpload, getDatabaseStats, getHistoryLogs, clearDatabase } from '../../services/supabase';
import { Customer, HistoryLog, User, UserRole } from '../../types';
import FileUpload, { ImportStats } from '../common/FileUpload';
import { BRANCHES, TRANSLATIONS } from '../../config/constants';
import {
   Users,
   History,
   FileSpreadsheet,
   Upload,
   Clock,
   UserPlus,
   ChevronDown,
   ChevronUp,
   Edit2,
   Check,
   Map,
   ShieldAlert,
   LogIn,
   X,
   Database,
   Calendar,
   Download,
   ArrowUpDown,
   ArrowUp,
   ArrowDown,
   RotateCcw,
   Trash2,
   ShieldCheck
} from 'lucide-react';

interface AdminDashboardProps {
   currentUser: User;
   onLogout: () => void;
   onNavigateToInsights: () => void;
   onNavigateToMap: () => void;
   onRouteUploaded: (data: Customer[], fileName: string, stats: ImportStats) => void;
   onUsersUploaded: (users: User[], fileName: string) => void;
   onAddUser: (user: User) => void;
   onUpdateUser?: (user: User) => void;
   onToggleUserStatus: (username: string) => void;
   onLoginAs: (user: User) => void;
   history: HistoryLog[];
   userList: User[];
   initialTab?: 'routes' | 'users';
   // Controls
   isDarkMode: boolean;
   language: 'en' | 'ar';
   // Versioning
   activeVersionId?: string;
   onRestoreVersion?: (versionId: string, dateStr: string) => void;
   onDeleteVersion: (versionId: string) => void;
   hideHeader?: boolean;
   maxRouteCap?: number;
   maxCustomerCap?: number;
   existingRoutes?: string[];
   onUpgradePlan?: () => void;
}

const SortIcon = ({ sortConfig, columnKey }: { sortConfig: any, columnKey: string }) => {
   if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 text-gray-300 ml-1 inline" />;
   return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 text-indigo-500 ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-indigo-500 ml-1 inline" />;
};

const Th = ({ label, sortKey, alignRight = false, sortConfig, onSort }: { label: string, sortKey: string, alignRight?: boolean, sortConfig: any, onSort: (key: any) => void }) => (
   <th
      className={`px-6 py-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none ${alignRight ? 'text-right' : ''} `}
      onClick={() => onSort(sortKey)}
   >
      <div className={`flex items-center gap-1 ${alignRight ? 'justify-end' : ''} `}>
         {label} <SortIcon sortConfig={sortConfig} columnKey={sortKey} />
      </div>
   </th>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({
   currentUser,
   onRouteUploaded,
   onUsersUploaded,
   onAddUser,
   onUpdateUser,
   onToggleUserStatus,
   onLoginAs,
   history,
   userList,
   initialTab = 'routes',
   language,
   activeVersionId,
   onRestoreVersion,
   onDeleteVersion,
   hideHeader,

   maxRouteCap,
   maxCustomerCap,
   existingRoutes,
   onUpgradePlan
}) => {
   const t = TRANSLATIONS[language];
   const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
   const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

   // Secure Deletion State
   const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
   const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
   const [deletePassword, setDeletePassword] = useState('');
   const [deleteError, setDeleteError] = useState('');

   const toggleLogExpansion = (id: string) => {
      setExpandedLogId(expandedLogId === id ? null : id);
   };

   const handleRouteUploadSuccess = (data: Customer[], fileName: string, stats: ImportStats) => {
      setIsUploadModalOpen(false);
      onRouteUploaded(data, fileName, stats);
   };

   const handleDeleteClick = (versionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteTargetId(versionId);
      setDeletePassword('');
      setDeleteError('');
      setIsDeleteModalOpen(true);
   };

   const handleConfirmDelete = (e: React.FormEvent) => {
      e.preventDefault();
      if (!deleteTargetId) return;

      if (deletePassword === currentUser.password) {
         onDeleteVersion(deleteTargetId);
         setIsDeleteModalOpen(false);
         setDeleteTargetId(null);
         setDeletePassword('');
      } else {
         setDeleteError('Incorrect password');
      }
   };

   return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 animate-in fade-in duration-300">

         <header className={`bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 px-8 py-5 sticky top-0 z-20 shadow-lg transition-all duration-300 ${hideHeader ? 'h-16 flex items-center' : ''} `}>
            <div className={`flex flex-col md:flex-row ${hideHeader ? 'w-full justify-between items-center' : 'justify-between items-start md:items-center'} gap-4`}>
               {!hideHeader && (
                  <div>
                     <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <Database className="w-6 h-6 text-indigo-600" />
                        Data Center
                     </h2>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage system data and upload history</p>
                  </div>
               )}
            </div>
         </header>

         <div className="p-8 max-w-[1600px] mx-auto space-y-8">

            <div className="space-y-8">

               <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                     <div className="flex items-center gap-4">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                           <History className="w-5 h-5 text-indigo-600" /> {t.uploadHistory}
                        </h3>
                        <span className="text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1 rounded-full text-gray-500 dark:text-gray-300">
                           {history.length} Logs
                        </span>
                     </div>

                     <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-all hover:-translate-y-0.5"
                     >
                        <Upload className="w-4 h-4" />
                        {t.uploadMaster}
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                     <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {history.length === 0 && <div className="p-12 text-center text-gray-400">No upload history found.</div>}
                        {history.map((log) => {
                           const isActive = activeVersionId === log.id;
                           return (
                              <div key={log.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors ${isActive ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''} `}>
                                 <div
                                    className={`p-6 flex items-center justify-between`}
                                 >
                                    <div className="flex items-center gap-6 flex-1 cursor-pointer" onClick={() => log.stats?.regionBreakdown && log.stats.regionBreakdown.length > 0 && toggleLogExpansion(log.id)}>
                                       <div className={`p-3 rounded-xl ${log.type === 'ROUTE' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'} `}>
                                          {log.type === 'ROUTE' ? <Map className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                                       </div>
                                       <div className="min-w-[200px]">
                                          <h4 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                                             {log.fileName}
                                             {isActive && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>}
                                          </h4>
                                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                             <span className="font-semibold bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300">
                                                {log.uploader}
                                             </span>
                                             <span>uploaded this file</span>
                                          </div>
                                       </div>

                                       <div className="hidden md:flex flex-col pl-6 border-l border-gray-100 dark:border-gray-700">
                                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Date & Time</span>
                                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                             <Clock className="w-3 h-3 text-indigo-400" />
                                             {new Date(log.uploadDate).toLocaleString()}
                                          </span>
                                       </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                       <div className="text-right cursor-pointer" onClick={() => log.stats?.regionBreakdown && log.stats.regionBreakdown.length > 0 && toggleLogExpansion(log.id)}>
                                          <span className="block text-2xl font-black text-gray-900 dark:text-white">{log.recordCount.toLocaleString()}</span>
                                          <span className="text-[10px] uppercase font-bold text-gray-400">Total Clients</span>
                                       </div>

                                       {/* Restore Button Logic */}
                                       {log.type === 'ROUTE' && !isActive && onRestoreVersion && (
                                          <button
                                             onClick={() => onRestoreVersion(log.id, log.uploadDate)}
                                             className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 group relative"
                                             title="Restore this version"
                                          >
                                             <RotateCcw className="w-5 h-5" />
                                          </button>
                                       )}

                                       {onDeleteVersion && (
                                          <button
                                             onClick={(e) => handleDeleteClick(log.id, e)}
                                             className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 group relative"
                                             title="Delete Version"
                                          >
                                             <Trash2 className="w-5 h-5" />
                                          </button>
                                       )}

                                       {log.stats?.regionBreakdown && (
                                          <div
                                             onClick={() => toggleLogExpansion(log.id)}
                                             className={`p-2 rounded-full cursor-pointer ${expandedLogId === log.id ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-400'} `}
                                          >
                                             {expandedLogId === log.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                          </div>
                                       )}
                                    </div>
                                 </div>
                                 {expandedLogId === log.id && log.stats?.regionBreakdown && (
                                    <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 p-6 animate-in slide-in-from-top-2">
                                       <h5 className="text-xs font-bold text-gray-500 uppercase mb-3 ml-1">Import Breakdown</h5>
                                       <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                          {log.stats.regionBreakdown.map((item, idx) => (
                                             <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                   <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={item.name}>{item.name}</span>
                                                   <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{item.count}</span>
                                                </div>
                                                {item.skipped > 0 && (
                                                   <div className="flex items-center gap-1 text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded w-fit mt-1">
                                                      <ShieldAlert className="w-3 h-3" />
                                                      {item.skipped} Missing GPS
                                                   </div>
                                                )}


                                             </div>
                                          ))}
                                       </div>
                                    </div>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  </div>
               </div>
            </div>

         </div>

         {/* Secure Deletion Modal */}
         {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm animate-in fade-in">
               <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full relative border border-gray-200 dark:border-gray-700 animate-in zoom-in-95">
                  <button
                     onClick={() => setIsDeleteModalOpen(false)}
                     className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pointer-events-auto"
                  >
                     <X className="w-5 h-5" />
                  </button>

                  <div className="flex flex-col items-center text-center mb-6">
                     <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                        <ShieldAlert className="w-8 h-8" />
                     </div>
                     <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Secure Deletion</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Enter your admin password to confirm permanent deletion of this record.
                     </p>
                  </div>

                  <form onSubmit={handleConfirmDelete} className="space-y-4">
                     <div>
                        <input
                           type="password"
                           placeholder="Admin Password"
                           value={deletePassword}
                           onChange={e => setDeletePassword(e.target.value)}
                           className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none text-center font-bold text-gray-900 dark:text-white placeholder:font-normal"
                           autoFocus
                        />
                        {deleteError && (
                           <p className="text-xs font-bold text-red-500 mt-2 text-center flex justify-center items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> {deleteError}
                           </p>
                        )}
                     </div>

                     <div className="flex gap-3 pt-2">
                        <button
                           type="button"
                           onClick={() => setIsDeleteModalOpen(false)}
                           className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                           Cancel
                        </button>
                        <button
                           type="submit"
                           className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-95"
                        >
                           Confirm Delete
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* File Upload Modal */}
         {isUploadModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
               <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl p-2 max-w-2xl w-full relative border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <button onClick={() => setIsUploadModalOpen(false)} className="absolute top-6 right-6 z-50 p-2 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 rounded-full transition-colors">
                     <X className="w-5 h-5" />
                  </button>
                  <FileUpload
                     onDataLoaded={handleRouteUploadSuccess}
                     maxRouteCap={maxRouteCap}
                     maxCustomerCap={maxCustomerCap}
                     existingRoutes={existingRoutes}
                     onUpgradePlan={onUpgradePlan}
                     onExcessData={(rows) => {
                        // Import service dynamically or check if we can import
                        import('../../services/supabase').then(mod => {
                           mod.saveReachLeads(rows, currentUser.companyId || 'unknown');
                        }).catch(err => console.error("Failed to load saveReachLeads", err));
                     }}
                  />
               </div>
            </div>
         )}
      </div>
   );
};

export default AdminDashboard;