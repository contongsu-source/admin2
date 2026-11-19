import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { AppState } from '../types';
import { Menu, Moon, Sun, ChevronDown, LogIn, LogOut } from 'lucide-react';
import { User } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: string) => void;
  state: AppState;
  onProjectChange: (projectId: string) => void;
  onPeriodChange: (projectId: string, periodId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, state, onProjectChange, onPeriodChange, isDarkMode, onToggleTheme, user, onLogin, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const projectPeriods = state.periods.filter(p => p.projectId === state.currentProjectId);

  return (
    <div className="flex min-h-screen bg-[#f6f9f6] dark:bg-[#0d1510] transition-colors duration-200 font-sans selection:bg-brand-600 selection:text-white print:block print:min-h-0 print:bg-white">
      <Sidebar 
        currentView={currentView} 
        onChangeView={onChangeView} 
        companyProfile={state.companyProfile}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-h-screen md:ml-72 transition-all duration-300 w-full print:block print:min-h-0 print:ml-0">
        {/* Top Header */}
        <header className="bg-white/90 dark:bg-[#111c16]/90 backdrop-blur-md border-b border-brand-100 dark:border-brand-900/60 h-auto min-h-[4rem] md:h-20 flex flex-wrap md:flex-nowrap items-center justify-between px-4 py-3 md:px-8 sticky top-0 z-20 no-print transition-colors duration-200 gap-3">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 w-full md:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka menu navigasi"
              className="md:hidden p-2 -ml-2 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-xl active:scale-95 transition-transform shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Project Selector Container */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 flex-1 min-w-0">
              <span className="hidden md:inline text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-300/70 shrink-0">Proyek Aktif</span>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full max-w-full">
                  <div className="relative flex-1 w-full sm:w-auto group">
                    <select 
                      aria-label="Pilih proyek aktif"
                      value={state.currentProjectId}
                      onChange={(e) => onProjectChange(e.target.value)}
                      className="appearance-none w-full bg-brand-50/70 dark:bg-brand-900/30 border border-brand-200/80 dark:border-brand-800/60 text-gray-900 dark:text-white text-sm font-semibold rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-brand-500 cursor-pointer transition-colors hover:bg-brand-100/70 dark:hover:bg-brand-900/50 truncate"
                    >
                      {state.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-700 pointer-events-none dark:text-brand-300" />
                  </div>
                  
                  {state.currentProjectId && projectPeriods.length > 0 && (
                      <div className="relative group w-full sm:w-auto">
                        <select 
                          aria-label="Pilih periode kerja"
                          value={currentProject?.currentPeriodId}
                          onChange={(e) => onPeriodChange(state.currentProjectId, e.target.value)}
                          className="appearance-none w-full sm:w-auto bg-accent-50 dark:bg-accent-900/25 border border-accent-300/80 dark:border-accent-700/50 text-accent-900 dark:text-accent-300 text-xs font-semibold rounded-md pl-3 pr-8 py-2 focus:ring-1 focus:ring-accent-500 cursor-pointer transition-colors hover:bg-accent-100 dark:hover:bg-accent-900/40 truncate"
                        >
                          {projectPeriods.map(per => (
                            <option key={per.id} value={per.id}>{per.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-accent-700 dark:text-accent-300 pointer-events-none" />
                      </div>
                  )}
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-auto md:ml-3">
             <button 
               onClick={onToggleTheme}
               aria-label={isDarkMode ? "Ubah ke Mode Terang" : "Ubah ke Mode Gelap"}
               className="p-2 rounded-xl text-brand-700 hover:bg-brand-50 dark:text-accent-300 dark:hover:bg-brand-900/40 transition-all active:scale-95"
               title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
             >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
             
             <div className="flex items-center gap-3 pl-2 md:border-l border-brand-100 dark:border-brand-900/60">
                {user ? (
                  <>
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{user.displayName || 'User'}</span>
                        <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1">
                           <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse"></span> Online
                        </span>
                    </div>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-8 h-8 md:w-10 md:h-10 rounded-full ring-2 ring-accent-400 dark:ring-accent-500" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 shadow-md shadow-brand-500/30 flex items-center justify-center text-accent-200 font-bold text-xs md:text-sm ring-2 ring-accent-400 dark:ring-accent-500">
                         {user.displayName?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                    )}
                    <button onClick={onLogout} aria-label="Logout" className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors" title="Logout">
                      <LogOut className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <button onClick={onLogin} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold transition-colors shadow-sm shadow-brand-600/20">
                    <LogIn className="w-4 h-4 text-accent-300" />
                    <span className="hidden sm:inline">Login</span>
                  </button>
                )}
             </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 md:p-8 flex-1 overflow-x-hidden w-full dark:text-gray-200 max-w-7xl mx-auto print:block print:overflow-visible print:p-0 print:max-w-none">
          {children}
        </main>
      </div>
    </div>
  );
};