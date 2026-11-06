import { Flash, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { createPortalLogin, deleteClient, saveClient } from "@/server/shop-actions";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const [clients, tiers] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, include: { tier: true, users: true } }),
    prisma.tier.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Clients" lede="Each client has a pricing tier. Quotes pick it up automatically." />
      <Flash error={sp.error} notice={sp.notice} />
      <form className="card form-grid" action={saveClient} style={{ marginBottom: 16 }}>
        <h2 style={{ gridColumn: "1 / -1" }}>Add a client</h2>
        <label className="field">
          <span className="label">Name</span>
          <input className="input" name="name" required />
        </label>
        <label className="field">
          <span className="label">Company</span>
          <input className="input" name="company" />
        </label>
        <label className="field">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" />
        </label>
        <label className="field">
          <span className="label">Phone</span>
          <input className="input" name="phone" />
        </label>
        <label className="field">
          <span className="label">Tier</span>
          <select className="select" name="tierId" defaultValue="t1">
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          Add client
        </button>
      </form>
      <div className="stack">
        {clients.map((client) => (
          <article key={client.id} className="card stack">
            <form action={saveClient} className="form-grid">
              <input type="hidden" name="id" value={client.id} />
              <label className="field">
                <span className="label">Name {client.example ? "· example" : ""}</span>
                <input className="input" name="name" defaultValue={client.name} />
              </label>
              <label className="field">
                <span className="label">Company</span>
                <input className="input" name="company" defaultValue={client.company} />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input className="input" name="email" defaultValue={client.email} />
              </label>
              <label className="field">
                <span className="label">Phone</span>
                <input className="input" name="phone" defaultValue={client.phone} />
              </label>
              <label className="field">
                <span className="label">Tier</span>
                <select className="select" name="tierId" defaultValue={client.tierId}>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="toolbar">
                <button className="btn btn-primary" type="submit">
                  Save
                </button>
                <button className="btn btn-danger" type="submit" formAction={deleteClient}>
                  Delete
                </button>
              </div>
            </form>
            {client.users.length > 0 ? (
              <p className="help">Portal login: {client.users.map((user) => user.email).join(", ")}</p>
            ) : (
              <form action={createPortalLogin} className="form-grid">
                <input type="hidden" name="clientId" value={client.id} />
                <label className="field">
                  <span className="label">Portal email</span>
                  <input className="input" name="email" type="email" defaultValue={client.email} />
                </label>
                <label className="field">
                  <span className="label">Temporary password</span>
                  <input className="input" name="password" type="text" minLength={8} />
                </label>
                <button className="btn btn-ghost" type="submit">
                  Create portal login
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
