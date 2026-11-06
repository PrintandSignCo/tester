import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DemoHint } from "@/components/demo-hint";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/ui";
import { loginAction } from "@/server/auth-actions";

export const metadata = { title: "Staff sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const session = await auth();
  if (session?.user?.role === "CLIENT") redirect("/portal");
  if (session?.user) redirect("/staff");
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="auth-card" action={loginAction}>
        <Logo />
        <h1>Staff sign in</h1>
        <p className="help">Quotes, the job board and invoices for Print and Sign Co.</p>
        <Flash error={sp.error} notice={sp.notice} />
        <DemoHint who="staff" />
        <input type="hidden" name="fallback" value="/staff" />
        <input type="hidden" name="next" value={sp.next ?? "/staff"} />
        <label className="field">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn btn-primary" type="submit">
          Sign in
        </button>
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/portal/login">Client portal</Link>
      </form>
    </main>
  );
}
