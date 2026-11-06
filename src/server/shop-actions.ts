"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { buildJobBoardPayload } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { diffFields } from "@/lib/diff";
import { clientLabel, formatDateOnly, money, parseDateOnly, perthTodayISO } from "@/lib/format";
import { invoiceAmounts } from "@/lib/pricing";
import { nextNumber } from "@/lib/sequence";
import { removeArtwork } from "@/lib/storage";
import { METHOD_LABEL, type PricingMethod } from "@/lib/types";
import { invoiceDueFromIssue } from "@/lib/documents";
import { sendInvoiceToXero, webhookConfigured, xeroConfigured } from "@/lib/xero";
import { requireAdmin, requireStaff, withMessage } from "@/server/guards";
import { dbMethod, dec, mapProduct, tierId } from "@/server/mappers";
import { loadInvoiceBundle } from "@/server/load";

function actor(session: { user: { id: string; name?: string | null; email?: string | null } }) {
  return { actorId: session.user.id, actorName: session.user.name || session.user.email || "Staff" };
}

function num(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function updateProduct(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) redirect(withMessage("/staff/catalogue", "error", "That product was not found."));
  const name = String(formData.get("name") ?? "").trim();
  const method = String(formData.get("method") ?? "sqm") as PricingMethod;
  const materialCost = num(formData.get("materialCost"));
  const labourSetup = num(formData.get("labourSetup"));
  const minCharge = num(formData.get("minCharge"));
  const markupT1 = num(formData.get("markupT1"));
  const markupT2 = num(formData.get("markupT2"));
  const markupT3 = num(formData.get("markupT3"));
  if (!name || [materialCost, labourSetup, minCharge, markupT1, markupT2, markupT3].some((value) => !Number.isFinite(value) || value < 0)) {
    redirect(withMessage("/staff/catalogue", "error", "Enter a name and zero or positive prices."));
  }
  const before = mapProduct(existing);
  const nextMethod: PricingMethod = method === "unit" || method === "linear" ? method : "sqm";
  await prisma.product.update({
    where: { id },
    data: {
      name,
      method: dbMethod(nextMethod),
      materialCost,
      labourSetup,
      minCharge,
      markupT1,
      markupT2,
      markupT3,
      examplePrice: formData.get("examplePrice") === "on",
      active: formData.get("active") === "on",
    },
  });
  await writeAudit({
    entity: "PRODUCT",
    entityId: id,
    entityRef: name,
    summary: `${before.name} updated`,
    changes: diffFields([
      { field: "Name", old: before.name, new: name },
      { field: "Method", old: METHOD_LABEL[before.method], new: METHOD_LABEL[nextMethod] },
      { field: "Material cost", old: money(before.materialCost), new: money(materialCost) },
      { field: "Setup / labour", old: money(before.labourSetup), new: money(labourSetup) },
      { field: "Minimum charge", old: money(before.minCharge), new: money(minCharge) },
      { field: "Retail markup", old: `${before.markupByTier.t1}%`, new: `${markupT1}%` },
      { field: "Corporate markup", old: `${before.markupByTier.t2}%`, new: `${markupT2}%` },
      { field: "Trade markup", old: `${before.markupByTier.t3}%`, new: `${markupT3}%` },
      { field: "Example price", old: before.examplePrice ? "yes" : "no", new: formData.get("examplePrice") === "on" ? "yes" : "no" },
      { field: "Active", old: before.active ? "yes" : "no", new: formData.get("active") === "on" ? "yes" : "no" },
    ]),
    ...actor(session),
  });
  redirect(withMessage("/staff/catalogue", "notice", `${name} saved.`));
}

export async function addProduct() {
  const session = await requireStaff();
  const product = await prisma.product.create({
    data: {
      name: "New product",
      method: "SQM",
      materialCost: 50,
      markupT1: 100,
      markupT2: 80,
      markupT3: 55,
      labourSetup: 40,
      minCharge: 60,
      examplePrice: false,
    },
  });
  await writeAudit({
    entity: "PRODUCT",
    entityId: product.id,
    entityRef: product.name,
    summary: "Product added",
    changes: [{ field: "Name", old: "—", new: product.name }],
    ...actor(session),
  });
  redirect(withMessage("/staff/catalogue", "notice", "New product added. Replace the starter figures."));
}

export async function deleteProduct(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  const product = await prisma.product.findUnique({ where: { id }, include: { _count: { select: { lines: true } } } });
  if (!product) redirect("/staff/catalogue");
  if (product._count.lines > 0) {
    redirect(withMessage("/staff/catalogue", "error", `${product.name} is used on quotes. Mark it inactive instead of deleting it.`));
  }
  await prisma.product.delete({ where: { id } });
  await writeAudit({
    entity: "PRODUCT",
    entityId: id,
    entityRef: product.name,
    summary: "Product removed",
    changes: [{ field: "Name", old: product.name, new: "Deleted" }],
    ...actor(session),
  });
  redirect(withMessage("/staff/catalogue", "notice", `${product.name} removed.`));
}

export async function updateTier(formData: FormData) {
  const session = await requireAdmin();
  const id = tierId(String(formData.get("id") ?? "t1"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(withMessage("/staff/catalogue", "error", "A tier needs a name."));
  const existing = await prisma.tier.findUnique({ where: { id } });
  if (!existing) redirect("/staff/catalogue");
  await prisma.tier.update({ where: { id }, data: { name } });
  await writeAudit({
    entity: "TIER",
    entityId: id,
    entityRef: name,
    summary: "Pricing tier renamed",
    changes: diffFields([{ field: "Name", old: existing.name, new: name }]),
    ...actor(session),
  });
  redirect(withMessage("/staff/catalogue", "notice", "Tier name saved. Printed quotes still hide it."));
}

export async function updateShopRates(formData: FormData) {
  const session = await requireAdmin();
  const laminationPerSqm = num(formData.get("laminationPerSqm"));
  const eyeletEach = num(formData.get("eyeletEach"));
  const installPerHour = num(formData.get("installPerHour"));
  const designPerHour = num(formData.get("designPerHour"));
  if ([laminationPerSqm, eyeletEach, installPerHour, designPerHour].some((value) => !Number.isFinite(value) || value < 0)) {
    redirect(withMessage("/staff/catalogue", "error", "Shop rates need to be zero or more."));
  }
  const existing = await prisma.shopSettings.findUnique({ where: { id: "shop" } });
  await prisma.shopSettings.upsert({
    where: { id: "shop" },
    update: { laminationPerSqm, eyeletEach, installPerHour, designPerHour },
    create: { id: "shop", laminationPerSqm, eyeletEach, installPerHour, designPerHour },
  });
  await writeAudit({
    entity: "SHOP",
    entityId: "shop",
    entityRef: "Shop rates",
    summary: "Shop rates updated",
    changes: diffFields([
      { field: "Lamination / m²", old: money(dec(existing?.laminationPerSqm)), new: money(laminationPerSqm) },
      { field: "Eyelet", old: money(dec(existing?.eyeletEach)), new: money(eyeletEach) },
      { field: "Install / hour", old: money(dec(existing?.installPerHour)), new: money(installPerHour) },
      { field: "Design / hour", old: money(dec(existing?.designPerHour)), new: money(designPerHour) },
    ]),
    ...actor(session),
  });
  redirect(withMessage("/staff/catalogue", "notice", "Shop rates saved. Open quotes use the new rates."));
}

export async function saveClient(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const tier = tierId(String(formData.get("tierId") ?? "t1"));
  if (!name) redirect(withMessage("/staff/clients", "error", "A client needs a name."));
  if (id) {
    await prisma.client.update({ where: { id }, data: { name, company, email, phone, tierId: tier } });
    redirect(withMessage("/staff/clients", "notice", `${name} saved.`));
  }
  await prisma.client.create({ data: { name, company, email, phone, tierId: tier } });
  redirect(withMessage("/staff/clients", "notice", `${name} added.`));
}

export async function deleteClient(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const client = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { quotes: true, jobs: true, requests: true } } },
  });
  if (!client) redirect("/staff/clients");
  if (client._count.quotes + client._count.jobs + client._count.requests > 0) {
    redirect(withMessage("/staff/clients", "error", `${client.name} has quotes or jobs, so the record stays.`));
  }
  await prisma.client.delete({ where: { id } });
  redirect(withMessage("/staff/clients", "notice", `${client.name} removed.`));
}

export async function createPortalLogin(formData: FormData) {
  await requireStaff();
  const clientId = String(formData.get("clientId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) redirect(withMessage("/staff/clients", "error", "Client not found."));
  if (!email.includes("@") || password.length < 8) {
    redirect(withMessage("/staff/clients", "error", "Portal access needs an email and a password of at least 8 characters."));
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect(withMessage("/staff/clients", "error", "That email is already used."));
  await prisma.user.create({
    data: { email, name: client.name, passwordHash: await bcrypt.hash(password, 10), role: "CLIENT", clientId },
  });
  redirect(withMessage("/staff/clients", "notice", `Portal login created for ${client.name}.`));
}

export async function updateJob(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) redirect("/staff/jobs");
  const data: Prisma.JobUpdateInput = {};
  if (formData.has("status")) {
    const status = String(formData.get("status"));
    if (status === "NOT_STARTED" || status === "IN_PRODUCTION" || status === "FINISHED" || status === "INVOICED") {
      data.status = status;
    }
  }
  if (formData.has("dueDate")) {
    const due = String(formData.get("dueDate") ?? "");
    data.dueDate = due ? parseDateOnly(due) : null;
  }
  if (formData.has("notes")) data.notes = String(formData.get("notes") ?? "");
  await prisma.job.update({ where: { id }, data });
  revalidatePath(`/staff/jobs/${id}`);
  revalidatePath("/staff/jobs");
  redirect(withMessage(`/staff/jobs/${id}`, "notice", "Job updated."));
}

export async function updateJobLinePrice(formData: FormData) {
  const session = await requireStaff();
  const lineId = String(formData.get("lineId") ?? "");
  const unitAmount = num(formData.get("unitAmount"));
  const line = await prisma.jobLine.findUnique({ where: { id: lineId }, include: { job: { include: { invoice: true } } } });
  if (!line) redirect("/staff/jobs");
  if (!Number.isFinite(unitAmount) || unitAmount < 0) {
    redirect(withMessage(`/staff/jobs/${line.jobId}`, "error", "Enter a unit price of zero or more."));
  }
  if (line.job.invoice) {
    redirect(withMessage(`/staff/jobs/${line.jobId}`, "error", "This job already has an invoice, so the price stays as invoiced."));
  }
  const old = dec(line.unitAmount);
  await prisma.jobLine.update({ where: { id: lineId }, data: { unitAmount } });
  await writeAudit({
    entity: "JOB",
    entityId: line.jobId,
    entityRef: line.job.number,
    summary: "Job price updated",
    changes: diffFields([{ field: `${line.description} unit ex GST`, old: money(old), new: money(unitAmount) }]),
    ...actor(session),
  });
  redirect(withMessage(`/staff/jobs/${line.jobId}`, "notice", "Price updated."));
}

export async function deleteArtwork(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const artwork = await prisma.artwork.findUnique({ where: { id } });
  if (!artwork) redirect("/staff/jobs");
  await removeArtwork(artwork);
  await prisma.artwork.delete({ where: { id } });
  const back = artwork.jobId ? `/staff/jobs/${artwork.jobId}` : `/staff/requests/${artwork.requestId}`;
  redirect(withMessage(back, "notice", "Artwork removed."));
}

export async function createInvoice(formData: FormData) {
  await requireStaff();
  const jobId = String(formData.get("jobId") ?? "");
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, invoice: true },
  });
  if (!job) redirect("/staff/jobs");
  if (job.invoice) redirect(`/staff/invoices/${job.invoice.id}`);
  if (job.status !== "FINISHED" && job.status !== "INVOICED") {
    redirect(withMessage(`/staff/jobs/${job.id}`, "error", "Mark the job Finished before invoicing."));
  }
  const lines = job.lines.map((line) => ({
    description: line.note ? `${line.description} — ${line.note}` : line.description,
    qty: Math.max(1, dec(line.qty)),
    unitAmount: dec(line.unitAmount),
  }));
  const amounts = invoiceAmounts(lines);
  const issue = perthTodayISO();
  const invoice = await prisma.invoice.create({
    data: {
      number: await nextNumber("INV"),
      jobId: job.id,
      quoteNumber: job.quoteNumber,
      clientId: job.clientId,
      clientName: job.clientName,
      clientCompany: job.clientCompany,
      clientEmail: job.clientEmail,
      subtotal: amounts.subtotal,
      gst: amounts.gst,
      total: amounts.total,
      issueDate: parseDateOnly(issue),
      dueDate: parseDateOnly(invoiceDueFromIssue(issue)),
      terms: "14 days",
      lines: { create: lines.map((line, index) => ({ ...line, sortOrder: index })) },
    },
  });
  await prisma.job.update({ where: { id: job.id }, data: { status: "INVOICED" } });
  redirect(`/staff/invoices/${invoice.id}`);
}

export async function sendToXero(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("invoiceId") ?? "");
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) redirect("/staff/invoices");
  if (!xeroConfigured()) {
    redirect(withMessage(`/staff/invoices/${id}`, "error", "Xero is not connected. Export the JSON until XERO_CLIENT_ID and XERO_CLIENT_SECRET are set."));
  }
  let invoiceId = "";
  try {
    const result = await sendInvoiceToXero(bundle.xero);
    invoiceId = result.invoiceId;
    await prisma.invoice.update({
      where: { id },
      data: { status: "SENT_TO_XERO", xeroInvoiceId: result.invoiceId, xeroError: "" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Xero request failed.";
    await prisma.invoice.update({ where: { id }, data: { xeroError: message } });
    redirect(withMessage(`/staff/invoices/${id}`, "error", message));
  }
  redirect(withMessage(`/staff/invoices/${id}`, "notice", `Sent to Xero as a draft invoice (${invoiceId}).`));
}

export async function sendJobToBoard(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const job = await prisma.job.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!job) redirect("/staff/jobs");
  const payload = buildJobBoardPayload({
    jobNumber: job.number,
    clientName: job.clientName,
    clientCompany: job.clientCompany,
    clientEmail: job.clientEmail,
    dueDate: job.dueDate ? formatDateOnly(job.dueDate) : null,
    notes: job.notes,
    quoteNumber: job.quoteNumber,
    items: job.lines.map((line) => ({
      description: line.description,
      widthMm: dec(line.widthMm),
      heightMm: dec(line.heightMm),
      qty: dec(line.qty),
    })),
  });
  const url = process.env.JOB_BOARD_WEBHOOK_URL;
  if (!url || !webhookConfigured()) {
    redirect(withMessage(`/staff/jobs/${id}`, "error", "The job board webhook is not connected. Download the JSON instead."));
  }
  let outcome: { ok: boolean; message: string };
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Print-Sign-Event": "job.export",
    };
    if (process.env.JOB_BOARD_WEBHOOK_SECRET) headers.Authorization = `Bearer ${process.env.JOB_BOARD_WEBHOOK_SECRET}`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    const text = (await res.text()).slice(0, 2000);
    await prisma.jobExport.create({ data: { jobId: id, ok: res.ok, targetUrl: url, response: text, payload } });
    outcome = {
      ok: res.ok,
      message: res.ok ? `${job.number} sent to the job board.` : `The job board returned ${res.status}.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed.";
    await prisma.jobExport.create({ data: { jobId: id, ok: false, targetUrl: url, response: message, payload } });
    outcome = { ok: false, message };
  }
  redirect(withMessage(`/staff/jobs/${id}`, outcome.ok ? "notice" : "error", outcome.message));
}

export async function quoteFromRequest(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  const request = await prisma.jobRequest.findUnique({ where: { id }, include: { client: true, quote: true } });
  if (!request) redirect("/staff/requests");
  if (request.quote) redirect(`/staff/quotes/${request.quote.id}`);
  const product =
    (await prisma.product.findFirst({ where: { name: { equals: request.material, mode: "insensitive" }, active: true } })) ||
    (await prisma.product.findFirst({ where: { active: true }, orderBy: { name: "asc" } }));
  if (!product) redirect(withMessage("/staff/catalogue", "error", "Add a product before quoting this request."));
  const quote = await prisma.quote.create({
    data: {
      number: await nextNumber("Q"),
      clientId: request.clientId,
      customer: clientLabel(request.client.name, request.client.company),
      tierId: request.client.tierId,
      date: parseDateOnly(perthTodayISO()),
      status: "DRAFT",
      createdById: session.user.id,
      lines: {
        create: [
          {
            productId: product.id,
            sortOrder: 0,
            widthMm: request.widthMm,
            heightMm: request.heightMm,
            qty: request.qty,
            note: request.notes,
          },
        ],
      },
    },
  });
  await prisma.jobRequest.update({ where: { id }, data: { quoteId: quote.id, status: "QUOTED" } });
  await writeAudit({
    entity: "QUOTE",
    entityId: quote.id,
    entityRef: quote.number,
    summary: "Quote created from job request",
    changes: [{ field: "Request", old: "—", new: request.number }],
    ...actor(session),
  });
  redirect(`/staff/quotes/${quote.id}`);
}

export async function jobFromRequest(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  const request = await prisma.jobRequest.findUnique({ where: { id }, include: { client: true, job: true } });
  if (!request) redirect("/staff/requests");
  if (request.job) redirect(`/staff/jobs/${request.job.id}`);
  const description = `${request.material || request.title} ${dec(request.widthMm)}×${dec(request.heightMm)} mm`;
  const job = await prisma.job.create({
    data: {
      number: await nextNumber("JOB"),
      quoteNumber: "",
      clientId: request.clientId,
      clientName: request.client.name,
      clientCompany: request.client.company,
      clientEmail: request.client.email,
      dueDate: request.dueDate,
      notes: [request.title, request.notes].filter(Boolean).join("\n"),
      status: "NOT_STARTED",
      lines: {
        create: [
          {
            description,
            widthMm: request.widthMm,
            heightMm: request.heightMm,
            qty: request.qty,
            unitAmount: 0,
            note: request.notes,
          },
        ],
      },
    },
  });
  await prisma.jobRequest.update({ where: { id }, data: { jobId: job.id, status: "CONVERTED" } });
  await prisma.artwork.updateMany({ where: { requestId: id }, data: { jobId: job.id } });
  await writeAudit({
    entity: "JOB",
    entityId: job.id,
    entityRef: job.number,
    summary: "Job created from request",
    changes: [
      { field: "Request", old: "—", new: request.number },
      { field: "Unit price", old: "—", new: "Not priced yet" },
    ],
    ...actor(session),
  });
  redirect(withMessage(`/staff/jobs/${job.id}`, "notice", "Job created from the request. Set a price before invoicing."));
}

export async function closeRequest(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  await prisma.jobRequest.update({ where: { id }, data: { status: "CLOSED" } });
  redirect(withMessage(`/staff/requests/${id}`, "notice", "Request closed."));
}

export async function addChangelog(formData: FormData) {
  await requireAdmin();
  const version = String(formData.get("version") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const requestedBy = String(formData.get("requestedBy") ?? "").trim() || "Rob";
  if (!version || !title || !detail) {
    redirect(withMessage("/staff/changelog", "error", "Version, title and detail are required."));
  }
  try {
    await prisma.changelogEntry.create({
      data: { version, title, detail, requestedBy, releasedAt: new Date() },
    });
  } catch {
    redirect(withMessage("/staff/changelog", "error", "That version already exists."));
  }
  redirect(withMessage("/staff/changelog", "notice", `${version} published.`));
}

export async function createStaffUser(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "STAFF") === "ADMIN" ? "ADMIN" : "STAFF";
  if (!name || !email.includes("@") || password.length < 8) {
    redirect(withMessage("/staff/users", "error", "Name, email and a password of at least 8 characters are required."));
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect(withMessage("/staff/users", "error", "That email is already used."));
  await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 10), role } });
  redirect(withMessage("/staff/users", "notice", `${name} can sign in.`));
}
