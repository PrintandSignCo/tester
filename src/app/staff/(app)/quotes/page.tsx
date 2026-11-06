import Link from "next/link";
import { Flash, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateAU, money } from "@/lib/format";
import { calcLine, quoteTotals } from "@/lib/pricing";
import type { QuoteStatus, TierId } from "@/lib/types";
import { createQuote } from "@/server/quote-actions";
import { loadRates, mapLine, mapProduct } from "@/server/mappers";

export const metadata = { title: "Quotes" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; q?: string; status?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status === "DRAFT" || sp.status === "SENT" || sp.status === "ACCEPTED" ? sp.status : "";
  const quotes = await prisma.quote.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { customer: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
    include: { lines: { include: { product: true } }, tier: true },
    orderBy: { updatedAt: "desc" },
  });
  const rates = await loadRates();
  return (
    <>
      <PageHeader
        title="Quotes"
        lede="Draft, send and accept. The customer's tier is applied automatically and can be overridden. It never prints."
        actions={
          <form action={createQuote}>
            <button className="btn btn-primary" type="submit">
              New quote
            </button>
          </form>
        }
      />
      <Flash error={sp.error} notice={sp.notice} />
      <form className="toolbar">
        <input className="input" name="q" defaultValue={q} placeholder="Search number or customer" />
        <select className="select" name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
        </select>
        <button className="btn" type="submit">
          Filter
        </button>
      </form>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quote</th>
              <th>Customer</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Date</th>
              <th className="money">Total inc GST</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const rows = quote.lines.map((line) => ({ product: mapProduct(line.product), line: mapLine(line) }));
              const totals = quoteTotals(rows, quote.tierId as TierId, rates);
              return (
                <tr key={quote.id}>
                  <td>
                    <Link href={`/staff/quotes/${quote.id}`}>{quote.number}</Link>
                  </td>
                  <td>{quote.customer || "—"}</td>
                  <td>{quote.tier.name}</td>
                  <td>
                    <StatusPill status={quote.status as QuoteStatus} />
                  </td>
                  <td>{formatDateAU(quote.date)}</td>
                  <td className="money">{money(totals.grand)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {quotes.length === 0 ? <p className="help">No quotes match.</p> : null}
      </div>
    </>
  );
}
