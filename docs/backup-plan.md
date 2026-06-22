# Quote App Backup and Restore Plan

This plan covers the WovenBag Quote Management System in this repository.

The goal is simple: if the laptop, app folder, database, or deployment tunnel fails, we must be able to restore the quote app with no surprises.

## Current App State

- App folder: `C:\Users\User\Documents\quote-app`
- Runtime: Node.js / Express
- Start command: `npm start` or `node src/app.js`
- Local URL: `http://localhost:3000`
- Public tunnel URL: `https://maru.iananas.eu`
- Database: `data/quotes.db`
- Database engine: SQL.js SQLite file persisted by the app
- Static assets: `public/`
- Views and business logic: `views/`, `src/`
- Important local tunnel config: `C:\Users\User\.cloudflared\config.yml`

## What Must Be Backed Up

### Critical

- `data/quotes.db`
  - Users
  - Quotes
  - Quote audit history
  - Pricing and master-rate configuration
  - Sessions, if still present

### Important

- Source code in GitHub: `src/`, `views/`, `public/`, `package.json`, `package-lock.json`
- Startup scripts:
  - `start-quote-app-stable.ps1`
  - `start-maruquote-tunnel-stable.ps1`
  - `start-quote-app-with-tunnel.ps1`
- README and documentation
- Cloudflare tunnel config:
  - `C:\Users\User\.cloudflared\config.yml`
  - Tunnel credential JSON referenced by that config

### Optional

- Logs under `logs/`
- Old exports, generated PDFs, or upload folders if the app adds them later

## What Must Not Be Stored Publicly

Do not commit these to GitHub:

- Live database backups
- Cloudflare tunnel credential JSON files
- `.env` files or real environment secrets
- DPD credentials, API tokens, session secrets, or passwords

GitHub is for source code and this plan. Google Drive, another private drive, or encrypted storage is for database and private config backups.

## Backup Frequency

### Daily Automated Backup

Run once per day, preferably at night when the app is not being actively used.

Recommended time: `02:00` local machine time.

Daily backup should include:

- `data/quotes.db`
- `package.json`
- `package-lock.json`
- startup scripts
- redacted config notes
- Cloudflare tunnel config and credential files in a private backup location

### Weekly Restore Test

Once per week, restore the latest backup into a temporary folder and confirm:

- App starts
- Login page opens
- Quote list opens
- Existing quotes are visible
- Pricing/master-rate configuration is present
- A test quote can be calculated

### Before Risky Changes

Create a manual backup before:

- Database schema changes
- Pricing logic changes
- Large feature changes
- Updating Node.js dependencies
- Moving the app to another machine

## Backup Storage Layout

Recommended private backup root:

```text
Google Drive/MaruQuote Backups/
  daily/
    2026-06-22/
      quotes.db
      manifest.json
      quote-app-source.zip
      cloudflared-config.yml
      cloudflared-credentials.json
  weekly/
  monthly/
  restore-tests/
```

Recommended backup file naming:

```text
maruquote-backup-YYYY-MM-DD-HHMMSS.zip
```

Each backup should contain a `manifest.json`:

```json
{
  "app": "quote-app",
  "createdAt": "YYYY-MM-DDTHH:mm:ssZ",
  "sourceMachine": "Naresh Windows PC",
  "databasePath": "data/quotes.db",
  "gitCommit": "commit-sha-if-available",
  "files": [
    {
      "path": "data/quotes.db",
      "sha256": "checksum"
    }
  ],
  "notes": "Daily automated backup"
}
```

## Retention Policy

Keep:

- Daily backups for 14 days
- Weekly backups for 8 weeks
- Monthly backups for 12 months
- Manual pre-change backups for at least 6 months

This gives enough history to recover from accidental deletion, unnoticed bad data, or a broken app update.

## Consistent Database Backup Procedure

The database is a single SQLite file written by SQL.js. To avoid copying the database while the app is writing to it, use one of these approaches.

### Phase 1: Safe Manual Backup

Use this until automation is implemented.

1. Confirm no one is actively creating or editing quotes.
2. Stop the quote app process.
3. Copy `data/quotes.db` into the backup folder.
4. Copy source/config files into the backup folder.
5. Create checksums for copied files.
6. Start the quote app again.
7. Open `http://localhost:3000/login`.
8. Open `https://maru.iananas.eu/login`.

### Phase 2: Automated Daily Backup

Create a PowerShell backup script that:

1. Detects the quote app process.
2. Performs a consistent database copy.
3. Creates a timestamped zip file.
4. Writes `manifest.json`.
5. Verifies the copied database can be opened.
6. Uploads or syncs the zip to Google Drive.
7. Logs success/failure.
8. Keeps only backups allowed by the retention policy.

Best implementation options:

- Preferred: add a small internal app backup endpoint/command that exports the SQL.js database safely.
- Acceptable: pause/stop the app briefly during the 02:00 backup window, copy `data/quotes.db`, then restart it.

## Restore Procedure

Use this when the app must be restored from backup.

1. Stop the running quote app.
2. Copy the current broken app folder to a temporary safety folder if it still exists.
3. Install or confirm Node.js is available.
4. Clone or pull the latest source code from GitHub.
5. Run:

```powershell
npm install
```

6. Restore the database:

```powershell
Copy-Item "PATH_TO_BACKUP\quotes.db" "C:\Users\User\Documents\quote-app\data\quotes.db" -Force
```

7. Restore private config if needed:

```powershell
Copy-Item "PATH_TO_BACKUP\cloudflared-config.yml" "C:\Users\User\.cloudflared\config.yml" -Force
```

8. Start the quote app:

```powershell
npm start
```

9. Start the tunnel:

```powershell
C:\Users\User\Downloads\cloudflared.exe tunnel --config C:\Users\User\.cloudflared\config.yml run maruquote
```

10. Verify:

- `http://localhost:3000/login` returns 200
- `https://maru.iananas.eu/login` returns 200
- Login works
- Quote list loads
- Existing quote numbers are present
- Pricing config is present
- A quote calculation works

## Restore Test Checklist

For each weekly restore test, record:

- Backup file tested
- Restore test date
- Whether the app started
- Whether login worked
- Number of quotes visible
- Any errors found
- Who confirmed the test

Store restore test notes under:

```text
Google Drive/MaruQuote Backups/restore-tests/
```

## First Implementation Tasks

1. Create the first manual backup.
2. Choose backup target:
   - Google Drive folder
   - local external disk
   - both
3. Create `scripts/backup-quote-app.ps1`.
4. Create `scripts/restore-quote-app.ps1`.
5. Add scheduled task for daily 02:00 backup.
6. Add backup verification and checksum manifest.
7. Run first restore test from the backup.
8. Document the restore test result.

## Definition of Done

Backup is considered production-ready only when:

- A backup can be created without losing data.
- The backup is stored outside the app folder.
- At least one backup is stored off the laptop.
- A restore test has succeeded.
- The restore steps are documented.
- Naresh knows where the backup files are stored.
- The latest backup status can be checked quickly.

