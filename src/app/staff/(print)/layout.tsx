import { requireStaff } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <div className="print-page">{children}</div>;
}
