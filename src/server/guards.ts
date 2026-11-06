import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireStaff() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/portal");
  return session;
}

export async function requireAdmin() {
  const session = await requireStaff();
  if (session.user.role !== "ADMIN") redirect("/staff?error=That page is for admins");
  return session;
}

export async function requireClient() {
  const session = await auth();
  if (!session?.user) redirect("/portal/login");
  if (session.user.role !== "CLIENT") redirect("/staff");
  if (!session.user.clientId) redirect("/portal/login?error=This login is not linked to a client record");
  return session;
}

export function withMessage(path: string, kind: "notice" | "error", message: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(kind, message);
  return `${base}?${params.toString()}`;
}
