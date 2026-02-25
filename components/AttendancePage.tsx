import React, { useState, useRef, useEffect } from 'react';
import { AppState, AttendanceRecord, ProjectPeriod, Employee } from '../types';
import { Check, QrCode, Search, Smartphone, Clock, Users, Plus, X, Trash2, Save, Edit2, Printer, List, Table, Upload } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import * as XLSX from 'xlsx';

interface AttendancePageProps {
  state: AppState;
  onUpdate: (records: AttendanceRecord[]) => void;
  onAddEmployee: (emp: Omit<Employee, 'id' | 'projectId'>) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ state, onUpdate, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriod = state.periods.find(p => p.id === currentProject?.currentPeriodId);
  const records = state.attendance[currentPeriod?.id || ''] || [];

  // FILTER EMPLOYEES BY CURRENT PROJECT
  const projectEmployees = state.employees.filter(e => e.projectId === state.currentProjectId);

  const [isEditing, setIsEditing] = useState(false);
  const [showEmpManager, setShowEmpManager] = useState(false); // Modal state
  const [viewMode, setViewMode] = useState<'table' | 'scan' | 'qr_list'>('table');
  const [localRecords, setLocalRecords] = useState<AttendanceRecord[]>(records);
  const [scanInput, setScanInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{name: string, time: string} | null>(null);
  
  // New Employee State
  const [newEmp, setNewEmp] = useState({ name: '', position: 'Worker', dailyRate: 100000, overtimeRate: 15000 });
  // Edit Employee State
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editEmpData, setEditEmpData] = useState<Partial<Employee>>({});

  // Camera scan state
  const [showCamera, setShowCamera] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Keep local records in sync if parent updates, unless editing
  useEffect(() => {
    if (!isEditing) {
      setLocalRecords(records);
    }
  }, [records, isEditing]);

  // Generate date headers
  const getDatesInPeriod = (period: ProjectPeriod) => {
    const dates = [];
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const dates = currentPeriod ? getDatesInPeriod(currentPeriod) : [];
  const daysOfWeek = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const todayStr = new Date().toISOString().split('T')[0];

  const toggleAttendance = (empId: string, dateStr: string) => {
    // If record doesn't exist for this employee, create it locally
    let employeeRecord = localRecords.find(r => r.employeeId === empId);
    let newRecords = [...localRecords];
    
    if (!employeeRecord) {
        employeeRecord = { employeeId: empId, days: {} };
        newRecords.push(employeeRecord);
    }

    newRecords = newRecords.map(rec => {
        if (rec.employeeId !== empId) return rec;
        const currentDay = rec.days[dateStr] || { date: dateStr, isPresent: false, overtimeHours: 0 };
        return {
            ...rec,
            days: {
                ...rec.days,
                [dateStr]: { ...currentDay, isPresent: !currentDay.isPresent }
            }
        };
    });
    setLocalRecords(newRecords);
    if (!isEditing) onUpdate(newRecords);
  };

  const updateOvertime = (empId: string, dateStr: string, hours: number) => {
    let employeeRecord = localRecords.find(r => r.employeeId === empId);
    let newRecords = [...localRecords];
    
    if (!employeeRecord) {
        employeeRecord = { employeeId: empId, days: {} };
        newRecords.push(employeeRecord);
    }

    newRecords = newRecords.map(rec => {
        if (rec.employeeId !== empId) return rec;
        const currentDay = rec.days[dateStr] || { date: dateStr, isPresent: false, overtimeHours: 0 };
        return {
            ...rec,
            days: {
                ...rec.days,
                [dateStr]: { ...currentDay, overtimeHours: hours }
            }
        };
    });
    setLocalRecords(newRecords);
  };

  const processScan = (empId: string) => {
    const emp = projectEmployees.find(e => e.id === empId);
    if (emp) {
        // Mark present for today
        // Ensure record exists
        let employeeRecord = localRecords.find(r => r.employeeId === empId);
        let newRecords = [...localRecords];
        if (!employeeRecord) {
            newRecords.push({ employeeId: empId, days: {} });
        }

        newRecords = newRecords.map(rec => {
            if (rec.employeeId !== empId) return rec;
            const currentDay = rec.days[todayStr] || { date: todayStr, isPresent: false, overtimeHours: 0 };
            return {
                ...rec,
                days: {
                    ...rec.days,
                    [todayStr]: { ...currentDay, isPresent: true }
                }
            };
        });
        setLocalRecords(newRecords);
        onUpdate(newRecords);
        setLastScanned({ name: emp.name, time: new Date().toLocaleTimeString() });
        return true;
    } 
    return false;
  };

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    const empId = scanInput.trim();
    if (!empId) return;
    
    if (processScan(empId)) {
        setScanInput('');
    } else {
        alert('ID Karyawan tidak ditemukan di proyek ini!');
        setScanInput('');
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data: any[] = XLSX.utils.sheet_to_json(ws);
          
          let count = 0;
          data.forEach(row => {
            // Expected columns: Nama, Jabatan, Gaji, Lembur
            if (row.Nama && row.Jabatan && row.Gaji) {
               onAddEmployee({
                   name: row.Nama,
                   position: row.Jabatan,
                   dailyRate: Number(row.Gaji) || 0,
                   overtimeRate: Number(row.Lembur) || 0
               });
               count++;
            }
          });
          alert(`Berhasil mengimpor ${count} karyawan!`);
        } catch (error) {
          console.error(error);
          alert('Gagal membaca file Excel. Pastikan format kolom: Nama, Jabatan, Gaji, Lembur');
        }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = ''; // Reset input
  };

  // Start Camera Logic
  useEffect(() => {
    if (showCamera && viewMode === 'scan') {
        const scanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
        );
        scanner.render((decodedText) => {
            if (processScan(decodedText)) {
            }
        }, (errorMessage) => {
        });
        scannerRef.current = scanner;

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
            }
        };
    }
  }, [showCamera, viewMode, localRecords, projectEmployees]);

  const saveChanges = () => {
    onUpdate(localRecords);
    setIsEditing(false);
  };

  const cancelChanges = () => {
    setLocalRecords(records);
    setIsEditing(false);
  };

  // Employee Manager Handlers
  const submitNewEmployee = (e: React.FormEvent) => {
      e.preventDefault();
      onAddEmployee(newEmp);
      setNewEmp({ name: '', position: 'Worker', dailyRate: 100000, overtimeRate: 15000 });
  };

  const startEditEmployee = (emp: Employee) => {
      setEditingEmpId(emp.id);
      setEditEmpData(emp);
  };

  const saveEditEmployee = () => {
      if (editingEmpId && editEmpData) {
          onUpdateEmployee(editEmpData as Employee);
          setEditingEmpId(null);
          setEditEmpData({});
      }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Absensi Kerja</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manajemen kehadiran manual & input lembur</p>
        </div>
        
        {/* Modern Segmented Control */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl w-full md:w-auto">
            <button
                onClick={() => setViewMode('table')}
                className={`flex-1 md:flex-none px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 text-brand-700 dark:text-brand-300 shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shadow-none bg-transparent'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <Table className="w-4 h-4" />
                    <span>Tabel</span>
                </div>
            </button>
            <button
                onClick={() => { setViewMode('scan'); setShowCamera(false); }}
                className={`flex-1 md:flex-none px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm ${viewMode === 'scan' ? 'bg-white dark:bg-gray-700 text-brand-700 dark:text-brand-300 shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shadow-none bg-transparent'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span>Scan</span>
                </div>
            </button>
            <button
                onClick={() => setViewMode('qr_list')}
                className={`flex-1 md:flex-none px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm ${viewMode === 'qr_list' ? 'bg-white dark:bg-gray-700 text-brand-700 dark:text-brand-300 shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shadow-none bg-transparent'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <QrCode className="w-4 h-4" />
                    <span>QR Code</span>
                </div>
            </button>
        </div>
      </div>

      {/* EMPLOYEE MANAGER MODAL */}
      {showEmpManager && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print animate-in fade-in duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl">
                      <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Kelola Karyawan</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{currentProject?.name}</p>
                      </div>
                      <button onClick={() => setShowEmpManager(false)} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 dark:text-gray-200">
                      {/* Add New Form */}
                      <form onSubmit={submitNewEmployee} className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl mb-8 border border-blue-100 dark:border-blue-800/30">
                          <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2">
                              <div className="bg-blue-600 text-white p-1 rounded-md">
                                <Plus className="w-3 h-3" />
                              </div>
                              Tambah Karyawan Baru
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                              <div className="md:col-span-2">
                                  <input 
                                      type="text" 
                                      placeholder="Nama Lengkap" 
                                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                      value={newEmp.name}
                                      onChange={e => setNewEmp({...newEmp, name: e.target.value})}
                                      required
                                  />
                              </div>
                              <div>
                                  <input 
                                      type="text" 
                                      placeholder="Jabatan" 
                                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                      value={newEmp.position}
                                      onChange={e => setNewEmp({...newEmp, position: e.target.value})}
                                      required
                                  />
                              </div>
                              <div>
                                  <input 
                                      type="number" 
                                      placeholder="Gaji/Hari" 
                                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                      value={newEmp.dailyRate}
                                      onChange={e => setNewEmp({...newEmp, dailyRate: parseInt(e.target.value) || 0})}
                                      required
                                  />
                              </div>
                              <button type="submit" className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                                  Simpan
                              </button>
                          </div>
                      </form>

                      {/* Excel Import */}
                      <div className="mb-6 p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
                           <div className="flex items-center justify-between">
                               <div>
                                   <p className="font-bold text-sm text-gray-700 dark:text-gray-300">Import Karyawan dari Excel</p>
                                   <p className="text-xs text-gray-500">Kolom Wajib: Nama, Jabatan, Gaji, Lembur</p>
                               </div>
                               <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2">
                                   <Upload className="w-4 h-4" />
                                   Pilih File Excel
                                   <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
                               </label>
                           </div>
                      </div>

                      {/* List */}
                      <table className="w-full text-sm">
                          <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase text-xs rounded-lg">
                              <tr>
                                  <th className="px-4 py-3 text-left rounded-l-lg">Nama</th>
                                  <th className="px-4 py-3 text-left">Jabatan</th>
                                  <th className="px-4 py-3 text-right">Gaji/Hari</th>
                                  <th className="px-4 py-3 text-right">Lembur/Jam</th>
                                  <th className="px-4 py-3 text-center rounded-r-lg">Aksi</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {projectEmployees.length === 0 && (
                                  <tr>
                                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">Belum ada karyawan di proyek ini.</td>
                                  </tr>
                              )}
                              {projectEmployees.map(emp => (
                                  <tr key={emp.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                      {editingEmpId === emp.id ? (
                                          <>
                                              <td className="px-4 py-3">
                                                  <input 
                                                      type="text" 
                                                      className="w-full border p-1.5 rounded dark:bg-gray-600 dark:border-gray-500 focus:ring-1 focus:ring-brand-500" 
                                                      value={editEmpData.name || ''} 
                                                      onChange={e => setEditEmpData({...editEmpData, name: e.target.value})}
                                                  />
                                              </td>
                                              <td className="px-4 py-3">
                                                  <input 
                                                      type="text" 
                                                      className="w-full border p-1.5 rounded dark:bg-gray-600 dark:border-gray-500 focus:ring-1 focus:ring-brand-500" 
                                                      value={editEmpData.position || ''} 
                                                      onChange={e => setEditEmpData({...editEmpData, position: e.target.value})}
                                                  />
                                              </td>
                                              <td className="px-4 py-3 text-right text-gray-400 text-xs">Edit di Menu Penggajian</td>
                                              <td className="px-4 py-3 text-right text-gray-400 text-xs">Edit di Menu Penggajian</td>
                                              <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                  <button onClick={saveEditEmployee} className="text-green-600 hover:text-green-800 bg-green-50 p-1 rounded hover:bg-green-100"><Save className="w-4 h-4"/></button>
                                                  <button onClick={() => setEditingEmpId(null)} className="text-gray-500 hover:text-gray-700 bg-gray-50 p-1 rounded hover:bg-gray-100"><X className="w-4 h-4"/></button>
                                              </td>
                                          </>
                                      ) : (
                                          <>
                                              <td className="px-4 py-3 font-medium dark:text-white">{emp.name}</td>
                                              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{emp.position}</td>
                                              <td className="px-4 py-3 text-right">{emp.dailyRate.toLocaleString('id-ID')}</td>
                                              <td className="px-4 py-3 text-right">{emp.overtimeRate.toLocaleString('id-ID')}</td>
                                              <td className="px-4 py-3 text-center flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button onClick={() => startEditEmployee(emp)} className="text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded-lg hover:bg-blue-100"><Edit2 className="w-4 h-4"/></button>
                                                  <button onClick={() => onDeleteEmployee(emp.id)} className="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/30 p-1.5 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                                              </td>
                                          </>
                                      )}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* SCAN MODE */}
      {viewMode === 'scan' && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-lg mx-auto text-center no-print">
            <div className="mb-8">
                <div className="w-20 h-20 bg-brand-50 dark:bg-brand-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <QrCode className="w-10 h-10 text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Absensi QR Code</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Gunakan Kamera atau input manual ID</p>
            </div>

            {/* Camera Area */}
            {showCamera ? (
                <div className="mb-8 animate-in zoom-in duration-300">
                    <div id="reader" className="w-full max-w-sm mx-auto border-4 border-brand-500 rounded-2xl overflow-hidden shadow-2xl"></div>
                    <button 
                        onClick={() => setShowCamera(false)}
                        className="mt-6 text-red-600 dark:text-red-400 font-bold text-sm hover:underline bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-full"
                    >
                        Tutup Kamera
                    </button>
                </div>
            ) : (
                 <button 
                    onClick={() => setShowCamera(true)}
                    className="mb-10 bg-brand-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-brand-600/30 hover:bg-brand-700 transition-all flex items-center gap-3 mx-auto transform hover:scale-105"
                >
                    <Smartphone className="w-6 h-6" />
                    Buka Kamera
                </button>
            )}

            <div className="relative border-t border-gray-100 dark:border-gray-700 pt-8">
                <p className="text-gray-400 text-xs mb-4 font-bold uppercase tracking-widest">Input ID Manual</p>
                <form onSubmit={handleManualScan} className="max-w-xs mx-auto relative group">
                    <input 
                        type="text" 
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 outline-none text-center font-mono text-lg font-bold dark:bg-gray-700 dark:text-white transition-all"
                        placeholder="ID..."
                    />
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-brand-500 transition-colors" />
                </form>
            </div>

            {lastScanned && (
                <div className="mt-8 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl p-6 animate-in slide-in-from-bottom duration-500">
                    <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400 font-bold text-lg mb-2">
                        <div className="bg-green-500 text-white rounded-full p-1">
                            <Check className="w-4 h-4" />
                        </div>
                        Berhasil Absen!
                    </div>
                    <p className="text-gray-900 dark:text-white text-2xl font-bold">{lastScanned.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">{lastScanned.time}</p>
                </div>
            )}
        </div>
      )}

      {/* QR LIST MODE */}
      {viewMode === 'qr_list' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 no-print">
            {projectEmployees.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    Belum ada karyawan di proyek ini.
                </div>
            )}
            {projectEmployees.map(emp => (
                <div key={emp.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-4 group">
                    <div className="bg-white p-3 border border-gray-100 rounded-xl shadow-inner">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${emp.id}`} 
                            alt={`QR ${emp.name}`}
                            className="w-32 h-32 group-hover:scale-105 transition-transform duration-300" 
                        />
                    </div>
                    <div className="text-center w-full">
                        <p className="font-bold text-gray-900 dark:text-white truncate px-2">{emp.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">{emp.position}</p>
                        <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-lg py-1.5 px-3 inline-block">
                             <p className="text-xs font-mono text-gray-600 dark:text-gray-300">ID: <span className="font-bold text-gray-900 dark:text-white">{emp.id}</span></p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* TABLE MODE */}
      {viewMode === 'table' && (
      <>
        <div className="flex flex-col-reverse md:flex-row justify-between items-start md:items-center gap-4 mb-4 no-print">
             <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 italic bg-yellow-50 dark:bg-yellow-900/10 px-3 py-2 rounded-lg border border-yellow-100 dark:border-yellow-900/30 w-full md:w-auto">
                <span className="font-bold">Info:</span> Gunakan "Edit Masal" untuk absen & lembur. 
             </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button 
                    onClick={() => setShowEmpManager(true)}
                    className="flex-1 md:flex-none bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                    <Users className="w-4 h-4" />
                    Karyawan
                </button>
                <button 
                    onClick={handlePrint}
                    className="flex-1 md:flex-none bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                    <Printer className="w-4 h-4" />
                    Cetak
                </button>
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="w-full md:w-auto bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-brand-600/20"
                    >
                        Edit Masal
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={cancelChanges}
                            className="flex-1 md:flex-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={saveChanges}
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-green-600/20"
                        >
                            Simpan
                        </button>
                    </>
                )}
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden no-print">
            <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase text-xs font-bold">
                <tr>
                    <th className="hidden md:table-cell px-4 py-4 sticky left-0 bg-gray-50 dark:bg-gray-800 z-20 w-12 text-center shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">No</th>
                    <th className="px-4 py-4 sticky left-0 md:left-12 bg-gray-50 dark:bg-gray-800 z-20 w-32 md:w-48 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)]">Nama</th>
                    <th className="hidden md:table-cell px-4 py-4 sticky left-60 bg-gray-50 dark:bg-gray-800 z-20 w-24 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Jabatan</th>
                    {dates.map((d) => (
                        <th key={d.toISOString()} className={`px-2 py-4 text-center min-w-[60px] border-l border-gray-200 dark:border-gray-700 ${d.toISOString().split('T')[0] === todayStr ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}`}>
                            <div className="flex flex-col">
                                <span className="text-[9px] opacity-70 mb-0.5">{daysOfWeek[d.getDay()]}</span>
                                <span className="text-sm font-bold">{d.getDate()}</span>
                            </div>
                        </th>
                    ))}
                    <th className="px-4 py-4 text-center border-l border-gray-200 dark:border-gray-700">Hadir</th>
                    <th className="px-4 py-4 text-center border-l border-gray-200 dark:border-gray-700">Lembur</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {projectEmployees.length === 0 && (
                        <tr>
                            <td colSpan={dates.length + 5} className="px-4 py-12 text-center text-gray-500 italic">
                                Belum ada karyawan. Tambahkan karyawan melalui tombol "Kelola Karyawan".
                            </td>
                        </tr>
                    )}
                    {projectEmployees.map((emp, idx) => {
                        const record = localRecords.find(r => r.employeeId === emp.id) || { employeeId: emp.id, days: {} };
                        
                        let totalPresence = 0;
                        let totalOvertime = 0;

                        const dateCells = dates.map(d => {
                            const dateStr = d.toISOString().split('T')[0];
                            const dayData = record.days[dateStr];
                            const isPresent = dayData?.isPresent || false;
                            const overtime = dayData?.overtimeHours || 0;
                            
                            if(isPresent) totalPresence++;
                            totalOvertime += overtime;

                            return (
                                <td 
                                    key={dateStr} 
                                    className={`text-center border-l border-gray-50 dark:border-gray-700/50 align-top py-3 ${dateStr === todayStr ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}
                                >
                                    <div className="flex flex-col items-center gap-1.5 min-h-[40px] justify-center">
                                        {/* Presence Toggle */}
                                        <div 
                                            onClick={() => (isEditing || dateStr === todayStr) && toggleAttendance(emp.id, dateStr)}
                                            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm ${(isEditing || dateStr === todayStr) ? 'cursor-pointer hover:scale-110' : ''} ${isPresent ? 'bg-green-500 text-white shadow-green-200 dark:shadow-none' : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500'}`}
                                        >
                                            {isPresent ? <Check className="w-5 h-5" /> : <span className="text-xs font-bold">.</span>}
                                        </div>

                                        {/* Overtime Input/Display */}
                                        {isEditing ? (
                                            <div className="flex items-center gap-0.5">
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    max="24"
                                                    value={overtime === 0 ? '' : overtime}
                                                    onChange={(e) => updateOvertime(emp.id, dateStr, parseInt(e.target.value) || 0)}
                                                    placeholder="0"
                                                    className="w-9 text-center text-[10px] border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded focus:ring-1 focus:ring-brand-500 outline-none p-0.5"
                                                    title="Jam Lembur"
                                                />
                                            </div>
                                        ) : (
                                            overtime > 0 && (
                                                <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 shadow-sm" title="Jam Lembur">
                                                    <Clock className="w-3 h-3" />
                                                    {overtime}
                                                </span>
                                            )
                                        )}
                                    </div>
                                </td>
                            );
                        });

                        return (
                            <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="hidden md:table-cell px-4 py-3 sticky left-0 bg-white dark:bg-gray-800 text-center font-bold text-gray-400 dark:text-gray-500 align-middle shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] z-10">{idx + 1}</td>
                                <td className="px-4 py-3 sticky left-0 md:left-12 bg-white dark:bg-gray-800 font-bold text-gray-800 dark:text-gray-100 align-middle shadow-[1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.05)] z-10">
                                    <div className="truncate w-24 md:w-auto">{emp.name}</div>
                                    <div className="md:hidden text-[10px] text-gray-400 font-normal truncate w-24">{emp.position}</div>
                                </td>
                                <td className="hidden md:table-cell px-4 py-3 sticky left-60 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium align-middle shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10">{emp.position}</td>
                                {dateCells}
                                <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white border-l border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 align-middle">{totalPresence}</td>
                                <td className="px-4 py-3 text-center font-bold text-orange-600 dark:text-orange-400 border-l border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 align-middle">{totalOvertime > 0 ? `${totalOvertime}j` : '-'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>

        {/* PRINT LAYOUT FOR ATTENDANCE */}
        <div className="hidden print-only">
             <div className="mb-6">
                <h1 className="text-2xl font-bold uppercase">{state.companyProfile.name}</h1>
                <p className="text-sm">{state.companyProfile.address}</p>
                <div className="border-b-2 border-black my-4"></div>
                
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-xl font-bold uppercase">Laporan Absensi & Lembur</h2>
                        <p>Proyek: {currentProject?.name}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold">{currentPeriod?.name}</p>
                        <p>{state.companyProfile.city}, {new Date().toLocaleDateString('id-ID')}</p>
                    </div>
                </div>
             </div>

             <table className="w-full text-xs border border-black border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black px-1 py-2 text-center w-8">No</th>
                        <th className="border border-black px-2 py-2 text-left">Nama Karyawan</th>
                        <th className="border border-black px-1 py-2 text-center">Pos</th>
                        {dates.map((d) => (
                            <th key={d.toISOString()} className="border border-black px-1 py-1 text-center min-w-[30px]">
                                <div>
                                    <span className="block text-[8px]">{daysOfWeek[d.getDay()]}</span>
                                    <span>{d.getDate()}</span>
                                </div>
                            </th>
                        ))}
                        <th className="border border-black px-1 py-2 text-center w-10">Total</th>
                        <th className="border border-black px-1 py-2 text-center w-10">Lembur</th>
                    </tr>
                </thead>
                <tbody>
                    {projectEmployees.map((emp, idx) => {
                        const record = localRecords.find(r => r.employeeId === emp.id) || { employeeId: emp.id, days: {} };
                        
                        let totalPresence = 0;
                        let totalOvertime = 0;

                        return (
                            <tr key={emp.id}>
                                <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
                                <td className="border border-black px-2 py-1 font-medium uppercase">{emp.name}</td>
                                <td className="border border-black px-1 py-1 text-center">{emp.position}</td>
                                {dates.map(d => {
                                    const dateStr = d.toISOString().split('T')[0];
                                    const dayData = record.days[dateStr];
                                    const isPresent = dayData?.isPresent || false;
                                    const overtime = dayData?.overtimeHours || 0;
                                    
                                    if(isPresent) totalPresence++;
                                    totalOvertime += overtime;

                                    return (
                                        <td key={dateStr} className="border border-black px-1 py-1 text-center">
                                            <div className="flex flex-col items-center">
                                                <span>{isPresent ? '✓' : '-'}</span>
                                                {overtime > 0 && <span className="text-[8px] font-bold">({overtime})</span>}
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="border border-black px-1 py-1 text-center font-bold">{totalPresence}</td>
                                <td className="border border-black px-1 py-1 text-center font-bold">{totalOvertime > 0 ? totalOvertime : '-'}</td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>

             <div className="mt-8 flex justify-end">
                <div className="text-center w-48">
                    <p className="mb-16">Mengetahui,</p>
                    <p className="font-bold underline">{state.companyProfile.director}</p>
                    <p>Direktur</p>
                </div>
             </div>
        </div>
      </>
      )}
    </div>
  );
};