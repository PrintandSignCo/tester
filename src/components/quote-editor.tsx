"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientLabel, money } from "@/lib/format";
import { calcLine, measureLabel } from "@/lib/pricing";
import { saveQuote } from "@/server/quote-actions";
import {
  METHOD_LABEL,
  QUOTE_STATUS_LABEL,
  type ClientOption,
  type LineInput,
  type OptionRates,
  type ProductRates,
  type QuoteSnapshot,
  type QuoteStatus,
  type TierOption,
} from "@/lib/types";

export function QuoteEditor(props: {
  quoteId: string;
  locked: boolean;
  initial: QuoteSnapshot;
  products: ProductRates[];
  clients: ClientOption[];
  tiers: TierOption[];
  rates: OptionRates;
}) {
  const router = useRouter();
  const [quote, setQuote] = useState(props.initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const disabled = props.locked || pending;

  const rows = useMemo(
    () =>
      quote.lines.map((line) => {
        const product = props.products.find((item) => item.id === line.productId) ?? props.products[0];
        return { line, product, breakdown: calcLine(product, line, quote.tierId, props.rates) };
      }),
    [quote, props.products, props.rates],
  );
  const subtotal = rows.reduce((sum, row) => sum + (row.breakdown?.total ?? 0), 0);
  const gst = subtotal * 0.1;
  const grand = subtotal + gst;
  const selected = props.clients.find((client) => client.id === quote.clientId);
  const tierName = props.tiers.find((tier) => tier.id === quote.tierId)?.name ?? "Retail";
  const clientTier = selected ? props.tiers.find((tier) => tier.id === selected.tierId)?.name : "";
  const example = rows.some((row) => row.product?.examplePrice);

  function patch(partial: Partial<QuoteSnapshot>) {
    setQuote((current) => ({ ...current, ...partial }));
    setSaved(false);
  }
  function patchLine(index: number, partial: Partial<LineInput>) {
    setQuote((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...partial } : line)),
    }));
    setSaved(false);
  }
  function chooseClient(id: string) {
    if (!id) {
      patch({ clientId: null });
      return;
    }
    const client = props.clients.find((item) => item.id === id);
    if (!client) return;
    patch({ clientId: client.id, customer: clientLabel(client.name, client.company), tierId: client.tierId });
  }
  function addLine() {
    const product = props.products.find((item) => item.active) ?? props.products[0];
    if (!product) return;
    patch({
      lines: [
        ...quote.lines,
        {
          id: `new-${crypto.randomUUID()}`,
          productId: product.id,
          widthMm: 1200,
          heightMm: 900,
          qty: 1,
          lamination: false,
          eyelets: 0,
          installHours: 0,
          designHours: 0,
          note: "",
        },
      ],
    });
  }

  async function onSave() {
    setPending(true);
    setError("");
    const result = await saveQuote({ id: props.quoteId, ...quote });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQuote((current) => ({ ...current, lines: result.lines }));
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="stack">
      {example ? (
        <div className="notice">One or more lines use example catalogue prices. Replace those before this quote goes to a customer.</div>
      ) : null}
      <section className="card">
        <div className="form-grid-2">
          <label className="field">
            <span className="label">Client</span>
            <select className="select" value={quote.clientId ?? ""} disabled={disabled} onChange={(event) => chooseClient(event.target.value)}>
              <option value="">Walk-in / no client</option>
              {props.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {clientLabel(client.name, client.company)}
                  {client.example ? " · example" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Customer on quote</span>
            <input className="input" value={quote.customer} disabled={disabled} onChange={(event) => patch({ customer: event.target.value })} />
          </label>
          <label className="field">
            <span className="label">Pricing tier</span>
            <select className="select" value={quote.tierId} disabled={disabled} onChange={(event) => patch({ tierId: event.target.value as QuoteSnapshot["tierId"] })}>
              {props.tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select className="select" value={quote.status} disabled={disabled} onChange={(event) => patch({ status: event.target.value as QuoteStatus })}>
              {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((status) => (
                <option key={status} value={status}>
                  {QUOTE_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Date</span>
            <input className="input" type="date" value={quote.date} disabled={disabled} onChange={(event) => patch({ date: event.target.value })} />
          </label>
        </div>
        <p className="help">
          Tier on this quote: <strong>{tierName}</strong>
          {selected ? ` · client default is ${clientTier}` : ""}.
          {selected && selected.tierId !== quote.tierId ? " Manual override is on." : " The client tier is applied automatically."} Printed quotes never show the tier name.
        </p>
      </section>

      {rows.map((row, index) => (
        <section className="line-card" key={row.line.id ?? index}>
          <div className="split">
            <h2>Line {index + 1}</h2>
            {quote.lines.length > 1 && !props.locked ? (
              <button className="btn btn-danger btn-small" type="button" onClick={() => patch({ lines: quote.lines.filter((_, lineIndex) => lineIndex !== index) })}>
                Remove
              </button>
            ) : null}
          </div>
          <div className="line-grid">
            <label className="field">
              <span className="label">Product</span>
              <select className="select" value={row.line.productId} disabled={disabled} onChange={(event) => patchLine(index, { productId: event.target.value })}>
                {props.products
                  .filter((product) => product.active || product.id === row.line.productId)
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {METHOD_LABEL[product.method]}
                      {product.examplePrice ? " · example price" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Width mm</span>
              <input className="input" type="number" min={0} value={row.line.widthMm} disabled={disabled} onChange={(event) => patchLine(index, { widthMm: numberValue(event.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Height mm</span>
              <input className="input" type="number" min={0} value={row.line.heightMm} disabled={disabled} onChange={(event) => patchLine(index, { heightMm: numberValue(event.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Qty</span>
              <input className="input" type="number" min={0} step="1" value={row.line.qty} disabled={disabled} onChange={(event) => patchLine(index, { qty: numberValue(event.target.value) })} />
            </label>
          </div>
          <div className="option-grid">
            <label className="checkline">
              <input type="checkbox" checked={row.line.lamination} disabled={disabled} onChange={(event) => patchLine(index, { lamination: event.target.checked })} />
              Lamination
            </label>
            <label className="field">
              <span className="label">Eyelets (line total)</span>
              <input className="input" type="number" min={0} step="1" value={row.line.eyelets} disabled={disabled} onChange={(event) => patchLine(index, { eyelets: numberValue(event.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Install hours</span>
              <input className="input" type="number" min={0} step="0.5" value={row.line.installHours} disabled={disabled} onChange={(event) => patchLine(index, { installHours: numberValue(event.target.value) })} />
            </label>
            <label className="field">
              <span className="label">Design hours</span>
              <input className="input" type="number" min={0} step="0.5" value={row.line.designHours} disabled={disabled} onChange={(event) => patchLine(index, { designHours: numberValue(event.target.value) })} />
            </label>
          </div>
          <label className="field">
            <span className="label">Note</span>
            <input className="input" value={row.line.note} disabled={disabled} onChange={(event) => patchLine(index, { note: event.target.value })} />
          </label>
          {row.product && row.breakdown ? (
            <p className="help">
              {measureLabel(row.product.method, row.breakdown)} · {row.breakdown.markupPct}% markup · material {money(row.breakdown.materialSell)} · setup {money(row.breakdown.labour)} · options {money(row.breakdown.options)}
              {row.breakdown.hitMinimum ? " · minimum charge applied" : ""} · <strong>{money(row.breakdown.total)} ex GST</strong>
            </p>
          ) : null}
        </section>
      ))}

      <div className="split">
        {props.locked ? <p className="help">Locked because a job already exists.</p> : <button className="btn btn-ghost" type="button" onClick={addLine}>Add line</button>}
        <div className="totals">
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div>
            <span>GST 10%</span>
            <strong>{money(gst)}</strong>
          </div>
          <div className="grand">
            <span>Total</span>
            <strong>{money(grand)}</strong>
          </div>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {saved ? <p className="flash">Quote saved. Price changes are in the history below.</p> : null}
      {props.locked ? null : (
        <button className="btn btn-primary" type="button" disabled={pending} onClick={onSave}>
          {pending ? "Saving…" : "Save quote"}
        </button>
      )}
      <p className="help">
        Shop rates on this quote: lamination {money(props.rates.laminationPerSqm)}/m², eyelets {money(props.rates.eyeletEach)} each, install {money(props.rates.installPerHour)}/hour, design {money(props.rates.designPerHour)}/hour. Setup is charged once per line. Eyelets, install and design are line totals, not per item.
      </p>
    </div>
  );
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
