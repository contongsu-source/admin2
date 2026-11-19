import React, { useMemo, useRef, useState } from 'react';
import { AppState, MaterialItem } from '../types';
import { Plus, Trash2, Upload, Image as ImageIcon, X, Printer, Calendar, Archive, Download, MapPin, Edit2, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  ALL_LOCATIONS_FILTER,
  extractUniqueMaterialLocations,
  getLocationGroupKey,
  groupMaterialsByLocation,
  normalizeMaterialLocation,
  parseMaterialExcelRow,
} from '../materialUtils';
import { downloadElementAsPdf, triggerPrintWithPdfFallback } from '../pdfUtils';

interface MaterialPageProps {
  state: AppState;
  onUpdate: (materials: MaterialItem[]) => void;
  onChangeView?: (view: string) => void;
}

export const MaterialPage: React.FC<MaterialPageProps> = ({ state, onUpdate, onChangeView }) => {
  const currentProject = state.projects.find(p => p.id === state.currentProjectId);
  const currentPeriodId = currentProject?.currentPeriodId || '';
  const currentPeriod = state.periods.find(p => p.id === currentPeriodId);

  const materials: MaterialItem[] = useMemo(() => {
    return Array.from(
      new Map<string, MaterialItem>((state.materials[currentPeriodId] || []).map((m: MaterialItem) => [m.id, m])).values()
    ).sort((a: MaterialItem, b: MaterialItem) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.materials, currentPeriodId]);

  const projectMaterials: MaterialItem[] = useMemo(() => {
    const projectPeriodIds = state.periods
      .filter(p => p.projectId === state.currentProjectId)
      .map(p => p.id);
    const all: MaterialItem[] = [...materials];
    for (const pid of projectPeriodIds) {
      if (pid !== currentPeriodId && Array.isArray(state.materials[pid])) {
        all.push(...state.materials[pid]);
      }
    }
    return all;
  }, [state.periods, state.currentProjectId, state.materials, currentPeriodId, materials]);

  const knownLocations = useMemo(() => {
    return extractUniqueMaterialLocations(projectMaterials);
  }, [projectMaterials]);

  const groupedMaterials = useMemo(() => {
    return groupMaterialsByLocation(materials);
  }, [materials]);

  const [selectedLocationKey, setSelectedLocationKey] = useState<string>(ALL_LOCATIONS_FILTER);
  const activeLocationKey = groupedMaterials.some(g => g.key === selectedLocationKey)
    ? selectedLocationKey
    : ALL_LOCATIONS_FILTER;

  const visibleGroups = useMemo(() => {
    if (activeLocationKey === ALL_LOCATIONS_FILTER) {
      return groupedMaterials;
    }
    return groupedMaterials.filter(g => g.key === activeLocationKey);
  }, [groupedMaterials, activeLocationKey]);

  const activeFilterGroup = groupedMaterials.find(g => g.key === activeLocationKey);
  const activeFilterLocationName =
    activeFilterGroup && !activeFilterGroup.isDefault ? activeFilterGroup.locationName : '';

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<MaterialItem>>({
    date: new Date().toISOString().split('T')[0],
    location: '',
    itemName: '',
    quantity: 1,
    unit: 'PCS',
    unitPrice: 0,
    receiptImage: undefined
  });
  const [isScanning, setIsScanning] = useState(false);

  const openAddForm = (presetLocation?: string) => {
    setEditingId(null);
    setNewItem({
      date: new Date().toISOString().split('T')[0],
      location: presetLocation !== undefined ? presetLocation : activeFilterLocationName,
      itemName: '',
      quantity: 1,
      unit: 'PCS',
      unitPrice: 0,
      receiptImage: undefined
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditForm = (item: MaterialItem) => {
    setEditingId(item.id);
    setNewItem({
      date: item.date,
      location: item.location || '',
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      receiptImage: item.receiptImage
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleScanNota = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<{base64: string, mimeType: string}>((resolve, reject) => {
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
            const split = compressedDataUrl.split(',');
            const mimeType = 'image/jpeg';
            const base64 = split[1];
            resolve({ base64, mimeType });
          };
          img.onerror = reject;
          img.src = result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { base64, mimeType } = await base64Promise;

      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64, mimeType }),
      });

      if (!response.ok) {
        let errMsg = 'Gagal scan nota';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch(err) {}
        throw new Error(errMsg + ' (Status: ' + response.status + ')');
      }

      const data = await response.json();
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const newItems: MaterialItem[] = data.items.map((item: any) => {
          const qty = Number(item.quantity) || 1;
          const unitPrice = Number(item.unitPrice) || 0;
          const entry: MaterialItem = {
            id: Math.random().toString(36).substr(2, 9),
            date: new Date().toISOString().split('T')[0],
            itemName: item.itemName,
            quantity: qty,
            unit: item.unit || 'PCS',
            unitPrice,
            totalPrice: Number(item.totalPrice) || (qty * unitPrice),
          };
          if (activeFilterLocationName) {
            entry.location = activeFilterLocationName;
          }
          return entry;
        });

        onUpdate([...materials, ...newItems]);
        alert(
          activeFilterLocationName
            ? `Berhasil scan ${newItems.length} item ke tempat "${activeFilterLocationName}"!`
            : `Berhasil scan ${newItems.length} item dari nota!`
        );
      } else {
        alert('Tidak ada barang yang terdeteksi dari nota ini.');
      }
    } catch (error: any) {
      console.error(error);
      alert('Error: ' + error.message + '\n\nPastikan format file benar dan API key valid. Jika di-deploy ke Vercel, pastikan backend berjalan atau pindahkan ke server yang mentoleransi Express backend.');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Tanggal: '2026-03-20',
        'Tempat Proyek': 'Kandang A',
        Barang: 'Semen Gresik 40kg',
        Qty: 10,
        Satuan: 'ZAK',
        Harga: 55000
      },
      {
        Tanggal: '2026-03-20',
        'Tempat Proyek': 'Gudang Utama',
        Barang: 'Pasir Muntilan',
        Qty: 2,
        Satuan: 'RIT',
        Harga: 1500000
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Material');

    ws['!cols'] = [
      { wch: 12 }, // Tanggal
      { wch: 22 }, // Tempat Proyek
      { wch: 30 }, // Barang
      { wch: 8 },  // Qty
      { wch: 10 }, // Satuan
      { wch: 15 }  // Harga
    ];

    XLSX.writeFile(wb, 'Template_Import_Material.xlsx');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800;
                  const MAX_HEIGHT = 800;
                  let width = img.width;
                  let height = img.height;

                  if (width > height) {
                      if (width > MAX_WIDTH) {
                          height *= MAX_WIDTH / width;
                          width = MAX_WIDTH;
                      }
                  } else {
                      if (height > MAX_HEIGHT) {
                          width *= MAX_HEIGHT / height;
                          height = MAX_HEIGHT;
                      }
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);

                  const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                  setNewItem(prev => ({ ...prev, receiptImage: dataUrl }));
              };
              img.src = reader.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.itemName) return;

    const price = newItem.unitPrice === undefined || isNaN(newItem.unitPrice) ? 0 : newItem.unitPrice;
    const qty = newItem.quantity || 0;
    const total = qty * price;
    const cleanLocation = normalizeMaterialLocation(newItem.location);

    const item: MaterialItem = {
      id: editingId || Math.random().toString(36).substr(2, 9),
      date: newItem.date || new Date().toISOString().split('T')[0],
      itemName: newItem.itemName.trim(),
      quantity: qty,
      unit: newItem.unit || 'PCS',
      unitPrice: price,
      totalPrice: total,
    };

    if (cleanLocation) {
      item.location = cleanLocation;
    }
    if (newItem.receiptImage) {
      item.receiptImage = newItem.receiptImage;
    }

    if (editingId) {
      onUpdate(materials.map(m => (m.id === editingId ? item : m)));
    } else {
      onUpdate([...materials, item]);
    }

    if (
      activeLocationKey !== ALL_LOCATIONS_FILTER &&
      activeLocationKey !== getLocationGroupKey(cleanLocation)
    ) {
      setSelectedLocationKey(ALL_LOCATIONS_FILTER);
    }

    closeForm();
    setNewItem({
      date: new Date().toISOString().split('T')[0],
      location: '',
      itemName: '',
      quantity: 1,
      unit: 'PCS',
      unitPrice: 0,
      receiptImage: undefined
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Hapus item belanja ini?")) {
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
            const parsed = parseMaterialExcelRow(row, activeFilterLocationName);
            if (parsed) {
              newMaterials.push({
                id: Math.random().toString(36).substr(2, 9),
                ...parsed
              });
              count++;
            }
          });
          onUpdate(newMaterials);
          alert(`Berhasil mengimpor ${count} item material!`);
        } catch (error) {
          console.error(error);
          alert('Gagal membaca file Excel. Pastikan format kolom: Tanggal, Tempat Proyek (opsional), Barang, Qty, Satuan, Harga');
        }
      };
      reader.readAsBinaryString(file);
    }
    e.target.value = '';
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const materialPrintRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!materialPrintRef.current || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await downloadElementAsPdf(materialPrintRef.current, {
        filename: `Material_${currentProject?.name || 'Proyek'}_${currentPeriod?.name || ''}`,
        paperSize: 'A4-portrait',
      });
    } catch (err) {
      console.error('Gagal export PDF material:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = async () => {
    await triggerPrintWithPdfFallback({
      getElement: () => materialPrintRef.current,
      pdfOptions: {
        filename: `Material_${currentProject?.name || 'Proyek'}_${currentPeriod?.name || ''}`,
        paperSize: 'A4-portrait',
      },
    });
  };

  const visibleItemsCount = visibleGroups.reduce((sum, g) => sum + g.items.length, 0);
  const visibleTotal = visibleGroups.reduce((sum, g) => sum + g.subtotal, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Image Preview Modal */}
      {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print animate-in fade-in" onClick={() => setPreviewImage(null)}>
              <div className="relative max-w-3xl w-full">
                  <button 
                    onClick={() => setPreviewImage(null)}
                    className="absolute -top-12 right-0 text-white hover:text-gray-300 p-2"
                    aria-label="Tutup pratinjau foto"
                  >
                      <X className="w-8 h-8" />
                  </button>
                  <img src={previewImage} alt="Bukti Bon" className="w-full h-auto rounded-xl shadow-2xl ring-4 ring-white/10" />
              </div>
          </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Material</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Pencatatan material dipisahkan per nama tempat proyek</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap w-full xl:w-auto gap-2 md:gap-2.5">
             <button 
               onClick={handleDownloadTemplate}
               className="bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:hover:bg-brand-900/50 dark:text-brand-300 border border-brand-200 dark:border-brand-800 px-3 md:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-colors text-center whitespace-nowrap"
               title="Download Template Excel (termasuk kolom Tempat Proyek)"
             >
                <Download className="w-4 h-4 shrink-0" />
                <span>Template</span>
             </button>
             <label className="bg-accent-400 hover:bg-accent-500 text-brand-950 px-3 md:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-colors cursor-pointer text-center shadow-sm whitespace-nowrap">
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{isScanning ? 'Memproses...' : 'Scan Nota AI'}</span>
                <span className="md:hidden">{isScanning ? '...' : 'Scan'}</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanNota} disabled={isScanning} />
            </label>
             <label className="bg-brand-500 hover:bg-brand-600 text-white px-3 md:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-colors cursor-pointer text-center whitespace-nowrap">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">Import Excel</span>
                <span className="md:hidden">Import</span>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelImport} />
            </label>
            <button 
              onClick={handleDownloadPdf}
              disabled={isExportingPdf || visibleGroups.length === 0}
              className="bg-accent-400 hover:bg-accent-500 disabled:opacity-50 text-brand-950 px-3 md:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-colors whitespace-nowrap"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span>{isExportingPdf ? 'PDF...' : 'Download PDF'}</span>
            </button>
            <button 
              onClick={handlePrint}
              className="bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-3 md:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Cetak</span>
            </button>
            {onChangeView && (
              <button 
                onClick={() => onChangeView('consolidated_report')}
                className="bg-accent-100 hover:bg-accent-200 text-accent-900 dark:bg-accent-900/40 dark:hover:bg-accent-900/60 dark:text-accent-300 border border-accent-300 dark:border-accent-700 px-3 md:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-all shadow-sm whitespace-nowrap"
                title="Cetak Absensi, Gaji, Material, dan Invoice sekaligus dalam 1 Lembar"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>1 Lembar</span>
              </button>
            )}
            <button 
              onClick={() => openAddForm()}
              className="bg-brand-600 hover:bg-brand-700 text-white px-3 md:px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition-all shadow-lg shadow-brand-600/20 active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0 text-accent-300" />
              <span>Tambah</span>
            </button>
        </div>
      </div>

      <div ref={materialPrintRef} className="print:bg-white print:text-black">
      {/* Print Header */}
      <div className="hidden print-only mb-6 text-black bg-white">
          <h1 className="text-2xl font-bold uppercase text-black">{state.companyProfile.name}</h1>
          <h2 className="text-xl font-bold text-black">Laporan Material Per Tempat Proyek</h2>
          <p className="text-black">Proyek: {currentProject?.name} {currentPeriod ? `(${currentPeriod.name})` : ''}</p>
          {activeFilterLocationName && (
            <p className="font-semibold text-black">Filter Tempat: {activeFilterLocationName}</p>
          )}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl border border-brand-200 dark:border-brand-800/60 shadow-xl animate-in fade-in zoom-in-95 no-print mb-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                    <div className="bg-brand-100 dark:bg-brand-900/30 p-2 rounded-lg text-brand-700 dark:text-accent-400">
                        {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                    {editingId ? 'Edit Material & Tempat Proyek' : 'Input Material Baru'}
                </h3>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-700 p-2 rounded-lg transition-colors" aria-label="Tutup form">
                    <X className="w-5 h-5"/>
                </button>
            </div>
            <form onSubmit={handleSaveItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-600 dark:text-accent-400" />
                        Nama Tempat Proyek
                    </label>
                    <input 
                        type="text" 
                        list="material-locations-list"
                        placeholder="Contoh: Kandang A / Gudang Utama / Blok Timur"
                        className="w-full px-3 py-2.5 border border-brand-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={newItem.location || ''}
                        onChange={e => setNewItem({...newItem, location: e.target.value})}
                    />
                    <datalist id="material-locations-list">
                      {knownLocations.map(loc => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                    {knownLocations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Pilih cepat:</span>
                        {knownLocations.map(loc => {
                          const isChosen = normalizeMaterialLocation(newItem.location).toLowerCase() === loc.toLowerCase();
                          return (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => setNewItem({ ...newItem, location: loc })}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                                isChosen
                                  ? 'bg-brand-600 text-white border-brand-600'
                                  : 'bg-brand-50 dark:bg-gray-700 text-brand-800 dark:text-gray-200 border-brand-200 dark:border-gray-600 hover:bg-brand-100'
                              }`}
                            >
                              {loc}
                            </button>
                          );
                        })}
                      </div>
                    )}
                </div>
                <div className="col-span-1 lg:col-span-3">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Tanggal</label>
                    <input 
                        type="date" 
                        required
                        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        value={newItem.date}
                        onChange={e => setNewItem({...newItem, date: e.target.value})}
                    />
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-3">
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
                        onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 0})}
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
                
                <div className="col-span-1 md:col-span-2 lg:col-span-6">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">Foto Bukti Bon (Opsional)</label>
                    <div className="flex flex-wrap items-center gap-4 bg-gray-50 dark:bg-gray-900/30 p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
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

                <div className="col-span-1 md:col-span-2 lg:col-span-6 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button 
                        type="button"
                        onClick={closeForm}
                        className="w-full sm:w-auto px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-bold transition-colors text-center"
                    >
                        Batal
                    </button>
                    <button 
                        type="submit"
                        className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 text-white hover:bg-brand-700 rounded-xl text-sm font-bold shadow-lg shadow-brand-600/20 transition-all active:scale-95 text-center"
                    >
                        {editingId ? 'Simpan Perubahan' : 'Simpan Item'}
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* Location Filter Bar */}
      {groupedMaterials.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-brand-100 dark:border-gray-700 shadow-sm no-print">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-accent-400 mr-1">
              <MapPin className="w-4 h-4" />
              <span>Tempat Proyek:</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLocationKey(ALL_LOCATIONS_FILTER)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeLocationKey === ALL_LOCATIONS_FILTER
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-brand-50/70 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 border-brand-200/80 dark:border-gray-600 hover:bg-brand-100'
              }`}
            >
              <span>Semua Tempat</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  activeLocationKey === ALL_LOCATIONS_FILTER
                    ? 'bg-accent-400 text-brand-950'
                    : 'bg-white dark:bg-gray-800 text-brand-700 dark:text-accent-300'
                }`}
              >
                {materials.length}
              </span>
            </button>
            {groupedMaterials.map(group => {
              const isSelected = activeLocationKey === group.key;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedLocationKey(group.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-white dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-brand-300 hover:bg-brand-50/60'
                  }`}
                >
                  <span>{group.locationName}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      isSelected
                        ? 'bg-accent-400 text-brand-950'
                        : 'bg-accent-100 dark:bg-accent-900/40 text-accent-900 dark:text-accent-300'
                    }`}
                  >
                    {group.items.length}
                  </span>
                </button>
              );
            })}
          </div>
          {activeFilterLocationName && (
            <p className="mt-2 text-[11px] text-brand-700 dark:text-accent-300 font-medium">
              Menampilkan khusus tempat <strong>{activeFilterLocationName}</strong>. Klik <strong>Tambah</strong>, <strong>Scan</strong>, atau <strong>Import</strong> untuk otomatis memasukkan item ke tempat ini.
            </p>
          )}
        </div>
      )}

      {/* EMPTY STATE */}
      {materials.length === 0 && (
        <div className="text-center py-14 px-6 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-brand-200 dark:border-gray-700 no-print">
          <Archive className="w-12 h-12 text-brand-400 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-200 font-bold text-base">Belum ada data material pada periode ini.</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Klik tombol Tambah dan isi Nama Tempat Proyek agar daftar material otomatis dipisahkan per tempat.</p>
        </div>
      )}

      {/* MOBILE GROUPED CARD VIEW (Visible only on mobile) */}
      {visibleGroups.length > 0 && (
        <div className="md:hidden space-y-6 no-print">
          {visibleGroups.map(group => (
            <section key={group.key} className="space-y-3">
              {/* Mobile Location Header */}
              <div className="bg-brand-50 dark:bg-brand-900/25 border border-brand-200 dark:border-brand-800/60 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="bg-brand-600 text-accent-300 p-2 rounded-xl shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-accent-400">Nama Tempat Proyek</p>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{group.locationName}</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddForm(group.isDefault ? '' : group.locationName)}
                    className="bg-accent-400 hover:bg-accent-500 text-brand-950 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-brand-200/70 dark:border-brand-800/50 text-xs">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">{group.items.length} item tercatat</span>
                  <span className="font-bold text-brand-700 dark:text-accent-300 tabular-nums">
                    Subtotal: Rp {group.subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {group.items.map((item) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                           <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                               <Calendar className="w-3 h-3" />
                               {item.date}
                           </div>
                           <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight break-words">{item.itemName}</h4>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                           {item.receiptImage && (
                               <button 
                                   onClick={() => setPreviewImage(item.receiptImage || null)}
                                   className="p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-lg"
                                   title="Lihat Bon"
                               >
                                   <ImageIcon className="w-4 h-4" />
                               </button>
                           )}
                           <button 
                               onClick={() => openEditForm(item)}
                               className="p-2 bg-accent-100 dark:bg-accent-900/30 text-accent-800 dark:text-accent-300 rounded-lg"
                               title="Edit Item & Tempat"
                           >
                               <Edit2 className="w-4 h-4" />
                           </button>
                           <button 
                               onClick={() => handleDelete(item.id)}
                               className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg"
                               title="Hapus"
                           >
                               <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl">
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Harga Satuan</p>
                            <p className="text-sm font-medium dark:text-gray-300 tabular-nums">Rp {item.unitPrice.toLocaleString('id-ID')} <span className="text-xs text-gray-400">/ {item.unit}</span></p>
                        </div>
                        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Qty</p>
                            <p className="text-sm font-medium dark:text-gray-300 tabular-nums">{item.quantity} {item.unit}</p>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-100 dark:border-gray-700">
                        <span className="text-xs font-bold text-gray-400 uppercase">Total</span>
                        <span className="text-lg font-bold text-brand-600 dark:text-brand-400 tabular-nums">Rp {item.totalPrice.toLocaleString('id-ID')}</span>
                    </div>
                </div>
              ))}
            </section>
          ))}

          {/* Mobile Grand Summary */}
          <div className="bg-gradient-to-r from-brand-700 to-brand-600 text-white p-5 rounded-2xl shadow-lg shadow-brand-600/30 mt-4 border border-accent-400/40">
              <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-brand-100 block text-sm">
                      {activeFilterLocationName ? `Total ${activeFilterLocationName}` : 'Total Semua Tempat'}
                    </span>
                    <span className="text-xs text-brand-100/80">{visibleGroups.length} tempat • {visibleItemsCount} item</span>
                  </div>
                  <span className="text-xl font-bold text-accent-300 tabular-nums">Rp {visibleTotal.toLocaleString('id-ID')}</span>
              </div>
          </div>
        </div>
      )}

      {/* DESKTOP & PRINT GROUPED TABLE VIEW */}
      {visibleGroups.length > 0 && (
        <div className="hidden md:block space-y-6 print:block print:space-y-4 pdf-force-show">
          {visibleGroups.map(group => (
            <section
              key={group.key}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-brand-200/80 dark:border-gray-700 shadow-sm overflow-hidden print:border print:border-black print:rounded-none print:shadow-none print:break-inside-avoid"
            >
              {/* Location Section Header */}
              <div className="bg-brand-50/90 dark:bg-brand-900/25 px-5 py-3.5 border-b border-brand-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3 print:bg-gray-100 print:border-black print:py-2 print:px-3">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-600 text-accent-300 p-2 rounded-xl shadow-sm no-print">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:text-accent-400 print:text-black">
                      Nama Tempat Proyek
                    </p>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white print:text-black print:text-sm">
                        {group.locationName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent-100 text-accent-900 dark:bg-accent-900/40 dark:text-accent-300 print:bg-white print:border print:border-black print:text-black print:text-[10px]">
                        {group.items.length} item
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 print:text-black">
                      Subtotal Tempat
                    </span>
                    <span className="text-base font-bold text-brand-700 dark:text-accent-300 tabular-nums print:text-black print:text-sm">
                      Rp {group.subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddForm(group.isDefault ? '' : group.locationName)}
                    className="no-print bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    title={`Tambah material untuk ${group.locationName}`}
                  >
                    <Plus className="w-3.5 h-3.5 text-accent-300" />
                    <span>Tambah Item</span>
                  </button>
                </div>
              </div>

              {/* Table for this Location */}
              <table className="w-full text-sm text-left print:text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 uppercase text-xs font-bold print:bg-gray-200 print:text-black">
                      <tr>
                          <th className="px-4 py-3.5 w-12 text-center border-b border-gray-200 dark:border-gray-700 print:border-black print:py-2">No</th>
                          <th className="px-4 py-3.5 w-32 border-b border-gray-200 dark:border-gray-700 print:border-black print:py-2">Tanggal</th>
                          <th className="px-4 py-3.5 border-b border-gray-200 dark:border-gray-700 print:border-black print:py-2">Nama Barang</th>
                          <th className="px-4 py-3.5 w-20 text-center border-b border-gray-200 dark:border-gray-700 no-print">Bon</th>
                          <th className="px-4 py-3.5 w-20 text-center border-b border-gray-200 dark:border-gray-700 print:border-black print:py-2">Qty</th>
                          <th className="px-4 py-3.5 w-24 border-b border-gray-200 dark:border-gray-700 print:border-black print:py-2">Satuan</th>
                          <th className="px-4 py-3.5 text-right border-b border-gray-200 dark:border-gray-700 print:border-black print:py-2">Harga</th>
                          <th className="px-4 py-3.5 text-right border-b border-gray-200 dark:border-gray-700 print:border-black print:py-2">Total</th>
                          <th className="px-4 py-3.5 w-24 text-center border-b border-gray-200 dark:border-gray-700 no-print">Aksi</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-300">
                      {group.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors print:hover:bg-transparent">
                              <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400 print:text-black print:py-1.5">{idx + 1}</td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium print:text-black print:py-1.5">{item.date}</td>
                              <td className="px-4 py-3 font-bold text-gray-900 dark:text-white print:text-black print:py-1.5">{item.itemName}</td>
                              <td className="px-4 py-3 text-center no-print">
                                  {item.receiptImage ? (
                                      <button 
                                          onClick={() => setPreviewImage(item.receiptImage || null)}
                                          className="inline-block transition-transform hover:scale-110"
                                          title="Lihat foto bon"
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
                              <td className="px-4 py-3 text-center dark:text-gray-300 tabular-nums print:text-black print:py-1.5">{item.quantity}</td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 print:text-black print:py-1.5">{item.unit}</td>
                              <td className="px-4 py-3 text-right dark:text-gray-300 tabular-nums print:text-black print:py-1.5">Rp {item.unitPrice.toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white tabular-nums print:text-black print:py-1.5">Rp {item.totalPrice.toLocaleString('id-ID')}</td>
                              <td className="px-4 py-3 text-center no-print">
                                  <div className="flex items-center justify-center gap-1">
                                    <button 
                                        onClick={() => openEditForm(item)}
                                        className="text-brand-700 hover:text-brand-900 dark:text-accent-400 dark:hover:text-accent-300 p-1.5 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors"
                                        title="Edit Item / Tempat Proyek"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)}
                                        className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Hapus Item"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-accent-50/70 dark:bg-gray-700/50 border-t border-brand-100 dark:border-gray-600 print:bg-white print:border-t print:border-black">
                      <tr>
                          <td colSpan={7} className="px-4 py-3 text-right font-bold text-gray-800 dark:text-gray-200 uppercase text-xs tracking-wide print:text-black">
                            Subtotal {group.locationName}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-brand-700 dark:text-accent-300 tabular-nums print:text-black">
                              Rp {group.subtotal.toLocaleString('id-ID')}
                          </td>
                          <td className="no-print"></td>
                      </tr>
                  </tfoot>
              </table>
            </section>
          ))}

          {/* Grand Total Bar */}
          <div className="bg-gradient-to-r from-brand-800 to-brand-600 dark:from-brand-950 dark:to-brand-800 text-white rounded-2xl px-6 py-4 shadow-md border border-accent-400/30 flex items-center justify-between print:bg-white print:bg-none print:text-black print:border-2 print:border-black print:rounded-none print:shadow-none">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">
                {activeFilterLocationName ? `Total Tempat: ${activeFilterLocationName}` : 'Total Seluruh Tempat Proyek'}
              </p>
              <p className="text-xs text-brand-100 print:text-black">
                {visibleGroups.length} tempat proyek • {visibleItemsCount} item material
              </p>
            </div>
            <p className="text-xl md:text-2xl font-bold text-accent-300 tabular-nums print:text-black">
              Rp {visibleTotal.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      )}

      <div className="hidden print-only-flex mt-12 justify-end text-black">
         <div className="text-center w-48">
            <p className="mb-2">Mengetahui,</p>
            {state.companyProfile.signature ? (
                <img src={state.companyProfile.signature} alt="Tanda Tangan" className="h-32 mx-auto mb-2" />
            ) : (
                <div className="h-32" />
            )}
            <p className="font-bold underline">{state.companyProfile.director}</p>
         </div>
      </div>
      </div>
    </div>
  );
};