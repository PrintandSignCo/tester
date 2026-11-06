import Link from "next/link";
import { Flash, NewBadge, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateAU } from "@/lib/format";
import { storageStatus } from "@/lib/storage";
import { webhookConfigured, xeroConfigured } from "@/lib/xero";

export const metadata = { title: "Today" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const [newRequests, quotes, jobs, finished, recentQuotes, changelog] = await Promise.all([
    prisma.jobRequest.count({ where: { status: "NEW" } }),
    prisma.quote.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.job.count({ where: { status: "FINISHED" } }),
    prisma.quote.findMany({ orderBy: { updatedAt: "desc" }, take: 6, include: { tier: true } }),
    prisma.changelogEntry.findMany({ orderBy: { releasedAt: "desc" }, take: 3 }),
  ]);
  const quoteCount = (status: string) => quotes.find((row) => row.status === status)?._count._all ?? 0;
  const jobCount = (status: string) => jobs.find((row) => row.status === status)?._count._all ?? 0;
  const storage = storageStatus();
  return (
    <>
      <PageHeader title="Today" lede="What is waiting on the bench at 48 Edward Street." />
      <Flash error={sp.error} notice={sp.notice} />
      <section className="grid-stats">
        <Link className="stat" href="/staff/requests">
          <b>{newRequests}</b>
          <span>New job requests</span>
        </Link>
        <Link className="stat" href="/staff/quotes">
          <b>{quoteCount("DRAFT") + quoteCount("SENT")}</b>
          <span>Open quotes</span>
        </Link>
        <Link className="stat" href="/staff/jobs">
          <b>{jobCount("IN_PRODUCTION")}</b>
          <span>In production</span>
        </Link>
        <Link className="stat" href="/staff/jobs">
          <b>{finished}</b>
          <span>Finished, ready to invoice</span>
        </Link>
      </section>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <section className="card">
          <h2>Recent quotes</h2>
          <div className="stack">
            {recentQuotes.map((quote) => (
              <Link key={quote.id} href={`/staff/quotes/${quote.id}`}>
                <strong>{quote.number}</strong> · {quote.customer || "No customer yet"} <StatusPill status={quote.status} />
                <div className="help">{formatDateAU(quote.date)}</div>
              </Link>
            ))}
            {recentQuotes.length === 0 ? <p className="help">No quotes yet.</p> : null}
          </div>
        </section>
        <section className="stack">
          <article className="card">
            <h2>Connections</h2>
            <p>{xeroConfigured() ? "Xero custom connection is configured." : "Xero is not connected. Invoices can still be downloaded as JSON."}</p>
            <p>{webhookConfigured() ? "Job board webhook is configured." : "Job board webhook is not connected. Jobs can still be downloaded as JSON."}</p>
            <p>
              Artwork: {storage.label}
              {storage.configured ? "" : " — environment variables are incomplete."}
            </p>
          </article>
          <article className="card">
            <h2>What&apos;s changed</h2>
            {changelog.map((entry) => (
              <p key={entry.id}>
                <NewBadge when={entry.releasedAt} /> <strong>{entry.version}</strong> {entry.title}
              </p>
            ))}
            <Link href="/staff/changelog">Open the changelog</Link>
          </article>
        </section>
      </div>
    </>
  );
}
