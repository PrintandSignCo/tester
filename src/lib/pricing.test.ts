import { describe, expect, it } from "vitest";
import { invoiceDueFromIssue } from "@/lib/documents";
import {
  DEFAULT_RATES,
  GST_RATE,
  calcLine,
  invoiceAmounts,
  quoteTotals,
  unitAmountExGst,
} from "@/lib/pricing";
import type { LineInput, ProductRates, TierId } from "@/lib/types";

const acm: ProductRates = {
  id: "p-acm",
  name: "ACM panel sign",
  method: "sqm",
  materialCost: 85,
  markupByTier: { t1: 100, t2: 80, t3: 55 },
  labourSetup: 45,
  minCharge: 75,
};

const corflute: ProductRates = {
  id: "p-corflute",
  name: "Corflute sign",
  method: "sqm",
  materialCost: 28,
  markupByTier: { t1: 120, t2: 100, t3: 70 },
  labourSetup: 25,
  minCharge: 45,
};

const banner: ProductRates = {
  id: "p-banner",
  name: "Vinyl banner",
  method: "sqm",
  materialCost: 35,
  markupByTier: { t1: 110, t2: 90, t3: 60 },
  labourSetup: 30,
  minCharge: 55,
};

const pullup: ProductRates = {
  id: "p-pullup",
  name: "Pull-up banner",
  method: "unit",
  materialCost: 95,
  markupByTier: { t1: 80, t2: 60, t3: 40 },
  labourSetup: 25,
  minCharge: 120,
};

const linear: ProductRates = {
  id: "p-linear",
  name: "Cut vinyl lettering",
  method: "linear",
  materialCost: 40,
  markupByTier: { t1: 50, t2: 40, t3: 25 },
  labourSetup: 10,
  minCharge: 30,
};

function line(partial: Partial<LineInput> = {}): LineInput {
  return {
    productId: "p",
    widthMm: 1000,
    heightMm: 1000,
    qty: 1,
    lamination: false,
    eyelets: 0,
    installHours: 0,
    designHours: 0,
    note: "",
    ...partial,
  };
}

describe("tier markups", () => {
  const item = line({ widthMm: 1200, heightMm: 900, qty: 1 });

  it("prices ACM at retail: 1.08 m² × $85 + 100% markup + $45 setup", () => {
    const result = calcLine(acm, item, "t1");
    expect(result.areaSqm).toBeCloseTo(1.08, 5);
    expect(result.markupPct).toBe(100);
    expect(result.materialSell).toBeCloseTo(183.6, 5);
    expect(result.labour).toBe(45);
    expect(result.hitMinimum).toBe(false);
    expect(result.total).toBeCloseTo(228.6, 5);
  });

  it("uses the corporate and trade markup columns, so trade is cheaper than retail", () => {
    const retail = calcLine(acm, item, "t1").total;
    const corporate = calcLine(acm, item, "t2");
    const trade = calcLine(acm, item, "t3");
    expect(corporate.markupPct).toBe(80);
    expect(corporate.materialSell).toBeCloseTo(165.24, 5);
    expect(corporate.total).toBeCloseTo(210.24, 5);
    expect(trade.markupPct).toBe(55);
    expect(trade.materialSell).toBeCloseTo(142.29, 5);
    expect(trade.total).toBeCloseTo(187.29, 5);
    expect(trade.total).toBeLessThan(corporate.total);
    expect(corporate.total).toBeLessThan(retail);
  });
});

describe("minimum charge", () => {
  it("lifts a small corflute up to the $45 minimum", () => {
    const result = calcLine(corflute, line({ widthMm: 200, heightMm: 200, qty: 1 }), "t1");
    expect(result.areaSqm).toBeCloseTo(0.04, 5);
    expect(result.materialSell).toBeCloseTo(2.464, 5);
    expect(result.raw).toBeCloseTo(27.464, 5);
    expect(result.hitMinimum).toBe(true);
    expect(result.total).toBe(45);
  });

  it("does not apply the minimum when quantity is zero", () => {
    const result = calcLine(corflute, line({ widthMm: 200, heightMm: 200, qty: 0 }), "t1");
    expect(result.hitMinimum).toBe(false);
    expect(result.total).toBe(0);
  });

  it("leaves the raw price when it already clears the minimum", () => {
    const result = calcLine(acm, line({ widthMm: 1200, heightMm: 900, qty: 1 }), "t1");
    expect(result.raw).toBeGreaterThan(acm.minCharge);
    expect(result.total).toBeCloseTo(result.raw, 5);
  });
});

describe("pricing methods and options", () => {
  it("prices pull-up banners per unit and laminates per unit, ignoring area", () => {
    const plain = calcLine(pullup, line({ widthMm: 850, heightMm: 2000, qty: 2 }), "t1");
    expect(plain.materialSell).toBeCloseTo(342, 5);
    expect(plain.total).toBeCloseTo(367, 5);
    const laminated = calcLine(
      pullup,
      line({ widthMm: 850, heightMm: 2000, qty: 2, lamination: true }),
      "t1",
    );
    expect(laminated.options).toBeCloseTo(2 * DEFAULT_RATES.laminationPerSqm, 5);
    expect(laminated.total).toBeCloseTo(403, 5);
  });

  it("prices linear-metre products from width only", () => {
    const result = calcLine(linear, line({ widthMm: 2500, heightMm: 400, qty: 2 }), "t1");
    expect(result.linearM).toBeCloseTo(2.5, 5);
    expect(result.materialSell).toBeCloseTo(300, 5);
    expect(result.total).toBeCloseTo(310, 5);
  });

  it("adds lamination by area × qty, eyelets, install and design once per line", () => {
    const result = calcLine(
      banner,
      line({
        widthMm: 1000,
        heightMm: 1000,
        qty: 2,
        lamination: true,
        eyelets: 4,
        installHours: 1,
        designHours: 0.5,
      }),
      "t1",
    );
    expect(result.materialSell).toBeCloseTo(147, 5);
    expect(result.options).toBeCloseTo(36 + 6 + 85 + 47.5, 5);
    expect(result.total).toBeCloseTo(351.5, 5);
  });
});

describe("GST", () => {
  it("adds 10% GST on the ex-GST subtotal", () => {
    const item = line({ productId: acm.id, widthMm: 1200, heightMm: 900, qty: 1 });
    const small = line({ productId: corflute.id, widthMm: 200, heightMm: 200, qty: 1 });
    const totals = quoteTotals(
      [
        { product: acm, line: item },
        { product: corflute, line: small },
      ],
      "t1" satisfies TierId,
    );
    expect(GST_RATE).toBe(0.1);
    expect(totals.subtotal).toBeCloseTo(228.6 + 45, 5);
    expect(totals.gst).toBeCloseTo(totals.subtotal * 0.1, 5);
    expect(totals.grand).toBeCloseTo(totals.subtotal + totals.gst, 5);
  });

  it("rounds invoice ex-GST unit amounts and keeps GST at 10%", () => {
    const total = calcLine(acm, line({ widthMm: 1200, heightMm: 900, qty: 3 }), "t2").total;
    const unit = unitAmountExGst(total, 3);
    expect(unit).toBe(Number((total / 3).toFixed(2)));
    const amounts = invoiceAmounts([{ qty: 3, unitAmount: unit }]);
    expect(amounts.gst).toBeCloseTo(amounts.subtotal * 0.1, 2);
    expect(amounts.total).toBeCloseTo(amounts.subtotal + amounts.gst, 2);
  });

  it("sets invoice due dates 14 days after the issue date", () => {
    expect(invoiceDueFromIssue("2026-11-06")).toBe("2026-11-20");
  });
});
