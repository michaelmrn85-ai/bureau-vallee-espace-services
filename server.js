const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const qrcode = require("qrcode-generator");

const app = express();
const PORT = Number(process.env.PORT) || 3100;
const RENDER_BASE_URL = "https://bureau-vallee-espace-services.onrender.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || RENDER_BASE_URL).replace(/\/$/, "");
const DATA_DIR = path.join(__dirname, "data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const TMP_DIR = path.join(DATA_DIR, "tmp");
const NOTICE_FILE = path.join(DATA_DIR, "notice.json");
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const HISTORY_FILE = path.join(DATA_DIR, "job-history.json");
const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 80 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"]);
const stations = {
  "poste-1": "Poste 1",
  "poste-2": "Poste 2",
};

fs.mkdirSync(JOBS_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter(request, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      callback(new Error("Format non accepte. PDF, Word, PNG et JPEG uniquement."));
      return;
    }
    callback(null, true);
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (request, response) => {
  response.redirect("/poste-1");
});

app.get(["/poste-1", "/poste-2"], (request, response) => {
  response.sendFile(path.join(__dirname, "public", "index.html"));
});

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function jobDir(code) {
  return path.join(JOBS_DIR, code);
}

function jobPath(code) {
  return path.join(jobDir(code), "job.json");
}

function readJob(code) {
  const filePath = jobPath(code);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeJob(job) {
  fs.writeFileSync(jobPath(job.code), JSON.stringify(job, null, 2));
}

function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeHistory(history) {
  const cutoff = Date.now() - HISTORY_TTL_MS;
  const cleanedHistory = history.filter((job) => new Date(job.deletedAt || job.createdAt).getTime() >= cutoff);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(cleanedHistory, null, 2));
}

function archiveJob(job, reason) {
  if (!job) return;
  const history = readHistory().filter((item) => item.code !== job.code);
  history.unshift({
    ...publicJob(job, "termine"),
    deletedAt: new Date().toISOString(),
    deleteReason: reason,
    files: job.files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      extension: file.extension.replace(".", ""),
      size: file.size,
      pages: file.pages || 1,
    })),
  });
  writeHistory(history);
}

function deleteJob(code, reason = "suppression") {
  archiveJob(readJob(code), reason);
  fs.rmSync(jobDir(code), { recursive: true, force: true });
}

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const code of fs.readdirSync(JOBS_DIR)) {
    const job = readJob(code);
    if (!job || new Date(job.expiresAt).getTime() <= now) {
      deleteJob(code, "expiration");
    }
  }
}

function listActiveJobs() {
  cleanupExpiredJobs();
  return fs.readdirSync(JOBS_DIR)
    .map((code) => readJob(code))
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function estimatePdfPages(filePath) {
  try {
    const content = fs.readFileSync(filePath, "latin1");
    const matches = content.match(/\/Type\s*\/Page\b/g);
    return Math.max(1, matches ? matches.length : 1);
  } catch (error) {
    return 1;
  }
}

function estimatePages(filePath, extension) {
  if (extension === ".pdf") return estimatePdfPages(filePath);
  return 1;
}

function reserveCode() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const code = generateCode();
    if (!fs.existsSync(jobDir(code))) {
      fs.mkdirSync(jobDir(code), { recursive: true });
      return code;
    }
  }
  throw new Error("Impossible de creer un code disponible.");
}

function listTrackedJobs() {
  const activeJobs = listActiveJobs().map((job) => publicJob(job, "actif"));
  const activeCodes = new Set(activeJobs.map((job) => job.code));
  const history = readHistory()
    .filter((job) => !activeCodes.has(job.code))
    .map((job) => ({ ...job }));
  writeHistory(history);
  return [...activeJobs, ...history]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function publicJob(job, status = "actif") {
  const station = stationFrom(job.station);
  const files = job.files.map((file) => ({
    id: file.id,
    originalName: file.originalName,
    extension: file.extension.replace(".", ""),
    size: file.size,
    pages: file.pages || 1,
    viewUrl: `/api/jobs/${job.code}/files/${file.id}`,
    downloadUrl: `/api/jobs/${job.code}/files/${file.id}?download=1`,
  }));
  const totalPages = files.reduce((sum, file) => sum + file.pages, 0);
  const printMode = job.printMode === "couleur" ? "couleur" : "noir-blanc";
  return {
    code: job.code,
    customerName: job.customerName,
    station,
    stationLabel: stations[station],
    printMode,
    totalPages,
    bwPages: printMode === "couleur" ? 0 : totalPages,
    colorPages: printMode === "couleur" ? totalPages : 0,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    status,
    downloadAllUrl: files.length ? `/api/jobs/${job.code}/download-all` : "",
    files,
  };
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function uniqueZipName(name, usedNames) {
  const parsed = path.parse(name.replace(/[\\/:*?"<>|]/g, "-"));
  let candidate = `${parsed.name}${parsed.ext}`;
  let index = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${parsed.name}-${index}${parsed.ext}`;
    index += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function uploadUrl(station = "poste-1") {
  return `${PUBLIC_BASE_URL}/upload?station=${stationFrom(station)}`;
}

function readNotice() {
  if (!fs.existsSync(NOTICE_FILE)) {
    return { active: false, message: "" };
  }
  try {
    return { active: false, message: "", ...JSON.parse(fs.readFileSync(NOTICE_FILE, "utf8")) };
  } catch (error) {
    return { active: false, message: "" };
  }
}

function writeNotice(notice) {
  fs.writeFileSync(NOTICE_FILE, JSON.stringify(notice, null, 2));
}

function defaultSession() {
  return {
    message: "Bienvenue en Espace Services, merci de vous approcher du ou de la vendeuse.",
    stations: {
      "poste-1": { active: false },
      "poste-2": { active: false },
    },
  };
}

function stationFrom(value) {
  return Object.prototype.hasOwnProperty.call(stations, value) ? value : "poste-1";
}

function readSession() {
  if (!fs.existsSync(SESSION_FILE)) return defaultSession();
  try {
    const saved = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    const defaults = defaultSession();
    const legacyActive = typeof saved.active === "boolean" ? saved.active : undefined;
    return {
      ...defaults,
      ...saved,
      stations: {
        "poste-1": { ...defaults.stations["poste-1"], ...saved.stations?.["poste-1"], ...(legacyActive === undefined ? {} : { active: legacyActive }) },
        "poste-2": { ...defaults.stations["poste-2"], ...saved.stations?.["poste-2"], ...(legacyActive === undefined ? {} : { active: legacyActive }) },
      },
    };
  } catch (error) {
    return defaultSession();
  }
}

function writeSession(session) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

app.get("/health", (request, response) => {
  response.json({ ok: true });
});

app.get("/upload", (request, response) => {
  response.sendFile(path.join(__dirname, "public", "upload.html"));
});

app.get("/codes", (request, response) => {
  response.redirect("/admin");
});

app.get("/message", (request, response) => {
  response.redirect("/admin");
});

app.get("/admin", (request, response) => {
  response.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/qr.svg", (request, response) => {
  const qr = qrcode(0, "M");
  qr.addData(uploadUrl(request.query.station));
  qr.make();
  response.type("image/svg+xml").send(qr.createSvgTag({ cellSize: 8, margin: 4 }));
});

app.get("/api/config", (request, response) => {
  const station = stationFrom(request.query.station);
  response.json({
    uploadUrl: uploadUrl(station),
    qrUrl: `/qr.svg?station=${station}`,
    stationLinks: {
      "poste-1": `${PUBLIC_BASE_URL}/poste-1`,
      "poste-2": `${PUBLIC_BASE_URL}/poste-2`,
    },
  });
});

app.get("/api/notice", (request, response) => {
  response.json(readNotice());
});

app.post("/api/notice", (request, response) => {
  const message = String(request.body.message || "").trim().slice(0, 160);
  const notice = {
    active: Boolean(request.body.active) && Boolean(message),
    message,
    updatedAt: new Date().toISOString(),
  };
  writeNotice(notice);
  response.json(notice);
});

app.get("/api/session", (request, response) => {
  const session = readSession();
  const station = stationFrom(request.query.station);
  response.json({
    station,
    stationLabel: stations[station],
    active: Boolean(session.stations[station].active),
    message: session.message,
    stations: Object.fromEntries(Object.entries(stations).map(([id, label]) => [
      id,
      { label, active: Boolean(session.stations[id].active) },
    ])),
    updatedAt: session.updatedAt,
  });
});

app.post("/api/session", (request, response) => {
  const message = String(request.body.message || "").trim().slice(0, 180) || defaultSession().message;
  const station = stationFrom(request.body.station);
  const current = readSession();
  const session = {
    message,
    stations: {
      ...current.stations,
      [station]: { active: Boolean(request.body.active) },
    },
    updatedAt: new Date().toISOString(),
  };
  writeSession(session);
  response.json({
    station,
    stationLabel: stations[station],
    active: Boolean(session.stations[station].active),
    message: session.message,
    stations: Object.fromEntries(Object.entries(stations).map(([id, label]) => [
      id,
      { label, active: Boolean(session.stations[id].active) },
    ])),
    updatedAt: session.updatedAt,
  });
});

app.get("/api/jobs", (request, response) => {
  response.json({
    jobs: listTrackedJobs(),
  });
});

app.post("/api/jobs", upload.array("files", 10), (request, response, next) => {
  try {
    if (!request.files?.length) {
      response.status(400).json({ error: "Ajoutez au moins un fichier." });
      return;
    }

    const code = reserveCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + JOB_TTL_MS);
    const directory = jobDir(code);
    const printMode = request.body.printMode === "couleur" ? "couleur" : "noir-blanc";
    const files = request.files.map((file, index) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const id = `${Date.now()}-${index}`;
      const storedName = `${id}${extension}`;
      const storedPath = path.join(directory, storedName);
      fs.renameSync(file.path, storedPath);
      return {
        id,
        originalName: file.originalname,
        storedName,
        extension,
        size: file.size,
        pages: estimatePages(storedPath, extension),
      };
    });

    const job = {
      code,
      customerName: String(request.body.customerName || "").trim(),
      station: stationFrom(request.body.station),
      printMode,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      files,
    };

    writeJob(job);
    response.status(201).json(publicJob(job));
  } catch (error) {
    next(error);
  }
});

app.get("/api/jobs/:code", (request, response) => {
  const job = readJob(request.params.code);
  if (!job) {
    response.status(404).json({ error: "Code introuvable." });
    return;
  }
  if (new Date(job.expiresAt).getTime() <= Date.now()) {
    deleteJob(job.code, "expiration");
    response.status(404).json({ error: "Code expire." });
    return;
  }
  if (request.query.station) {
    job.station = stationFrom(request.query.station);
    writeJob(job);
  }
  response.json(publicJob(job));
});

app.get("/api/jobs/:code/download-all", (request, response) => {
  const job = readJob(request.params.code);
  if (!job) {
    response.status(404).send("Code introuvable.");
    return;
  }

  const usedNames = new Set();
  const entries = job.files.map((file) => ({
    name: uniqueZipName(file.originalName, usedNames),
    data: fs.readFileSync(path.join(jobDir(job.code), file.storedName)),
  }));
  const zip = createZipBuffer(entries);
  response.setHeader("Content-Type", "application/zip");
  response.setHeader("Content-Disposition", `attachment; filename="bureau-vallee-${job.code}.zip"`);
  response.send(zip);
});

app.get("/api/jobs/:code/files/:fileId", (request, response) => {
  const job = readJob(request.params.code);
  if (!job) {
    response.status(404).send("Code introuvable.");
    return;
  }

  const file = job.files.find((item) => item.id === request.params.fileId);
  if (!file) {
    response.status(404).send("Fichier introuvable.");
    return;
  }

  const filePath = path.join(jobDir(job.code), file.storedName);
  if (request.query.download) {
    response.download(filePath, file.originalName);
    return;
  }

  response.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
  response.sendFile(filePath);
});

app.delete("/api/jobs/:code", (request, response) => {
  deleteJob(request.params.code, "fin-session");
  response.json({ ok: true });
});

app.use((error, request, response, next) => {
  for (const file of request.files || []) {
    if (file.path && fs.existsSync(file.path)) fs.rmSync(file.path, { force: true });
  }
  response.status(400).json({ error: error.message || "Operation impossible." });
});

cleanupExpiredJobs();
setInterval(cleanupExpiredJobs, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Bureau Vallee Espace Services pret sur le port ${PORT}`);
});
