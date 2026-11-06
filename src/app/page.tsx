import Link from "next/link";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="home">
      <header className="site-top">
        <Logo />
        <div className="toolbar">
          <Link className="btn btn-ghost" href="/portal/login">
            Client portal
          </Link>
          <Link className="btn btn-primary" href="/login">
            Staff sign in
          </Link>
        </div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <p className="sheet-kicker">Shop floor · Osborne Park</p>
          <h1>Print and Sign Co</h1>
          <p>
            Quotes, jobs and invoices for the workshop at 48 Edward Street. Retail, corporate and trade prices stay on the staff side. Customers see a clean quote.
          </p>
          <p>48 Edward Street, Osborne Park WA · printandsignco.com.au · prices in AUD, GST 10%.</p>
        </div>
        <div className="hero-panel">
          <h2>Open the shop</h2>
          <p className="help">Staff run the catalogue, quotes, job board and Xero invoices. Clients accept quotes and send artwork from the portal.</p>
          <Link className="btn btn-primary" href="/login">
            Staff sign in
          </Link>
          <Link className="btn btn-ghost" href="/portal/signup">
            Create a client account
          </Link>
          <Link className="btn btn-ghost" href="/portal/login">
            Client sign in
          </Link>
        </div>
      </section>
    </div>
  );
}
