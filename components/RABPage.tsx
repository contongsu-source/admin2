import React, { useState } from 'react';
import { AppState, RABItem } from '../types';
import { Plus, Trash2, Edit2, Save, X, FileSpreadsheet, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

interface RABPageProps {
  state: AppState;
  onUpdate: (rabItems: RABItem[]) => void;
}

export const RABPage: React.FC<RABPageProps> = ({ state, onUpdate }) => {
  const projectId = state.currentProjectId;
  const rabItems = state.rab[projectId] || [];
  const currentProject = state.projects.find(p => p.id === projectId);
  
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<RABItem>>({
    itemName: '',
    quantity: 1,
    unit: 'PCS',
    unitPrice: 0,
    category: 'Material'
  });

  const totalBudget = rabItems.reduce((acc, item) => acc + item.totalPrice, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.itemName || !newItem.quantity || !newItem.unitPrice) return;

    const item: RABItem = {
      id: Math.random().toString(36).substr(2, 9),
      itemName: newItem.itemName!,
      quantity: newItem.quantity!,
      unit: newItem.unit!,
      unitPrice: newItem.unitPrice!,
      totalPrice: newItem.quantity! * newItem.unitPrice!,
      category: newItem.category
    };

    onUpdate([...rabItems, item]);
    setShowForm(false);
    setNewItem({ itemName: '', quantity: 1, unit: 'PCS', unitPrice: 0, category: 'Material' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus item ini?')) {
      onUpdate(rabItems.filter(i => i.id !== id));
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rabItems.map(i => ({
      'Nama Barang': i.itemName,
      'Kategori': i.category,
      'Qty': i.quantity,
      'Satuan': i.unit,
      'Harga Satuan': i.unitPrice,
      'Total': i.totalPrice
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RAB');
    XLSX.writeFile(wb, `RAB_${currentProject?.name || 'Proyek'}.xlsx`);
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="space-y-6 pb-20">
      <style type="text/css" media="print">
        {`
          @page { size: portrait; margin: 10mm; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        `}
      </style>
      
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Rencana Anggaran Biaya (RAB)</h2>
          <p className="text-gray-500 dark:text-gray-400">Perencanaan anggaran proyek</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                <Printer className="w-4 h-4" /> Cetak PDF
            </button>
            <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">
                <Plus className="w-4 h-4" /> Tambah Item
            </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print-only mb-6">
        <h1 className="text-2xl font-bold uppercase">{state.companyProfile.name}</h1>
        <p className="text-sm">{state.companyProfile.address}</p>
        <div className="border-b-2 border-black my-4"></div>
        <h2 className="text-xl font-bold uppercase">Rencana Anggaran Biaya (RAB)</h2>
        <p className="font-bold">Proyek: {currentProject?.name}</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden print:border-black print:shadow-none">
        <table className="w-full text-sm text-left print:text-[10px]">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 uppercase text-xs font-semibold print:bg-gray-200 print:text-black">
            <tr>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3">Satuan</th>
              <th className="px-4 py-3 text-right">Harga Satuan</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center no-print">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 print:divide-black">
            {rabItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3 font-medium">{item.itemName}</td>
                <td className="px-4 py-3 text-gray-500">{item.category}</td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-4 py-3">{item.unit}</td>
                <td className="px-4 py-3 text-right">Rp {item.unitPrice.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 text-right font-bold">Rp {item.totalPrice.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 text-center no-print">
                    <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 dark:bg-gray-700 font-bold print:bg-gray-200">
                <td colSpan={5} className="px-4 py-3 text-right">TOTAL ANGGARAN</td>
                <td className="px-4 py-3 text-right">Rp {totalBudget.toLocaleString('id-ID')}</td>
                <td className="no-print"></td>
            </tr>
          </tbody>
        </table>
      </div>


      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Tambah Item RAB</h3>
                    <button type="button" onClick={() => setShowForm(false)}><X /></button>
                </div>
                <input required type="text" placeholder="Nama Barang" className="w-full p-2 border rounded" onChange={e => setNewItem({...newItem, itemName: e.target.value})} />
                <input required type="text" placeholder="Kategori" className="w-full p-2 border rounded" onChange={e => setNewItem({...newItem, category: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                    <input required type="number" placeholder="Qty" className="w-full p-2 border rounded" onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)})} />
                    <input required type="text" placeholder="Satuan" className="w-full p-2 border rounded" onChange={e => setNewItem({...newItem, unit: e.target.value})} />
                </div>
                <input required type="number" placeholder="Harga Satuan" className="w-full p-2 border rounded" onChange={e => setNewItem({...newItem, unitPrice: parseInt(e.target.value)})} />
                <button type="submit" className="w-full bg-brand-600 text-white p-2 rounded hover:bg-brand-700">Simpan</button>
            </form>
        </div>
      )}
    </div>
  );
};
