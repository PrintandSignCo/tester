"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/staff", label: "Today" },
  { href: "/staff/quotes", label: "Quotes" },
  { href: "/staff/jobs", label: "Jobs" },
  { href: "/staff/requests", label: "Requests" },
  { href: "/staff/invoices", label: "Invoices" },
  { href: "/staff/catalogue", label: "Catalogue" },
  { href: "/staff/clients", label: "Clients" },
  { href: "/staff/changelog", label: "What's changed" },
  { href: "/staff/audit", label: "History" },
  { href: "/staff/users", label: "Team", admin: true },
  { href: "/staff/account", label: "Account" },
];

export function StaffNav({ role }: { role: string }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.filter((link) => !link.admin || role === "ADMIN").map((link) => {
        const active = link.href === "/staff" ? pathname === "/staff" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={active ? "active" : ""}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
