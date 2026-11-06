import nodemailer from "nodemailer";

export async function sendMail(input: { to: string; subject: string; text: string }): Promise<{ sent: boolean }> {
  const host = process.env.SMTP_HOST;
  if (!host) return { sent: false };
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Print and Sign Co <hello@printandsignco.com.au>",
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  return { sent: true };
}
