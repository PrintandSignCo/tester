import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DemoHint } from "@/components/demo-hint";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/ui";
import { loginAction } from "@/server/auth-actions";

export const metadata = { title: "Client sign in" };

export default async function PortalLogin({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const session = await auth();
  if (session?.user?.role === "CLIENT") redirect("/portal");
  if (session?.user) redirect("/staff");
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="auth-card" action={loginAction}>
        <Logo />
        <h1>Client portal</h1>
        <p className="help">See your quotes and jobs, accept a quote, or send artwork for a new job.</p>
        <Flash error={sp.error} notice={sp.notice} />
        <DemoHint who="client" />
        <input type="hidden" name="fallback" value="/portal" />
        <input type="hidden" name="next" value={sp.next ?? "/portal"} />
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
        <Link href="/forgot-password?from=portal">Forgot password</Link>
        <Link href="/portal/signup">Create an account</Link>
      </form>
    </main>
  );
}
