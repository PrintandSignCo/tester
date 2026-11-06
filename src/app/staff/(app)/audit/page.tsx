import Link from "next/link";
import { AuditList } from "@/components/audit-list";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";

export const metadata = { title: "History" };

const FILTERS = [
  { href: "/staff/audit", label: "All", entity: "" },
  { href: "/staff/audit?entity=QUOTE", label: "Quotes", entity: "QUOTE" },
  { href: "/staff/audit?entity=PRODUCT", label: "Prices", entity: "PRODUCT" },
  { href: "/staff/audit?entity=JOB", label: "Jobs", entity: "JOB" },
  { href: "/staff/audit?entity=SHOP", label: "Shop rates", entity: "SHOP" },
];

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const sp = await searchParams;
  const entity = ["QUOTE", "PRODUCT", "TIER", "SHOP", "JOB"].includes(sp.entity ?? "") ? sp.entity : "";
  const entries = await prisma.auditLog.findMany({
    where: entity ? { entity: entity as "QUOTE" } : {},
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return (
    <>
      <PageHeader title="History" lede="Server-side record of quote and price changes: who, when, and the old value next to the new one." />
      <div className="filters">
        {FILTERS.map((filter) => (
          <Link key={filter.href} className="btn btn-small btn-ghost" href={filter.href}>
            {filter.label}
          </Link>
        ))}
      </div>
      <AuditList entries={entries} />
    </>
  );
}
