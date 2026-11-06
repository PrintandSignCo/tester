export type CompanyProfile = {
  name: string;
  address: string[];
  web: string;
  phone: string;
  abn: string;
  email: string;
};

export function companyProfile(): CompanyProfile {
  return {
    name: "Print and Sign Co",
    address: ["48 Edward Street", "Osborne Park WA 6017", "Australia"],
    web: "printandsignco.com.au",
    phone: process.env.COMPANY_PHONE?.trim() || "",
    abn: process.env.COMPANY_ABN?.trim() || "",
    email: "hello@printandsignco.com.au",
  };
}

export function showDemoLogins(): boolean {
  if (process.env.SHOW_DEMO_LOGINS === "true") return true;
  if (process.env.SHOW_DEMO_LOGINS === "false") return false;
  return process.env.NODE_ENV !== "production";
}
