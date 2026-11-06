import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateAU } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
import { requireClient } from "@/server/guards";

export const metadata = { title: "Your jobs" };

export default async function PortalJobs() {
  const session = await requireClient();
  const jobs = await prisma.job.findMany({ where: { clientId: session.user.clientId ?? "" }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Jobs" lede="Where each accepted job sits in the workshop." />
      <div className="stack">
        {jobs.map((job) => (
          <Link key={job.id} className="card" href={`/portal/jobs/${job.id}`}>
            <strong>{job.number}</strong> <StatusPill status={job.status as JobStatus} />
            <div className="help">{job.dueDate ? `Due ${formatDateAU(job.dueDate)}` : "No due date yet"}</div>
          </Link>
        ))}
        {jobs.length === 0 ? <p className="help">No jobs yet.</p> : null}
      </div>
    </>
  );
}
