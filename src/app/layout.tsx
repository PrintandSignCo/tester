import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: { default: "Print and Sign Co", template: "%s · Print and Sign Co" },
  description: "Quotes, jobs and invoices for Print and Sign Co, Osborne Park.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className={`${outfit.variable} ${fraunces.variable}`}>{children}</body>
    </html>
  );
}
