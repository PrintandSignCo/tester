import Link from "next/link";
import { QuoteSheet } from "@/components/documents";
import { PrintButton } from "@/components/print-button";
import { requireQuoteBundle } from "@/server/load";

export const metadata = { title: "Print quote" };

export default async function PrintQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await requireQuoteBundle(id);
  return (
    <>
      <div className="print-bar no-print toolbar" style={{ padding: 16 }}>
        <Link href={`/staff/quotes/${id}`}>Back to {bundle.quote.number}</Link>
        <PrintButton />
        <a className="btn btn-ghost" href={`/api/quotes/${id}/pdf`}>
          Download PDF
        </a>
      </div>
      <QuoteSheet quote={bundle.printable} />
    </>
  );
}
