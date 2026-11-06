# Print and Sign Co

Shop management for Print and Sign Co, 48 Edward Street, Osborne Park WA. Staff quote in Australian dollars with GST, turn accepted quotes into jobs, and invoice finished work. Clients sign in to accept quotes and send artwork.

Catalogue prices shipped with the app are **example prices**. They are labelled in the catalogue and on any quote that uses them.

## What it does

- Staff sign-in with admin and staff roles.
- Product catalogue: per m², per unit, or per linear metre, with material cost, setup/labour, a minimum charge, and Retail, Corporate and Trade markups.
- Clients, each on a tier. Quotes take that tier and allow a manual override. Printed quotes and PDFs do not show the tier.
- Quote lines in millimetres, with quantity, lamination, eyelets, install hours and design hours. Totals are ex GST, plus 10% GST.
- Statuses: draft, sent, accepted. Accepted quotes become jobs.
- Job board: Not started, In production, Finished, Invoiced, with due dates, notes and artwork.
- Invoices from finished jobs, 14-day terms, printable view and PDF.
- Xero Invoices API (custom connection, client credentials). Until `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET` are set, the invoice screen says Xero is not connected and the JSON can be downloaded. A connected app posts an ACCREC draft with exclusive amounts, account code 200 and tax type OUTPUT.
- Job board export: JSON with `jobNumber`, `client`, `items` (`description`, `widthMm`, `heightMm`, `qty`), `dueDate`, `notes`, `quoteNumber`. If `JOB_BOARD_WEBHOOK_URL` is set, staff can POST it. Otherwise they download the file.
- Shared **What's changed** page, newest first, with a New badge for the last 7 days.
- Server-side history of quote and price changes (who, when, old and new).
- Client portal: sign up, sign in, password reset, quotes, online acceptance, jobs, and job requests with artwork (PDF, AI, EPS, PNG, JPG, up to 80 MB each).
- Artwork storage behind one interface: local disk by default, S3-compatible when S3 variables are set, or Box.com (one folder per job or request) when Box variables are set.

Dates and times are shown in Australia/Perth. Money uses `en-AU` AUD formatting.

## Run it locally

You need Node.js 20+ and Postgres 16.

```bash
cp .env.example .env
# Set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)

docker compose up -d   # or use your own Postgres

npm install
npx prisma migrate deploy
npm run db:seed
npm test
npm run dev
```

Open http://localhost:3000.

### Seeded logins

Re-running the seed resets these three passwords. It does not overwrite catalogue prices you have already changed. `npm run db:reset` drops the database, migrates, and seeds again.

| Who | Email | Password |
| --- | --- | --- |
| Admin (Rob Macdougall) | rob@printandsignco.com.au | PrintSign-Admin-2026 |
| Staff | staff@printandsignco.com.au | PrintSign-Staff-2026 |
| Client (Sam Nguyen, example) | sam.example@email.com | PrintSign-Client-2026 |

Outside production, the sign-in screens show these passwords. Set `SHOW_DEMO_LOGINS=false` to hide them.

Sam has a sent quote that can be accepted online, an invoiced job, and an open window-frosting request.

## Pricing

For each line, ex GST:

- Area (m²) is width mm × height mm ÷ 1,000,000. Linear metres use the width only. Unit products ignore size for the material cost.
- Material sell = material cost × quantity basis × (1 + tier markup ÷ 100).
- Setup/labour is added once per line.
- Options: lamination at the shop rate (m² × qty, or per unit for unit products), eyelets, install hours and design hours. Eyelets and hours are totals for the line, not per item.
- If the quantity is above zero and the raw total is under the product minimum, the minimum is charged.
- Quote GST is 10% of the ex-GST subtotal. Invoice unit amounts are the line total divided by quantity, rounded to cents, and the invoice due date is 14 days after the issue date.

Shop option rates start at $18/m² lamination, $1.50 per eyelet, $85/hour install and $95/hour design. Admins can change them on the catalogue page. GST stays at 10%.

Tests live in `src/lib/pricing.test.ts` and `src/lib/documents.test.ts`:

```bash
npm test
```

## Deploy

The app is a Next.js server app. It needs a long-lived Node server or a host that runs Prisma migrations against Postgres. Vercel works if you attach a hosted Postgres database and use S3 or Box for artwork (the local disk on Vercel does not keep files).

1. Create a Postgres database (Neon, Supabase, RDS, or Vercel Postgres) and copy its connection string to `DATABASE_URL`.
2. Set `AUTH_SECRET` and `APP_URL` to the public https URL.
3. Set `SHOW_DEMO_LOGINS=false` and change the seeded passwords after the first sign-in.
4. Build command: `prisma migrate deploy && next build` (or `npm run build` after migrate). Install command: `npm install` (this runs `prisma generate`).
5. For a single Node host: `npm run build && npm start`. Keep `ARTWORK_DIR` on a persistent disk, or set S3/Box.
6. Optional: `COMPANY_ABN` and `COMPANY_PHONE` print on invoices. `SMTP_*` sends password-reset email. Without SMTP, a development server shows the reset link on screen; production does not.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Session signing secret |
| `APP_URL` | Public URL, used in reset links |
| `SHOW_DEMO_LOGINS` | `true` / `false`. Default on when `NODE_ENV` is not production |
| `COMPANY_ABN` | Printed on tax invoices when set |
| `COMPANY_PHONE` | Printed on quotes and invoices when set |
| `XERO_CLIENT_ID` | Xero custom connection |
| `XERO_CLIENT_SECRET` | Xero custom connection |
| `JOB_BOARD_WEBHOOK_URL` | Where job JSON is POSTed |
| `JOB_BOARD_WEBHOOK_SECRET` | Optional bearer token for that POST |
| `STORAGE_DRIVER` | `local`, `s3`, or `box`. Blank picks Box, then S3, then local |
| `ARTWORK_DIR` | Local artwork directory. Default `data/artwork` |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3-compatible storage |
| `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` | Optional, for R2 or MinIO |
| `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_ENTERPRISE_ID` | Box client-credentials app |
| `BOX_ROOT_FOLDER_ID` | Parent folder. Default `0` |
| `BOX_DEVELOPER_TOKEN` | Optional token that skips the client-credentials grant |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Password reset email |

Xero expects a [custom connection](https://developer.xero.com/documentation/guides/oauth2/custom-connections/) with accounting transactions (and contacts) scopes. Box expects an enterprise client-credentials app. Each job or request gets its own folder under the root.

## Scripts

| Script | |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm test` | Pricing, GST, Xero payload and job-board contract tests |
| `npm run db:setup` | `prisma migrate deploy` and seed |
| `npm run db:reset` | Drop, migrate and seed |
| `npm run build` / `npm start` | Production |
