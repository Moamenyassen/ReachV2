import React, { useState, useMemo } from 'react';
import { ViewMode, User, Company, UserRole } from '../../types';
import { TRANSLATIONS, DEFAULT_COMPANY_SETTINGS } from '../../config/constants';
import BrandLogo from '../common/BrandLogo';
import {
  LayoutDashboard,
  Map as MapIcon,
  FileText,
  Sparkles,
  Database,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Moon,
  Sun,
  Languages,
  KeyRound,
  X,
  Settings,
  ListTodo,
  CalendarCheck,
  Wand2,
  Crosshair,
  Crown,
  Cpu,
  Zap,
  LayoutTemplate,
  CreditCard,
  Users,
  Megaphone,
  BarChart3
} from 'lucide-react';


interface SidebarProps {
  currentUser: User;
  company?: Company | null;
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  onLogout: () => void;
  onChangePassword: () => void;
  isDarkMode: boolean;
  language: 'en' | 'ar';
  onToggleTheme: () => void;
  onToggleLang: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  lastUpdated?: string;
  isAiTheme?: boolean;
  onToggleAiTheme?: () => void;
  onToggleUiMode?: () => void;
  onOpenCompanySettings?: () => void;
}

const SidebarNavItem = ({
  view,
  icon: Icon,
  label,
  description,
  isActive,
  disabled,
  effectiveCollapsed,
  onClick
}: {
  view: ViewMode,
  icon: any,
  label: string,
  description?: string,
  isActive: boolean,
  disabled?: boolean,
  effectiveCollapsed: boolean,
  onClick: () => void
}) => {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      className={`
        flex items-center gap-3 px-3 py-3 mx-2 rounded-xl transition-all duration-300 group relative
        ${isActive
          ? 'glass-panel border-cyan-500/30 bg-cyan-500/10 text-cyan-50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
          : 'text-slate-400 hover:text-white hover:bg-white/5'}
        ${effectiveCollapsed ? 'justify-center w-12 mx-auto' : 'w-[calc(100%-16px)]'}
        ${disabled ? 'opacity-40 grayscale cursor-not-allowed pointer-events-none' : ''}
      `}
    >
      <div className={`relative ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'} transition-colors`}>
        <Icon className="w-5 h-5 shrink-0" />
        {isActive && <div className="absolute inset-0 blur-sm bg-cyan-400/50 opacity-50"></div>}
      </div>


      {!effectiveCollapsed && (
        <div className="flex flex-col items-start overflow-hidden">
          <span className={`font-bold text-sm tracking-wide ${isActive ? 'text-white' : ''}`}>{label}</span>
          {description && <span className="text-[10px] text-slate-500 truncate">{description}</span>}
        </div>
      )}

      {!effectiveCollapsed && isActive && (
        <div className="ml-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"></div>
        </div>
      )}

      {effectiveCollapsed && (
        <div className="absolute left-full top-1/2 -translate-x-2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-200 whitespace-nowrap z-50">
          {label}
        </div>
      )}
    </button>
  );
};

const SidebarActionItem = ({
  icon: Icon,
  label,
  onClick,
  subItem = false,
  active = false,
  effectiveCollapsed
}: any) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-3 px-3 py-2 mx-2 rounded-lg transition-all duration-300 group
      ${active ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}
      ${effectiveCollapsed ? 'justify-center w-12 mx-auto' : 'w-[calc(100%-16px)]'}
      ${subItem && !effectiveCollapsed ? 'pl-11' : ''}
    `}
  >
    <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-indigo-400' : 'group-hover:text-indigo-400'}`} />
    {!effectiveCollapsed && <span className="text-xs font-bold tracking-wide">{label}</span>}
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentView,
  onNavigate,
  onLogout,
  onChangePassword,
  isDarkMode,
  language,
  onToggleTheme,
  onToggleLang,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose,
  lastUpdated,
  isAiTheme,
  onToggleAiTheme,
  company,
  onToggleUiMode,
  onOpenCompanySettings
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const t = TRANSLATIONS[language];
  const effectiveCollapsed = isMobileOpen ? false : isCollapsed;
  const isLimbo = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.username === 'sysadmin') return false;
    return !currentUser.companyId;
  }, [currentUser]);

  const settings = company?.settings ?
    {
      ...DEFAULT_COMPANY_SETTINGS,
      modules: {
        ...DEFAULT_COMPANY_SETTINGS.modules,
        ...company.settings.modules
      }
    }
    : DEFAULT_COMPANY_SETTINGS;

  const handleNavClick = (view: ViewMode) => {
    onNavigate(view);
    if (window.innerWidth < 768) onMobileClose();
  };

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] md:hidden" onClick={onMobileClose}></div>
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-[100]
        bg-[#020617]/90 backdrop-blur-2xl border-r border-white/5 shadow-2xl flex flex-col h-full transition-all duration-300
        ${effectiveCollapsed ? 'w-20' : 'w-72'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-24 w-6 h-6 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-500 transition-all z-50 hidden md:flex"
        >
          {effectiveCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <div className="h-20 flex items-center justify-center border-b border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-10 bg-cyan-500/20 blur-[40px] pointer-events-none"></div>
          <div className={`w-full flex ${effectiveCollapsed ? 'justify-center' : 'justify-start px-6'} transition-all duration-300`}>
            <BrandLogo size="md" showText={!effectiveCollapsed} />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 pt-4 pb-20 custom-scrollbar">
          {!isLimbo && (
            <div className="space-y-1">
              {!effectiveCollapsed && <div className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">Admin Core</div>}
              <SidebarNavItem
                view={ViewMode.ADMIN_DASHBOARD}
                icon={Database}
                label={t.dataCenter}
                description="Uploads & History"
                isActive={currentView === ViewMode.ADMIN_DASHBOARD}
                disabled={isLimbo}
                effectiveCollapsed={effectiveCollapsed}
                onClick={() => handleNavClick(ViewMode.ADMIN_DASHBOARD)}
              />
              <SidebarNavItem
                view={ViewMode.USER_MANAGEMENT}
                icon={Users}
                label={t.userManagement}
                description="Access & Roles"
                isActive={currentView === ViewMode.USER_MANAGEMENT}
                disabled={isLimbo}
                effectiveCollapsed={effectiveCollapsed}
                onClick={() => handleNavClick(ViewMode.USER_MANAGEMENT)}
              />
            </div>
          )}

          {isLimbo && (
            <div className="px-4 mb-6">
              <button
                onClick={() => handleNavClick(ViewMode.DASHBOARD)}
                className="w-full p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-cyan-500/20 text-white transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="w-5 h-5" />
                {!effectiveCollapsed && <span className="font-black text-xs uppercase tracking-widest">Start Setup</span>}
              </button>
            </div>
          )}

          {!effectiveCollapsed && !isLimbo && <div className="px-6 py-2 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">Mission Control</div>}

          {!isLimbo && (
            <>
              {settings.modules.insights?.enabled !== false && (
                <SidebarNavItem
                  view={ViewMode.LEGACY_INSIGHTS}
                  icon={FileText}
                  label={t.insights}
                  isActive={currentView === ViewMode.LEGACY_INSIGHTS}
                  disabled={isLimbo}
                  effectiveCollapsed={effectiveCollapsed}
                  onClick={() => handleNavClick(ViewMode.LEGACY_INSIGHTS)}
                />
              )}
              <SidebarNavItem
                view={ViewMode.CUSTOMERS}
                icon={Users}
                label={t.customers || "Customers"}
                isActive={currentView === ViewMode.CUSTOMERS}
                disabled={isLimbo}
                effectiveCollapsed={effectiveCollapsed}
                onClick={() => handleNavClick(ViewMode.CUSTOMERS)}
              />
              {settings.modules.map?.enabled !== false && (
                <SidebarNavItem
                  view={ViewMode.DASHBOARD}
                  icon={MapIcon}
                  label={t.mapView}
                  isActive={currentView === ViewMode.DASHBOARD}
                  disabled={isLimbo}
                  effectiveCollapsed={effectiveCollapsed}
                  onClick={() => handleNavClick(ViewMode.DASHBOARD)}
                />
              )}
              {settings.modules.optimizer?.enabled !== false && (
                <SidebarNavItem
                  view={ViewMode.AI_SUGGESTIONS}
                  icon={Sparkles}
                  label={t.routeOptimizer}
                  isActive={currentView === ViewMode.AI_SUGGESTIONS}
                  disabled={isLimbo}
                  effectiveCollapsed={effectiveCollapsed}
                  onClick={() => handleNavClick(ViewMode.AI_SUGGESTIONS)}
                />
              )}
            </>
          )}

          {!isLimbo && (
            <>
              {!effectiveCollapsed && <div className="px-6 py-2 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">Tools</div>}
              <SidebarNavItem
                view={ViewMode.ANALYZE_DATA}
                icon={BarChart3}
                label="Analyze Own Data"
                description="AI Business Insights"
                isActive={currentView === ViewMode.ANALYZE_DATA}
                disabled={isLimbo}
                effectiveCollapsed={effectiveCollapsed}
                onClick={() => handleNavClick(ViewMode.ANALYZE_DATA)}
              />
              {settings.modules.market?.enabled !== false && (
                <SidebarNavItem
                  view={ViewMode.MARKET_SCANNER}
                  icon={Crosshair}
                  label={t.marketScanner}
                  isActive={currentView === ViewMode.MARKET_SCANNER}
                  disabled={isLimbo}
                  effectiveCollapsed={effectiveCollapsed}
                  onClick={() => handleNavClick(ViewMode.MARKET_SCANNER)}
                />
              )}
              <SidebarNavItem
                view={ViewMode.FULL_SUMMARY}
                icon={FileText}
                label={t.detailedReports}
                isActive={currentView === ViewMode.FULL_SUMMARY}
                disabled={isLimbo}
                effectiveCollapsed={effectiveCollapsed}
                onClick={() => handleNavClick(ViewMode.FULL_SUMMARY)}
              />
              <div className="my-2 mx-6 border-b border-white/5"></div>
            </>
          )}

          {!isLimbo && isAdmin && (
            <SidebarNavItem
              view={ViewMode.PRICING}
              icon={CreditCard}
              label={t.pricing}
              isActive={currentView === ViewMode.PRICING}
              effectiveCollapsed={effectiveCollapsed}
              onClick={() => handleNavClick(ViewMode.PRICING)}
            />
          )}

          <SidebarNavItem
            view={ViewMode.REFERRAL_HUB}
            icon={Megaphone}
            label={t.partnerProgram}
            isActive={currentView === ViewMode.REFERRAL_HUB}
            effectiveCollapsed={effectiveCollapsed}
            onClick={() => handleNavClick(ViewMode.REFERRAL_HUB)}
          />

          <div className="mt-4">
            <button
              onClick={() => !effectiveCollapsed && setIsSettingsOpen(!isSettingsOpen)}
              className={`w-full flex items-center justify-between px-6 py-2 text-slate-400 hover:text-white transition-colors px-3 mx-2 rounded-xl hover:bg-white/5 ${effectiveCollapsed ? 'justify-center' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                {!effectiveCollapsed && <span className="text-sm font-bold">{t.systemConfig}</span>}
              </div>
              {!effectiveCollapsed && <ChevronRight className={`w-3 h-3 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />}
            </button>

            <div className={`overflow-hidden transition-all duration-300 ${isSettingsOpen && !effectiveCollapsed ? 'max-h-48 opacity-100 mt-2 space-y-1' : 'max-h-0 opacity-0'}`}>
              <SidebarActionItem icon={KeyRound} label={t.changePassword} onClick={onChangePassword} subItem effectiveCollapsed={effectiveCollapsed} />
              <SidebarActionItem icon={isDarkMode ? Sun : Moon} label={isDarkMode ? 'Light Mode' : 'Dark Mode'} onClick={onToggleTheme} subItem effectiveCollapsed={effectiveCollapsed} />
              <SidebarActionItem icon={Languages} label={language === 'en' ? 'Arabic' : 'English'} onClick={onToggleLang} subItem effectiveCollapsed={effectiveCollapsed} />
              <SidebarActionItem icon={Languages} label={language === 'en' ? 'Arabic' : 'English'} onClick={onToggleLang} subItem effectiveCollapsed={effectiveCollapsed} />
              {onToggleUiMode && <SidebarActionItem icon={LayoutTemplate} label="Modern Mode" onClick={onToggleUiMode} subItem effectiveCollapsed={effectiveCollapsed} />}
              {isAdmin && onToggleUiMode && onOpenCompanySettings && (
                <SidebarActionItem
                  icon={Settings}
                  label={t.settings}
                  onClick={() => {
                    onOpenCompanySettings();
                    if (!effectiveCollapsed) setIsSettingsOpen(false); // Auto close menu
                  }}
                  subItem
                  effectiveCollapsed={effectiveCollapsed}
                />
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 bg-black/20 border-t border-white/5">
          <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs uppercase">
                {currentUser.username.substring(0, 2)}
              </div>
            </div>
            {!effectiveCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{currentUser.username}</div>
                <div className="text-[10px] text-cyan-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online
                </div>
              </div>
            )}
            <button onClick={onLogout} title="Sign Out" className="text-slate-500 hover:text-red-400 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
