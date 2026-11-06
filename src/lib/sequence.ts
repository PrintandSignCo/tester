import { prisma } from "@/lib/db";
import { perthYear } from "@/lib/format";

export async function nextNumber(kind: "Q" | "JOB" | "INV" | "REQ"): Promise<string> {
  const year = perthYear();
  const prefix = `${kind}-${year}-`;
  const rows =
    kind === "Q"
      ? await prisma.quote.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } })
      : kind === "JOB"
        ? await prisma.job.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } })
        : kind === "INV"
          ? await prisma.invoice.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } })
          : await prisma.jobRequest.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } });
  let max = 0;
  const re = new RegExp(`^${kind}-${year}-(\\d+)$`);
  for (const row of rows) {
    const match = re.exec(row.number);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
