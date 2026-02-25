import React, { useRef, useState } from 'react';
import { AppState, Employee, DailyAttendance } from '../types';
import { Download, Printer, Edit2, Save, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import { terbilang } from '../utils';

interface PayrollPageProps {
  state: AppState;
  onUpdateEmployee?: (emp: Employee) => void;
}

export const PayrollPage: React.FC<PayrollPageProps> = ({ state, onUpdateEmployee }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriod = state.periods.find(p => p.id === currentProject?.currentPeriodId);
  const records = state.attendance[currentPeriod?.id || ''] || [];
  const [isEditingRates, setIsEditingRates] = useState(false);
  
  // 'slips' = individual slips (print-only shows loops of slips)
  // 'recap' = summary table (print-only shows table)
  const [printMode, setPrintMode] = useState<'slips' | 'recap'>('slips');
  
  const downloadSlip = async (empId: string) => {
    const element = document.getElementById(`slip-${empId}`);
    if (!element) return;

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 2 // Higher quality
        });
        
        const link = document.createElement('a');
        link.download = `Slip_Gaji_${state.employees.find(e=>e.id===empId)?.name}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
    } catch (err) {
        console.error("Error generating slip", err);
        alert("Gagal membuat slip gaji");
    }
  };

  const handlePrintSlips = () => {
      setPrintMode('slips');
      setTimeout(() => {
        window.print();
      }, 100);
  };

  const handlePrintRecap = () => {
      setPrintMode('recap');
      setTimeout(() => {
        window.print();
      }, 100);
  };

  const updateRate = (emp: Employee, field: 'dailyRate' | 'overtimeRate', value: string) => {
      if(onUpdateEmployee) {
          onUpdateEmployee({
              ...emp,
              [field]: parseInt(value) || 0
          });
      }
  };

  // Filter employees for the current project
  const projectEmployees = state.employees.filter(e => e.projectId === state.currentProjectId);

  const payrollData = projectEmployees.map(emp => {
    const record = records.find(r => r.employeeId === emp.id);
    
    let workDays = 0;
    let overtimeHours = 0;

    if (record) {
      Object.values(record.days).forEach((day: DailyAttendance) => {
        if (day.isPresent) workDays++;
        overtimeHours += day.overtimeHours;
      });
    }

    const basicSalary = workDays * emp.dailyRate;
    const overtimeSalary = overtimeHours * emp.overtimeRate;
    const totalSalary = basicSalary + overtimeSalary;

    return {
      emp,
      workDays,
      overtimeHours,
      basicSalary,
      overtimeSalary,
      totalSalary
    };
  });

  const grandTotal = payrollData.reduce((acc, curr) => acc + curr.totalSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end no-print">
        <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Daftar Gaji (Payroll)</h2>
            <p className="text-gray-500 dark:text-gray-400">Perhitungan upah & download slip per karyawan</p>
        </div>
        <div className="text-right flex flex-col md:flex-row items-end gap-4">
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Pengeluaran Gaji</p>
                <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">Rp {grandTotal.toLocaleString('id-ID')}</p>
            </div>
            <div className="flex gap-2 mb-1">
                 <button 
                    onClick={() => setIsEditingRates(!isEditingRates)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors h-10 ${isEditingRates ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                >
                    {isEditingRates ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                    {isEditingRates ? 'Selesai Edit' : 'Atur Gaji & Lembur'}
                </button>
                <button 
                    onClick={handlePrintRecap}
                    className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors h-10"
                >
                    <FileText className="w-4 h-4" />
                    Cetak Rekap
                </button>
                <button 
                    onClick={handlePrintSlips}
                    className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors h-10"
                >
                    <Printer className="w-4 h-4" />
                    Cetak Semua Slip
                </button>
            </div>
        </div>
      </div>

      {/* RECAP HEADER (Visible only when printMode is 'recap') */}
      <div className={`hidden ${printMode === 'recap' ? 'print-only' : ''} mb-6`}>
        <h1 className="text-2xl font-bold uppercase">{state.companyProfile.name}</h1>
        <p className="text-sm">{state.companyProfile.address}</p>
        <div className="border-b-2 border-black my-4"></div>
        <div className="flex justify-between items-end mb-4">
            <div>
                <h2 className="text-xl font-bold uppercase">Rekapitulasi Gaji Karyawan</h2>
                <p>Proyek: {currentProject?.name}</p>
            </div>
            <div className="text-right">
                <p className="font-bold">{currentPeriod?.name}</p>
                <p>{state.companyProfile.city}, {new Date().toLocaleDateString('id-ID')}</p>
            </div>
        </div>
      </div>

      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${printMode === 'slips' ? 'no-print' : ''} ${printMode === 'recap' ? 'print:border-black print:shadow-none' : ''}`}>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase text-xs font-semibold print:bg-gray-200 print:text-black">
                    <tr>
                        <th className="px-4 py-3 w-12 text-center border-b border-gray-200 dark:border-gray-700 print:border-black">No</th>
                        <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 print:border-black">Nama</th>
                        <th className="px-4 py-3 w-20 text-center border-b border-gray-200 dark:border-gray-700 print:border-black">Hari</th>
                        <th className="px-4 py-3 text-right border-b border-gray-200 dark:border-gray-700 print:border-black">Gaji / Hari</th>
                        <th className="px-4 py-3 w-20 text-center border-b border-gray-200 dark:border-gray-700 print:border-black">Jam OT</th>
                        <th className="px-4 py-3 text-right border-b border-gray-200 dark:border-gray-700 print:border-black">Lembur / Jam</th>
                        <th className="px-4 py-3 text-right border-b border-gray-200 dark:border-gray-700 print:border-black">Total Gaji</th>
                        <th className="px-4 py-3 text-right border-b border-gray-200 dark:border-gray-700 print:border-black">Total Lembur</th>
                        <th className="px-4 py-3 text-right bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700 print:bg-white print:border-black">Total Terima</th>
                        <th className="px-4 py-3 text-center border-b border-gray-200 dark:border-gray-700 no-print">Slip</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 print:divide-black">
                    {payrollData.length === 0 && (
                        <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-gray-500 italic">Belum ada karyawan di proyek ini.</td>
                        </tr>
                    )}
                    {payrollData.map((row, idx) => (
                        <tr key={row.emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 print:hover:bg-transparent">
                            <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 print:text-black">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white print:text-black">
                                {row.emp.name}
                                <div className="text-xs text-gray-400 font-normal print:text-gray-600">{row.emp.position}</div>
                            </td>
                            <td className="px-4 py-3 text-center dark:text-gray-300">{row.workDays}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 print:text-black">
                                {isEditingRates ? (
                                    <input 
                                        type="number" 
                                        className="w-24 px-2 py-1 text-right border border-brand-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={row.emp.dailyRate}
                                        onChange={(e) => updateRate(row.emp, 'dailyRate', e.target.value)}
                                    />
                                ) : (
                                    row.emp.dailyRate.toLocaleString('id-ID')
                                )}
                            </td>
                            <td className="px-4 py-3 text-center dark:text-gray-300">{row.overtimeHours}</td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300 print:text-black">
                                {isEditingRates ? (
                                    <input 
                                        type="number" 
                                        className="w-24 px-2 py-1 text-right border border-brand-300 dark:border-gray-600 dark:bg-gray-700 rounded focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={row.emp.overtimeRate}
                                        onChange={(e) => updateRate(row.emp, 'overtimeRate', e.target.value)}
                                    />
                                ) : (
                                    row.emp.overtimeRate > 0 ? row.emp.overtimeRate.toLocaleString('id-ID') : '-'
                                )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium dark:text-gray-200">
                                {row.basicSalary.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-right font-medium dark:text-gray-200">
                                {row.overtimeSalary > 0 ? row.overtimeSalary.toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-brand-700 dark:text-brand-400 bg-blue-50/30 dark:bg-blue-900/10 print:bg-transparent print:text-black">
                                {row.totalSalary.toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-center no-print">
                                <button 
                                    onClick={() => downloadSlip(row.emp.id)}
                                    className="p-1 text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400 transition-colors"
                                    title="Download Slip JPG"
                                >
                                    <Download className="w-5 h-5" />
                                </button>
                                
                                {/* Hidden Slip Template for Rendering JPG only (Hidden from Print) */}
                                <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none no-print">
                                    <div id={`slip-${row.emp.id}`} className="w-[600px] bg-white p-8 border border-gray-900 text-slate-900">
                                        {/* Same template as below, but for html2canvas targeting */}
                                         <div className="border-b-2 border-gray-900 pb-4 mb-4 flex justify-between items-center">
                                            <div>
                                                <h1 className="text-2xl font-bold uppercase tracking-wider">Slip Gaji</h1>
                                                <p className="text-sm font-bold text-gray-600">{state.companyProfile.name}</p>
                                            </div>
                                            <div className="text-right text-xs">
                                                <p>{currentPeriod?.name}</p>
                                                <p>{state.companyProfile.city}, {new Date().toLocaleDateString('id-ID')}</p>
                                            </div>
                                        </div>
                                        {/* ... (simplified body for JPG generator reuse logic) ... */}
                                        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-gray-500 text-xs uppercase">Nama Karyawan</p>
                                                <p className="font-bold text-lg">{row.emp.name}</p>
                                                <p className="text-gray-600">{row.emp.position}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-500 text-xs uppercase">Project</p>
                                                <p className="font-medium">{currentProject?.name}</p>
                                            </div>
                                        </div>
                                        <table className="w-full text-sm mb-6 border border-gray-300">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 text-left border-r border-gray-300">Deskripsi</th>
                                                    <th className="p-2 text-center border-r border-gray-300">Unit</th>
                                                    <th className="p-2 text-right border-r border-gray-300">Rate</th>
                                                    <th className="p-2 text-right">Jumlah</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-gray-300">
                                                    <td className="p-2 border-r border-gray-300">Gaji Pokok</td>
                                                    <td className="p-2 text-center border-r border-gray-300">{row.workDays} Hari</td>
                                                    <td className="p-2 text-right border-r border-gray-300">{row.emp.dailyRate.toLocaleString('id-ID')}</td>
                                                    <td className="p-2 text-right font-medium">{row.basicSalary.toLocaleString('id-ID')}</td>
                                                </tr>
                                                {row.overtimeHours > 0 && (
                                                    <tr className="border-b border-gray-300">
                                                        <td className="p-2 border-r border-gray-300">Lembur (Overtime)</td>
                                                        <td className="p-2 text-center border-r border-gray-300">{row.overtimeHours} Jam</td>
                                                        <td className="p-2 text-right border-r border-gray-300">{row.emp.overtimeRate.toLocaleString('id-ID')}</td>
                                                        <td className="p-2 text-right font-medium">{row.overtimeSalary.toLocaleString('id-ID')}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                         <div className="bg-gray-100 p-2 italic text-gray-700 text-xs mb-4 border-l-2 border-gray-800">
                                            Terbilang: # {terbilang(row.totalSalary)} rupiah #
                                        </div>
                                        <div className="flex justify-between items-center pt-4 border-t-2 border-gray-900">
                                            <div className="text-sm italic text-gray-500">
                                                Diterima oleh, <br/><br/><br/>
                                                ({row.emp.name})
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-gray-500 uppercase font-bold">Total Diterima</p>
                                                <p className="text-3xl font-bold text-gray-900">Rp {row.totalSalary.toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 print:bg-white print:border-t-2 print:border-black">
                    <tr>
                        <td colSpan={8} className="px-4 py-4 text-right font-bold text-gray-900 dark:text-white uppercase">Grand Total</td>
                        <td className="px-4 py-4 text-right font-bold text-brand-700 dark:text-brand-400 text-lg print:text-black">
                            Rp {grandTotal.toLocaleString('id-ID')}
                        </td>
                        <td className="no-print"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        {isEditingRates && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm italic border-t border-yellow-200 dark:border-yellow-800 no-print">
                * Anda sedang dalam mode edit tarif gaji. Perubahan otomatis tersimpan. Klik "Selesai Edit" untuk kembali.
            </div>
        )}
      </div>

      {/* RECAP FOOTER SIGNATURE (Visible only when printMode is 'recap') */}
      <div className={`hidden ${printMode === 'recap' ? 'print-only' : ''} mt-8 flex justify-end`}>
         <div className="text-center w-48">
            <p className="mb-16">Mengetahui,</p>
            <p className="font-bold underline">{state.companyProfile.director}</p>
            <p>Direktur</p>
         </div>
      </div>

      {/* PRINT SLIPS LAYOUT - Visible only when printing AND mode is 'slips' */}
      <div className={`hidden ${printMode === 'slips' ? 'print-only' : ''}`}>
        {payrollData.map((row) => (
            <div key={row.emp.id} className="page-break w-full max-w-2xl mx-auto pt-8">
                 <div className="border-2 border-gray-800 p-8 bg-white">
                    <div className="border-b-2 border-gray-900 pb-4 mb-4 flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold uppercase tracking-wider">Slip Gaji</h1>
                            <p className="text-sm font-bold text-gray-600">{state.companyProfile.name}</p>
                        </div>
                        <div className="text-right text-xs">
                            <p className="font-bold">{currentPeriod?.name}</p>
                            <p>{state.companyProfile.city}, {new Date().toLocaleDateString('id-ID')}</p>
                        </div>
                    </div>
                    
                    <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs uppercase">Nama Karyawan</p>
                            <p className="font-bold text-lg uppercase">{row.emp.name}</p>
                            <p className="text-gray-600">{row.emp.position}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-500 text-xs uppercase">Project</p>
                            <p className="font-medium">{currentProject?.name}</p>
                        </div>
                    </div>

                    <table className="w-full text-sm mb-6 border border-gray-300">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2 text-left border-r border-gray-300">Deskripsi</th>
                                <th className="p-2 text-center border-r border-gray-300">Unit</th>
                                <th className="p-2 text-right border-r border-gray-300">Rate</th>
                                <th className="p-2 text-right">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-gray-300">
                                <td className="p-2 border-r border-gray-300">Gaji Pokok</td>
                                <td className="p-2 text-center border-r border-gray-300">{row.workDays} Hari</td>
                                <td className="p-2 text-right border-r border-gray-300">{row.emp.dailyRate.toLocaleString('id-ID')}</td>
                                <td className="p-2 text-right font-medium">{row.basicSalary.toLocaleString('id-ID')}</td>
                            </tr>
                            {row.overtimeHours > 0 && (
                                <tr className="border-b border-gray-300">
                                    <td className="p-2 border-r border-gray-300">Lembur (Overtime)</td>
                                    <td className="p-2 text-center border-r border-gray-300">{row.overtimeHours} Jam</td>
                                    <td className="p-2 text-right border-r border-gray-300">{row.emp.overtimeRate.toLocaleString('id-ID')}</td>
                                    <td className="p-2 text-right font-medium">{row.overtimeSalary.toLocaleString('id-ID')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="bg-gray-100 p-2 italic text-gray-700 text-xs mb-4 border-l-2 border-gray-800">
                        Terbilang: # {terbilang(row.totalSalary)} rupiah #
                    </div>

                    <div className="flex justify-between items-center pt-8 border-t-2 border-gray-900 mt-8">
                        <div className="text-sm italic text-gray-500 text-center">
                            <p>Diterima oleh,</p>
                            <br/><br/><br/>
                            <p className="font-bold underline">({row.emp.name})</p>
                        </div>
                        <div className="text-center">
                             <p className="text-xs text-gray-500">Mengetahui,</p>
                             <br/><br/><br/>
                             <p className="font-bold underline">{state.companyProfile.director}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500 uppercase font-bold">Total Diterima</p>
                            <p className="text-2xl font-bold text-gray-900">Rp {row.totalSalary.toLocaleString('id-ID')}</p>
                        </div>
                    </div>
                 </div>
            </div>
        ))}
      </div>
    </div>
  );
};