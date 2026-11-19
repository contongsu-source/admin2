import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSafePdfFilename,
  calculatePdfPageSlices,
  getPaperDimensionsMm,
  shouldUsePdfFallbackForPrint,
} from './pdfLayout';

test('getPaperDimensionsMm returns accurate dimensions and orientation', () => {
  const a4 = getPaperDimensionsMm('A4-portrait');
  assert.equal(a4.widthMm, 210);
  assert.equal(a4.heightMm, 297);
  assert.equal(a4.orientation, 'portrait');

  const a4Land = getPaperDimensionsMm('A4-landscape');
  assert.equal(a4Land.widthMm, 297);
  assert.equal(a4Land.heightMm, 210);
  assert.equal(a4Land.orientation, 'landscape');

  const f4 = getPaperDimensionsMm('F4');
  assert.equal(f4.widthMm, 215);
  assert.equal(f4.heightMm, 330);

  const a5Land = getPaperDimensionsMm('A5-landscape');
  assert.equal(a5Land.widthMm, 210);
  assert.equal(a5Land.heightMm, 148);
  assert.equal(a5Land.orientation, 'landscape');
});

test('buildSafePdfFilename sanitizes invalid chars and appends .pdf once', () => {
  assert.equal(
    buildSafePdfFilename('Laporan Terpadu', 'KANDANGAN / Blok A:1'),
    'Laporan_Terpadu_KANDANGAN_-_Blok_A-1.pdf'
  );
  assert.equal(buildSafePdfFilename('Nota_Penjualan.pdf'), 'Nota_Penjualan.pdf');
  assert.equal(buildSafePdfFilename('   '), 'Dokumen_SBM.pdf');
});

test('calculatePdfPageSlices fits slightly tall single-page report into 1 page when preferSinglePage=true', () => {
  const a4 = getPaperDimensionsMm('A4-portrait');
  // Width 1000px -> contentWidthMm = 194mm -> contentHeightMm = 281mm
  // Height 1650px -> naturalHeightMm = 320.1mm (within 1.28x of 281mm = 359.68mm)
  const plan = calculatePdfPageSlices({
    imageWidthPx: 1000,
    imageHeightPx: 1650,
    paper: a4,
    preferSinglePage: true,
  });
  assert.equal(plan.fitToSinglePage, true);
  assert.equal(plan.slices.length, 1);
  assert.ok(plan.slices[0].destHeightMm <= a4.heightMm - a4.marginMm * 2 + 0.01);
});

test('calculatePdfPageSlices splits multi-page content cleanly without losing pixels', () => {
  const a4 = getPaperDimensionsMm('A4-portrait');
  const plan = calculatePdfPageSlices({
    imageWidthPx: 1000,
    imageHeightPx: 3500,
    paper: a4,
    preferSinglePage: false,
  });
  assert.equal(plan.fitToSinglePage, false);
  assert.ok(plan.slices.length >= 2);
  const totalCoveredPx = plan.slices.reduce((acc, s) => acc + s.srcHeight, 0);
  assert.equal(totalCoveredPx, 3500);
});

test('shouldUsePdfFallbackForPrint detects blocked iframe print synchronously', () => {
  assert.equal(
    shouldUsePdfFallbackForPrint({ inIframe: true, beforePrintFired: false, printDurationMs: 2 }),
    true
  );
  assert.equal(
    shouldUsePdfFallbackForPrint({ inIframe: true, beforePrintFired: true, printDurationMs: 2 }),
    false
  );
  assert.equal(
    shouldUsePdfFallbackForPrint({ inIframe: false, beforePrintFired: false, printDurationMs: 1 }),
    false
  );
});
