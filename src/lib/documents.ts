import { addDaysISO } from "@/lib/format";
import { invoiceAmounts, lineDescription } from "@/lib/pricing";
import type { LineInput, ProductRates, TierId } from "@/lib/types";

export type PrintLine = {
  description: string;
  detail: string;
  qty: number;
  amount: number;
  note: string;
};

/** Customer-facing quote. The pricing tier is intentionally absent. */
export type PrintableQuote = {
  number: string;
  date: string;
  customer: string;
  lines: PrintLine[];
  subtotal: number;
  gst: number;
  total: number;
};

export type PrintableInvoice = {
  number: string;
  jobNumber: string;
  quoteNumber: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  customer: string;
  email: string;
  lines: { description: string; qty: number; unitAmount: number; amount: number }[];
  subtotal: number;
  gst: number;
  total: number;
};

export type XeroInvoicePayload = {
  Invoices: [
    {
      Type: "ACCREC";
      Contact: { Name: string };
      Date: string;
      DueDate: string;
      LineAmountTypes: "Exclusive";
      Reference: string;
      InvoiceNumber: string;
      Status: "DRAFT";
      CurrencyCode: "AUD";
      LineItems: {
        Description: string;
        Quantity: number;
        UnitAmount: number;
        AccountCode: "200";
        TaxType: "OUTPUT";
      }[];
    },
  ];
};

export type JobBoardItem = {
  description: string;
  widthMm: number;
  heightMm: number;
  qty: number;
};

export type JobBoardPayload = {
  jobNumber: string;
  client: { name: string; company: string; email: string };
  items: JobBoardItem[];
  dueDate: string | null;
  notes: string;
  quoteNumber: string;
};

export function buildPrintableQuote(input: {
  number: string;
  date: string;
  customer: string;
  tierId: TierId;
  lines: { product: ProductRates; line: LineInput; total: number }[];
  subtotal: number;
  gst: number;
  total: number;
}): PrintableQuote {
  return {
    number: input.number,
    date: input.date,
    customer: input.customer.trim() || "Customer",
    lines: input.lines.map(({ product, line, total }) => ({
      description: lineDescription(product.name, line),
      detail: `${line.widthMm} × ${line.heightMm} mm`,
      qty: line.qty,
      amount: total,
      note: line.note,
    })),
    subtotal: input.subtotal,
    gst: input.gst,
    total: input.total,
  };
}

export function buildXeroPayload(input: {
  number: string;
  clientName: string;
  clientCompany: string;
  issueDate: string;
  dueDate: string;
  jobNumber: string;
  quoteNumber: string;
  lines: { description: string; qty: number; unitAmount: number }[];
}): XeroInvoicePayload {
  return {
    Invoices: [
      {
        Type: "ACCREC",
        Contact: { Name: input.clientCompany.trim() || input.clientName || "Customer" },
        Date: input.issueDate,
        DueDate: input.dueDate,
        LineAmountTypes: "Exclusive",
        Reference: [input.jobNumber, input.quoteNumber].filter(Boolean).join(" / "),
        InvoiceNumber: input.number,
        Status: "DRAFT",
        CurrencyCode: "AUD",
        LineItems: input.lines.map((line) => ({
          Description: line.description,
          Quantity: line.qty,
          UnitAmount: Number(line.unitAmount.toFixed(2)),
          AccountCode: "200",
          TaxType: "OUTPUT",
        })),
      },
    ],
  };
}

export function buildJobBoardPayload(input: {
  jobNumber: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  dueDate: string | null;
  notes: string;
  quoteNumber: string;
  items: JobBoardItem[];
}): JobBoardPayload {
  return {
    jobNumber: input.jobNumber,
    client: {
      name: input.clientName,
      company: input.clientCompany,
      email: input.clientEmail,
    },
    items: input.items.map((item) => ({
      description: item.description,
      widthMm: item.widthMm,
      heightMm: item.heightMm,
      qty: item.qty,
    })),
    dueDate: input.dueDate,
    notes: input.notes,
    quoteNumber: input.quoteNumber,
  };
}

export function invoiceDueFromIssue(issueISO: string): string {
  return addDaysISO(issueISO, 14);
}

export function summariseInvoice(lines: { qty: number; unitAmount: number }[]) {
  return invoiceAmounts(lines);
}
