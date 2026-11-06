"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { showDemoLogins } from "@/lib/company";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { requireClient, requireStaff, withMessage } from "@/server/guards";

function safeNext(value: FormDataEntryValue | null, fallback: string) {
  const next = String(value ?? "");
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return fallback;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const fallback = String(formData.get("fallback") ?? "/staff");
  const redirectTo = safeNext(formData.get("next"), fallback);
  const failPath = fallback.startsWith("/portal") ? "/portal/login" : "/login";
  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(withMessage(failPath, "error", "That email or password is not right."));
    }
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function signupAction(formData: FormData) {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      company: z.string().trim().max(160),
      email: z.string().trim().email().max(200),
      phone: z.string().trim().max(40),
      password: z.string().min(8).max(200),
    })
    .safeParse({
      name: formData.get("name"),
      company: formData.get("company"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      password: formData.get("password"),
    });
  if (!parsed.success) {
    redirect(withMessage("/portal/signup", "error", "Enter your name, a valid email, and a password of at least 8 characters."));
  }
  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    redirect(withMessage("/portal/login", "error", "That email already has a login. Sign in or reset the password."));
  }
  const tier = await prisma.tier.findUnique({ where: { id: "t1" } });
  if (!tier) redirect(withMessage("/portal/signup", "error", "The shop is not ready for new accounts yet."));

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const matched = await prisma.client.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    include: { users: true },
  });
  if (matched?.users.length) {
    redirect(withMessage("/portal/login", "error", "That client already has portal access. Sign in instead."));
  }

  if (matched) {
    await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash,
        role: "CLIENT",
        clientId: matched.id,
      },
    });
  } else {
    await prisma.client.create({
      data: {
        name: parsed.data.name,
        company: parsed.data.company,
        email,
        phone: parsed.data.phone,
        tierId: "t1",
        users: {
          create: {
            email,
            name: parsed.data.name,
            passwordHash,
            role: "CLIENT",
          },
        },
      },
    });
  }

  try {
    await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/portal" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(withMessage("/portal/login", "notice", "Account created. Sign in with that email."));
    }
    throw error;
  }
}

export async function requestResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const from = String(formData.get("from") ?? "") === "portal" ? "portal" : "staff";
  const path = from === "portal" ? "/portal/forgot-password" : "/forgot-password";
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  let devLink = "";
  if (user) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const url = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    try {
      const result = await sendMail({
        to: user.email,
        subject: "Reset your Print and Sign Co password",
        text: `Use this link within one hour to choose a new password:\n\n${url}\n\nIf you did not ask for this, you can ignore the email.`,
      });
      if (!result.sent && showDemoLogins()) devLink = url;
    } catch {
      if (showDemoLogins()) devLink = url;
    }
  }
  const destination = withMessage(path, "notice", "If that account exists, a reset link is ready.");
  if (!devLink) redirect(destination);
  const params = new URLSearchParams({ notice: "Email is not configured, so the reset link is shown below for this development shop.", devlink: devLink });
  redirect(`${path}?${params.toString()}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fail = (message: string) => redirect(withMessage(`/reset-password?token=${encodeURIComponent(token)}`, "error", message));
  if (password.length < 8) fail("Use at least 8 characters.");
  if (password !== confirm) fail("Those passwords do not match.");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    redirect(withMessage("/forgot-password", "error", "That reset link has expired. Request a new one."));
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  const dest = row.user.role === "CLIENT" ? "/portal/login" : "/login";
  redirect(withMessage(dest, "notice", "Password updated. Sign in with the new one."));
}

export async function changePasswordAction(formData: FormData) {
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const where = String(formData.get("where") ?? "staff");
  const path = where === "portal" ? "/portal/account" : "/staff/account";
  const session = where === "portal" ? await requireClient() : await requireStaff();
  if (password.length < 8) redirect(withMessage(path, "error", "Use at least 8 characters."));
  if (password !== confirm) redirect(withMessage(path, "error", "Those passwords do not match."));
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
    redirect(withMessage(path, "error", "The current password is not right."));
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  redirect(withMessage(path, "notice", "Password updated."));
}

