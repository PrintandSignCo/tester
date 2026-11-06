"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { diffQuote } from "@/lib/diff";
import { addDaysISO, clientLabel, formatDateOnly, parseDateOnly, perthTodayISO } from "@/lib/format";
import { calcLine, lineDescription, unitAmountExGst } from "@/lib/pricing";
import { nextNumber } from "@/lib/sequence";
import type { LineInput, QuoteSnapshot, TierId } from "@/lib/types";
import { requireClient, requireStaff, withMessage } from "@/server/guards";
import { loadRates, mapLine, mapProduct } from "@/server/mappers";

const lineSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1),
  widthMm: z.number().finite().min(0).max(20000),
  heightMm: z.number().finite().min(0).max(20000),
  qty: z.number().finite().min(0).max(100000),
  lamination: z.boolean(),
  eyelets: z.number().finite().min(0).max(10000),
  installHours: z.number().finite().min(0).max(10000),
  designHours: z.number().finite().min(0).max(10000),
  note: z.string().max(2000),
});

const quoteSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().nullable(),
  customer: z.string().max(300),
  tierId: z.enum(["t1", "t2", "t3"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED"]),
  lines: z.array(lineSchema).min(1).max(80),
});

export async function saveQuote(input: unknown): Promise<{ ok: true; lines: LineInput[] } | { ok: false; error: string }> {
  const session = await requireStaff();
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the sizes, quantities and products, then save again." };
  const data = parsed.data;
  const existing = await prisma.quote.findUnique({
    where: { id: data.id },
    include: { lines: { orderBy: { sortOrder: "asc" } }, job: { select: { id: true } } },
  });
  if (!existing) return { ok: false, error: "That quote no longer exists." };
  if (existing.job) return { ok: false, error: "This quote is locked because it has already been turned into a job." };

  const products = (await prisma.product.findMany()).map(mapProduct);
  const known = new Set(products.map((product) => product.id));
  if (data.lines.some((line) => !known.has(line.productId))) {
    return { ok: false, error: "One of the lines uses a product that is not in the catalogue." };
  }
  if (data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) return { ok: false, error: "Choose a client that is still on file." };
  }

  const [rates, tiers, clients] = await Promise.all([
    loadRates(),
    prisma.tier.findMany(),
    prisma.client.findMany({ select: { id: true, name: true, company: true } }),
  ]);
  const tierName = (id: string) => tiers.find((tier) => tier.id === id)?.name ?? id;
  const labelFor = (id: string | null) => {
    if (!id) return "No client";
    const client = clients.find((item) => item.id === id);
    return client ? clientLabel(client.name, client.company) : "Removed client";
  };
  const before: QuoteSnapshot = {
    clientId: existing.clientId,
    customer: existing.customer,
    tierId: existing.tierId as TierId,
    date: formatDateOnly(existing.date),
    status: existing.status,
    lines: existing.lines.map(mapLine),
  };
  const after: QuoteSnapshot = {
    clientId: data.clientId,
    customer: data.customer.trim(),
    tierId: data.tierId,
    date: data.date,
    status: data.status,
    lines: data.lines.map((line) => ({ ...line, eyelets: Math.round(line.eyelets), note: line.note.trim() })),
  };
  const changes = diffQuote({ before, after, products, rates, tierName, clientLabel: labelFor });
  const savedLines = await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: existing.id },
      data: {
        clientId: data.clientId,
        customer: after.customer,
        tierId: data.tierId,
        date: parseDateOnly(data.date),
        status: data.status,
        acceptedAt: data.status === "ACCEPTED" ? existing.acceptedAt ?? new Date() : null,
        acceptedByName:
          data.status === "ACCEPTED" ? existing.acceptedByName || session.user.name || "Staff" : "",
      },
    });
    const kept: typeof after.lines = [];
    for (const [index, line] of after.lines.entries()) {
      const dataRow = {
        productId: line.productId,
        sortOrder: index,
        widthMm: line.widthMm,
        heightMm: line.heightMm,
        qty: line.qty,
        lamination: line.lamination,
        eyelets: Math.round(line.eyelets),
        installHours: line.installHours,
        designHours: line.designHours,
        note: line.note,
      };
      const reusable = line.id && !line.id.startsWith("new-") && existing.lines.some((row) => row.id === line.id);
      if (reusable && line.id) {
        await tx.quoteLine.update({ where: { id: line.id }, data: dataRow });
        kept.push({ ...line, id: line.id });
      } else {
        const created = await tx.quoteLine.create({ data: { ...dataRow, quoteId: existing.id } });
        kept.push({ ...line, id: created.id });
      }
    }
    const keepIds = kept.map((line) => line.id).filter((id): id is string => Boolean(id));
    await tx.quoteLine.deleteMany({ where: { quoteId: existing.id, id: { notIn: keepIds } } });
    return kept;
  });

  await writeAudit({
    entity: "QUOTE",
    entityId: existing.id,
    entityRef: existing.number,
    summary: "Quote updated",
    changes,
    actorId: session.user.id,
    actorName: session.user.name || session.user.email || "Staff",
  });
  revalidatePath(`/staff/quotes/${existing.id}`);
  revalidatePath("/staff/quotes");
  revalidatePath("/portal");
  return { ok: true, lines: savedLines };
}

export async function createQuote() {
  const session = await requireStaff();
  const product = await prisma.product.findFirst({ where: { active: true }, orderBy: { name: "asc" } });
  if (!product) redirect(withMessage("/staff/catalogue", "error", "Add a product before starting a quote."));
  const quote = await prisma.quote.create({
    data: {
      number: await nextNumber("Q"),
      tierId: "t1",
      date: parseDateOnly(perthTodayISO()),
      status: "DRAFT",
      customer: "",
      createdById: session.user.id,
      lines: { create: [{ productId: product.id, sortOrder: 0, widthMm: 1200, heightMm: 900, qty: 1 }] },
    },
  });
  await writeAudit({
    entity: "QUOTE",
    entityId: quote.id,
    entityRef: quote.number,
    summary: "Quote created",
    changes: [{ field: "Status", old: "—", new: "Draft" }],
    actorId: session.user.id,
    actorName: session.user.name || "Staff",
  });
  redirect(`/staff/quotes/${quote.id}`);
}

export async function duplicateQuote(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("quoteId") ?? "");
  const existing = await prisma.quote.findUnique({ where: { id }, include: { lines: true } });
  if (!existing) redirect(withMessage("/staff/quotes", "error", "That quote was not found."));
  const copy = await prisma.quote.create({
    data: {
      number: await nextNumber("Q"),
      clientId: existing.clientId,
      customer: existing.customer,
      tierId: existing.tierId,
      date: parseDateOnly(perthTodayISO()),
      status: "DRAFT",
      createdById: session.user.id,
      lines: {
        create: existing.lines.map((line, index) => ({
          productId: line.productId,
          sortOrder: index,
          widthMm: line.widthMm,
          heightMm: line.heightMm,
          qty: line.qty,
          lamination: line.lamination,
          eyelets: line.eyelets,
          installHours: line.installHours,
          designHours: line.designHours,
          note: line.note,
        })),
      },
    },
  });
  await writeAudit({
    entity: "QUOTE",
    entityId: copy.id,
    entityRef: copy.number,
    summary: "Quote duplicated",
    changes: [{ field: "Copied from", old: "—", new: existing.number }],
    actorId: session.user.id,
    actorName: session.user.name || "Staff",
  });
  redirect(`/staff/quotes/${copy.id}`);
}

export async function deleteQuote(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("quoteId") ?? "");
  const existing = await prisma.quote.findUnique({ where: { id }, include: { job: true } });
  if (!existing) redirect("/staff/quotes");
  if (existing.job) {
    redirect(withMessage(`/staff/quotes/${id}`, "error", "Delete is blocked because this quote has a job."));
  }
  await prisma.quote.delete({ where: { id } });
  await writeAudit({
    entity: "QUOTE",
    entityId: id,
    entityRef: existing.number,
    summary: "Quote deleted",
    changes: [{ field: "Quote", old: existing.number, new: "Deleted" }],
    actorId: session.user.id,
    actorName: session.user.name || "Staff",
  });
  redirect(withMessage("/staff/quotes", "notice", `${existing.number} deleted.`));
}

export async function convertQuoteToJob(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("quoteId") ?? "");
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" }, include: { product: true } }, client: true, job: true, request: true },
  });
  if (!quote) redirect(withMessage("/staff/quotes", "error", "That quote was not found."));
  if (quote.job) redirect(`/staff/jobs/${quote.job.id}`);
  if (quote.status !== "ACCEPTED") {
    redirect(withMessage(`/staff/quotes/${id}`, "error", "Accept the quote before turning it into a job."));
  }
  const rates = await loadRates();
  const job = await prisma.job.create({
    data: {
      number: await nextNumber("JOB"),
      quoteId: quote.id,
      quoteNumber: quote.number,
      clientId: quote.clientId,
      clientName: quote.client?.name || quote.customer || "Customer",
      clientCompany: quote.client?.company || "",
      clientEmail: quote.client?.email || "",
      dueDate: parseDateOnly(addDaysISO(perthTodayISO(), 7)),
      notes: "",
      status: "NOT_STARTED",
      lines: {
        create: quote.lines.map((row, index) => {
          const product = mapProduct(row.product);
          const line = mapLine(row);
          const total = calcLine(product, line, quote.tierId as TierId, rates).total;
          return {
            sortOrder: index,
            description: lineDescription(product.name, line),
            widthMm: line.widthMm,
            heightMm: line.heightMm,
            qty: line.qty,
            unitAmount: unitAmountExGst(total, line.qty),
            note: line.note,
          };
        }),
      },
    },
  });
  if (quote.request) {
    await prisma.jobRequest.update({
      where: { id: quote.request.id },
      data: { jobId: job.id, status: "CONVERTED" },
    });
    await prisma.artwork.updateMany({ where: { requestId: quote.request.id }, data: { jobId: job.id } });
  }
  await writeAudit({
    entity: "QUOTE",
    entityId: quote.id,
    entityRef: quote.number,
    summary: "Converted to job",
    changes: [{ field: "Job", old: "—", new: job.number }],
    actorId: session.user.id,
    actorName: session.user.name || "Staff",
  });
  redirect(`/staff/jobs/${job.id}`);
}

export async function acceptQuote(formData: FormData) {
  const session = await requireClient();
  const id = String(formData.get("quoteId") ?? "");
  const quote = await prisma.quote.findFirst({ where: { id, clientId: session.user.clientId ?? "" } });
  if (!quote) redirect(withMessage("/portal/quotes", "error", "That quote was not found."));
  if (quote.status === "ACCEPTED") redirect(`/portal/quotes/${id}`);
  if (quote.status !== "SENT") {
    redirect(withMessage(`/portal/quotes/${id}`, "error", "This quote is not ready to accept yet."));
  }
  const name = session.user.name || session.user.email || "Client";
  await prisma.quote.update({
    where: { id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByName: name },
  });
  await writeAudit({
    entity: "QUOTE",
    entityId: quote.id,
    entityRef: quote.number,
    summary: "Quote accepted online",
    changes: [{ field: "Status", old: "Sent", new: "Accepted" }],
    actorId: session.user.id,
    actorName: name,
  });
  redirect(withMessage(`/portal/quotes/${id}`, "notice", "Quote accepted. The shop will schedule the job."));
}
