import React from 'react';
import { LayoutDashboard, Users, Calculator, ShoppingCart, FileText, Building2, Settings, X, ChevronRight, Wallet } from 'lucide-react';
import { CompanyProfile } from '../types';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  companyProfile: CompanyProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, companyProfile, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Absensi Kerja', icon: Users },
    { id: 'payroll', label: 'Penggajian', icon: Calculator },
    { id: 'materials', label: 'Belanja Material', icon: ShoppingCart },
    { id: 'petty_cash', label: 'Kas Kecil', icon: Wallet },
    { id: 'invoice', label: 'Invoice', icon: FileText },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-30 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 bottom-0 z-40
        w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen flex flex-col no-print
        shadow-2xl md:shadow-none
        transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-6 md:p-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-brand-600 p-2.5 rounded-xl shrink-0 shadow-lg shadow-brand-600/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white leading-tight text-sm md:text-base line-clamp-2">
                  {companyProfile.name}
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide mt-0.5">MANAGEMENT SYSTEM</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 mb-2">
            <div className="h-px bg-gray-100 dark:bg-gray-700"></div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeView(item.id);
                  onClose();
                }}
                className={`w-full group flex items-center justify-between px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3.5">
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    {item.label}
                </div>
                {isActive && <ChevronRight className="w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
            );
          })}
        </nav>
        
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="bg-brand-500/10 dark:bg-brand-400/10 rounded-xl p-4 text-center">
              <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 mb-1">SBA System V1.3</p>
              <p className="text-[10px] text-brand-600/70 dark:text-brand-400/60">&copy; 2026 Cloud Sync Enabled</p>
          </div>
        </div>
      </div>
    </>
  );
};