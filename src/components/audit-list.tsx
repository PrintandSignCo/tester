import { readChanges } from "@/lib/audit";
import { formatPerth } from "@/lib/format";

export function AuditList({
  entries,
}: {
  entries: { id: string; createdAt: Date; actorName: string; summary: string; entityRef: string; details: unknown }[];
}) {
  if (entries.length === 0) return <p className="help">No changes recorded yet.</p>;
  return (
    <div className="stack">
      {entries.map((entry) => {
        const changes = readChanges(entry.details);
        return (
          <article key={entry.id} className="card">
            <div className="split">
              <strong>
                {entry.summary}
                {entry.entityRef ? ` · ${entry.entityRef}` : ""}
              </strong>
              <span className="help">
                {entry.actorName} · {formatPerth(entry.createdAt)}
              </span>
            </div>
            {changes.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Old</th>
                      <th>New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.map((change, index) => (
                      <tr key={`${change.field}-${index}`}>
                        <td>{change.field}</td>
                        <td>{change.old}</td>
                        <td>{change.new}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
