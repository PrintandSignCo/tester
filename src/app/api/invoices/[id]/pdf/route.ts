import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { renderInvoicePdf } from "@/lib/pdf";
import { loadInvoiceBundle } from "@/server/load";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const pdf = await renderInvoicePdf(bundle.printable);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bundle.invoice.number}.pdf"`,
    },
  });
}
