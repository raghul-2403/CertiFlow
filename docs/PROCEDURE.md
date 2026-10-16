# CertiFlow — Event Feedback & Automated E-Certificate System

## Aim

To design and develop a web application that collects event feedback through a QR code and Google Form,
automatically generates a personalised e-certificate for every participant, emails it to them, and stores every
certificate with its details in a database where it can be verified.

## Software requirements

| Item | Version / detail |
|---|---|
| Operating system | Windows 10/11, macOS or Linux |
| Runtime | Node.js 20.19 or newer (LTS recommended) |
| Database | MongoDB 8 (started automatically on the laptop) or MongoDB Atlas |
| Backend | Node.js, Express 5, Mongoose 9, PDFKit, QRCode, ExcelJS, JSON Web Token, bcrypt |
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, Axios |
| Google | Google Form, Google Apps Script, Gmail (MailApp), Google Sheets |
| Editor | Visual Studio Code |

## Modules

1. **Authentication**: coordinator login with JWT and bcrypt, admin and coordinator roles.
2. **Event management**: create events, choose the certificate design, generate a QR code with the event pre-filled.
3. **Google Form integration**: an Apps Script creates the form; CertiFlow reads new responses every 30 seconds.
4. **Certificate generation**: a PDF is drawn on the club's design with the name, date, certificate ID and verify QR,
   then stored inside MongoDB using GridFS.
5. **Email delivery**: the certificate is sent from the coordinator's Gmail with automatic retries.
6. **Dashboard and analytics**: totals, ratings, reviews, Excel export, and responses that need attention.
7. **Verification**: a public page where anyone can check a certificate by scanning its QR code, and a
   "My certificates" page where a student downloads all their certificates with register number + email.
8. **Attendance check**: only students on the uploaded registration list, and/or only people who type the
   rotating code shown on the projector, get a certificate automatically; the rest wait for the coordinator.
9. **Awards**: Certificates of Merit (first/second/third place, winner, special mention) and of Appreciation
   (volunteers, organising team), on a merit version of the club's design.
10. **Bulk issue and reports**: certificates for a whole attendance list from Excel, and a one-click PDF event
    report for the department (numbers, feedback charts, colleges, awards, comments, participant list).

## Procedure

### Part A: Install and start (one time)

1. Install Node.js LTS from https://nodejs.org.
2. Extract the CertiFlow zip, for example to `N:\cert`. The project is in `N:\cert\certiflow`.
3. Start the app in one of two ways:
   - Double-click `start-windows.bat`, or
   - In VS Code, open the `certiflow` folder, then run `cd server`, `npm install` and `npm run dev` in the terminal.
4. Wait for **"✅ CertiFlow is running"** and open http://localhost:5000.
5. Log in with `admin@certiflow.local` / `Admin@123`. Change the password in **Settings**.

### Part B: Connect the Google Form (one time)

6. In **Settings**, click **Copy script**.
7. Open https://script.new (signed in with a personal Gmail account), delete the sample code, paste, and save.
8. Select **setup** and click **Run**. Allow the permissions. This creates the Google Form and the
   **CertiFlow Certificate Register** Google Sheet.
9. Click **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**.
10. Copy the Web app URL, paste it in **Settings**, and click **Connect**. The status shows **Connected**.

### Part C: Prepare an event

11. Go to **Events → New event**. Enter the name (e.g. *Query Quest*), the organiser and the date.
    Choose the certificate design (**RMKCET – Query Quest** is selected by default), then click **Create event**.
12. On the event page, click **Preview certificate PDF** to check the certificate.
13. Click **Print poster** or **Save QR** to get the QR code. It is a coloured QR (navy dots, gold corner eyes)
    with the college crest in the middle. It uses the highest error-correction level (H), so phones still scan it
    with the logo covering the centre. Change or remove the logo in **Settings → Organisation → College logo**.
14. Optional, **Attendance check** tab:
    - **Registered students only**: upload the registration list (Excel/CSV with a *Register No* column) and switch it on.
    - **Event code on the projector**: switch it on. A 4-digit code appears on the **Present QR** screen and changes
      every 5 minutes; participants type it in the form's *Event Code* question. (Needs Google script version 3:
      Settings shows how to update it.)
    Responses that fail a check are held in **Responses that need you** on the Overview, with **Approve and issue**.

### Part D: During and after the event

15. Display the QR code. Participants scan it, and the Google Form opens with the event name already filled in.
16. Participants enter their name, register number, college, email, rating and review, then submit.
17. Within about 30 seconds CertiFlow automatically:
    - saves the feedback in MongoDB,
    - generates the PDF certificate on the selected design,
    - stores the PDF in MongoDB (GridFS) with the participant's details,
    - emails the certificate to the participant,
    - adds it to the Google Sheet register used by the public verify page.
18. Check the results:
    - **Overview** shows totals and any responses that need attention.
    - The **event page** shows ratings and reviews; use **Export to Excel** for records.
    - **Certificates** lets you view, download, re-send or revoke certificates.
19. Anyone can scan the QR code printed on a certificate to confirm it is genuine. Students who lost the email
    open **/my-certificates** and download them again.
20. **Awards** tab → **Give an award**: choose First Place / Second Place / … / Volunteer, pick the participant
    (or type a volunteer's name and email) and click **Create and email**.
21. **Participants** tab → **Issue from Excel** for workshops with an attendance list: choose the file, check the
    preview (rows without an email or already issued are skipped) and click **Issue**.
22. Click **Report** on the event page to download the event report PDF for the department records.

### Part E: Testing

23. In the VS Code terminal, inside the `server` folder, run `npm test`.
    58 automated tests check the complete flow (login, events, form responses, certificates, email, verification,
    re-creating certificates, Gmail limits, attendance check, awards, Excel issue, event report, student lookup).
    All should report `ok`.

## Database collections

| Collection | Stores |
|---|---|
| `events` | event details, certificate design settings, counters |
| `feedbacks` | each form submission: name, register no, college, email, rating, review |
| `certificates` | certificate ID, type (participation or award), participant and event details, email status, validity |
| `certificates.files` / `certificates.chunks` | the certificate PDFs (GridFS) |
| `templates.files` / `templates.chunks` | the certificate design images (GridFS) |
| `admins` | coordinator logins (passwords hashed with bcrypt) |
| `registrations` | the registered students list of each event (for the attendance check) |
| `syncissues` | responses that could not be processed automatically, or held by the attendance check |
| `settings` | Google connection and app settings |

## Result

The system was developed and tested successfully. After a participant scans the QR code and submits the Google
Form, a personalised certificate on the club's design is generated, emailed and stored in the database within about
30 seconds, and it can be verified by anyone by scanning the QR code on the certificate. The attendance check stops
certificates going to people who did not attend, winners and volunteers receive award certificates, whole attendance
lists can be certified from Excel, and the department gets a one-click event report.
