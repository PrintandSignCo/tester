import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadInvoiceBundle } from "@/server/load";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(JSON.stringify(bundle.xero, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${bundle.invoice.number}-xero.json"`,
    },
  });
}
