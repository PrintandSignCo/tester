import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireClient } from "@/server/guards";

export const metadata = { title: "Your jobs" };

export default async function PortalHome() {
  const session = await requireClient();
  const clientId = session.user.clientId ?? "";
  const [quotes, jobs, requests] = await Promise.all([
    prisma.quote.count({ where: { clientId, status: { in: ["SENT", "ACCEPTED"] } } }),
    prisma.job.count({ where: { clientId, status: { not: "INVOICED" } } }),
    prisma.jobRequest.count({ where: { clientId, status: "NEW" } }),
  ]);
  const openQuote = await prisma.quote.findFirst({ where: { clientId, status: "SENT" }, orderBy: { updatedAt: "desc" } });
  return (
    <>
      <PageHeader title="Your work" lede="Quotes waiting on you, jobs in the workshop, and a place to send the next one." />
      <section className="grid-stats">
        <Link className="stat" href="/portal/quotes">
          <b>{quotes}</b>
          <span>Quotes you can see</span>
        </Link>
        <Link className="stat" href="/portal/jobs">
          <b>{jobs}</b>
          <span>Jobs still moving</span>
        </Link>
        <Link className="stat" href="/portal/requests">
          <b>{requests}</b>
          <span>Requests with the shop</span>
        </Link>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        {openQuote ? (
          <p>
            <StatusPill status="SENT" /> <Link href={`/portal/quotes/${openQuote.id}`}>{openQuote.number}</Link> is ready for you to accept.
          </p>
        ) : (
          <p>No quotes are waiting for acceptance.</p>
        )}
        <Link className="btn btn-primary" href="/portal/requests/new">
          Request a new job
        </Link>
      </section>
    </>
  );
}
