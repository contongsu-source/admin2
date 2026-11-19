import { MaterialItem } from './types';

export const DEFAULT_MATERIAL_LOCATION = 'Umum / Tanpa Tempat';
export const DEFAULT_LOCATION_KEY = '__default__';
export const ALL_LOCATIONS_FILTER = '__ALL__';

export interface MaterialLocationGroup {
  key: string;
  locationName: string;
  isDefault: boolean;
  items: MaterialItem[];
  subtotal: number;
}

export function normalizeMaterialLocation(location?: string): string {
  return (location || '').trim();
}

export function getLocationGroupKey(location?: string): string {
  const normalized = normalizeMaterialLocation(location);
  return normalized ? normalized.toLowerCase() : DEFAULT_LOCATION_KEY;
}

export function formatMaterialDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const trimmed = String(dateStr).trim();
  if (!trimmed) return '-';

  // Match YYYY-MM-DD (or YYYY-MM-DDTHH:mm:ss...)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  // Match DD/MM/YYYY or D/M/YYYY (or DD-MM-YYYY)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return trimmed;
}

export function normalizeMaterialDateInput(rawDate: unknown, fallbackDate?: string): string {
  if (rawDate !== undefined && rawDate !== null) {
    const trimmed = String(rawDate).trim();
    if (trimmed) {
      const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return trimmed;
    }
  }
  return fallbackDate || new Date().toISOString().split('T')[0];
}

export function groupMaterialsByLocation(materials: MaterialItem[]): MaterialLocationGroup[] {
  const map = new Map<string, MaterialLocationGroup>();

  for (const item of materials) {
    const normalized = normalizeMaterialLocation(item.location);
    const key = normalized ? normalized.toLowerCase() : DEFAULT_LOCATION_KEY;
    const isDefault = key === DEFAULT_LOCATION_KEY;

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        locationName: isDefault ? DEFAULT_MATERIAL_LOCATION : normalized,
        isDefault,
        items: [],
        subtotal: 0,
      };
      map.set(key, group);
    }

    group.items.push(item);
    group.subtotal += item.totalPrice || 0;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? 1 : -1;
    }
    return a.locationName.localeCompare(b.locationName, 'id-ID');
  });
}

export function extractUniqueMaterialLocations(materials: MaterialItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of materials) {
    const normalized = normalizeMaterialLocation(item.location);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, normalized);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'id-ID'));
}

export function parseMaterialExcelRow(
  row: Record<string, any>,
  fallbackLocation?: string,
  fallbackDate?: string
): Omit<MaterialItem, 'id'> | null {
  const itemNameRaw = row.Barang ?? row['Nama Barang'] ?? row.itemName;
  const itemName = typeof itemNameRaw === 'string' ? itemNameRaw.trim() : String(itemNameRaw || '').trim();
  const rawPrice = row.Harga ?? row['Harga Satuan'] ?? row.unitPrice;

  if (!itemName || rawPrice === undefined || rawPrice === null || rawPrice === '') {
    return null;
  }

  const qty = Number(row.Qty ?? row.Jumlah ?? row.quantity) || 1;
  const price = Number(rawPrice) || 0;
  const rawUnit = row.Satuan ?? row.unit;
  const unit = rawUnit ? String(rawUnit).trim() : 'PCS';
  const rawDate = row.Tanggal ?? row.date;
  const date = normalizeMaterialDateInput(rawDate, fallbackDate);
  const rawLocation = row['Tempat Proyek'] ?? row.Tempat ?? row['Nama Tempat'] ?? row.Lokasi ?? row.location;
  const location = normalizeMaterialLocation(rawLocation ? String(rawLocation) : fallbackLocation);

  const parsed: Omit<MaterialItem, 'id'> = {
    date,
    itemName,
    quantity: qty,
    unit,
    unitPrice: price,
    totalPrice: qty * price,
  };

  if (location) {
    parsed.location = location;
  }

  return parsed;
}
