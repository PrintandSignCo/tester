import { showDemoLogins } from "@/lib/company";

export function DemoHint({ who }: { who: "staff" | "client" }) {
  if (!showDemoLogins()) return null;
  return (
    <div className="notice">
      <strong>Seeded demo logins</strong>
      {who === "staff" ? (
        <p className="help">
          Admin: rob@printandsignco.com.au / PrintSign-Admin-2026
          <br />
          Staff: staff@printandsignco.com.au / PrintSign-Staff-2026
        </p>
      ) : (
        <p className="help">Client: sam.example@email.com / PrintSign-Client-2026</p>
      )}
    </div>
  );
}
