# Domestic Helper Tracker

A static-hosted React PWA for tracking domestic helper salary settings, advance deductions, Sunday rest-day exceptions, extra unpaid days off, explicit PH extra pay, and monthly payout. Google Sheets is the source of truth.

## Development

```bash
npm install
cp .env.example .env.local
npm run dev -- --host 0.0.0.0
```

## Verification

```bash
npm run build
npm run lint
npm run typecheck
npm run test -- --run
npm run test:e2e
```

## Static Hosting

The app does not need a custom backend server. It does need a stable HTTPS origin for Google OAuth allowlisting, service workers, and Android PWA install behavior.

Suitable deployment targets include GitHub Pages, Cloudflare Pages, Netlify static hosting, or any equivalent static-file host. Opening `dist/index.html` through `file://` is not enough for OAuth or PWA behavior.

## Environment

Create `.env.local` from `.env.example` and set:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

Do not commit `.env.local`.

For GitHub Pages, add a repository variable named `VITE_GOOGLE_CLIENT_ID`.
This is a public Google OAuth browser client ID, not a client secret. Restrict
the OAuth client in Google Cloud to the Pages origin, for example
`https://fchoo.github.io`, and keep client secrets out of this static app.

The Google Cloud project must have the Google Sheets API enabled. Enable the
Google Drive API as well if you want the in-app "Choose from Drive" sheet
selector. The app requests Drive metadata read-only access for selection only;
the chosen spreadsheet ID/link is saved in this browser's local storage, while
payroll records reload from the connected Google Sheet.
