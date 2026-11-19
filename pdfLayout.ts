export type PdfPaperSize =
  | 'A4'
  | 'A4-portrait'
  | 'A4-landscape'
  | 'F4'
  | 'A5-portrait'
  | 'A5-landscape';

export interface PaperDimensions {
  widthMm: number;
  heightMm: number;
  orientation: 'portrait' | 'landscape';
  marginMm: number;
  cssPageSize: string;
}

export interface PdfSlice {
  pageIndex: number;
  srcY: number;
  srcHeight: number;
  destWidthMm: number;
  destHeightMm: number;
}

export interface PdfPaginationPlan {
  slices: PdfSlice[];
  fitToSinglePage: boolean;
}

export function getPaperDimensionsMm(paperSize: PdfPaperSize = 'A4-portrait'): PaperDimensions {
  switch (paperSize) {
    case 'A4-landscape':
      return {
        widthMm: 297,
        heightMm: 210,
        orientation: 'landscape',
        marginMm: 6,
        cssPageSize: 'A4 landscape',
      };
    case 'F4':
      return {
        widthMm: 215,
        heightMm: 330,
        orientation: 'portrait',
        marginMm: 7,
        cssPageSize: '215mm 330mm',
      };
    case 'A5-landscape':
      return {
        widthMm: 210,
        heightMm: 148,
        orientation: 'landscape',
        marginMm: 6,
        cssPageSize: 'A5 landscape',
      };
    case 'A5-portrait':
      return {
        widthMm: 148,
        heightMm: 210,
        orientation: 'portrait',
        marginMm: 6,
        cssPageSize: 'A5 portrait',
      };
    case 'A4':
    case 'A4-portrait':
    default:
      return {
        widthMm: 210,
        heightMm: 297,
        orientation: 'portrait',
        marginMm: 8,
        cssPageSize: 'A4 portrait',
      };
  }
}

export function buildSafePdfFilename(baseName: string, detail?: string): string {
  const clean = (val: string) =>
    val
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[_-]+|[_-]+$/g, '');

  const parts = [clean(baseName), detail ? clean(detail) : ''].filter(Boolean);
  const stem = parts.length > 0 ? parts.join('_') : 'Dokumen_SBM';
  return stem.toLowerCase().endsWith('.pdf') ? stem : `${stem}.pdf`;
}

export function calculatePdfPageSlices(params: {
  imageWidthPx: number;
  imageHeightPx: number;
  paper: PaperDimensions;
  preferSinglePage?: boolean;
}): PdfPaginationPlan {
  const { imageWidthPx, imageHeightPx, paper, preferSinglePage = false } = params;

  if (imageWidthPx <= 0 || imageHeightPx <= 0) {
    return { slices: [], fitToSinglePage: false };
  }

  const contentWidthMm = Math.max(10, paper.widthMm - paper.marginMm * 2);
  const contentHeightMm = Math.max(10, paper.heightMm - paper.marginMm * 2);

  const naturalHeightMm = (imageHeightPx / imageWidthPx) * contentWidthMm;
  const singlePageTolerance = preferSinglePage ? 1.28 : 1.03;

  if (naturalHeightMm <= contentHeightMm * singlePageTolerance) {
    const scale = naturalHeightMm > contentHeightMm ? contentHeightMm / naturalHeightMm : 1;
    return {
      fitToSinglePage: true,
      slices: [
        {
          pageIndex: 0,
          srcY: 0,
          srcHeight: imageHeightPx,
          destWidthMm: Number((contentWidthMm * scale).toFixed(2)),
          destHeightMm: Number((naturalHeightMm * scale).toFixed(2)),
        },
      ],
    };
  }

  const pxPerMm = imageWidthPx / contentWidthMm;
  const maxSliceHeightPx = Math.max(1, Math.floor(contentHeightMm * pxPerMm));
  const slices: PdfSlice[] = [];

  let offsetY = 0;
  let pageIndex = 0;
  while (offsetY < imageHeightPx) {
    const remaining = imageHeightPx - offsetY;
    const srcHeight = Math.min(maxSliceHeightPx, remaining);
    const destHeightMm = Number(((srcHeight / imageWidthPx) * contentWidthMm).toFixed(2));
    slices.push({
      pageIndex,
      srcY: offsetY,
      srcHeight,
      destWidthMm: Number(contentWidthMm.toFixed(2)),
      destHeightMm,
    });
    offsetY += srcHeight;
    pageIndex += 1;
  }

  return {
    fitToSinglePage: false,
    slices,
  };
}

export function shouldUsePdfFallbackForPrint(env: {
  inIframe: boolean;
  beforePrintFired: boolean;
  printDurationMs: number;
}): boolean {
  if (env.beforePrintFired) return false;
  if (env.inIframe && env.printDurationMs < 50) return true;
  return false;
}
