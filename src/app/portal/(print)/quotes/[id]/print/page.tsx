import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteSheet } from "@/components/documents";
import { PrintButton } from "@/components/print-button";
import { loadQuoteBundle } from "@/server/load";
import { requireClient } from "@/server/guards";

export const metadata = { title: "Print quote" };

export default async function PortalPrintQuote({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClient();
  const { id } = await params;
  const bundle = await loadQuoteBundle(id);
  if (!bundle || bundle.quote.clientId !== session.user.clientId || bundle.quote.status === "DRAFT") notFound();
  return (
    <>
      <div className="print-bar no-print toolbar" style={{ padding: 16 }}>
        <Link href={`/portal/quotes/${id}`}>Back</Link>
        <PrintButton />
      </div>
      <QuoteSheet quote={bundle.printable} />
    </>
  );
}
