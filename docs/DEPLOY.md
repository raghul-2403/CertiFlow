# Putting CertiFlow online (free)

On a laptop, CertiFlow only makes and emails certificates while the laptop is on and CertiFlow is running.
Online, it runs all the time, and the QR code on every certificate opens your own verify page.

You need three free accounts: **GitHub**, **MongoDB Atlas** (the database) and **Render** (the server).
It takes about 30 minutes the first time.

## 1. Database: MongoDB Atlas

1. Sign up at https://www.mongodb.com/cloud/atlas/register and create a **free M0 cluster**
   (choose the Mumbai region, AWS `ap-south-1`).
2. **Database Access → Add new database user**: username `certiflow`, click *Autogenerate secure password*, copy it.
3. **Network Access → Add IP address → Allow access from anywhere** (`0.0.0.0/0`). Render's addresses change,
   so this is needed; the password still protects the database.
4. **Database → Connect → Drivers**. Copy the connection string and put your password in it, and the database
   name `certiflow` before the `?`:
   `mongodb+srv://certiflow:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/certiflow?retryWrites=true&w=majority`

## 2. Code: GitHub

1. Create a new **private** repository on https://github.com/new, e.g. `certiflow`.
2. Upload the whole `certiflow` folder (drag the files onto the page, or use GitHub Desktop).
   Do **not** upload `server/.data` or any `node_modules` folder (the included `.gitignore` leaves them out).

## 3. Server: Render

1. Sign up at https://render.com with your GitHub account.
2. **New → Blueprint**, pick the `certiflow` repository. Render reads `render.yaml` and asks for:

   | Setting | Value |
   |---|---|
   | `MONGODB_URI` | the Atlas connection string from step 1 |
   | `PUBLIC_BASE_URL` | leave empty for now |
   | `ADMIN_EMAIL` | your email, e.g. `cse.events@rmkcet.ac.in` |
   | `ADMIN_PASSWORD` | a strong password (at least 8 characters) |

3. Click **Apply**. The first build takes 3–5 minutes. Render then shows the address, like
   `https://certiflow-xxxx.onrender.com`.
4. In Render, open the service → **Environment**, set `PUBLIC_BASE_URL` to that address (no `/` at the end),
   and save. Render restarts it.
5. Open the address and log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## 4. Connect Google again

The online CertiFlow has its own secret key, so the Google script needs the new copy:

1. **Settings → Copy script**, paste it over the old code in your Apps Script project and save.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The web app URL stays the same.
3. Paste the web app URL in **Settings** and click **Connect**.

## 5. Keep it awake

Render's free plan sleeps after 15 minutes without visitors, and a sleeping server doesn't read new form responses.
The script you just pasted can wake it every 10 minutes:

1. In Apps Script, choose **setupKeepAwake** next to Run, click **Run** and allow the permissions.
2. Check **Triggers** (the clock icon on the left): a `keepAwake` trigger every 10 minutes.

(Another way: a free monitor at https://cron-job.org that opens `https://YOUR-APP.onrender.com/api/health` every 10 minutes.)

## Moving your existing data

Events and certificates on your laptop are in its local database. To move them, install
[MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools), start CertiFlow on the laptop, and run:

```
mongodump --uri "mongodb://127.0.0.1:27031/certiflow" --out certiflow-backup
mongorestore --uri "YOUR_ATLAS_CONNECTION_STRING" --nsInclude "certiflow.*" certiflow-backup
```

Then follow step 4 again (the restored settings contain the laptop's Google secret).

## Good to know

- Gmail sends about 100 emails a day from a personal account. For bigger events, add SMTP settings
  (`SMTP_USER`, `SMTP_PASS`, see `server/.env.example`) in Render → Environment.
- The default admin password is never shown on the login page once `PUBLIC_BASE_URL` is set.
- Free Render services restart now and then; nothing is lost because everything is in Atlas.
