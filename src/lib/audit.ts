import { prisma } from "@/lib/db";
import type { FieldChange } from "@/lib/types";

export async function writeAudit(input: {
  entity: "QUOTE" | "PRODUCT" | "TIER" | "SHOP" | "JOB";
  entityId: string;
  entityRef: string;
  summary: string;
  changes: FieldChange[];
  actorId: string | null;
  actorName: string;
}) {
  if (input.changes.length === 0) return;
  await prisma.auditLog.create({
    data: {
      entity: input.entity,
      entityId: input.entityId,
      entityRef: input.entityRef,
      summary: input.summary,
      details: input.changes,
      actorId: input.actorId,
      actorName: input.actorName,
    },
  });
}

export function readChanges(value: unknown): FieldChange[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { field?: unknown; old?: unknown; new?: unknown };
    if (typeof row.field !== "string") return [];
    return [{ field: row.field, old: String(row.old ?? ""), new: String(row.new ?? "") }];
  });
}
