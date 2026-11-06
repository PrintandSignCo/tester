import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildJobBoardPayload } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { formatDateOnly } from "@/lib/format";
import { dec } from "@/server/mappers";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const job = await prisma.job.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const payload = buildJobBoardPayload({
    jobNumber: job.number,
    clientName: job.clientName,
    clientCompany: job.clientCompany,
    clientEmail: job.clientEmail,
    dueDate: job.dueDate ? formatDateOnly(job.dueDate) : null,
    notes: job.notes,
    quoteNumber: job.quoteNumber,
    items: job.lines.map((line) => ({
      description: line.description,
      widthMm: dec(line.widthMm),
      heightMm: dec(line.heightMm),
      qty: dec(line.qty),
    })),
  });
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${job.number}-job-board.json"`,
    },
  });
}
