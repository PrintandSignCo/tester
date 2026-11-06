import type { PricingMethod as DbMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_RATES } from "@/lib/pricing";
import type { LineInput, OptionRates, PricingMethod, ProductRates, TierId } from "@/lib/types";

export function dec(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

export function mapMethod(method: DbMethod): PricingMethod {
  if (method === "SQM") return "sqm";
  if (method === "UNIT") return "unit";
  return "linear";
}

export function dbMethod(method: string): DbMethod {
  if (method === "unit") return "UNIT";
  if (method === "linear") return "LINEAR";
  return "SQM";
}

export function mapProduct(product: {
  id: string;
  name: string;
  method: DbMethod;
  materialCost: { toNumber(): number };
  markupT1: { toNumber(): number };
  markupT2: { toNumber(): number };
  markupT3: { toNumber(): number };
  labourSetup: { toNumber(): number };
  minCharge: { toNumber(): number };
  examplePrice: boolean;
  active: boolean;
}): ProductRates {
  return {
    id: product.id,
    name: product.name,
    method: mapMethod(product.method),
    materialCost: dec(product.materialCost),
    markupByTier: {
      t1: dec(product.markupT1),
      t2: dec(product.markupT2),
      t3: dec(product.markupT3),
    },
    labourSetup: dec(product.labourSetup),
    minCharge: dec(product.minCharge),
    examplePrice: product.examplePrice,
    active: product.active,
  };
}

export function mapLine(line: {
  id: string;
  productId: string;
  widthMm: { toNumber(): number };
  heightMm: { toNumber(): number };
  qty: { toNumber(): number };
  lamination: boolean;
  eyelets: number;
  installHours: { toNumber(): number };
  designHours: { toNumber(): number };
  note: string;
}): LineInput {
  return {
    id: line.id,
    productId: line.productId,
    widthMm: dec(line.widthMm),
    heightMm: dec(line.heightMm),
    qty: dec(line.qty),
    lamination: line.lamination,
    eyelets: line.eyelets,
    installHours: dec(line.installHours),
    designHours: dec(line.designHours),
    note: line.note,
  };
}

export async function loadRates(): Promise<OptionRates> {
  const row = await prisma.shopSettings.findUnique({ where: { id: "shop" } });
  if (!row) return DEFAULT_RATES;
  return {
    laminationPerSqm: dec(row.laminationPerSqm),
    eyeletEach: dec(row.eyeletEach),
    installPerHour: dec(row.installPerHour),
    designPerHour: dec(row.designPerHour),
  };
}

export function tierId(value: string): TierId {
  if (value === "t2" || value === "t3") return value;
  return "t1";
}
