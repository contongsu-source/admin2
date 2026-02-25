import React, { useState } from 'react';
import { AppState, CompanyProfile, Project, ProjectPeriod } from '../types';
import { Save, Trash2, Calendar, Plus, Cloud, Copy, Download, Upload, FileJson } from 'lucide-react';

interface SettingsPageProps {
  state: AppState;
  onUpdateCompany: (profile: CompanyProfile) => void;
  onDeleteProject: (projectId: string) => void;
  onUpdatePeriod: (periodId: string, startDate: string, endDate: string, keepName?: boolean, customName?: string) => void;
  onAddNewPeriod: (projectId: string, startDate: string, endDate: string) => void;
  onAddProject: (name: string, clientName: string, clientAddress: string, startDate: string, endDate: string) => void;
  cloudId: string | null;
  onSetCloudId: (id: string | null) => void;
  onLoadCloudData: (id: string) => Promise<void>;
  onImportData: (data: AppState) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ 
    state, 
    onUpdateCompany, 
    onDeleteProject, 
    onUpdatePeriod, 
    onAddNewPeriod,
    onAddProject,
    cloudId,
    onSetCloudId,
    onLoadCloudData,
    onImportData
}) => {
  const [profile, setProfile] = useState<CompanyProfile>(state.companyProfile);
  const [inputCloudId, setInputCloudId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // New Project State
  const [newProject, setNewProject] = useState({
    name: '',
    clientName: '',
    clientAddress: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

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

  const handleAddProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.startDate || !newProject.endDate) return;
    
    onAddProject(
        newProject.name, 
        newProject.clientName || 'Client Umum', 
        newProject.clientAddress || 'Alamat Proyek', 
        newProject.startDate, 
        newProject.endDate
    );
    
    // Reset
    setNewProject({
        name: '',
        clientName: '',
        clientAddress: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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

  // --- Cloud Sync Logic ---

  const createNewCloud = async () => {
      if(!confirm('Buat database cloud baru? Data saat ini akan diunggah dan Anda akan mendapatkan ID baru.')) return;
      
      setIsSyncing(true);
      try {
          const response = await fetch('https://jsonblob.com/api/jsonBlob', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
              },
              body: JSON.stringify(state)
          });
          
          if (response.ok) {
              const location = response.headers.get('Location');
              if (location) {
                  const newId = location.split('/').pop();
                  if (newId) {
                      onSetCloudId(newId);
                      alert('Berhasil! Database Cloud dibuat. Simpan ID Anda untuk mengakses di perangkat lain.');
                  }
              }
          } else {
              alert('Gagal membuat database cloud. Coba lagi.');
          }
      } catch (error) {
          console.error(error);
          alert('Error koneksi internet.');
      } finally {
          setIsSyncing(false);
      }
  };

  const connectToCloud = async () => {
      if (!inputCloudId) return;
      if (!confirm('Hubungkan ke ID ini? Data di perangkat ini akan DIGANTI dengan data dari Cloud.')) return;

      setIsSyncing(true);
      try {
          await onLoadCloudData(inputCloudId);
          alert('Berhasil terhubung dan sinkronisasi data!');
          setInputCloudId('');
      } catch (error) {
          console.error(error);
          alert('Gagal mengambil data. Pastikan ID Cloud benar.');
      } finally {
          setIsSyncing(false);
      }
  };

  const copyToClipboard = () => {
      if (cloudId) {
          navigator.clipboard.writeText(cloudId);
          alert('ID Cloud disalin ke clipboard!');
      }
  };

  // --- Manual Backup & Restore ---
  
  const handleBackup = () => {
      const dataStr = JSON.stringify(state, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.download = `backup_sba_${date}.json`;
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
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan</h2>
        <p className="text-gray-500 dark:text-gray-400">Kelola profil perusahaan, proyek, dan sinkronisasi data</p>
      </div>

      {/* Cloud Sync Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-900 dark:to-indigo-900 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Cloud className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Sinkronisasi Antar Perangkat</h3>
                <p className="text-blue-100 text-sm">Akses data yang sama di PC dan HP</p>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Active Connection */}
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/20">
                  <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-blue-200">Status Koneksi</h4>
                  {cloudId ? (
                      <div>
                          <p className="text-xs mb-1">Terhubung ke Cloud ID:</p>
                          <div className="flex gap-2">
                              <code className="bg-black/30 px-3 py-2 rounded text-sm font-mono flex-1 overflow-hidden text-ellipsis">
                                  {cloudId}
                              </code>
                              <button 
                                onClick={copyToClipboard}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded transition" 
                                title="Salin ID"
                              >
                                  <Copy className="w-4 h-4" />
                              </button>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-green-300">
                              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                              Sinkronisasi Otomatis Aktif
                          </div>
                      </div>
                  ) : (
                      <div className="text-center py-4">
                          <p className="text-sm text-blue-100 mb-3">Belum terhubung ke Cloud</p>
                          <button 
                            onClick={createNewCloud}
                            disabled={isSyncing}
                            className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition w-full flex items-center justify-center gap-2"
                          >
                              {isSyncing ? 'Memproses...' : (
                                  <>
                                    <Upload className="w-4 h-4" />
                                    Buat Database Baru
                                  </>
                              )}
                          </button>
                      </div>
                  )}
              </div>

              {/* Connect Existing */}
              <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/20">
                  <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-blue-200">Hubungkan Perangkat Lain</h4>
                  <p className="text-xs text-blue-100 mb-2">
                      Masukkan ID Cloud dari perangkat utama Anda di sini.
                  </p>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={inputCloudId}
                        onChange={(e) => setInputCloudId(e.target.value)}
                        placeholder="Tempel ID Cloud disini..."
                        className="flex-1 px-3 py-2 rounded text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button 
                        onClick={connectToCloud}
                        disabled={isSyncing || !inputCloudId}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <Download className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* Manual Backup & Restore Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-900 dark:to-pink-900 p-6 rounded-xl shadow-lg text-white">
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
                      Unduh semua data aplikasi saat ini ke dalam file JSON untuk disimpan di komputer/HP Anda.
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
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
            <div className="col-span-2 flex justify-end">
                <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                    Simpan Profil
                </button>
            </div>
        </form>
      </div>

      {/* Create Project Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
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

            <div className="col-span-2 flex justify-end mt-2">
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Tambah Proyek
                </button>
            </div>
        </form>
      </div>

      {/* Project List Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
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
                                    <div className="flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => handleNextPeriod(project.id, period.id)}
                                            className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 p-1 border border-brand-200 dark:border-brand-800 rounded hover:bg-brand-50 dark:hover:bg-brand-900/30 flex items-center gap-1 text-[10px] font-bold uppercase"
                                            title="Buat Periode Baru (Minggu Depan)"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Baru
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteProj(project.id, project.name)}
                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
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
    </div>
  );
};