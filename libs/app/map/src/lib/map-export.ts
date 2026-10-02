import type { MapExportImage } from './map.model';

/** What the user ticks in the export dialog (B1 5.4.6: every extra can be left out). */
export interface MapExportOptions {
  format: 'pdf' | 'image';
  dpi: number;
  title: boolean;
  copyright: boolean;
  date: boolean;
  disclaimer: boolean;
  scale: boolean;
  center: boolean;
}

/** The texts of the extras, already translated and formatted by the viewer. */
export interface MapExportTexts {
  title: string;
  copyright: string;
  date: string;
  disclaimer: string;
  scale: string;
  center: string;
  fileName: string;
}

/** A4 landscape, in mm. */
const PAGE = { width: 297, height: 210, margin: 10, titleHeight: 10, lineHeight: 5, gap: 3 };

export interface MapExportLayout {
  mapWidthMm: number;
  mapHeightMm: number;
  /** Top edge of the map on the page. */
  mapTopMm: number;
  /** Footer lines below the map, in order. */
  footer: ('scale-center' | 'date-copyright' | 'disclaimer')[];
}

/** Page layout for the chosen extras: the map takes what title and footer lines leave. */
export function exportLayout(options: MapExportOptions): MapExportLayout {
  const footer: MapExportLayout['footer'] = [];
  if (options.scale || options.center) footer.push('scale-center');
  if (options.date || options.copyright) footer.push('date-copyright');
  if (options.disclaimer) footer.push('disclaimer');
  const top = PAGE.margin + (options.title ? PAGE.titleHeight : 0);
  const footerHeight = footer.length ? PAGE.gap + footer.length * PAGE.lineHeight : 0;
  return {
    mapWidthMm: PAGE.width - 2 * PAGE.margin,
    mapHeightMm: PAGE.height - top - PAGE.margin - footerHeight,
    mapTopMm: top,
    footer,
  };
}

/** The footer lines as text, left and right part («Massstab 1:5’000» | «Zentrum 2’618’420, 1’176’900»). */
export function footerLines(options: MapExportOptions, texts: MapExportTexts): { left: string; right: string }[] {
  return exportLayout(options).footer.map((line) => {
    if (line === 'scale-center') return { left: options.scale ? texts.scale : '', right: options.center ? texts.center : '' };
    if (line === 'date-copyright') return { left: options.date ? texts.date : '', right: options.copyright ? texts.copyright : '' };
    return { left: texts.disclaimer, right: '' };
  });
}

/** PDF (A4 landscape) with the map and the chosen extras; jsPDF is loaded on demand. */
export async function saveMapPdf(image: MapExportImage, options: MapExportOptions, texts: MapExportTexts): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const layout = exportLayout(options);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  if (options.title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(texts.title, PAGE.margin, PAGE.margin + 6);
  }
  doc.addImage(image.dataUrl, 'JPEG', PAGE.margin, layout.mapTopMm, layout.mapWidthMm, layout.mapHeightMm);
  doc.setDrawColor(120);
  doc.rect(PAGE.margin, layout.mapTopMm, layout.mapWidthMm, layout.mapHeightMm);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = layout.mapTopMm + layout.mapHeightMm + PAGE.gap + 3;
  for (const line of footerLines(options, texts)) {
    if (line.left) doc.text(line.left, PAGE.margin, y, { maxWidth: line.right ? layout.mapWidthMm / 2 : layout.mapWidthMm });
    if (line.right) doc.text(line.right, PAGE.width - PAGE.margin, y, { align: 'right' });
    y += PAGE.lineHeight;
  }
  doc.save(`${texts.fileName}.pdf`);
}

/** The map alone as JPEG file. */
export function saveMapImage(image: MapExportImage, fileName: string): void {
  const link = document.createElement('a');
  link.href = image.dataUrl;
  link.download = `${fileName}.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
