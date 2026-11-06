export type TierId = "t1" | "t2" | "t3";
export type PricingMethod = "sqm" | "unit" | "linear";
export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED";
export type JobStatus = "NOT_STARTED" | "IN_PRODUCTION" | "FINISHED" | "INVOICED";
export type InvoiceStatus = "DRAFT" | "SENT_TO_XERO";
export type UserRole = "ADMIN" | "STAFF" | "CLIENT";

export type OptionRates = {
  laminationPerSqm: number;
  eyeletEach: number;
  installPerHour: number;
  designPerHour: number;
};

export type ProductRates = {
  id: string;
  name: string;
  method: PricingMethod;
  materialCost: number;
  markupByTier: Record<TierId, number>;
  labourSetup: number;
  minCharge: number;
  examplePrice?: boolean;
  active?: boolean;
};

export type LineInput = {
  id?: string;
  productId: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  lamination: boolean;
  eyelets: number;
  installHours: number;
  designHours: number;
  note: string;
};

export type QuoteSnapshot = {
  clientId: string | null;
  customer: string;
  tierId: TierId;
  date: string;
  status: QuoteStatus;
  lines: LineInput[];
};

export type FieldChange = {
  field: string;
  old: string;
  new: string;
};

export type TierOption = { id: TierId; name: string };

export type ClientOption = {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  tierId: TierId;
  example: boolean;
};

export const TIER_IDS: TierId[] = ["t1", "t2", "t3"];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PRODUCTION: "In production",
  FINISHED: "Finished",
  INVOICED: "Invoiced",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT_TO_XERO: "Sent to Xero",
};

export const METHOD_LABEL: Record<PricingMethod, string> = {
  sqm: "Per m²",
  unit: "Per unit",
  linear: "Per linear metre",
};

export const JOB_STATUSES: JobStatus[] = ["NOT_STARTED", "IN_PRODUCTION", "FINISHED", "INVOICED"];
