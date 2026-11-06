import { Flash, NewBadge, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatPerth } from "@/lib/format";
import { addChangelog } from "@/server/shop-actions";
import { auth } from "@/auth";

export const metadata = { title: "What's changed" };

export default async function ChangelogPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const entries = await prisma.changelogEntry.findMany({ orderBy: { releasedAt: "desc" } });
  return (
    <>
      <PageHeader title="What's changed" lede="Shared with the whole shop, newest first. Anything from the last 7 days is marked New." />
      <Flash error={sp.error} notice={sp.notice} />
      <div className="stack">
        {entries.map((entry) => (
          <article key={entry.id} className="card changelog">
            <div className="split">
              <h2>
                {entry.version} · {entry.title} <NewBadge when={entry.releasedAt} />
              </h2>
              <span className="help">{formatPerth(entry.releasedAt)}</span>
            </div>
            <p>{entry.detail}</p>
            <p className="help">Requested by {entry.requestedBy}</p>
          </article>
        ))}
      </div>
      {session?.user?.role === "ADMIN" ? (
        <form className="card stack" action={addChangelog} style={{ marginTop: 16 }}>
          <h2>Add an entry</h2>
          <div className="form-grid">
            <label className="field">
              <span className="label">Version</span>
              <input className="input" name="version" placeholder="v6" required />
            </label>
            <label className="field">
              <span className="label">Requested by</span>
              <input className="input" name="requestedBy" defaultValue="Rob" />
            </label>
          </div>
          <label className="field">
            <span className="label">Title</span>
            <input className="input" name="title" required />
          </label>
          <label className="field">
            <span className="label">Detail</span>
            <textarea name="detail" required />
          </label>
          <button className="btn btn-primary" type="submit">Publish</button>
        </form>
      ) : null}
    </>
  );
}
