import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateAU, perthTodayISO } from "@/lib/format";
import { JOB_STATUSES, JOB_STATUS_LABEL, type JobStatus } from "@/lib/types";
import { updateJob } from "@/server/shop-actions";
import { formatDateOnly } from "@/lib/format";

export const metadata = { title: "Jobs" };

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({ orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], include: { lines: true } });
  const today = perthTodayISO();
  return (
    <>
      <PageHeader title="Jobs" lede="Not started, in production, finished, then invoiced. Due dates are Perth dates." />
      <div className="kanban">
        {JOB_STATUSES.map((status) => (
          <section className="column" key={status}>
            <h2>{JOB_STATUS_LABEL[status]}</h2>
            <div className="stack">
              {jobs.filter((job) => job.status === status).map((job) => {
                const due = formatDateOnly(job.dueDate);
                const overdue = Boolean(due && due < today && status !== "FINISHED" && status !== "INVOICED");
                return (
                  <article className="job-card" key={job.id}>
                    <div className="split">
                      <h3>
                        <Link href={`/staff/jobs/${job.id}`}>{job.number}</Link>
                      </h3>
                      <StatusPill status={job.status as JobStatus} />
                    </div>
                    <div>{job.clientName}</div>
                    <div className="help">{job.lines.length} line{job.lines.length === 1 ? "" : "s"}</div>
                    <div className={overdue ? "overdue" : "help"}>{due ? `Due ${formatDateAU(due)}` : "No due date"}{overdue ? " · overdue" : ""}</div>
                    <form action={updateJob} className="stack">
                      <input type="hidden" name="id" value={job.id} />
                      <select className="select" name="status" defaultValue={job.status}>
                        {JOB_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {JOB_STATUS_LABEL[option]}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-small" type="submit">
                        Move
                      </button>
                    </form>
                  </article>
                );
              })}
              {jobs.every((job) => job.status !== status) ? <p className="help">Nothing in this stage.</p> : null}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
