import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatPerth } from "@/lib/format";
import { requireClient } from "@/server/guards";

export const metadata = { title: "Your requests" };

export default async function PortalRequests() {
  const session = await requireClient();
  const requests = await prisma.jobRequest.findMany({
    where: { clientId: session.user.clientId ?? "" },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader
        title="Requests"
        lede="Jobs you have asked the shop to price or make."
        actions={
          <Link className="btn btn-primary" href="/portal/requests/new">
            New request
          </Link>
        }
      />
      <div className="stack">
        {requests.map((request) => (
          <Link key={request.id} className="card" href={`/portal/requests/${request.id}`}>
            <strong>{request.number}</strong> <StatusPill status={request.status} /> {request.title}
            <div className="help">{formatPerth(request.createdAt)}</div>
          </Link>
        ))}
        {requests.length === 0 ? <p className="help">You have not sent a request yet.</p> : null}
      </div>
    </>
  );
}
