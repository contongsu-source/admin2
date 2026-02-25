import React, { useState } from 'react';
import { AppState, PettyCashTransaction } from '../types';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Calendar, ArrowUpRight, ArrowDownRight, X, Printer, Upload, Info, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PettyCashPageProps {
  state: AppState;
  onUpdate: (transactions: PettyCashTransaction[]) => void;
}

export const PettyCashPage: React.FC<PettyCashPageProps> = ({ state, onUpdate }) => {
  const transactions = state.pettyCash ? (state.pettyCash[state.currentProjectId] || []) : [];
  
  // Sort by Date Descending
  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [showForm, setShowForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newTrans, setNewTrans] = useState<Partial<PettyCashTransaction>>({
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'out',
    amount: 0
  });

  const totalIn = transactions.filter(t => t.type === 'in').reduce((acc, t) => acc + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'out').reduce((acc, t) => acc + t.amount, 0);
  const currentBalance = totalIn - totalOut;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrans.description || !newTrans.amount) return;

    const newItem: PettyCashTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: newTrans.date!,
      description: newTrans.description!,
      type: newTrans.type as 'in' | 'out',
      amount: newTrans.amount!
    };

    onUpdate([...transactions, newItem]);
    setShowForm(false);
    setNewTrans({
        date: new Date().toISOString().split('T')[0],
        description: '',
        type: 'out',
        amount: 0
    });
  };

  const handleDelete = (id: string) => {
    if(confirm('Hapus transaksi ini?')) {
        onUpdate(transactions.filter(t => t.id !== id));
    }
  };

  const handleDeleteAll = () => {
    if (transactions.length === 0) return;
    if (confirm('APAKAH ANDA YAKIN? Semua data transaksi kas kecil di proyek ini akan DIHAPUS PERMANEN.')) {
        onUpdate([]);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      { "Tanggal": "2026-02-20", "Uraian": "Dana Awal dari Kantor", "Masuk": 5000000, "Keluar": 0 },
      { "Tanggal": "2026-02-21", "Uraian": "Beli Kopi & Snack", "Masuk": 0, "Keluar": 50000 },
      { "Tanggal": "2026-02-22", "Uraian": "Bensin Motor Operasional", "Masuk": 0, "Keluar": 25000 },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Kas_Kecil");
    XLSX.writeFile(wb, "Template_Kas_Kecil_SBA.xlsx");
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Use raw: false and dateNF to get better string representation of dates
        const data: any[] = XLSX.utils.sheet_to_json(ws, { 
          raw: false,
          dateNF: 'yyyy-mm-dd'
        });
        
        if (data.length === 0) {
          alert('File Excel kosong atau tidak terbaca.');
          return;
        }

        let count = 0;
        const newTransactions = [...transactions];
        const errors: string[] = [];

        data.forEach((row, index) => {
          const keys = Object.keys(row);
          const findKey = (keywords: string[]) => 
            keys.find(k => keywords.some(kw => k.toLowerCase().replace(/\s/g, '').includes(kw.toLowerCase())));

          // Expanded keywords for better detection
          const dateKey = findKey(['tanggal', 'date', 'tgl', 'hari']);
          const descKey = findKey(['uraian', 'keterangan', 'desc', 'ket', 'barang', 'item', 'nama', 'note']);
          const inKey = findKey(['masuk', 'in', 'debit', 'pemasukan', 'setor']);
          const outKey = findKey(['keluar', 'out', 'credit', 'kredit', 'pengeluaran', 'bayar']);
          const amountKey = findKey(['jumlah', 'amount', 'nominal', 'total', 'harga']);

          const description = descKey ? row[descKey] : null;
          
          if (!description) {
            // If it's not a completely empty row, log that we couldn't find a description
            if (keys.length > 0) errors.push(`Baris ${index + 2}: Kolom Uraian/Keterangan tidak ditemukan.`);
            return;
          }

          let type: 'in' | 'out' = 'out';
          let amount = 0;

          const valIn = inKey ? parseFloat(row[inKey].toString().replace(/[^0-9.-]+/g,"")) : 0;
          const valOut = outKey ? parseFloat(row[outKey].toString().replace(/[^0-9.-]+/g,"")) : 0;
          const valAmount = amountKey ? parseFloat(row[amountKey].toString().replace(/[^0-9.-]+/g,"")) : 0;

          if (valIn > 0) {
            type = 'in';
            amount = valIn;
          } else if (valOut > 0) {
            type = 'out';
            amount = valOut;
          } else if (valAmount > 0) {
            amount = valAmount;
            const typeKey = findKey(['tipe', 'jenis', 'type', 'status']);
            if (typeKey && (row[typeKey].toString().toLowerCase().includes('masuk') || row[typeKey].toString().toLowerCase().includes('in'))) {
              type = 'in';
            }
          }

          if (amount > 0) {
            let rowDate = new Date().toISOString().split('T')[0];
            if (dateKey && row[dateKey]) {
              const d = new Date(row[dateKey]);
              if (!isNaN(d.getTime())) {
                rowDate = d.toISOString().split('T')[0];
              }
            }

            newTransactions.push({
              id: Math.random().toString(36).substr(2, 9),
              date: rowDate,
              description: description.toString().trim(),
              type: type,
              amount: amount
            });
            count++;
          } else {
            errors.push(`Baris ${index + 2}: Nominal (Masuk/Keluar) nol atau tidak valid.`);
          }
        });

        if (count > 0) {
          onUpdate(newTransactions);
          if (errors.length > 0 && errors.length < 5) {
            alert(`Berhasil mengimpor ${count} transaksi!\n\nBeberapa baris dilewati:\n${errors.join('\n')}`);
          } else if (errors.length >= 5) {
            alert(`Berhasil mengimpor ${count} transaksi!\nAda ${errors.length} baris yang bermasalah/dilewati.`);
          } else {
            alert(`Berhasil mengimpor ${count} transaksi kas!`);
          }
        } else {
          alert('Gagal Deteksi Data: Tidak ada transaksi valid yang ditemukan.\nPastikan nama kolom di Excel Anda mengandung kata "Uraian" dan "Masuk" atau "Keluar".');
        }
      } catch (error) {
        console.error(error);
        alert('Gagal membaca file Excel. Pastikan format file benar (.xlsx atau .xls).');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; 
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Kas Kecil</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Catatan Uang Masuk & Pengeluaran Harian</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
             <button 
                onClick={() => setShowHelp(!showHelp)}
                className={`p-2.5 rounded-xl transition-colors ${showHelp ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                title="Panduan Format Excel"
             >
                <Info className="w-5 h-5" />
             </button>
             <label className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-green-600/20">
                <Upload className="w-4 h-4" />
                Import
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
            </label>
             <button 
              onClick={handlePrint}
              className="flex-1 md:flex-none bg-gray-800 hover:bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Cetak
            </button>
            <button 
              onClick={handleDeleteAll}
              disabled={transactions.length === 0}
              className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20 active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
              Hapus Semua
            </button>
            <button 
              onClick={() => setShowForm(true)}
              className="flex-1 md:flex-none bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-600/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Transaksi Baru
            </button>
        </div>
      </div>

      {/* Format Help Section */}
      {showHelp && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-6 rounded-2xl no-print animate-in slide-in-from-top duration-300">
              <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
                    <FileSpreadsheet className="w-6 h-6" />
                    <h4 className="font-bold text-lg">Panduan Import Excel (Kas Kecil)</h4>
                  </div>
                  <button onClick={() => setShowHelp(false)} className="text-blue-400 hover:text-blue-600 p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full transition-colors"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-3 font-medium">
                        Sistem SBA dapat mendeteksi kolom secara otomatis. Pastikan nama kolom di baris pertama Excel Anda mengandung salah satu kata kunci berikut:
                    </p>
                    <ul className="space-y-2">
                        <li className="flex gap-2 text-xs">
                            <span className="bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded font-bold min-w-[80px]">TANGGAL:</span>
                            <span className="text-gray-600 dark:text-gray-400 italic">Tanggal, Tgl, Date, Hari</span>
                        </li>
                        <li className="flex gap-2 text-xs">
                            <span className="bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded font-bold min-w-[80px]">URAIAN:</span>
                            <span className="text-gray-600 dark:text-gray-400 italic">Uraian, Keterangan, Ket, Barang, Nama, Desc</span>
                        </li>
                        <li className="flex gap-2 text-xs">
                            <span className="bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded font-bold min-w-[80px]">MASUK:</span>
                            <span className="text-gray-600 dark:text-gray-400 italic">Masuk, In, Debit, Pemasukan, Setor</span>
                        </li>
                        <li className="flex gap-2 text-xs">
                            <span className="bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded font-bold min-w-[80px]">KELUAR:</span>
                            <span className="text-gray-600 dark:text-gray-400 italic">Keluar, Out, Credit, Kredit, Bayar</span>
                        </li>
                    </ul>
                  </div>
                  <div className="bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <div className="flex items-center gap-2 text-amber-600 mb-2">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Tips Agar Terdeteksi:</span>
                      </div>
                      <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-2 list-decimal ml-4">
                          <li>Gunakan format file <b>.xlsx</b> (Excel Modern).</li>
                          <li>Jangan biarkan baris pertama (Header) kosong.</li>
                          <li>Pastikan kolom <b>Uraian</b> dan salah satu antara <b>Masuk</b> atau <b>Keluar</b> terisi nominal angka.</li>
                          <li>Format tanggal di Excel bebas (dd/mm/yyyy atau yyyy-mm-dd).</li>
                      </ol>
                  </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-blue-100 dark:border-blue-800">
                  <button 
                    onClick={downloadTemplate}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors"
                  >
                      <Download className="w-4 h-4" />
                      Download Template Excel
                  </button>
                  <p className="text-[10px] text-blue-500 dark:text-blue-400 italic">Gunakan template di atas jika Anda masih kesulitan mengimpor file buatan sendiri.</p>
              </div>
          </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Saldo Saat Ini</span>
              </div>
              <p className={`text-2xl font-bold ${currentBalance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                  Rp {currentBalance.toLocaleString('id-ID')}
              </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Total Pemasukan</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  + Rp {totalIn.toLocaleString('id-ID')}
              </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-2 text-gray-500 dark:text-gray-400">
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Total Pengeluaran</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  - Rp {totalOut.toLocaleString('id-ID')}
              </p>
          </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl animate-in fade-in zoom-in-95 no-print mb-6 relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
                Input Transaksi
            </h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Tipe Transaksi</label>
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                        <button 
                            type="button"
                            onClick={() => setNewTrans({...newTrans, type: 'in'})}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTrans.type === 'in' ? 'bg-white dark:bg-gray-600 text-green-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            Pemasukan (Debit)
                        </button>
                        <button 
                            type="button"
                            onClick={() => setNewTrans({...newTrans, type: 'out'})}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTrans.type === 'out' ? 'bg-white dark:bg-gray-600 text-red-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                        >
                            Pengeluaran (Kredit)
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Tanggal</label>
                    <input 
                        type="date" 
                        required
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        value={newTrans.date}
                        onChange={e => setNewTrans({...newTrans, date: e.target.value})}
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Keterangan / Uraian</label>
                    <input 
                        type="text" 
                        required
                        placeholder="Contoh: Beli Kopi"
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        value={newTrans.description}
                        onChange={e => setNewTrans({...newTrans, description: e.target.value})}
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Jumlah (Rp)</label>
                    <input 
                        type="number" 
                        min="0"
                        required
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
                        value={newTrans.amount}
                        onChange={e => setNewTrans({...newTrans, amount: parseInt(e.target.value) || 0})}
                    />
                </div>
                
                <div className="col-span-2 flex justify-end gap-3 mt-4">
                    <button 
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-bold"
                    >
                        Batal
                    </button>
                    <button 
                        type="submit"
                        className="px-6 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20"
                    >
                        Simpan
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* Transaction List */}
      
      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
          {sortedTransactions.map(t => (
              <div key={t.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <div>
                      <div className="text-xs text-gray-400 mb-1 flex items-center gap-2">
                        <span>{t.date}</span>
                      </div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{t.description}</p>
                  </div>
                  <div className={`text-right ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                      <p className="font-bold text-sm">
                          {t.type === 'in' ? '+' : '-'} Rp {t.amount.toLocaleString('id-ID')}
                      </p>
                      <div className={`text-xs mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${t.type === 'in' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                          {t.type === 'in' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                          {t.type === 'in' ? 'Masuk' : 'Keluar'}
                      </div>
                  </div>
              </div>
          ))}
          {sortedTransactions.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">Belum ada transaksi</div>
          )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase text-xs font-bold">
                  <tr>
                      <th className="px-6 py-4">Tanggal</th>
                      <th className="px-6 py-4">Uraian</th>
                      <th className="px-6 py-4 text-right text-green-600">Masuk (Debit)</th>
                      <th className="px-6 py-4 text-right text-red-600">Keluar (Kredit)</th>
                      <th className="px-6 py-4 text-center no-print">Aksi</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{t.date}</td>
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{t.description}</td>
                          <td className="px-6 py-4 text-right font-medium text-green-600 dark:text-green-400">
                              {t.type === 'in' ? `Rp ${t.amount.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-red-600 dark:text-red-400">
                              {t.type === 'out' ? `Rp ${t.amount.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-center no-print">
                              <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </td>
                      </tr>
                  ))}
                  {sortedTransactions.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada transaksi</td></tr>
                  )}
              </tbody>
          </table>
      </div>

      <div className="hidden print-only mt-8">
            <div className="flex justify-between items-start border-t border-black pt-4">
                <div>
                     <p className="text-sm">Dicetak Tanggal: {new Date().toLocaleDateString('id-ID')}</p>
                </div>
                <div className="text-right">
                    <p className="font-bold">Total Pemasukan: Rp {totalIn.toLocaleString('id-ID')}</p>
                    <p className="font-bold">Total Pengeluaran: Rp {totalOut.toLocaleString('id-ID')}</p>
                    <p className="font-bold text-xl mt-2">Sisa Saldo: Rp {currentBalance.toLocaleString('id-ID')}</p>
                </div>
            </div>
      </div>
    </div>
  );
};