import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBillingAmounts,
  calculateProjectFinanceSummary,
  getEffectiveContractValue,
  resolveBillingStatus,
} from './financeUtils';
import { INITIAL_STATE } from './constants';
import { AppState } from './types';

test('getEffectiveContractValue combines base value and addendums or falls back to budget', () => {
  const effective = getEffectiveContractValue(
    {
      id: 'c1',
      projectId: 'p1',
      contractNumber: 'SPK/001',
      title: 'Kandang Ayam',
      clientName: 'Bpk Kepala Desa',
      contractValue: 100_000_000,
      ppnPercent: 11,
      retentionPercent: 5,
      pphPercent: 2,
      downPaymentPercent: 20,
      startDate: '2026-02-01',
      endDate: '2026-03-31',
      status: 'Addendum',
      addendums: [
        { id: 'a1', title: 'Tambah Atap', date: '2026-02-15', amountDelta: 15_000_000 },
        { id: 'a2', title: 'Kurang Item', date: '2026-02-20', amountDelta: -5_000_000 },
      ],
    },
    50_000_000
  );
  assert.equal(effective, 110_000_000);

  assert.equal(getEffectiveContractValue(undefined, 75_000_000), 75_000_000);
});

test('calculateBillingAmounts computes PPN, retention, PPh, and net accurately', () => {
  const res = calculateBillingAmounts({
    grossAmount: 100_000_000,
    ppnPercent: 11,
    retentionPercent: 5,
    pphPercent: 2,
  });
  assert.equal(res.ppnAmount, 11_000_000);
  assert.equal(res.retentionAmount, 5_000_000);
  assert.equal(res.taxAmount, 2_000_000);
  assert.equal(res.netAmount, 104_000_000);
});

test('resolveBillingStatus detects Lunas, Sebagian, Draft, Terkirim, and Jatuh Tempo', () => {
  assert.equal(
    resolveBillingStatus(
      { status: 'Terkirim', netAmount: 10_000_000, paidAmount: 10_000_000, dueDate: '2026-02-01' },
      '2026-02-20'
    ),
    'Lunas'
  );
  assert.equal(
    resolveBillingStatus(
      { status: 'Terkirim', netAmount: 10_000_000, paidAmount: 4_000_000, dueDate: '2026-02-25' },
      '2026-02-20'
    ),
    'Sebagian'
  );
  assert.equal(
    resolveBillingStatus(
      { status: 'Terkirim', netAmount: 10_000_000, paidAmount: 4_000_000, dueDate: '2026-02-10' },
      '2026-02-20'
    ),
    'Jatuh Tempo'
  );
  assert.equal(
    resolveBillingStatus(
      { status: 'Draft', netAmount: 10_000_000, paidAmount: 0, dueDate: '2026-02-10' },
      '2026-02-20'
    ),
    'Draft'
  );
});

test('calculateProjectFinanceSummary aggregates contract, billings, materials, payments, and petty cash', () => {
  const state: AppState = {
    ...INITIAL_STATE,
    attendance: {
      per1: [
        {
          employeeId: '1',
          dailyRate: 200_000,
          overtimeRate: 25_000,
          days: {
            '2026-02-15': { date: '2026-02-15', isPresent: true, overtimeHours: 2 },
          },
        },
      ],
    },
    materials: {
      per1: [
        {
          id: 'm1',
          date: '2026-02-16',
          itemName: 'SEMEN',
          quantity: 10,
          unit: 'SAK',
          unitPrice: 70_000,
          totalPrice: 700_000,
        },
      ],
    },
    materialPayments: {
      per1: [{ id: 'mp1', date: '2026-02-17', amount: 300_000, note: 'DP Semen' }],
    },
    pettyCash: {
      p1: [
        { id: 'pc1', date: '2026-02-15', description: 'Kas Awal', type: 'in', amount: 1_000_000 },
        { id: 'pc2', date: '2026-02-16', description: 'Bensin', type: 'out', amount: 100_000 },
      ],
    },
    incomingFunds: {
      p1: [{ id: 'f1', date: '2026-02-15', source: 'Owner', amount: 2_000_000 }],
    },
    contracts: {
      p1: {
        id: 'c1',
        projectId: 'p1',
        contractNumber: 'SPK/01',
        title: 'Renovasi',
        clientName: 'Kepala Desa',
        contractValue: 10_000_000,
        ppnPercent: 0,
        retentionPercent: 5,
        pphPercent: 0,
        downPaymentPercent: 30,
        startDate: '2026-02-01',
        endDate: '2026-03-01',
        status: 'Aktif',
      },
    },
    billings: {
      p1: [
        {
          id: 'b1',
          projectId: 'p1',
          invoiceNumber: 'INV-001',
          termName: 'Termin 1',
          progressPercent: 50,
          grossAmount: 5_000_000,
          ppnAmount: 0,
          retentionAmount: 250_000,
          taxAmount: 0,
          netAmount: 4_750_000,
          paidAmount: 3_000_000,
          issueDate: '2026-02-16',
          dueDate: '2026-02-28',
          status: 'Sebagian',
          payments: [
            { id: 'bp1', date: '2026-02-18', amount: 3_000_000, method: 'Transfer Bank' },
          ],
        },
      ],
    },
  };

  const summary = calculateProjectFinanceSummary(state, 'p1', '2026-02-20');
  assert.equal(summary.effectiveContractValue, 10_000_000);
  assert.equal(summary.totalBilledGross, 5_000_000);
  assert.equal(summary.totalBilledNet, 4_750_000);
  assert.equal(summary.totalBillingPaid, 3_000_000);
  assert.equal(summary.totalReceivable, 1_750_000);
  assert.equal(summary.unbilledContract, 5_000_000);
  assert.equal(summary.totalPayrollCost, 250_000);
  assert.equal(summary.totalMaterialCost, 700_000);
  assert.equal(summary.totalMaterialPaid, 300_000);
  assert.equal(summary.totalMaterialDebt, 400_000);
  assert.equal(summary.totalPettyCashOut, 100_000);
  assert.equal(summary.totalProjectExpenses, 1_050_000);
  assert.equal(summary.estimatedProfit, 8_950_000);
  assert.equal(summary.cashInTotal, 6_000_000);
  assert.equal(summary.cashOutTotal, 650_000);
  assert.equal(summary.netCashflow, 5_350_000);
});
