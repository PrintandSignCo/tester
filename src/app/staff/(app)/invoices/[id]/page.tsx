import Link from "next/link";
import { Flash, PageHeader, StatusPill } from "@/components/ui";
import { companyProfile } from "@/lib/company";
import { money } from "@/lib/format";
import { xeroConfigured } from "@/lib/xero";
import { sendToXero } from "@/server/shop-actions";
import { requireInvoiceBundle } from "@/server/load";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await requireInvoiceBundle(id);
  const company = companyProfile();
  const connected = xeroConfigured();
  return (
    <>
      <PageHeader
        title={bundle.invoice.number}
        lede={`${bundle.printable.customer} · ${bundle.invoice.terms} · GST 10%`}
        actions={
          <>
            <StatusPill status={bundle.invoice.status} />
            <Link className="btn btn-ghost" href={`/staff/jobs/${bundle.invoice.jobId}`}>
              Job {bundle.invoice.job.number}
            </Link>
            <Link className="btn btn-ghost" href={`/staff/invoices/${id}/print`}>
              Print view
            </Link>
            <a className="btn btn-ghost" href={`/api/invoices/${id}/pdf`}>
              Download PDF
            </a>
            <a className="btn btn-ghost" href={`/api/invoices/${id}/xero`}>
              Download Xero JSON
            </a>
            {connected ? (
              <form action={sendToXero}>
                <input type="hidden" name="invoiceId" value={id} />
                <button className="btn btn-primary" type="submit">
                  Send to Xero
                </button>
              </form>
            ) : null}
          </>
        }
      />
      <Flash error={sp.error} notice={sp.notice} />
      {connected ? (
        <p className="notice">Xero is connected. Sending creates a draft ACCREC invoice, amounts exclusive of GST, account 200, tax type OUTPUT.</p>
      ) : (
        <p className="notice">Xero is not connected. Set XERO_CLIENT_ID and XERO_CLIENT_SECRET to send invoices. Until then, download the JSON.</p>
      )}
      {!company.abn ? <p className="help">COMPANY_ABN is not set, so the printable invoice omits an ABN.</p> : null}
      {bundle.invoice.xeroInvoiceId ? <p className="help">Xero invoice id: {bundle.invoice.xeroInvoiceId}</p> : null}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th className="money">Unit ex GST</th>
              <th className="money">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bundle.printable.lines.map((line, index) => (
              <tr key={index}>
                <td>{line.description}</td>
                <td>{line.qty}</td>
                <td className="money">{money(line.unitAmount)}</td>
                <td className="money">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="totals" style={{ marginTop: 12 }}>
          <div>
            <span>Subtotal</span>
            <strong>{money(bundle.printable.subtotal)}</strong>
          </div>
          <div>
            <span>GST 10%</span>
            <strong>{money(bundle.printable.gst)}</strong>
          </div>
          <div className="grand">
            <span>Total</span>
            <strong>{money(bundle.printable.total)}</strong>
          </div>
        </div>
      </div>
      <details style={{ marginTop: 16 }}>
        <summary>Xero payload</summary>
        <pre className="json">{JSON.stringify(bundle.xero, null, 2)}</pre>
      </details>
    </>
  );
}
