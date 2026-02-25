import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { AppState } from '../types';
import { Menu, Moon, Sun, ChevronDown } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onChangeView: (view: string) => void;
  state: AppState;
  onProjectChange: (projectId: string) => void;
  onPeriodChange: (projectId: string, periodId: string) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onChangeView, state, onProjectChange, onPeriodChange, isDarkMode, onToggleTheme }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const projectPeriods = state.periods.filter(p => p.projectId === state.currentProjectId);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 font-sans selection:bg-brand-500 selection:text-white">
      <Sidebar 
        currentView={currentView} 
        onChangeView={onChangeView} 
        companyProfile={state.companyProfile}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-h-screen md:ml-72 transition-all duration-300 w-full">
        {/* Top Header */}
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 h-auto min-h-[4rem] md:h-20 flex flex-wrap md:flex-nowrap items-center justify-between px-4 py-3 md:px-8 sticky top-0 z-20 no-print transition-colors duration-200 gap-3">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 w-full md:w-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl active:scale-95 transition-transform shrink-0"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Project Selector Container */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 flex-1 min-w-0">
              <span className="hidden md:inline text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">Proyek Aktif</span>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full max-w-full">
                  <div className="relative flex-1 w-full sm:w-auto group">
                    <select 
                      value={state.currentProjectId}
                      onChange={(e) => onProjectChange(e.target.value)}
                      className="appearance-none w-full bg-gray-100 dark:bg-gray-700/50 border-0 text-gray-900 dark:text-white text-sm font-semibold rounded-lg pl-3 pr-8 py-2 focus:ring-2 focus:ring-brand-500 cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 truncate"
                    >
                      {state.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none group-hover:text-gray-700 dark:text-gray-400" />
                  </div>
                  
                  {state.currentProjectId && projectPeriods.length > 0 && (
                      <div className="relative group w-full sm:w-auto">
                        <select 
                          value={currentProject?.currentPeriodId}
                          onChange={(e) => onPeriodChange(state.currentProjectId, e.target.value)}
                          className="appearance-none w-full sm:w-auto bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800/50 text-brand-600 dark:text-brand-400 text-xs font-medium rounded-md pl-3 pr-8 py-2 focus:ring-1 focus:ring-brand-500 cursor-pointer transition-colors hover:bg-brand-100 dark:hover:bg-brand-900/50 truncate"
                        >
                          {projectPeriods.map(per => (
                            <option key={per.id} value={per.id}>{per.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-500 pointer-events-none" />
                      </div>
                  )}
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-auto md:ml-3">
             <button 
               onClick={onToggleTheme}
               className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-all active:scale-95"
               title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
             >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
             
             <div className="flex items-center gap-3 pl-2 md:border-l border-gray-200 dark:border-gray-700">
                 <div className="hidden md:flex flex-col items-end">
                     <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Admin</span>
                     <span className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online
                     </span>
                 </div>
                 <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-500/30 flex items-center justify-center text-white font-bold text-xs md:text-sm ring-2 ring-white dark:ring-gray-800">
                    EK
                 </div>
             </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-4 md:p-8 flex-1 overflow-x-hidden w-full dark:text-gray-200 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};