import { companyProfile } from "@/lib/company";
import type { PrintableInvoice, PrintableQuote } from "@/lib/documents";
import { formatDateAU, money } from "@/lib/format";

export function QuoteSheet({ quote }: { quote: PrintableQuote }) {
  const company = companyProfile();
  return (
    <article className="sheet">
      <header className="sheet-top">
        <div>
          <p className="sheet-kicker">Quotation</p>
          <h1>{company.name}</h1>
          {company.address.map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div>{company.web}</div>
          {company.phone ? <div>{company.phone}</div> : null}
        </div>
        <div className="sheet-meta">
          <div>
            <span>Quote no.</span>
            <strong>{quote.number}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{formatDateAU(quote.date)}</strong>
          </div>
        </div>
      </header>
      <p>
        <span className="label">Prepared for</span>
        <br />
        {quote.customer}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th className="money">Amount ex GST</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td>
                  {line.description}
                  {line.note ? <div className="help">{line.note}</div> : null}
                </td>
                <td>{line.qty}</td>
                <td className="money">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 16 }}>
        <div>
          <span>Subtotal</span>
          <strong>{money(quote.subtotal)}</strong>
        </div>
        <div>
          <span>GST 10%</span>
          <strong>{money(quote.gst)}</strong>
        </div>
        <div className="grand">
          <span>Total AUD</span>
          <strong>{money(quote.total)}</strong>
        </div>
      </div>
      <p className="help">Amounts are in Australian dollars. This quotation is valid for 14 days. GST is 10%.</p>
    </article>
  );
}

export function InvoiceSheet({ invoice }: { invoice: PrintableInvoice }) {
  const company = companyProfile();
  return (
    <article className="sheet">
      <header className="sheet-top">
        <div>
          <p className="sheet-kicker">{company.abn ? "Tax invoice" : "Invoice"}</p>
          <h1>{company.name}</h1>
          {company.address.map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div>{company.web}</div>
          {company.abn ? <div>ABN {company.abn}</div> : null}
          {company.phone ? <div>{company.phone}</div> : null}
        </div>
        <div className="sheet-meta">
          <div>
            <span>Invoice no.</span>
            <strong>{invoice.number}</strong>
          </div>
          <div>
            <span>Issued</span>
            <strong>{formatDateAU(invoice.issueDate)}</strong>
          </div>
          <div>
            <span>Due</span>
            <strong>{formatDateAU(invoice.dueDate)}</strong>
          </div>
          <div>
            <span>Terms</span>
            <strong>{invoice.terms}</strong>
          </div>
        </div>
      </header>
      <p>
        <span className="label">Bill to</span>
        <br />
        {invoice.customer}
        {invoice.email ? <div className="help">{invoice.email}</div> : null}
        <span className="help">
          Job {invoice.jobNumber}
          {invoice.quoteNumber ? ` · Quote ${invoice.quoteNumber}` : ""}
        </span>
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th className="money">Unit ex GST</th>
              <th className="money">Amount ex GST</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`}>
                <td>{line.description}</td>
                <td>{line.qty}</td>
                <td className="money">{money(line.unitAmount)}</td>
                <td className="money">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="totals" style={{ marginTop: 16 }}>
        <div>
          <span>Subtotal</span>
          <strong>{money(invoice.subtotal)}</strong>
        </div>
        <div>
          <span>GST 10%</span>
          <strong>{money(invoice.gst)}</strong>
        </div>
        <div className="grand">
          <span>Total due</span>
          <strong>{money(invoice.total)}</strong>
        </div>
      </div>
      <p className="help">Payment terms: {invoice.terms} from the invoice date. Amounts are in Australian dollars.</p>
    </article>
  );
}
