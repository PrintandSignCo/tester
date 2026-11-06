import { notFound } from "next/navigation";
import { buildPrintableQuote, buildXeroPayload, type PrintableInvoice } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { formatDateOnly } from "@/lib/format";
import { calcLine, invoiceAmounts, quoteTotals } from "@/lib/pricing";
import type { TierId } from "@/lib/types";
import { dec, loadRates, mapLine, mapProduct } from "@/server/mappers";

export async function loadQuoteBundle(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" }, include: { product: true } },
      client: true,
      tier: true,
      job: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!quote) return null;
  const rates = await loadRates();
  const rows = quote.lines.map((row) => {
    const product = mapProduct(row.product);
    const line = mapLine(row);
    return { product, line, breakdown: calcLine(product, line, quote.tierId as TierId, rates) };
  });
  const totals = quoteTotals(
    rows.map((row) => ({ product: row.product, line: row.line })),
    quote.tierId as TierId,
    rates,
  );
  const printable = buildPrintableQuote({
    number: quote.number,
    date: formatDateOnly(quote.date),
    customer: quote.customer || quote.client?.name || "Customer",
    tierId: quote.tierId as TierId,
    lines: rows.map((row) => ({ product: row.product, line: row.line, total: row.breakdown.total })),
    subtotal: totals.subtotal,
    gst: totals.gst,
    total: totals.grand,
  });
  return { quote, rows, totals, printable, rates };
}

export async function requireQuoteBundle(id: string) {
  const bundle = await loadQuoteBundle(id);
  if (!bundle) notFound();
  return bundle;
}

export async function loadInvoiceBundle(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } }, job: true },
  });
  if (!invoice) return null;
  const lines = invoice.lines.map((line) => ({
    description: line.description,
    qty: dec(line.qty),
    unitAmount: dec(line.unitAmount),
    amount: dec(line.qty) * dec(line.unitAmount),
  }));
  const amounts = invoiceAmounts(lines);
  const printable: PrintableInvoice = {
    number: invoice.number,
    jobNumber: invoice.job.number,
    quoteNumber: invoice.quoteNumber,
    issueDate: formatDateOnly(invoice.issueDate),
    dueDate: formatDateOnly(invoice.dueDate),
    terms: invoice.terms,
    customer: [invoice.clientName, invoice.clientCompany].filter(Boolean).join(" — "),
    email: invoice.clientEmail,
    lines,
    subtotal: amounts.subtotal,
    gst: amounts.gst,
    total: amounts.total,
  };
  const xero = buildXeroPayload({
    number: invoice.number,
    clientName: invoice.clientName,
    clientCompany: invoice.clientCompany,
    issueDate: printable.issueDate,
    dueDate: printable.dueDate,
    jobNumber: invoice.job.number,
    quoteNumber: invoice.quoteNumber,
    lines,
  });
  return { invoice, printable, xero };
}

export async function requireInvoiceBundle(id: string) {
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) notFound();
  return bundle;
}
