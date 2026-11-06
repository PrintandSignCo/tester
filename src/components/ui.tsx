import Link from "next/link";
import { logoutAction } from "@/server/auth-actions";
import {
  INVOICE_STATUS_LABEL,
  JOB_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
} from "@/lib/types";

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions no-print">{actions}</div> : null}
    </header>
  );
}

export function Flash({ notice, error }: { notice?: string; error?: string }) {
  if (error) return <div className="flash flash-error">{error}</div>;
  if (notice) return <div className="flash">{notice}</div>;
  return null;
}

const TONE: Record<string, string> = {
  DRAFT: "muted",
  SENT: "sent",
  ACCEPTED: "accepted",
  NOT_STARTED: "muted",
  IN_PRODUCTION: "production",
  FINISHED: "teal",
  INVOICED: "good",
  SENT_TO_XERO: "teal",
  NEW: "amber",
  QUOTED: "sent",
  CONVERTED: "good",
  CLOSED: "muted",
};

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { ...QUOTE_STATUS_LABEL, ...JOB_STATUS_LABEL, ...INVOICE_STATUS_LABEL, NEW: "New", QUOTED: "Quoted", CONVERTED: "Converted", CLOSED: "Closed" };
  return <span className={`pill pill-${TONE[status] ?? "muted"}`}>{labels[status] ?? status}</span>;
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button className="btn btn-ghost btn-small" type="submit">
        Sign out
      </button>
    </form>
  );
}

export function NewBadge({ when, now = Date.now() }: { when: Date; now?: number }) {
  const age = now - when.getTime();
  if (age > 7 * 24 * 60 * 60 * 1000 || age < -60_000) return null;
  return <span className="pill pill-new">New</span>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="btn btn-ghost btn-small no-print" href={href}>
      {children}
    </Link>
  );
}
