import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateAU, money } from "@/lib/format";
import { quoteTotals } from "@/lib/pricing";
import type { TierId } from "@/lib/types";
import { requireClient } from "@/server/guards";
import { loadRates, mapLine, mapProduct } from "@/server/mappers";

export const metadata = { title: "Your quotes" };

export default async function PortalQuotes() {
  const session = await requireClient();
  const rates = await loadRates();
  const quotes = await prisma.quote.findMany({
    where: { clientId: session.user.clientId ?? "", status: { in: ["SENT", "ACCEPTED"] } },
    include: { lines: { include: { product: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Quotes" lede="Drafts stay with the shop until they are sent. Accept a sent quote here and it goes on the job list." />
      <div className="stack">
        {quotes.map((quote) => {
          const totals = quoteTotals(
            quote.lines.map((line) => ({ product: mapProduct(line.product), line: mapLine(line) })),
            quote.tierId as TierId,
            rates,
          );
          return (
            <Link key={quote.id} className="card" href={`/portal/quotes/${quote.id}`}>
              <strong>{quote.number}</strong> <StatusPill status={quote.status} />
              <div className="help">
                {formatDateAU(quote.date)} · {money(totals.grand)} inc GST
              </div>
            </Link>
          );
        })}
        {quotes.length === 0 ? <p className="help">No quotes yet.</p> : null}
      </div>
    </>
  );
}
