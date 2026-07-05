import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const CALENDAR_PATH = path.join(DATA_DIR, "calendar.json");
const GITHUB_REPO = process.env.GITHUB_REPO || "roollamora/restaurant-staff-calendar";
const GITHUB_PATH = "data/calendar.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export const DEFAULT_DATA = {
  staff: [],
  hoursPeriods: [
    {
      id: "default",
      label: "Default",
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: `${new Date().getFullYear()}-12-31`,
      days: Array.from({ length: 7 }, (_, dayIndex) => ({
        dayIndex,
        isOpen: false,
        openTime: "12:00",
        closeTime: "22:00",
      })),
    },
  ],
  events: [],
  shifts: [],
};

function blankDayHours() {
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    isOpen: false,
    openTime: "12:00",
    closeTime: "22:00",
  }));
}

function migrateData(data) {
  if (!data || typeof data !== "object") return DEFAULT_DATA;
  if (Array.isArray(data.hoursPeriods) && data.hoursPeriods.length > 0) {
    const { hours: _legacy, ...rest } = data;
    return rest;
  }
  const y = new Date().getFullYear();
  const { hours, ...rest } = data;
  return {
    ...rest,
    hoursPeriods: [
      {
        id: "migrated-default",
        label: "Default",
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        days: Array.isArray(hours) && hours.length === 7 ? hours : blankDayHours(),
      },
    ],
  };
}

function defaultEnvelope() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    data: DEFAULT_DATA,
  };
}

function validateHoursPeriods(periods) {
  if (!Array.isArray(periods) || periods.length === 0) return false;
  return periods.every(
    (p) =>
      p.id &&
      p.startDate &&
      p.endDate &&
      p.startDate <= p.endDate &&
      Array.isArray(p.days) &&
      p.days.length === 7 &&
      p.days.every(
        (d) =>
          typeof d.dayIndex === "number" &&
          typeof d.isOpen === "boolean" &&
          typeof d.openTime === "string" &&
          typeof d.closeTime === "string",
      ),
  );
}

function validateData(data) {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.staff)) return false;
  if (!validateHoursPeriods(data.hoursPeriods)) return false;
  if (!Array.isArray(data.events)) return false;
  if (!Array.isArray(data.shifts)) return false;
  return true;
}

function parseEnvelope(raw) {
  const envelope = typeof raw === "string" ? JSON.parse(raw) : raw;
  const data = migrateData(envelope?.data);
  if (!validateData(data)) {
    throw new Error("Invalid calendar data shape");
  }
  if (typeof envelope.version !== "number") {
    throw new Error("Invalid calendar version");
  }
  return { ...envelope, data };
}

function githubHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readFromGitHub() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=main`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) {
    return { envelope: defaultEnvelope(), sha: null };
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub read failed (${res.status}): ${err}`);
  }
  const file = await res.json();
  const text = Buffer.from(file.content, "base64").toString("utf8");
  return { envelope: parseEnvelope(text), sha: file.sha };
}

async function writeToGitHub(envelope, sha, commitMessage) {
  const content = Buffer.from(JSON.stringify(envelope, null, 2) + "\n").toString(
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
  if (res.status === 409) {
    const err = new Error("Version conflict — data was updated elsewhere");
    err.code = "VERSION_CONFLICT";
    throw err;
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub write failed (${res.status}): ${err}`);
  }
  const body = await res.json();
  writeLocalCache(envelope);
  return body.content.sha;
}

function readLocalFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CALENDAR_PATH)) {
    const envelope = defaultEnvelope();
    writeLocalCache(envelope);
    return envelope;
  }
  return parseEnvelope(fs.readFileSync(CALENDAR_PATH, "utf8"));
}

function writeLocalCache(envelope) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${CALENDAR_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(envelope, null, 2) + "\n");
  fs.renameSync(tmp, CALENDAR_PATH);
}

function saveLocalFile(envelope, expectedVersion) {
  const current = readLocalFile();
  if (current.version !== expectedVersion) {
    const err = new Error("Version conflict — data was updated elsewhere");
    err.code = "VERSION_CONFLICT";
    throw err;
  }
  writeLocalCache(envelope);
}

export function initCalendarStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CALENDAR_PATH)) {
    writeLocalCache(defaultEnvelope());
  }
  const mode = GITHUB_TOKEN ? "github" : "local file";
  console.log(`Calendar storage: ${mode} (${GITHUB_PATH})`);
}

export async function getCalendarData() {
  if (GITHUB_TOKEN) {
    try {
      const { envelope } = await readFromGitHub();
      writeLocalCache(envelope);
      return {
        data: envelope.data,
        version: envelope.version,
        updatedAt: envelope.updatedAt,
      };
    } catch (e) {
      console.warn("GitHub calendar read failed, using local file:", e.message);
    }
  }

  const envelope = readLocalFile();
  return {
    data: envelope.data,
    version: envelope.version,
    updatedAt: envelope.updatedAt,
  };
}

export async function saveCalendarData(data, expectedVersion, username = "user") {
  const payload = migrateData(data);
  if (!validateData(payload)) {
    throw new Error("Invalid calendar data shape");
  }

  const nextEnvelope = {
    version: expectedVersion + 1,
    updatedAt: new Date().toISOString(),
    data: payload,
  };

  if (GITHUB_TOKEN) {
    const { envelope, sha } = await readFromGitHub();
    if (envelope.version !== expectedVersion) {
      const err = new Error("Version conflict — data was updated elsewhere");
      err.code = "VERSION_CONFLICT";
      throw err;
    }
    await writeToGitHub(
      nextEnvelope,
      sha,
      `Update calendar (v${nextEnvelope.version}) by ${username}`,
    );
    return { version: nextEnvelope.version, updatedAt: nextEnvelope.updatedAt };
  }

  saveLocalFile(nextEnvelope, expectedVersion);
  return { version: nextEnvelope.version, updatedAt: nextEnvelope.updatedAt };
}
