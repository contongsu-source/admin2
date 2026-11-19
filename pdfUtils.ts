import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  PdfPaperSize,
  buildSafePdfFilename,
  calculatePdfPageSlices,
  getPaperDimensionsMm,
  shouldUsePdfFallbackForPrint,
} from './pdfLayout';

export {
  buildSafePdfFilename,
  getPaperDimensionsMm,
  type PdfPaperSize,
} from './pdfLayout';

export interface DownloadPdfOptions {
  filename?: string;
  paperSize?: PdfPaperSize;
  preferSinglePage?: boolean;
  minCaptureWidthPx?: number;
}

function waitForPaintFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const baseOptions = {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    cacheBust: false,
  };

  try {
    return await toCanvas(element, baseOptions);
  } catch (err) {
    console.warn('toCanvas retry with skipFonts=true:', err);
    return await toCanvas(element, {
      ...baseOptions,
      skipFonts: true,
    });
  }
}

export async function downloadElementAsPdf(
  element: HTMLElement | null,
  options: DownloadPdfOptions = {}
): Promise<{ filename: string; pages: number }> {
  if (!element) {
    throw new Error('Elemen laporan tidak ditemukan untuk dicetak.');
  }

  const paperSize = options.paperSize ?? 'A4-portrait';
  const paper = getPaperDimensionsMm(paperSize);
  const filename = buildSafePdfFilename(options.filename || 'Laporan_SBM');

  const htmlEl = document.documentElement;
  const hadDarkClass = htmlEl.classList.contains('dark');
  const prevWidth = element.style.width;
  const prevMinWidth = element.style.minWidth;
  const prevMaxWidth = element.style.maxWidth;
  const prevBg = element.style.backgroundColor;
  const prevColor = element.style.color;

  if (hadDarkClass) {
    htmlEl.classList.remove('dark');
  }
  htmlEl.classList.add('pdf-capturing');

  try {
    await waitForPaintFrames();

    const targetMinWidth =
      options.minCaptureWidthPx ??
      (paper.orientation === 'landscape' ? 1040 : paperSize.startsWith('A5') ? 680 : 820);

    const measuredRect = element.getBoundingClientRect();
    if (measuredRect.width < targetMinWidth) {
      element.style.width = `${targetMinWidth}px`;
      element.style.minWidth = `${targetMinWidth}px`;
      element.style.maxWidth = `${targetMinWidth}px`;
    }
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#000000';

    await waitForPaintFrames();

    const fullCanvas = await renderElementToCanvas(element);
    if (fullCanvas.width === 0 || fullCanvas.height === 0) {
      throw new Error('Konten dokumen kosong saat membuat PDF.');
    }

    const plan = calculatePdfPageSlices({
      imageWidthPx: fullCanvas.width,
      imageHeightPx: fullCanvas.height,
      paper,
      preferSinglePage: options.preferSinglePage,
    });

    if (plan.slices.length === 0) {
      throw new Error('Gagal membagi halaman PDF.');
    }

    const pdf = new jsPDF({
      orientation: paper.orientation,
      unit: 'mm',
      format: [paper.widthMm, paper.heightMm],
      compress: true,
    });

    const sliceCanvas = document.createElement('canvas');
    const sliceCtx = sliceCanvas.getContext('2d');
    if (!sliceCtx) {
      throw new Error('Canvas 2D context tidak tersedia.');
    }

    for (const slice of plan.slices) {
      if (slice.pageIndex > 0) {
        pdf.addPage([paper.widthMm, paper.heightMm], paper.orientation);
      }

      sliceCanvas.width = fullCanvas.width;
      sliceCanvas.height = slice.srcHeight;

      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        fullCanvas,
        0,
        slice.srcY,
        fullCanvas.width,
        slice.srcHeight,
        0,
        0,
        fullCanvas.width,
        slice.srcHeight
      );

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(
        imgData,
        'JPEG',
        paper.marginMm,
        paper.marginMm,
        slice.destWidthMm,
        slice.destHeightMm,
        undefined,
        'FAST'
      );
    }

    pdf.save(filename);
    return { filename, pages: plan.slices.length };
  } finally {
    element.style.width = prevWidth;
    element.style.minWidth = prevMinWidth;
    element.style.maxWidth = prevMaxWidth;
    element.style.backgroundColor = prevBg;
    element.style.color = prevColor;
    htmlEl.classList.remove('pdf-capturing');
    if (hadDarkClass) {
      htmlEl.classList.add('dark');
    }
  }
}

export async function triggerPrintWithPdfFallback(options: {
  getElement?: () => HTMLElement | null;
  pdfOptions?: DownloadPdfOptions;
}): Promise<'printed' | 'downloaded-pdf'> {
  let beforePrintFired = false;
  const onBeforePrint = () => {
    beforePrintFired = true;
  };
  window.addEventListener('beforeprint', onBeforePrint);

  const start = performance.now();
  let printThrew = false;

  try {
    window.print();
  } catch {
    printThrew = true;
  } finally {
    window.removeEventListener('beforeprint', onBeforePrint);
  }

  const elapsed = performance.now() - start;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  const needsFallback =
    printThrew ||
    shouldUsePdfFallbackForPrint({
      inIframe,
      beforePrintFired,
      printDurationMs: elapsed,
    });

  if (needsFallback && options.getElement) {
    const el = options.getElement();
    if (el) {
      await downloadElementAsPdf(el, options.pdfOptions);
      return 'downloaded-pdf';
    }
  }

  return 'printed';
}

export async function printReactIframeWithPdfFallback(
  target: HTMLIFrameElement,
  options: {
    getElement?: () => HTMLElement | null;
    pdfOptions?: DownloadPdfOptions;
  }
): Promise<void> {
  const cw = target.contentWindow;
  let beforePrintFired = false;
  const onBeforePrint = () => {
    beforePrintFired = true;
  };
  cw?.addEventListener('beforeprint', onBeforePrint);

  const start = performance.now();
  let printThrew = false;

  try {
    cw?.focus();
    cw?.print();
  } catch {
    printThrew = true;
  } finally {
    cw?.removeEventListener('beforeprint', onBeforePrint);
  }

  const elapsed = performance.now() - start;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  const needsFallback =
    printThrew ||
    shouldUsePdfFallbackForPrint({
      inIframe,
      beforePrintFired,
      printDurationMs: elapsed,
    });

  if (needsFallback && options.getElement) {
    const el = options.getElement();
    if (el) {
      await downloadElementAsPdf(el, options.pdfOptions);
    }
  }
}
