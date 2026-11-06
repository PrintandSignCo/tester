import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { readArtwork } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const artwork = await prisma.artwork.findUnique({
    where: { id },
    include: { job: true, request: true },
  });
  if (!artwork) return NextResponse.json({ error: "File not found." }, { status: 404 });
  if (session.user.role === "CLIENT") {
    const clientId = session.user.clientId;
    const allowed = artwork.job?.clientId === clientId || artwork.request?.clientId === clientId;
    if (!allowed) return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const file = await readArtwork(artwork);
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${artwork.filename.replace(/"/g, "")}"`,
    },
  });
}
