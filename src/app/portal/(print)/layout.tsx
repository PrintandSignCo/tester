import { requireClient } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function PortalPrintLayout({ children }: { children: React.ReactNode }) {
  await requireClient();
  return <div className="print-page">{children}</div>;
}
