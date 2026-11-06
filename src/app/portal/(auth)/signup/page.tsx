import Link from "next/link";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/ui";
import { signupAction } from "@/server/auth-actions";

export const metadata = { title: "Create a client account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="auth-card" action={signupAction}>
        <Logo />
        <h1>Create an account</h1>
        <p className="help">New accounts start on retail pricing. The shop can move you to corporate or trade.</p>
        <Flash error={sp.error} />
        <label className="field">
          <span className="label">Your name</span>
          <input className="input" name="name" required />
        </label>
        <label className="field">
          <span className="label">Company</span>
          <input className="input" name="company" />
        </label>
        <label className="field">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" required />
        </label>
        <label className="field">
          <span className="label">Phone</span>
          <input className="input" name="phone" />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input className="input" name="password" type="password" minLength={8} required />
        </label>
        <button className="btn btn-primary" type="submit">
          Create account
        </button>
        <Link href="/portal/login">Already registered? Sign in</Link>
      </form>
    </main>
  );
}
