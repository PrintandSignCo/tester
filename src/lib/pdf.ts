import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { companyProfile } from "@/lib/company";
import type { PrintableInvoice, PrintableQuote } from "@/lib/documents";
import { formatDateAU, moneyPlain } from "@/lib/format";

const ink = rgb(0.08, 0.12, 0.18);
const muted = rgb(0.33, 0.38, 0.44);
const amber = rgb(0.78, 0.52, 0.07);
const line = rgb(0.82, 0.78, 0.7);

export async function renderQuotePdf(quote: PrintableQuote): Promise<Uint8Array> {
  const company = companyProfile();
  return renderDocument({
    kicker: "QUOTATION",
    title: company.name,
    meta: [
      ["Quote no.", quote.number],
      ["Date", formatDateAU(quote.date)],
      ["Prepared for", quote.customer],
    ],
    columns: ["Description", "Qty", "Amount ex GST"],
    rows: quote.lines.map((item) => [
      item.note ? `${item.description}\n${item.note}` : item.description,
      String(item.qty),
      moneyPlain(item.amount),
    ]),
    totals: [
      ["Subtotal", moneyPlain(quote.subtotal)],
      ["GST 10%", moneyPlain(quote.gst)],
      ["Total AUD", moneyPlain(quote.total)],
    ],
    footer: "Amounts are in Australian dollars. This quotation is valid for 14 days. GST is 10%.",
  });
}

export async function renderInvoicePdf(invoice: PrintableInvoice): Promise<Uint8Array> {
  const company = companyProfile();
  return renderDocument({
    kicker: company.abn ? "TAX INVOICE" : "INVOICE",
    title: company.name,
    meta: [
      ["Invoice no.", invoice.number],
      ["Issue date", formatDateAU(invoice.issueDate)],
      ["Due date", formatDateAU(invoice.dueDate)],
      ["Terms", invoice.terms],
      ["Job", invoice.jobNumber],
      ["Quote", invoice.quoteNumber || "—"],
      ["Bill to", invoice.customer],
    ],
    columns: ["Description", "Qty", "Unit ex GST", "Amount ex GST"],
    rows: invoice.lines.map((item) => [
      item.description,
      String(item.qty),
      moneyPlain(item.unitAmount),
      moneyPlain(item.amount),
    ]),
    totals: [
      ["Subtotal", moneyPlain(invoice.subtotal)],
      ["GST 10%", moneyPlain(invoice.gst)],
      ["Total due", moneyPlain(invoice.total)],
    ],
    footer: `Payment terms: ${invoice.terms}. Amounts are in Australian dollars and exclude GST until the total.${company.abn ? ` ABN ${company.abn}.` : ""}`,
  });
}

async function renderDocument(input: {
  kicker: string;
  title: string;
  meta: [string, string][];
  columns: string[];
  rows: string[][];
  totals: [string, string][];
  footer: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const company = companyProfile();
  let page = pdf.addPage([595.28, 841.89]);
  let y = 800;
  const draw = (text: string, x: number, size: number, face: PDFFont = font, color = ink) => {
    page.drawText(text, { x, y, size, font: face, color });
  };

  page.drawRectangle({ x: 40, y: 786, width: 36, height: 4, color: amber });
  draw(input.kicker, 40, 10, bold, amber);
  y -= 22;
  draw(ascii(input.title), 40, 20, bold);
  y -= 16;
  for (const row of [...company.address, company.web, company.phone, company.abn ? `ABN ${company.abn}` : ""].filter(Boolean)) {
    draw(ascii(row), 40, 9, font, muted);
    y -= 12;
  }
  y -= 8;
  for (const [label, value] of input.meta) {
    draw(label, 40, 9, font, muted);
    draw(ascii(value).slice(0, 80), 140, 10, bold);
    y -= 16;
  }
  y -= 8;
  const widths = columnWidths(input.columns.length);
  drawRow(page, bold, y, input.columns, widths, true);
  y -= 18;
  page.drawLine({ start: { x: 40, y: y + 12 }, end: { x: 555, y: y + 12 }, thickness: 0.4, color: line });

  for (const row of input.rows) {
    const height = rowHeight(row[0]);
    if (y - height < 120) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
      drawRow(page, bold, y, input.columns, widths, true);
      y -= 18;
    }
    drawRow(page, font, y, row.map((cell, index) => (index === 0 ? ascii(cell) : cell)), widths, false);
    y -= height;
  }

  y -= 10;
  for (const [label, value] of input.totals) {
    if (y < 80) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
    const face = label.startsWith("Total") ? bold : font;
    page.drawText(label, { x: 360, y, size: 10, font: face, color: ink });
    page.drawText(value, { x: 480, y, size: 10, font: face, color: ink });
    y -= 16;
  }
  y -= 12;
  for (const part of wrap(ascii(input.footer), 90)) {
    if (y < 50) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
    page.drawText(part, { x: 40, y, size: 8, font, color: muted });
    y -= 11;
  }
  return pdf.save();
}

function columnWidths(count: number): number[] {
  if (count === 4) return [280, 50, 90, 90];
  return [360, 70, 110];
}

function drawRow(page: PDFPage, font: PDFFont, y: number, cells: string[], widths: number[], header: boolean) {
  let x = 40;
  cells.forEach((cell, index) => {
    const lines = cell.split("\n").slice(0, 3);
    lines.forEach((text, lineIndex) => {
      page.drawText(text.slice(0, index === 0 ? 70 : 24), {
        x,
        y: y - lineIndex * 11,
        size: header ? 8 : 9,
        font,
        color: header ? muted : ink,
      });
    });
    x += widths[index] ?? 80;
  });
}

function rowHeight(description: string) {
  return 16 + Math.min(2, description.split("\n").length - 1) * 11;
}

function wrap(text: string, size: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > size) {
      if (current) lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function ascii(value: string) {
  return value.replace(/[^\x20-\x7E\n]/g, " ");
}
