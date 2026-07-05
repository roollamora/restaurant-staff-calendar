import express from "express";
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
import { signToken, authMiddleware, optionalAuth } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3847;
const isProd = process.env.NODE_ENV === "production";
const clientDist = path.join(__dirname, "..", "client", "dist");
const BUILD_ID = process.env.RENDER_GIT_COMMIT?.slice(0, 7) || "local";

initUsersStore();
initCalendarStore();

const app = express();
app.use(express.json({ limit: "2mb" }));

function userPayload(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
  };
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
    res.json({
      user: userPayload(user),
      token: signToken(user.id),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/logout", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/me", optionalAuth, async (req, res) => {
  if (!req.userId) {
    return res.json({ user: null });
  }
  try {
    const user = await getUserById(req.userId);
    if (!user) return res.json({ user: null });
    res.json({ user: userPayload(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/change-password", authMiddleware, async (req, res) => {
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
    const profile = await getUserById(req.userId);
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

app.get("/api/data", authMiddleware, async (_req, res) => {
  try {
    res.json(await getCalendarData());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, build: BUILD_ID });
});

app.put("/api/data", authMiddleware, async (req, res) => {
  const { data, version } = req.body ?? {};
  if (typeof version !== "number") {
    return res.status(400).json({ error: "Version required" });
  }
  try {
    const user = await getUserById(req.userId);
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
  console.log(`Restaurant calendar server http://localhost:${PORT} (build ${BUILD_ID})`);
});
