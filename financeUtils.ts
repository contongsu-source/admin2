import {
  AppState,
  BillingStatus,
  BillingTerm,
  DailyAttendance,
  ProjectContract,
} from './types';

export interface CashflowEntry {
  id: string;
  date: string;
  direction: 'in' | 'out';
  category: 'Termin Penagihan' | 'Dana Masuk' | 'Pembayaran Material' | 'Kas Kecil';
  title: string;
  reference?: string;
  amount: number;
}

export interface ProjectFinanceSummary {
  baseContractValue: number;
  addendumTotal: number;
  effectiveContractValue: number;
  contractSource: 'contract' | 'budget' | 'none';
  totalBilledGross: number;
  totalBilledNet: number;
  totalBillingPaid: number;
  totalReceivable: number;
  unbilledContract: number;
  overdueCount: number;
  overdueAmount: number;
  totalIncomingFunds: number;
  totalPayrollCost: number;
  totalMaterialCost: number;
  totalMaterialPaid: number;
  totalMaterialDebt: number;
  totalPettyCashIn: number;
  totalPettyCashOut: number;
  totalProjectExpenses: number;
  estimatedProfit: number;
  marginPercent: number;
  cashInTotal: number;
  cashOutTotal: number;
  netCashflow: number;
  cashflowEntries: CashflowEntry[];
}

export function getAddendumTotal(contract?: ProjectContract): number {
  if (!contract?.addendums || contract.addendums.length === 0) return 0;
  return contract.addendums.reduce((sum, add) => sum + (Number(add.amountDelta) || 0), 0);
}

export function getEffectiveContractValue(
  contract?: ProjectContract,
  fallbackBudget: number = 0
): number {
  if (contract && contract.contractValue > 0) {
    return Math.max(0, contract.contractValue + getAddendumTotal(contract));
  }
  return Math.max(0, Number(fallbackBudget) || 0);
}

export function calculateBillingAmounts(params: {
  grossAmount: number;
  ppnPercent?: number;
  retentionPercent?: number;
  pphPercent?: number;
}): {
  grossAmount: number;
  ppnAmount: number;
  retentionAmount: number;
  taxAmount: number;
  netAmount: number;
} {
  const gross = Math.max(0, Math.round(Number(params.grossAmount) || 0));
  const ppnPct = Math.max(0, Number(params.ppnPercent) || 0);
  const retentionPct = Math.max(0, Number(params.retentionPercent) || 0);
  const pphPct = Math.max(0, Number(params.pphPercent) || 0);

  const ppnAmount = Math.round((gross * ppnPct) / 100);
  const retentionAmount = Math.round((gross * retentionPct) / 100);
  const taxAmount = Math.round((gross * pphPct) / 100);
  const netAmount = Math.max(0, gross + ppnAmount - retentionAmount - taxAmount);

  return {
    grossAmount: gross,
    ppnAmount,
    retentionAmount,
    taxAmount,
    netAmount,
  };
}

export function resolveBillingStatus(
  term: Pick<BillingTerm, 'status' | 'netAmount' | 'paidAmount' | 'dueDate'>,
  todayIso: string = new Date().toISOString().split('T')[0]
): BillingStatus {
  const net = Math.max(0, Number(term.netAmount) || 0);
  const paid = Math.max(0, Number(term.paidAmount) || 0);

  if (net > 0 && paid >= net) {
    return 'Lunas';
  }
  if (paid > 0 && paid < net) {
    if (term.dueDate && term.dueDate < todayIso) {
      return 'Jatuh Tempo';
    }
    return 'Sebagian';
  }
  if (term.status === 'Draft') {
    return 'Draft';
  }
  if (term.dueDate && term.dueDate < todayIso) {
    return 'Jatuh Tempo';
  }
  return 'Terkirim';
}

export function calculateProjectFinanceSummary(
  state: AppState,
  projectId: string,
  todayIso: string = new Date().toISOString().split('T')[0]
): ProjectFinanceSummary {
  const project = state.projects.find(p => p.id === projectId);
  const contract = state.contracts?.[projectId];
  const billings = state.billings?.[projectId] || [];
  const incomingFunds = state.incomingFunds?.[projectId] || [];
  const pettyCash = state.pettyCash?.[projectId] || [];
  const projectPeriods = state.periods.filter(p => p.projectId === projectId);

  const addendumTotal = getAddendumTotal(contract);
  const baseContractValue = contract ? Number(contract.contractValue) || 0 : 0;
  const hasExplicitContract = Boolean(contract && contract.contractValue > 0);
  const fallbackBudget = Number(project?.budget) || 0;
  const effectiveContractValue = hasExplicitContract
    ? Math.max(0, baseContractValue + addendumTotal)
    : Math.max(0, fallbackBudget);

  const contractSource: ProjectFinanceSummary['contractSource'] = hasExplicitContract
    ? 'contract'
    : fallbackBudget > 0
      ? 'budget'
      : 'none';

  // Billing metrics (exclude Draft from receivable/billed totals unless paid)
  let totalBilledGross = 0;
  let totalBilledNet = 0;
  let totalBillingPaid = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  const cashflowEntries: CashflowEntry[] = [];

  billings.forEach(term => {
    const resolvedStatus = resolveBillingStatus(term, todayIso);
    const paid = Math.max(0, Number(term.paidAmount) || 0);
    const net = Math.max(0, Number(term.netAmount) || 0);
    const gross = Math.max(0, Number(term.grossAmount) || 0);

    if (resolvedStatus !== 'Draft' || paid > 0) {
      totalBilledGross += gross;
      totalBilledNet += net;
      totalBillingPaid += paid;
    }

    if (resolvedStatus === 'Jatuh Tempo' && net > paid) {
      overdueCount += 1;
      overdueAmount += net - paid;
    }

    if (term.payments && term.payments.length > 0) {
      term.payments.forEach(pay => {
        if ((Number(pay.amount) || 0) > 0) {
          cashflowEntries.push({
            id: `billpay-${pay.id}`,
            date: pay.date,
            direction: 'in',
            category: 'Termin Penagihan',
            title: `${term.termName}${pay.method ? ` (${pay.method})` : ''}`,
            reference: pay.reference || term.invoiceNumber,
            amount: Number(pay.amount) || 0,
          });
        }
      });
    } else if (paid > 0) {
      cashflowEntries.push({
        id: `billpaid-${term.id}`,
        date: term.issueDate,
        direction: 'in',
        category: 'Termin Penagihan',
        title: term.termName,
        reference: term.invoiceNumber,
        amount: paid,
      });
    }
  });

  const totalReceivable = Math.max(0, totalBilledNet - totalBillingPaid);
  const unbilledContract = Math.max(0, effectiveContractValue - totalBilledGross);

  // Incoming Funds (modal / kas masuk di luar penagihan)
  const totalIncomingFunds = incomingFunds.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  incomingFunds.forEach(f => {
    if ((Number(f.amount) || 0) > 0) {
      cashflowEntries.push({
        id: `fund-${f.id}`,
        date: f.date,
        direction: 'in',
        category: 'Dana Masuk',
        title: f.source || 'Dana Masuk Proyek',
        amount: Number(f.amount) || 0,
      });
    }
  });

  // Payroll & Material across all periods of this project
  let totalPayrollCost = 0;
  let totalMaterialCost = 0;
  let totalMaterialPaid = 0;

  projectPeriods.forEach(period => {
    const attRecords = state.attendance[period.id] || [];
    attRecords.forEach(record => {
      const emp = state.employees.find(e => e.id === record.employeeId && e.projectId === projectId);
      if (!emp) return;
      let workDays = 0;
      let overtimeHours = 0;
      Object.values(record.days || {}).forEach((day: DailyAttendance) => {
        if (day.date >= period.startDate && day.date <= period.endDate) {
          if (day.isPresent) workDays += 1;
          if (day.extraWorkDays) workDays += day.extraWorkDays;
          overtimeHours += day.overtimeHours || 0;
        }
      });
      const dailyRate = record.dailyRate ?? emp.dailyRate;
      const overtimeRate = record.overtimeRate ?? emp.overtimeRate;
      totalPayrollCost += workDays * dailyRate + overtimeHours * overtimeRate;
    });

    const mats = state.materials[period.id] || [];
    totalMaterialCost += mats.reduce((sum, m) => sum + (Number(m.totalPrice) || 0), 0);

    const matPays = state.materialPayments?.[period.id] || [];
    matPays.forEach(mp => {
      const amt = Number(mp.amount) || 0;
      if (amt > 0) {
        totalMaterialPaid += amt;
        cashflowEntries.push({
          id: `matpay-${mp.id}`,
          date: mp.date,
          direction: 'out',
          category: 'Pembayaran Material',
          title: mp.note || 'Pembayaran Tagihan Material',
          reference: mp.location || period.name,
          amount: amt,
        });
      }
    });
  });

  const totalMaterialDebt = Math.max(0, totalMaterialCost - totalMaterialPaid);

  // Petty cash
  let totalPettyCashIn = 0;
  let totalPettyCashOut = 0;
  pettyCash.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) return;
    if (tx.type === 'in') {
      totalPettyCashIn += amt;
      cashflowEntries.push({
        id: `pc-${tx.id}`,
        date: tx.date,
        direction: 'in',
        category: 'Kas Kecil',
        title: tx.description,
        amount: amt,
      });
    } else {
      totalPettyCashOut += amt;
      cashflowEntries.push({
        id: `pc-${tx.id}`,
        date: tx.date,
        direction: 'out',
        category: 'Kas Kecil',
        title: tx.description,
        amount: amt,
      });
    }
  });

  const totalProjectExpenses = totalPayrollCost + totalMaterialCost + totalPettyCashOut;
  const revenueBasis = Math.max(effectiveContractValue, totalBilledGross);
  const estimatedProfit = revenueBasis - totalProjectExpenses;
  const marginPercent = revenueBasis > 0 ? (estimatedProfit / revenueBasis) * 100 : 0;

  const cashInTotal = totalBillingPaid + totalIncomingFunds + totalPettyCashIn;
  const cashOutTotal = totalPayrollCost + totalMaterialPaid + totalPettyCashOut;
  const netCashflow = cashInTotal - cashOutTotal;

  cashflowEntries.sort((a, b) => b.date.localeCompare(a.date));

  return {
    baseContractValue,
    addendumTotal,
    effectiveContractValue,
    contractSource,
    totalBilledGross,
    totalBilledNet,
    totalBillingPaid,
    totalReceivable,
    unbilledContract,
    overdueCount,
    overdueAmount,
    totalIncomingFunds,
    totalPayrollCost,
    totalMaterialCost,
    totalMaterialPaid,
    totalMaterialDebt,
    totalPettyCashIn,
    totalPettyCashOut,
    totalProjectExpenses,
    estimatedProfit,
    marginPercent,
    cashInTotal,
    cashOutTotal,
    netCashflow,
    cashflowEntries,
  };
}
