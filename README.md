# CertiFlow

**Event feedback → automatic certificates.** Participants scan a QR code after an event, fill a Google Form
(name, register no, college, event, email, rating, review) and get a PDF certificate by email within a minute.
Every certificate is stored in the database with the participant's details and the PDF itself, and anyone can
verify it by its ID.

Also: **attendance check** (registered list and a rotating code on the projector), **award certificates**
(winner, runner-up, appreciation), **issue from Excel**, a one-click **event report PDF**, a **My certificates**
page for students, an **Add to LinkedIn** button in every email, and a warning before Gmail's daily limit.
It can run on a laptop or online for free (see [docs/DEPLOY.md](docs/DEPLOY.md)).

MERN stack (MongoDB, Express, React, Node.js) — Product Development Lab project.

---

## Run it (2 steps)

1. Install **Node.js LTS** (20.19 or newer) from https://nodejs.org (once).
2. Double-click **`start-windows.bat`** (Mac/Linux: `start-mac-linux.sh`).

The first start installs packages and downloads the database engine (a few minutes, needs internet).
Your browser opens **http://localhost:5000**. Log in with:

- Email: `admin@certiflow.local`
- Password: `Admin@123` (change it in Settings)

No MongoDB Atlas account and no Gmail app password are needed. Data is saved in `server/.data`.

## Connect Google Form (once, ~3 minutes)

Open **Settings** in CertiFlow and follow the 5 on-screen steps:

1. **Copy script** (it already contains your secret key).
2. Open https://script.new, paste, save.
3. Click **Run** with `setup` selected and allow permissions. This creates the Google Form for you.
4. **Deploy → New deployment → Web app**, Execute as **Me**, Who has access **Anyone** → copy the Web app URL.
5. Paste the URL in Settings → **Connect**.

Certificates are emailed from that Google account (Gmail allows about 100 emails per day on free accounts).

## Run from VS Code

Open the `certiflow` folder in VS Code (**File → Open Folder**), then in the terminal:

```
cd server
npm install
npm run dev        # restarts by itself when you save a file
```

Open http://localhost:5000. Stop with **Ctrl + C**.

**Editing the website (frontend):** change any file in `client/src` (pages are in `client/src/pages`) and save.
The terminal prints *Website updated*; refresh the browser with **Ctrl + Shift + R**. No separate build command is
needed. If you make a typo, the terminal shows the file and line, and the last working website keeps running.

## Automated tests

```
cd server
npm test
```

30 tests cover login, events, the Google Form flow, certificate generation, email, verification, re-creating
certificates and Gmail's daily limit. They use a temporary database and a fake Google script, so nothing real is touched.

## Use your own certificate design

On any event page, under **Certificate design**:

- **RMKCET – Query Quest**: the CSE Student Chapter design, ready to use. The name and date are already placed.
- **Upload your own**: a PNG/JPG of your certificate with the name and date left blank. Drag the name, date and
  verify-QR markers into place, set size, font and colour, then **Preview certificate PDF**.
- **Standard design**: CertiFlow's own layout using the title and signatures from Edit event.

Every certificate gets the participant's name, the event date, and a certificate ID with a verify QR code.
The design is chosen when you create the event (**New event → Certificate design**). If certificates were already
sent with another design, use **Re-create certificates** on the event page: same IDs, emailed again.

The QR code on each certificate opens a public verify page served by your Google script, so it works on any phone.
Every certificate is also listed in the **CertiFlow Certificate Register** Google Sheet (link in Settings).

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm error enoent … package.json` | You are in the wrong folder. `cd` into `certiflow\server` first. |
| "Google returned a web page instead of data" | In Apps Script: Deploy → Manage deployments → Edit → **Who has access: Anyone** → New version → Deploy. College accounts may not allow "Anyone": use a personal Gmail. |
| Settings says "Update your Google script" | Follow the steps shown there (copy, paste, Run setup, Deploy new version). |
| Certificate arrived in the plain design | Open the event → Certificate design → pick the design → **Re-create certificates**. |
| "Gmail's daily email limit is reached" | Free Gmail sends about 100 emails a day. CertiFlow retries automatically after 3 hours. |
| `Port 5000 is already in use` | CertiFlow is already running in another window. Close it first. |

## Updating to a new version

Close the CertiFlow window, extract the new zip over the old folder (replace files), and double-click
`start-windows.bat` again. Your data (`server/.data`) and Google connection are kept.

## Use it for an event

1. **Events → New event**: name, date, organiser, signatures for the certificate.
2. Open the event → **Print poster** or show the QR code at the end of the event.
3. Participants scan and submit. Within ~30 seconds CertiFlow:
   - saves the feedback,
   - creates the PDF certificate with a unique ID (e.g. `CF-2026-7K3QXM`) and a verification QR code,
   - stores the PDF inside MongoDB (GridFS),
   - emails it to the participant.
4. See ratings and reviews on the event page, export to Excel (CSV), view/download/re-send/revoke certificates.
5. Anyone can check a certificate at **/verify**.

Problem responses (wrong event name, same register number twice, invalid email) appear on the Overview page
under "Responses that need you", where you can assign them to the right event or dismiss them.

---

## Folder structure

```
certiflow/
├── start-windows.bat / start-mac-linux.sh   one-click start
├── docs/
│   ├── ARCHITECTURE.md                      flow, database design, API list (for your report)
│   ├── PROCEDURE.md                         aim, requirements, step-by-step procedure, result (lab record)
│   └── google-apps-script-Code.gs           the Google script (reference copy)
├── client/                                  React + Vite + Tailwind dashboard
│   ├── dist/                                ready-built site, served by the server
│   └── src/
│       ├── pages/       Login, Dashboard, Events, EventDetail, Certificates, Settings, Verify
│       ├── components/  Layout, EventForm, ui (buttons, inputs, modal, toasts)
│       └── lib/         api (axios), auth context, formatting
└── server/                                  Node.js + Express API
    └── src/
        ├── server.js                        start: database, first admin, auto-sync, open browser
        ├── app.js                           routes + serves the React build
        ├── config/      env.js, db.js (Atlas or built-in local MongoDB)
        ├── models/      Event, Feedback, Certificate, Admin, Setting, SyncIssue
        ├── routes/      auth, events, certificates, dashboard, settings, public (verify), health
        ├── services/
        │   ├── googleBridge.js       talks to the Google Apps Script
        │   ├── syncService.js        form response → feedback → certificate → email
        │   ├── certificatePdf.js     draws the certificate (PDFKit + QR)
        │   ├── certificateService.js issues, stores and emails certificates
        │   ├── gridfs.js             stores PDFs inside MongoDB
        │   ├── mailer.js             email via Gmail script or SMTP
        │   └── bootstrap.js          first admin + login secret
        ├── templates/   ready-made certificate designs (RMKCET Query Quest) + positions
        ├── middleware/  auth (JWT), errorHandler
        └── google/Code.gs.template  Apps Script with {{SECRET}} filled in at runtime
    └── test/            npm test: end-to-end tests with a fake Google script
```

## For developers

```bash
cd server && npm install && npm run dev     # API on :5000 (auto-reload)
cd client && npm install && npm run dev     # dashboard on :5173 (proxies /api)
cd client && npm run build                  # rebuild client/dist after UI changes
```

Optional settings (Atlas, SMTP, port, public URL for deployment) are explained in `server/.env.example`.

## Deploying online (optional)

Host the server on Render/Railway with a MongoDB Atlas `MONGODB_URI`, and set `PUBLIC_BASE_URL` to the live URL
so the verification QR codes on certificates work from anywhere. On localhost, the verification link only works on
the same computer.
