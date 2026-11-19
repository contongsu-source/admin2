import React from 'react';
import { LayoutDashboard, Users, Calculator, ShoppingCart, FileText, Settings, X, ChevronRight, Wallet, Printer, Layers } from 'lucide-react';
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
    { id: 'project_summary', label: 'Rekap Proyek', icon: Layers, badge: 'Gabung' },
    { id: 'attendance', label: 'Absensi Kerja', icon: Users },
    { id: 'payroll', label: 'Penggajian', icon: Calculator },
    { id: 'materials', label: 'Material', icon: ShoppingCart },
    { id: 'rab', label: 'RAB / Anggaran', icon: FileText },
    { id: 'petty_cash', label: 'Kas Kecil', icon: Wallet },
    { id: 'invoice', label: 'Invoice', icon: FileText },
    { id: 'consolidated_report', label: 'Cetak 1 Lembar', icon: Printer, badge: 'Terpadu' },
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
        w-72 bg-white dark:bg-[#111c16] border-r border-brand-100 dark:border-brand-900/60 h-screen flex flex-col no-print
        shadow-2xl md:shadow-none
        transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="p-6 md:p-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-brand-600 to-brand-700 w-11 h-11 rounded-xl shrink-0 shadow-lg shadow-brand-600/25 ring-2 ring-accent-400/70 flex items-center justify-center">
              <span className="text-accent-300 font-black text-lg tracking-tighter">TK</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white leading-tight text-sm md:text-base line-clamp-2">
                  {companyProfile.name}
              </h1>
              <p className="text-[10px] text-brand-700 dark:text-accent-400 font-semibold tracking-wide mt-0.5">MANAGEMENT SYSTEM</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Tutup menu" className="md:hidden p-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 mb-2">
            <div className="h-px bg-brand-100 dark:bg-brand-900/60"></div>
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
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-brand-50 dark:hover:bg-brand-900/30 hover:text-brand-800 dark:hover:text-brand-200'
                }`}
              >
                <div className="flex items-center gap-3.5">
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-accent-300' : 'text-gray-400 dark:text-gray-500 group-hover:text-brand-600 dark:group-hover:text-accent-400'}`} />
                    <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-accent-400 text-brand-950'
                      : 'bg-accent-100 text-accent-800 dark:bg-accent-900/40 dark:text-accent-300'
                  }`}>
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-4 h-4 text-accent-300 transition-opacity" />
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="p-6 border-t border-brand-100 dark:border-brand-900/60 bg-brand-50/40 dark:bg-brand-950/40">
          <div className="bg-gradient-to-br from-brand-50 to-accent-50 dark:from-brand-900/40 dark:to-accent-900/20 border border-brand-200/70 dark:border-brand-800/60 rounded-xl p-4 text-center no-print">
              <p className="text-xs font-bold text-brand-800 dark:text-accent-300 mb-1">SBM System V1.3</p>
              <p className="text-[10px] text-brand-700/75 dark:text-brand-300/70">&copy; 2026 Cloud Sync Enabled</p>
          </div>
        </div>
      </div>
    </>
  );
};