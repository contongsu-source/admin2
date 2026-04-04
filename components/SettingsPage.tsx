import React, { useState, useRef } from 'react';
import { AppState, CompanyProfile, Project, ProjectPeriod, IncomingFund, prepareStateForSync } from '../types';
import { Save, Trash2, Calendar, Plus, Cloud, Copy, Download, Upload, FileJson, Printer, Edit2, X } from 'lucide-react';
import { ProjectReportPrint } from './ProjectReportPrint';
import { useReactToPrint } from 'react-to-print';

interface SettingsPageProps {
  state: AppState;
  onUpdateCompany: (profile: CompanyProfile) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdatePeriod: (periodId: string, startDate: string, endDate: string, keepName?: boolean, customName?: string) => void;
  onAddNewPeriod: (projectId: string, startDate: string, endDate: string) => void;
  onAddProject: (name: string, clientName: string, clientAddress: string, startDate: string, endDate: string, budget?: number, status?: 'Aktif' | 'Selesai' | 'Pending') => void;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onUpdateIncomingFunds: (projectId: string, funds: IncomingFund[]) => void;
  onImportData: (data: AppState) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ 
    state, 
    onUpdateCompany, 
    onDeleteProject, 
    onUpdatePeriod, 
    onAddNewPeriod,
    onAddProject,
    onUpdateProject,
    onUpdateIncomingFunds,
    onImportData
}) => {
  const [profile, setProfile] = useState<CompanyProfile>(state.companyProfile);
  
  // Print Ref
  const printRef = useRef<HTMLDivElement>(null);
  const [projectToPrint, setProjectToPrint] = useState<string | null>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Laporan-Proyek`,
    onAfterPrint: () => setProjectToPrint(null),
  });

  const triggerPrint = (projectId: string) => {
      setProjectToPrint(projectId);
      setTimeout(() => {
          handlePrint();
      }, 100);
  };
  
  // New Project State
  const [newProject, setNewProject] = useState({
    name: '',
    clientName: '',
    clientAddress: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    budget: 0,
    status: 'Aktif' as 'Aktif' | 'Selesai' | 'Pending'
  });

  // Incoming Funds State
  const [managingFundsFor, setManagingFundsFor] = useState<string | null>(null);
  const [newFund, setNewFund] = useState({ date: new Date().toISOString().split('T')[0], source: '', amount: 0 });

  const handleAddFund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingFundsFor || !newFund.source || newFund.amount <= 0) return;
    
    const projectFunds = state.incomingFunds[managingFundsFor] || [];
    const newFundItem: IncomingFund = {
        id: `fund-${Date.now()}`,
        date: newFund.date,
        source: newFund.source,
        amount: newFund.amount
    };
    
    onUpdateIncomingFunds(managingFundsFor, [...projectFunds, newFundItem]);
    setNewFund({ date: new Date().toISOString().split('T')[0], source: '', amount: 0 });
  };

  const handleDeleteFund = (projectId: string, fundId: string) => {
      if (!confirm('Hapus dana masuk ini?')) return;
      const projectFunds = state.incomingFunds[projectId] || [];
      onUpdateIncomingFunds(projectId, projectFunds.filter(f => f.id !== fundId));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCompany(profile);
    alert('Profil perusahaan berhasil disimpan!');
  };

  const handleDeleteProj = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus proyek "${name}"? Data material dan absensi terkait mungkin akan hilang/tidak bisa diakses.`)) {
        onDeleteProject(id);
    }
  };

  const handleDateChange = (periodId: string, field: 'startDate' | 'endDate', value: string) => {
      const period = state.periods.find(p => p.id === periodId);
      if(period) {
          const newStart = field === 'startDate' ? value : period.startDate;
          const newEnd = field === 'endDate' ? value : period.endDate;
          // Keep name the same when manually changing dates if user requested "nama masih sama"
          onUpdatePeriod(periodId, newStart, newEnd, true);
      }
  };

  const handleNextPeriod = (projectId: string, periodId: string) => {
      const period = state.periods.find(p => p.id === periodId);
      if (!period) return;

      const currentEnd = new Date(period.endDate);
      const nextStart = new Date(currentEnd);
      nextStart.setDate(currentEnd.getDate() + 1);
      
      const nextEnd = new Date(nextStart);
      nextEnd.setDate(nextStart.getDate() + 6);

      // Create a NEW period instead of updating the existing one
      onAddNewPeriod(
          projectId, 
          nextStart.toISOString().split('T')[0], 
          nextEnd.toISOString().split('T')[0]
      );
      alert('Periode baru berhasil dibuat! Periode sebelumnya tetap tersimpan di riwayat.');
  };

  const handlePrevWeekPeriod = (projectId: string, periodId: string) => {
      const period = state.periods.find(p => p.id === periodId);
      if (!period) return;

      const currentStart = new Date(period.startDate);
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(currentStart.getDate() - 1);
      
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - 6);

      onAddNewPeriod(
          projectId, 
          prevStart.toISOString().split('T')[0], 
          prevEnd.toISOString().split('T')[0]
      );
      alert('Periode minggu lalu berhasil dibuat!');
  };

  const handlePrevMonthPeriod = (projectId: string, periodId: string) => {
      const period = state.periods.find(p => p.id === periodId);
      if (!period) return;

      const currentStart = new Date(period.startDate);
      const prevEnd = new Date(currentStart);
      prevEnd.setDate(currentStart.getDate() - 1);
      
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevEnd.getDate() - 29); // 30 days total

      onAddNewPeriod(
          projectId, 
          prevStart.toISOString().split('T')[0], 
          prevEnd.toISOString().split('T')[0]
      );
      alert('Periode bulan lalu berhasil dibuat!');
  };

  const handleAddProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.startDate || !newProject.endDate) return;
    
    onAddProject(
        newProject.name, 
        newProject.clientName || 'Client Umum', 
        newProject.clientAddress || 'Alamat Proyek', 
        newProject.startDate, 
        newProject.endDate,
        newProject.budget,
        newProject.status
    );
    
    // Reset
    setNewProject({
        name: '',
        clientName: '',
        clientAddress: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        budget: 0,
        status: 'Aktif'
    });
    alert('Proyek baru berhasil dibuat!');
  };

  const setNextWeek = () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 6);
    setNewProject(prev => ({
        ...prev,
        startDate: today.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0]
    }));
  };

  // --- Manual Backup & Restore ---
  
  const handleBackup = () => {
      const dataStr = JSON.stringify(state, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.download = `backup_sbm_${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if(!confirm("Apakah Anda yakin ingin me-restore data? Data saat ini akan DITIMPA dengan data dari file backup.")) {
          e.target.value = ''; // Reset input
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const result = event.target?.result as string;
              const parsed = JSON.parse(result);
              
              // Basic validation check
              if (parsed && parsed.companyProfile && Array.isArray(parsed.projects)) {
                  onImportData(parsed as AppState);
                  alert("Data berhasil dipulihkan!");
              } else {
                  alert("Format file backup tidak valid.");
              }
          } catch (err) {
              console.error(err);
              alert("Gagal membaca file. Pastikan file adalah JSON yang valid.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input to allow same file selection again if needed
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 print:max-w-none print:space-y-0 print:pb-0">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan</h2>
        <p className="text-gray-500 dark:text-gray-400">Kelola profil perusahaan, proyek, dan sinkronisasi data</p>
      </div>

      {/* Cloud Sync Section - Removed as it's now handled automatically via Firebase */}

      {/* Manual Backup & Restore Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-900 dark:to-pink-900 p-6 rounded-xl shadow-lg text-white print:hidden">
          <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <FileJson className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Backup & Restore Manual</h3>
                <p className="text-purple-100 text-sm">Simpan data ke file atau pulihkan dari file</p>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/20">
                  <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-purple-200">Download Data (Backup)</h4>
                  <p className="text-xs text-purple-100 mb-4">
                      Unduh semua data aplikasi saat ini ke dalam file JSON untuk disimpan di perangkat Anda.
                  </p>
                  <button 
                    onClick={handleBackup}
                    className="w-full bg-white text-purple-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-50 transition flex items-center justify-center gap-2"
                  >
                      <Download className="w-4 h-4" />
                      Download Backup (.json)
                  </button>
              </div>

              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/20">
                  <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-purple-200">Upload Data (Restore)</h4>
                  <p className="text-xs text-purple-100 mb-4">
                      Kembalikan data dari file backup yang sudah Anda download sebelumnya.
                  </p>
                  <label className="w-full bg-white text-purple-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-50 transition flex items-center justify-center gap-2 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Pilih File Backup
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={handleRestore}
                        className="hidden"
                      />
                  </label>
              </div>
          </div>
      </div>

      {/* Company Profile Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:hidden">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg text-brand-600 dark:text-brand-400">
                <Save className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Profil Perusahaan</h3>
        </div>
        
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Perusahaan</label>
                <input 
                    type="text" 
                    value={profile.name}
                    onChange={e => setProfile({...profile, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                />
            </div>
            <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alamat Lengkap</label>
                <textarea 
                    value={profile.address}
                    onChange={e => setProfile({...profile, address: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    rows={3}
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Direktur / Pimpinan</label>
                <input 
                    type="text" 
                    value={profile.director}
                    onChange={e => setProfile({...profile, director: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kota (Untuk TTD)</label>
                <input 
                    type="text" 
                    value={profile.city}
                    onChange={e => setProfile({...profile, city: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                />
            </div>
            <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanda Tangan</label>
                <div className="flex items-center gap-4">
                    {profile.signature && (
                        <img src={profile.signature} alt="Tanda Tangan" className="h-16 border rounded p-1" />
                    )}
                    <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {profile.signature ? 'Ganti Tanda Tangan' : 'Upload Tanda Tangan'}
                        <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        setProfile({...profile, signature: reader.result as string});
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }}
                            className="hidden"
                        />
                    </label>
                    {profile.signature && (
                        <button 
                            type="button" 
                            onClick={() => setProfile({...profile, signature: undefined})}
                            className="text-red-500 hover:text-red-700 text-sm"
                        >
                            Hapus
                        </button>
                    )}
                </div>
            </div>
            <div className="col-span-2 flex justify-end">
                <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                    Simpan Profil
                </button>
            </div>
        </form>
      </div>

      {/* Create Project Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:hidden">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                <Plus className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Buat Proyek Baru</h3>
        </div>

        <form onSubmit={handleAddProjectSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Proyek</label>
                <input 
                    type="text" 
                    value={newProject.name}
                    onChange={e => setNewProject({...newProject, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Contoh: SEMARANG BARAT"
                    required
                />
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Client</label>
                <input 
                    type="text" 
                    value={newProject.clientName}
                    onChange={e => setNewProject({...newProject, clientName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Contoh: Bpk. Santoso"
                />
            </div>
            <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alamat Proyek</label>
                <input 
                    type="text" 
                    value={newProject.clientAddress}
                    onChange={e => setNewProject({...newProject, clientAddress: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Contoh: Jl. Pemuda No. 5"
                />
            </div>
            
            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Mulai</label>
                <input 
                    type="date" 
                    value={newProject.startDate}
                    onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                />
            </div>
            <div className="col-span-2 md:col-span-1">
                 <div className="flex justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal Selesai</label>
                    <button type="button" onClick={setNextWeek} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                        Set Otomatis (1 Minggu)
                    </button>
                 </div>
                <input 
                    type="date" 
                    value={newProject.endDate}
                    onChange={e => setNewProject({...newProject, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    required
                />
            </div>

            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dana Masuk (Budget)</label>
                <input 
                    type="number" 
                    value={newProject.budget}
                    onChange={e => setNewProject({...newProject, budget: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="Contoh: 100000000"
                />
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status Proyek</label>
                <select 
                    value={newProject.status}
                    onChange={e => setNewProject({...newProject, status: e.target.value as 'Aktif' | 'Selesai' | 'Pending'})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                    <option value="Aktif">Aktif</option>
                    <option value="Pending">Pending</option>
                    <option value="Selesai">Selesai</option>
                </select>
            </div>

            <div className="col-span-2 flex justify-end mt-2">
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Tambah Proyek
                </button>
            </div>
        </form>
      </div>

      {/* Project List Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:hidden">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Manajemen Proyek Aktif</h3>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase text-xs font-semibold">
                    <tr>
                        <th className="px-4 py-3">Nama Proyek</th>
                        <th className="px-4 py-3">Periode</th>
                        <th className="px-4 py-3 text-center">Mulai</th>
                        <th className="px-4 py-3 text-center">Selesai</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {state.projects.map(project => {
                        const period = state.periods.find(p => p.id === project.currentPeriodId);
                        return (
                            <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                    {project.name}
                                    <div className="text-xs text-gray-400 font-normal">{project.clientName}</div>
                                </td>
                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                                    {period && (
                                        <input 
                                            type="text" 
                                            value={period.name}
                                            onChange={(e) => onUpdatePeriod(period.id, period.startDate, period.endDate, false, e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 text-xs"
                                        />
                                    )}
                                    {!period && '-'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {period && (
                                        <input 
                                            type="date" 
                                            value={period.startDate}
                                            onChange={(e) => handleDateChange(period.id, 'startDate', e.target.value)}
                                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 text-xs"
                                        />
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {period && (
                                        <input 
                                            type="date" 
                                            value={period.endDate}
                                            onChange={(e) => handleDateChange(period.id, 'endDate', e.target.value)}
                                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 text-xs"
                                        />
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1 flex-wrap max-w-[200px] mx-auto">
                                        <button 
                                            onClick={() => handlePrevMonthPeriod(project.id, period.id)}
                                            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 p-1 border border-brand-200 dark:border-brand-800 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30 flex items-center gap-1 text-[10px] font-bold uppercase"
                                            title="Buat Periode Bulan Lalu"
                                        >
                                            <Plus className="w-3 h-3" />
                                            B. Lalu
                                        </button>
                                        <button 
                                            onClick={() => handlePrevWeekPeriod(project.id, period.id)}
                                            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 p-1 border border-brand-200 dark:border-brand-800 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30 flex items-center gap-1 text-[10px] font-bold uppercase"
                                            title="Buat Periode Minggu Lalu"
                                        >
                                            <Plus className="w-3 h-3" />
                                            M. Lalu
                                        </button>
                                        <button 
                                            onClick={() => handleNextPeriod(project.id, period.id)}
                                            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 p-1 border border-brand-200 dark:border-brand-800 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30 flex items-center gap-1 text-[10px] font-bold uppercase"
                                            title="Buat Periode Baru (Minggu Depan)"
                                        >
                                            <Plus className="w-3 h-3" />
                                            M. Depan
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteProj(project.id, project.name)}
                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30 ml-1"
                                            title="Hapus Proyek"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">* Mengubah tanggal akan otomatis memperbarui nama periode dan kolom absensi.</p>
      </div>
      {/* Project Budget Management Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 print:hidden">
                    <FileJson className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white print:text-2xl print:mb-4">Manajemen Anggaran Proyek</h3>
            </div>
            <button 
                onClick={() => window.print()}
                className="print:hidden flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
                <Printer className="w-4 h-4" />
                Cetak PDF
            </button>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm text-left print:text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase text-xs font-semibold print:bg-transparent print:text-gray-900 print:border-b-2 print:border-gray-800">
                    <tr>
                        <th className="px-4 py-3 print:px-2 print:py-2">Nama Proyek</th>
                        <th className="px-4 py-3 text-center print:px-2 print:py-2">Status</th>
                        <th className="px-4 py-3 text-right print:px-2 print:py-2">Dana Masuk</th>
                        <th className="px-4 py-3 text-right print:px-2 print:py-2">Terpakai</th>
                        <th className="px-4 py-3 text-right print:px-2 print:py-2">Sisa / (Kurang)</th>
                        <th className="px-4 py-3 text-center print:hidden">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 print:divide-none">
                    {state.projects.map(project => {
                        // Calculate Terpakai
                        const projectPeriods = state.periods.filter(p => p.projectId === project.id);
                        let totalTerpakai = 0;
                        
                        projectPeriods.forEach(period => {
                            // Payroll
                            const attendanceRecords = state.attendance[period.id] || [];
                            attendanceRecords.forEach(record => {
                                const emp = state.employees.find(e => e.id === record.employeeId);
                                if (emp) {
                                    let workDays = 0;
                                    let overtimeHours = 0;
                                    Object.values(record.days).forEach((day: any) => {
                                        if (day.isPresent) workDays++;
                                        if (day.extraWorkDays) workDays += day.extraWorkDays;
                                        overtimeHours += day.overtimeHours || 0;
                                    });
                                    const dailyRate = record.dailyRate ?? emp.dailyRate;
                                    const overtimeRate = record.overtimeRate ?? emp.overtimeRate;
                                    totalTerpakai += (workDays * dailyRate) + (overtimeHours * overtimeRate);
                                }
                            });
                            
                            // Material
                            const materials = state.materials[period.id] || [];
                            totalTerpakai += materials.reduce((sum, m) => sum + m.totalPrice, 0);
                        });
                        
                        // Petty Cash (Excluded as requested)
                        // const pettyCash = state.pettyCash[project.id] || [];
                        // totalTerpakai += pettyCash.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);
                        
                        const projectFunds = state.incomingFunds[project.id] || [];
                        const totalIncomingFunds = projectFunds.reduce((sum, f) => sum + f.amount, 0);
                        const budget = (project.budget || 0) + totalIncomingFunds;
                        const sisa = budget - totalTerpakai;

                        return (
                            <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 print:border-b print:border-gray-300 print:break-inside-avoid">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white print:px-2 print:py-2 print:text-gray-900">
                                    {project.name}
                                    {projectFunds.length > 0 && (
                                        <div className="hidden print:!block mt-2 text-xs text-gray-600">
                                            <div className="font-semibold mb-1">Rincian Dana Masuk:</div>
                                            <ul className="list-disc pl-4">
                                                {projectFunds.map(f => (
                                                    <li key={f.id}>{f.source}: Rp {f.amount.toLocaleString('id-ID')}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center print:px-2 print:py-2">
                                    <div className="print:hidden">
                                        <select 
                                            value={project.status || 'Aktif'}
                                            onChange={(e) => onUpdateProject(project.id, { status: e.target.value as any })}
                                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-2 py-1 text-xs"
                                        >
                                            <option value="Aktif">Aktif</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Selesai">Selesai</option>
                                        </select>
                                    </div>
                                    <span className="hidden print:!inline font-medium text-gray-900">{project.status || 'Aktif'}</span>
                                </td>
                                <td className="px-4 py-3 text-right print:px-2 print:py-2">
                                    <div className="flex flex-col items-end gap-1 print:block print:text-right">
                                        <span className="font-bold text-gray-900 dark:text-white print:text-gray-900">Rp {budget.toLocaleString('id-ID')}</span>
                                        <button 
                                            onClick={() => setManagingFundsFor(project.id)}
                                            className="print:hidden text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center gap-1"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                            Rincian Dana
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-medium print:px-2 print:py-2 print:text-gray-900">
                                    Rp {totalTerpakai.toLocaleString('id-ID')}
                                </td>
                                <td className={`px-4 py-3 text-right font-bold print:px-2 print:py-2 print:text-gray-900 ${sisa >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    Rp {sisa.toLocaleString('id-ID')}
                                </td>
                                <td className="px-4 py-3 text-center print:hidden">
                                    <button 
                                        onClick={() => triggerPrint(project.id)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                        title="Cetak Laporan Proyek"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>

      {/* Hidden Print Component */}
      <div className="hidden">
          <div ref={printRef}>
              {projectToPrint && <ProjectReportPrint state={state} projectId={projectToPrint} />}
          </div>
      </div>

      {/* Incoming Funds Modal */}
      {managingFundsFor && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          Rincian Dana Masuk
                          <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">
                              {state.projects.find(p => p.id === managingFundsFor)?.name}
                          </span>
                      </h3>
                      <button 
                          onClick={() => setManagingFundsFor(null)}
                          className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <form onSubmit={handleAddFund} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                          <div className="sm:col-span-1">
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                              <input 
                                  type="date" 
                                  value={newFund.date}
                                  onChange={e => setNewFund({...newFund, date: e.target.value})}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                  required
                              />
                          </div>
                          <div className="sm:col-span-1">
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dari Siapa</label>
                              <input 
                                  type="text" 
                                  value={newFund.source}
                                  onChange={e => setNewFund({...newFund, source: e.target.value})}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                  placeholder="Contoh: Bpk. Budi"
                                  required
                              />
                          </div>
                          <div className="sm:col-span-1">
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Jumlah (Rp)</label>
                              <input 
                                  type="number" 
                                  value={newFund.amount || ''}
                                  onChange={e => setNewFund({...newFund, amount: parseInt(e.target.value) || 0})}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                  placeholder="Contoh: 5000000"
                                  required
                              />
                          </div>
                          <div className="sm:col-span-1">
                              <button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2">
                                  <Plus className="w-4 h-4" />
                                  Tambah
                              </button>
                          </div>
                      </form>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                      <div className="mb-4">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Anggaran Awal (Legacy)</label>
                          <div className="flex items-center gap-2">
                              <input 
                                  type="number" 
                                  value={state.projects.find(p => p.id === managingFundsFor)?.budget || 0}
                                  onChange={(e) => onUpdateProject(managingFundsFor, { budget: parseInt(e.target.value) || 0 })}
                                  className="w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                              />
                              <span className="text-xs text-gray-500 dark:text-gray-400">Gunakan ini jika tidak ingin merinci dana masuk.</span>
                          </div>
                      </div>

                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase text-xs font-semibold">
                              <tr>
                                  <th className="px-4 py-3">Tanggal</th>
                                  <th className="px-4 py-3">Dari Siapa</th>
                                  <th className="px-4 py-3 text-right">Jumlah</th>
                                  <th className="px-4 py-3 text-center">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {(state.incomingFunds[managingFundsFor] || []).length === 0 ? (
                                  <tr>
                                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                          Belum ada rincian dana masuk.
                                      </td>
                                  </tr>
                              ) : (
                                  (state.incomingFunds[managingFundsFor] || []).map(fund => (
                                      <tr key={fund.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                                              {new Date(fund.date).toLocaleDateString('id-ID')}
                                          </td>
                                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                                              {fund.source}
                                          </td>
                                          <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-medium">
                                              Rp {fund.amount.toLocaleString('id-ID')}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                              <button 
                                                  onClick={() => handleDeleteFund(managingFundsFor, fund.id)}
                                                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                                                  title="Hapus Dana"
                                              >
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                          <tfoot className="bg-gray-50 dark:bg-gray-700/50 font-bold">
                              <tr>
                                  <td colSpan={2} className="px-4 py-3 text-right text-gray-900 dark:text-white">Total Rincian Dana:</td>
                                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                                      Rp {(state.incomingFunds[managingFundsFor] || []).reduce((sum, f) => sum + f.amount, 0).toLocaleString('id-ID')}
                                  </td>
                                  <td></td>
                              </tr>
                          </tfoot>
                      </table>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};