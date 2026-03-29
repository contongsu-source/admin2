import React from 'react';
import { AppState } from '../types';
import { AttendancePage } from './AttendancePage';
import { PayrollPage } from './PayrollPage';
import { MaterialPage } from './MaterialPage';
import { InvoicePage } from './InvoicePage';

interface ConsolidatedReportProps {
  state: AppState;
}

export const ConsolidatedReport: React.FC<ConsolidatedReportProps> = ({ state }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Laporan Lengkap</h2>
        <button 
          onClick={handlePrint}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          Cetak Semua Laporan
        </button>
      </div>
      <div className="print:space-y-12">
        <div className="print:break-after-page"><AttendancePage state={state} onUpdate={() => {}} onAddEmployee={() => {}} onUpdateEmployee={() => {}} onDeleteEmployee={() => {}} onRemoveFromPeriod={() => {}} onAddToPeriod={() => {}} /></div>
        <div className="print:break-after-page"><PayrollPage state={state} hideSlips={true} onUpdateEmployee={() => {}} onUpdateAttendance={() => {}} /></div>
        <div className="print:break-after-page"><MaterialPage state={state} onUpdate={() => {}} /></div>
        <div className="print:break-after-page"><InvoicePage state={state} /></div>
      </div>
    </div>
  );
};
