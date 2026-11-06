import { redirect } from "next/navigation";
import { Flash, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatPerth } from "@/lib/format";
import { requireAdmin } from "@/server/guards";
import { createStaffUser } from "@/server/shop-actions";

export const metadata = { title: "Team" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const session = await requireAdmin();
  if (!session) redirect("/staff");
  const sp = await searchParams;
  const users = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Team" lede="Admin and staff accounts. Clients sign themselves up in the portal." />
      <Flash error={sp.error} notice={sp.notice} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role === "ADMIN" ? "Admin" : "Staff"}</td>
                <td>{formatPerth(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="card stack" action={createStaffUser} style={{ marginTop: 16 }}>
        <h2>Add a staff login</h2>
        <div className="form-grid">
          <label className="field">
            <span className="label">Name</span>
            <input className="input" name="name" required />
          </label>
          <label className="field">
            <span className="label">Email</span>
            <input className="input" name="email" type="email" required />
          </label>
          <label className="field">
            <span className="label">Password</span>
            <input className="input" name="password" type="text" minLength={8} required />
          </label>
          <label className="field">
            <span className="label">Role</span>
            <select className="select" name="role" defaultValue="STAFF">
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </div>
        <button className="btn btn-primary" type="submit">Create login</button>
      </form>
    </>
  );
}
