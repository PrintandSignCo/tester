import { notFound } from "next/navigation";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { bytes, formatDateAU } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
import { requireClient } from "@/server/guards";
import { dec } from "@/server/mappers";

export const metadata = { title: "Job" };

export default async function PortalJob({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClient();
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, clientId: session.user.clientId ?? "" },
    include: { lines: { orderBy: { sortOrder: "asc" } }, artworks: true },
  });
  if (!job) notFound();
  return (
    <>
      <PageHeader title={job.number} lede={job.dueDate ? `Due ${formatDateAU(job.dueDate)}` : "Due date still to be set"} actions={<StatusPill status={job.status as JobStatus} />} />
      <section className="card">
        {job.notes ? <p>{job.notes}</p> : null}
        <ul>
          {job.lines.map((line) => (
            <li key={line.id}>
              {line.description} · qty {dec(line.qty)} · {dec(line.widthMm)} × {dec(line.heightMm)} mm
            </li>
          ))}
        </ul>
      </section>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Artwork</h2>
        {job.artworks.map((file) => (
          <p key={file.id}>
            <a href={`/api/artwork/${file.id}`}>{file.filename}</a> <span className="help">{bytes(file.sizeBytes)}</span>
          </p>
        ))}
        {job.artworks.length === 0 ? <p className="help">No artwork on this job yet.</p> : null}
      </section>
    </>
  );
}
