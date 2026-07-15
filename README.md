# Fatoma Autocare — business app

An installable iPhone web app (PWA) tailored for **Fatoma Autocare** (Kano State, Nigeria). No app store, no accounts, no server — all data is stored privately on the phone itself.

## Features

- **Dashboard** — today's schedule, weekly/monthly revenue, unpaid balance, and clients due for service (with overdue highlighting)
- **Clients** — contact details, notes, multiple vehicles per client (year/make/model/color/plate), lifetime spend, full job & invoice history, one-tap call / text / email (the text is pre-filled with a "you're due for a detail" message)
- **Next-due tracking** — after each completed job, the client's next due date is computed automatically from their service interval (set a global default, override per client). Toggle it off per client for one-off customers with no regular schedule
- **Jobs** — schedule with date/time, pick packages/services/products from your catalog, add custom line items or a price override, track status (scheduled → in progress → completed), then generate an invoice in one tap
- **Catalog** — define your own **Packages** (Standard / Deluxe / VIP…), **Services**, and **Products** you sell (e.g. microfiber towels), each with price, duration and description — all editable in Setup
- **Invoices** — matches the Fatoma invoice design: red header, S/N item table, delivery fee, subtotal/total, thank-you message, payment information box (account name / number / OPay), authorized signature, and tagline bar. Auto-numbered in the owner's format (FTM-250601 = year 25, month 06, invoice 01; resets monthly) or plain sequential. Discounts by amount or percent; duplicate any invoice in one tap
- **Payments** — mark fully paid, or record part-payments: the invoice shows Amount Paid and Balance Due and flips to Paid automatically
- **PDF export** — a real branded A4 PDF generated on the phone and sent through the iOS share sheet (WhatsApp, Files, email…). The PDF engine downloads on first use, then works offline. Print and share-as-text also available
- **Signature** — draw the authorized signature with a finger (or upload an image) in Setup; it prints on every invoice
- **Fully customizable** — business name, logo (upload your own), tagline, contact info, currency (₦ by default, no-kobo formatting), tax rate, invoice prefix & numbering style, payment account details, thank-you & tagline text, light/dark theme, accent color
- **Backups** — one-tap export through the share sheet (iOS blocks normal downloads in installed apps), validated restore that shows the backup date and counts before replacing anything
- **Offline mode** — once everything is downloaded to the phone, flip the switch in Setup → Connectivity and the app never touches the internet until you turn it off to update

## Try it on this PC

Run in this folder:

    python -m http.server 8123

then open http://localhost:8123

## Host on GitHub Pages (same as the Woovio receipts app)

One-time setup, from a terminal in this folder:

    git init
    git add .
    git commit -m "Fatoma Autocare app"
    git branch -M main
    git remote add origin https://github.com/<your-username>/fatoma-autocare.git
    git push -u origin main

(Create the empty `fatoma-autocare` repository on github.com first: **+ → New repository**, public, no README.)

Then on github.com: repo **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**. After a minute or two the app is live at:

    https://<your-username>.github.io/fatoma-autocare/

**To ship an update later:** `git add . && git commit -m "update" && git push` — then on the phone turn **off** Offline mode in Setup, close and reopen the app twice.

## Install on the iPhone

1. Open the GitHub Pages URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open the app once with internet, export one PDF (downloads the PDF engine), then flip **Setup → Connectivity → Offline mode** on.

It now launches full-screen from its own icon like a native app, works fully offline, and keeps all data on the phone.

> ⚠️ Data lives in the browser storage of the installed app. Use **Setup → Export backup** regularly, and note that deleting the app from the home screen (or clearing Safari website data) erases its data.

## Files

- `index.html`, `styles.css`, `app.js` — the app (no build step, no dependencies)
- `manifest.json`, `sw.js` — PWA install & offline support
- `icon-180.png`, `icon-512.png` — home-screen icons
