import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateAU, money } from "@/lib/format";
import { dec } from "@/server/mappers";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, include: { job: true } });
  return (
    <>
      <PageHeader title="Invoices" lede="Raised from finished jobs. GST is 10% and terms are 14 days. Xero stays disconnected until its credentials are set." />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Job</th>
              <th>Issued</th>
              <th>Due</th>
              <th>Status</th>
              <th className="money">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <Link href={`/staff/invoices/${invoice.id}`}>{invoice.number}</Link>
                </td>
                <td>{invoice.clientCompany || invoice.clientName}</td>
                <td>{invoice.job.number}</td>
                <td>{formatDateAU(invoice.issueDate)}</td>
                <td>{formatDateAU(invoice.dueDate)}</td>
                <td>
                  <StatusPill status={invoice.status} />
                </td>
                <td className="money">{money(dec(invoice.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 ? <p className="help">No invoices yet. Finish a job, then invoice it.</p> : null}
      </div>
    </>
  );
}
