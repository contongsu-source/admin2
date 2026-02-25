import React from 'react';
import { AppState, DailyAttendance } from '../types';
import { Printer } from 'lucide-react';
import { terbilang } from '../utils';

interface InvoicePageProps {
  state: AppState;
}

export const InvoicePage: React.FC<InvoicePageProps> = ({ state }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriod = state.periods.find(p => p.id === currentProject?.currentPeriodId);
  const materials = state.materials[state.currentProjectId] || [];
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
        overtimeHours += day.overtimeHours;
      });
      totalWages += (workDays * emp.dailyRate) + (overtimeHours * emp.overtimeRate);
    }
  });

  const totalMaterials = materials.reduce((acc, m) => acc + m.totalPrice, 0);
  const grandTotal = totalWages + totalMaterials;

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoice</h2>
          <p className="text-gray-500">Cetak tagihan proyek</p>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Cetak Invoice
        </button>
      </div>

      <div className="bg-white p-8 md:p-12 shadow-sm border border-gray-200 max-w-4xl mx-auto print:shadow-none print:border-0 print:p-0 print:w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-12 border-b pb-8">
            <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-red-600 tracking-tighter">SB<span className="text-blue-600">A</span></div>
                <div>
                    <h1 className="text-xl font-bold text-gray-800 uppercase">{companyProfile.name}</h1>
                    <p className="text-xs text-gray-500 font-bold tracking-wider uppercase">Jasa Kontruksi dan Perdagangan Umum</p>
                </div>
            </div>
            <div className="text-right text-xs text-gray-500 max-w-xs">
                Alamat: {companyProfile.address}
            </div>
        </div>

        {/* Recipient */}
        <div className="mb-12">
            <div className="text-sm text-gray-600 mb-1">Kepada Yth,</div>
            <div className="font-bold text-gray-900">{currentProject?.clientName}</div>
            <div className="text-sm text-gray-600">{currentProject?.clientAddress}</div>
        </div>

        <h2 className="text-center font-bold text-xl uppercase mb-8 tracking-widest border-b-2 border-gray-800 inline-block mx-auto w-full pb-2">Invoice</h2>

        {/* Table */}
        <table className="w-full text-sm mb-12 border border-gray-800">
            <thead>
                <tr className="border-b border-gray-800 bg-gray-50">
                    <th className="py-2 px-4 text-center border-r border-gray-800 w-12">No</th>
                    <th className="py-2 px-4 text-left border-r border-gray-800">Uraian</th>
                    <th className="py-2 px-4 text-center border-r border-gray-800 w-24">Qty</th>
                    <th className="py-2 px-4 text-right w-40">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                <tr className="border-b border-gray-800">
                    <td className="py-4 px-4 text-center border-r border-gray-800 align-top">1</td>
                    <td className="py-4 px-4 border-r border-gray-800 align-top">
                        <p className="font-medium">Pembayaran Jasa Proyek {currentPeriod?.name}</p>
                        <p className="text-gray-500 text-xs mt-1">(Terlampir)</p>
                    </td>
                    <td className="py-4 px-4 text-center border-r border-gray-800 align-top">1 LOT</td>
                    <td className="py-4 px-4 text-right font-medium align-top">
                        Rp {totalWages.toLocaleString('id-ID')}
                    </td>
                </tr>
                {totalMaterials > 0 && (
                    <tr className="border-b border-gray-800">
                        <td className="py-4 px-4 text-center border-r border-gray-800 align-top">2</td>
                        <td className="py-4 px-4 border-r border-gray-800 align-top">
                            <p className="font-medium">Pembelian Material</p>
                        </td>
                        <td className="py-4 px-4 text-center border-r border-gray-800 align-top">1 LOT</td>
                        <td className="py-4 px-4 text-right font-medium align-top">
                            Rp {totalMaterials.toLocaleString('id-ID')}
                        </td>
                    </tr>
                )}
                {/* Empty rows to fill space if needed, mimicking the PDF look */}
                <tr className="h-24 border-b border-gray-800">
                     <td className="border-r border-gray-800"></td>
                     <td className="border-r border-gray-800"></td>
                     <td className="border-r border-gray-800"></td>
                     <td></td>
                </tr>
            </tbody>
            <tfoot>
                <tr className="bg-gray-100 font-bold">
                    <td colSpan={3} className="py-3 px-4 text-right border-r border-gray-800">Total</td>
                    <td className="py-3 px-4 text-right">Rp {grandTotal.toLocaleString('id-ID')}</td>
                </tr>
            </tfoot>
        </table>

        {/* Footer */}
        <div className="mb-16">
            <div className="font-bold text-sm mb-2">Terbilang :</div>
            <div className="bg-gray-100 p-3 italic text-gray-700 text-sm border-l-4 border-gray-800">
                # {terbilang(grandTotal)} rupiah #
            </div>
        </div>

        <div className="flex justify-end mt-20">
            <div className="text-center">
                <p className="mb-20">{companyProfile.city}, {currentDate}</p>
                <p className="font-bold border-b border-gray-800 inline-block px-8 pb-1">{companyProfile.director}</p>
                <p className="text-sm mt-1">Direktur</p>
            </div>
        </div>
      </div>
    </div>
  );
};