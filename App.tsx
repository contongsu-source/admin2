import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AttendancePage } from './components/AttendancePage';
import { PayrollPage } from './components/PayrollPage';
import { MaterialPage } from './components/MaterialPage';
import { InvoicePage } from './components/InvoicePage';
import { SettingsPage } from './components/SettingsPage';
import { PettyCashPage } from './components/PettyCashPage';
import { RABPage } from './components/RABPage';
import { ConsolidatedReport } from './components/ConsolidatedReport';
import { ProjectSummaryPage } from './components/ProjectSummaryPage';
import { FinanceBillingPage } from './components/FinanceBillingPage';
import { AppState, AttendanceRecord, MaterialItem, MaterialPayment, CompanyProfile, Project, ProjectPeriod, DailyAttendance, Employee, PettyCashTransaction, IncomingFund, RABItem, ProjectContract, BillingTerm, prepareStateForSync } from './types';
import { INITIAL_STATE } from './constants';
import { deepEqual } from './utils';
import { Cloud, CheckCircle2, AlertCircle, LogIn, X } from 'lucide-react';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDocFromServer } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const App: React.FC = () => {
  // --- Dark Mode State ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
      return localStorage.getItem('sba_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sba_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sba_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- App Data State ---
  const [state, setState] = useState<AppState>(() => {
    try {
      const savedState = localStorage.getItem('sba_local_data');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (!parsed.incomingFunds) parsed.incomingFunds = {};
        if (typeof parsed.currentProjectId !== 'string') parsed.currentProjectId = '';
        if (!parsed.companyProfile) parsed.companyProfile = INITIAL_STATE.companyProfile;
        if (!parsed.projects) parsed.projects = [];
        if (!parsed.periods) parsed.periods = [];
        if (!parsed.employees) parsed.employees = [];
        if (!parsed.attendance) parsed.attendance = {};
        if (!parsed.materials) parsed.materials = {};
        if (!parsed.materialPayments) parsed.materialPayments = {};
        if (!parsed.pettyCash) parsed.pettyCash = {};
        if (!parsed.rab) parsed.rab = {};
        if (!parsed.contracts) parsed.contracts = {};
        if (!parsed.billings) parsed.billings = {};

        // MIGRATION: Assign missing projectId to employees based on their first found attendance record
        let needsUpdate = false;
        parsed.employees = parsed.employees.map((emp: any) => {
            if (!emp.projectId) {
                needsUpdate = true;
                let foundProjectId = parsed.currentProjectId || (parsed.projects.length > 0 ? parsed.projects[0].id : '');
                // Find which project's period has this employee's attendance
                for (const periodId of Object.keys(parsed.attendance)) {
                    const period = parsed.periods.find((p: any) => p.id === periodId);
                    const hasAttendance = parsed.attendance[periodId].some((r: any) => r.employeeId === emp.id);
                    if (period && hasAttendance) {
                        foundProjectId = period.projectId;
                        break;
                    }
                }
                return { ...emp, projectId: foundProjectId };
            }
            return emp;
        });

        // Ensure attendance records only exist in periods belonging to the employee's project
        if (needsUpdate) {
            Object.keys(parsed.attendance).forEach(periodId => {
                const period = parsed.periods.find((p: any) => p.id === periodId);
                if (period) {
                    parsed.attendance[periodId] = parsed.attendance[periodId].filter((record: any) => {
                        const emp = parsed.employees.find((e: any) => e.id === record.employeeId);
                        return emp && emp.projectId === period.projectId;
                    });
                }
            });
        }

        return parsed;
      }
    } catch (e) {
      console.error("Failed to load state from local storage", e);
    }
    return INITIAL_STATE;
  });

  const [currentView, setCurrentView] = useState('dashboard');
  
  // --- Cloud Sync State ---
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const lastCloudStateRef = useRef<AppState | null>(null);

  // Save to LocalStorage always (as backup)
  useEffect(() => {
     localStorage.setItem('sba_local_data', JSON.stringify(state));
  }, [state]);

  // MIGRATION: Move legacy materials (keyed by projectId) to current period
  useEffect(() => {
    setState(prev => {
        let hasCorruption = false;
        const cleanAttendance: Record<string, AttendanceRecord[]> = {};
        
        Object.keys(prev.attendance).forEach(key => {
            if (Array.isArray(prev.attendance[key])) {
                cleanAttendance[key] = prev.attendance[key];
            } else {
                hasCorruption = true;
            }
        });

        if (hasCorruption) {
            return {
                ...prev,
                attendance: cleanAttendance
            };
        }
        return prev;
    });

    const currentProject = state.projects.find(p => p.id === state.currentProjectId);
    if (!currentProject) return;

    const legacyMaterials = state.materials[state.currentProjectId];
    if (legacyMaterials && legacyMaterials.length > 0) {
        
        setState(prev => {
            const newMaterials = { ...prev.materials };
            const projectPeriods = prev.periods.filter(p => p.projectId === state.currentProjectId);

            // Helper to find period for a date
            const findPeriodForDate = (dateStr: string) => {
                return projectPeriods.find(p => {
                    return dateStr >= p.startDate && dateStr <= p.endDate;
                });
            };

            // Distribute legacy materials to their respective periods
            const groupedLegacy: Record<string, MaterialItem[]> = {};
            legacyMaterials.forEach(item => {
                const targetPeriod = findPeriodForDate(item.date);
                // If found, use that period ID. If not, fallback to currentProject.currentPeriodId
                const targetId = targetPeriod ? targetPeriod.id : currentProject.currentPeriodId;
                
                if (!groupedLegacy[targetId]) groupedLegacy[targetId] = [];
                groupedLegacy[targetId].push(item);
            });

            // Merge into newMaterials
            Object.keys(groupedLegacy).forEach(periodId => {
                const existing = newMaterials[periodId] || [];
                // Prevent duplicate elements from merging into existing state
                const existingIds = new Set(existing.map(item => item.id));
                const uniqueNewItems = groupedLegacy[periodId].filter(item => !existingIds.has(item.id));
                
                newMaterials[periodId] = [...existing, ...uniqueNewItems];
            });
            
            delete newMaterials[state.currentProjectId]; 
            
            return {
                ...prev,
                materials: newMaterials
            };
        });
    }
  }, [state.currentProjectId, state.materials]);

  // INITIAL LOAD FROM FIRESTORE
  useEffect(() => {
      if (!isAuthReady || !user) return;

      setIsLoadingCloud(true);
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as AppState;
              if (data && data.companyProfile) {
                  if (!data.incomingFunds) data.incomingFunds = {};
                  if (!data.rab) data.rab = {};
                  if (typeof data.currentProjectId !== 'string') data.currentProjectId = '';
                  if (!data.projects) data.projects = [];
                  if (!data.periods) data.periods = [];
                  if (!data.employees) data.employees = [];
                  if (!data.attendance) data.attendance = {};
                  if (!data.materials) data.materials = {};
                  if (!data.materialPayments) data.materialPayments = {};
                  if (!data.pettyCash) data.pettyCash = {};
                  if (!data.contracts) data.contracts = {};
                  if (!data.billings) data.billings = {};
                  
                  // MIGRATION: Assign missing projectId to employees based on their first found attendance record
                  let needsUpdate = false;
                  data.employees = data.employees.map(emp => {
                      if (!emp.projectId) {
                          needsUpdate = true;
                          let foundProjectId = data.currentProjectId || (data.projects.length > 0 ? data.projects[0].id : '');
                          // Find which project's period has this employee's attendance
                          for (const periodId of Object.keys(data.attendance)) {
                              const period = data.periods.find(p => p.id === periodId);
                              const hasAttendance = data.attendance[periodId].some(r => r.employeeId === emp.id);
                              if (period && hasAttendance) {
                                  foundProjectId = period.projectId;
                                  break;
                              }
                          }
                          return { ...emp, projectId: foundProjectId };
                      }
                      return emp;
                  });

                  // Ensure attendance records only exist in periods belonging to the employee's project
                  if (needsUpdate) {
                     Object.keys(data.attendance).forEach(periodId => {
                         const period = data.periods.find(p => p.id === periodId);
                         if (period) {
                             data.attendance[periodId] = data.attendance[periodId].filter(record => {
                                 const emp = data.employees.find(e => e.id === record.employeeId);
                                 return emp && emp.projectId === period.projectId;
                             });
                         }
                     });
                  }
                  
                  if (!deepEqual(lastCloudStateRef.current, data)) {
                      lastCloudStateRef.current = data;
                      setState(data);
                  }
              }
          }
          setIsLoadingCloud(false);
      }, (error) => {
          setSyncStatus('error');
          setSyncErrorMsg(error instanceof Error ? error.message : String(error));
          setIsLoadingCloud(false);
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });

      return () => unsubscribe();
  }, [user, isAuthReady]);

  // AUTO SYNC TO FIRESTORE
  useEffect(() => {
    if (!isAuthReady || !user || isLoadingCloud) return;

    const syncState = prepareStateForSync(state);
    const cleanSyncState = JSON.parse(JSON.stringify(syncState));
    if (deepEqual(lastCloudStateRef.current, cleanSyncState)) return;

    setSyncStatus('syncing');
    setSyncErrorMsg(null);
    
    // Debounce the save
    const timer = setTimeout(async () => {
        try {
            lastCloudStateRef.current = cleanSyncState;
            await setDoc(doc(db, 'users', user.uid), cleanSyncState);
            setSyncStatus('saved');
        } catch (error) {
            setSyncStatus('error');
            setSyncErrorMsg(error instanceof Error ? error.message : String(error));
            handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
        
        // Revert to idle after showing status
        setTimeout(() => setSyncStatus('idle'), 3000);
    }, 500); 

    return () => clearTimeout(timer);
  }, [state, user, isAuthReady, isLoadingCloud]);

  const handleUpdateAttendance = (newRecords: AttendanceRecord[]) => {
    const project = state.projects.find(p => p.id === state.currentProjectId);
    if (!project) return;
    
    setState(prev => ({
      ...prev,
      attendance: {
        ...prev.attendance,
        [project.currentPeriodId]: newRecords
      }
    }));
  };

  const handleUpdateMaterials = (newMaterials: MaterialItem[]) => {
    const project = state.projects.find(p => p.id === state.currentProjectId);
    if (!project) return;
    const currentPeriodId = project.currentPeriodId;

    // Get all periods for this project
    const projectPeriods = state.periods.filter(p => p.projectId === state.currentProjectId);

    // Helper to find period for a date
    const findPeriodForDate = (dateStr: string) => {
        return projectPeriods.find(p => {
            return dateStr >= p.startDate && dateStr <= p.endDate;
        });
    };

    // Prepare updates map
    // We start by assuming we are replacing the current period's list
    // But we will only push items back into it if they still belong there
    const updates: Record<string, MaterialItem[]> = {};
    updates[currentPeriodId] = [];

    newMaterials.forEach(item => {
        const targetPeriod = findPeriodForDate(item.date);
        // If found, use that period ID. If not, fallback to currentPeriodId
        const targetId = targetPeriod ? targetPeriod.id : currentPeriodId;
        
        if (targetId === currentPeriodId) {
            // Stays in current period
            updates[currentPeriodId].push(item);
        } else {
            // Moves to another period
            if (!updates[targetId]) {
                // Initialize with existing items from that period
                updates[targetId] = [...(state.materials[targetId] || [])];
            }
            updates[targetId].push(item);
        }
    });

    setState(prev => ({
      ...prev,
      materials: {
        ...prev.materials,
        ...updates
      }
    }));
  };

  const handleUpdateMaterialPayments = (newPayments: MaterialPayment[]) => {
    const project = state.projects.find(p => p.id === state.currentProjectId);
    if (!project) return;
    const currentPeriodId = project.currentPeriodId;

    setState(prev => ({
      ...prev,
      materialPayments: {
        ...(prev.materialPayments || {}),
        [currentPeriodId]: newPayments
      }
    }));
  };

  const handleUpdatePettyCash = (transactions: PettyCashTransaction[]) => {
      setState(prev => ({
          ...prev,
          pettyCash: {
              ...prev.pettyCash,
              [state.currentProjectId]: transactions
          }
      }));
  };

  const handleUpdateRAB = (rabItems: RABItem[]) => {
      setState(prev => ({
          ...prev,
          rab: {
              ...prev.rab,
              [state.currentProjectId]: rabItems
          }
      }));
  };

  const handleUpdateIncomingFunds = (projectId: string, funds: IncomingFund[]) => {
      setState(prev => ({
          ...prev,
          incomingFunds: {
              ...prev.incomingFunds,
              [projectId]: funds
          }
      }));
  };

  const handleUpdateContract = (projectId: string, contract: ProjectContract) => {
      setState(prev => ({
          ...prev,
          contracts: {
              ...(prev.contracts || {}),
              [projectId]: contract
          }
      }));
  };

  const handleUpdateBillings = (projectId: string, billings: BillingTerm[]) => {
      setState(prev => ({
          ...prev,
          billings: {
              ...(prev.billings || {}),
              [projectId]: billings
          }
      }));
  };

  const handleProjectChange = (projectId: string) => {
      setState(prev => ({
          ...prev,
          currentProjectId: projectId
      }));
  };

  const handleUpdateCompany = (profile: CompanyProfile) => {
      setState(prev => ({ ...prev, companyProfile: profile }));
  };

  const handleDeleteProject = (projectId: string) => {
      setState(prev => {
          const newProjects = prev.projects.filter(p => p.id !== projectId);
          // Also cleanup employees for this project to keep state clean (optional but recommended)
          const newEmployees = prev.employees.filter(e => e.projectId !== projectId);
          
          const newCurrentId = prev.currentProjectId === projectId 
            ? (newProjects[0]?.id || '') 
            : prev.currentProjectId;
          
          return {
              ...prev,
              projects: newProjects,
              employees: newEmployees,
              currentProjectId: newCurrentId
          };
      });
  };

  const handleImportData = (newState: AppState) => {
      setState(newState);
  };

  // --- Employee Management Logic ---

  const handleAddEmployee = (empData: Omit<Employee, 'id' | 'projectId'>) => {
    const newId = (state.employees.length > 0 
        ? Math.max(...state.employees.map(e => parseInt(e.id))) + 1 
        : 1).toString();
    
    const newEmployee: Employee = { 
        ...empData, 
        id: newId, 
        projectId: state.currentProjectId // Assign to current project
    };

    const currentAttendance = { ...state.attendance };
    Object.keys(currentAttendance).forEach(periodId => {
        const period = state.periods.find(p => p.id === periodId);
        // Only add attendance record if the period belongs to the same project
        if (period && period.projectId === state.currentProjectId) {
            const start = new Date(period.startDate);
            const end = new Date(period.endDate);
            const days: Record<string, DailyAttendance> = {};
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                days[dateStr] = { date: dateStr, isPresent: false, overtimeHours: 0 };
            }
            
            currentAttendance[periodId] = [
                ...(currentAttendance[periodId] || []),
                { employeeId: newId, days }
            ];
        }
    });

    setState(prev => ({
        ...prev,
        employees: [...prev.employees, newEmployee],
        attendance: currentAttendance
    }));
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
      setState(prev => {
          const currentProject = prev.projects.find(p => p.id === prev.currentProjectId);
          const currentPeriodId = currentProject?.currentPeriodId;
          
          let newAttendance = { ...prev.attendance };
          
          // If there is a current period, update the employee's rate in the current period's attendance record as well
          if (currentPeriodId && newAttendance[currentPeriodId]) {
              newAttendance[currentPeriodId] = newAttendance[currentPeriodId].map(record => {
                  if (record.employeeId === updatedEmp.id) {
                      return {
                          ...record,
                          dailyRate: updatedEmp.dailyRate,
                          overtimeRate: updatedEmp.overtimeRate
                      };
                  }
                  return record;
              });
          }

          return {
              ...prev,
              employees: prev.employees.map(e => e.id === updatedEmp.id ? updatedEmp : e),
              attendance: newAttendance
          };
      });
  };

  const handleDeleteEmployee = (empId: string) => {
      if(!confirm("Hapus karyawan ini secara PERMANEN dari sistem? Semua data absensi di SEMUA periode akan hilang.")) return;
      
      setState(prev => ({
          ...prev,
          employees: prev.employees.filter(e => e.id !== empId),
          // Also cleanup attendance records across all periods
          attendance: Object.keys(prev.attendance).reduce((acc, periodId) => {
              if (Array.isArray(prev.attendance[periodId])) {
                  acc[periodId] = prev.attendance[periodId].filter(r => r.employeeId !== empId);
              }
              return acc;
          }, {} as Record<string, AttendanceRecord[]>)
      }));
  };

  const handleRemoveEmployeeFromPeriod = (empId: string, periodId: string) => {
    if(!confirm("Hapus data karyawan ini dari PERIODE INI saja? Data di periode lain tidak akan terhapus.")) return;
    
    setState(prev => ({
      ...prev,
      attendance: {
        ...prev.attendance,
        [periodId]: (prev.attendance[periodId] || []).filter(r => r.employeeId !== empId)
      }
    }));
  };

  const handleAddEmployeeToPeriod = (empId: string, periodId: string) => {
    const period = state.periods.find(p => p.id === periodId);
    if (!period) return;

    setState(prev => {
        const existingRecords = prev.attendance[periodId] || [];
        if (existingRecords.find(r => r.employeeId === empId)) return prev;

        const start = new Date(period.startDate);
        const end = new Date(period.endDate);
        const days: Record<string, DailyAttendance> = {};
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            days[dateStr] = { date: dateStr, isPresent: false, overtimeHours: 0 };
        }

        const emp = prev.employees.find(e => e.id === empId);
        
        return {
            ...prev,
            attendance: {
                ...prev.attendance,
                [periodId]: [...existingRecords, { 
                    employeeId: empId, 
                    days,
                    dailyRate: emp?.dailyRate,
                    overtimeRate: emp?.overtimeRate
                }]
            }
        };
    });
  };

  // --- End Employee Management ---

  const generatePeriodName = (startStr: string, endStr: string) => {
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const s = new Date(startStr);
    const e = new Date(endStr);
    
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${s.getDate().toString().padStart(2, '0')} SD ${e.getDate().toString().padStart(2, '0')} ${months[s.getMonth()]} ${s.getFullYear()}`;
    } else {
         return `${s.getDate().toString().padStart(2, '0')} ${months[s.getMonth()]} SD ${e.getDate().toString().padStart(2, '0')} ${months[e.getMonth()]} ${e.getFullYear()}`;
    }
  };

  const handleAddNewPeriod = (projectId: string, startDate: string, endDate: string) => {
      const newPeriodId = `per${Date.now()}`;
      const periodName = generatePeriodName(startDate, endDate);
      
      const newPeriod: ProjectPeriod = {
          id: newPeriodId,
          projectId: projectId,
          startDate,
          endDate,
          name: periodName
      };

      // Initialize attendance for the new period with existing employees of the project
      const projectEmployees = state.employees.filter(e => e.projectId === projectId);
      const newAttendance: AttendanceRecord[] = projectEmployees.map(emp => {
          const days: Record<string, DailyAttendance> = {};
          const start = new Date(startDate);
          const end = new Date(endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              days[dateStr] = { date: dateStr, isPresent: false, overtimeHours: 0 };
          }
          return { 
              employeeId: emp.id, 
              days,
              dailyRate: emp.dailyRate,
              overtimeRate: emp.overtimeRate
          };
      });

      setState(prev => ({
          ...prev,
          periods: [...prev.periods, newPeriod],
          attendance: { ...prev.attendance, [newPeriodId]: newAttendance },
          projects: prev.projects.map(p => p.id === projectId ? { ...p, currentPeriodId: newPeriodId } : p)
      }));
  };

  const handleUpdatePeriod = (periodId: string, startDate: string, endDate: string, keepName: boolean = false, customName?: string) => {
      setState(prev => ({
          ...prev,
          periods: prev.periods.map(p => {
              if (p.id === periodId) {
                  let newName = p.name;
                  if (customName !== undefined) {
                      newName = customName;
                  } else if (!keepName) {
                      newName = generatePeriodName(startDate, endDate);
                  }
                  return { ...p, startDate, endDate, name: newName };
              }
              return p;
          }),
          attendance: {
              ...prev.attendance,
              [periodId]: (prev.attendance[periodId] || []).map(record => {
                  const newDays: Record<string, DailyAttendance> = {};
                  const start = new Date(startDate);
                  const end = new Date(endDate);
                  
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                       const dateStr = d.toISOString().split('T')[0];
                       // Preserve existing data if it exists for this date
                       if (record.days && record.days[dateStr]) {
                           newDays[dateStr] = record.days[dateStr];
                       } else {
                           newDays[dateStr] = { date: dateStr, isPresent: false, overtimeHours: 0 };
                       }
                  }
                  
                  return { ...record, days: newDays };
              })
          }
      }));
  };

  const handleAddProject = (name: string, clientName: string, clientAddress: string, startDate: string, endDate: string, budget: number = 0, status: 'Aktif' | 'Selesai' | 'Pending' = 'Aktif') => {
    const newProjectId = `p${Date.now()}`;
    const newPeriodId = `per${Date.now()}`;
    const periodName = generatePeriodName(startDate, endDate);
    
    const newProject: Project = {
        id: newProjectId,
        name: name.toUpperCase(),
        clientName,
        clientAddress,
        currentPeriodId: newPeriodId,
        budget,
        status
    };
    
    const newPeriod: ProjectPeriod = {
        id: newPeriodId,
        projectId: newProjectId,
        startDate,
        endDate,
        name: periodName
    };
    
    // START NEW PROJECT WITH 0 EMPLOYEES
    // User must add employees manually to this specific project
    const newAttendance: AttendanceRecord[] = []; 

    setState(prev => ({
        ...prev,
        projects: [...prev.projects, newProject],
        periods: [...prev.periods, newPeriod],
        attendance: { ...prev.attendance, [newPeriodId]: newAttendance },
        materials: { ...prev.materials, [newProjectId]: [] },
        pettyCash: { ...prev.pettyCash, [newProjectId]: [] },
        rab: { ...prev.rab, [newProjectId]: [] },
        billings: { ...(prev.billings || {}), [newProjectId]: [] },
        currentProjectId: newProjectId 
    }));
  };

  const handleUpdateProject = (projectId: string, updates: Partial<Project>) => {
      setState(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === projectId ? { ...p, ...updates } : p)
      }));
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard state={state} onChangeView={setCurrentView} />;
      case 'attendance':
        return <AttendancePage 
            state={state} 
            onUpdate={handleUpdateAttendance}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onRemoveFromPeriod={handleRemoveEmployeeFromPeriod}
            onAddToPeriod={handleAddEmployeeToPeriod}
            onChangeView={setCurrentView}
        />;
      case 'payroll':
        return <PayrollPage 
            state={state} 
            onUpdateEmployee={handleUpdateEmployee}
            onUpdateAttendance={handleUpdateAttendance}
            onChangeView={setCurrentView}
        />;
      case 'materials':
        return <MaterialPage 
            state={state} 
            onUpdate={handleUpdateMaterials}
            onUpdatePayments={handleUpdateMaterialPayments}
            onChangeView={setCurrentView}
        />;
      case 'petty_cash':
        return <PettyCashPage state={state} onUpdate={handleUpdatePettyCash} />;
      case 'rab':
        return <RABPage state={state} onUpdate={handleUpdateRAB} />;
      case 'finance_billing':
        return <FinanceBillingPage
            state={state}
            onUpdateContract={handleUpdateContract}
            onUpdateBillings={handleUpdateBillings}
            onUpdateIncomingFunds={handleUpdateIncomingFunds}
            onChangeView={setCurrentView}
        />;
      case 'invoice':
        return <InvoicePage state={state} onChangeView={setCurrentView} />;
      case 'consolidated_report':
        return <ConsolidatedReport state={state} onChangeView={setCurrentView} />;
      case 'project_summary':
        return <ProjectSummaryPage state={state} onChangeView={setCurrentView} />;
      case 'settings':
        return <SettingsPage 
            state={state} 
            onUpdateCompany={handleUpdateCompany} 
            onDeleteProject={handleDeleteProject}
            onUpdatePeriod={handleUpdatePeriod}
            onAddNewPeriod={handleAddNewPeriod}
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onUpdateIncomingFunds={handleUpdateIncomingFunds}
            onImportData={handleImportData}
        />;
      default:
        return <Dashboard state={state} />;
    }
  };

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handlePeriodChange = (projectId: string, periodId: string) => {
      setState(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === projectId ? { ...p, currentPeriodId: periodId } : p)
      }));
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };
  
  const submitLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginId.trim() || !loginPin.trim()) {
          setLoginError('ID dan PIN wajib diisi');
          return;
      }
      setIsLoggingIn(true);
      setLoginError('');
      try {
          // Import loginWithId from firebase.ts dynamically or ensure it's imported at the top
          const { loginWithId } = await import('./firebase');
          await loginWithId(loginId, loginPin);
          setShowLoginModal(false);
          setLoginId('');
          setLoginPin('');
      } catch (error: any) {
          console.error("Login failed", error);
          if (error.code === 'auth/invalid-credential') {
              setLoginError('ID atau PIN salah.');
          } else {
              setLoginError("Gagal login: " + error.message);
          }
      } finally {
          setIsLoggingIn(false);
      }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setState(INITIAL_STATE);
      localStorage.removeItem('sba_local_data');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <>
        <Layout 
            currentView={currentView} 
            onChangeView={setCurrentView}
            state={state}
            onProjectChange={handleProjectChange}
            onPeriodChange={handlePeriodChange}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleDarkMode}
            user={user}
            onLogin={handleLogin}
            onLogout={handleLogout}
        >
        {renderContent()}
        </Layout>

        {/* Cloud Sync Status Toast */}
        <div className={`fixed bottom-4 right-4 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 transition-all duration-300 z-50 no-print ${syncStatus === 'idle' ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'}`}>
            {syncStatus === 'syncing' && (
                <>
                    <Cloud className="w-4 h-4 text-brand-600 dark:text-accent-400 animate-pulse" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Sinkronisasi Cloud...</span>
                </>
            )}
            {syncStatus === 'saved' && (
                <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Tersimpan di Cloud</span>
                </>
            )}
            {syncStatus === 'error' && (
                <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span 
                        className="text-xs font-medium text-red-700 dark:text-red-400 cursor-help"
                        title={syncErrorMsg || 'Terjadi kesalahan saat menyimpan ke cloud'}
                        onClick={() => syncErrorMsg && alert('Detail Error Sinkronisasi:\n\n' + syncErrorMsg)}
                    >
                        Gagal Sinkronisasi
                    </span>
                </>
            )}
        </div>
        
        {/* Login Modal */}
        {showLoginModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <LogIn className="w-5 h-5 text-brand-500" /> Login Sistem
                        </h2>
                        <button 
                            onClick={() => setShowLoginModal(false)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={submitLogin} className="p-5 space-y-4">
                        {loginError && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg flex gap-2 items-start">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p>{loginError}</p>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Login ID
                            </label>
                            <input 
                                type="text"
                                value={loginId}
                                onChange={e => setLoginId(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-white"
                                placeholder="Contoh: admin123"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                PIN / Password
                            </label>
                            <input 
                                type="password"
                                value={loginPin}
                                onChange={e => setLoginPin(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-brand-500 outline-none text-gray-900 dark:text-white"
                                placeholder="Masukkan PIN"
                                required
                            />
                        </div>
                        <div className="pt-2">
                            <button 
                                type="submit"
                                disabled={isLoggingIn}
                                className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center"
                            >
                                {isLoggingIn ? 'Memproses...' : 'Masuk'}
                            </button>
                            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
                                Jika ID belum ada, sistem akan otomatis mendaftarkannya dengan PIN tersebut.
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </>
  );
};

export default App;