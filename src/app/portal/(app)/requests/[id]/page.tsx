import { notFound } from "next/navigation";
import Link from "next/link";
import { Flash, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { bytes, formatDateAU } from "@/lib/format";
import { requireClient } from "@/server/guards";
import { dec } from "@/server/mappers";

export const metadata = { title: "Request" };

export default async function PortalRequest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const session = await requireClient();
  const { id } = await params;
  const sp = await searchParams;
  const request = await prisma.jobRequest.findFirst({
    where: { id, clientId: session.user.clientId ?? "" },
    include: { artworks: true, quote: true, job: true },
  });
  if (!request) notFound();
  return (
    <>
      <PageHeader title={request.number} lede={request.title} actions={<StatusPill status={request.status} />} />
      <Flash notice={sp.notice} error={sp.error} />
      <section className="card">
        <p>
          {request.material} · {dec(request.widthMm)} × {dec(request.heightMm)} mm · qty {dec(request.qty)}
        </p>
        <p>Needed by {request.dueDate ? formatDateAU(request.dueDate) : "no date"}</p>
        <p>{request.notes || "No extra notes."}</p>
        {request.quote && request.quote.status !== "DRAFT" ? <p><Link href={`/portal/quotes/${request.quote.id}`}>Quote {request.quote.number}</Link></p> : <p className="help">The shop is preparing a quote.</p>}
        {request.job ? <p><Link href={`/portal/jobs/${request.job.id}`}>Job {request.job.number}</Link></p> : null}
      </section>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Artwork</h2>
        {request.artworks.map((file) => (
          <p key={file.id}>
            <a href={`/api/artwork/${file.id}`}>{file.filename}</a> <span className="help">{bytes(file.sizeBytes)}</span>
          </p>
        ))}
        {request.artworks.length === 0 ? <p className="help">No artwork uploaded.</p> : null}
      </section>
    </>
  );
}
