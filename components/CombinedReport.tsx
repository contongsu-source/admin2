import React, { useRef } from 'react';
import { AppState, DailyAttendance } from '../types';
import { Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { terbilang } from '../utils';

interface CombinedReportProps {
  state: AppState;
}

export const CombinedReport: React.FC<CombinedReportProps> = ({ state }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriod = state.periods.find(p => p.id === currentProject?.currentPeriodId);
  const materials = state.materials[currentPeriod?.id || ''] || [];
  const records = state.attendance[currentPeriod?.id || ''] || [];
  const { companyProfile } = state;

  // Calculate totals
  let totalWages = 0;
  records.forEach(record => {
    const emp = state.employees.find(e => e.id === record.employeeId);
    if (emp) {
      let workDays = 0;
      let overtimeHours = 0;
      Object.values(record.days).forEach((day: DailyAttendance) => {
        if (day.isPresent) workDays++;
        if (day.extraWorkDays) workDays += day.extraWorkDays;
        overtimeHours += day.overtimeHours;
      });
      const dailyRate = record.dailyRate ?? emp.dailyRate;
      const overtimeRate = record.overtimeRate ?? emp.overtimeRate;
      totalWages += (workDays * dailyRate) + (overtimeHours * overtimeRate);
    }
  });

  const totalMaterials = materials.reduce((acc, m) => acc + m.totalPrice, 0);
  const grandTotal = totalWages + totalMaterials;
  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Lengkap Periode</h2>
          <p className="text-gray-500 dark:text-gray-400">Cetak semua laporan jadi satu PDF</p>
        </div>
        <button 
          onClick={() => handlePrint()}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Cetak PDF
        </button>
      </div>

      <div ref={componentRef} className="bg-white p-8 border rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 print:p-0 print:border-0 print:shadow-none">
        {/* Attendance Content */}
        <div className="break-after-page mb-8">
            <h2 className="text-xl font-bold mb-4">Absensi Kerja</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-50">
                  <th className="py-2 px-4 text-left border border-gray-800">Karyawan</th>
                  <th className="py-2 px-4 text-center border border-gray-800">Hadir</th>
                  <th className="py-2 px-4 text-center border border-gray-800">Lembur (Jam)</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => {
                  const emp = state.employees.find(e => e.id === record.employeeId);
                  if (!emp) return null;
                  let workDays = 0;
                  let overtimeHours = 0;
                  Object.values(record.days).forEach((day: DailyAttendance) => {
                    if (day.isPresent) workDays++;
                    if (day.extraWorkDays) workDays += day.extraWorkDays;
                    overtimeHours += day.overtimeHours;
                  });
                  return (
                    <tr key={record.employeeId} className="border-b border-gray-800">
                      <td className="py-2 px-4 border border-gray-800">{emp.name}</td>
                      <td className="py-2 px-4 text-center border border-gray-800">{workDays}</td>
                      <td className="py-2 px-4 text-center border border-gray-800">{overtimeHours}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
        {/* Payroll Content */}
        <div className="break-after-page mb-8">
            <h2 className="text-xl font-bold mb-4">Penggajian</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-50">
                  <th className="py-2 px-4 text-left border border-gray-800">Karyawan</th>
                  <th className="py-2 px-4 text-right border border-gray-800">Gaji</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => {
                  const emp = state.employees.find(e => e.id === record.employeeId);
                  if (!emp) return null;
                  let workDays = 0;
                  let overtimeHours = 0;
                  Object.values(record.days).forEach((day: DailyAttendance) => {
                    if (day.isPresent) workDays++;
                    if (day.extraWorkDays) workDays += day.extraWorkDays;
                    overtimeHours += day.overtimeHours;
                  });
                  const dailyRate = record.dailyRate ?? emp.dailyRate;
                  const overtimeRate = record.overtimeRate ?? emp.overtimeRate;
                  const totalSalary = (workDays * dailyRate) + (overtimeHours * overtimeRate);
                  return (
                    <tr key={record.employeeId} className="border-b border-gray-800">
                      <td className="py-2 px-4 border border-gray-800">{emp.name}</td>
                      <td className="py-2 px-4 text-right border border-gray-800">{totalSalary.toLocaleString('id-ID')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
        {/* Material Content */}
        <div className="break-after-page mb-8">
            <h2 className="text-xl font-bold mb-4">Belanja Material</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-50">
                  <th className="py-2 px-4 text-left border border-gray-800">Barang</th>
                  <th className="py-2 px-4 text-right border border-gray-800">Total</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className="border-b border-gray-800">
                    <td className="py-2 px-4 border border-gray-800">{m.itemName}</td>
                    <td className="py-2 px-4 text-right border border-gray-800">{m.totalPrice.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        {/* Invoice Content */}
        <div>
            <h2 className="text-xl font-bold mb-4">Invoice</h2>
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white">
              <span>Grand Total</span>
              <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
            </div>
        </div>
      </div>
    </div>
  );
};
