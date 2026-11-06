import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseDateOnly } from "@/lib/format";
import { nextNumber } from "@/lib/sequence";
import { storeArtwork } from "@/lib/storage";
import { artworkExtension, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CLIENT" || !session.user.clientId) {
    return NextResponse.json({ error: "Sign in to the client portal." }, { status: 401 });
  }
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  let material = String(form.get("material") ?? "").trim();
  if (material === "Other") material = String(form.get("materialOther") ?? "").trim() || "Other";
  const widthMm = Number(form.get("widthMm"));
  const heightMm = Number(form.get("heightMm"));
  const qty = Number(form.get("qty"));
  const due = String(form.get("dueDate") ?? "");
  const notes = String(form.get("notes") ?? "").trim();
  if (!title || !Number.isFinite(widthMm) || !Number.isFinite(heightMm) || !Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Add a title, size and quantity." }, { status: 400 });
  }
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  for (const file of files) {
    if (!artworkExtension(file.name)) {
      return NextResponse.json({ error: `${file.name} needs to be a PDF, AI, EPS, PNG or JPG.` }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `${file.name} is over 80 MB.` }, { status: 400 });
    }
  }
  const created = await prisma.jobRequest.create({
    data: {
      number: await nextNumber("REQ"),
      clientId: session.user.clientId,
      title,
      material,
      widthMm,
      heightMm,
      qty,
      dueDate: due ? parseDateOnly(due) : null,
      notes,
    },
  });
  try {
    for (const file of files) {
      const stored = await storeArtwork({
        filename: file.name,
        mime: file.type || "application/octet-stream",
        body: Buffer.from(await file.arrayBuffer()),
        folderName: created.number,
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
          requestId: created.id,
          uploadedById: session.user.id,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Artwork could not be stored.";
    return NextResponse.json({ id: created.id, error: `Request saved, but artwork failed: ${message}` }, { status: 500 });
  }
  return NextResponse.json({ id: created.id });
}
