import Link from "next/link";
import { InvoiceSheet } from "@/components/documents";
import { PrintButton } from "@/components/print-button";
import { requireInvoiceBundle } from "@/server/load";

export const metadata = { title: "Print invoice" };

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await requireInvoiceBundle(id);
  return (
    <>
      <div className="print-bar no-print toolbar" style={{ padding: 16 }}>
        <Link href={`/staff/invoices/${id}`}>Back to {bundle.invoice.number}</Link>
        <PrintButton />
        <a className="btn btn-ghost" href={`/api/invoices/${id}/pdf`}>
          Download PDF
        </a>
      </div>
      <InvoiceSheet invoice={bundle.printable} />
    </>
  );
}
