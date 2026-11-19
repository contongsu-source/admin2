import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, DailyAttendance } from '../types';
import {
  CheckSquare,
  Square,
  Search,
  Printer,
  Download,
  Layers,
  Users,
  ShoppingCart,
  Calculator,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { downloadElementAsPdf, triggerPrintWithPdfFallback } from '../pdfUtils';

interface ProjectSummaryPageProps {
  state: AppState;
  onChangeView?: (view: string) => void;
}

interface PeriodBreakdown {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  grossPayroll: number;
  netPayroll: number;
  cashAdvance: number;
  materialCost: number;
  materialCount: number;
  totalCost: number;
}

interface ProjectCostSummary {
  projectId: string;
  name: string;
  clientName: string;
  status: 'Aktif' | 'Selesai' | 'Pending';
  periodCount: number;
  workerCount: number;
  grossPayroll: number;
  netPayroll: number;
  cashAdvance: number;
  materialCost: number;
  materialCount: number;
  totalCost: number;
  budget: number;
  remainingBudget: number;
  periodBreakdowns: PeriodBreakdown[];
}

export const ProjectSummaryPage: React.FC<ProjectSummaryPageProps> = ({ state }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sbm_marked_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to read marked projects from localStorage', e);
    }
    return state.projects.map(p => p.id);
  });

  const [scopeMode, setScopeMode] = useState<'all_periods' | 'active_period'>('all_periods');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Aktif' | 'Pending' | 'Selesai'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Sync valid selected IDs if projects change
  useEffect(() => {
    localStorage.setItem('sbm_marked_projects', JSON.stringify(selectedIds));
  }, [selectedIds]);

  const projectSummaries: ProjectCostSummary[] = useMemo(() => {
    return state.projects.map(project => {
      const allProjectPeriods = state.periods.filter(p => p.projectId === project.id);
      const targetPeriods =
        scopeMode === 'active_period'
          ? allProjectPeriods.filter(p => p.id === project.currentPeriodId)
          : allProjectPeriods;

      const projectEmployees = state.employees.filter(e => e.projectId === project.id);

      let grossPayroll = 0;
      let cashAdvance = 0;
      let netPayroll = 0;
      let materialCost = 0;
      let materialCount = 0;
      const periodBreakdowns: PeriodBreakdown[] = [];

      targetPeriods.forEach(period => {
        let periodGross = 0;
        let periodCashAdvance = 0;

        const attendanceRecords = state.attendance[period.id] || [];
        attendanceRecords.forEach(record => {
          const emp = projectEmployees.find(e => e.id === record.employeeId);
          if (emp) {
            let workDays = 0;
            let overtimeHours = 0;

            Object.values(record.days).forEach((day: DailyAttendance) => {
              if (day.date >= period.startDate && day.date <= period.endDate) {
                if (day.isPresent) workDays++;
                if (day.extraWorkDays) workDays += day.extraWorkDays;
                overtimeHours += day.overtimeHours || 0;
              }
            });

            const dailyRate = record.dailyRate ?? emp.dailyRate;
            const overtimeRate = record.overtimeRate ?? emp.overtimeRate;
            const adv = record.cashAdvance ?? 0;

            periodGross += workDays * dailyRate + overtimeHours * overtimeRate;
            periodCashAdvance += adv;
          }
        });

        const periodNet = periodGross - periodCashAdvance;
        const materials = state.materials[period.id] || [];
        const periodMaterialCost = materials.reduce((sum, m) => sum + (m.totalPrice || 0), 0);

        grossPayroll += periodGross;
        cashAdvance += periodCashAdvance;
        netPayroll += periodNet;
        materialCost += periodMaterialCost;
        materialCount += materials.length;

        periodBreakdowns.push({
          periodId: period.id,
          periodName: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          grossPayroll: periodGross,
          netPayroll: periodNet,
          cashAdvance: periodCashAdvance,
          materialCost: periodMaterialCost,
          materialCount: materials.length,
          totalCost: periodGross + periodMaterialCost
        });
      });

      const projectFunds = state.incomingFunds[project.id] || [];
      const totalIncomingFunds = projectFunds.reduce((sum, f) => sum + (f.amount || 0), 0);
      const budget = (project.budget || 0) + totalIncomingFunds;
      const totalCost = grossPayroll + materialCost;
      const remainingBudget = budget - totalCost;

      return {
        projectId: project.id,
        name: project.name,
        clientName: project.clientName || '-',
        status: project.status || 'Aktif',
        periodCount: targetPeriods.length,
        workerCount: projectEmployees.length,
        grossPayroll,
        netPayroll,
        cashAdvance,
        materialCost,
        materialCount,
        totalCost,
        budget,
        remainingBudget,
        periodBreakdowns
      };
    });
  }, [state.projects, state.periods, state.employees, state.attendance, state.materials, state.incomingFunds, scopeMode]);

  const filteredSummaries = useMemo(() => {
    return projectSummaries.filter(p => {
      const matchesStatus = statusFilter === 'Semua' || p.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [projectSummaries, statusFilter, searchQuery]);

  // Valid selected IDs that still exist in state.projects
  const selectedSet = useMemo(() => {
    const validIds = new Set(state.projects.map(p => p.id));
    return new Set(selectedIds.filter(id => validIds.has(id)));
  }, [selectedIds, state.projects]);

  const markedSummaries = useMemo(() => {
    return projectSummaries.filter(p => selectedSet.has(p.projectId));
  }, [projectSummaries, selectedSet]);

  const markedTotals = useMemo(() => {
    return markedSummaries.reduce(
      (acc, p) => ({
        grossPayroll: acc.grossPayroll + p.grossPayroll,
        netPayroll: acc.netPayroll + p.netPayroll,
        cashAdvance: acc.cashAdvance + p.cashAdvance,
        materialCost: acc.materialCost + p.materialCost,
        materialCount: acc.materialCount + p.materialCount,
        totalCost: acc.totalCost + p.totalCost,
        budget: acc.budget + p.budget,
        remainingBudget: acc.remainingBudget + p.remainingBudget
      }),
      {
        grossPayroll: 0,
        netPayroll: 0,
        cashAdvance: 0,
        materialCost: 0,
        materialCount: 0,
        totalCost: 0,
        budget: 0,
        remainingBudget: 0
      }
    );
  }, [markedSummaries]);

  const allTotals = useMemo(() => {
    return projectSummaries.reduce(
      (acc, p) => ({
        grossPayroll: acc.grossPayroll + p.grossPayroll,
        materialCost: acc.materialCost + p.materialCost,
        totalCost: acc.totalCost + p.totalCost,
        budget: acc.budget + p.budget,
        remainingBudget: acc.remainingBudget + p.remainingBudget
      }),
      { grossPayroll: 0, materialCost: 0, totalCost: 0, budget: 0, remainingBudget: 0 }
    );
  }, [projectSummaries]);

  const toggleProject = (projectId: string) => {
    setSelectedIds(prev => {
      const validPrev = prev.filter(id => state.projects.some(p => p.id === id));
      if (validPrev.includes(projectId)) {
        return validPrev.filter(id => id !== projectId);
      }
      return [...validPrev, projectId];
    });
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredSummaries.map(p => p.projectId);
    setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const selectByStatus = (status: 'Aktif' | 'Selesai' | 'Pending') => {
    const ids = projectSummaries.filter(p => p.status === status).map(p => p.projectId);
    setSelectedIds(ids);
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const summaryPrintRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!summaryPrintRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await downloadElementAsPdf(summaryPrintRef.current, {
        filename: 'Rekap_Gabungan_Proyek',
        paperSize: 'A4-portrait',
      });
    } catch (err) {
      console.error('Gagal export PDF rekap proyek:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    await triggerPrintWithPdfFallback({
      getElement: () => summaryPrintRef.current,
      pdfOptions: {
        filename: 'Rekap_Gabungan_Proyek',
        paperSize: 'A4-portrait',
      },
    });
  };

  const handleExportExcel = () => {
    const targetRows = markedSummaries.length > 0 ? markedSummaries : projectSummaries;
    const rows = targetRows.map((p, idx) => ({
      No: idx + 1,
      'Nama Proyek': p.name,
      Klien: p.clientName,
      Status: p.status,
      'Jumlah Periode': p.periodCount,
      'Total Gaji (Kotor)': p.grossPayroll,
      'Potongan Kasbon': p.cashAdvance,
      'Gaji Bersih': p.netPayroll,
      'Material': p.materialCost,
      'Jumlah Item Material': p.materialCount,
      'Total (Gaji + Material)': p.totalCost
    }));

    const sumRow = targetRows.reduce(
      (acc, p) => ({
        grossPayroll: acc.grossPayroll + p.grossPayroll,
        cashAdvance: acc.cashAdvance + p.cashAdvance,
        netPayroll: acc.netPayroll + p.netPayroll,
        materialCost: acc.materialCost + p.materialCost,
        materialCount: acc.materialCount + p.materialCount,
        totalCost: acc.totalCost + p.totalCost
      }),
      {
        grossPayroll: 0,
        cashAdvance: 0,
        netPayroll: 0,
        materialCost: 0,
        materialCount: 0,
        totalCost: 0
      }
    );

    rows.push({
      No: '' as any,
      'Nama Proyek': `TOTAL GABUNGAN (${targetRows.length} PROYEK)`,
      Klien: '',
      Status: '' as any,
      'Jumlah Periode': '' as any,
      'Total Gaji (Kotor)': sumRow.grossPayroll,
      'Potongan Kasbon': sumRow.cashAdvance,
      'Gaji Bersih': sumRow.netPayroll,
      'Material': sumRow.materialCost,
      'Jumlah Item Material': sumRow.materialCount,
      'Total (Gaji + Material)': sumRow.totalCost
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Gabungan Proyek');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Rekap_Gabungan_Proyek_${dateStr}.xlsx`);
  };

  const rowsForPrint = markedSummaries.length > 0 ? markedSummaries : projectSummaries;
  const totalsForPrint = markedSummaries.length > 0 ? markedTotals : {
    ...allTotals,
    netPayroll: projectSummaries.reduce((s, p) => s + p.netPayroll, 0),
    cashAdvance: projectSummaries.reduce((s, p) => s + p.cashAdvance, 0),
    materialCount: projectSummaries.reduce((s, p) => s + p.materialCount, 0)
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Rekap Gaji &amp; Material Proyek
            </h2>
            <span className="bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {state.projects.length} Proyek
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Tandai beberapa proyek untuk menggabungkan dan menghitung otomatis total gaji &amp; materialnya
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Scope toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setScopeMode('all_periods')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scopeMode === 'all_periods'
                  ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              Semua Periode
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('active_period')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scopeMode === 'active_period'
                  ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              Periode Aktif Saja
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="Download Excel rekap proyek yang ditandai"
          >
            <Download className="w-4 h-4 text-accent-300" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="bg-accent-400 hover:bg-accent-500 disabled:opacity-60 text-brand-950 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="Download PDF rekap proyek yang ditandai"
          >
            <FileDown className="w-4 h-4" />
            <span>{isExportingPdf ? 'PDF...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="Cetak rekap proyek yang ditandai"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* COMBINED SUMMARY PANEL FOR MARKED PROJECTS */}
      <div className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white rounded-2xl p-5 md:p-6 shadow-xl border border-brand-700/60 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-400/20 border border-accent-300/30 rounded-xl text-accent-300">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base md:text-lg font-bold">
                  Jumlah Gabungan Proyek Ditandai
                </h3>
                <span className="bg-accent-400 text-brand-950 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                  {markedSummaries.length} / {projectSummaries.length} Proyek
                </span>
              </div>
              <p className="text-xs text-brand-100/80 mt-1 line-clamp-2">
                {markedSummaries.length === 0
                  ? 'Belum ada proyek ditandai. Centang kotak pada daftar proyek di bawah untuk menggabungkan totalnya.'
                  : `Terpilih: ${markedSummaries.map(p => p.name).join(', ')}`}
              </p>
            </div>
          </div>

          {markedSummaries.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="self-start md:self-center text-xs bg-white/10 hover:bg-white/20 text-brand-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Hapus Tanda
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 pt-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-brand-100 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Total Gaji Gabungan</span>
              <Users className="w-4 h-4 text-brand-300" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-white tracking-tight tabular-nums">
              Rp {markedTotals.grossPayroll.toLocaleString('id-ID')}
            </p>
            {markedTotals.cashAdvance > 0 ? (
              <p className="text-[11px] text-brand-200 mt-1 tabular-nums">
                Bersih: Rp {markedTotals.netPayroll.toLocaleString('id-ID')} • Kasbon: Rp{' '}
                {markedTotals.cashAdvance.toLocaleString('id-ID')}
              </p>
            ) : (
              <p className="text-[11px] text-brand-200/75 mt-1">
                Akumulasi upah &amp; lembur pekerja
              </p>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between text-brand-100 text-xs font-semibold uppercase tracking-wider mb-1">
              <span>Material Gabungan</span>
              <ShoppingCart className="w-4 h-4 text-accent-300" />
            </div>
            <p className="text-xl md:text-2xl font-extrabold text-white tracking-tight tabular-nums">
              Rp {markedTotals.materialCost.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-accent-200/90 mt-1">
              {markedTotals.materialCount} item material tercatat
            </p>
          </div>

          <div className="bg-accent-400/20 backdrop-blur-sm rounded-xl p-4 border border-accent-300/40">
            <div className="flex items-center justify-between text-accent-200 text-xs font-bold uppercase tracking-wider mb-1">
              <span>Jumlah Total (Gaji + Material)</span>
              <Calculator className="w-4 h-4 text-accent-300" />
            </div>
            <p className="text-xl md:text-2xl font-black text-accent-300 tracking-tight tabular-nums">
              Rp {markedTotals.totalCost.toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-accent-100/80 mt-1">
              Gabungan {markedSummaries.length} proyek ditandai
            </p>
          </div>
        </div>
      </div>

      {/* FILTER & QUICK MARK TOOLBAR */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Tandai Semua
          </button>
          <button
            type="button"
            onClick={() => selectByStatus('Aktif')}
            className="px-3 py-1.5 bg-accent-50 hover:bg-accent-100 dark:bg-accent-900/30 dark:hover:bg-accent-900/50 text-accent-800 dark:text-accent-300 rounded-lg text-xs font-bold transition-colors"
          >
            Tandai Proyek Aktif
          </button>
          <button
            type="button"
            onClick={() => selectByStatus('Selesai')}
            className="px-3 py-1.5 bg-brand-100 hover:bg-brand-200 dark:bg-brand-900/40 dark:hover:bg-brand-900/60 text-brand-800 dark:text-brand-300 rounded-lg text-xs font-bold transition-colors"
          >
            Tandai Proyek Selesai
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Kosongkan Tanda
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Status filter */}
          <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl">
            {(['Semua', 'Aktif', 'Pending', 'Selesai'] as const).map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === status
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari proyek..."
              className="w-full sm:w-52 pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden space-y-3 no-print">
        {filteredSummaries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-200 dark:border-gray-700 text-center text-gray-500 text-sm">
            Tidak ada proyek yang sesuai filter.
          </div>
        ) : (
          filteredSummaries.map(p => {
            const isChecked = selectedSet.has(p.projectId);
            const isExpanded = expandedProjectId === p.projectId;
            return (
              <div
                key={p.projectId}
                className={`rounded-2xl border p-4 transition-all ${
                  isChecked
                    ? 'bg-brand-50/60 dark:bg-brand-900/20 border-brand-400 dark:border-brand-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => toggleProject(p.projectId)}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleProject(p.projectId);
                      }}
                      className={`mt-0.5 shrink-0 ${
                        isChecked ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400'
                      }`}
                    >
                      {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">{p.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.clientName}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      p.status === 'Selesai'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : p.status === 'Pending'
                          ? 'bg-accent-100 text-accent-800 dark:bg-accent-900/40 dark:text-accent-300'
                          : 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200/70 dark:border-gray-700/70 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Gaji</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      Rp {p.grossPayroll.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Material</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      Rp {p.materialCost.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">Total (Gaji + Material)</span>
                    <span className="text-base font-extrabold text-brand-600 dark:text-brand-400">
                      Rp {p.totalCost.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedProjectId(isExpanded ? null : p.projectId)}
                    className="text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <span>Rincian</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                    {p.periodBreakdowns.length === 0 ? (
                      <p className="text-gray-400 italic">Belum ada periode tercatat.</p>
                    ) : (
                      p.periodBreakdowns.map(pb => (
                        <div key={pb.periodId} className="bg-white/70 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700">
                          <div className="font-bold text-gray-800 dark:text-gray-200 mb-1">{pb.periodName}</div>
                          <div className="flex justify-between text-gray-500 dark:text-gray-400">
                            <span>Gaji: Rp {pb.grossPayroll.toLocaleString('id-ID')}</span>
                            <span>Material: Rp {pb.materialCost.toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 uppercase text-xs font-bold border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-4 w-14 text-center">Tandai</th>
                <th className="px-4 py-4">Nama Proyek</th>
                <th className="px-4 py-4 text-center w-28">Status</th>
                <th className="px-4 py-4 text-right">Total Gaji</th>
                <th className="px-4 py-4 text-right">Material</th>
                <th className="px-4 py-4 text-right bg-brand-50/60 dark:bg-brand-900/20">Total (Gaji + Material)</th>
                <th className="px-4 py-4 w-24 text-center">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic">
                    Tidak ada proyek yang sesuai pencarian/filter.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map(p => {
                  const isChecked = selectedSet.has(p.projectId);
                  const isExpanded = expandedProjectId === p.projectId;
                  return (
                    <React.Fragment key={p.projectId}>
                      <tr
                        onClick={() => toggleProject(p.projectId)}
                        className={`cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-brand-50/60 dark:bg-brand-900/20 hover:bg-brand-50 dark:hover:bg-brand-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                        }`}
                      >
                        <td
                          className="px-4 py-3.5 text-center"
                          onClick={e => {
                            e.stopPropagation();
                            toggleProject(p.projectId);
                          }}
                        >
                          <button
                            type="button"
                            className={`inline-flex items-center justify-center rounded transition-colors ${
                              isChecked ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 hover:text-gray-600'
                            }`}
                            aria-label={`Tandai ${p.name}`}
                          >
                            {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-gray-900 dark:text-white">{p.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                            <span className="truncate max-w-[220px]">{p.clientName}</span>
                            <span>•</span>
                            <span>{p.periodCount} periode</span>
                            <span>•</span>
                            <span>{p.workerCount} pekerja</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              p.status === 'Selesai'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : p.status === 'Pending'
                                  ? 'bg-accent-100 text-accent-800 dark:bg-accent-900/30 dark:text-accent-300'
                                  : 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300'
                            }`}
                          >
                            {p.status === 'Selesai' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : p.status === 'Pending' ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-bold text-gray-900 dark:text-white">
                            Rp {p.grossPayroll.toLocaleString('id-ID')}
                          </div>
                          {p.cashAdvance > 0 && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              Bersih: Rp {p.netPayroll.toLocaleString('id-ID')} (Kasbon Rp{' '}
                              {p.cashAdvance.toLocaleString('id-ID')})
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="font-bold text-gray-900 dark:text-white">
                            Rp {p.materialCost.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {p.materialCount} item belanja
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right bg-brand-50/40 dark:bg-brand-900/10">
                          <div className="font-extrabold text-brand-700 dark:text-brand-300">
                            Rp {p.totalCost.toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3.5 text-center"
                          onClick={e => {
                            e.stopPropagation();
                            setExpandedProjectId(isExpanded ? null : p.projectId);
                          }}
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                          >
                            <span>Periode</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-gray-50/90 dark:bg-gray-900/40">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                              Rincian Per Periode — {p.name}
                            </div>
                            {p.periodBreakdowns.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">Belum ada periode pada proyek ini.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Periode</th>
                                      <th className="px-3 py-2 text-center">Tanggal</th>
                                      <th className="px-3 py-2 text-right">Total Gaji</th>
                                      <th className="px-3 py-2 text-right">Material</th>
                                      <th className="px-3 py-2 text-right">Total Periode</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {p.periodBreakdowns.map(pb => (
                                      <tr key={pb.periodId}>
                                        <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">
                                          {pb.periodName}
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-500 dark:text-gray-400">
                                          {pb.startDate} s/d {pb.endDate}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-800 dark:text-gray-200">
                                          Rp {pb.grossPayroll.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-800 dark:text-gray-200">
                                          Rp {pb.materialCost.toLocaleString('id-ID')} ({pb.materialCount} item)
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-brand-600 dark:text-brand-400">
                                          Rp {pb.totalCost.toLocaleString('id-ID')}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
              <tr className="bg-brand-50 dark:bg-brand-900/25 text-brand-950 dark:text-brand-200 font-bold">
                <td colSpan={3} className="px-4 py-3.5 text-right uppercase text-xs tracking-wider">
                  Jumlah Proyek Ditandai ({markedSummaries.length} Proyek)
                </td>
                <td className="px-4 py-3.5 text-right text-sm tabular-nums">
                  Rp {markedTotals.grossPayroll.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3.5 text-right text-sm tabular-nums">
                  Rp {markedTotals.materialCost.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3.5 text-right text-base font-black text-brand-800 dark:text-accent-300 bg-accent-100/80 dark:bg-accent-900/30 tabular-nums">
                  Rp {markedTotals.totalCost.toLocaleString('id-ID')}
                </td>
                <td></td>
              </tr>

              <tr className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-xs font-semibold border-t border-gray-200 dark:border-gray-700">
                <td colSpan={3} className="px-4 py-2.5 text-right uppercase tracking-wider">
                  Total Seluruh Proyek ({projectSummaries.length} Proyek)
                </td>
                <td className="px-4 py-2.5 text-right">
                  Rp {allTotals.grossPayroll.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-2.5 text-right">
                  Rp {allTotals.materialCost.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-2.5 text-right font-bold">
                  Rp {allTotals.totalCost.toLocaleString('id-ID')}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* PRINT LAYOUT (Visible only on print) */}
      <div ref={summaryPrintRef} className="hidden print-only text-black bg-white p-4">
        <div className="border-b-2 border-black pb-4 mb-5 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold uppercase">{state.companyProfile.name}</h1>
            <p className="text-xs text-gray-600">{state.companyProfile.address}</p>
            <h2 className="text-lg font-bold uppercase mt-3">
              Rekapitulasi Gabungan Gaji &amp; Material Proyek
            </h2>
            <p className="text-xs text-gray-700">
              Cakupan: {scopeMode === 'all_periods' ? 'Akumulasi Semua Periode' : 'Periode Aktif Masing-masing Proyek'} •{' '}
              {markedSummaries.length > 0
                ? `${markedSummaries.length} Proyek Ditandai`
                : `Semua Proyek (${projectSummaries.length})`}
            </p>
          </div>
          <div className="text-right text-xs">
            <p>{state.companyProfile.city}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <table className="w-full text-xs border border-black border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-2 py-2 text-center w-8">No</th>
              <th className="border border-black px-2 py-2 text-left">Nama Proyek</th>
              <th className="border border-black px-2 py-2 text-center w-20">Status</th>
              <th className="border border-black px-2 py-2 text-right whitespace-nowrap">Total Gaji</th>
              <th className="border border-black px-2 py-2 text-right whitespace-nowrap">Material</th>
              <th className="border border-black px-2 py-2 text-right whitespace-nowrap">Total (Gaji + Material)</th>
            </tr>
          </thead>
          <tbody>
            {rowsForPrint.map((p, idx) => (
              <tr key={p.projectId}>
                <td className="border border-black px-2 py-1.5 text-center">{idx + 1}</td>
                <td className="border border-black px-2 py-1.5 font-semibold">
                  {p.name}
                  <div className="text-[10px] font-normal text-gray-600">{p.clientName}</div>
                </td>
                <td className="border border-black px-2 py-1.5 text-center">{p.status}</td>
                <td className="border border-black px-2 py-1.5 text-right whitespace-nowrap">
                  Rp {p.grossPayroll.toLocaleString('id-ID')}
                </td>
                <td className="border border-black px-2 py-1.5 text-right whitespace-nowrap">
                  Rp {p.materialCost.toLocaleString('id-ID')}
                </td>
                <td className="border border-black px-2 py-1.5 text-right font-bold whitespace-nowrap">
                  Rp {p.totalCost.toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 font-bold">
              <td colSpan={3} className="border border-black px-2 py-2 text-right uppercase">
                Grand Total ({rowsForPrint.length} Proyek)
              </td>
              <td className="border border-black px-2 py-2 text-right whitespace-nowrap">
                Rp {totalsForPrint.grossPayroll.toLocaleString('id-ID')}
              </td>
              <td className="border border-black px-2 py-2 text-right whitespace-nowrap">
                Rp {totalsForPrint.materialCost.toLocaleString('id-ID')}
              </td>
              <td className="border border-black px-2 py-2 text-right whitespace-nowrap">
                Rp {totalsForPrint.totalCost.toLocaleString('id-ID')}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-end mt-10">
          <div className="text-center w-48 text-xs">
            <p className="mb-2">Mengetahui,</p>
            {state.companyProfile.signature ? (
              <img src={state.companyProfile.signature} alt="Tanda Tangan" className="h-24 mx-auto mb-2 object-contain" />
            ) : (
              <div className="h-20" />
            )}
            <p className="font-bold underline">{state.companyProfile.director}</p>
            <p>Direktur</p>
          </div>
        </div>
      </div>
    </div>
  );
};
