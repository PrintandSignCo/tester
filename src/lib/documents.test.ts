import { describe, expect, it } from "vitest";
import { buildJobBoardPayload, buildPrintableQuote, buildXeroPayload } from "@/lib/documents";
import { calcLine, quoteTotals } from "@/lib/pricing";
import { diffQuote } from "@/lib/diff";
import type { LineInput, ProductRates, QuoteSnapshot } from "@/lib/types";

const product: ProductRates = {
  id: "p-banner",
  name: "Vinyl banner",
  method: "sqm",
  materialCost: 35,
  markupByTier: { t1: 110, t2: 90, t3: 60 },
  labourSetup: 30,
  minCharge: 55,
};

const baseLine: LineInput = {
  id: "line-1",
  productId: product.id,
  widthMm: 3000,
  heightMm: 1000,
  qty: 1,
  lamination: true,
  eyelets: 8,
  installHours: 0,
  designHours: 0,
  note: "Site fence",
};

describe("customer documents hide the pricing tier", () => {
  it("builds a printable quote with GST and no tier name", () => {
    const breakdown = calcLine(product, baseLine, "t3");
    const totals = quoteTotals([{ product, line: baseLine }], "t3");
    const printable = buildPrintableQuote({
      number: "Q-2026-0002",
      date: "2026-11-06",
      customer: "Casey Brooks — Brooks Fitout & Trade",
      tierId: "t3",
      lines: [{ product, line: baseLine, total: breakdown.total }],
      subtotal: totals.subtotal,
      gst: totals.gst,
      total: totals.grand,
    });
    expect(printable.gst).toBeCloseTo(printable.subtotal * 0.1, 5);
    expect(Object.keys(printable)).not.toContain("tier");
    expect(Object.keys(printable)).not.toContain("tierId");
    const serialised = JSON.stringify(printable);
    expect(serialised).not.toMatch(/"tier"|Retail|Corporate|pricing tier/i);
    expect(printable.lines[0].description).toContain("lamination");
    expect(printable.lines[0].description).toContain("8 eyelets");
  });
});

describe("Xero and job board payloads", () => {
  it("builds an exclusive ACCREC invoice for account 200 and OUTPUT GST", () => {
    const payload = buildXeroPayload({
      number: "INV-2026-0001",
      clientName: "Sam Nguyen (example)",
      clientCompany: "Walk-in retail enquiry",
      issueDate: "2026-11-06",
      dueDate: "2026-11-20",
      jobNumber: "JOB-2026-0002",
      quoteNumber: "Q-2026-0003",
      lines: [{ description: "Pull-up banner 850×2000 mm", qty: 2, unitAmount: 183.5 }],
    });
    const invoice = payload.Invoices[0];
    expect(invoice.Type).toBe("ACCREC");
    expect(invoice.LineAmountTypes).toBe("Exclusive");
    expect(invoice.CurrencyCode).toBe("AUD");
    expect(invoice.Status).toBe("DRAFT");
    expect(invoice.Contact.Name).toBe("Walk-in retail enquiry");
    expect(invoice.LineItems[0]).toMatchObject({
      AccountCode: "200",
      TaxType: "OUTPUT",
      Quantity: 2,
      UnitAmount: 183.5,
    });
  });

  it("exports the job board contract", () => {
    const payload = buildJobBoardPayload({
      jobNumber: "JOB-2026-0001",
      clientName: "Casey Brooks (example)",
      clientCompany: "Brooks Fitout & Trade",
      clientEmail: "casey.example@brookstrade.example",
      dueDate: "2026-11-13",
      notes: "Deliver to site",
      quoteNumber: "Q-2026-0002",
      items: [{ description: "Corflute sign 600×450 mm", widthMm: 600, heightMm: 450, qty: 10 }],
    });
    expect(Object.keys(payload).sort()).toEqual(
      ["client", "dueDate", "items", "jobNumber", "notes", "quoteNumber"].sort(),
    );
    expect(payload.items[0]).toEqual({
      description: "Corflute sign 600×450 mm",
      widthMm: 600,
      heightMm: 450,
      qty: 10,
    });
  });
});

describe("quote audit diff", () => {
  it("records old and new tier, size and totals", () => {
    const before: QuoteSnapshot = {
      clientId: "c1",
      customer: "Casey Brooks — Brooks Fitout & Trade",
      tierId: "t1",
      date: "2026-11-06",
      status: "DRAFT",
      lines: [baseLine],
    };
    const after: QuoteSnapshot = {
      ...before,
      tierId: "t3",
      status: "SENT",
      lines: [{ ...baseLine, widthMm: 2000, qty: 2 }],
    };
    const changes = diffQuote({
      before,
      after,
      products: [product],
      tierName: (id) => ({ t1: "Retail", t2: "Corporate", t3: "Trade" })[id] ?? id,
      clientLabel: () => "Casey Brooks (example)",
    });
    const tier = changes.find((change) => change.field === "Pricing tier");
    const size = changes.find((change) => change.field === "Line 1 size");
    const total = changes.find((change) => change.field === "Quote total (inc GST)");
    expect(tier).toEqual({ field: "Pricing tier", old: "Retail", new: "Trade" });
    expect(size).toEqual({ field: "Line 1 size", old: "3000×1000 mm", new: "2000×1000 mm" });
    expect(total?.old).not.toBe(total?.new);
    expect(changes.find((change) => change.field === "Status")).toEqual({
      field: "Status",
      old: "Draft",
      new: "Sent",
    });
  });
});
