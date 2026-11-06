import bcrypt from "bcryptjs";
import { PrismaClient, type PricingMethod } from "@prisma/client";
import { invoiceDueFromIssue } from "../src/lib/documents";
import { parseDateOnly } from "../src/lib/format";
import { calcLine, invoiceAmounts, lineDescription, unitAmountExGst } from "../src/lib/pricing";
import type { LineInput, ProductRates, TierId } from "../src/lib/types";

const prisma = new PrismaClient();

const products: {
  id: string;
  name: string;
  method: PricingMethod;
  materialCost: number;
  markupT1: number;
  markupT2: number;
  markupT3: number;
  labourSetup: number;
  minCharge: number;
}[] = [
  { id: "p-acm", name: "ACM panel sign", method: "SQM", materialCost: 85, markupT1: 100, markupT2: 80, markupT3: 55, labourSetup: 45, minCharge: 75 },
  { id: "p-corflute", name: "Corflute sign", method: "SQM", materialCost: 28, markupT1: 120, markupT2: 100, markupT3: 70, labourSetup: 25, minCharge: 45 },
  { id: "p-banner", name: "Vinyl banner", method: "SQM", materialCost: 35, markupT1: 110, markupT2: 90, markupT3: 60, labourSetup: 30, minCharge: 55 },
  { id: "p-decal", name: "Adhesive vinyl decal", method: "SQM", materialCost: 55, markupT1: 120, markupT2: 100, markupT3: 70, labourSetup: 40, minCharge: 50 },
  { id: "p-wrap", name: "Vehicle wrap", method: "SQM", materialCost: 95, markupT1: 90, markupT2: 70, markupT3: 45, labourSetup: 150, minCharge: 500 },
  { id: "p-frost", name: "Window frosting", method: "SQM", materialCost: 65, markupT1: 105, markupT2: 85, markupT3: 55, labourSetup: 60, minCharge: 80 },
  { id: "p-foamex", name: "Foamex board", method: "SQM", materialCost: 48, markupT1: 110, markupT2: 90, markupT3: 60, labourSetup: 35, minCharge: 55 },
  { id: "p-pullup", name: "Pull-up banner", method: "UNIT", materialCost: 95, markupT1: 80, markupT2: 60, markupT3: 40, labourSetup: 25, minCharge: 120 },
];

function ratesFor(id: string): ProductRates {
  const product = products.find((item) => item.id === id)!;
  return {
    id: product.id,
    name: product.name,
    method: product.method === "UNIT" ? "unit" : "sqm",
    materialCost: product.materialCost,
    markupByTier: { t1: product.markupT1, t2: product.markupT2, t3: product.markupT3 },
    labourSetup: product.labourSetup,
    minCharge: product.minCharge,
  };
}

function priced(productId: string, tier: TierId, line: LineInput) {
  const product = ratesFor(productId);
  const total = calcLine(product, { ...line, productId }, tier).total;
  return {
    description: lineDescription(product.name, line),
    widthMm: line.widthMm,
    heightMm: line.heightMm,
    qty: line.qty,
    unitAmount: unitAmountExGst(total, line.qty),
    note: line.note,
  };
}

async function main() {
  const adminPassword = await bcrypt.hash("PrintSign-Admin-2026", 10);
  const staffPassword = await bcrypt.hash("PrintSign-Staff-2026", 10);
  const clientPassword = await bcrypt.hash("PrintSign-Client-2026", 10);

  await prisma.tier.upsert({ where: { id: "t1" }, update: {}, create: { id: "t1", name: "Retail", sortOrder: 1 } });
  await prisma.tier.upsert({ where: { id: "t2" }, update: {}, create: { id: "t2", name: "Corporate", sortOrder: 2 } });
  await prisma.tier.upsert({ where: { id: "t3" }, update: {}, create: { id: "t3", name: "Trade", sortOrder: 3 } });
  await prisma.shopSettings.upsert({
    where: { id: "shop" },
    update: {},
    create: { id: "shop", laminationPerSqm: 18, eyeletEach: 1.5, installPerHour: 85, designPerHour: 95 },
  });

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: { ...product, examplePrice: true, active: true },
    });
  }

  const clients = [
    { id: "c-ex-retail", name: "Sam Nguyen (example)", company: "Walk-in retail enquiry", email: "sam.example@email.com", phone: "0400 111 001", tierId: "t1" },
    { id: "c-ex-corp", name: "Jordan Lee (example)", company: "Metro Property Group", email: "jordan.example@metroprop.example", phone: "08 6000 2200", tierId: "t2" },
    { id: "c-ex-trade", name: "Casey Brooks (example)", company: "Brooks Fitout & Trade", email: "casey.example@brookstrade.example", phone: "0412 333 009", tierId: "t3" },
  ];
  for (const client of clients) {
    await prisma.client.upsert({ where: { id: client.id }, update: {}, create: { ...client, example: true } });
  }

  const rob = await prisma.user.upsert({
    where: { email: "rob@printandsignco.com.au" },
    update: { name: "Rob Macdougall", passwordHash: adminPassword, role: "ADMIN" },
    create: { email: "rob@printandsignco.com.au", name: "Rob Macdougall", passwordHash: adminPassword, role: "ADMIN" },
  });
  await prisma.user.upsert({
    where: { email: "staff@printandsignco.com.au" },
    update: { name: "Shop Staff", passwordHash: staffPassword, role: "STAFF" },
    create: { email: "staff@printandsignco.com.au", name: "Shop Staff", passwordHash: staffPassword, role: "STAFF" },
  });
  await prisma.user.upsert({
    where: { email: "sam.example@email.com" },
    update: { name: "Sam Nguyen (example)", passwordHash: clientPassword, role: "CLIENT", clientId: "c-ex-retail" },
    create: { email: "sam.example@email.com", name: "Sam Nguyen (example)", passwordHash: clientPassword, role: "CLIENT", clientId: "c-ex-retail" },
  });

  const quote1 = await ensureQuote({
    number: "Q-2026-0001",
    clientId: "c-ex-corp",
    customer: "Jordan Lee (example) — Metro Property Group",
    tierId: "t2",
    date: "2026-11-06",
    status: "DRAFT",
    createdById: rob.id,
    lines: [
      { productId: "p-acm", widthMm: 2400, heightMm: 1200, qty: 1, note: "Reception wall" },
      { productId: "p-banner", widthMm: 3000, heightMm: 1000, qty: 1, lamination: true, eyelets: 8, note: "Site fence" },
    ],
  });
  const quote2 = await ensureQuote({
    number: "Q-2026-0002",
    clientId: "c-ex-trade",
    customer: "Casey Brooks (example) — Brooks Fitout & Trade",
    tierId: "t3",
    date: "2026-11-04",
    status: "ACCEPTED",
    createdById: rob.id,
    lines: [{ productId: "p-corflute", widthMm: 600, heightMm: 450, qty: 10, note: "Sale event" }],
  });
  const quote3 = await ensureQuote({
    number: "Q-2026-0003",
    clientId: "c-ex-retail",
    customer: "Sam Nguyen (example) — Walk-in retail enquiry",
    tierId: "t1",
    date: "2026-11-02",
    status: "ACCEPTED",
    createdById: rob.id,
    lines: [{ productId: "p-pullup", widthMm: 850, heightMm: 2000, qty: 2, note: "Counter display" }],
  });
  await ensureQuote({
    number: "Q-2026-0004",
    clientId: "c-ex-retail",
    customer: "Sam Nguyen (example) — Walk-in retail enquiry",
    tierId: "t1",
    date: "2026-11-06",
    status: "SENT",
    createdById: rob.id,
    lines: [{ productId: "p-foamex", widthMm: 900, heightMm: 600, qty: 2, note: "Menu boards" }],
  });

  const caseyLine = priced("p-corflute", "t3", blankLine("p-corflute", 600, 450, 10, "Sale event"));
  const samLine = priced("p-pullup", "t1", blankLine("p-pullup", 850, 2000, 2, "Counter display"));

  const job1 = await ensureJob({
    number: "JOB-2026-0001",
    quoteId: quote2.id,
    quoteNumber: "Q-2026-0002",
    clientId: "c-ex-trade",
    clientName: "Casey Brooks (example)",
    clientCompany: "Brooks Fitout & Trade",
    clientEmail: "casey.example@brookstrade.example",
    dueDate: "2026-11-13",
    notes: "Call Casey before delivery.",
    status: "IN_PRODUCTION",
    lines: [caseyLine],
  });
  const job2 = await ensureJob({
    number: "JOB-2026-0002",
    quoteId: quote3.id,
    quoteNumber: "Q-2026-0003",
    clientId: "c-ex-retail",
    clientName: "Sam Nguyen (example)",
    clientCompany: "Walk-in retail enquiry",
    clientEmail: "sam.example@email.com",
    dueDate: "2026-11-10",
    notes: "Two pull-ups for the walk-in counter.",
    status: "INVOICED",
    lines: [samLine],
  });

  const invoiceLines = [{ description: samLine.description, qty: Math.max(1, samLine.qty), unitAmount: samLine.unitAmount }];
  const amounts = invoiceAmounts(invoiceLines);
  const existingInvoice = await prisma.invoice.findUnique({ where: { number: "INV-2026-0001" } });
  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        number: "INV-2026-0001",
        jobId: job2.id,
        quoteNumber: "Q-2026-0003",
        clientId: "c-ex-retail",
        clientName: "Sam Nguyen (example)",
        clientCompany: "Walk-in retail enquiry",
        clientEmail: "sam.example@email.com",
        subtotal: amounts.subtotal,
        gst: amounts.gst,
        total: amounts.total,
        issueDate: parseDateOnly("2026-11-06"),
        dueDate: parseDateOnly(invoiceDueFromIssue("2026-11-06")),
        terms: "14 days",
        lines: { create: invoiceLines.map((line, index) => ({ ...line, sortOrder: index })) },
      },
    });
  }

  const existingRequest = await prisma.jobRequest.findUnique({ where: { number: "REQ-2026-0001" } });
  if (!existingRequest) {
    await prisma.jobRequest.create({
      data: {
        number: "REQ-2026-0001",
        clientId: "c-ex-retail",
        title: "Meeting room window frost",
        material: "Window frosting",
        widthMm: 1800,
        heightMm: 900,
        qty: 1,
        dueDate: parseDateOnly("2026-11-18"),
        notes: "Frosted band across the meeting room window. Artwork to follow if the logo changes.",
        status: "NEW",
      },
    });
  }

  const changelog = [
    {
      version: "v5",
      releasedAt: new Date("2026-11-06T22:40:00+08:00"),
      title: "Online version with client portal",
      detail: "The shop now runs as a hosted app: staff sign-in, a client portal for quotes, jobs, online acceptance and artwork requests, server-side price history, and Xero, job-board and Box or S3 connections when configured.",
      requestedBy: "Rob",
    },
    {
      version: "v4",
      releasedAt: new Date("2026-11-06T21:34:00+08:00"),
      title: "Jobs, job board export & Xero-ready invoices",
      detail: "Convert accepted quotes to jobs (status board, due date, notes, quote link), export each job to the separate job board as JSON, and when Finished create invoices with a printable view plus Xero Invoices API JSON (ACCREC / OUTPUT / AccountCode 200).",
      requestedBy: "Rob",
    },
    {
      version: "v3",
      releasedAt: new Date("2026-11-06T20:38:00+08:00"),
      title: "What's changed",
      detail: "Added a shared team changelog, per-quote edit history (lines, client, tier, status, totals), and catalogue price and markup change logging.",
      requestedBy: "Rob",
    },
    {
      version: "v2",
      releasedAt: new Date("2026-11-06T20:14:00+08:00"),
      title: "Retail / Corporate / Trade tiers + clients",
      detail: "Three renamable pricing tiers with per-product markup columns, a client list with an assigned tier, and a quote builder that applies the tier with a manual override. Printed quotes hide the tier name.",
      requestedBy: "Rob",
    },
    {
      version: "v1",
      releasedAt: new Date("2026-11-06T20:07:00+08:00"),
      title: "Initial quoting tool",
      detail: "Product catalogue, live quote builder (mm sizes, options, minimum charge), GST 10% AUD totals, save and load quotes, draft/sent/accepted status, and a printable quote for Print and Sign Co.",
      requestedBy: "Rob",
    },
  ];
  for (const entry of changelog) {
    await prisma.changelogEntry.upsert({
      where: { version: entry.version },
      update: entry,
      create: entry,
    });
  }

  if (quote1.created) {
    await prisma.auditLog.create({
      data: {
        entity: "QUOTE",
        entityId: quote1.id,
        entityRef: "Q-2026-0001",
        summary: "Quote created",
        details: [{ field: "Status", old: "—", new: "Draft" }],
        actorId: rob.id,
        actorName: "Rob Macdougall",
      },
    });
  }
  void job1;
}

function blankLine(productId: string, widthMm: number, heightMm: number, qty: number, note: string): LineInput {
  return { productId, widthMm, heightMm, qty, lamination: false, eyelets: 0, installHours: 0, designHours: 0, note };
}

async function ensureQuote(input: {
  number: string;
  clientId: string;
  customer: string;
  tierId: string;
  date: string;
  status: "DRAFT" | "SENT" | "ACCEPTED";
  createdById: string;
  lines: { productId: string; widthMm: number; heightMm: number; qty: number; note: string; lamination?: boolean; eyelets?: number }[];
}) {
  const existing = await prisma.quote.findUnique({ where: { number: input.number } });
  if (existing) return { id: existing.id, created: false };
  const quote = await prisma.quote.create({
    data: {
      number: input.number,
      clientId: input.clientId,
      customer: input.customer,
      tierId: input.tierId,
      date: parseDateOnly(input.date),
      status: input.status,
      createdById: input.createdById,
      acceptedAt: input.status === "ACCEPTED" ? new Date("2026-11-05T04:00:00.000Z") : null,
      acceptedByName: input.status === "ACCEPTED" ? "Seed" : "",
      lines: {
        create: input.lines.map((line, index) => ({
          productId: line.productId,
          sortOrder: index,
          widthMm: line.widthMm,
          heightMm: line.heightMm,
          qty: line.qty,
          lamination: line.lamination ?? false,
          eyelets: line.eyelets ?? 0,
          note: line.note,
        })),
      },
    },
  });
  return { id: quote.id, created: true };
}

async function ensureJob(input: {
  number: string;
  quoteId: string;
  quoteNumber: string;
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  dueDate: string;
  notes: string;
  status: "NOT_STARTED" | "IN_PRODUCTION" | "FINISHED" | "INVOICED";
  lines: { description: string; widthMm: number; heightMm: number; qty: number; unitAmount: number; note: string }[];
}) {
  const existing = await prisma.job.findUnique({ where: { number: input.number } });
  if (existing) return existing;
  return prisma.job.create({
    data: {
      number: input.number,
      quoteId: input.quoteId,
      quoteNumber: input.quoteNumber,
      clientId: input.clientId,
      clientName: input.clientName,
      clientCompany: input.clientCompany,
      clientEmail: input.clientEmail,
      dueDate: parseDateOnly(input.dueDate),
      notes: input.notes,
      status: input.status,
      lines: { create: input.lines.map((line, index) => ({ ...line, sortOrder: index })) },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
