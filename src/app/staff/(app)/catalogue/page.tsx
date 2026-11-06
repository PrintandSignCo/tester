import { AuditList } from "@/components/audit-list";
import { Flash, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/format";
import { DEFAULT_RATES } from "@/lib/pricing";
import { METHOD_LABEL, type TierId } from "@/lib/types";
import { dec, loadRates, mapMethod } from "@/server/mappers";
import { addProduct, deleteProduct, updateProduct, updateShopRates, updateTier } from "@/server/shop-actions";
import { auth } from "@/auth";

export const metadata = { title: "Catalogue" };

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  const admin = session?.user?.role === "ADMIN";
  const [products, tiers, rates, history] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.tier.findMany({ orderBy: { sortOrder: "asc" } }),
    loadRates(),
    prisma.auditLog.findMany({ where: { entity: { in: ["PRODUCT", "TIER", "SHOP"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const tierName = (id: string) => tiers.find((tier) => tier.id === id)?.name ?? id;
  return (
    <>
      <PageHeader
        title="Catalogue"
        lede="Example prices are marked and are starters for the shop to replace. Markup is per tier. The printed quote does not name the tier."
        actions={
          <form action={addProduct}>
            <button className="btn btn-primary" type="submit">
              Add product
            </button>
          </form>
        }
      />
      <Flash error={sp.error} notice={sp.notice} />
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Pricing tiers</h2>
        <div className="form-grid">
          {tiers.map((tier) => (
            <form key={tier.id} action={updateTier} className="field">
              <span className="label">{tier.id === "t1" ? "Tier 1" : tier.id === "t2" ? "Tier 2" : "Tier 3"}</span>
              <input type="hidden" name="id" value={tier.id} />
              <input className="input" name="name" defaultValue={tier.name} disabled={!admin} />
              {admin ? (
                <button className="btn btn-small" type="submit">
                  Rename
                </button>
              ) : (
                <span className="help">Admins can rename tiers.</span>
              )}
            </form>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Shop rates</h2>
        <p className="help">Applied to every quote line, on top of material, markup and setup. GST stays at 10%.</p>
        <form action={updateShopRates} className="form-grid">
          <label className="field">
            <span className="label">Lamination / m²</span>
            <input className="input" name="laminationPerSqm" type="number" step="0.01" defaultValue={rates.laminationPerSqm} disabled={!admin} />
          </label>
          <label className="field">
            <span className="label">Eyelet each</span>
            <input className="input" name="eyeletEach" type="number" step="0.01" defaultValue={rates.eyeletEach} disabled={!admin} />
          </label>
          <label className="field">
            <span className="label">Install / hour</span>
            <input className="input" name="installPerHour" type="number" step="0.01" defaultValue={rates.installPerHour} disabled={!admin} />
          </label>
          <label className="field">
            <span className="label">Design / hour</span>
            <input className="input" name="designPerHour" type="number" step="0.01" defaultValue={rates.designPerHour} disabled={!admin} />
          </label>
          {admin ? (
            <button className="btn btn-primary" type="submit">
              Save rates
            </button>
          ) : null}
        </form>
        <p className="help">
          Seed defaults: lamination {money(DEFAULT_RATES.laminationPerSqm)}, eyelet {money(DEFAULT_RATES.eyeletEach)}, install {money(DEFAULT_RATES.installPerHour)}, design {money(DEFAULT_RATES.designPerHour)}.
        </p>
      </section>
      <div className="stack">
        {products.map((product) => (
          <form key={product.id} className="card stack" action={updateProduct}>
            <div className="split">
              <h2>
                {product.name} {product.examplePrice ? <span className="pill pill-amber">Example price</span> : null}
              </h2>
              <span className="help">{METHOD_LABEL[mapMethod(product.method)]}</span>
            </div>
            <input type="hidden" name="id" value={product.id} />
            <div className="form-grid">
              <label className="field">
                <span className="label">Name</span>
                <input className="input" name="name" defaultValue={product.name} />
              </label>
              <label className="field">
                <span className="label">Method</span>
                <select className="select" name="method" defaultValue={mapMethod(product.method)}>
                  <option value="sqm">Per m²</option>
                  <option value="unit">Per unit</option>
                  <option value="linear">Per linear metre</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Material cost</span>
                <input className="input" name="materialCost" type="number" step="0.01" defaultValue={dec(product.materialCost)} />
              </label>
              <label className="field">
                <span className="label">Setup / labour</span>
                <input className="input" name="labourSetup" type="number" step="0.01" defaultValue={dec(product.labourSetup)} />
              </label>
              <label className="field">
                <span className="label">Minimum charge</span>
                <input className="input" name="minCharge" type="number" step="0.01" defaultValue={dec(product.minCharge)} />
              </label>
              {(["t1", "t2", "t3"] as TierId[]).map((id) => (
                <label className="field" key={id}>
                  <span className="label">{tierName(id)} markup %</span>
                  <input className="input" name={id === "t1" ? "markupT1" : id === "t2" ? "markupT2" : "markupT3"} type="number" step="0.01" defaultValue={dec(id === "t1" ? product.markupT1 : id === "t2" ? product.markupT2 : product.markupT3)} />
                </label>
              ))}
            </div>
            <label className="checkline">
              <input type="checkbox" name="examplePrice" defaultChecked={product.examplePrice} /> Example price
            </label>
            <label className="checkline">
              <input type="checkbox" name="active" defaultChecked={product.active} /> Active
            </label>
            <div className="toolbar">
              <button className="btn btn-primary" type="submit">
                Save product
              </button>
              <button className="btn btn-danger" type="submit" formAction={deleteProduct}>
                Delete
              </button>
            </div>
          </form>
        ))}
      </div>
      <h2 style={{ marginTop: 28 }}>Price history</h2>
      <AuditList entries={history} />
    </>
  );
}
