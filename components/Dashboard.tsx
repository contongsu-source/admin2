import React, { useMemo } from 'react';
import { AppState, DailyAttendance } from '../types';
import { Users, DollarSign, Calendar, TrendingUp, ArrowUpRight, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface DashboardProps {
  state: AppState;
}

export const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriod = state.periods.find(p => p.id === currentProject?.currentPeriodId);
  const materials = state.materials[currentPeriod?.id || ''] || [];
  
  // Calculations
  const totalMaterialCost = materials.reduce((acc, item) => acc + item.totalPrice, 0);

  const attendanceRecords = state.attendance[currentPeriod?.id || ''] || [];
  
  // Filter employees for the current project
  const projectEmployees = state.employees.filter(e => e.projectId === state.currentProjectId);

  const payrollData = useMemo(() => {
    let totalWages = 0;
    
    // Only calculate for employees in this project
    projectEmployees.forEach(emp => {
      const record = attendanceRecords.find(r => r.employeeId === emp.id);
      if (!record) return;
      
      let workDays = 0;
      let overtimeHours = 0;
      
      Object.values(record.days).forEach((day: DailyAttendance) => {
        if (day.isPresent) workDays++;
        overtimeHours += day.overtimeHours;
      });
      
      totalWages += (workDays * emp.dailyRate) + (overtimeHours * emp.overtimeRate);
    });
    return totalWages;
  }, [attendanceRecords, projectEmployees]);

  const totalCost = totalMaterialCost + payrollData;

  const costDistribution = [
    { name: 'Upah Karyawan', value: payrollData, color: '#0ea5e9' },
    { name: 'Material', value: totalMaterialCost, color: '#f59e0b' },
  ];

  // Calculate Overall Project Finances
  const projectPeriods = state.periods.filter(p => p.projectId === state.currentProjectId);
  let overallTerpakai = 0;
  
  projectPeriods.forEach(period => {
      // Payroll
      const attRecords = state.attendance[period.id] || [];
      attRecords.forEach(record => {
          const emp = state.employees.find(e => e.id === record.employeeId);
          if (emp) {
              let workDays = 0;
              let overtimeHours = 0;
              Object.values(record.days).forEach((day: any) => {
                  if (day.isPresent) workDays++;
                  overtimeHours += day.overtimeHours || 0;
              });
              overallTerpakai += (workDays * emp.dailyRate) + (overtimeHours * emp.overtimeRate);
          }
      });
      
      // Material
      const mats = state.materials[period.id] || [];
      overallTerpakai += mats.reduce((sum, m) => sum + m.totalPrice, 0);
  });
  
  // Petty Cash (Excluded as requested)
  // const pettyCash = state.pettyCash[state.currentProjectId] || [];
  // overallTerpakai += pettyCash.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);
  
  const budget = currentProject?.budget || 0;
  const sisa = budget - overallTerpakai;
  const budgetPercentage = budget > 0 ? Math.min(100, (overallTerpakai / budget) * 100) : 0;

  // Helper component for stats card
  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, subtext }: any) => (
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className={`p-2 md:p-3 rounded-xl ${bgClass}`}>
                  <Icon className={`w-5 h-5 md:w-6 md:h-6 ${colorClass}`} />
              </div>
              <div className="flex items-center gap-1 text-[10px] md:text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Aktif</span>
              </div>
          </div>
          <div>
              <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-0.5 md:mb-1">{title}</p>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight truncate">{value}</h3>
              {subtext && <p className="text-[10px] md:text-xs text-gray-400 mt-1 md:mt-2 line-clamp-1">{subtext}</p>}
          </div>
      </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm md:text-base">Ringkasan proyek <span className="font-semibold text-gray-700 dark:text-gray-300">{currentProject?.name}</span></p>
        </div>
        <div className="text-xs md:text-sm text-gray-500 font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg w-fit flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            Periode: <span className="text-gray-900 dark:text-white font-bold">{currentPeriod?.name}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
            title="Pengeluaran Periode Ini" 
            value={`Rp ${totalCost.toLocaleString('id-ID')}`} 
            icon={DollarSign}
            bgClass="bg-blue-50 dark:bg-blue-900/20"
            colorClass="text-blue-600 dark:text-blue-400"
            subtext="Material + Gaji"
        />
        <StatCard 
            title="Total Karyawan" 
            value={projectEmployees.length} 
            icon={Users}
            bgClass="bg-green-50 dark:bg-green-900/20"
            colorClass="text-green-600 dark:text-green-400"
            subtext="Terdaftar"
        />
        <StatCard 
            title="Sisa Hari" 
            value={currentPeriod?.endDate ? Math.max(0, Math.ceil((new Date(currentPeriod.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) + " Hari" : "-"} 
            icon={Calendar}
            bgClass="bg-purple-50 dark:bg-purple-900/20"
            colorClass="text-purple-600 dark:text-purple-400"
            subtext={`Berakhir ${currentPeriod?.endDate}`}
        />
         <StatCard 
            title="Material" 
            value={`Rp ${totalMaterialCost.toLocaleString('id-ID')}`} 
            icon={TrendingUp}
            bgClass="bg-orange-50 dark:bg-orange-900/20"
            colorClass="text-orange-600 dark:text-orange-400"
            subtext={`${materials.length} item`}
        />
      </div>

      {/* Overall Project Budget Status */}
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Status Anggaran Keseluruhan Proyek</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total akumulasi dari semua periode</p>
                  </div>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  currentProject?.status === 'Selesai' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                  currentProject?.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                  {currentProject?.status === 'Selesai' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                   currentProject?.status === 'Pending' ? <AlertCircle className="w-3.5 h-3.5" /> : 
                   <TrendingUp className="w-3.5 h-3.5" />}
                  {currentProject?.status || 'Aktif'}
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dana Masuk (Budget)</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">Rp {budget.toLocaleString('id-ID')}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total Terpakai</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">Rp {overallTerpakai.toLocaleString('id-ID')}</p>
              </div>
              <div className={`p-4 rounded-xl border ${sisa >= 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}>
                  <p className={`text-xs font-medium mb-1 ${sisa >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Sisa / (Kurang)</p>
                  <p className={`text-lg font-bold ${sisa >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>Rp {sisa.toLocaleString('id-ID')}</p>
              </div>
          </div>

          {/* Progress Bar */}
          <div>
              <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  <span>Penggunaan Anggaran</span>
                  <span>{budgetPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div 
                      className={`h-2.5 rounded-full ${budgetPercentage > 90 ? 'bg-red-500' : budgetPercentage > 75 ? 'bg-amber-500' : 'bg-brand-500'}`} 
                      style={{ width: `${budgetPercentage}%` }}
                  ></div>
              </div>
          </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Distribusi Biaya</h3>
             <div className="p-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <PieChart className="w-4 h-4 text-gray-500" />
             </div>
          </div>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {costDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <RechartsTooltip 
                    formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '0.5rem' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                    <span className="text-xs text-gray-400 block uppercase">Total</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">100%</span>
                </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {costDistribution.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ringkasan Material</h3>
             <button className="text-sm text-brand-600 font-medium hover:text-brand-700">Lihat Semua</button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <tr>
                        <th className="px-4 py-3 rounded-l-lg">Nama Barang</th>
                        <th className="px-4 py-3 text-right rounded-r-lg">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {materials.slice(0, 5).map(m => (
                        <tr key={m.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-white">
                                {m.itemName}
                                <span className="block text-[10px] text-gray-400 font-normal mt-0.5">{m.date}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-medium text-gray-700 dark:text-gray-300">Rp {m.totalPrice.toLocaleString('id-ID')}</td>
                        </tr>
                    ))}
                    {materials.length === 0 && (
                        <tr><td colSpan={2} className="px-4 py-12 text-center text-gray-400 italic">Belum ada data material</td></tr>
                    )}
                </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};