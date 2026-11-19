import React, { useRef, useState } from 'react';
import { AppState, DailyAttendance } from '../types';
import { Printer, ArrowLeft, Check, Layers, Sliders, CheckSquare, Square, Building2, Calendar, FileText, CreditCard, FileDown } from 'lucide-react';
import { terbilang } from '../utils';
import { AttendancePage } from './AttendancePage';
import { PayrollPage } from './PayrollPage';
import { MaterialPage } from './MaterialPage';
import { InvoicePage } from './InvoicePage';
import { downloadElementAsPdf, triggerPrintWithPdfFallback } from '../pdfUtils';

interface ConsolidatedReportProps {
  state: AppState;
  onChangeView?: (view: string) => void;
}

export const ConsolidatedReport: React.FC<ConsolidatedReportProps> = ({ state, onChangeView }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriod = state.periods.find(p => p.id === currentProject?.currentPeriodId);
  const materials = state.materials[currentPeriod?.id || ''] || [];
  const records = state.attendance[currentPeriod?.id || ''] || [];
  const { companyProfile } = state;

  // View mode: 'single-page' (1 lembar terpadu) vs 'multi-page' (cetak semua halaman penuh)
  const [reportMode, setReportMode] = useState<'single-page' | 'multi-page'>('single-page');
  
  // Customization options for 1-Page
  const [paperSize, setPaperSize] = useState<'A4' | 'A4-landscape' | 'F4'>('A4');
  const [density, setDensity] = useState<'compact' | 'ultra' | 'normal'>('compact');
  const [includeAttendance, setIncludeAttendance] = useState(true);
  const [includePayroll, setIncludePayroll] = useState(true);
  const [includeMaterials, setIncludeMaterials] = useState(true);
  const [includeInvoice, setIncludeInvoice] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const singlePageRef = useRef<HTMLDivElement>(null);
  const multiPageRef = useRef<HTMLDivElement>(null);

  // Filter project workers who belong to this project
  const periodEmployeeIds = new Set(records.map(r => r.employeeId));
  const periodEmployees = state.employees.filter(e => periodEmployeeIds.has(e.id) && e.projectId === state.currentProjectId);

  // Calculate detailed worker figures
  let totalWagesBasic = 0;
  let totalWagesOvertime = 0;
  let totalCashAdvance = 0;
  let totalWagesNet = 0;

  const workerDetails = periodEmployees.map((emp, index) => {
    const record = records.find(r => r.employeeId === emp.id);
    let workDays = 0;
    let overtimeHours = 0;
    let extraWorkDays = 0;

    if (record) {
      const startDate = new Date(currentPeriod?.startDate || '').getTime();
      const endDateObj = new Date(currentPeriod?.endDate || '');
      endDateObj.setHours(23, 59, 59, 999);
      const endTimestamp = endDateObj.getTime();

      Object.values(record.days).forEach((day: DailyAttendance) => {
        const targetDate = new Date(day.date).getTime();
        if (targetDate >= startDate && targetDate <= endTimestamp) {
          if (day.isPresent) workDays++;
          if (day.extraWorkDays) {
            workDays += day.extraWorkDays;
            extraWorkDays += day.extraWorkDays;
          }
          overtimeHours += day.overtimeHours;
        }
      });
    }

    const dailyRate = record?.dailyRate ?? emp.dailyRate;
    const overtimeRate = record?.overtimeRate ?? emp.overtimeRate;
    const cashAdvance = record?.cashAdvance ?? 0;

    const basicSalary = workDays * dailyRate;
    const overtimeSalary = overtimeHours * overtimeRate;
    const grossSalary = basicSalary + overtimeSalary;
    const netSalary = grossSalary - cashAdvance;

    totalWagesBasic += basicSalary;
    totalWagesOvertime += overtimeSalary;
    totalCashAdvance += cashAdvance;
    totalWagesNet += netSalary;

    return {
      no: index + 1,
      emp,
      workDays,
      extraWorkDays,
      overtimeHours,
      dailyRate,
      overtimeRate,
      basicSalary,
      overtimeSalary,
      grossSalary,
      cashAdvance,
      netSalary
    };
  });

  const totalMaterials = materials.reduce((acc, m) => acc + m.totalPrice, 0);
  const grandTotal = totalWagesNet + totalCashAdvance + totalMaterials;
  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const docNo = `LPR-SBM/${new Date().getFullYear()}/${(currentPeriod?.name || '01').replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`;

  const getActiveReportElement = () =>
    reportMode === 'single-page' ? singlePageRef.current : multiPageRef.current;

  const getMappedPaperSize = () =>
    paperSize === 'A4' ? 'A4-portrait' : paperSize;

  const getPdfFilename = () =>
    `Laporan_Terpadu_${currentProject?.name || 'Proyek'}_${currentPeriod?.name || ''}`;

  const handleDownloadPdf = async () => {
    const el = getActiveReportElement();
    if (!el || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await downloadElementAsPdf(el, {
        filename: getPdfFilename(),
        paperSize: getMappedPaperSize(),
        preferSinglePage: reportMode === 'single-page',
      });
    } catch (err) {
      console.error('Gagal export PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    await triggerPrintWithPdfFallback({
      getElement: getActiveReportElement,
      pdfOptions: {
        filename: getPdfFilename(),
        paperSize: getMappedPaperSize(),
        preferSinglePage: reportMode === 'single-page',
      },
    });
  };

  // Dynamic styling based on density
  const getDensityClass = () => {
    if (density === 'ultra') {
      return {
        tableText: 'text-[9px] leading-tight',
        thPadding: 'py-1 px-1.5',
        tdPadding: 'py-1 px-1.5',
        headerText: 'text-xs',
        sectionGap: 'space-y-2',
        cardPadding: 'p-1.5'
      };
    }
    if (density === 'normal') {
      return {
        tableText: 'text-xs leading-normal',
        thPadding: 'py-2 px-2.5',
        tdPadding: 'py-2 px-2.5',
        headerText: 'text-sm',
        sectionGap: 'space-y-4',
        cardPadding: 'p-3'
      };
    }
    // Default 'compact'
    return {
      tableText: 'text-[10px] leading-snug',
      thPadding: 'py-1.5 px-2',
      tdPadding: 'py-1.5 px-2',
      headerText: 'text-xs',
      sectionGap: 'space-y-2.5',
      cardPadding: 'p-2'
    };
  };

  const dStyle = getDensityClass();

  // Page style setup for print
  const getPageStyle = () => {
    let sizeRule = 'A4 portrait';
    let marginRule = '6mm';
    if (paperSize === 'A4-landscape') {
      sizeRule = 'A4 landscape';
      marginRule = '5mm';
    } else if (paperSize === 'F4') {
      sizeRule = '215mm 330mm';
      marginRule = '7mm';
    }

    return `
      @media print {
        @page {
          size: ${sizeRule};
          margin: ${marginRule};
        }
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .single-page-wrapper {
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        .no-break {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }
    `;
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Print CSS */}
      <style dangerouslySetInnerHTML={{ __html: getPageStyle() }} />

      {/* Control Bar (Hidden when printing) */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm no-print space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            {onChangeView && (
              <button
                onClick={() => onChangeView('dashboard')}
                className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Kembali ke Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Cetak 1 Lembar Terpadu</h2>
                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Fit 1 Halaman
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Absensi Kerja, Penggajian, Material, dan Invoice dirangkum rapi & detail dalam 1 lembar cetak
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex-1 md:flex-none bg-accent-400 hover:bg-accent-500 disabled:opacity-60 text-brand-950 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <FileDown className="w-4 h-4" />
              {isExportingPdf ? 'Membuat PDF...' : 'Download PDF'}
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Cetak 1 Lembar Sekarang
            </button>
          </div>
        </div>

        {/* Options Toolbar */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Mode Switch */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Mode Tampilan</label>
            <div className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setReportMode('single-page')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all text-center ${
                  reportMode === 'single-page'
                    ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                1 Lembar Terpadu
              </button>
              <button
                type="button"
                onClick={() => setReportMode('multi-page')}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all text-center ${
                  reportMode === 'multi-page'
                    ? 'bg-white dark:bg-gray-800 text-accent-700 dark:text-accent-400 shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Multi Halaman
              </button>
            </div>
          </div>

          {/* Paper Size */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Ukuran Kertas</label>
            <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`py-1.5 px-1 text-xs font-medium rounded-lg text-center transition-all truncate ${
                  paperSize === 'A4'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="A4 Portrait (Standar)"
              >
                A4 Tegak
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('A4-landscape')}
                className={`py-1.5 px-1 text-xs font-medium rounded-lg text-center transition-all truncate ${
                  paperSize === 'A4-landscape'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="A4 Landscape (Mendatar - 2 Kolom)"
              >
                A4 Lebar
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('F4')}
                className={`py-1.5 px-1 text-xs font-medium rounded-lg text-center transition-all truncate ${
                  paperSize === 'F4'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="F4 / Folio (21.5 x 33 cm)"
              >
                F4 / Folio
              </button>
            </div>
          </div>

          {/* Density Scaling */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Kepadatan Teks (Fit 1 Halaman)</label>
            <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`py-1.5 px-1 text-xs font-medium rounded-lg text-center transition-all truncate ${
                  density === 'compact'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="Kompak Optimal (Rekomendasi)"
              >
                Kompak
              </button>
              <button
                type="button"
                onClick={() => setDensity('ultra')}
                className={`py-1.5 px-1 text-xs font-medium rounded-lg text-center transition-all truncate ${
                  density === 'ultra'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="Super Kompak (Untuk data banyak)"
              >
                Super Pas
              </button>
              <button
                type="button"
                onClick={() => setDensity('normal')}
                className={`py-1.5 px-1 text-xs font-medium rounded-lg text-center transition-all truncate ${
                  density === 'normal'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm font-bold'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title="Standar Luwes"
              >
                Standar
              </button>
            </div>
          </div>

          {/* Module Toggles */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">Centang Modul Tercetak</label>
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAttendance}
                  onChange={e => setIncludeAttendance(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                Absensi
              </label>
              <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePayroll}
                  onChange={e => setIncludePayroll(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                Gaji
              </label>
              <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMaterials}
                  onChange={e => setIncludeMaterials(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                Material
              </label>
              <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInvoice}
                  onChange={e => setIncludeInvoice(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                Invoice
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ======================= MODE 1: SINGLE-PAGE MASTER PRINT ======================= */}
      {reportMode === 'single-page' && (
        <div 
          ref={singlePageRef}
          className={`single-page-wrapper bg-white text-black p-6 md:p-8 mx-auto shadow-lg border border-gray-200 rounded-xl font-sans print:shadow-none print:border-0 print:p-0 print:w-full print:bg-white print:text-black ${
            paperSize === 'A4-landscape' ? 'max-w-5xl' : 'max-w-4xl'
          }`}
        >
          {/* Header Kop Perusahaan */}
          <div className="border-b-2 border-black pb-3 mb-3">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <div className="bg-gray-900 text-white font-black text-xl px-3 py-1.5 rounded tracking-tighter">
                  TK
                </div>
                <div>
                  <h1 className="text-base font-black uppercase tracking-wider text-black leading-tight">
                    {companyProfile.name || 'CV. SBM MANAGEMENT'}
                  </h1>
                  <p className="text-[9px] text-gray-500 leading-tight mt-0.5">{companyProfile.address}</p>
                </div>
              </div>
              <div className="text-right text-[10px]">
                <span className="inline-block bg-black text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded mb-1">
                  REKAPITULASI RESMI
                </span>
                <p className="font-mono text-[9px] text-gray-600">No: {docNo}</p>
                <p className="text-gray-600">Tgl Cetak: <span className="font-semibold">{currentDate}</span></p>
              </div>
            </div>

            {/* Sub-header Proyek & Periode */}
            <div className="mt-2 pt-2 border-t border-gray-300 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] bg-gray-50 p-2 rounded">
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold">Proyek</span>
                <span className="font-bold text-black uppercase">{currentProject?.name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold">Klien / Yth.</span>
                <span className="font-bold text-black truncate block">{currentProject?.clientName || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold">Periode Kerja</span>
                <span className="font-bold text-black">{currentPeriod?.name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[9px] uppercase font-bold">Rentang Tanggal</span>
                <span className="font-bold text-black text-[9px]">
                  {currentPeriod?.startDate || ''} s/d {currentPeriod?.endDate || ''}
                </span>
              </div>
            </div>
          </div>

          {/* Ringkasan Finansial Eksekutif (Card Bar) */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <div className="border border-gray-300 bg-gray-50 p-1.5 rounded text-center">
              <span className="block text-[8.5px] uppercase font-bold text-gray-500">Upah Tenaga Kerja</span>
              <span className="font-bold text-[11px] text-black">Rp {totalWagesNet.toLocaleString('id-ID')}</span>
            </div>
            <div className="border border-gray-300 bg-gray-50 p-1.5 rounded text-center">
              <span className="block text-[8.5px] uppercase font-bold text-gray-500">Material</span>
              <span className="font-bold text-[11px] text-black">Rp {totalMaterials.toLocaleString('id-ID')}</span>
            </div>
            <div className="border border-gray-300 bg-gray-50 p-1.5 rounded text-center">
              <span className="block text-[8.5px] uppercase font-bold text-gray-500">Kasbon / Potongan</span>
              <span className="font-bold text-[11px] text-red-600">
                {totalCashAdvance > 0 ? `Rp ${totalCashAdvance.toLocaleString('id-ID')}` : '-'}
              </span>
            </div>
            <div className="border-2 border-black bg-gray-900 text-white p-1.5 rounded text-center">
              <span className="block text-[8.5px] uppercase font-bold text-gray-200">GRAND TOTAL TAGIHAN</span>
              <span className="font-black text-[12px] text-white">Rp {grandTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className={dStyle.sectionGap}>

            {/* SECTIONS: When Landscape is chosen, render 2 columns side-by-side */}
            <div className={paperSize === 'A4-landscape' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>

              {/* COLUMN / SECTION LEFT: ABSENSI & PENGGAJIAN */}
              <div className="space-y-3">
                
                {/* 1. BAGIAN ABSENSI & PENGGAJIAN TERPADU */}
                {(includeAttendance || includePayroll) && (
                  <div className="no-break border border-black rounded overflow-hidden">
                    <div className="bg-gray-100 border-b border-black px-2 py-1 flex justify-between items-center">
                      <span className="font-bold text-[10.5px] uppercase tracking-wider text-black flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-black inline-block"></span>
                        1. DETAIL ABSENSI & UPAH TENAGA KERJA ({workerDetails.length} Orang)
                      </span>
                      <span className="text-[9px] font-semibold text-gray-600">
                        Total Upah Bersih: Rp {totalWagesNet.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <table className={`w-full ${dStyle.tableText} border-collapse`}>
                      <thead>
                        <tr className="bg-gray-50 border-b border-black text-gray-700">
                          <th className={`${dStyle.thPadding} text-center border-r border-gray-300 w-6 font-bold`}>No</th>
                          <th className={`${dStyle.thPadding} text-left border-r border-gray-300 font-bold`}>Nama Pekerja</th>
                          <th className={`${dStyle.thPadding} text-center border-r border-gray-300 font-bold`}>Pos</th>
                          {includeAttendance && (
                            <>
                              <th className={`${dStyle.thPadding} text-center border-r border-gray-300 font-bold`}>Hadir</th>
                              <th className={`${dStyle.thPadding} text-center border-r border-gray-300 font-bold`}>Lembur</th>
                            </>
                          )}
                          {includePayroll && (
                            <>
                              <th className={`${dStyle.thPadding} text-right border-r border-gray-300 font-bold`}>Tarif/Hr</th>
                              <th className={`${dStyle.thPadding} text-right border-r border-gray-300 font-bold`}>Gaji Kotor</th>
                              <th className={`${dStyle.thPadding} text-right border-r border-gray-300 font-bold`}>Kasbon</th>
                              <th className={`${dStyle.thPadding} text-right font-bold`}>Diterima Bersih</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {workerDetails.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-2 text-center text-gray-500 italic text-[10px]">
                              Belum ada pekerja pada periode ini
                            </td>
                          </tr>
                        ) : (
                          workerDetails.map(w => (
                            <tr key={w.emp.id} className="hover:bg-gray-50/50">
                              <td className={`${dStyle.tdPadding} text-center border-r border-gray-200 text-gray-500`}>{w.no}</td>
                              <td className={`${dStyle.tdPadding} font-bold border-r border-gray-200 uppercase`}>
                                {w.emp.name}
                              </td>
                              <td className={`${dStyle.tdPadding} text-center border-r border-gray-200 text-gray-600 text-[9px]`}>
                                {w.emp.position}
                              </td>
                              {includeAttendance && (
                                <>
                                  <td className={`${dStyle.tdPadding} text-center border-r border-gray-200 font-semibold`}>
                                    {w.workDays} hr
                                  </td>
                                  <td className={`${dStyle.tdPadding} text-center border-r border-gray-200 font-semibold text-orange-700`}>
                                    {w.overtimeHours > 0 ? `${w.overtimeHours}j` : '-'}
                                  </td>
                                </>
                              )}
                              {includePayroll && (
                                <>
                                  <td className={`${dStyle.tdPadding} text-right border-r border-gray-200 text-gray-600`}>
                                    {w.dailyRate.toLocaleString('id-ID')}
                                  </td>
                                  <td className={`${dStyle.tdPadding} text-right border-r border-gray-200`}>
                                    {w.grossSalary.toLocaleString('id-ID')}
                                  </td>
                                  <td className={`${dStyle.tdPadding} text-right border-r border-gray-200 text-red-600 font-semibold`}>
                                    {w.cashAdvance > 0 ? `-${w.cashAdvance.toLocaleString('id-ID')}` : '-'}
                                  </td>
                                  <td className={`${dStyle.tdPadding} text-right font-bold text-black`}>
                                    Rp {w.netSalary.toLocaleString('id-ID')}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                      {includePayroll && workerDetails.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-100 font-bold border-t border-black text-black">
                            <td colSpan={includeAttendance ? 5 : 3} className={`${dStyle.tdPadding} text-right uppercase border-r border-gray-300`}>
                              Subtotal Upah
                            </td>
                            <td className={`${dStyle.tdPadding} text-right border-r border-gray-300`}>
                              -
                            </td>
                            <td className={`${dStyle.tdPadding} text-right border-r border-gray-300`}>
                              Rp {workerDetails.reduce((sum, w) => sum + w.grossSalary, 0).toLocaleString('id-ID')}
                            </td>
                            <td className={`${dStyle.tdPadding} text-right border-r border-gray-300 text-red-600`}>
                              {totalCashAdvance > 0 ? `-Rp ${totalCashAdvance.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className={`${dStyle.tdPadding} text-right text-black font-black`}>
                              Rp {totalWagesNet.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>

              {/* COLUMN / SECTION RIGHT: MATERIAL & INVOICE */}
              <div className="space-y-3">
                
                {/* 2. BAGIAN MATERIAL */}
                {includeMaterials && (
                  <div className="no-break border border-black rounded overflow-hidden">
                    <div className="bg-gray-100 border-b border-black px-2 py-1 flex justify-between items-center">
                      <span className="font-bold text-[10.5px] uppercase tracking-wider text-black flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-black inline-block"></span>
                        2. DETAIL MATERIAL ({materials.length} Item)
                      </span>
                      <span className="text-[9px] font-semibold text-gray-600">
                        Subtotal: Rp {totalMaterials.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <table className={`w-full ${dStyle.tableText} border-collapse`}>
                      <thead>
                        <tr className="bg-gray-50 border-b border-black text-gray-700">
                          <th className={`${dStyle.thPadding} text-center border-r border-gray-300 w-6 font-bold`}>No</th>
                          <th className={`${dStyle.thPadding} text-left border-r border-gray-300 w-16 font-bold`}>Tgl</th>
                          <th className={`${dStyle.thPadding} text-left border-r border-gray-300 font-bold`}>Nama Barang / Material</th>
                          <th className={`${dStyle.thPadding} text-center border-r border-gray-300 w-12 font-bold`}>Vol</th>
                          <th className={`${dStyle.thPadding} text-center border-r border-gray-300 w-12 font-bold`}>Sat</th>
                          <th className={`${dStyle.thPadding} text-right border-r border-gray-300 w-20 font-bold`}>Harga</th>
                          <th className={`${dStyle.thPadding} text-right w-24 font-bold`}>Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {materials.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-2 text-center text-gray-500 italic text-[10px]">
                              Tidak ada data material di periode ini
                            </td>
                          </tr>
                        ) : (
                          materials.map((m, idx) => (
                            <tr key={m.id} className="hover:bg-gray-50/50">
                              <td className={`${dStyle.tdPadding} text-center border-r border-gray-200 text-gray-500`}>{idx + 1}</td>
                              <td className={`${dStyle.tdPadding} border-r border-gray-200 text-gray-600 text-[9px]`}>
                                {m.date ? m.date.slice(5) : '-'}
                              </td>
                              <td className={`${dStyle.tdPadding} font-semibold border-r border-gray-200 text-black uppercase truncate max-w-[180px]`}>
                                {m.itemName}
                                {m.location && <span className="ml-1 text-[8px] font-normal text-gray-600">({m.location})</span>}
                              </td>
                              <td className={`${dStyle.tdPadding} text-center border-r border-gray-200 font-medium`}>{m.quantity}</td>
                              <td className={`${dStyle.tdPadding} text-center border-r border-gray-200 text-gray-600 text-[9px]`}>{m.unit}</td>
                              <td className={`${dStyle.tdPadding} text-right border-r border-gray-200 text-gray-600`}>
                                {m.unitPrice.toLocaleString('id-ID')}
                              </td>
                              <td className={`${dStyle.tdPadding} text-right font-bold text-black`}>
                                {m.totalPrice.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {materials.length > 0 && (
                        <tfoot>
                          <tr className="bg-gray-100 font-bold border-t border-black text-black">
                            <td colSpan={6} className={`${dStyle.tdPadding} text-right uppercase border-r border-gray-300`}>
                              Subtotal Material
                            </td>
                            <td className={`${dStyle.tdPadding} text-right text-black font-black`}>
                              Rp {totalMaterials.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}

                {/* 3. BAGIAN REKAPITULASI INVOICE & TAGIHAN */}
                {includeInvoice && (
                  <div className="no-break border border-black rounded overflow-hidden">
                    <div className="bg-gray-100 border-b border-black px-2 py-1 flex justify-between items-center">
                      <span className="font-bold text-[10.5px] uppercase tracking-wider text-black flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-black inline-block"></span>
                        3. REKAPITULASI INVOICE & TAGIHAN PROYEK
                      </span>
                      <span className="text-[9px] font-bold text-black">
                        TERMIN / PENAGIHAN RESMI
                      </span>
                    </div>

                    <div className="p-2 space-y-2">
                      <table className={`w-full ${dStyle.tableText} border-collapse border border-gray-300`}>
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-300">
                            <th className="py-1 px-2 text-left border-r border-gray-300 font-bold">Uraian Komponen</th>
                            <th className="py-1 px-2 text-center border-r border-gray-300 w-16 font-bold">Volume</th>
                            <th className="py-1 px-2 text-right font-bold w-28">Jumlah (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="py-1 px-2 border-r border-gray-200 font-medium">1. Upah Tenaga Kerja Bersih</td>
                            <td className="py-1 px-2 text-center border-r border-gray-200 text-gray-600">1 LOT</td>
                            <td className="py-1 px-2 text-right font-semibold">{totalWagesNet.toLocaleString('id-ID')}</td>
                          </tr>
                          {totalCashAdvance > 0 && (
                            <tr>
                              <td className="py-1 px-2 border-r border-gray-200 font-medium">2. Pengembalian Kasbon Pekerja</td>
                              <td className="py-1 px-2 text-center border-r border-gray-200 text-gray-600">1 LOT</td>
                              <td className="py-1 px-2 text-right font-semibold">{totalCashAdvance.toLocaleString('id-ID')}</td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-1 px-2 border-r border-gray-200 font-medium">
                              {totalCashAdvance > 0 ? '3' : '2'}. Pembelian Material Proyek
                            </td>
                            <td className="py-1 px-2 text-center border-r border-gray-200 text-gray-600">1 LOT</td>
                            <td className="py-1 px-2 text-right font-semibold">{totalMaterials.toLocaleString('id-ID')}</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-900 text-white font-black border-t-2 border-black">
                            <td colSpan={2} className="py-1.5 px-2 text-right uppercase tracking-wider text-[10px]">
                              GRAND TOTAL TAGIHAN
                            </td>
                            <td className="py-1.5 px-2 text-right text-[11px] text-white">
                              Rp {grandTotal.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Terbilang & Catatan Bank */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px] pt-1">
                        <div className="border border-gray-300 p-1.5 rounded bg-gray-50">
                          <span className="font-bold text-gray-600 block uppercase text-[8px]">Terbilang Pembayaran:</span>
                          <span className="italic font-medium text-black">
                            # {terbilang(grandTotal).toUpperCase()} RUPIAH #
                          </span>
                        </div>
                        <div className="border border-gray-300 p-1.5 rounded bg-gray-50 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-gray-600 block uppercase text-[8px]">Transfer Bank Pembayaran:</span>
                            <span className="font-bold text-black block">BCA: 409-333-777-1</span>
                            <span className="text-gray-500 text-[8px]">A/N: {companyProfile.name.toUpperCase()}</span>
                          </div>
                          <div className="text-right border-l pl-2 border-gray-300">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[8.5px]">
                              VERIFIED SBM
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* LEMBAR PENGESAHAN & TANDA TANGAN */}
            <div className="no-break border-t-2 border-black pt-3 mt-4">
              <div className="flex justify-between items-end text-[10px]">
                {/* Dibuat Oleh */}
                <div className="text-center w-40">
                  <p className="text-gray-500 font-medium">Dibuat Oleh,</p>
                  <p className="text-[9px] text-gray-400 mb-8">Pelaksana Lapangan / Mandor</p>
                  <div className="h-10 border-b border-black w-32 mx-auto"></div>
                  <p className="font-bold mt-1 text-black uppercase">( ........................................ )</p>
                </div>

                {/* Verifikasi Sistem */}
                <div className="hidden sm:block text-center text-[8.5px] text-gray-400">
                  <p className="font-mono">Dicetak otomatis dari Sistem SBM Management</p>
                  <p className="font-mono">Dokumen 1 Lembar Sah & Lengkap</p>
                </div>

                {/* Mengetahui Direktur */}
                <div className="text-center w-44">
                  <p className="text-gray-500 font-medium">{companyProfile.city || 'Kota'}, {currentDate}</p>
                  <p className="text-[9px] text-gray-400 font-bold mb-1">Mengetahui & Menyetujui,</p>
                  {companyProfile.signature ? (
                    <img 
                      src={companyProfile.signature} 
                      alt="Tanda Tangan" 
                      className="h-14 mx-auto object-contain my-1" 
                    />
                  ) : (
                    <div className="h-14 border-b border-black w-32 mx-auto" />
                  )}
                  <p className="font-bold text-black underline uppercase">{companyProfile.director || 'Direktur'}</p>
                  <p className="text-[9px] text-gray-500">Direktur / Pimpinan</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================= MODE 2: MULTI-PAGE FULL REPORTS ======================= */}
      {reportMode === 'multi-page' && (
        <div className="space-y-8">
          <div className="p-3 bg-accent-50 dark:bg-accent-900/20 text-accent-900 dark:text-accent-300 border border-accent-200 dark:border-accent-800/40 rounded-xl text-xs flex items-center justify-between no-print">
            <span>Anda sedang melihat Mode Multi-Halaman. Setiap laporan dicetak di lembar terpisah.</span>
            <button
              onClick={() => setReportMode('single-page')}
              className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg font-bold"
            >
              Kembali ke Mode 1 Lembar
            </button>
          </div>

          <div ref={multiPageRef} className="print:space-y-12">
            <div className="print:break-after-page">
              <AttendancePage 
                state={state} 
                initialViewMode="table"
                onUpdate={() => {}} 
                onAddEmployee={() => {}} 
                onUpdateEmployee={() => {}} 
                onDeleteEmployee={() => {}} 
                onRemoveFromPeriod={() => {}} 
                onAddToPeriod={() => {}} 
              />
            </div>
            <div className="print:break-after-page">
              <PayrollPage 
                state={state} 
                hideSlips={true} 
                initialPrintMode="recap"
                onUpdateEmployee={() => {}} 
                onUpdateAttendance={() => {}} 
              />
            </div>
            <div className="print:break-after-page">
              <MaterialPage state={state} onUpdate={() => {}} />
            </div>
            <div className="print:break-after-page">
              <InvoicePage state={state} onChangeView={onChangeView || (() => {})} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
