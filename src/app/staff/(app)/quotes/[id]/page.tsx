import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditList } from "@/components/audit-list";
import { QuoteEditor } from "@/components/quote-editor";
import { Flash, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateOnly } from "@/lib/format";
import type { QuoteSnapshot, TierId } from "@/lib/types";
import { convertQuoteToJob, deleteQuote, duplicateQuote } from "@/server/quote-actions";
import { requireQuoteBundle } from "@/server/load";
import { mapProduct } from "@/server/mappers";

export const metadata = { title: "Quote" };

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await requireQuoteBundle(id);
  if (!bundle) notFound();
  const [products, clients, tiers, history] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, include: { tier: true } }),
    prisma.tier.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.auditLog.findMany({ where: { entity: "QUOTE", entityId: id }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const initial: QuoteSnapshot = {
    clientId: bundle.quote.clientId,
    customer: bundle.quote.customer,
    tierId: bundle.quote.tierId as TierId,
    date: formatDateOnly(bundle.quote.date),
    status: bundle.quote.status,
    lines: bundle.rows.map((row) => row.line),
  };
  return (
    <>
      <PageHeader
        title={bundle.quote.number}
        lede={bundle.quote.customer || "No customer yet"}
        actions={
          <>
            <StatusPill status={bundle.quote.status} />
            <Link className="btn btn-ghost" href={`/staff/quotes/${id}/print`}>
              Print view
            </Link>
            <a className="btn btn-ghost" href={`/api/quotes/${id}/pdf`}>
              Download PDF
            </a>
            <form action={duplicateQuote}>
              <input type="hidden" name="quoteId" value={id} />
              <button className="btn btn-ghost" type="submit">
                Duplicate
              </button>
            </form>
            {bundle.quote.status === "ACCEPTED" && !bundle.quote.job ? (
              <form action={convertQuoteToJob}>
                <input type="hidden" name="quoteId" value={id} />
                <button className="btn btn-primary" type="submit">
                  Convert to job
                </button>
              </form>
            ) : null}
            {bundle.quote.job ? (
              <Link className="btn btn-primary" href={`/staff/jobs/${bundle.quote.job.id}`}>
                Open {bundle.quote.job.number}
              </Link>
            ) : (
              <form action={deleteQuote}>
                <input type="hidden" name="quoteId" value={id} />
                <button className="btn btn-danger" type="submit">
                  Delete
                </button>
              </form>
            )}
          </>
        }
      />
      <Flash error={sp.error} notice={sp.notice} />
      <QuoteEditor
        quoteId={id}
        locked={Boolean(bundle.quote.job)}
        initial={initial}
        products={products.map(mapProduct)}
        clients={clients.map((client) => ({
          id: client.id,
          name: client.name,
          company: client.company,
          email: client.email,
          phone: client.phone,
          tierId: client.tierId as TierId,
          example: client.example,
        }))}
        tiers={tiers.map((tier) => ({ id: tier.id as TierId, name: tier.name }))}
        rates={bundle.rates}
      />
      <h2 style={{ marginTop: 28 }}>Quote history</h2>
      <p className="help">Who changed the quote or its price, with the old and new values.</p>
      <AuditList entries={history} />
    </>
  );
}
