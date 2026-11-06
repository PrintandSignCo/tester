import type { XeroInvoicePayload } from "@/lib/documents";

export function xeroConfigured(): boolean {
  return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

export function webhookConfigured(): boolean {
  return Boolean(process.env.JOB_BOARD_WEBHOOK_URL);
}

let tokenCache: { token: string; exp: number } | null = null;

async function xeroToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 30_000) return tokenCache.token;
  const id = process.env.XERO_CLIENT_ID || "";
  const secret = process.env.XERO_CLIENT_SECRET || "";
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "accounting.transactions accounting.contacts",
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "Xero did not issue an access token. Check the custom connection credentials.");
  }
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 1800) * 1000 };
  return data.access_token;
}

async function tenantId(token: string): Promise<string> {
  const res = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json()) as { tenantId?: string }[] | { Detail?: string };
  if (!res.ok || !Array.isArray(data) || !data[0]?.tenantId) {
    throw new Error("Xero did not return an organisation for this custom connection.");
  }
  return data[0].tenantId;
}

export async function sendInvoiceToXero(payload: XeroInvoicePayload): Promise<{ invoiceId: string }> {
  if (!xeroConfigured()) throw new Error("Xero is not connected.");
  const token = await xeroToken();
  const tenant = await tenantId(token);
  const res = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Xero-Tenant-Id": tenant,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await res.json()) as {
    Invoices?: { InvoiceID?: string; ValidationErrors?: { Message?: string }[]; HasErrors?: boolean }[];
    Message?: string;
    Detail?: string;
  };
  const invoice = data.Invoices?.[0];
  const validation = invoice?.ValidationErrors?.map((item) => item.Message).filter(Boolean).join(" ");
  if (!res.ok || !invoice?.InvoiceID || invoice.HasErrors) {
    throw new Error(validation || data.Message || data.Detail || "Xero rejected the invoice.");
  }
  return { invoiceId: invoice.InvoiceID };
}
