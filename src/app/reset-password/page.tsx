import { Logo } from "@/components/logo";
import { Flash } from "@/components/ui";
import { resetPasswordAction } from "@/server/auth-actions";

export const metadata = { title: "Choose a password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="auth-card" action={resetPasswordAction}>
        <Logo />
        <h1>Choose a new password</h1>
        <Flash error={sp.error} />
        <input type="hidden" name="token" value={sp.token ?? ""} />
        <label className="field">
          <span className="label">New password</span>
          <input className="input" name="password" type="password" minLength={8} required />
        </label>
        <label className="field">
          <span className="label">Confirm</span>
          <input className="input" name="confirm" type="password" minLength={8} required />
        </label>
        <button className="btn btn-primary" type="submit">
          Update password
        </button>
      </form>
    </main>
  );
}
