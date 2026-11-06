import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtworkUploader } from "@/components/artwork-uploader";
import { Flash, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { bytes, clientLabel, formatDateAU } from "@/lib/format";
import { closeRequest, deleteArtwork, jobFromRequest, quoteFromRequest } from "@/server/shop-actions";
import { dec } from "@/server/mappers";

export const metadata = { title: "Job request" };

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const request = await prisma.jobRequest.findUnique({ where: { id }, include: { client: true, artworks: true, quote: true, job: true } });
  if (!request) notFound();
  return (
    <>
      <PageHeader
        title={request.number}
        lede={request.title}
        actions={
          <>
            <StatusPill status={request.status} />
            {request.quote ? <Link href={`/staff/quotes/${request.quote.id}`}>Open {request.quote.number}</Link> : (
              <form action={quoteFromRequest}>
                <input type="hidden" name="id" value={request.id} />
                <button className="btn btn-primary" type="submit">Create quote</button>
              </form>
            )}
            {request.job ? <Link href={`/staff/jobs/${request.job.id}`}>Open {request.job.number}</Link> : (
              <form action={jobFromRequest}>
                <input type="hidden" name="id" value={request.id} />
                <button className="btn btn-ghost" type="submit">Convert to job</button>
              </form>
            )}
            {request.status !== "CLOSED" ? (
              <form action={closeRequest}>
                <input type="hidden" name="id" value={request.id} />
                <button className="btn btn-danger" type="submit">Close</button>
              </form>
            ) : null}
          </>
        }
      />
      <Flash error={sp.error} notice={sp.notice} />
      <section className="card">
        <p>
          <strong>{clientLabel(request.client.name, request.client.company)}</strong>
          <br />
          {request.client.email} {request.client.phone ? `· ${request.client.phone}` : ""}
        </p>
        <p>
          {request.material || "Material not specified"} · {dec(request.widthMm)} × {dec(request.heightMm)} mm · qty {dec(request.qty)}
        </p>
        <p>Needed by {request.dueDate ? formatDateAU(request.dueDate) : "no date given"}</p>
        <p>{request.notes || "No extra notes."}</p>
      </section>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Artwork</h2>
        {request.artworks.map((file) => (
          <div className="split" key={file.id}>
            <a href={`/api/artwork/${file.id}`}>{file.filename}</a>
            <span className="help">{bytes(file.sizeBytes)} · {file.driver}</span>
            <form action={deleteArtwork}>
              <input type="hidden" name="id" value={file.id} />
              <button className="btn btn-danger btn-small" type="submit">Remove</button>
            </form>
          </div>
        ))}
        <ArtworkUploader requestId={request.id} />
      </section>
    </>
  );
}
