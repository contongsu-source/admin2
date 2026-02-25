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
}

export interface AttendanceRecord {
  employeeId: string;
  days: Record<string, DailyAttendance>; // Keyed by date string
}

export interface MaterialItem {
  id: string;
  date: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  receiptImage?: string; // Base64 or URL string
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
}

export interface CompanyProfile {
  name: string;
  address: string;
  director: string;
  city: string;
}

export interface AppState {
  companyProfile: CompanyProfile;
  projects: Project[];
  periods: ProjectPeriod[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord[]>; // Keyed by Period ID
  materials: Record<string, MaterialItem[]>; // Keyed by Period ID
  pettyCash: Record<string, PettyCashTransaction[]>; // Keyed by Project ID
  currentProjectId: string;
}