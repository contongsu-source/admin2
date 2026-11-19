export enum ProjectStatus {
  Active = 'Active',
  Completed = 'Completed'
}

export interface User {
  username: string;
  role: 'admin' | 'user';
  name: string;
  lastLogin: string;
}

export interface Employee {
  id: string;
  projectId: string; // New field to link employee to a specific project
  name: string;
  position: string; // e.g., 'M', 'TK', 'TL'
  dailyRate: number;
  overtimeRate: number;
}

export interface DailyAttendance {
  date: string; // ISO date string
  isPresent: boolean; // 1 or 0
  overtimeHours: number;
  extraWorkDays?: number; // NEW: Extra work days for late clock-outs
  checkInTime?: string; // HH:mm format
  checkOutTime?: string; // HH:mm format
}

export interface AttendanceRecord {
  employeeId: string;
  days: Record<string, DailyAttendance>; // Keyed by date string
  dailyRate?: number; // Rate specific to this period
  overtimeRate?: number; // Overtime rate specific to this period
  cashAdvance?: number; // Potongan bon/kasbon (Debt/Cash Advance)
}

export interface MaterialItem {
  id: string;
  date: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  location?: string; // Nama tempat proyek
  notes?: string;
  receiptImage?: string; // Base64 or URL string
}

export interface MaterialPayment {
  id: string;
  date: string;
  amount: number;
  note?: string;
  location?: string; // Opsional: tempat proyek terkait
}

export interface PettyCashTransaction {
  id: string;
  date: string;
  description: string;
  type: 'in' | 'out'; // Pemasukan vs Pengeluaran
  amount: number;
}

export interface ProjectPeriod {
  id: string;
  projectId: string;
  startDate: string;
  endDate: string;
  name: string; // e.g., "Periode 15 SD 21 FEBRUARI 2026"
}

export interface Project {
  id: string;
  name: string; // e.g., "KANDANGAN", "JRUKUNG"
  clientName: string; // e.g., "Kepada Yth, Bpk. Kepala Desa Kandangan"
  clientAddress: string;
  currentPeriodId: string;
  budget?: number; // Dana Masuk
  status?: 'Aktif' | 'Selesai' | 'Pending'; // Status proyek
}

export interface CompanyProfile {
  name: string;
  address: string;
  director: string;
  city: string;
  signature?: string; // Base64 string untuk tanda tangan
}

export interface IncomingFund {
  id: string;
  date: string;
  source: string; // dari siapa
  amount: number;
}

export interface RABItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface ContractAddendum {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  amountDelta: number;
  newEndDate?: string;
  notes?: string;
}

export interface ProjectContract {
  id: string;
  projectId: string;
  contractNumber: string;
  title: string;
  clientName: string;
  contractValue: number;
  ppnPercent: number;
  retentionPercent: number;
  pphPercent: number;
  downPaymentPercent: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'Draft' | 'Aktif' | 'Addendum' | 'Selesai';
  notes?: string;
  addendums?: ContractAddendum[];
}

export interface BillingPaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
}

export type BillingStatus = 'Draft' | 'Terkirim' | 'Sebagian' | 'Lunas' | 'Jatuh Tempo';

export interface BillingTerm {
  id: string;
  projectId: string;
  invoiceNumber: string;
  termName: string;
  progressPercent: number;
  grossAmount: number;
  ppnAmount: number;
  retentionAmount: number;
  taxAmount: number;
  netAmount: number;
  paidAmount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: BillingStatus;
  payments?: BillingPaymentRecord[];
  notes?: string;
}

export interface AppState {
  companyProfile: CompanyProfile;
  projects: Project[];
  periods: ProjectPeriod[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord[]>; // Keyed by Period ID
  materials: Record<string, MaterialItem[]>; // Keyed by Period ID
  materialPayments?: Record<string, MaterialPayment[]>; // Keyed by Period ID
  pettyCash: Record<string, PettyCashTransaction[]>; // Keyed by Project ID
  incomingFunds: Record<string, IncomingFund[]>; // Keyed by Project ID
  rab: Record<string, RABItem[]>; // Keyed by Project ID
  contracts?: Record<string, ProjectContract>; // Keyed by Project ID
  billings?: Record<string, BillingTerm[]>; // Keyed by Project ID
  currentProjectId: string;
}

const stripUndefined = <T extends Record<string, any>>(obj: T): T => {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean as T;
};

export const prepareStateForSync = (state: AppState): AppState => {
  const syncState = { ...state };
  syncState.materials = {};
  for (const periodId in state.materials) {
    syncState.materials[periodId] = state.materials[periodId].map(item => {
      const { receiptImage, ...rest } = item;
      return stripUndefined(rest) as MaterialItem;
    });
  }
  if (state.materialPayments) {
    syncState.materialPayments = {};
    for (const periodId in state.materialPayments) {
      syncState.materialPayments[periodId] = (state.materialPayments[periodId] || []).map(p =>
        stripUndefined(p) as MaterialPayment
      );
    }
  }
  if (state.contracts) {
    syncState.contracts = {};
    for (const projectId in state.contracts) {
      const contract = state.contracts[projectId];
      if (!contract) continue;
      const cleanContract = stripUndefined({
        ...contract,
        addendums: contract.addendums ? contract.addendums.map(a => stripUndefined(a)) : undefined,
      });
      syncState.contracts[projectId] = cleanContract;
    }
  }
  if (state.billings) {
    syncState.billings = {};
    for (const projectId in state.billings) {
      syncState.billings[projectId] = (state.billings[projectId] || []).map(b =>
        stripUndefined({
          ...b,
          payments: b.payments ? b.payments.map(p => stripUndefined(p)) : undefined,
        })
      );
    }
  }
  return syncState;
};