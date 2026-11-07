import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { Metric } from './demo/insights';
import type { Currency } from './money';
export async function downloadInsightsPdf(title: string, context: string[], metrics: Metric[], currency: Currency) {
  const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]); let y = 790;
  const text = (value: string, size = 11, strong = false) => { if (y < 60) { page = pdf.addPage([595, 842]); y = 790; } page.drawText(value.replace(/[^\x20-\x7E]/g, '-').slice(0, 94), { x: 42, y, size, font: strong ? bold : font }); y -= size + 12; };
  text(`GRIV | ${title}`, 20, true); context.forEach(line => text(line)); y -= 15;
  for (const m of metrics) { const value = m.value === null ? 'Unavailable' : m.unit === 'money' ? `${currency} ${m.value.toFixed(2)}` : m.unit === 'rate' ? `${m.value.toFixed(1)}%` : String(m.value); text(`${m.label}: ${value}`, 12, true); if (m.previous != null) text(`Previous period: ${m.previous.toFixed(2)} (${m.unit})`); const words = m.definition.split(' '); let line = ''; for (const word of words) { if ((line + word).length > 88) { text(line, 9); line = ''; } line += `${word} `; } if (line) text(line, 9); y -= 8; }
  const bytes = await pdf.save(); const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = 'griv-insights-summary.pdf'; a.click(); URL.revokeObjectURL(url);
}
