import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  initUsersStore,
  getUserByUsername,
  getUserById,
  updatePassword,
} from "./users-store.js";
import {
  initCalendarStore,
  getCalendarData,
  saveCalendarData,
} from "./calendar-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3847;
const isProd = process.env.NODE_ENV === "production";
const useSecureCookies = process.env.COOKIE_SECURE === "true";
const clientDist = path.join(__dirname, "..", "client", "dist");

initUsersStore();
initCalendarStore();

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(
  session({
    name: "rsc.sid",
    secret: process.env.SESSION_SECRET || "dev-only-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  try {
    const user = await getUserByUsername(String(username).trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    req.session.userId = user.id;
    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("rsc.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const user = await getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Current and new password required" });
  }
  if (String(newPassword).length < 8) {
    return res
      .status(400)
      .json({ error: "New password must be at least 8 characters" });
  }
  try {
    const profile = await getUserById(req.session.userId);
    const user = await getUserByUsername(profile.username);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    await updatePassword(
      user.id,
      bcrypt.hashSync(newPassword, 12),
      profile.username,
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/data", requireAuth, async (_req, res) => {
  try {
    res.json(await getCalendarData());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.put("/api/data", requireAuth, async (req, res) => {
  const { data, version } = req.body ?? {};
  if (typeof version !== "number") {
    return res.status(400).json({ error: "Version required" });
  }
  try {
    const user = await getUserById(req.session.userId);
    const result = await saveCalendarData(data, version, user?.username);
    res.json(result);
  } catch (e) {
    if (e.code === "VERSION_CONFLICT") {
      const latest = await getCalendarData();
      return res.status(409).json({
        error: e.message,
        data: latest.data,
        version: latest.version,
      });
    }
    res.status(400).json({ error: e.message });
  }
});

if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.type("text").send("Run npm run dev — API on this port, Vite on :5173");
  });
}

app.listen(PORT, () => {
  console.log(`Restaurant calendar server http://localhost:${PORT}`);
});
