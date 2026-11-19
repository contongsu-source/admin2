import React, { useState, useEffect, useRef } from 'react';
import { AppState, DailyAttendance, MaterialItem } from '../types';
import { Printer, Plus, Trash2, RefreshCw, FileText, Edit, Check, Settings2, Sparkles, FileDown, Eye } from 'lucide-react';
import { terbilang } from '../utils';
import { triggerPrintWithPdfFallback } from '../pdfUtils';

interface InvoicePageProps {
  state: AppState;
  onChangeView: (view: string) => void;
}

interface CustomInvoiceItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
}

interface CustomInvoice {
  companyName: string;
  companyAddress: string;
  companyNpwp: string;
  documentTitle: string;
  invoiceNo: string;
  orderDate: string;
  recipientName: string;
  recipientAddress: string;
  items: CustomInvoiceItem[];
  showBankStamp: boolean;
  bankAccountName: string;
  bankBca: string;
  bankMandiri: string;
  showLunasStamp: boolean;
  lunasDate: string;
  footnote: string;
  includePpnText: boolean;
  ppnText: string;
  city: string;
  date: string;
  roleName: string;
  signerName: string;
  fontStyle: 'mono' | 'sans';
  jtTempo?: string;
  salesman?: string;
  paperSize?: 'A4' | 'A5-landscape' | 'A5-portrait';
}

export const InvoicePage: React.FC<InvoicePageProps> = ({ state, onChangeView }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriod = state.periods.find(p => p.id === currentProject?.currentPeriodId);
  const materials = state.materials[currentPeriod?.id || ''] || [];
  const records = state.attendance[currentPeriod?.id || ''] || [];
  const { companyProfile } = state;

  const [activeTab, setActiveTab] = useState<'automatic' | 'custom'>('automatic');
  const [mobileMode, setMobileMode] = useState<'edit' | 'preview'>('edit');
  const autoInvoiceRef = useRef<HTMLDivElement>(null);
  const customInvoiceRef = useRef<HTMLDivElement>(null);

  // Calculate project totals
  let totalWagesNet = 0;
  let totalCashAdvance = 0;
  records.forEach(record => {
    const emp = state.employees.find(e => e.id === record.employeeId && e.projectId === state.currentProjectId);
    if (emp) {
      let workDays = 0;
      let overtimeHours = 0;
      
      const startDate = new Date(currentPeriod?.startDate || '').getTime();
      const endDateObj = new Date(currentPeriod?.endDate || '');
      endDateObj.setHours(23, 59, 59, 999);
      const endTimestamp = endDateObj.getTime();

      Object.values(record.days).forEach((day: DailyAttendance) => {
          const targetDate = new Date(day.date).getTime();
          if (targetDate >= startDate && targetDate <= endTimestamp) {
            if (day.isPresent) workDays++;
            if (day.extraWorkDays) workDays += day.extraWorkDays;
            overtimeHours += day.overtimeHours;
          }
      });
      const dailyRate = record.dailyRate ?? emp.dailyRate;
      const overtimeRate = record.overtimeRate ?? emp.overtimeRate;
      const cashAdvance = record.cashAdvance ?? 0;
      
      const gross = (workDays * dailyRate) + (overtimeHours * overtimeRate);
      totalCashAdvance += cashAdvance;
      totalWagesNet += (gross - cashAdvance);
    }
  });

  const totalMaterials = materials.reduce((acc, m) => acc + m.totalPrice, 0);
  const grandTotal = totalWagesNet + totalCashAdvance + totalMaterials;

  // Custom Invoice State
  const getInitialCustomInvoice = (): CustomInvoice => {
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const longDateStr = currentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Initial default items mimicking the user's receipt
    const defaultItems: CustomInvoiceItem[] = [
      {
        id: 'item-1',
        name: 'IKU 50 X 5 MM - 6 M (A)',
        qty: 80,
        unit: 'BATANG',
        price: 227000
      },
      {
        id: 'item-2',
        name: 'IKU 80 X 8 MM - 6 M',
        qty: 40,
        unit: 'BATANG',
        price: 506100
      }
    ];

    return {
      companyName: companyProfile.name.toUpperCase() || 'PT. IMMANUEL DUNAMIS',
      companyAddress: companyProfile.address.toUpperCase() || 'JL. GATOT SUBROTO BLOK N NO.1, KAWASAN INDUSTRI CANDI, NGALIYAN, SEMARANG JAWA TENGAH - 00000',
      companyNpwp: '01.830.509.4-511.000',
      documentTitle: 'ORDER PENJUALAN',
      invoiceNo: `06G0${Math.floor(100000 + Math.random() * 900000)}`,
      orderDate: dateStr,
      recipientName: (currentProject?.clientName || 'PELANGGAN UMUM').toUpperCase(),
      recipientAddress: (currentProject?.clientAddress || '').toUpperCase(),
      items: defaultItems,
      showBankStamp: true,
      bankAccountName: companyProfile.name.toUpperCase() || 'PT. IMMANUEL DUNAMIS',
      bankBca: '409-333-777-1',
      bankMandiri: '135 0056 8 9999 8',
      showLunasStamp: true,
      lunasDate: longDateStr.toUpperCase(),
      footnote: 'BARANG HARAP DIHITUNG SETELAH ITU BUKAN TANGGUNG JAWAB KAMI.',
      includePpnText: true,
      ppnText: 'Harga sudah termasuk PPN',
      city: companyProfile.city || 'Semarang',
      date: longDateStr,
      roleName: '',
      signerName: companyProfile.director || 'Direktur',
      fontStyle: 'mono',
      jtTempo: '0 HARI',
      salesman: 'ANDY WIJAYA BINARTO',
      paperSize: 'A4'
    };
  };

  const [customInvoice, setCustomInvoice] = useState<CustomInvoice>(() => {
    const saved = localStorage.getItem('custom_invoice_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Gagal memuat draf nota kustom", e);
      }
    }
    return getInitialCustomInvoice();
  });

  useEffect(() => {
    localStorage.setItem('custom_invoice_draft', JSON.stringify(customInvoice));
  }, [customInvoice]);

  const updateField = <K extends keyof CustomInvoice>(field: K, value: CustomInvoice[K]) => {
    setCustomInvoice(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (itemId: string, field: keyof CustomInvoiceItem, value: any) => {
    setCustomInvoice(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          // Enforce bounds
          if (field === 'qty') updated.qty = Math.max(0, Number(value));
          if (field === 'price') updated.price = Math.max(0, Number(value));
          return updated;
        }
        return item;
      })
    }));
  };

  const removeItem = (itemId: string) => {
    setCustomInvoice(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const addItem = () => {
    const newItem: CustomInvoiceItem = {
      id: `item-${Date.now()}`,
      name: 'BARANG BARU',
      qty: 1,
      unit: 'BATANG',
      price: 0
    };
    setCustomInvoice(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Prepopulate functions
  const importCompleteSummary = () => {
    if (!confirm("Isi otomatis akan menimpa draf barang saat ini. Lanjutkan?")) return;
    
    const projectItems: CustomInvoiceItem[] = [];
    
    // Add wages
    if (totalWagesNet > 0) {
      projectItems.push({
        id: `wages-${Date.now()}`,
        name: `UPAH KERJA BERSIH - ${currentPeriod?.name || 'PERIODE INI'}`.toUpperCase(),
        qty: 1,
        unit: 'LOT',
        price: totalWagesNet
      });
    }

    // Add cash advance if any
    if (totalCashAdvance > 0) {
      projectItems.push({
        id: `advance-${Date.now()}`,
        name: 'PENGEMBALIAN KASBON PEKERJA'.toUpperCase(),
        qty: 1,
        unit: 'LOT',
        price: totalCashAdvance
      });
    }

    // Add material summary
    if (totalMaterials > 0) {
      projectItems.push({
        id: `materials-sum-${Date.now()}`,
        name: 'MATERIAL PROYEK'.toUpperCase(),
        qty: 1,
        unit: 'LOT',
        price: totalMaterials
      });
    }

    setCustomInvoice(prev => ({
      ...prev,
      companyName: companyProfile.name.toUpperCase(),
      companyAddress: companyProfile.address.toUpperCase(),
      recipientName: (currentProject?.clientName || 'PELANGGAN').toUpperCase(),
      recipientAddress: (currentProject?.clientAddress || '').toUpperCase(),
      items: projectItems,
    }));
  };

  const importMaterialsDetail = () => {
    if (materials.length === 0) {
      alert("Tidak ada data material di periode aktif proyek ini.");
      return;
    }
    if (!confirm("Isi otomatis detail material akan menimpa draf barang saat ini. Lanjutkan?")) return;

    const importedItems: CustomInvoiceItem[] = materials.map((m, idx) => ({
      id: `m-${m.id || idx}-${Date.now()}`,
      name: m.itemName.toUpperCase(),
      qty: m.quantity,
      unit: (m.unit || 'BATANG').toUpperCase(),
      price: m.unitPrice
    }));

    setCustomInvoice(prev => ({
      ...prev,
      companyName: companyProfile.name.toUpperCase(),
      companyAddress: companyProfile.address.toUpperCase(),
      recipientName: (currentProject?.clientName || 'PELANGGAN').toUpperCase(),
      recipientAddress: (currentProject?.clientAddress || '').toUpperCase(),
      items: importedItems
    }));
  };

  const resetToDefault = () => {
    if (confirm("Apakah Anda yakin ingin menyetel ulang draf ke draf bawaan?")) {
      setCustomInvoice(getInitialCustomInvoice());
    }
  };

  const getActiveInvoiceRef = () =>
    activeTab === 'automatic' ? autoInvoiceRef.current : customInvoiceRef.current;

  const getInvoicePdfOptions = () => ({
    filename:
      activeTab === 'automatic'
        ? `Invoice_${currentProject?.name || 'Proyek'}_${currentPeriod?.name || ''}`
        : `Nota_${customInvoice.invoiceNo || currentProject?.name || 'Custom'}`,
    paperSize: (activeTab === 'custom' ? customInvoice.paperSize || 'A4' : 'A4') as
      | 'A4'
      | 'A5-landscape'
      | 'A5-portrait',
    preferSinglePage: true,
  });

  const handlePrint = async () => {
    await triggerPrintWithPdfFallback({
      getElement: getActiveInvoiceRef,
      pdfOptions: getInvoicePdfOptions(),
    });
  };

  const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Custom total calculation
  const customTotal = customInvoice.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  const customTerbilangStr = terbilang(customTotal).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dokumen Cetak & Nota</h2>
          <p className="text-gray-500 dark:text-gray-400">Pilih laporan proyek otomatis atau cetak nota yang bisa diedit bebas</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {activeTab === 'automatic' ? (
            <>
              <button 
                onClick={() => onChangeView('consolidated_report')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                title="Cetak Absensi, Gaji, Material, dan Invoice dalam 1 Lembar"
              >
                <Printer className="w-4 h-4" />
                Cetak 1 Lembar Terpadu
              </button>
              <button 
                onClick={handlePrint}
                className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Cetak Invoice Saja
              </button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => onChangeView('consolidated_report')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                title="Cetak Absensi, Gaji, Material, dan Invoice dalam 1 Lembar"
              >
                <Printer className="w-4 h-4" />
                Cetak 1 Lembar Terpadu
              </button>
              <button 
                onClick={handlePrint}
                className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-500/20"
              >
                <Printer className="w-4 h-4" />
                Cetak Nota Sekarang
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 no-print">
        <button
          onClick={() => setActiveTab('automatic')}
          className={`py-3.5 px-6 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'automatic'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Invoice Otomatis Proyek
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`py-3.5 px-6 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'custom'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Edit className="w-4 h-4" />
          Nota Penjualan Kustom (Bisa Diedit)
        </button>
      </div>

      {/* Tab 1: Automatic Invoice */}
      {activeTab === 'automatic' && (
        <div ref={autoInvoiceRef} className="bg-white dark:bg-gray-800 p-8 md:p-12 shadow-sm border border-gray-200 dark:border-gray-700 max-w-4xl mx-auto print:shadow-none print:border-0 print:p-0 print:w-full print:bg-white print:text-black">
          {/* Header */}
          <div className="flex justify-between items-start mb-12 border-b border-gray-200 dark:border-gray-700 pb-8">
              <div className="flex items-center gap-4">
                  <div className="bg-brand-700 text-accent-300 font-black text-2xl px-3.5 py-2 rounded-xl tracking-tighter shadow-sm border border-accent-400/50 print:bg-black print:text-white print:border-black">TK</div>
                  <div>
                      <h1 className="text-xl font-bold text-gray-800 dark:text-white uppercase print:text-black">{companyProfile.name}</h1>
                  </div>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400 max-w-xs print:text-gray-600">
                  Alamat: {companyProfile.address}
              </div>
          </div>

          {/* Recipient */}
          <div className="mb-12">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Kepada Yth,</div>
              <div className="font-bold text-gray-900 dark:text-white print:text-black">{currentProject?.clientName}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{currentProject?.clientAddress}</div>
          </div>

          <h2 className="text-center font-bold text-xl uppercase mb-8 tracking-widest border-b-2 border-gray-800 dark:border-white inline-block mx-auto w-full pb-2 print:text-black print:border-black">Invoice</h2>

          {/* Table */}
          <table className="w-full text-sm mb-12 border border-gray-800 dark:border-gray-700 print:border-black">
              <thead>
                  <tr className="border-b border-gray-800 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 print:bg-transparent print:border-black">
                      <th className="py-2 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black w-12">No</th>
                      <th className="py-2 px-4 text-left border-r border-gray-800 dark:border-gray-700 print:border-black">Uraian</th>
                      <th className="py-2 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black w-24">Qty</th>
                      <th className="py-2 px-4 text-right w-40">Jumlah</th>
                  </tr>
              </thead>
              <tbody>
                  <tr className="border-b border-gray-800 dark:border-gray-700 print:border-black">
                      <td className="py-4 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black align-top">1</td>
                      <td className="py-4 px-4 border-r border-gray-800 dark:border-gray-700 print:border-black align-top">
                          <p className="font-medium">Pembayaran Jasa Proyek {currentPeriod?.name}</p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 print:text-gray-600">Upah Kerja Bersih (Terlampir)</p>
                      </td>
                      <td className="py-4 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black align-top">1 LOT</td>
                      <td className="py-4 px-4 text-right font-medium align-top">
                          Rp {totalWagesNet.toLocaleString('id-ID')}
                      </td>
                  </tr>
                  {totalCashAdvance > 0 && (
                      <tr className="border-b border-gray-800 dark:border-gray-700 print:border-black">
                          <td className="py-4 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black align-top">2</td>
                          <td className="py-4 px-4 border-r border-gray-800 dark:border-gray-700 print:border-black align-top">
                              <p className="font-medium">Pengembalian Kasbon Pekerja</p>
                          </td>
                          <td className="py-4 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black align-top">1 LOT</td>
                          <td className="py-4 px-4 text-right font-medium align-top">
                              Rp {totalCashAdvance.toLocaleString('id-ID')}
                          </td>
                      </tr>
                  )}
                  {totalMaterials > 0 && (
                      <tr className="border-b border-gray-800 dark:border-gray-700 print:border-black">
                          <td className="py-4 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black align-top">{totalCashAdvance > 0 ? '3' : '2'}</td>
                          <td className="py-4 px-4 border-r border-gray-800 dark:border-gray-700 print:border-black align-top">
                              <p className="font-medium">Pembelian Material</p>
                          </td>
                          <td className="py-4 px-4 text-center border-r border-gray-800 dark:border-gray-700 print:border-black align-top">1 LOT</td>
                          <td className="py-4 px-4 text-right font-medium align-top">
                              Rp {totalMaterials.toLocaleString('id-ID')}
                          </td>
                      </tr>
                  )}
                  {/* Empty rows to fill space */}
                  <tr className="h-24 border-b border-gray-800 dark:border-gray-700 print:border-black">
                       <td className="border-r border-gray-800 dark:border-gray-700 print:border-black"></td>
                       <td className="border-r border-gray-800 dark:border-gray-700 print:border-black"></td>
                       <td className="border-r border-gray-800 dark:border-gray-700 print:border-black"></td>
                       <td></td>
                  </tr>
              </tbody>
              <tfoot>
                  <tr className="bg-gray-100 dark:bg-gray-900 font-bold print:bg-transparent">
                      <td colSpan={3} className="py-3 px-4 text-right border-r border-gray-800 dark:border-gray-700 print:border-black">Total</td>
                      <td className="py-3 px-4 text-right">Rp {grandTotal.toLocaleString('id-ID')}</td>
                  </tr>
              </tfoot>
          </table>

          {/* Footer */}
          <div className="mb-16">
              <div className="font-bold text-sm mb-2 text-gray-900 dark:text-white print:text-black">Terbilang :</div>
              <div className="bg-gray-100 dark:bg-gray-900 p-3 italic text-gray-700 dark:text-gray-300 text-sm border-l-4 border-gray-800 dark:border-gray-400 print:bg-transparent print:border-black print:text-black">
                  # {terbilang(grandTotal)} rupiah #
              </div>
          </div>

          <div className="flex justify-end mt-20">
              <div className="text-center text-gray-900 dark:text-white print:text-black">
                  <p className="mb-2">{companyProfile.city}, {currentDate}</p>
                  <p className="mb-2">Direktur,</p>
                  {companyProfile.signature ? (
                      <img src={companyProfile.signature} alt="Tanda Tangan" className="h-32 mx-auto mb-2" />
                  ) : (
                      <div className="h-32" />
                  )}
                  <p className="font-bold border-b border-gray-800 dark:border-gray-300 print:border-black inline-block px-8 pb-1">{companyProfile.director}</p>
              </div>
          </div>
        </div>
      )}

      {/* Tab 2: Custom Invoice Editor */}
      {activeTab === 'custom' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Mobile View Toggle */}
          <div className="lg:hidden flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden no-print">
            <button
              onClick={() => setMobileMode('edit')}
              className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                mobileMode === 'edit'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <Edit className="w-4 h-4" />
              Edit Data
            </button>
            <button
              onClick={() => setMobileMode('preview')}
              className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                mobileMode === 'preview'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <Eye className="w-4 h-4" />
              Pratinjau Nota
            </button>
          </div>

          {/* LEFT: Sidebar Control Panel */}
          <div className={`lg:col-span-4 space-y-6 no-print ${mobileMode === 'edit' ? 'block' : 'hidden lg:block'}`}>
            
            {/* Quick-fill Auto Template */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-brand-500" /> Isi Data Otomatis
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tarik data proyek aktif untuk mengisi nota ini secara instan</p>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <button
                  type="button"
                  onClick={importCompleteSummary}
                  className="w-full flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/30 text-brand-700 dark:text-brand-300 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Rekap Lengkap (Upah + Material)
                </button>
                <button
                  type="button"
                  onClick={importMaterialsDetail}
                  className="w-full flex items-center justify-center gap-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/30 text-brand-700 dark:text-brand-300 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Detail Material Saja
                </button>
                <button
                  type="button"
                  onClick={resetToDefault}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 py-2 px-3 rounded-xl text-xs font-semibold transition-all"
                >
                  Atur Ulang ke Default
                </button>
              </div>
            </div>

            {/* Form Settings */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-5">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide border-b border-gray-100 dark:border-gray-700 pb-3">
                <Settings2 className="w-4 h-4 text-brand-500" /> Pengaturan Nota
              </h3>

              {/* Typography style */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Gaya Tulisan / Font</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateField('fontStyle', 'mono')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      customInvoice.fontStyle === 'mono'
                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700 shadow-sm'
                        : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Typewriter (Mono)
                  </button>
                  <button
                    onClick={() => updateField('fontStyle', 'sans')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      customInvoice.fontStyle === 'sans'
                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700 shadow-sm'
                        : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Clean Modern (Sans)
                  </button>
                </div>
              </div>

              {/* Paper size style */}
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Ukuran Kertas Cetak</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateField('paperSize', 'A4')}
                    className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all truncate text-center ${
                      (!customInvoice.paperSize || customInvoice.paperSize === 'A4')
                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700 shadow-sm'
                        : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                    title="A4 Portrait (Standar)"
                  >
                    A4 Portrait
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('paperSize', 'A5-landscape')}
                    className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all truncate text-center ${
                      customInvoice.paperSize === 'A5-landscape'
                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700 shadow-sm'
                        : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                    title="A5 Landscape (Setengah A4 Mendatar)"
                  >
                    A5 Landscape
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('paperSize', 'A5-portrait')}
                    className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all truncate text-center ${
                      customInvoice.paperSize === 'A5-portrait'
                        ? 'bg-gray-900 dark:bg-gray-700 text-white border-gray-900 dark:border-gray-700 shadow-sm'
                        : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                    title="A5 Portrait (Setengah A4 Tegak)"
                  >
                    A5 Portrait
                  </button>
                </div>
              </div>

              {/* Title and ID */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Judul Nota</label>
                  <input
                    type="text"
                    value={customInvoice.documentTitle}
                    onChange={e => updateField('documentTitle', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nomor Nota</label>
                  <input
                    type="text"
                    value={customInvoice.invoiceNo}
                    onChange={e => updateField('invoiceNo', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Header details */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nama Perusahaan Penjual</label>
                  <input
                    type="text"
                    value={customInvoice.companyName}
                    onChange={e => updateField('companyName', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Alamat Penjual</label>
                  <textarea
                    rows={2}
                    value={customInvoice.companyAddress}
                    onChange={e => updateField('companyAddress', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">NPWP</label>
                    <input
                      type="text"
                      value={customInvoice.companyNpwp}
                      onChange={e => updateField('companyNpwp', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Tanggal Order</label>
                    <input
                      type="text"
                      value={customInvoice.orderDate}
                      onChange={e => updateField('orderDate', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Jatuh Tempo</label>
                    <input
                      type="text"
                      value={customInvoice.jtTempo || ''}
                      onChange={e => updateField('jtTempo', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Salesman</label>
                    <input
                      type="text"
                      value={customInvoice.salesman || ''}
                      onChange={e => updateField('salesman', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Recipient details */}
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Penerima (Kepada Yth)</h4>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Nama Pembeli</label>
                  <input
                    type="text"
                    value={customInvoice.recipientName}
                    onChange={e => updateField('recipientName', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Alamat Pembeli</label>
                  <input
                    type="text"
                    value={customInvoice.recipientAddress}
                    onChange={e => updateField('recipientAddress', e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Interactive Stamps */}
              <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Desain Cap / Stempel</h4>
                
                {/* Bank Account Stamp */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Stempel Rekening Bank (Merah)</label>
                    <input
                      type="checkbox"
                      checked={customInvoice.showBankStamp}
                      onChange={e => updateField('showBankStamp', e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  {customInvoice.showBankStamp && (
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                      <input
                        type="text"
                        placeholder="A/N Rekening"
                        value={customInvoice.bankAccountName}
                        onChange={e => updateField('bankAccountName', e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Nomor Rek BCA"
                        value={customInvoice.bankBca}
                        onChange={e => updateField('bankBca', e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-900 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="Nomor Rek Mandiri"
                        value={customInvoice.bankMandiri}
                        onChange={e => updateField('bankMandiri', e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                {/* LUNAS Stamp */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Stempel Cap LUNAS (Merah)</label>
                    <input
                      type="checkbox"
                      checked={customInvoice.showLunasStamp}
                      onChange={e => updateField('showLunasStamp', e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  {customInvoice.showLunasStamp && (
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                      <input
                        type="text"
                        placeholder="Tanggal Lunas (Contoh: 03 JULI 2026)"
                        value={customInvoice.lunasDate}
                        onChange={e => updateField('lunasDate', e.target.value)}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Footnote & PPN Text */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Teks PPN</label>
                    <input
                      type="checkbox"
                      checked={customInvoice.includePpnText}
                      onChange={e => updateField('includePpnText', e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                    />
                  </div>
                  {customInvoice.includePpnText && (
                    <input
                      type="text"
                      value={customInvoice.ppnText}
                      onChange={e => updateField('ppnText', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                    />
                  )}
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Catatan Kaki (Kotak Bawah)</label>
                    <textarea
                      rows={2}
                      value={customInvoice.footnote}
                      onChange={e => updateField('footnote', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Signer */}
                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wide">Tanda Tangan</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Kota"
                      value={customInvoice.city}
                      onChange={e => updateField('city', e.target.value)}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Tanggal Nota"
                      value={customInvoice.date}
                      onChange={e => updateField('date', e.target.value)}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Jabatan"
                      value={customInvoice.roleName}
                      onChange={e => updateField('roleName', e.target.value)}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Nama Direktur/Kasir"
                      value={customInvoice.signerName}
                      onChange={e => updateField('signerName', e.target.value)}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT: Document Preview & Table Editor */}
          <div className={`lg:col-span-8 space-y-6 ${mobileMode === 'preview' ? 'block' : 'hidden lg:block print:block pdf-force-show'}`}>
            
            {/* Table Editing Grid (Displayed above the preview card as a distinct widget so they don't have to fiddle in tables) */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 no-print">
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
                <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-500" /> Daftar Barang Nota
                </h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> Tambah Barang
                </button>
              </div>

              {/* Items List Form */}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {customInvoice.items.length === 0 ? (
                  <p className="text-center py-6 text-sm text-gray-400">Belum ada barang. Klik Tambah Barang di atas.</p>
                ) : (
                  customInvoice.items.map((item, idx) => (
                    <div key={item.id} className="flex flex-col md:flex-row items-start md:items-center gap-2.5 p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200/60 dark:border-gray-700/60 transition-all">
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs font-semibold text-gray-400 w-5 text-center">{idx + 1}</span>
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => updateItem(item.id, 'name', e.target.value.toUpperCase())}
                          placeholder="Nama Barang"
                          className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:flex-1">
                        <input
                          type="number"
                          value={item.qty || ''}
                          onChange={e => updateItem(item.id, 'qty', e.target.value)}
                          placeholder="Qty"
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center text-gray-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={item.unit}
                          onChange={e => updateItem(item.id, 'unit', e.target.value.toUpperCase())}
                          placeholder="Satuan"
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-center text-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          value={item.price || ''}
                          onChange={e => updateItem(item.id, 'price', e.target.value)}
                          placeholder="Harga Satuan"
                          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-right text-gray-900 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all self-end md:self-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Dynamic print style based on selected paper size */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: ${
                    customInvoice.paperSize === 'A5-landscape' 
                      ? 'A5 landscape' 
                      : customInvoice.paperSize === 'A5-portrait' 
                        ? 'A5 portrait' 
                        : 'A4 portrait'
                  };
                  margin: ${customInvoice.paperSize && customInvoice.paperSize.startsWith('A5') ? '6mm' : '10mm'};
                }
                
                /* Adjust layout padding/sizing for A5 to make it fit beautifully */
                ${customInvoice.paperSize && customInvoice.paperSize.startsWith('A5') ? `
                  .print-a5-container {
                    padding: 4mm !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    margin: 0 !important;
                  }
                  .print-a5-container table {
                    font-size: 10px !important;
                  }
                  .print-a5-container h1 {
                    font-size: 13px !important;
                  }
                  .print-a5-container h2 {
                    font-size: 14px !important;
                  }
                  .print-a5-container th, .print-a5-container td {
                    padding-top: 3px !important;
                    padding-bottom: 3px !important;
                    font-size: 9.5px !important;
                  }
                ` : ''}
              }
            ` }} />

            {/* Document Print Area (Looks like real paper receipt) */}
            <div 
              ref={customInvoiceRef}
              className={`bg-white text-black print-a5-container shadow-md border border-gray-200 rounded-xl mx-auto print:shadow-none print:border-0 print:p-0 print:w-full print:bg-white print:text-black ${
                customInvoice.paperSize === 'A5-landscape'
                  ? 'max-w-4xl p-6 md:p-8'
                  : customInvoice.paperSize === 'A5-portrait'
                    ? 'max-w-2xl p-6 md:p-8'
                    : 'max-w-4xl p-8 md:p-12'
              } ${
                customInvoice.fontStyle === 'mono' ? 'font-mono uppercase tracking-wider text-black' : 'font-sans text-black'
              }`}
            >
              
              {/* Header: Company Name & Doc Title */}
              <div className="flex flex-col mb-4 border-b border-dashed border-slate-300 pb-3">
                <div className="space-y-1">
                  <h1 className="text-base font-black tracking-tight text-black">
                    {customInvoice.companyName}
                  </h1>
                  <p className="text-[10px] leading-relaxed text-slate-800 print:text-black whitespace-pre-line">
                    {customInvoice.companyAddress}
                  </p>
                  {customInvoice.companyNpwp && (
                    <p className="text-[10px] text-slate-800 print:text-black">
                      NPWP : {customInvoice.companyNpwp}
                    </p>
                  )}
                </div>
              </div>

              {/* Centered Document Title */}
              <div className="text-center mb-6">
                <h2 className="text-lg font-black border-b-2 border-double border-black pb-0.5 uppercase tracking-widest text-black inline-block mx-auto">
                  {customInvoice.documentTitle}
                </h2>
              </div>

              {/* Side-by-side Meta Info Layout resembling the physical dot-matrix receipt */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-[11px] text-black">
                {/* Left: Buyer and Delivery details */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-start">
                    <span className="font-bold shrink-0 w-28">PEMESAN :</span>
                    <span className="font-black text-black">{customInvoice.recipientName}</span>
                  </div>
                  <div className="flex items-start">
                    <span className="font-bold shrink-0 w-28">BARANG DIKIRIM KE:</span>
                    <div className="whitespace-pre-line font-semibold leading-normal text-black flex-1">
                      {customInvoice.recipientAddress || '-'}
                    </div>
                  </div>
                </div>

                {/* Right: Order metadata (colons and values perfectly aligned to the right-side border) */}
                <div className="space-y-1 justify-self-end w-full max-w-[320px]">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-left">TG. ORDER :</span>
                    <span className="font-semibold text-left w-44 pl-2">{customInvoice.orderDate}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-left">NO. ORDER :</span>
                    <span className="font-semibold text-left w-44 pl-2">{customInvoice.invoiceNo}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-left">JT. TEMPO :</span>
                    <span className="font-semibold text-left w-44 pl-2">{customInvoice.jtTempo || '0 HARI'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="font-bold text-left">SALESMAN :</span>
                    <span className="font-semibold text-left w-44 pl-2 whitespace-nowrap overflow-hidden text-ellipsis">{customInvoice.salesman || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Top double lines character divider */}
              <div className="text-xs select-none leading-none mb-1 font-bold text-black border-t-2 border-b-2 border-dashed border-black py-0.5">
                {/* Visual border wrapper */}
                <table className="w-full text-[11px] text-black border-collapse">
                  <thead>
                    <tr className="text-black font-black text-left">
                      <th className="py-1.5 w-8 text-center border-r border-dashed border-slate-400">NO</th>
                      <th className="py-1.5 px-2 border-r border-dashed border-slate-400">NAMA BARANG</th>
                      <th className="py-1.5 text-center w-14 border-r border-dashed border-slate-400">QTY</th>
                      <th className="py-1.5 text-center w-20 border-r border-dashed border-slate-400">SATUAN</th>
                      <th className="py-1.5 text-right w-24 border-r border-dashed border-slate-400">HRG/UNIT</th>
                      <th className="py-1.5 text-right w-28 border-r border-dashed border-slate-400">HARGA</th>
                      <th className="py-1.5 text-right w-20 border-r border-dashed border-slate-400">DISCOUNT</th>
                      <th className="py-1.5 text-right w-28">NETTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customInvoice.items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">Belum ada rincian barang.</td>
                      </tr>
                    ) : (
                      customInvoice.items.map((item, idx) => {
                        const rowTotal = item.qty * item.price;
                        return (
                          <tr key={item.id} className="border-t border-dashed border-slate-300">
                            <td className="py-2 text-center text-slate-800 border-r border-dashed border-slate-400">{idx + 1}</td>
                            <td className="py-2 px-2 font-semibold text-black border-r border-dashed border-slate-400 whitespace-pre-line">{item.name}</td>
                            <td className="py-2 text-center border-r border-dashed border-slate-400">{item.qty}</td>
                            <td className="py-2 text-center border-r border-dashed border-slate-400">{item.unit}</td>
                            <td className="py-2 text-right border-r border-dashed border-slate-400">RP {item.price.toLocaleString('id-ID')}</td>
                            <td className="py-2 text-right border-r border-dashed border-slate-400">RP {rowTotal.toLocaleString('id-ID')}</td>
                            <td className="py-2 text-right border-r border-dashed border-slate-400">RP 0</td>
                            <td className="py-2 text-right font-bold text-black">RP {rowTotal.toLocaleString('id-ID')}</td>
                          </tr>
                        );
                      })
                    )}
                    {/* Footnote dipindahkan ke hal.2 / total divider */}
                    <tr className="border-t-2 border-b-2 border-dashed border-black font-black text-black">
                      <td colSpan={4} className="py-2 text-center font-bold tracking-widest border-r border-dashed border-slate-400">JUMLAH</td>
                      <td colSpan={2} className="py-2 text-right border-r border-dashed border-slate-400 font-bold">RP {customTotal.toLocaleString('id-ID')}</td>
                      <td className="py-2 text-right border-r border-dashed border-slate-400">RP 0</td>
                      <td className="py-2 text-right font-black">RP {customTotal.toLocaleString('id-ID')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Terbilang block */}
              <div className="border-b-2 border-dashed border-black py-2 mb-6 text-[11px] text-black">
                <span className="font-bold">TERBILANG : </span>
                <span className="italic font-bold"># {customTerbilangStr ? customTerbilangStr : 'NOL'} RUPIAH #</span>
              </div>

              {/* Bottom Details: Footnote Box & Signature block */}
              <div className="grid grid-cols-3 gap-4 items-end mt-4 text-[11px] text-black w-full">
                
                {/* Column 1: PPN Info & Bank Account Stamp */}
                <div className="space-y-4">
                  {customInvoice.includePpnText && (
                    <div className="text-[10px] text-slate-800 print:text-black italic font-bold">
                      * {customInvoice.ppnText}
                    </div>
                  )}

                  {customInvoice.showBankStamp && (
                    <div className="border-4 border-double border-red-500 text-red-500 p-2.5 font-bold rounded-lg select-none max-w-[210px] rotate-[-1deg] bg-white shadow-sm flex flex-col items-center">
                      <div className="text-center tracking-widest text-[9px] font-black border-b border-dashed border-red-500 pb-0.5 mb-1 w-full">REKENING BANK</div>
                      <div className="text-[9px] text-center font-bold">A/N: {customInvoice.bankAccountName}</div>
                      {customInvoice.bankBca && <div className="text-[9px]">BCA: {customInvoice.bankBca}</div>}
                      {customInvoice.bankMandiri && <div className="text-[9px]">MANDIRI: {customInvoice.bankMandiri}</div>}
                    </div>
                  )}
                </div>

                {/* Column 2: Centered Warning Footnote Box & Lunas Stamp */}
                <div className="flex flex-col items-center justify-center gap-3">
                  {customInvoice.footnote && (
                    <div className="border-2 border-red-500 text-red-500 font-bold p-2.5 text-center text-[9px] leading-relaxed max-w-[240px] rotate-[0.5deg] bg-white rounded shadow-sm">
                      <p className="tracking-wide font-black uppercase text-red-500">BARANG HARAP DIHITUNG</p>
                      <p className="mt-0.5 text-red-500 text-[8px]">SETELAH ITU BUKAN TANGGUNG JAWAB KAMI</p>
                    </div>
                  )}

                  {customInvoice.showLunasStamp && (
                    <div className="border-4 border-double border-red-500 text-red-500 px-4 py-1.5 font-black tracking-widest text-center rounded-lg rotate-[2deg] bg-white shadow-sm flex flex-col items-center justify-center">
                      <div className="text-base leading-none font-black">LUNAS</div>
                      <div className="text-[8px] mt-0.5 tracking-wider font-bold">{customInvoice.lunasDate}</div>
                    </div>
                  )}
                </div>

                {/* Column 3: Signer Block */}
                <div className="text-center text-[11px] text-black space-y-14">
                  <div>
                    <p className="mb-0.5 font-semibold">{customInvoice.city}, {customInvoice.date}</p>
                    {customInvoice.roleName && (
                      <p className="font-bold uppercase tracking-wider">{customInvoice.roleName},</p>
                    )}
                  </div>
                  <div>
                    <p className="font-black border-b-2 border-black inline-block px-8 pb-0.5">
                      {customInvoice.signerName}
                    </p>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      )}
    </div>
  );
};
