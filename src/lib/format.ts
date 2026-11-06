export const PERTH = "Australia/Perth";

export function money(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number.isFinite(n) ? n : 0);
}

export function moneyPlain(n: number): string {
  return money(n).replace(/[\u00a0\u202f]/g, " ");
}

export function sqm(n: number): string {
  return `${n.toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} m²`;
}

export function perthTodayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PERTH,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function formatDateAU(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatPerth(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return (
    new Intl.DateTimeFormat("en-AU", {
      timeZone: PERTH,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date) + " Perth"
  );
}

export function isWithinLastDays(value: Date, days: number, now = new Date()): boolean {
  const t = value.getTime();
  if (Number.isNaN(t)) return false;
  const age = now.getTime() - t;
  return age <= days * 24 * 60 * 60 * 1000 && age >= -60 * 1000;
}

export function perthYear(now = new Date()): number {
  return Number(perthTodayISO(now).slice(0, 4));
}

export function clientLabel(name: string, company: string): string {
  const n = name.trim();
  const c = company.trim();
  if (n && c) return `${n} — ${c}`;
  return n || c || "Customer";
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
