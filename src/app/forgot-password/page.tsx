import Link from "next/link";
import { DemoHint } from "@/components/demo-hint";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/ui";
import { requestResetAction } from "@/server/auth-actions";

export const metadata = { title: "Reset password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; from?: string; devlink?: string }> }) {
  const sp = await searchParams;
  const from = sp.from === "portal" ? "portal" : "staff";
  return (
    <main className="auth">
      <form className="auth-card" action={requestResetAction}>
        <Logo />
        <h1>Reset password</h1>
        <Flash error={sp.error} notice={sp.notice} />
        {sp.devlink ? (
          <p className="notice">
            Development reset link: <Link href={sp.devlink}>choose a new password</Link>
          </p>
        ) : null}
        {from === "staff" ? <DemoHint who="staff" /> : <DemoHint who="client" />}
        <input type="hidden" name="from" value={from} />
        <label className="field">
          <span className="label">Email</span>
          <input className="input" name="email" type="email" required />
        </label>
        <button className="btn btn-primary" type="submit">
          Send reset link
        </button>
        <Link href={from === "portal" ? "/portal/login" : "/login"}>Back to sign in</Link>
      </form>
    </main>
  );
}
