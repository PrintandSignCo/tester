import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>That page is not on the bench</h1>
        <p>The quote, job or file is missing, or it belongs to someone else.</p>
        <Link className="btn btn-primary" href="/">
          Back to Print and Sign Co
        </Link>
      </div>
    </main>
  );
}
