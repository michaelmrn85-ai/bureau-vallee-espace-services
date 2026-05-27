const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const qrcode = require("qrcode-generator");
const { PDFDocument } = require("pdf-lib");

const app = express();
const PORT = Number(process.env.PORT) || 3100;
const RENDER_BASE_URL = "https://bureau-vallee-espace-services.onrender.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || RENDER_BASE_URL).replace(/\/$/, "");
const PRINT_AGENT_TOKEN = process.env.PRINT_AGENT_TOKEN || "bureau-vallee-agent";
const DATA_DIR = path.join(__dirname, "data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const TMP_DIR = path.join(DATA_DIR, "tmp");
const NOTICE_FILE = path.join(DATA_DIR, "notice.json");
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const HISTORY_FILE = path.join(DATA_DIR, "job-history.json");
const COMMANDS_FILE = path.join(DATA_DIR, "station-commands.json");
const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 80 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg"]);
const stations = {
  "poste-1": "Poste 1",
  "poste-2": "Poste 2",
};
const defaultPrintSettings = {
  colorMode: "noir-blanc",
  duplex: "recto",
  paperSize: "A4",
  scaling: "ajuster",
  orientation: "auto",
  pageRange: "",
  pagesPerSheet: 1,
  copies: 1,
};

function isDirectPrintableExtension(extension) {
  return [".pdf", ".png", ".jpg", ".jpeg"].includes(String(extension || "").toLowerCase());
}

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
app.use((request, response, next) => {
  if (/\.(html|css|js)$/i.test(request.path) || ["/poste-1", "/poste-2", "/admin", "/upload"].includes(request.path)) {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
  next();
});
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

function readCommands() {
  if (!fs.existsSync(COMMANDS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(COMMANDS_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeCommands(commands) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cleanedCommands = commands.filter((command) => new Date(command.createdAt).getTime() >= cutoff);
  fs.writeFileSync(COMMANDS_FILE, JSON.stringify(cleanedCommands, null, 2));
}

function sanitizePrintSettings(input = {}) {
  const settings = {
    colorMode: input.colorMode === "couleur" ? "couleur" : "noir-blanc",
    duplex: ["recto", "recto-verso-long", "recto-verso-court"].includes(input.duplex) ? input.duplex : "recto",
    paperSize: "A4",
    scaling: input.scaling === "taille-reelle" ? "taille-reelle" : "ajuster",
    orientation: ["auto", "portrait", "paysage"].includes(input.orientation) ? input.orientation : "auto",
    pageRange: String(input.pageRange || "").replace(/[^\d,\-\s]/g, "").slice(0, 40).trim(),
    pagesPerSheet: Number.parseInt(input.pagesPerSheet, 10) || 1,
    copies: Number.parseInt(input.copies, 10) || 1,
  };
  settings.pagesPerSheet = [1, 2, 4].includes(settings.pagesPerSheet) ? settings.pagesPerSheet : 1;
  settings.copies = Math.min(99, Math.max(1, settings.copies));
  return settings;
}

function printSettingsLabel(settings = defaultPrintSettings) {
  const duplexLabels = {
    recto: "Recto",
    "recto-verso-long": "Recto-verso bord long",
    "recto-verso-court": "Recto-verso bord court",
  };
  const scalingLabels = {
    ajuster: "Ajuster",
    "taille-reelle": "Taille reelle",
  };
  const orientationLabels = {
    auto: "Auto",
    portrait: "Portrait",
    paysage: "Paysage",
  };
  const pageRange = settings.pageRange ? `Pages ${settings.pageRange}` : "Toutes les pages";
  const pagesPerSheet = Number(settings.pagesPerSheet || 1);
  const pagesPerSheetLabel = pagesPerSheet === 1 ? "1 page par feuille" : `${pagesPerSheet} pages par feuille`;
  return [
    settings.colorMode === "couleur" ? "Couleur" : "Noir et blanc",
    duplexLabels[settings.duplex] || duplexLabels.recto,
    settings.paperSize || "A4",
    scalingLabels[settings.scaling] || scalingLabels.ajuster,
    orientationLabels[settings.orientation] || orientationLabels.auto,
    pagesPerSheetLabel,
    pageRange,
    `${settings.copies || 1} exemplaire(s)`,
  ].join(" - ");
}

function findPrintRequest(job, requestId) {
  return (job.printRequests || []).find((request) => request.id === requestId);
}

function requirePrintAgent(request, response) {
  const token = request.get("x-print-agent-token") || request.query.token;
  if (token !== PRINT_AGENT_TOKEN) {
    response.status(401).json({ error: "Agent non autorise." });
    return false;
  }
  return true;
}

function archiveJob(job, reason) {
  if (!job) return;
  const history = readHistory().filter((item) => item.code !== job.code);
  history.unshift({
    ...publicJob(job, "termine"),
    deletedAt: new Date().toISOString(),
    deleteReason: reason,
    printRequests: job.printRequests || [],
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

async function estimatePdfPages(filePath) {
  const bytes = fs.readFileSync(filePath);
  try {
    return Math.max(1, (await PDFDocument.load(bytes)).getPageCount());
  } catch (error) {
    // Some PDFs are malformed but still printable; keep the older lightweight fallback.
  }
  try {
    const content = bytes.toString("latin1");
    const matches = content.match(/\/Type\s*\/Page\b/g);
    return Math.max(1, matches ? matches.length : 1);
  } catch (error) {
    return 1;
  }
}

async function estimatePages(filePath, extension) {
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

function selectedPageIndexes(totalPages, pageRange = "") {
  const total = Math.max(1, Number(totalPages) || 1);
  const indexes = [];
  const seen = new Set();
  const cleanedRange = String(pageRange || "").trim();
  if (!cleanedRange) return Array.from({ length: total }, (_, index) => index);

  for (const segment of cleanedRange.split(",")) {
    const value = segment.trim();
    if (!value) continue;
    const match = value.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) continue;
    const start = Math.min(total, Math.max(1, Number.parseInt(match[1], 10)));
    const end = Math.min(total, Math.max(start, Number.parseInt(match[2] || match[1], 10)));
    for (let page = start; page <= end; page += 1) {
      const index = page - 1;
      if (!seen.has(index)) {
        seen.add(index);
        indexes.push(index);
      }
    }
  }

  return indexes.length ? indexes : Array.from({ length: total }, (_, index) => index);
}

function requestPageCount(file, settings = {}) {
  const copies = Math.min(99, Math.max(1, Number.parseInt(settings.copies, 10) || 1));
  const pagesPerSheet = [1, 2, 4].includes(Number(settings.pagesPerSheet)) ? Number(settings.pagesPerSheet) : 1;
  const logicalPages = selectedPageIndexes(file?.pages || 1, settings.pageRange).length;
  return Math.ceil(logicalPages / pagesPerSheet) * copies;
}

function paperSizePoints(paperSize = "A4", orientation = "auto", pagesPerSheet = 1) {
  const sizes = {
    A5: [419.53, 595.28],
    A4: [595.28, 841.89],
    A3: [841.89, 1190.55],
  };
  const [shortSide, longSide] = sizes[paperSize] || sizes.A4;
  if (orientation === "portrait") return [shortSide, longSide];
  if (orientation === "paysage") return [longSide, shortSide];
  return pagesPerSheet > 1 ? [longSide, shortSide] : [shortSide, longSide];
}

function resolvedSheetOrientation(settings = {}, embeddedPages = []) {
  if (settings.orientation === "portrait" || settings.orientation === "paysage") return settings.orientation;
  if (Number(settings.pagesPerSheet || 1) > 1) return "paysage";
  const firstPage = embeddedPages[0];
  if (!firstPage) return "portrait";
  return firstPage.width > firstPage.height ? "paysage" : "portrait";
}

async function createImagePrintPdf(sourcePath, extension, targetPath) {
  const bytes = Uint8Array.from(fs.readFileSync(sourcePath));
  const outputPdf = await PDFDocument.create();
  const image = extension === ".png" ? await outputPdf.embedPng(bytes) : await outputPdf.embedJpg(bytes);
  const [pageWidth, pageHeight] = paperSizePoints("A4", "auto", 1);
  const page = outputPdf.addPage([pageWidth, pageHeight]);
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: margin + (maxWidth - width) / 2,
    y: margin + (maxHeight - height) / 2,
    width,
    height,
  });
  fs.writeFileSync(targetPath, await outputPdf.save());
}

async function createPreparedPdf(job, file, settings, requestId) {
  const pagesPerSheet = Number(settings.pagesPerSheet || 1);
  const shouldPreparePdf =
    [2, 4].includes(pagesPerSheet) ||
    ["A3", "A5"].includes(settings.paperSize) ||
    ["portrait", "paysage"].includes(settings.orientation);
  if (!shouldPreparePdf) return { storedName: file.printableStoredName || file.storedName, settings };

  const sourcePath = path.join(jobDir(job.code), file.printableStoredName || file.storedName);
  const sourcePdf = await PDFDocument.load(fs.readFileSync(sourcePath));
  const outputPdf = await PDFDocument.create();
  const selectedIndexes = selectedPageIndexes(sourcePdf.getPageCount(), settings.pageRange);
  const embeddedPages = await outputPdf.embedPdf(fs.readFileSync(sourcePath), selectedIndexes);
  const sheetOrientation = resolvedSheetOrientation(settings, embeddedPages);
  const [sheetWidth, sheetHeight] = paperSizePoints(settings.paperSize, sheetOrientation, pagesPerSheet);
  const columns = pagesPerSheet === 1 ? 1 : 2;
  const rows = pagesPerSheet === 4 ? 2 : 1;
  const margin = 18;
  const gutter = 10;
  const slotWidth = (sheetWidth - margin * 2 - gutter * (columns - 1)) / columns;
  const slotHeight = (sheetHeight - margin * 2 - gutter * (rows - 1)) / rows;

  for (let index = 0; index < embeddedPages.length; index += pagesPerSheet) {
    const page = outputPdf.addPage([sheetWidth, sheetHeight]);
    for (let offset = 0; offset < pagesPerSheet; offset += 1) {
      const embeddedPage = embeddedPages[index + offset];
      if (!embeddedPage) continue;
      const column = offset % columns;
      const row = Math.floor(offset / columns);
      const scale = Math.min(slotWidth / embeddedPage.width, slotHeight / embeddedPage.height);
      const width = embeddedPage.width * scale;
      const height = embeddedPage.height * scale;
      const x = margin + column * (slotWidth + gutter) + (slotWidth - width) / 2;
      const y = sheetHeight - margin - (row + 1) * slotHeight - row * gutter + (slotHeight - height) / 2;
      page.drawPage(embeddedPage, { x, y, width, height });
    }
  }

  const storedName = `${requestId}-prepared-${settings.paperSize}-${pagesPerSheet}up.pdf`;
  fs.writeFileSync(path.join(jobDir(job.code), storedName), await outputPdf.save());
  return {
    storedName,
    settings: {
      ...settings,
      pageRange: "",
      pagesPerSheet,
      orientation: sheetOrientation,
    },
  };
}

function sessionCounters(job, files) {
  const counts = { bwPages: 0, colorPages: 0, totalPages: 0 };
  const fileById = new Map(files.map((file) => [file.id, file]));
  const requests = (job.printRequests || []).filter((request) => request.status !== "failed");

  for (const request of requests) {
    const file = fileById.get(request.fileId);
    if (!file) continue;
    const settings = sanitizePrintSettings(request.settings || job.printSettings || {});
    const pages = requestPageCount(file, settings);
    if (settings.colorMode === "couleur") counts.colorPages += pages;
    else counts.bwPages += pages;
  }

  counts.totalPages = counts.bwPages + counts.colorPages;
  return counts;
}

function publicJob(job, status = "actif") {
  const station = stationFrom(job.station);
  const printSettings = sanitizePrintSettings(job.printSettings || { colorMode: job.printMode });
  const files = job.files.map((file) => ({
    id: file.id,
    originalName: file.originalName,
    extension: file.extension.replace(".", ""),
    size: file.size,
    pages: file.pages || 1,
    printable: isDirectPrintableExtension(file.extension),
    viewUrl: `/api/jobs/${job.code}/files/${file.id}`,
    downloadUrl: `/api/jobs/${job.code}/files/${file.id}?download=1`,
  }));
  const counters = sessionCounters(job, files);
  const depositPages = files.reduce((sum, file) => sum + file.pages, 0);
  const printMode = printSettings.colorMode;
  return {
    code: job.code,
    customerName: job.customerName,
    station,
    stationLabel: stations[station],
    printMode,
    printSettings,
    printSettingsLabel: printSettingsLabel(printSettings),
    totalPages: counters.totalPages,
    bwPages: counters.bwPages,
    colorPages: counters.colorPages,
    depositPages,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    status,
    downloadAllUrl: files.length ? `/api/jobs/${job.code}/download-all` : "",
    printRequests: job.printRequests || [],
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

app.post("/api/jobs", upload.array("files", 10), async (request, response, next) => {
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
    const printSettings = sanitizePrintSettings({ colorMode: printMode });
    const files = await Promise.all(request.files.map(async (file, index) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const id = `${Date.now()}-${index}`;
      const storedName = `${id}${extension}`;
      const storedPath = path.join(directory, storedName);
      fs.renameSync(file.path, storedPath);
      const printableStoredName = [".png", ".jpg", ".jpeg"].includes(extension) ? `${id}-print.pdf` : "";
      if (printableStoredName) {
        await createImagePrintPdf(storedPath, extension, path.join(directory, printableStoredName));
      }
      return {
        id,
        originalName: file.originalname,
        storedName,
        printableStoredName,
        extension,
        size: file.size,
        pages: await estimatePages(storedPath, extension),
      };
    }));

    const job = {
      code,
      customerName: String(request.body.customerName || "").trim(),
      station: stationFrom(request.body.station),
      printMode,
      printSettings,
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

app.post("/api/jobs/:code/settings", (request, response) => {
  const job = readJob(request.params.code);
  if (!job) {
    response.status(404).json({ error: "Code introuvable." });
    return;
  }
  job.printSettings = sanitizePrintSettings(request.body);
  job.printMode = job.printSettings.colorMode;
  writeJob(job);
  response.json(publicJob(job));
});

app.post("/api/jobs/:code/print", async (request, response, next) => {
  try {
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

    const file = job.files.find((item) => item.id === request.body.fileId);
    if (!file) {
      response.status(404).json({ error: "Fichier introuvable." });
      return;
    }
    if (!isDirectPrintableExtension(file.extension)) {
      response.status(400).json({ error: "Ce format doit etre traite au comptoir." });
      return;
    }

    const printSettings = sanitizePrintSettings(request.body.settings || job.printSettings || {});
    job.printSettings = printSettings;
    job.printMode = printSettings.colorMode;
    job.printRequests = job.printRequests || [];
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const printFile = await createPreparedPdf(job, file, printSettings, requestId);
    const printRequest = {
      id: requestId,
      fileId: file.id,
      fileName: file.originalName,
      printFileName: file.extension === ".pdf" ? file.originalName : `${path.parse(file.originalName).name}.pdf`,
      printStoredName: printFile.storedName,
      station: stationFrom(job.station),
      status: "queued",
      settings: printFile.settings,
      originalSettings: printSettings,
      settingsLabel: printSettingsLabel(printSettings),
      createdAt: new Date().toISOString(),
    };
    job.printRequests.push(printRequest);
    writeJob(job);
    response.status(201).json({ printRequest, job: publicJob(job) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/print-agent/next", (request, response) => {
  if (!requirePrintAgent(request, response)) return;
  const station = stationFrom(request.query.station);
  const jobs = listActiveJobs();
  for (const job of jobs) {
    if (stationFrom(job.station) !== station) continue;
    const printRequest = (job.printRequests || []).find((item) => item.status === "queued");
    if (!printRequest) continue;
    const file = job.files.find((item) => item.id === printRequest.fileId && isDirectPrintableExtension(item.extension));
    if (!file) continue;

    printRequest.status = "printing";
    printRequest.claimedAt = new Date().toISOString();
    writeJob(job);
    response.json({
      requestId: printRequest.id,
      code: job.code,
      station,
      fileId: file.id,
      fileName: file.originalName,
      printFileName: printRequest.printFileName || file.originalName,
      fileUrl: `${PUBLIC_BASE_URL}/api/jobs/${job.code}/print-files/${printRequest.id}`,
      settings: printRequest.settings || sanitizePrintSettings(job.printSettings),
      settingsLabel: printRequest.settingsLabel || printSettingsLabel(job.printSettings),
    });
    return;
  }
  response.json({ request: null });
});

app.post("/api/stations/:station/eject", (request, response) => {
  const station = stationFrom(request.params.station);
  const commands = readCommands();
  const command = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    station,
    type: "eject-usb",
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  commands.push(command);
  writeCommands(commands);
  response.status(201).json({ ok: true, command });
});

app.get("/api/print-agent/commands/next", (request, response) => {
  if (!requirePrintAgent(request, response)) return;
  const station = stationFrom(request.query.station);
  const commands = readCommands();
  const command = commands.find((item) => item.station === station && item.status === "queued");
  if (!command) {
    response.json({ command: null });
    return;
  }

  command.status = "claimed";
  command.claimedAt = new Date().toISOString();
  writeCommands(commands);
  response.json({ command });
});

app.post("/api/print-agent/commands/:commandId/status", (request, response) => {
  if (!requirePrintAgent(request, response)) return;
  const commands = readCommands();
  const command = commands.find((item) => item.id === request.params.commandId);
  if (!command) {
    response.status(404).json({ error: "Commande introuvable." });
    return;
  }

  command.status = ["done", "failed"].includes(request.body.status) ? request.body.status : "failed";
  command.error = String(request.body.error || "").slice(0, 500);
  command.updatedAt = new Date().toISOString();
  writeCommands(commands);
  response.json({ ok: true, command });
});

app.post("/api/print-agent/requests/:requestId/status", (request, response) => {
  if (!requirePrintAgent(request, response)) return;
  const station = stationFrom(request.body.station);
  const status = ["done", "failed", "queued"].includes(request.body.status) ? request.body.status : "failed";
  for (const job of listActiveJobs()) {
    if (stationFrom(job.station) !== station) continue;
    const printRequest = findPrintRequest(job, request.params.requestId);
    if (!printRequest) continue;
    printRequest.status = status;
    printRequest.updatedAt = new Date().toISOString();
    printRequest.error = String(request.body.error || "").slice(0, 500);
    writeJob(job);
    response.json({ ok: true, printRequest });
    return;
  }
  response.status(404).json({ error: "Demande introuvable." });
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

app.get("/api/jobs/:code/print-files/:requestId", (request, response) => {
  const job = readJob(request.params.code);
  if (!job) {
    response.status(404).send("Code introuvable.");
    return;
  }

  const printRequest = findPrintRequest(job, request.params.requestId);
  if (!printRequest) {
    response.status(404).send("Demande introuvable.");
    return;
  }

  const sourceFile = job.files.find((file) => file.id === printRequest.fileId);
  const storedName = printRequest.printStoredName || sourceFile?.storedName;
  if (!storedName) {
    response.status(404).send("Fichier introuvable.");
    return;
  }

  response.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(printRequest.printFileName || printRequest.fileName || "document.pdf")}"`);
  response.sendFile(path.join(jobDir(job.code), storedName));
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
