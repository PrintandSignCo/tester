import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { storeArtwork } from "@/lib/storage";
import { artworkExtension, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Staff sign-in is required." }, { status: 401 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const jobId = String(form.get("jobId") ?? "");
  const requestId = String(form.get("requestId") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (!artworkExtension(file.name)) {
    return NextResponse.json({ error: "Use a PDF, AI, EPS, PNG or JPG file." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Files need to be 80 MB or smaller." }, { status: 400 });

  let folderName = "artwork";
  if (jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    folderName = job.number;
  } else if (requestId) {
    const jobRequest = await prisma.jobRequest.findUnique({ where: { id: requestId } });
    if (!jobRequest) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    folderName = jobRequest.number;
  } else {
    return NextResponse.json({ error: "Choose a job or request." }, { status: 400 });
  }

  const stored = await storeArtwork({
    filename: file.name,
    mime: file.type || "application/octet-stream",
    body: Buffer.from(await file.arrayBuffer()),
    folderName,
  });
  await prisma.artwork.create({
    data: {
      filename: file.name,
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storageKey: stored.storageKey,
      driver: stored.driver,
      boxFileId: stored.boxFileId,
      boxFolderId: stored.boxFolderId,
      jobId: jobId || null,
      requestId: requestId || null,
      uploadedById: session.user.id,
    },
  });
  return NextResponse.json({ ok: true });
}
