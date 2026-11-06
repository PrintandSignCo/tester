import { Logo } from "@/components/logo";
import { PortalNav } from "@/components/portal-nav";
import { LogoutButton } from "@/components/ui";
import { prisma } from "@/lib/db";
import { clientLabel } from "@/lib/format";
import { requireClient } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireClient();
  const client = await prisma.client.findUnique({ where: { id: session.user.clientId ?? "" } });
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo light />
        <PortalNav />
        <div className="side-foot">
          <div>
            <strong>{client ? clientLabel(client.name, client.company) : session.user.name}</strong>
            <div>Client portal</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="main">{children}</div>
    </div>
  );
}
