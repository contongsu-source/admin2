import React from 'react';
import { AppState } from '../types';

interface ProjectReportPrintProps {
    state: AppState;
    projectId: string;
}

export const ProjectReportPrint: React.FC<ProjectReportPrintProps> = ({ state, projectId }) => {
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return null;

    const company = state.companyProfile;

    // Calculate Terpakai
    const projectPeriods = state.periods.filter(p => p.projectId === project.id);
    let totalTerpakai = 0;
    
    projectPeriods.forEach(period => {
        // Payroll
        const attendanceRecords = state.attendance[period.id] || [];
        attendanceRecords.forEach(record => {
            const emp = state.employees.find(e => e.id === record.employeeId);
            if (emp) {
                let workDays = 0;
                let overtimeHours = 0;
                Object.values(record.days).forEach((day: any) => {
                    if (day.isPresent) workDays++;
                    overtimeHours += day.overtimeHours || 0;
                });
                totalTerpakai += (workDays * emp.dailyRate) + (overtimeHours * emp.overtimeRate);
            }
        });
        
        // Material
        const materials = state.materials[period.id] || [];
        totalTerpakai += materials.reduce((sum, m) => sum + m.totalPrice, 0);
    });
    
    const budget = project.budget || 0;
    const sisa = budget - totalTerpakai;

    const currentDate = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const currentDateShort = new Date().toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let earliestDate = '';
    if (projectPeriods.length > 0) {
        const sortedPeriods = [...projectPeriods].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        earliestDate = sortedPeriods[0].startDate;
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const periodString = earliestDate ? `${formatDate(earliestDate)} s/d ${currentDateShort}` : '-';

    return (
        <div className="hidden print:block print:w-full print:bg-white print:text-black">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Laporan Proyek: {project.name.toUpperCase()}</h1>
                <p className="text-sm text-gray-600">Dicetak pada: {currentDate}</p>
                <p className="text-sm text-gray-600">Dicetak oleh: Admin Utama (Administrator)</p>
            </div>

            <table className="w-full text-sm text-left mb-8 border-collapse">
                <thead>
                    <tr className="bg-blue-500 text-white">
                        <th className="px-4 py-2 border border-blue-500 w-1/3">Atribut</th>
                        <th className="px-4 py-2 border border-blue-500 w-2/3">Detail Informasi</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300 font-medium">ID Proyek</td>
                        <td className="px-4 py-2 border border-gray-300">{project.id.slice(0, 8).toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300 font-medium">Nama Proyek</td>
                        <td className="px-4 py-2 border border-gray-300">{project.name.toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300 font-medium">Klien</td>
                        <td className="px-4 py-2 border border-gray-300">{project.clientName || company.name}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300 font-medium">Manajer Proyek</td>
                        <td className="px-4 py-2 border border-gray-300">{company.director}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300 font-medium">Lokasi</td>
                        <td className="px-4 py-2 border border-gray-300">{project.clientAddress || '-'}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300 font-medium">Periode</td>
                        <td className="px-4 py-2 border border-gray-300">{periodString}</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300 font-medium">Status</td>
                        <td className="px-4 py-2 border border-gray-300">{project.status || 'Aktif'}</td>
                    </tr>
                </tbody>
            </table>

            <h2 className="text-lg font-bold mb-4">Ringkasan Keuangan</h2>
            <table className="w-full text-sm text-left border-collapse">
                <thead>
                    <tr className="bg-gray-800 text-white">
                        <th className="px-4 py-2 border border-gray-800">Kategori</th>
                        <th className="px-4 py-2 border border-gray-800">Nominal</th>
                        <th className="px-4 py-2 border border-gray-800">Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300">Total Dana Masuk</td>
                        <td className="px-4 py-2 border border-gray-300">Rp {budget.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-2 border border-gray-300 text-red-500 italic">Anggaran Awal</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300">Total Dana Terpakai</td>
                        <td className="px-4 py-2 border border-gray-300">Rp {totalTerpakai.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-2 border border-gray-300 text-red-500 italic">Pengeluaran Real</td>
                    </tr>
                    <tr>
                        <td className="px-4 py-2 border border-gray-300">Sisa / (Kurang)</td>
                        <td className="px-4 py-2 border border-gray-300">
                            {sisa < 0 ? `(Rp ${Math.abs(sisa).toLocaleString('id-ID')})` : `Rp ${sisa.toLocaleString('id-ID')}`}
                        </td>
                        <td className="px-4 py-2 border border-gray-300 text-red-500 italic">
                            {sisa < 0 ? 'Defisit Anggaran' : 'Surplus Anggaran'}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
