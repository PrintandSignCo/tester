"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal", label: "Home" },
  { href: "/portal/quotes", label: "Quotes" },
  { href: "/portal/jobs", label: "Jobs" },
  { href: "/portal/requests", label: "Requests" },
  { href: "/portal/account", label: "Account" },
];

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((link) => {
        const active = link.href === "/portal" ? pathname === "/portal" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={active ? "active" : ""}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
