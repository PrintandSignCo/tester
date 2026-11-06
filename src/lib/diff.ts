import { money } from "@/lib/format";
import { calcLine, DEFAULT_RATES, quoteTotals } from "@/lib/pricing";
import {
  QUOTE_STATUS_LABEL,
  type FieldChange,
  type LineInput,
  type OptionRates,
  type ProductRates,
  type QuoteSnapshot,
} from "@/lib/types";

export function diffQuote(input: {
  before: QuoteSnapshot;
  after: QuoteSnapshot;
  products: ProductRates[];
  rates?: OptionRates;
  tierName: (id: string) => string;
  clientLabel: (id: string | null) => string;
}): FieldChange[] {
  const rates = input.rates ?? DEFAULT_RATES;
  const changes: FieldChange[] = [];
  const { before, after } = input;
  const push = (field: string, oldValue: string, newValue: string) => {
    if (oldValue !== newValue) changes.push({ field, old: oldValue, new: newValue });
  };

  push("Customer", before.customer || "—", after.customer || "—");
  push("Client", input.clientLabel(before.clientId), input.clientLabel(after.clientId));
  push("Pricing tier", input.tierName(before.tierId), input.tierName(after.tierId));
  push("Date", before.date, after.date);
  push("Status", QUOTE_STATUS_LABEL[before.status], QUOTE_STATUS_LABEL[after.status]);

  const beforeById = new Map(before.lines.map((line) => [line.id ?? "", line]));
  const afterIds = new Set(after.lines.map((line) => line.id ?? ""));

  after.lines.forEach((line, index) => {
    const label = `Line ${index + 1}`;
    const previous = line.id ? beforeById.get(line.id) : undefined;
    if (!previous || (line.id ?? "").startsWith("new-")) {
      const product = findProduct(input.products, line.productId);
      const price = calcLine(product, line, after.tierId, rates).total;
      changes.push({
        field: label,
        old: "—",
        new: `Added ${product.name} · ${money(price)} ex GST`,
      });
      return;
    }
    pushLine(changes, label, previous, line, input.products, before.tierId, after.tierId, rates);
  });

  before.lines.forEach((line) => {
    if (!line.id || afterIds.has(line.id) === false) {
      const product = findProduct(input.products, line.productId);
      const price = calcLine(product, line, before.tierId, rates).total;
      changes.push({
        field: "Line removed",
        old: `${product.name} · ${money(price)} ex GST`,
        new: "—",
      });
    }
  });

  const beforeRows = rows(before, input.products);
  const afterRows = rows(after, input.products);
  const beforeTot = quoteTotals(beforeRows, before.tierId, rates);
  const afterTot = quoteTotals(afterRows, after.tierId, rates);
  if (Math.abs(beforeTot.grand - afterTot.grand) > 0.005) {
    changes.push({
      field: "Quote total (inc GST)",
      old: money(beforeTot.grand),
      new: money(afterTot.grand),
    });
  }
  return changes;
}

function pushLine(
  changes: FieldChange[],
  label: string,
  before: LineInput,
  after: LineInput,
  products: ProductRates[],
  beforeTier: QuoteSnapshot["tierId"],
  afterTier: QuoteSnapshot["tierId"],
  rates: OptionRates,
) {
  const beforeProduct = findProduct(products, before.productId);
  const afterProduct = findProduct(products, after.productId);
  const push = (field: string, oldValue: string, newValue: string) => {
    if (oldValue !== newValue) changes.push({ field: `${label} ${field}`, old: oldValue, new: newValue });
  };
  push("product", beforeProduct.name, afterProduct.name);
  push("size", `${before.widthMm}×${before.heightMm} mm`, `${after.widthMm}×${after.heightMm} mm`);
  push("qty", String(before.qty), String(after.qty));
  push("lamination", before.lamination ? "on" : "off", after.lamination ? "on" : "off");
  push("eyelets", String(before.eyelets), String(after.eyelets));
  push("install hours", String(before.installHours), String(after.installHours));
  push("design hours", String(before.designHours), String(after.designHours));
  push("note", before.note || "—", after.note || "—");
  const beforePrice = calcLine(beforeProduct, before, beforeTier, rates).total;
  const afterPrice = calcLine(afterProduct, after, afterTier, rates).total;
  if (Math.abs(beforePrice - afterPrice) > 0.005) {
    changes.push({
      field: `${label} price (ex GST)`,
      old: money(beforePrice),
      new: money(afterPrice),
    });
  }
}

function rows(snapshot: QuoteSnapshot, products: ProductRates[]) {
  return snapshot.lines.map((line) => ({ line, product: findProduct(products, line.productId) }));
}

function findProduct(products: ProductRates[], id: string): ProductRates {
  return (
    products.find((product) => product.id === id) ?? {
      id,
      name: id || "Product",
      method: "sqm",
      materialCost: 0,
      markupByTier: { t1: 0, t2: 0, t3: 0 },
      labourSetup: 0,
      minCharge: 0,
    }
  );
}

export function diffFields(
  pairs: { field: string; old: string | number; new: string | number }[],
): FieldChange[] {
  return pairs
    .map((pair) => ({ field: pair.field, old: String(pair.old), new: String(pair.new) }))
    .filter((pair) => pair.old !== pair.new);
}
