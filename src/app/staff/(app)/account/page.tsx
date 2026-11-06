import { Flash, PageHeader } from "@/components/ui";
import { changePasswordAction } from "@/server/auth-actions";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Account" lede="Change the password for this staff login." />
      <Flash error={sp.error} notice={sp.notice} />
      <form className="card stack" action={changePasswordAction}>
        <input type="hidden" name="where" value="staff" />
        <label className="field">
          <span className="label">Current password</span>
          <input className="input" name="current" type="password" required />
        </label>
        <label className="field">
          <span className="label">New password</span>
          <input className="input" name="password" type="password" minLength={8} required />
        </label>
        <label className="field">
          <span className="label">Confirm</span>
          <input className="input" name="confirm" type="password" minLength={8} required />
        </label>
        <button className="btn btn-primary" type="submit">Update password</button>
      </form>
    </>
  );
}
