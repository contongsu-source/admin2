import React, { useState } from 'react';
import { AppState, MaterialItem } from '../types';
import { Plus, Trash2, Upload, Image as ImageIcon, X, Printer, Calendar, Archive } from 'lucide-react';
import * as XLSX from 'xlsx';

interface MaterialPageProps {
  state: AppState;
  onUpdate: (materials: MaterialItem[]) => void;
}

export const MaterialPage: React.FC<MaterialPageProps> = ({ state, onUpdate }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriodId = currentProject?.currentPeriodId || '';
  const materials = state.materials[currentPeriodId] || [];
  const [showForm, setShowForm] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<MaterialItem>>({
    date: new Date().toISOString().split('T')[0],
    itemName: '',
    quantity: 1,
    unit: 'PCS',
    unitPrice: 0,
    receiptImage: undefined
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setNewItem(prev => ({ ...prev, receiptImage: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    // Modified validation: allow unitPrice to be 0. Only check if itemName is present.
    // Also ensuring unitPrice is not NaN if the user somehow cleared it incorrectly, defaulting to 0 in calculation.
    if (!newItem.itemName) return;

    const price = newItem.unitPrice === undefined || isNaN(newItem.unitPrice) ? 0 : newItem.unitPrice;
    const qty = newItem.quantity || 0;
    const total = qty * price;

    const item: MaterialItem = {
      id: Math.random().toString(36).substr(2, 9),
      date: newItem.date!,
      itemName: newItem.itemName!,
      quantity: qty,
      unit: newItem.unit || 'PCS',
      unitPrice: price,
      totalPrice: total,
      receiptImage: newItem.receiptImage
    };

    onUpdate([...materials, item]);
    setShowForm(false);
    setNewItem({
      date: new Date().toISOString().split('T')[0],
      itemName: '',
      quantity: 1,
      unit: 'PCS',
      unitPrice: 0,
      receiptImage: undefined
    });
  };

  const handleDelete = (id: string) => {
    if(confirm("Hapus item belanja ini?")) {
        onUpdate(materials.filter(m => m.id !== id));
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data: any[] = XLSX.utils.sheet_to_json(ws);
          
          let count = 0;
          const newMaterials = [...materials];

          data.forEach(row => {
            // Expected columns: Tanggal, Barang, Qty, Satuan, Harga
            if (row.Barang && row.Harga) {
                const qty = Number(row.Qty) || 1;
                const price = Number(row.Harga) || 0;
                newMaterials.push({
                   id: Math.random().toString(36).substr(2, 9),
                   date: row.Tanggal || new Date().toISOString().split('T')[0], // format YYYY-MM-DD
                   itemName: row.Barang,
                   quantity: qty,
                   unit: row.Satuan || 'PCS',
                   unitPrice: price,
                   totalPrice: qty * price
                });
               count++;
            }
          });
          onUpdate(newMaterials);
          alert(`Berhasil mengimpor ${count} item material!`);
        } catch (error) {
          console.error(error);
          alert('Gagal membaca file Excel. Pastikan format kolom: Tanggal, Barang, Qty, Satuan, Harga');
        }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = ''; // Reset input
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Image Preview Modal */}
      {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print animate-in fade-in" onClick={() => setPreviewImage(null)}>
              <div className="relative max-w-3xl w-full">
                  <button 
                    onClick={() => setPreviewImage(null)}
                    className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
                  >
                      <X className="w-8 h-8" />
                  </button>
                  <img src={previewImage} alt="Bukti Bon" className="w-full h-auto rounded-xl shadow-2xl ring-4 ring-white/10" />
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Belanja Material</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Pencatatan pengeluaran material & bukti bon</p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
             <label className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                Import Excel
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
            </label>
            <button 
              onClick={handlePrint}
              className="flex-1 md:flex-none bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Cetak
            </button>
            <button 
              onClick={() => setShowForm(true)}
              className="flex-1 md:flex-none bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-600/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Tambah
            </button>
        </div>
      </div>

      <div className="hidden print-only mb-6">
          <h1 className="text-2xl font-bold uppercase">{state.companyProfile.name}</h1>
          <h2 className="text-xl">Laporan Belanja Material</h2>
          <p>Proyek: {state.projects.find(p=>p.id===state.currentProjectId)?.name}</p>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl animate-in fade-in zoom-in-95 no-print mb-6 relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
                <div className="bg-brand-100 dark:bg-brand-900/30 p-2 rounded-lg text-brand-600">
                    <Plus className="w-4 h-4" />
                </div>
                Input Material Baru
            </h3>
            <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="col-span-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Tanggal</label>
                    <input 
                        type="date" 
                        required
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={newItem.date}
                        onChange={e => setNewItem({...newItem, date: e.target.value})}
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Nama Barang</label>
                    <input 
                        type="text" 
                        required
                        placeholder="Contoh: Semen Gresik"
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={newItem.itemName}
                        onChange={e => setNewItem({...newItem, itemName: e.target.value})}
                    />
                </div>
                <div className="col-span-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Qty</label>
                    <input 
                        type="number" 
                        min="1"
                        required
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={newItem.quantity}
                        onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)})}
                    />
                </div>
                <div className="col-span-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Satuan</label>
                    <input 
                        type="text" 
                        required
                        placeholder="Sak/Batang"
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={newItem.unit}
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                    />
                </div>
                <div className="col-span-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Harga Satuan</label>
                    <input 
                        type="number" 
                        min="0"
                        required
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={newItem.unitPrice}
                        onChange={e => setNewItem({...newItem, unitPrice: parseInt(e.target.value) || 0})}
                    />
                </div>
                
                <div className="col-span-full">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Foto Bukti Bon (Opsional)</label>
                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <label className="cursor-pointer flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
                            <Upload className="w-4 h-4 text-brand-500" />
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Upload Foto</span>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </label>
                        {newItem.receiptImage && (
                            <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                                <img src={newItem.receiptImage} alt="Preview" className="h-10 w-10 object-cover rounded-md" />
                                <button 
                                    type="button" 
                                    onClick={() => setNewItem({...newItem, receiptImage: undefined})}
                                    className="text-red-500 p-1 hover:bg-red-50 rounded-full"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        {!newItem.receiptImage && <span className="text-xs text-gray-400">Belum ada foto dipilih</span>}
                    </div>
                </div>

                <div className="col-span-full flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button 
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-bold transition-colors"
                    >
                        Batal
                    </button>
                    <button 
                        type="submit"
                        className="px-6 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 transition-all active:scale-95"
                    >
                        Simpan Item
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* MOBILE CARD VIEW (Visible only on mobile) */}
      <div className="md:hidden space-y-4 no-print">
          {materials.length === 0 && (
             <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <Archive className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Belum ada data material.</p>
             </div>
          )}
          {materials.map((item) => (
             <div key={item.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col gap-3">
                 <div className="flex justify-between items-start">
                     <div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <Calendar className="w-3 h-3" />
                            {item.date}
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{item.itemName}</h4>
                     </div>
                     <div className="flex gap-2">
                        {item.receiptImage && (
                            <button 
                                onClick={() => setPreviewImage(item.receiptImage || null)}
                                className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"
                            >
                                <ImageIcon className="w-4 h-4" />
                            </button>
                        )}
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl">
                     <div className="flex-1">
                         <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Harga Satuan</p>
                         <p className="text-sm font-medium dark:text-gray-300">Rp {item.unitPrice.toLocaleString('id-ID')} <span className="text-xs text-gray-400">/ {item.unit}</span></p>
                     </div>
                     <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                     <div className="flex-1">
                         <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Qty</p>
                         <p className="text-sm font-medium dark:text-gray-300">{item.quantity} {item.unit}</p>
                     </div>
                 </div>

                 <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                     <span className="text-xs font-bold text-gray-400 uppercase">Total</span>
                     <span className="text-lg font-bold text-brand-600 dark:text-brand-400">Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                 </div>
             </div>
          ))}
          
          {/* Mobile Summary */}
          {materials.length > 0 && (
             <div className="bg-brand-600 text-white p-5 rounded-2xl shadow-lg shadow-brand-600/30 mt-4">
                 <div className="flex justify-between items-center">
                     <span className="font-medium text-brand-100">Total Belanja</span>
                     <span className="text-xl font-bold">Rp {materials.reduce((acc, i) => acc + i.totalPrice, 0).toLocaleString('id-ID')}</span>
                 </div>
             </div>
          )}
      </div>

      {/* DESKTOP TABLE VIEW (Visible only on desktop) */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden print:block print:border-black print:shadow-none">
        <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase text-xs font-bold print:bg-gray-200 print:text-black">
                <tr>
                    <th className="px-4 py-4 w-12 text-center border-b border-gray-200 dark:border-gray-700">No</th>
                    <th className="px-4 py-4 w-32 border-b border-gray-200 dark:border-gray-700">Tanggal</th>
                    <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">Nama Barang</th>
                    <th className="px-4 py-4 w-20 text-center border-b border-gray-200 dark:border-gray-700 no-print">Bon</th>
                    <th className="px-4 py-4 w-20 text-center border-b border-gray-200 dark:border-gray-700">Qty</th>
                    <th className="px-4 py-4 w-24 border-b border-gray-200 dark:border-gray-700">Satuan</th>
                    <th className="px-4 py-4 text-right border-b border-gray-200 dark:border-gray-700">Harga</th>
                    <th className="px-4 py-4 text-right border-b border-gray-200 dark:border-gray-700">Total</th>
                    <th className="px-4 py-4 w-16 border-b border-gray-200 dark:border-gray-700 no-print"></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-400">
                {materials.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors print:hover:bg-transparent">
                        <td className="px-4 py-3.5 text-center text-gray-500 dark:text-gray-400 border-b-0">{idx + 1}</td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300 border-b-0 font-medium">{item.date}</td>
                        <td className="px-4 py-3.5 font-bold text-gray-900 dark:text-white border-b-0">{item.itemName}</td>
                        <td className="px-4 py-3.5 text-center border-b-0 no-print">
                            {item.receiptImage ? (
                                <button 
                                    onClick={() => setPreviewImage(item.receiptImage || null)}
                                    className="inline-block transition-transform hover:scale-110"
                                >
                                    <img 
                                        src={item.receiptImage} 
                                        alt="Bon" 
                                        className="w-8 h-8 object-cover rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm" 
                                    />
                                </button>
                            ) : (
                                <span className="text-gray-300 text-xs">-</span>
                            )}
                        </td>
                        <td className="px-4 py-3.5 text-center border-b-0 dark:text-gray-300">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300 border-b-0">{item.unit}</td>
                        <td className="px-4 py-3.5 text-right border-b-0 dark:text-gray-300">Rp {item.unitPrice.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white border-b-0">Rp {item.totalPrice.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3.5 text-center border-b-0 no-print">
                            <button 
                                onClick={() => handleDelete(item.id)}
                                className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 print:bg-white print:border-t-2 print:border-black">
                <tr>
                    <td colSpan={7} className="px-4 py-4 text-right font-bold text-gray-900 dark:text-white uppercase tracking-wide">Total Belanja</td>
                    <td className="px-4 py-4 text-right font-bold text-brand-700 dark:text-brand-400 text-lg">
                        Rp {materials.reduce((acc, i) => acc + i.totalPrice, 0).toLocaleString('id-ID')}
                    </td>
                    <td className="no-print"></td>
                </tr>
            </tfoot>
        </table>
      </div>
      
      <div className="hidden print-only mt-12 flex justify-end">
         <div className="text-center">
            <p>Mengetahui,</p>
            <br/><br/><br/>
            <p className="font-bold underline">{state.companyProfile.director}</p>
         </div>
      </div>
    </div>
  );
};