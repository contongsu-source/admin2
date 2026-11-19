import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MATERIAL_LOCATION,
  DEFAULT_LOCATION_KEY,
  extractUniqueMaterialLocations,
  formatMaterialDate,
  getLocationGroupKey,
  groupMaterialsByLocation,
  normalizeMaterialLocation,
  parseMaterialExcelRow,
} from './materialUtils.ts';
import { MaterialItem, prepareStateForSync } from './types.ts';

const sampleMaterials: MaterialItem[] = [
  {
    id: 'm1',
    date: '2026-02-10',
    itemName: 'KABEL BIASA 45 METER',
    quantity: 1,
    unit: 'ROLL',
    unitPrice: 100000,
    totalPrice: 100000,
    location: 'Kandang A',
  },
  {
    id: 'm2',
    date: '2026-02-10',
    itemName: 'AQUA GALON',
    quantity: 1,
    unit: 'GALON',
    unitPrice: 20000,
    totalPrice: 20000,
  },
  {
    id: 'm3',
    date: '2026-02-11',
    itemName: 'SEMEN GRESIK',
    quantity: 5,
    unit: 'ZAK',
    unitPrice: 60000,
    totalPrice: 300000,
    location: ' kandang a ',
  },
  {
    id: 'm4',
    date: '2026-02-12',
    itemName: 'PAKU USUK',
    quantity: 2,
    unit: 'KG',
    unitPrice: 25000,
    totalPrice: 50000,
    location: 'Gudang Utama',
  },
];

test('normalizeMaterialLocation trims and handles undefined', () => {
  assert.equal(normalizeMaterialLocation(undefined), '');
  assert.equal(normalizeMaterialLocation('   '), '');
  assert.equal(normalizeMaterialLocation('  Kandang A  '), 'Kandang A');
});

test('getLocationGroupKey normalizes case and falls back to default key', () => {
  assert.equal(getLocationGroupKey('Kandang A'), 'kandang a');
  assert.equal(getLocationGroupKey('  kandang a '), 'kandang a');
  assert.equal(getLocationGroupKey(''), DEFAULT_LOCATION_KEY);
  assert.equal(getLocationGroupKey(undefined), DEFAULT_LOCATION_KEY);
});

test('groupMaterialsByLocation separates items per location, computes subtotals, and places default last', () => {
  const groups = groupMaterialsByLocation(sampleMaterials);
  assert.equal(groups.length, 3);

  assert.equal(groups[0].locationName, 'Gudang Utama');
  assert.equal(groups[0].isDefault, false);
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[0].subtotal, 50000);

  assert.equal(groups[1].locationName, 'Kandang A');
  assert.equal(groups[1].isDefault, false);
  assert.equal(groups[1].items.length, 2);
  assert.equal(groups[1].subtotal, 400000);

  assert.equal(groups[2].locationName, DEFAULT_MATERIAL_LOCATION);
  assert.equal(groups[2].isDefault, true);
  assert.equal(groups[2].items.length, 1);
  assert.equal(groups[2].subtotal, 20000);
});

test('extractUniqueMaterialLocations deduplicates case-insensitively and sorts', () => {
  const locations = extractUniqueMaterialLocations(sampleMaterials);
  assert.deepEqual(locations, ['Gudang Utama', 'Kandang A']);
});

test('parseMaterialExcelRow parses Tempat Proyek column and falls back cleanly', () => {
  const withPlace = parseMaterialExcelRow(
    {
      Tanggal: '2026-03-20',
      'Tempat Proyek': 'Blok Timur',
      Barang: 'Besi 10mm',
      Qty: 4,
      Satuan: 'BTG',
      Harga: 75000,
    },
    'Fallback Site',
    '2026-03-01'
  );
  assert.deepEqual(withPlace, {
    date: '2026-03-20',
    itemName: 'Besi 10mm',
    quantity: 4,
    unit: 'BTG',
    unitPrice: 75000,
    totalPrice: 300000,
    location: 'Blok Timur',
  });

  const withoutPlace = parseMaterialExcelRow(
    {
      Barang: 'Pasir',
      Qty: 1,
      Harga: 500000,
    },
    'Lokasi B',
    '2026-03-01'
  );
  assert.equal(withoutPlace?.location, 'Lokasi B');
  assert.equal(withoutPlace?.date, '2026-03-01');
  assert.equal(withoutPlace?.unit, 'PCS');

  const noPlaceAtAll = parseMaterialExcelRow({ Barang: 'Cat', Harga: 0 }, '', '2026-03-01');
  assert.equal('location' in (noPlaceAtAll || {}), false);
  assert.equal(noPlaceAtAll?.totalPrice, 0);
});

test('prepareStateForSync strips receiptImage and undefined fields for Firestore', () => {
  const synced = prepareStateForSync({
    companyProfile: { name: 'CV', address: '', director: '', city: '' },
    projects: [],
    periods: [],
    employees: [],
    attendance: {},
    materials: {
      p1: [
        {
          id: '1',
          date: '2026-02-10',
          itemName: 'Semen',
          quantity: 1,
          unit: 'ZAK',
          unitPrice: 60000,
          totalPrice: 60000,
          location: undefined,
          receiptImage: 'data:image/png;base64,abc',
        },
      ],
    },
    pettyCash: {},
    incomingFunds: {},
    rab: {},
    currentProjectId: 'proj1',
  });

  const item = synced.materials.p1[0];
  assert.equal('receiptImage' in item, false);
  assert.equal('location' in item, false);
});

test('formatMaterialDate formats ISO and DMY dates into DD/MM/YYYY', () => {
  assert.equal(formatMaterialDate('2026-02-10'), '10/02/2026');
  assert.equal(formatMaterialDate('2026-2-5'), '05/02/2026');
  assert.equal(formatMaterialDate('5/2/2026'), '05/02/2026');
  assert.equal(formatMaterialDate(''), '-');
  assert.equal(formatMaterialDate(undefined), '-');
});

test('parseMaterialExcelRow normalizes DD/MM/YYYY Excel dates to ISO YYYY-MM-DD', () => {
  const parsed = parseMaterialExcelRow({
    Tanggal: '20/03/2026',
    Barang: 'Paku',
    Qty: 2,
    Harga: 15000,
  });
  assert.equal(parsed?.date, '2026-03-20');
});
