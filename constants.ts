import { AppState, Employee, Project, ProjectPeriod, MaterialItem, AttendanceRecord, CompanyProfile, PettyCashTransaction } from './types';

export const INITIAL_COMPANY_PROFILE: CompanyProfile = {
  name: 'CV. Sembilan Bintang Abadi',
  address: 'Ds. Pancuran Rt.003 Rw.002 Kandangan, Bawen Kab. Semarang Jawa Tengah',
  director: 'EKHWANUDIN',
  city: 'Kandangan'
};

// Employees for Project 1 (KANDANGAN)
const EMPLOYEES_P1: Employee[] = [
  { id: '1', projectId: 'p1', name: 'IKWAN', position: 'M', dailyRate: 200000, overtimeRate: 28500 },
  { id: '2', projectId: 'p1', name: 'MIKI', position: 'Worker', dailyRate: 100000, overtimeRate: 0 },
  { id: '3', projectId: 'p1', name: 'COYO', position: 'TK', dailyRate: 130000, overtimeRate: 18500 },
  { id: '4', projectId: 'p1', name: 'YANTO LAS', position: 'TL', dailyRate: 110000, overtimeRate: 16000 },
  { id: '5', projectId: 'p1', name: 'YANTO TK', position: 'TK', dailyRate: 130000, overtimeRate: 18500 },
  { id: '6', projectId: 'p1', name: 'RUBIN', position: 'Worker', dailyRate: 130000, overtimeRate: 18500 },
  { id: '7', projectId: 'p1', name: 'KENTO', position: 'Worker', dailyRate: 110000, overtimeRate: 16000 },
  { id: '8', projectId: 'p1', name: 'ANDIK', position: 'Worker', dailyRate: 135000, overtimeRate: 18500 },
  { id: '9', projectId: 'p1', name: 'MUNIR', position: 'Worker', dailyRate: 120000, overtimeRate: 17000 },
  { id: '10', projectId: 'p1', name: 'KISMUN', position: 'Worker', dailyRate: 110000, overtimeRate: 16000 },
];

// Employees for Project 2 (JRUKUNG) - Distinct set of employees
const EMPLOYEES_P2: Employee[] = [
  { id: '11', projectId: 'p2', name: 'SUTRAS', position: 'Worker', dailyRate: 120000, overtimeRate: 17000 },
  { id: '12', projectId: 'p2', name: 'UDIN', position: 'Worker', dailyRate: 140000, overtimeRate: 18500 },
  { id: '13', projectId: 'p2', name: 'SAHRONI', position: 'Worker', dailyRate: 110000, overtimeRate: 16000 },
  { id: '14', projectId: 'p2', name: 'P JO', position: 'Worker', dailyRate: 110000, overtimeRate: 16000 },
];

export const INITIAL_EMPLOYEES: Employee[] = [...EMPLOYEES_P1, ...EMPLOYEES_P2];

export const PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'KANDANGAN',
    clientName: 'Bpk. Kepala Desa Kandangan',
    clientAddress: 'Desa Kandangan, Kec. Bawen, Kab. Semarang',
    currentPeriodId: 'per1'
  },
  {
    id: 'p2',
    name: 'JRUKUNG',
    clientName: 'Bpk. Pemilik Proyek Jrukung',
    clientAddress: 'Jrukung Area',
    currentPeriodId: 'per2'
  }
];

export const PERIODS: ProjectPeriod[] = [
  {
    id: 'per1',
    projectId: 'p1',
    startDate: '2026-02-15',
    endDate: '2026-02-21',
    name: '15 SD 21 FEBRUARI 2026'
  },
  {
    id: 'per2',
    projectId: 'p2',
    startDate: '2026-01-01',
    endDate: '2026-01-07',
    name: '01 SD 07 JANUARI 2026'
  }
];

// Helper to generate empty attendance
const generateAttendance = (period: ProjectPeriod, employees: Employee[]): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);

  // Only generate attendance for employees belonging to the project
  const projectEmployees = employees.filter(e => e.projectId === period.projectId);

  projectEmployees.forEach(emp => {
    const record: AttendanceRecord = { employeeId: emp.id, days: {} };
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let isPresent = false;
      
      // Simulate data randomly for demo
      if (Math.random() > 0.3) {
         isPresent = true;
      } 
      
      record.days[dateStr] = {
        date: dateStr,
        isPresent: isPresent,
        overtimeHours: 0
      };
    }
    records.push(record);
  });
  return records;
};

export const INITIAL_ATTENDANCE: Record<string, AttendanceRecord[]> = {
  'per1': generateAttendance(PERIODS[0], INITIAL_EMPLOYEES),
  'per2': generateAttendance(PERIODS[1], INITIAL_EMPLOYEES),
};

export const INITIAL_MATERIALS: Record<string, MaterialItem[]> = {
  'p1': [
    { id: 'm1', date: '2026-02-10', itemName: 'KABEL BIASA 45 METER', quantity: 1, unit: 'ROLL', unitPrice: 100000, totalPrice: 100000 },
    { id: 'm2', date: '2026-02-10', itemName: 'AQUA GALON', quantity: 1, unit: 'GALON', unitPrice: 20000, totalPrice: 20000 },
    { id: 'm3', date: '2026-02-10', itemName: 'ANGKUT BATRE KANDANG AYAM', quantity: 1, unit: 'TRIP', unitPrice: 320000, totalPrice: 320000 },
  ],
  'p2': []
};

// Initial Petty Cash Data
export const INITIAL_PETTY_CASH: Record<string, PettyCashTransaction[]> = {
  'p1': [
    { id: 'pc1', date: '2026-02-15', description: 'Dana Awal dari Kantor', type: 'in', amount: 5000000 },
    { id: 'pc2', date: '2026-02-16', description: 'Beli Kopi & Gula', type: 'out', amount: 50000 },
    { id: 'pc3', date: '2026-02-17', description: 'Bensin Operasional', type: 'out', amount: 35000 },
  ],
  'p2': []
};

export const INITIAL_STATE: AppState = {
  companyProfile: INITIAL_COMPANY_PROFILE,
  projects: PROJECTS,
  periods: PERIODS,
  employees: INITIAL_EMPLOYEES,
  attendance: INITIAL_ATTENDANCE,
  materials: INITIAL_MATERIALS,
  pettyCash: INITIAL_PETTY_CASH,
  currentProjectId: 'p1',
};