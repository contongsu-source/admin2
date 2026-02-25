import React, { useMemo } from 'react';
import { AppState, DailyAttendance } from '../types';
import { Users, DollarSign, Calendar, TrendingUp, ArrowUpRight } from 'lucide-react';
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

  // Helper component for stats card
  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, subtext }: any) => (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${bgClass}`}>
                  <Icon className={`w-6 h-6 ${colorClass}`} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Aktif</span>
              </div>
          </div>
          <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</h3>
              {subtext && <p className="text-xs text-gray-400 mt-2 line-clamp-1">{subtext}</p>}
          </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm md:text-base">Ringkasan proyek <span className="font-semibold text-gray-700 dark:text-gray-300">{currentProject?.name}</span></p>
        </div>
        <div className="text-sm text-gray-400 font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg inline-block md:inline w-fit">
            Periode: {currentPeriod?.name}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
            title="Total Pengeluaran" 
            value={`Rp ${totalCost.toLocaleString('id-ID')}`} 
            icon={DollarSign}
            bgClass="bg-blue-50 dark:bg-blue-900/20"
            colorClass="text-blue-600 dark:text-blue-400"
            subtext="Akumulasi Material + Gaji"
        />
        <StatCard 
            title="Total Karyawan" 
            value={projectEmployees.length} 
            icon={Users}
            bgClass="bg-green-50 dark:bg-green-900/20"
            colorClass="text-green-600 dark:text-green-400"
            subtext="Terdaftar di proyek ini"
        />
        <StatCard 
            title="Periode Aktif" 
            value={currentPeriod?.endDate ? new Date(currentPeriod.endDate).getDate() - new Date(currentPeriod.startDate).getDate() + 1 + " Hari" : "-"} 
            icon={Calendar}
            bgClass="bg-purple-50 dark:bg-purple-900/20"
            colorClass="text-purple-600 dark:text-purple-400"
            subtext={`${currentPeriod?.startDate} s/d ${currentPeriod?.endDate}`}
        />
         <StatCard 
            title="Belanja Material" 
            value={`Rp ${totalMaterialCost.toLocaleString('id-ID')}`} 
            icon={TrendingUp}
            bgClass="bg-orange-50 dark:bg-orange-900/20"
            colorClass="text-orange-600 dark:text-orange-400"
            subtext={`${materials.length} item barang dibeli`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-bold text-gray-900 dark:text-white">Distribusi Biaya</h3>
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