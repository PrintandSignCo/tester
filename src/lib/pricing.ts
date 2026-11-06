import type { LineInput, OptionRates, PricingMethod, ProductRates, QuoteSnapshot, TierId } from "@/lib/types";

/** Shop-wide option rates from the quoting sheet. GST is always 10%. */
export const DEFAULT_RATES: OptionRates = {
  laminationPerSqm: 18,
  eyeletEach: 1.5,
  installPerHour: 85,
  designPerHour: 95,
};

export const GST_RATE = 0.1;

export type LineBreakdown = {
  areaSqm: number;
  linearM: number;
  materialSell: number;
  labour: number;
  options: number;
  raw: number;
  total: number;
  hitMinimum: boolean;
  markupPct: number;
};

/**
 * Price one quote line, ex GST.
 * Material is marked up by the chosen tier. Setup/labour is once per line.
 * Options are added, then the product minimum charge applies when qty > 0.
 * Eyelets, install and design are totals for the line (not multiplied again by qty).
 */
export function calcLine(
  product: ProductRates,
  line: LineInput,
  tierId: TierId,
  rates: OptionRates = DEFAULT_RATES,
): LineBreakdown {
  const w = Math.max(0, line.widthMm) / 1000;
  const h = Math.max(0, line.heightMm) / 1000;
  const qty = Math.max(0, line.qty);
  const areaSqm = w * h;
  const linearM = w;
  const markupPct = product.markupByTier[tierId] ?? product.markupByTier.t1;
  let materialCost = 0;
  if (product.method === "sqm") materialCost = areaSqm * qty * product.materialCost;
  else if (product.method === "unit") materialCost = qty * product.materialCost;
  else materialCost = linearM * qty * product.materialCost;
  const materialSell = materialCost * (1 + markupPct / 100);
  const labour = product.labourSetup;
  let options = 0;
  if (line.lamination) {
    const lamArea = product.method === "unit" ? qty : areaSqm * Math.max(qty, 1);
    options += lamArea * rates.laminationPerSqm;
  }
  options += Math.max(0, line.eyelets) * rates.eyeletEach;
  options += Math.max(0, line.installHours) * rates.installPerHour;
  options += Math.max(0, line.designHours) * rates.designPerHour;
  const raw = materialSell + labour + options;
  const hitMinimum = raw < product.minCharge && qty > 0;
  const total = qty > 0 ? Math.max(raw, product.minCharge) : 0;
  return { areaSqm, linearM, materialSell, labour, options, raw, total, hitMinimum, markupPct };
}

export function quoteTotals(
  lines: { product: ProductRates; line: LineInput }[],
  tierId: TierId,
  rates: OptionRates = DEFAULT_RATES,
): { subtotal: number; gst: number; grand: number } {
  let subtotal = 0;
  for (const row of lines) subtotal += calcLine(row.product, row.line, tierId, rates).total;
  const gst = subtotal * GST_RATE;
  return { subtotal, gst, grand: subtotal + gst };
}

export function totalsForSnapshot(
  snapshot: QuoteSnapshot,
  products: ProductRates[],
  rates: OptionRates = DEFAULT_RATES,
): { subtotal: number; gst: number; grand: number } {
  const map = new Map(products.map((p) => [p.id, p]));
  const fallback = products[0];
  const rows = snapshot.lines.map((line) => ({
    line,
    product: map.get(line.productId) ?? fallback ?? emptyProduct(line.productId),
  }));
  return quoteTotals(rows, snapshot.tierId, rates);
}

export function unitAmountExGst(lineTotal: number, qty: number): number {
  const divisor = Math.max(1, qty);
  return Number((lineTotal / divisor).toFixed(2));
}

export function invoiceAmounts(lines: { qty: number; unitAmount: number }[]): {
  subtotal: number;
  gst: number;
  total: number;
} {
  const sub = lines.reduce((sum, line) => sum + line.qty * line.unitAmount, 0);
  const gstRaw = sub * GST_RATE;
  return {
    subtotal: Number(sub.toFixed(2)),
    gst: Number(gstRaw.toFixed(2)),
    total: Number((sub + gstRaw).toFixed(2)),
  };
}

export function lineDescription(
  productName: string,
  line: Pick<LineInput, "widthMm" | "heightMm" | "lamination" | "eyelets" | "installHours" | "designHours">,
): string {
  const opts: string[] = [];
  if (line.lamination) opts.push("lamination");
  if (line.eyelets > 0) opts.push(`${line.eyelets} eyelets`);
  if (line.installHours > 0) opts.push(`install ${line.installHours}h`);
  if (line.designHours > 0) opts.push(`design ${line.designHours}h`);
  const base = `${productName} ${line.widthMm}×${line.heightMm} mm`;
  return opts.length ? `${base} (${opts.join(", ")})` : base;
}

export function measureLabel(method: PricingMethod, breakdown: LineBreakdown): string {
  if (method === "unit") return "Per unit";
  if (method === "linear") return `${breakdown.linearM.toLocaleString("en-AU", { maximumFractionDigits: 3 })} linear m`;
  return `${breakdown.areaSqm.toLocaleString("en-AU", { maximumFractionDigits: 3 })} m²`;
}

function emptyProduct(id: string): ProductRates {
  return {
    id,
    name: "Product",
    method: "sqm",
    materialCost: 0,
    markupByTier: { t1: 0, t2: 0, t3: 0 },
    labourSetup: 0,
    minCharge: 0,
  };
}
