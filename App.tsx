import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { AttendancePage } from './components/AttendancePage';
import { PayrollPage } from './components/PayrollPage';
import { MaterialPage } from './components/MaterialPage';
import { InvoicePage } from './components/InvoicePage';
import { SettingsPage } from './components/SettingsPage';
import { PettyCashPage } from './components/PettyCashPage';
import { AppState, AttendanceRecord, MaterialItem, CompanyProfile, Project, ProjectPeriod, DailyAttendance, Employee, PettyCashTransaction } from './types';
import { INITIAL_STATE } from './constants';
import { Cloud, CheckCircle2, AlertCircle } from 'lucide-react';

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

  // --- App Data State ---
  const [state, setState] = useState<AppState>(() => {
    try {
      const savedState = localStorage.getItem('sba_local_data');
      if (savedState) {
        return JSON.parse(savedState);
      }
    } catch (e) {
      console.error("Failed to load state from local storage", e);
    }
    return INITIAL_STATE;
  });

  const [currentView, setCurrentView] = useState('dashboard');
  
  // --- Cloud Sync State ---
  const [cloudId, setCloudId] = useState<string | null>(() => localStorage.getItem('sba_cloud_id'));
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Save to LocalStorage always (as backup)
  useEffect(() => {
     localStorage.setItem('sba_local_data', JSON.stringify(state));
  }, [state]);

  // MIGRATION: Move legacy materials (keyed by projectId) to current period
  useEffect(() => {
    const currentProject = state.projects.find(p => p.id === state.currentProjectId);
    if (!currentProject) return;

    const legacyMaterials = state.materials[state.currentProjectId];
    if (legacyMaterials && legacyMaterials.length > 0) {
        
        setState(prev => {
            const newMaterials = { ...prev.materials };
            const projectPeriods = prev.periods.filter(p => p.projectId === state.currentProjectId);

            // Helper to find period for a date
            const findPeriodForDate = (dateStr: string) => {
                const date = new Date(dateStr);
                return projectPeriods.find(p => {
                    const start = new Date(p.startDate);
                    const end = new Date(p.endDate);
                    return date >= start && date <= end;
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
                newMaterials[periodId] = [...existing, ...groupedLegacy[periodId]];
            });
            
            delete newMaterials[state.currentProjectId]; 
            
            return {
                ...prev,
                materials: newMaterials
            };
        });
    }
  }, [state.currentProjectId, state.materials]);

  // INITIAL LOAD FROM CLOUD
  useEffect(() => {
      if (cloudId && !isLoadingCloud) {
          fetchCloudData(cloudId);
      }
  }, []); // Run once on mount

  const fetchCloudData = async (id: string) => {
      setIsLoadingCloud(true);
      setSyncStatus('syncing');
      try {
          const response = await fetch(`https://jsonblob.com/api/jsonBlob/${id}`);
          if (response.ok) {
              const data = await response.json();
              if (data && data.companyProfile) { // Simple validation
                  setState(data);
                  setCloudId(id);
                  localStorage.setItem('sba_cloud_id', id);
                  setSyncStatus('saved');
              }
          } else {
              setSyncStatus('error');
          }
      } catch (error) {
          console.error("Cloud Fetch Error", error);
          setSyncStatus('error');
      } finally {
          setIsLoadingCloud(false);
          setTimeout(() => setSyncStatus('idle'), 2000);
      }
  };

  // AUTO SYNC TO CLOUD
  useEffect(() => {
    // Only sync if we have a cloudId and we are NOT currently loading initial data
    if (cloudId && !isLoadingCloud) {
        setSyncStatus('syncing');
        
        // Debounce the save
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`https://jsonblob.com/api/jsonBlob/${cloudId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(state)
                });
                
                if (response.ok) {
                    setSyncStatus('saved');
                } else {
                    setSyncStatus('error');
                }
            } catch (error) {
                console.error("Cloud Save Error", error);
                setSyncStatus('error');
            }
            
            // Revert to idle after showing status
            setTimeout(() => setSyncStatus('idle'), 3000);
        }, 1000); 

        return () => clearTimeout(timer);
    }
  }, [state, cloudId, isLoadingCloud]);

  const handleSetCloudId = (id: string | null) => {
      if (id) {
          setCloudId(id);
          localStorage.setItem('sba_cloud_id', id);
      } else {
          setCloudId(null);
          localStorage.removeItem('sba_cloud_id');
      }
  };

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
        const date = new Date(dateStr);
        // Reset time part to ensure accurate date comparison
        date.setHours(0, 0, 0, 0);
        
        return projectPeriods.find(p => {
            const start = new Date(p.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(p.endDate);
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
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

  const handleUpdatePettyCash = (transactions: PettyCashTransaction[]) => {
      setState(prev => ({
          ...prev,
          pettyCash: {
              ...prev.pettyCash,
              [state.currentProjectId]: transactions
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
      setState(prev => ({
          ...prev,
          employees: prev.employees.map(e => e.id === updatedEmp.id ? updatedEmp : e)
      }));
  };

  const handleDeleteEmployee = (empId: string) => {
      if(!confirm("Hapus karyawan ini? Data absensi lama mungkin akan menjadi tidak valid.")) return;
      
      setState(prev => ({
          ...prev,
          employees: prev.employees.filter(e => e.id !== empId),
      }));
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
          return { employeeId: emp.id, days };
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
                  // Reset days for the new period range as requested
                  const newDays: Record<string, DailyAttendance> = {};
                  const start = new Date(startDate);
                  const end = new Date(endDate);
                  
                  // Generate fresh attendance days for the new range
                  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                       const dateStr = d.toISOString().split('T')[0];
                       newDays[dateStr] = { date: dateStr, isPresent: false, overtimeHours: 0 };
                  }
                  
                  return { ...record, days: newDays };
              })
          }
      }));
  };

  const handleAddProject = (name: string, clientName: string, clientAddress: string, startDate: string, endDate: string) => {
    const newProjectId = `p${Date.now()}`;
    const newPeriodId = `per${Date.now()}`;
    const periodName = generatePeriodName(startDate, endDate);
    
    const newProject: Project = {
        id: newProjectId,
        name: name.toUpperCase(),
        clientName,
        clientAddress,
        currentPeriodId: newPeriodId
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
        currentProjectId: newProjectId 
    }));
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard state={state} />;
      case 'attendance':
        return <AttendancePage 
            state={state} 
            onUpdate={handleUpdateAttendance}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
        />;
      case 'payroll':
        return <PayrollPage 
            state={state} 
            onUpdateEmployee={handleUpdateEmployee}
        />;
      case 'materials':
        return <MaterialPage state={state} onUpdate={handleUpdateMaterials} />;
      case 'petty_cash':
        return <PettyCashPage state={state} onUpdate={handleUpdatePettyCash} />;
      case 'invoice':
        return <InvoicePage state={state} />;
      case 'settings':
        return <SettingsPage 
            state={state} 
            onUpdateCompany={handleUpdateCompany} 
            onDeleteProject={handleDeleteProject}
            onUpdatePeriod={handleUpdatePeriod}
            onAddNewPeriod={handleAddNewPeriod}
            onAddProject={handleAddProject}
            cloudId={cloudId}
            onSetCloudId={handleSetCloudId}
            onLoadCloudData={fetchCloudData}
            onImportData={handleImportData}
        />;
      default:
        return <Dashboard state={state} />;
    }
  };

  const handlePeriodChange = (projectId: string, periodId: string) => {
      setState(prev => ({
          ...prev,
          projects: prev.projects.map(p => p.id === projectId ? { ...p, currentPeriodId: periodId } : p)
      }));
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
        >
        {renderContent()}
        </Layout>

        {/* Cloud Sync Status Toast */}
        <div className={`fixed bottom-4 right-4 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 transition-all duration-300 z-50 ${syncStatus === 'idle' ? 'opacity-0 translate-y-10' : 'opacity-100 translate-y-0'}`}>
            {syncStatus === 'syncing' && (
                <>
                    <Cloud className="w-4 h-4 text-blue-500 animate-pulse" />
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
                    <span className="text-xs font-medium text-red-700 dark:text-red-400">Gagal Sinkronisasi</span>
                </>
            )}
        </div>
    </>
  );
};

export default App;