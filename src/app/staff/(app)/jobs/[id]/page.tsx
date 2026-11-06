import Link from "next/link";
import { ArtworkUploader } from "@/components/artwork-uploader";
import { Flash, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { bytes, formatDateAU, formatDateOnly, money } from "@/lib/format";
import { JOB_STATUSES, JOB_STATUS_LABEL, type JobStatus } from "@/lib/types";
import { notFound } from "next/navigation";
import { webhookConfigured } from "@/lib/xero";
import { createInvoice, deleteArtwork, sendJobToBoard, updateJob, updateJobLinePrice } from "@/server/shop-actions";
import { dec } from "@/server/mappers";

export const metadata = { title: "Job" };

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { lines: { orderBy: { sortOrder: "asc" } }, artworks: true, invoice: true, exports: { orderBy: { createdAt: "desc" }, take: 3 } },
  });
  if (!job) notFound();
  const exGst = job.lines.reduce((sum, line) => sum + dec(line.qty) * dec(line.unitAmount), 0);
  return (
    <>
      <PageHeader
        title={job.number}
        lede={`${job.clientName}${job.clientCompany ? ` — ${job.clientCompany}` : ""}`}
        actions={
          <>
            <StatusPill status={job.status as JobStatus} />
            {job.quoteId ? <Link href={`/staff/quotes/${job.quoteId}`}>Quote {job.quoteNumber}</Link> : null}
            <a className="btn btn-ghost" href={`/api/jobs/${job.id}/export`}>
              Download job JSON
            </a>
            {webhookConfigured() ? (
              <form action={sendJobToBoard}>
                <input type="hidden" name="id" value={job.id} />
                <button className="btn btn-primary" type="submit">
                  Send to job board
                </button>
              </form>
            ) : (
              <span className="help">Job board webhook is not connected.</span>
            )}
          </>
        }
      />
      <Flash error={sp.error} notice={sp.notice} />
      <div className="grid-2">
        <section className="stack">
          <form className="card stack" action={updateJob}>
            <input type="hidden" name="id" value={job.id} />
            <label className="field">
              <span className="label">Stage</span>
              <select className="select" name="status" defaultValue={job.status}>
                {JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {JOB_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Due date</span>
              <input className="input" type="date" name="dueDate" defaultValue={formatDateOnly(job.dueDate)} />
            </label>
            <label className="field">
              <span className="label">Notes</span>
              <textarea name="notes" defaultValue={job.notes} />
            </label>
            <button className="btn btn-primary" type="submit">
              Save job
            </button>
          </form>
          <section className="card">
            <h2>Lines</h2>
            {job.lines.map((line) => (
              <article key={line.id} className="stack" style={{ marginBottom: 12 }}>
                <div>
                  <strong>{line.description}</strong>
                  <div className="help">
                    {dec(line.widthMm)} × {dec(line.heightMm)} mm · qty {dec(line.qty)}
                    {line.note ? ` · ${line.note}` : ""}
                  </div>
                </div>
                <form className="toolbar" action={updateJobLinePrice}>
                  <input type="hidden" name="lineId" value={line.id} />
                  <label className="field">
                    <span className="label">Unit ex GST</span>
                    <input className="input" type="number" step="0.01" min={0} name="unitAmount" defaultValue={dec(line.unitAmount)} />
                  </label>
                  <button className="btn btn-small" type="submit" disabled={Boolean(job.invoice)}>
                    Save price
                  </button>
                </form>
              </article>
            ))}
            <p>
              Estimated ex GST {money(exGst)} · GST {money(exGst * 0.1)} · inc GST {money(exGst * 1.1)}
            </p>
          </section>
        </section>
        <section className="stack">
          <article className="card stack">
            <h2>Artwork</h2>
            {job.artworks.map((file) => (
              <div className="split" key={file.id}>
                <a href={`/api/artwork/${file.id}`}>{file.filename}</a>
                <span className="help">
                  {bytes(file.sizeBytes)} · {file.driver}
                </span>
                <form action={deleteArtwork}>
                  <input type="hidden" name="id" value={file.id} />
                  <button className="btn btn-danger btn-small" type="submit">
                    Remove
                  </button>
                </form>
              </div>
            ))}
            {job.artworks.length === 0 ? <p className="help">No artwork attached yet.</p> : null}
            <ArtworkUploader jobId={job.id} />
          </article>
          <article className="card stack">
            <h2>Invoice</h2>
            {job.invoice ? (
              <Link href={`/staff/invoices/${job.invoice.id}`}>Open {job.invoice.number}</Link>
            ) : job.status === "FINISHED" || job.status === "INVOICED" ? (
              <form action={createInvoice}>
                <input type="hidden" name="jobId" value={job.id} />
                <button className="btn btn-primary" type="submit">
                  Create invoice
                </button>
                <p className="help">GST 10%, due 14 days after the issue date.</p>
              </form>
            ) : (
              <p className="help">Mark the job Finished before invoicing.</p>
            )}
          </article>
          <article className="card">
            <h2>Job board</h2>
            <p className="help">JSON includes jobNumber, client, items (description, widthMm, heightMm, qty), dueDate, notes and quoteNumber.</p>
            {job.exports.map((item) => (
              <p key={item.id} className="help">
                {formatDateAU(item.createdAt)} · {item.ok ? "Sent" : "Failed"} {item.response ? `· ${item.response.slice(0, 140)}` : ""}
              </p>
            ))}
          </article>
        </section>
      </div>
    </>
  );
}
