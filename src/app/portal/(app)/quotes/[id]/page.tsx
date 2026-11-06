import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteSheet } from "@/components/documents";
import { Flash, PageHeader } from "@/components/ui";
import { acceptQuote } from "@/server/quote-actions";
import { loadQuoteBundle } from "@/server/load";
import { requireClient } from "@/server/guards";

export const metadata = { title: "Quote" };

export default async function PortalQuote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const session = await requireClient();
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadQuoteBundle(id);
  if (!bundle || bundle.quote.clientId !== session.user.clientId || bundle.quote.status === "DRAFT") notFound();
  return (
    <>
      <PageHeader
        title={bundle.quote.number}
        actions={
          <>
            <Link className="btn btn-ghost" href={`/portal/quotes/${id}/print`}>
              Print view
            </Link>
            <a className="btn btn-ghost" href={`/api/quotes/${id}/pdf`}>
              Download PDF
            </a>
            {bundle.quote.status === "SENT" ? (
              <form action={acceptQuote}>
                <input type="hidden" name="quoteId" value={id} />
                <button className="btn btn-primary" type="submit">
                  Accept quote
                </button>
              </form>
            ) : (
              <span className="pill pill-good">Accepted{bundle.quote.acceptedByName ? ` by ${bundle.quote.acceptedByName}` : ""}</span>
            )}
          </>
        }
      />
      <Flash error={sp.error} notice={sp.notice} />
      <QuoteSheet quote={bundle.printable} />
    </>
  );
}
