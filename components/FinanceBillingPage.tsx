import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppState,
  BillingPaymentRecord,
  BillingStatus,
  BillingTerm,
  ContractAddendum,
  IncomingFund,
  ProjectContract,
} from '../types';
import {
  calculateBillingAmounts,
  calculateProjectFinanceSummary,
  resolveBillingStatus,
} from '../financeUtils';
import { formatMaterialDate } from '../materialUtils';
import { terbilang } from '../utils';
import { triggerPrintWithPdfFallback } from '../pdfUtils';

interface FinanceBillingPageProps {
  state: AppState;
  onUpdateContract: (projectId: string, contract: ProjectContract) => void;
  onUpdateBillings: (projectId: string, billings: BillingTerm[]) => void;
  onUpdateIncomingFunds: (projectId: string, funds: IncomingFund[]) => void;
  onChangeView?: (view: string) => void;
}

type FinanceTab = 'overview' | 'contract' | 'billing';

const formatRp = (val: number): string => {
  const rounded = Math.round(Number(val) || 0);
  if (rounded < 0) return `-Rp ${Math.abs(rounded).toLocaleString('id-ID')}`;
  return `Rp ${rounded.toLocaleString('id-ID')}`;
};

const getTodayIso = () => new Date().toISOString().split('T')[0];

const getDefaultDueDate = (daysAhead: number = 14) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

export const FinanceBillingPage: React.FC<FinanceBillingPageProps> = ({
  state,
  onUpdateContract,
  onUpdateBillings,
  onUpdateIncomingFunds,
  onChangeView,
}) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const projectId = currentProject?.id || '';
  const contract = state.contracts?.[projectId];
  const rawBillings = state.billings?.[projectId] || [];
  const incomingFunds = state.incomingFunds?.[projectId] || [];
  const todayIso = getTodayIso();

  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  // --- Computed Summary ---
  const summary = useMemo(
    () => calculateProjectFinanceSummary(state, projectId, todayIso),
    [state, projectId, todayIso]
  );

  // --- Cashflow Filter & Incoming Fund Quick Entry ---
  const [cashflowFilter, setCashflowFilter] = useState<'all' | 'in' | 'out'>('all');
  const [cashflowSearch, setCashflowSearch] = useState('');
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundForm, setFundForm] = useState({ date: todayIso, source: '', amount: '' });

  const filteredCashflow = useMemo(() => {
    const q = cashflowSearch.trim().toLowerCase();
    return summary.cashflowEntries.filter(entry => {
      if (cashflowFilter !== 'all' && entry.direction !== cashflowFilter) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        (entry.reference || '').toLowerCase().includes(q)
      );
    });
  }, [summary.cashflowEntries, cashflowFilter, cashflowSearch]);

  const handleSaveIncomingFund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    const amt = Number(fundForm.amount) || 0;
    if (!fundForm.source.trim() || amt <= 0) {
      showNotice('error', 'Sumber dana dan nominal lebih dari 0 wajib diisi.');
      return;
    }
    const nextFund: IncomingFund = {
      id: `fund-${Date.now()}`,
      date: fundForm.date || todayIso,
      source: fundForm.source.trim(),
      amount: amt,
    };
    onUpdateIncomingFunds(projectId, [...incomingFunds, nextFund]);
    setFundForm({ date: todayIso, source: '', amount: '' });
    setShowFundModal(false);
    showNotice('success', 'Dana masuk berhasil dicatat.');
  };

  // --- Contract Form State ---
  const buildContractDraft = (c?: ProjectContract): ProjectContract => ({
    id: c?.id || `ctr-${projectId || Date.now()}`,
    projectId,
    contractNumber: c?.contractNumber || `SPK/${projectId.toUpperCase() || '001'}/${new Date().getFullYear()}`,
    title: c?.title || (currentProject ? `Pekerjaan Proyek ${currentProject.name}` : ''),
    clientName: c?.clientName || currentProject?.clientName || '',
    contractValue: c?.contractValue ?? (currentProject?.budget || 0),
    ppnPercent: c?.ppnPercent ?? 0,
    retentionPercent: c?.retentionPercent ?? 5,
    pphPercent: c?.pphPercent ?? 0,
    downPaymentPercent: c?.downPaymentPercent ?? 20,
    startDate: c?.startDate || todayIso,
    endDate: c?.endDate || getDefaultDueDate(60),
    status: c?.status || 'Aktif',
    notes: c?.notes || '',
    addendums: c?.addendums || [],
  });

  const [contractDraft, setContractDraft] = useState<ProjectContract>(() => buildContractDraft(contract));
  const [lastSyncedProjectId, setLastSyncedProjectId] = useState(projectId);

  if (projectId !== lastSyncedProjectId) {
    setLastSyncedProjectId(projectId);
    setContractDraft(buildContractDraft(state.contracts?.[projectId]));
  }

  const handleSaveContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (!contractDraft.contractNumber.trim() || !contractDraft.title.trim()) {
      showNotice('error', 'Nomor kontrak dan judul pekerjaan wajib diisi.');
      return;
    }
    const payload: ProjectContract = {
      ...contractDraft,
      projectId,
      contractValue: Math.max(0, Number(contractDraft.contractValue) || 0),
      ppnPercent: Math.max(0, Number(contractDraft.ppnPercent) || 0),
      retentionPercent: Math.max(0, Number(contractDraft.retentionPercent) || 0),
      pphPercent: Math.max(0, Number(contractDraft.pphPercent) || 0),
      downPaymentPercent: Math.max(0, Number(contractDraft.downPaymentPercent) || 0),
      addendums: contract?.addendums || contractDraft.addendums || [],
    };
    onUpdateContract(projectId, payload);
    showNotice('success', 'Data kontrak proyek berhasil disimpan.');
  };

  // --- Addendum Form State ---
  const [showAddendumForm, setShowAddendumForm] = useState(false);
  const [addendumDraft, setAddendumDraft] = useState({
    title: '',
    date: todayIso,
    amountDelta: '',
    newEndDate: '',
    notes: '',
  });

  const handleSaveAddendum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    const baseContract = contract || buildContractDraft(contractDraft);
    if (!addendumDraft.title.trim()) {
      showNotice('error', 'Judul addendum wajib diisi.');
      return;
    }
    const delta = Number(addendumDraft.amountDelta) || 0;
    const newItem: ContractAddendum = {
      id: `add-${Date.now()}`,
      title: addendumDraft.title.trim(),
      date: addendumDraft.date || todayIso,
      amountDelta: delta,
      newEndDate: addendumDraft.newEndDate || undefined,
      notes: addendumDraft.notes.trim() || undefined,
    };
    const nextAddendums = [...(baseContract.addendums || []), newItem];
    const updatedContract: ProjectContract = {
      ...baseContract,
      status: 'Addendum',
      endDate: addendumDraft.newEndDate || baseContract.endDate,
      addendums: nextAddendums,
    };
    onUpdateContract(projectId, updatedContract);
    setContractDraft(updatedContract);
    setAddendumDraft({ title: '', date: todayIso, amountDelta: '', newEndDate: '', notes: '' });
    setShowAddendumForm(false);
    showNotice('success', 'Addendum kontrak berhasil ditambahkan.');
  };

  const handleDeleteAddendum = (addendumId: string) => {
    if (!projectId || !contract) return;
    const nextAddendums = (contract.addendums || []).filter(a => a.id !== addendumId);
    const updated: ProjectContract = {
      ...contract,
      addendums: nextAddendums,
    };
    onUpdateContract(projectId, updated);
    setContractDraft(updated);
    showNotice('success', 'Addendum dihapus.');
  };

  // --- Billing Terms State ---
  const [billingFilter, setBillingFilter] = useState<'Semua' | BillingStatus>('Semua');
  const [billingSearch, setBillingSearch] = useState('');
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [editingBillingId, setEditingBillingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [billingDraft, setBillingDraft] = useState({
    invoiceNumber: '',
    termName: '',
    progressPercent: '25',
    grossAmount: '',
    ppnPercent: '0',
    retentionPercent: '5',
    pphPercent: '0',
    ppnAmount: '0',
    retentionAmount: '0',
    taxAmount: '0',
    netAmount: '0',
    issueDate: todayIso,
    dueDate: getDefaultDueDate(14),
    status: 'Terkirim' as BillingStatus,
    notes: '',
  });

  const applyBillingPreset = (
    presetName: string,
    progressPct: number,
    includeRetention: boolean,
    customGross?: number
  ) => {
    const base = summary.effectiveContractValue;
    const gross =
      customGross !== undefined
        ? customGross
        : base > 0
          ? Math.round((base * progressPct) / 100)
          : 0;
    const ppnPct = contract?.ppnPercent ?? 0;
    const retPct = includeRetention ? contract?.retentionPercent ?? 5 : 0;
    const pphPct = contract?.pphPercent ?? 0;
    const calc = calculateBillingAmounts({
      grossAmount: gross,
      ppnPercent: ppnPct,
      retentionPercent: retPct,
      pphPercent: pphPct,
    });
    setBillingDraft(prev => ({
      ...prev,
      termName: presetName,
      progressPercent: String(progressPct),
      grossAmount: String(calc.grossAmount),
      ppnPercent: String(ppnPct),
      retentionPercent: String(retPct),
      pphPercent: String(pphPct),
      ppnAmount: String(calc.ppnAmount),
      retentionAmount: String(calc.retentionAmount),
      taxAmount: String(calc.taxAmount),
      netAmount: String(calc.netAmount),
    }));
  };

  const recalcBillingFromRates = (
    grossStr: string,
    ppnPctStr: string,
    retPctStr: string,
    pphPctStr: string
  ) => {
    const calc = calculateBillingAmounts({
      grossAmount: Number(grossStr) || 0,
      ppnPercent: Number(ppnPctStr) || 0,
      retentionPercent: Number(retPctStr) || 0,
      pphPercent: Number(pphPctStr) || 0,
    });
    setBillingDraft(prev => ({
      ...prev,
      grossAmount: grossStr,
      ppnPercent: ppnPctStr,
      retentionPercent: retPctStr,
      pphPercent: pphPctStr,
      ppnAmount: String(calc.ppnAmount),
      retentionAmount: String(calc.retentionAmount),
      taxAmount: String(calc.taxAmount),
      netAmount: String(calc.netAmount),
    }));
  };

  const openNewBillingModal = () => {
    const nextSeq = String(rawBillings.length + 1).padStart(3, '0');
    const dpPct = contract?.downPaymentPercent ?? 20;
    const isFirst = rawBillings.length === 0;
    const defaultPct = isFirst ? dpPct : 25;
    const base = summary.effectiveContractValue;
    const gross = base > 0 ? Math.round((base * defaultPct) / 100) : 0;
    const ppnPct = contract?.ppnPercent ?? 0;
    const retPct = isFirst ? 0 : contract?.retentionPercent ?? 5;
    const pphPct = contract?.pphPercent ?? 0;
    const calc = calculateBillingAmounts({
      grossAmount: gross,
      ppnPercent: ppnPct,
      retentionPercent: retPct,
      pphPercent: pphPct,
    });

    setEditingBillingId(null);
    setBillingDraft({
      invoiceNumber: `INV-${nextSeq}/SBM/${new Date().getFullYear()}`,
      termName: isFirst ? `Uang Muka (DP ${defaultPct}%)` : `Termin ${rawBillings.length + 1}`,
      progressPercent: String(defaultPct),
      grossAmount: calc.grossAmount > 0 ? String(calc.grossAmount) : '',
      ppnPercent: String(ppnPct),
      retentionPercent: String(retPct),
      pphPercent: String(pphPct),
      ppnAmount: String(calc.ppnAmount),
      retentionAmount: String(calc.retentionAmount),
      taxAmount: String(calc.taxAmount),
      netAmount: String(calc.netAmount),
      issueDate: todayIso,
      dueDate: getDefaultDueDate(14),
      status: 'Terkirim',
      notes: '',
    });
    setShowBillingModal(true);
  };

  const openEditBillingModal = (term: BillingTerm) => {
    setEditingBillingId(term.id);
    const gross = term.grossAmount || 0;
    const ppnPct = gross > 0 ? Number(((term.ppnAmount / gross) * 100).toFixed(2)) : 0;
    const retPct = gross > 0 ? Number(((term.retentionAmount / gross) * 100).toFixed(2)) : 0;
    const pphPct = gross > 0 ? Number(((term.taxAmount / gross) * 100).toFixed(2)) : 0;
    setBillingDraft({
      invoiceNumber: term.invoiceNumber,
      termName: term.termName,
      progressPercent: String(term.progressPercent),
      grossAmount: String(term.grossAmount),
      ppnPercent: String(ppnPct),
      retentionPercent: String(retPct),
      pphPercent: String(pphPct),
      ppnAmount: String(term.ppnAmount),
      retentionAmount: String(term.retentionAmount),
      taxAmount: String(term.taxAmount),
      netAmount: String(term.netAmount),
      issueDate: term.issueDate,
      dueDate: term.dueDate,
      status: term.status,
      notes: term.notes || '',
    });
    setShowBillingModal(true);
  };

  const handleSaveBilling = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (!billingDraft.invoiceNumber.trim() || !billingDraft.termName.trim()) {
      showNotice('error', 'Nomor invoice dan nama termin wajib diisi.');
      return;
    }
    const gross = Math.max(0, Math.round(Number(billingDraft.grossAmount) || 0));
    const ppnAmt = Math.max(0, Math.round(Number(billingDraft.ppnAmount) || 0));
    const retAmt = Math.max(0, Math.round(Number(billingDraft.retentionAmount) || 0));
    const taxAmt = Math.max(0, Math.round(Number(billingDraft.taxAmount) || 0));
    const netAmt = Math.max(0, Math.round(Number(billingDraft.netAmount) || gross + ppnAmt - retAmt - taxAmt));

    if (netAmt <= 0) {
      showNotice('error', 'Nominal tagihan netto harus lebih dari 0.');
      return;
    }

    const existing = editingBillingId ? rawBillings.find(b => b.id === editingBillingId) : undefined;
    const paidAmount = existing?.paidAmount || 0;
    const nextStatus = resolveBillingStatus(
      {
        status: billingDraft.status,
        netAmount: netAmt,
        paidAmount,
        dueDate: billingDraft.dueDate,
      },
      todayIso
    );

    const record: BillingTerm = {
      id: editingBillingId || `bill-${Date.now()}`,
      projectId,
      invoiceNumber: billingDraft.invoiceNumber.trim(),
      termName: billingDraft.termName.trim(),
      progressPercent: Math.max(0, Number(billingDraft.progressPercent) || 0),
      grossAmount: gross,
      ppnAmount: ppnAmt,
      retentionAmount: retAmt,
      taxAmount: taxAmt,
      netAmount: netAmt,
      paidAmount,
      issueDate: billingDraft.issueDate || todayIso,
      dueDate: billingDraft.dueDate || todayIso,
      status: nextStatus,
      payments: existing?.payments || [],
      notes: billingDraft.notes.trim() || undefined,
    };

    if (editingBillingId) {
      onUpdateBillings(
        projectId,
        rawBillings.map(b => (b.id === editingBillingId ? record : b))
      );
      showNotice('success', 'Termin penagihan berhasil diperbarui.');
    } else {
      onUpdateBillings(projectId, [...rawBillings, record]);
      showNotice('success', 'Termin penagihan baru berhasil dibuat.');
    }
    setShowBillingModal(false);
    setEditingBillingId(null);
  };

  const handleDeleteBilling = (billingId: string) => {
    if (!projectId) return;
    onUpdateBillings(
      projectId,
      rawBillings.filter(b => b.id !== billingId)
    );
    setConfirmDeleteId(null);
    showNotice('success', 'Termin penagihan dihapus.');
  };

  // --- Record Client Payment per Termin ---
  const [payingTermId, setPayingTermId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({
    date: todayIso,
    amount: '',
    method: 'Transfer Bank',
    reference: '',
    note: '',
  });

  const payingTerm = useMemo(
    () => rawBillings.find(b => b.id === payingTermId) || null,
    [rawBillings, payingTermId]
  );

  const openPaymentModal = (term: BillingTerm) => {
    const remaining = Math.max(0, term.netAmount - term.paidAmount);
    setPayingTermId(term.id);
    setPaymentDraft({
      date: todayIso,
      amount: remaining > 0 ? String(remaining) : '',
      method: 'Transfer Bank',
      reference: '',
      note: '',
    });
  };

  const handleSaveTermPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !payingTerm) return;
    const amt = Math.round(Number(paymentDraft.amount) || 0);
    if (amt <= 0) {
      showNotice('error', 'Nominal pembayaran harus lebih dari 0.');
      return;
    }
    const newPayment: BillingPaymentRecord = {
      id: `bp-${Date.now()}`,
      date: paymentDraft.date || todayIso,
      amount: amt,
      method: paymentDraft.method,
      reference: paymentDraft.reference.trim() || undefined,
      note: paymentDraft.note.trim() || undefined,
    };
    const nextPayments = [...(payingTerm.payments || []), newPayment];
    const nextPaid = nextPayments.reduce((s, p) => s + p.amount, 0);
    const nextStatus = resolveBillingStatus(
      {
        status: payingTerm.status === 'Draft' ? 'Terkirim' : payingTerm.status,
        netAmount: payingTerm.netAmount,
        paidAmount: nextPaid,
        dueDate: payingTerm.dueDate,
      },
      todayIso
    );
    onUpdateBillings(
      projectId,
      rawBillings.map(b =>
        b.id === payingTerm.id
          ? { ...b, paidAmount: nextPaid, payments: nextPayments, status: nextStatus }
          : b
      )
    );
    setPaymentDraft({ date: todayIso, amount: '', method: 'Transfer Bank', reference: '', note: '' });
    showNotice('success', 'Pembayaran termin berhasil dicatat.');
  };

  const handleDeleteTermPayment = (termId: string, paymentId: string) => {
    if (!projectId) return;
    const target = rawBillings.find(b => b.id === termId);
    if (!target) return;
    const nextPayments = (target.payments || []).filter(p => p.id !== paymentId);
    const nextPaid = nextPayments.reduce((s, p) => s + p.amount, 0);
    const nextStatus = resolveBillingStatus(
      {
        status: 'Terkirim',
        netAmount: target.netAmount,
        paidAmount: nextPaid,
        dueDate: target.dueDate,
      },
      todayIso
    );
    onUpdateBillings(
      projectId,
      rawBillings.map(b =>
        b.id === termId
          ? { ...b, paidAmount: nextPaid, payments: nextPayments, status: nextStatus }
          : b
      )
    );
    showNotice('success', 'Riwayat pembayaran termin dihapus.');
  };

  const enrichedBillings = useMemo(() => {
    return rawBillings.map(b => ({
      ...b,
      resolvedStatus: resolveBillingStatus(b, todayIso),
      remaining: Math.max(0, b.netAmount - b.paidAmount),
    }));
  }, [rawBillings, todayIso]);

  const filteredBillings = useMemo(() => {
    const q = billingSearch.trim().toLowerCase();
    return enrichedBillings.filter(b => {
      if (billingFilter !== 'Semua' && b.resolvedStatus !== billingFilter) return false;
      if (!q) return true;
      return (
        b.invoiceNumber.toLowerCase().includes(q) ||
        b.termName.toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedBillings, billingFilter, billingSearch]);

  // --- Print Refs ---
  const financePrintRef = useRef<HTMLDivElement>(null);
  const [printingTerm, setPrintingTerm] = useState<BillingTerm | null>(null);
  const termPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintFinanceReport = async () => {
    await triggerPrintWithPdfFallback({
      getElement: () => financePrintRef.current,
      pdfOptions: {
        filename: `Keuangan_Penagihan_${currentProject?.name || 'Proyek'}`,
        paperSize: 'A4-portrait',
      },
    });
  };

  const handlePrintTermInvoice = async () => {
    await triggerPrintWithPdfFallback({
      getElement: () => termPrintRef.current,
      pdfOptions: {
        filename: `Tagihan_${printingTerm?.invoiceNumber || 'Termin'}_${currentProject?.name || 'Proyek'}`,
        paperSize: 'A4-portrait',
        preferSinglePage: true,
      },
    });
  };

  // --- Excel Export ---
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { Keterangan: 'Proyek', Nilai: currentProject?.name || '-' },
      { Keterangan: 'Klien', Nilai: contract?.clientName || currentProject?.clientName || '-' },
      { Keterangan: 'Nomor Kontrak / SPK', Nilai: contract?.contractNumber || '-' },
      { Keterangan: 'Nilai Kontrak Awal', Nilai: summary.baseContractValue },
      { Keterangan: 'Total Addendum', Nilai: summary.addendumTotal },
      { Keterangan: 'Nilai Kontrak Efektif', Nilai: summary.effectiveContractValue },
      { Keterangan: 'Total Tagihan Netto', Nilai: summary.totalBilledNet },
      { Keterangan: 'Total Sudah Dibayar (Termin)', Nilai: summary.totalBillingPaid },
      { Keterangan: 'Sisa Piutang Penagihan', Nilai: summary.totalReceivable },
      { Keterangan: 'Sisa Kontrak Belum Ditagih', Nilai: summary.unbilledContract },
      { Keterangan: 'Dana Masuk Non-Termin', Nilai: summary.totalIncomingFunds },
      { Keterangan: 'Total Biaya Upah (Semua Periode)', Nilai: summary.totalPayrollCost },
      { Keterangan: 'Total Belanja Material', Nilai: summary.totalMaterialCost },
      { Keterangan: 'Material Sudah Dibayar', Nilai: summary.totalMaterialPaid },
      { Keterangan: 'Sisa Hutang Material', Nilai: summary.totalMaterialDebt },
      { Keterangan: 'Pengeluaran Kas Kecil', Nilai: summary.totalPettyCashOut },
      { Keterangan: 'Total Beban Proyek', Nilai: summary.totalProjectExpenses },
      { Keterangan: 'Estimasi Laba / Margin Proyek', Nilai: summary.estimatedProfit },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Keuangan');

    const billingRows = enrichedBillings.map((b, idx) => ({
      No: idx + 1,
      'No Invoice': b.invoiceNumber,
      'Nama Termin': b.termName,
      'Progress (%)': b.progressPercent,
      'Tagihan Bruto': b.grossAmount,
      PPN: b.ppnAmount,
      Retensi: b.retentionAmount,
      PPh: b.taxAmount,
      'Tagihan Netto': b.netAmount,
      'Sudah Dibayar': b.paidAmount,
      'Sisa Piutang': b.remaining,
      'Tanggal Terbit': formatMaterialDate(b.issueDate),
      'Jatuh Tempo': formatMaterialDate(b.dueDate),
      Status: b.resolvedStatus,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(billingRows), 'Termin Penagihan');

    const cashRows = summary.cashflowEntries.map((c, idx) => ({
      No: idx + 1,
      Tanggal: formatMaterialDate(c.date),
      Arus: c.direction === 'in' ? 'Kas Masuk' : 'Kas Keluar',
      Kategori: c.category,
      Keterangan: c.title,
      Referensi: c.reference || '-',
      Nominal: c.amount,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cashRows), 'Arus Kas');

    XLSX.writeFile(wb, `Keuangan_Kontrak_${currentProject?.name || 'Proyek'}_${todayIso}.xlsx`);
  };

  const renderStatusBadge = (status: BillingStatus) => {
    switch (status) {
      case 'Lunas':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-300">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Lunas</span>
          </span>
        );
      case 'Sebagian':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 dark:text-accent-300">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Sebagian</span>
          </span>
        );
      case 'Jatuh Tempo':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Jatuh Tempo</span>
          </span>
        );
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Draft</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
            <Receipt className="w-3.5 h-3.5 shrink-0" />
            <span>Terkirim</span>
          </span>
        );
    }
  };

  if (!currentProject) {
    return (
      <div className="bg-white dark:bg-[#132018] rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <Landmark className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Belum Ada Proyek Aktif</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Buat atau pilih proyek terlebih dahulu di menu Pengaturan untuk mengelola kontrak dan penagihan.
        </p>
      </div>
    );
  }

  const billedPercentOfContract =
    summary.effectiveContractValue > 0
      ? Math.min(100, (summary.totalBilledGross / summary.effectiveContractValue) * 100)
      : 0;
  const collectedPercentOfBilled =
    summary.totalBilledNet > 0
      ? Math.min(100, (summary.totalBillingPaid / summary.totalBilledNet) * 100)
      : 0;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`no-print rounded-xl px-4 py-3 text-sm font-medium border flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-brand-50 border-brand-200 text-brand-800 dark:bg-brand-900/30 dark:border-brand-800 dark:text-brand-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Keuangan, Kontrak &amp; Penagihan
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-semibold text-gray-700 dark:text-gray-300">{currentProject.name}</span>
            <span aria-hidden="true">·</span>
            <span>{contract?.contractNumber || 'Belum ada nomor SPK'}</span>
            <span aria-hidden="true">·</span>
            <span>{rawBillings.length} termin tercatat</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#132018] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrintFinanceReport}
            className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs md:text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Laporan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('billing');
              openNewBillingModal();
            }}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs md:text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-accent-300" />
            <span>Buat Termin</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#132018] border border-gray-200 dark:border-gray-800 rounded-xl w-full sm:w-fit overflow-x-auto no-print">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-brand-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Ringkasan Keuangan
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contract')}
          className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'contract'
              ? 'bg-white dark:bg-brand-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Kontrak &amp; Addendum
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'billing'
              ? 'bg-white dark:bg-brand-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Penagihan &amp; Piutang
        </button>
      </div>

      {/* ==================== TAB 1: RINGKASAN KEUANGAN ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 no-print">
          {/* 4 KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#132018] p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                <span>Nilai Kontrak Efektif</span>
                <Landmark className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatRp(summary.effectiveContractValue)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {summary.contractSource === 'contract'
                  ? summary.addendumTotal !== 0
                    ? `Awal ${formatRp(summary.baseContractValue)} · Addendum ${summary.addendumTotal >= 0 ? '+' : ''}${formatRp(summary.addendumTotal)}`
                    : `SPK ${contract?.contractNumber}`
                  : summary.contractSource === 'budget'
                    ? 'Menggunakan nilai anggaran proyek'
                    : 'Atur kontrak di tab Kontrak'}
              </p>
            </div>

            <div className="bg-white dark:bg-[#132018] p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                <span>Total Tertagih &amp; Dibayar</span>
                <ArrowDownLeft className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <p className="text-xl md:text-2xl font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                {formatRp(summary.totalBillingPaid)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 tabular-nums">
                Dari total tagihan netto {formatRp(summary.totalBilledNet)}
              </p>
            </div>

            <div className="bg-white dark:bg-[#132018] p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                <span>Piutang Belum Lunas</span>
                <Receipt className="w-4 h-4 text-accent-600 dark:text-accent-400" />
              </div>
              <p className="text-xl md:text-2xl font-bold text-accent-800 dark:text-accent-300 tabular-nums">
                {formatRp(summary.totalReceivable)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 tabular-nums">
                {summary.overdueCount > 0
                  ? `${summary.overdueCount} termin jatuh tempo (${formatRp(summary.overdueAmount)})`
                  : `Sisa belum ditagih ${formatRp(summary.unbilledContract)}`}
              </p>
            </div>

            <div className="bg-white dark:bg-[#132018] p-5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                <span>Estimasi Laba Proyek</span>
                <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              </div>
              <p
                className={`text-xl md:text-2xl font-bold tabular-nums ${
                  summary.estimatedProfit >= 0
                    ? 'text-gray-900 dark:text-white'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatRp(summary.estimatedProfit)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 tabular-nums">
                Margin {summary.marginPercent.toFixed(1)}% · Biaya {formatRp(summary.totalProjectExpenses)}
              </p>
            </div>
          </div>

          {/* 2-Column Analytical Split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Progress Penagihan vs Kontrak */}
            <div className="bg-white dark:bg-[#132018] p-5 md:p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Realisasi Penagihan Kontrak
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Perbandingan nilai kontrak efektif terhadap penagihan &amp; pelunasan
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline whitespace-nowrap shrink-0"
                >
                  Kelola Termin
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-gray-600 dark:text-gray-300">Progress Ditagih (Bruto)</span>
                    <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                      {billedPercentOfContract.toFixed(1)}% ({formatRp(summary.totalBilledGross)})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-600 rounded-full transition-all duration-200"
                      style={{ width: `${billedPercentOfContract}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-gray-600 dark:text-gray-300">Pelunasan Tagihan (Netto)</span>
                    <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                      {collectedPercentOfBilled.toFixed(1)}% ({formatRp(summary.totalBillingPaid)})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full transition-all duration-200"
                      style={{ width: `${collectedPercentOfBilled}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Kas Masuk Keseluruhan</p>
                  <p className="font-bold text-brand-700 dark:text-brand-300 tabular-nums mt-0.5">
                    {formatRp(summary.cashInTotal)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                    Termin + Dana Masuk ({formatRp(summary.totalIncomingFunds)})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Saldo Arus Kas Bersih</p>
                  <p
                    className={`font-bold tabular-nums mt-0.5 ${
                      summary.netCashflow >= 0
                        ? 'text-gray-900 dark:text-white'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatRp(summary.netCashflow)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                    Kas Keluar {formatRp(summary.cashOutTotal)}
                  </p>
                </div>
              </div>
            </div>

            {/* Rincian Beban & Hutang Proyek */}
            <div className="bg-white dark:bg-[#132018] p-5 md:p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Struktur Biaya &amp; Kewajiban Proyek
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Akumulasi lintas seluruh periode proyek aktif
                  </p>
                </div>
                {onChangeView && (
                  <button
                    type="button"
                    onClick={() => onChangeView('materials')}
                    className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline whitespace-nowrap shrink-0"
                  >
                    Cek Material
                  </button>
                )}
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">Upah Pekerja &amp; Lembur</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Akumulasi absensi &amp; payroll</p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatRp(summary.totalPayrollCost)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">Total Belanja Material</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      Terbayar {formatRp(summary.totalMaterialPaid)} · Sisa belum lunas {formatRp(summary.totalMaterialDebt)}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatRp(summary.totalMaterialCost)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-gray-200">Operasional Kas Kecil</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      Masuk {formatRp(summary.totalPettyCashIn)} · Keluar {formatRp(summary.totalPettyCashOut)}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatRp(summary.totalPettyCashOut)}
                  </span>
                </div>
                <div className="pt-3 flex items-center justify-between gap-4">
                  <span className="font-bold text-gray-900 dark:text-white">Total Beban Proyek</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
                    {formatRp(summary.totalProjectExpenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Cashflow Ledger */}
          <div className="bg-white dark:bg-[#132018] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Buku Arus Kas Proyek
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Gabungan pembayaran termin klien, dana masuk, pembayaran material, dan kas kecil
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cashflowSearch}
                    onChange={e => setCashflowSearch(e.target.value)}
                    placeholder="Cari transaksi..."
                    className="pl-9 pr-3 py-1.5 text-xs md:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none w-44 md:w-52"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  {(['all', 'in', 'out'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCashflowFilter(f)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        cashflowFilter === f
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {f === 'all' ? 'Semua' : f === 'in' ? 'Kas Masuk' : 'Kas Keluar'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowFundModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dana Masuk</span>
                </button>
              </div>
            </div>

            {filteredCashflow.length === 0 ? (
              <div className="p-8 text-center">
                <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Belum ada catatan arus kas yang sesuai
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Catat dana masuk atau pembayaran termin untuk melihat pergerakan kas proyek.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Tanggal</th>
                      <th className="py-3 px-4 font-semibold">Kategori</th>
                      <th className="py-3 px-4 font-semibold">Keterangan</th>
                      <th className="py-3 px-4 font-semibold">Referensi</th>
                      <th className="py-3 px-4 font-semibold text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredCashflow.map(item => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 text-xs font-mono tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {formatMaterialDate(item.date)}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {item.direction === 'in' ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                            )}
                            <span>{item.category}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white">
                          {item.title}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400">
                          {item.reference || '-'}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-bold tabular-nums whitespace-nowrap ${
                            item.direction === 'in'
                              ? 'text-brand-700 dark:text-brand-300'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {item.direction === 'in' ? '+' : '-'} {formatRp(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: KONTRAK & ADDENDUM ==================== */}
      {activeTab === 'contract' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
          {/* Contract Form */}
          <form
            onSubmit={handleSaveContract}
            className="lg:col-span-7 bg-white dark:bg-[#132018] p-5 md:p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Detail Kontrak / SPK Proyek
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Menjadi dasar perhitungan termin, retensi, pajak, dan sisa nilai kontrak
                </p>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs md:text-sm font-bold whitespace-nowrap shrink-0"
              >
                Simpan Kontrak
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nomor Kontrak / SPK
                </label>
                <input
                  type="text"
                  value={contractDraft.contractNumber}
                  onChange={e => setContractDraft({ ...contractDraft, contractNumber: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Status Kontrak
                </label>
                <select
                  value={contractDraft.status}
                  onChange={e =>
                    setContractDraft({
                      ...contractDraft,
                      status: e.target.value as ProjectContract['status'],
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="Draft">Draft</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Addendum">Addendum</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Judul Paket Pekerjaan
              </label>
              <input
                type="text"
                value={contractDraft.title}
                onChange={e => setContractDraft({ ...contractDraft, title: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nama Pemberi Tugas / Klien
                </label>
                <input
                  type="text"
                  value={contractDraft.clientName}
                  onChange={e => setContractDraft({ ...contractDraft, clientName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nilai Kontrak Awal (DPP / Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={contractDraft.contractValue}
                  onChange={e =>
                    setContractDraft({
                      ...contractDraft,
                      contractValue: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Uang Muka (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={contractDraft.downPaymentPercent}
                  onChange={e =>
                    setContractDraft({
                      ...contractDraft,
                      downPaymentPercent: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Retensi (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={contractDraft.retentionPercent}
                  onChange={e =>
                    setContractDraft({
                      ...contractDraft,
                      retentionPercent: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  PPN (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={contractDraft.ppnPercent}
                  onChange={e =>
                    setContractDraft({
                      ...contractDraft,
                      ppnPercent: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  PPh Final (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.25"
                  value={contractDraft.pphPercent}
                  onChange={e =>
                    setContractDraft({
                      ...contractDraft,
                      pphPercent: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal Mulai Kontrak
                </label>
                <input
                  type="date"
                  value={contractDraft.startDate}
                  onChange={e => setContractDraft({ ...contractDraft, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Selesai Kontrak
                </label>
                <input
                  type="date"
                  value={contractDraft.endDate}
                  onChange={e => setContractDraft({ ...contractDraft, endDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Syarat &amp; Catatan Pembayaran
              </label>
              <textarea
                rows={2}
                value={contractDraft.notes || ''}
                onChange={e => setContractDraft({ ...contractDraft, notes: e.target.value })}
                placeholder="Contoh: Retensi 5% dibayarkan setelah masa pemeliharaan 90 hari..."
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </form>

          {/* Contract Financial Breakdown & Addendum */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-[#132018] p-5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Kalkulasi Nilai Kontrak
              </h3>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                <div className="py-2 flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Nilai Awal (DPP)</span>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {formatRp(contractDraft.contractValue)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Addendum</span>
                  <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                    {summary.addendumTotal >= 0 ? '+' : ''}
                    {formatRp(summary.addendumTotal)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">Nilai Kontrak Efektif</span>
                  <span className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                    {formatRp(Math.max(0, (contractDraft.contractValue || 0) + summary.addendumTotal))}
                  </span>
                </div>
                <div className="py-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Estimasi PPN ({contractDraft.ppnPercent}%)</span>
                  <span className="tabular-nums">
                    {formatRp(
                      Math.round(
                        (((contractDraft.contractValue || 0) + summary.addendumTotal) *
                          (contractDraft.ppnPercent || 0)) /
                          100
                      )
                    )}
                  </span>
                </div>
                <div className="py-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Estimasi Retensi ({contractDraft.retentionPercent}%)</span>
                  <span className="tabular-nums">
                    {formatRp(
                      Math.round(
                        (((contractDraft.contractValue || 0) + summary.addendumTotal) *
                          (contractDraft.retentionPercent || 0)) /
                          100
                      )
                    )}
                  </span>
                </div>
                <div className="py-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Estimasi PPh Final ({contractDraft.pphPercent}%)</span>
                  <span className="tabular-nums">
                    {formatRp(
                      Math.round(
                        (((contractDraft.contractValue || 0) + summary.addendumTotal) *
                          (contractDraft.pphPercent || 0)) /
                          100
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#132018] p-5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Riwayat Addendum
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Perubahan nilai atau jangka waktu kontrak
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddendumForm(!showAddendumForm)}
                  className="px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Addendum</span>
                </button>
              </div>

              {showAddendumForm && (
                <form
                  onSubmit={handleSaveAddendum}
                  className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 space-y-3"
                >
                  <input
                    type="text"
                    placeholder="Judul Addendum (cth: Addendum Pekerjaan Tambah Kanopi)"
                    value={addendumDraft.title}
                    onChange={e => setAddendumDraft({ ...addendumDraft, title: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={addendumDraft.date}
                        onChange={e => setAddendumDraft({ ...addendumDraft, date: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Selisih Nilai (+/- Rp)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={addendumDraft.amountDelta}
                        onChange={e => setAddendumDraft({ ...addendumDraft, amountDelta: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      Perpanjangan Tanggal Selesai (Opsional)
                    </label>
                    <input
                      type="date"
                      value={addendumDraft.newEndDate}
                      onChange={e => setAddendumDraft({ ...addendumDraft, newEndDate: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddendumForm(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold"
                    >
                      Simpan Addendum
                    </button>
                  </div>
                </form>
              )}

              {(contract?.addendums || []).length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic py-4 text-center">
                  Belum ada addendum kontrak.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(contract?.addendums || []).map(add => (
                    <div key={add.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{add.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                          {formatMaterialDate(add.date)}
                          {add.newEndDate ? ` · Selesai s/d ${formatMaterialDate(add.newEndDate)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            add.amountDelta >= 0
                              ? 'text-brand-700 dark:text-brand-300'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {add.amountDelta >= 0 ? '+' : ''}
                          {formatRp(add.amountDelta)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddendum(add.id)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Hapus addendum"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: PENAGIHAN & PIUTANG ==================== */}
      {activeTab === 'billing' && (
        <div className="space-y-6 no-print">
          {/* 4-metric billing strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#132018] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sisa Kontrak Belum Ditagih</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums mt-1">
                {formatRp(summary.unbilledContract)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#132018] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Tagihan Netto</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums mt-1">
                {formatRp(summary.totalBilledNet)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#132018] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sudah Diterima</p>
              <p className="text-lg font-bold text-brand-700 dark:text-brand-300 tabular-nums mt-1">
                {formatRp(summary.totalBillingPaid)}
              </p>
            </div>
            <div className="bg-white dark:bg-[#132018] p-4 rounded-xl border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Piutang Berjalan</p>
              <p className="text-lg font-bold text-accent-800 dark:text-accent-300 tabular-nums mt-1">
                {formatRp(summary.totalReceivable)}
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-[#132018] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-fit">
                {(['Semua', 'Draft', 'Terkirim', 'Sebagian', 'Lunas', 'Jatuh Tempo'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setBillingFilter(st)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      billingFilter === st
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={billingSearch}
                    onChange={e => setBillingSearch(e.target.value)}
                    placeholder="Cari nomor / nama termin..."
                    className="pl-9 pr-3 py-1.5 text-xs md:text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none w-full sm:w-56"
                  />
                </div>
                <button
                  type="button"
                  onClick={openNewBillingModal}
                  className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Termin Baru</span>
                </button>
              </div>
            </div>

            {filteredBillings.length === 0 ? (
              <div className="p-10 text-center">
                <Receipt className="w-9 h-9 text-gray-400 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Belum ada termin penagihan
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                  Buat termin uang muka, progress lapangan, atau tagihan retensi untuk mulai melacak piutang klien.
                </p>
                <button
                  type="button"
                  onClick={openNewBillingModal}
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Termin Pertama</span>
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/60 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <th className="py-3 px-4 font-semibold">No. Invoice</th>
                        <th className="py-3 px-4 font-semibold">Termin &amp; Progress</th>
                        <th className="py-3 px-4 font-semibold">Terbit / Tempo</th>
                        <th className="py-3 px-4 font-semibold text-right">Netto</th>
                        <th className="py-3 px-4 font-semibold text-right">Terbayar</th>
                        <th className="py-3 px-4 font-semibold text-right">Sisa Piutang</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredBillings.map(term => (
                        <tr
                          key={term.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                            {term.invoiceNumber}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-gray-900 dark:text-white">{term.termName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                              Progress {term.progressPercent}% · Bruto {formatRp(term.grossAmount)}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300 tabular-nums whitespace-nowrap">
                            <div>Terbit: {formatMaterialDate(term.issueDate)}</div>
                            <div className="text-gray-400">Tempo: {formatMaterialDate(term.dueDate)}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                            {formatRp(term.netAmount)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-brand-700 dark:text-brand-300 tabular-nums whitespace-nowrap">
                            {formatRp(term.paidAmount)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-accent-800 dark:text-accent-300 tabular-nums whitespace-nowrap">
                            {formatRp(term.remaining)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {renderStatusBadge(term.resolvedStatus)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openPaymentModal(term)}
                                className="px-2.5 py-1 rounded-md bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-xs font-semibold"
                              >
                                Bayar
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrintingTerm(term)}
                                className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                                title="Cetak Tagihan Termin"
                                aria-label="Cetak tagihan termin"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditBillingModal(term)}
                                className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                                title="Edit Termin"
                                aria-label="Edit termin"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {confirmDeleteId === term.id ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBilling(term.id)}
                                  className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold"
                                >
                                  Hapus?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(term.id)}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Hapus Termin"
                                  aria-label="Hapus termin"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredBillings.map(term => (
                    <div key={term.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{term.termName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {term.invoiceNumber} · {term.progressPercent}%
                          </p>
                        </div>
                        {renderStatusBadge(term.resolvedStatus)}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        <span>Terbit: {formatMaterialDate(term.issueDate)}</span>
                        <span>Tempo: {formatMaterialDate(term.dueDate)}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs pt-1 tabular-nums">
                        <div>
                          <span className="text-gray-400 block">Netto</span>
                          <span className="font-bold text-gray-900 dark:text-white">{formatRp(term.netAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Dibayar</span>
                          <span className="font-bold text-brand-700 dark:text-brand-300">{formatRp(term.paidAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Piutang</span>
                          <span className="font-bold text-accent-800 dark:text-accent-300">{formatRp(term.remaining)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => openPaymentModal(term)}
                          className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold"
                        >
                          Catat Bayar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintingTerm(term)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                        >
                          Cetak
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditBillingModal(term)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBilling(term.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD DANA MASUK ==================== */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-[#132018] border border-gray-200 dark:border-gray-800 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Catat Dana Masuk Proyek</h3>
              <button
                type="button"
                onClick={() => setShowFundModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveIncomingFund} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={fundForm.date}
                  onChange={e => setFundForm({ ...fundForm, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Sumber / Keterangan Dana
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Modal Awal Owner / Talangan Kas"
                  value={fundForm.source}
                  onChange={e => setFundForm({ ...fundForm, source: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nominal (Rp)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="0"
                  value={fundForm.amount}
                  onChange={e => setFundForm({ ...fundForm, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFundModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold"
                >
                  Simpan Dana Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT TERMIN ==================== */}
      {showBillingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white dark:bg-[#132018] border border-gray-200 dark:border-gray-800 rounded-xl w-full max-w-xl p-5 md:p-6 space-y-4 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {editingBillingId ? 'Edit Termin Penagihan' : 'Buat Termin Penagihan Baru'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                  Basis kontrak efektif: {formatRp(summary.effectiveContractValue)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBillingModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editingBillingId && summary.effectiveContractValue > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    applyBillingPreset(
                      `Uang Muka (DP ${contract?.downPaymentPercent ?? 20}%)`,
                      contract?.downPaymentPercent ?? 20,
                      false
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                >
                  Preset DP ({contract?.downPaymentPercent ?? 20}%)
                </button>
                <button
                  type="button"
                  onClick={() => applyBillingPreset('Termin Progress 30%', 30, true)}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                >
                  Progress 30%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyBillingPreset('Pelunasan Sisa Kontrak', 100, true, summary.unbilledContract)
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                >
                  Sisa Belum Ditagih ({formatRp(summary.unbilledContract)})
                </button>
              </div>
            )}

            <form onSubmit={handleSaveBilling} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nomor Invoice
                  </label>
                  <input
                    type="text"
                    value={billingDraft.invoiceNumber}
                    onChange={e => setBillingDraft({ ...billingDraft, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nama Termin
                  </label>
                  <input
                    type="text"
                    value={billingDraft.termName}
                    onChange={e => setBillingDraft({ ...billingDraft, termName: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Progress (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={billingDraft.progressPercent}
                    onChange={e => {
                      const pctStr = e.target.value;
                      const pct = Number(pctStr) || 0;
                      const nextGross =
                        summary.effectiveContractValue > 0
                          ? String(Math.round((summary.effectiveContractValue * pct) / 100))
                          : billingDraft.grossAmount;
                      setBillingDraft(prev => ({ ...prev, progressPercent: pctStr }));
                      if (summary.effectiveContractValue > 0) {
                        recalcBillingFromRates(
                          nextGross,
                          billingDraft.ppnPercent,
                          billingDraft.retentionPercent,
                          billingDraft.pphPercent
                        );
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nilai Tagihan Bruto (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={billingDraft.grossAmount}
                    onChange={e =>
                      recalcBillingFromRates(
                        e.target.value,
                        billingDraft.ppnPercent,
                        billingDraft.retentionPercent,
                        billingDraft.pphPercent
                      )
                    }
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    PPN (+%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={billingDraft.ppnPercent}
                    onChange={e =>
                      recalcBillingFromRates(
                        billingDraft.grossAmount,
                        e.target.value,
                        billingDraft.retentionPercent,
                        billingDraft.pphPercent
                      )
                    }
                    className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                  />
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    + {formatRp(Number(billingDraft.ppnAmount) || 0)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Retensi (-%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={billingDraft.retentionPercent}
                    onChange={e =>
                      recalcBillingFromRates(
                        billingDraft.grossAmount,
                        billingDraft.ppnPercent,
                        e.target.value,
                        billingDraft.pphPercent
                      )
                    }
                    className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                  />
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    - {formatRp(Number(billingDraft.retentionAmount) || 0)}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    PPh (-%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.25"
                    value={billingDraft.pphPercent}
                    onChange={e =>
                      recalcBillingFromRates(
                        billingDraft.grossAmount,
                        billingDraft.ppnPercent,
                        billingDraft.retentionPercent,
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                  />
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    - {formatRp(Number(billingDraft.taxAmount) || 0)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/50 flex items-center justify-between">
                <span className="text-xs font-bold text-brand-900 dark:text-brand-200">
                  Total Tagihan Netto
                </span>
                <span className="text-base font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                  {formatRp(Number(billingDraft.netAmount) || 0)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal Terbit
                  </label>
                  <input
                    type="date"
                    value={billingDraft.issueDate}
                    onChange={e => setBillingDraft({ ...billingDraft, issueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Jatuh Tempo
                  </label>
                  <input
                    type="date"
                    value={billingDraft.dueDate}
                    onChange={e => setBillingDraft({ ...billingDraft, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Status Awal
                  </label>
                  <select
                    value={billingDraft.status}
                    onChange={e =>
                      setBillingDraft({ ...billingDraft, status: e.target.value as BillingStatus })
                    }
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Terkirim">Terkirim</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Catatan Termin (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Lampirkan BAST & foto progress 30%"
                  value={billingDraft.notes}
                  onChange={e => setBillingDraft({ ...billingDraft, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBillingModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold"
                >
                  {editingBillingId ? 'Simpan Perubahan' : 'Buat Termin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: RECORD TERMIN PAYMENT ==================== */}
      {payingTerm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print overflow-y-auto">
          <div className="bg-white dark:bg-[#132018] border border-gray-200 dark:border-gray-800 rounded-xl w-full max-w-lg p-5 space-y-4 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Pembayaran Termin · {payingTerm.invoiceNumber}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {payingTerm.termName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingTermId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs bg-gray-50 dark:bg-gray-900/60 p-3 rounded-lg tabular-nums">
              <div>
                <span className="text-gray-500 block">Tagihan Netto</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatRp(payingTerm.netAmount)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Sudah Diterima</span>
                <span className="font-bold text-brand-700 dark:text-brand-300">{formatRp(payingTerm.paidAmount)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Sisa Piutang</span>
                <span className="font-bold text-accent-800 dark:text-accent-300">
                  {formatRp(Math.max(0, payingTerm.netAmount - payingTerm.paidAmount))}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveTermPayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tanggal Terima
                  </label>
                  <input
                    type="date"
                    value={paymentDraft.date}
                    onChange={e => setPaymentDraft({ ...paymentDraft, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={paymentDraft.method}
                    onChange={e => setPaymentDraft({ ...paymentDraft, method: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai">Tunai</option>
                    <option value="Giro / Cek">Giro / Cek</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Nominal Diterima (Rp)
                  </label>
                  {payingTerm.netAmount - payingTerm.paidAmount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentDraft({
                          ...paymentDraft,
                          amount: String(Math.max(0, payingTerm.netAmount - payingTerm.paidAmount)),
                        })
                      }
                      className="text-[11px] font-bold text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      Lunasi Sisa
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  value={paymentDraft.amount}
                  onChange={e => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white tabular-nums"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="No. Referensi / Bukti Transfer"
                  value={paymentDraft.reference}
                  onChange={e => setPaymentDraft({ ...paymentDraft, reference: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Catatan (opsional)"
                  value={paymentDraft.note}
                  onChange={e => setPaymentDraft({ ...paymentDraft, note: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold"
              >
                Simpan Pembayaran
              </button>
            </form>

            {/* Payment history for this termin */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Riwayat Pembayaran ({(payingTerm.payments || []).length})
              </p>
              {(payingTerm.payments || []).length === 0 ? (
                <p className="text-xs text-gray-400 italic">Belum ada pembayaran tercatat.</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-44 overflow-y-auto">
                  {(payingTerm.payments || []).map(p => (
                    <div key={p.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                          {formatMaterialDate(p.date)}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {' '}· {p.method || 'Transfer'}
                          {p.reference ? ` (${p.reference})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-700 dark:text-brand-300 tabular-nums">
                          {formatRp(p.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTermPayment(payingTerm.id, p.id)}
                          className="text-gray-400 hover:text-red-600"
                          aria-label="Hapus pembayaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL & PRINT AREA: INDIVIDUAL TERMIN INVOICE ==================== */}
      {printingTerm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 text-black">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 no-print">
              <h3 className="text-sm font-bold text-gray-900">
                Pratinjau Tagihan Termin · {printingTerm.invoiceNumber}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintTermInvoice}
                  className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingTerm(null)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200"
                  aria-label="Tutup pratinjau"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table-based print layout (safe for iOS html-to-image & native print) */}
            <div ref={termPrintRef} className="p-6 md:p-8 bg-white text-black">
              <table className="w-full border-collapse border-b-2 border-black mb-4">
                <tbody>
                  <tr>
                    <td className="pb-3 align-top text-left">
                      <div className="text-lg font-bold uppercase">{state.companyProfile.name}</div>
                      <div className="text-xs text-gray-700">{state.companyProfile.address}</div>
                    </td>
                    <td className="pb-3 align-top text-right">
                      <div className="text-base font-bold uppercase">SURAT PENAGIHAN / INVOICE</div>
                      <div className="text-xs font-mono">No: {printingTerm.invoiceNumber}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border-collapse mb-4 text-xs">
                <tbody>
                  <tr>
                    <td className="w-1/2 align-top pr-4">
                      <div className="text-gray-600">Kepada Yth:</div>
                      <div className="font-bold text-sm">
                        {contract?.clientName || currentProject.clientName}
                      </div>
                      <div className="text-gray-700">{currentProject.clientAddress}</div>
                    </td>
                    <td className="w-1/2 align-top text-right">
                      <div>Proyek: <strong>{currentProject.name}</strong></div>
                      {contract?.contractNumber && (
                        <div>No. SPK: <strong>{contract.contractNumber}</strong></div>
                      )}
                      <div>Tanggal Terbit: {formatMaterialDate(printingTerm.issueDate)}</div>
                      <div>Jatuh Tempo: {formatMaterialDate(printingTerm.dueDate)}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border-collapse border border-black text-xs mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-2 text-left">Uraian Penagihan</th>
                    <th className="border border-black p-2 text-center w-24">Progress</th>
                    <th className="border border-black p-2 text-right w-40">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-black p-2">
                      <div className="font-bold">{printingTerm.termName}</div>
                      {contract?.title && <div className="text-gray-700">{contract.title}</div>}
                      {printingTerm.notes && <div className="text-gray-600 mt-1">{printingTerm.notes}</div>}
                    </td>
                    <td className="border border-black p-2 text-center tabular-nums">
                      {printingTerm.progressPercent}%
                    </td>
                    <td className="border border-black p-2 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatRp(printingTerm.grossAmount)}
                    </td>
                  </tr>
                  {printingTerm.ppnAmount > 0 && (
                    <tr>
                      <td colSpan={2} className="border border-black p-2 text-right">
                        PPN (+)
                      </td>
                      <td className="border border-black p-2 text-right tabular-nums whitespace-nowrap">
                        {formatRp(printingTerm.ppnAmount)}
                      </td>
                    </tr>
                  )}
                  {printingTerm.retentionAmount > 0 && (
                    <tr>
                      <td colSpan={2} className="border border-black p-2 text-right">
                        Potongan Retensi (-)
                      </td>
                      <td className="border border-black p-2 text-right tabular-nums whitespace-nowrap">
                        - {formatRp(printingTerm.retentionAmount)}
                      </td>
                    </tr>
                  )}
                  {printingTerm.taxAmount > 0 && (
                    <tr>
                      <td colSpan={2} className="border border-black p-2 text-right">
                        Potongan PPh (-)
                      </td>
                      <td className="border border-black p-2 text-right tabular-nums whitespace-nowrap">
                        - {formatRp(printingTerm.taxAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={2} className="border border-black p-2 text-right">
                      TOTAL TAGIHAN NETTO
                    </td>
                    <td className="border border-black p-2 text-right tabular-nums whitespace-nowrap">
                      {formatRp(printingTerm.netAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="border border-black p-2 text-right">
                      Sudah Dibayar
                    </td>
                    <td className="border border-black p-2 text-right tabular-nums whitespace-nowrap">
                      {formatRp(printingTerm.paidAmount)}
                    </td>
                  </tr>
                  <tr className="font-bold">
                    <td colSpan={2} className="border border-black p-2 text-right">
                      SISA HARUS DIBAYAR
                    </td>
                    <td className="border border-black p-2 text-right tabular-nums whitespace-nowrap">
                      {formatRp(Math.max(0, printingTerm.netAmount - printingTerm.paidAmount))}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="border border-black p-2.5 bg-gray-50 text-xs mb-6">
                <strong>Terbilang:</strong> #{' '}
                {printingTerm.netAmount > 0 ? terbilang(Math.round(printingTerm.netAmount)) : 'Nol'} Rupiah #
              </div>

              <table className="w-full border-collapse text-xs">
                <tbody>
                  <tr>
                    <td className="w-1/2 align-top"></td>
                    <td className="w-1/2 align-top text-center">
                      <div>
                        {state.companyProfile.city}, {formatMaterialDate(printingTerm.issueDate)}
                      </div>
                      <div className="mt-1">Hormat kami, {state.companyProfile.name}</div>
                      {state.companyProfile.signature ? (
                        <img
                          src={state.companyProfile.signature}
                          alt="Tanda Tangan"
                          className="h-14 mx-auto my-2 object-contain"
                        />
                      ) : (
                        <div className="h-14" />
                      )}
                      <div className="font-bold underline">{state.companyProfile.director}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HIDDEN PRINT REPORT: FULL FINANCE & BILLING SUMMARY ==================== */}
      <div ref={financePrintRef} className="hidden print-only bg-white text-black p-4">
        <table className="w-full border-collapse border-b-2 border-black mb-3">
          <tbody>
            <tr>
              <td className="pb-2 text-left align-top">
                <div className="text-base font-bold uppercase">{state.companyProfile.name}</div>
                <div className="text-xs">Laporan Keuangan, Kontrak &amp; Penagihan Proyek</div>
              </td>
              <td className="pb-2 text-right align-top text-xs">
                <div>Proyek: <strong>{currentProject.name}</strong></div>
                <div>No. SPK: {contract?.contractNumber || '-'}</div>
                <div>Tanggal Cetak: {formatMaterialDate(todayIso)}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-xs mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th colSpan={4} className="border border-black p-1.5 text-left uppercase">
                Ringkasan Keuangan &amp; Kontrak
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-1.5">Nilai Kontrak Efektif</td>
              <td className="border border-black p-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                {formatRp(summary.effectiveContractValue)}
              </td>
              <td className="border border-black p-1.5">Total Beban Proyek</td>
              <td className="border border-black p-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                {formatRp(summary.totalProjectExpenses)}
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1.5">Total Tagihan Netto</td>
              <td className="border border-black p-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                {formatRp(summary.totalBilledNet)}
              </td>
              <td className="border border-black p-1.5">Estimasi Laba / Margin</td>
              <td className="border border-black p-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                {formatRp(summary.estimatedProfit)} ({summary.marginPercent.toFixed(1)}%)
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1.5">Sudah Diterima (Termin)</td>
              <td className="border border-black p-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                {formatRp(summary.totalBillingPaid)}
              </td>
              <td className="border border-black p-1.5">Sisa Piutang Penagihan</td>
              <td className="border border-black p-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                {formatRp(summary.totalReceivable)}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-xs mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-1.5 text-left">No. Invoice</th>
              <th className="border border-black p-1.5 text-left">Termin</th>
              <th className="border border-black p-1.5 text-center">Tempo</th>
              <th className="border border-black p-1.5 text-right">Netto</th>
              <th className="border border-black p-1.5 text-right">Dibayar</th>
              <th className="border border-black p-1.5 text-right">Piutang</th>
              <th className="border border-black p-1.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {enrichedBillings.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-black p-2 text-center">
                  Belum ada termin penagihan.
                </td>
              </tr>
            ) : (
              enrichedBillings.map(b => (
                <tr key={b.id}>
                  <td className="border border-black p-1.5">{b.invoiceNumber}</td>
                  <td className="border border-black p-1.5">
                    {b.termName} ({b.progressPercent}%)
                  </td>
                  <td className="border border-black p-1.5 text-center tabular-nums">
                    {formatMaterialDate(b.dueDate)}
                  </td>
                  <td className="border border-black p-1.5 text-right tabular-nums whitespace-nowrap">
                    {formatRp(b.netAmount)}
                  </td>
                  <td className="border border-black p-1.5 text-right tabular-nums whitespace-nowrap">
                    {formatRp(b.paidAmount)}
                  </td>
                  <td className="border border-black p-1.5 text-right tabular-nums whitespace-nowrap">
                    {formatRp(b.remaining)}
                  </td>
                  <td className="border border-black p-1.5 text-center">{b.resolvedStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
