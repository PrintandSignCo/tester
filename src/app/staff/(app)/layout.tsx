import { Logo } from "@/components/logo";
import { StaffNav } from "@/components/staff-nav";
import { LogoutButton } from "@/components/ui";
import { requireStaff } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo light />
        <StaffNav role={session.user.role} />
        <div className="side-foot">
          <div>
            <strong>{session.user.name}</strong>
            <div>{session.user.role === "ADMIN" ? "Admin" : "Staff"}</div>
            <div>48 Edward Street, Osborne Park</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
