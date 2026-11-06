import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { renderQuotePdf } from "@/lib/pdf";
import { loadQuoteBundle } from "@/server/load";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const bundle = await loadQuoteBundle(id);
  if (!session?.user || !bundle) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (session.user.role === "CLIENT") {
    if (bundle.quote.clientId !== session.user.clientId || bundle.quote.status === "DRAFT") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }
  const pdf = await renderQuotePdf(bundle.printable);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bundle.quote.number}.pdf"`,
    },
  });
}
