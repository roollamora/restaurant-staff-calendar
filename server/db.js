import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "calendar.db");

const SEED_USERS = [
  { username: "rula", displayName: "Rula", password: "Rula2026!" },
  { username: "ayesha", displayName: "Ayesha", password: "Ayesha2026!" },
  { username: "federica", displayName: "Federica", password: "Federica2026!" },
  { username: "andrea", displayName: "Andrea", password: "Andrea2026!" },
  { username: "shahed", displayName: "Shahed", password: "Shahed2026!" },
];

let db;

export function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (userCount === 0) {
    const insert = db.prepare(
      "INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)",
    );
    const tx = db.transaction(() => {
      for (const u of SEED_USERS) {
        insert.run(u.username, u.displayName, bcrypt.hashSync(u.password, 12));
      }
    });
    tx();
    console.log("Seeded 5 user accounts.");
  }

  return db;
}

export function getUserByUsername(username) {
  return db
    .prepare(
      "SELECT id, username, display_name, password_hash FROM users WHERE username = ? COLLATE NOCASE",
    )
    .get(username);
}

export function getUserById(id) {
  return db
    .prepare("SELECT id, username, display_name FROM users WHERE id = ?")
    .get(id);
}

export function updatePassword(userId, passwordHash) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    passwordHash,
    userId,
  );
}
