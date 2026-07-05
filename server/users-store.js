import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const GITHUB_REPO = process.env.GITHUB_REPO || "roollamora/restaurant-staff-calendar";
const GITHUB_PATH = "data/users.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function githubHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function parseStore(raw) {
  const store = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(store?.users)) {
    throw new Error("Invalid users data shape");
  }
  return store;
}

function readLocalFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_PATH)) {
    throw new Error("Missing data/users.json");
  }
  return parseStore(fs.readFileSync(USERS_PATH, "utf8"));
}

function writeLocalCache(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${USERS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n");
  fs.renameSync(tmp, USERS_PATH);
}

async function readFromGitHub() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=main`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) {
    const store = readLocalFile();
    return { store, sha: null };
  }
  if (!res.ok) {
    throw new Error(`GitHub users read failed (${res.status})`);
  }
  const file = await res.json();
  const text = Buffer.from(file.content, "base64").toString("utf8");
  return { store: parseStore(text), sha: file.sha };
}

async function writeToGitHub(store, sha, commitMessage) {
  const content = Buffer.from(JSON.stringify(store, null, 2) + "\n").toString(
    "base64",
  );
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: commitMessage,
      content,
      sha: sha ?? undefined,
      branch: "main",
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub users write failed (${res.status})`);
  }
  writeLocalCache(store);
}

async function loadStore() {
  if (GITHUB_TOKEN) {
    try {
      const { store } = await readFromGitHub();
      writeLocalCache(store);
      return store;
    } catch (e) {
      console.warn("GitHub users read failed, using local file:", e.message);
    }
  }
  return readLocalFile();
}

async function saveStore(store, commitMessage) {
  if (GITHUB_TOKEN) {
    const { sha } = await readFromGitHub();
    await writeToGitHub(store, sha, commitMessage);
    return;
  }
  writeLocalCache(store);
}

export function initUsersStore() {
  if (!fs.existsSync(USERS_PATH)) {
    throw new Error("Missing data/users.json — run from repo root");
  }
  console.log(`Users storage: ${GITHUB_TOKEN ? "github" : "local file"} (${GITHUB_PATH})`);
}

export async function getUserByUsername(username) {
  const store = await loadStore();
  const user = store.users.find(
    (u) => u.username.toLowerCase() === String(username).trim().toLowerCase(),
  );
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
    password_hash: user.passwordHash,
  };
}

export async function getUserById(id) {
  const store = await loadStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    display_name: user.displayName,
  };
}

export async function updatePassword(userId, passwordHash, username = "user") {
  const store = await loadStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  user.passwordHash = passwordHash;
  await saveStore(store, `Update password for ${username}`);
}

export async function listUsers() {
  const store = await loadStore();
  return store.users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
  }));
}

function nextUserId(users) {
  return users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
}

export async function createUser({ username, displayName, password }, actor = "admin") {
  const name = String(username ?? "").trim().toLowerCase();
  const label = String(displayName ?? "").trim();
  const pass = String(password ?? "");
  if (!name || !/^[a-z0-9._-]+$/.test(name)) {
    throw new Error("Username must be lowercase letters, numbers, . _ or -");
  }
  if (!label) throw new Error("Display name required");
  if (pass.length < 8) throw new Error("Password must be at least 8 characters");

  const store = await loadStore();
  if (store.users.some((u) => u.username.toLowerCase() === name)) {
    throw new Error("Username already exists");
  }
  const user = {
    id: nextUserId(store.users),
    username: name,
    displayName: label,
    passwordHash: bcrypt.hashSync(pass, 12),
  };
  store.users.push(user);
  await saveStore(store, `Add user ${name} by ${actor}`);
  return { id: user.id, username: user.username, displayName: user.displayName };
}

export async function deleteUser(userId, actor = "admin") {
  const store = await loadStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  if (user.username.toLowerCase() === "rula") {
    throw new Error("Cannot remove the admin account");
  }
  store.users = store.users.filter((u) => u.id !== userId);
  await saveStore(store, `Remove user ${user.username} by ${actor}`);
}
