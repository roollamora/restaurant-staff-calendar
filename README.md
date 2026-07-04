# Restaurant Staff Calendar

Full-screen staff scheduling calendar with shared persistence, login, and role-based editing for your team.

## Features

- **Calendar**: week rows (Mon–Sun), scroll to load more weeks, 70px min day cells
- **Day box editing**: `+ Shift` on each day, inline add/remove shifts
- **Menu overlay**: Personnel, Opening hours, Events, Account (password change)
- **Server persistence**: schedules stored in `data/calendar.json` (small JSON, tracked in GitHub)
- **Multi-user**: five accounts share one calendar (version locking prevents corruption)

## Where schedules are stored

| What | Where |
|------|--------|
| Shifts, staff, hours, events | `data/calendar.json` in this repo (~few KB) |
| Login accounts (hashed passwords) | `data/users.json` in this repo |

Every save bumps a **version number**. If two people edit at once, the second save gets the latest data instead of overwriting — schedules won't get corrupted.

**Local dev:** edits write to `data/calendar.json`. Commit and push when you want to back up.

**Deployed app:** set `GITHUB_TOKEN` — each save commits to GitHub automatically (no disk volume needed).

Create a fine-grained token with **Contents: Read and write** on this repo only.

## Login accounts

| Name     | Username   | Initial password |
|----------|------------|------------------|
| Rula     | `rula`     | `Rula2026!`      |
| Ayesha   | `ayesha`   | `Ayesha2026!`    |
| Federica | `federica` | `Federica2026!`  |
| Andrea   | `andrea`   | `Andrea2026!`    |
| Shahed   | `shahed`   | `Shahed2026!`    |

**Change your password** after first login: Menu → Account → Change password.

## Local development

```bash
npm install
npm run dev
```

- App: http://localhost:5173 (proxied API)
- API: http://localhost:3847

## Production

```bash
cp .env.example .env
# Edit SESSION_SECRET to a long random string
# Set COOKIE_SECURE=true when serving over HTTPS in production

npm install
npm run build
npm start
```

Open http://localhost:3847

Login accounts use `data/users.json` (hashed passwords, in git). **Schedules** live in `data/calendar.json`.

## Staff access URL

**Deploy once on Render (free):**

1. Open: https://render.com/deploy?repo=https://github.com/roollamora/restaurant-staff-calendar
2. Sign in / create a Render account
3. When prompted, add env var **`GITHUB_TOKEN`** — create a [fine-grained token](https://github.com/settings/tokens?type=beta) with **Contents: Read and write** on this repo (paste the token value)
4. Click **Deploy** — Render gives you a URL like `https://restaurant-staff-calendar.onrender.com`

Share that URL with staff. Logins are in the table above.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/roollamora/restaurant-staff-calendar)

## Deploying (Render, Railway, Fly.io, VPS)

1. Push this repo to GitHub
2. Set environment variables: `SESSION_SECRET`, `PORT`, `GITHUB_TOKEN`, `GITHUB_REPO`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

With `GITHUB_TOKEN`, schedules persist in GitHub — no persistent volume required. Set `COOKIE_SECURE=true` when serving over HTTPS.

## Tech stack

- **Frontend**: React + Vite
- **Backend**: Express + express-session
- **Database**: SQLite (WAL mode, transactional saves, version conflict detection)
