# Restaurant Staff Calendar

Full-screen staff scheduling calendar with shared persistence, login, and role-based editing for your team.

## Features

- **Calendar**: week rows (Mon–Sun), scroll to load more weeks, 70px min day cells
- **Day box editing**: `+ Shift` on each day, inline add/remove shifts
- **Menu overlay**: Personnel, Opening hours, Events, Account (password change)
- **Server persistence**: SQLite database — changes auto-save and survive restarts
- **Multi-user**: five accounts share one calendar (optimistic locking prevents corruption)

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

Data is stored in `data/calendar.db` (created automatically). **Back up this file** — it holds all calendar data and password hashes.

## Deploying (Railway, Render, Fly.io, VPS)

1. Push this repo to GitHub
2. Set environment variables: `SESSION_SECRET`, `PORT`
3. Attach a **persistent volume** to `/app/data` (or project `data/` folder) so SQLite is not wiped on redeploy
4. Build command: `npm install && npm run build`
5. Start command: `npm start`

Without persistent storage, calendar data resets on each deploy.

## Tech stack

- **Frontend**: React + Vite
- **Backend**: Express + express-session
- **Database**: SQLite (WAL mode, transactional saves, version conflict detection)
