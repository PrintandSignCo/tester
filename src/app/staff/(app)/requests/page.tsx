import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { clientLabel, formatDateAU, formatPerth } from "@/lib/format";

export const metadata = { title: "Job requests" };

export default async function RequestsPage() {
  const requests = await prisma.jobRequest.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Job requests" lede="Sent from the client portal, with artwork. Quote them or turn them straight into a job." />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Client</th>
              <th>Job</th>
              <th>Needed</th>
              <th>Status</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>
                  <Link href={`/staff/requests/${request.id}`}>{request.number}</Link>
                  <div className="help">{request.title}</div>
                </td>
                <td>{clientLabel(request.client.name, request.client.company)}</td>
                <td>
                  {request.material} · {String(request.widthMm)} × {String(request.heightMm)} mm · qty {String(request.qty)}
                </td>
                <td>{request.dueDate ? formatDateAU(request.dueDate) : "—"}</td>
                <td>
                  <StatusPill status={request.status} />
                </td>
                <td>{formatPerth(request.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 ? <p className="help">No requests yet.</p> : null}
      </div>
    </>
  );
}
