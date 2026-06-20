const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const multer = require("multer");
const qrcode = require("qrcode-generator");
const { PDFDocument, degrees } = require("pdf-lib");

const app = express();
const PORT = Number(process.env.PORT) || 3100;
const RENDER_BASE_URL = "https://bureau-vallee-espace-services.onrender.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || RENDER_BASE_URL).replace(/\/$/, "");
const HAS_PUBLIC_BASE_URL = Boolean(process.env.PUBLIC_BASE_URL);
const PRINT_AGENT_TOKEN = process.env.PRINT_AGENT_TOKEN || "bureau-vallee-agent";
const DATA_DIR = path.join(__dirname, "data");
const JOBS_DIR = path.join(DATA_DIR, "jobs");
const TMP_DIR = path.join(DATA_DIR, "tmp");
const NOTICE_FILE = path.join(DATA_DIR, "notice.json");
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const HISTORY_FILE = path.join(DATA_DIR, "job-history.json");
const COMMANDS_FILE = path.join(DATA_DIR, "station-commands.json");
const MAIL_ADDRESS = process.env.MAIL_ADDRESS || "es.bvm@outlook.fr";
const MAIL_POLLING_ENABLED = process.env.MAIL_POLLING_ENABLED === "1";
const MAIL_POLL_INTERVAL_MS = Math.max(15000, Number(process.env.MAIL_POLL_INTERVAL_MS) || 30000);
const MAIL_IMAP_HOST = process.env.MAIL_IMAP_HOST || "outlook.office365.com";
const MAIL_IMAP_PORT = Number(process.env.MAIL_IMAP_PORT) || 993;
const MAIL_SMTP_HOST = process.env.MAIL_SMTP_HOST || "smtp-mail.outlook.com";
const MAIL_SMTP_PORT = Number(process.env.MAIL_SMTP_PORT) || 587;
const mailRuntimeStatus = {
  enabled: MAIL_POLLING_ENABLED,
  address: MAIL_ADDRESS,
  configured: Boolean(process.env.MAIL_PASSWORD),
  lastCheckAt: "",
  lastSuccessAt: "",
  lastError: "",
  lastReplyError: "",
  lastCode: "",
  mailboxExists: 0,
  lastFetchedAt: "",
  lastAttachmentCount: 0,
  lastIgnoredReason: "",
  processedCount: 0,
};
const HELP_FILE = path.join(DATA_DIR, "help-requests.json");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const MAIL_PROCESSED_FILE = path.join(DATA_DIR, "mail-processed.json");
const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE_MB = 500;
const MAX_UPLOAD_FILES = 60;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_PDF_PAGES = 500;
const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".heic", ".heif", ".webp"]);
const counterOnlyExtensions = new Set([".doc", ".docx"]);
const mimeExtensions = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};
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
const DEFAULT_SESSION_MESSAGE = "Mise a jour ou grande serie d'impressions en cours.";
const ALLOWED_WEBMAIL_URLS = new Set([
  "https://mail.google.com/",
  "https://outlook.live.com/mail/",
  "https://mail.orange.fr/",
  "https://mail.yahoo.com/",
  "https://www.laposte.net/accueil",
  "https://zimbra.free.fr/",
]);

function isDirectPrintableExtension(extension) {
  return [".pdf", ".png", ".jpg", ".jpeg"].includes(String(extension || "").toLowerCase());
}

function extensionFromUpload(file) {
  const namedExtension = path.extname(file.originalname || "").toLowerCase();
  if (namedExtension) return namedExtension;
  return mimeExtensions[String(file.mimetype || "").toLowerCase()] || "";
}

function isAllowedUploadFile(file) {
  const extension = extensionFromUpload(file);
  return allowedExtensions.has(extension) || counterOnlyExtensions.has(extension);
}

function hasCounterOnlyFiles(files = []) {
  return files.some((file) => counterOnlyExtensions.has(extensionFromUpload(file)));
}

function cleanupTempUploads(files = []) {
  for (const file of files) {
    try {
      if (file.path && fs.existsSync(file.path)) fs.rmSync(file.path, { force: true });
    } catch (error) {}
  }
}

fs.mkdirSync(JOBS_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_UPLOAD_FILES },
  fileFilter(request, file, callback) {
    const extension = extensionFromUpload(file);
    if (!isAllowedUploadFile(file)) {
      callback(new Error("Format non accepte. PDF, PNG, JPEG, HEIC, WebP, DOC ou DOCX uniquement."));
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

function readHelpRequests() {
  if (!fs.existsSync(HELP_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HELP_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeHelpRequests(requests) {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const cleanedRequests = requests.filter((request) => {
    if (!request.active) return false;
    return new Date(request.createdAt).getTime() >= cutoff;
  });
  fs.writeFileSync(HELP_FILE, JSON.stringify(cleanedRequests, null, 2));
}

function readProcessedMailIds() {
  if (!fs.existsSync(MAIL_PROCESSED_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(MAIL_PROCESSED_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeProcessedMailIds(ids) {
  fs.writeFileSync(MAIL_PROCESSED_FILE, JSON.stringify(ids.slice(-500), null, 2));
}

function mailMessageKey(message) {
  return String(message.uid || message.emailId || message.id || "");
}


function readClients() {
  if (!fs.existsSync(CLIENTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CLIENTS_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeClients(clients) {
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2));
}

function sanitizeClientId(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "";
}

function generateClientId(clients) {
  const used = new Set(clients.map((client) => client.id));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const id = String(Math.floor(10000 + Math.random() * 90000));
    if (!used.has(id)) return id;
  }
  throw new Error("Impossible de creer un identifiant client disponible.");
}

function normalizeClientName(value) {
  return sanitizeCustomerName(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findExistingClient(clients, { clientId, customerName }) {
  if (clientId) {
    const byId = clients.find((client) => client.id === clientId);
    if (byId) return byId;
  }
  const normalizedName = normalizeClientName(customerName);
  if (!normalizedName) return null;
  return clients.find((client) => normalizeClientName(client.customerName) === normalizedName) || null;
}

function sanitizePrintSettings(input = {}) {
  const settings = {
    colorMode: input.colorMode === "couleur" ? "couleur" : "noir-blanc",
    duplex: ["recto", "recto-verso-long", "recto-verso-court"].includes(input.duplex) ? input.duplex : "recto",
    paperSize: ["A3", "A4"].includes(input.paperSize) ? input.paperSize : "A4",
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

function sanitizeCustomerName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
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
    return Math.min(MAX_PDF_PAGES, Math.max(1, (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount()));
  } catch (error) {
    // Some PDFs are malformed but still printable; keep the older lightweight fallback.
  }
  try {
    const content = bytes.toString("latin1");
    const matches = content.match(/\/Type\s*\/Page\b/g);
    return Math.min(MAX_PDF_PAGES, Math.max(1, matches ? matches.length : 1));
  } catch (error) {
    return 1;
  }
}

async function estimatePages(filePath, extension) {
  if (extension === ".pdf") return estimatePdfPages(filePath);
  return 1;
}

async function storeUploadedFiles(files, directory, offset = 0) {
  return Promise.all(files.map(async (file, index) => {
    const extension = extensionFromUpload(file);
    const id = `${Date.now()}-${offset + index}`;
    const storedName = `${id}${extension}`;
    const storedPath = path.join(directory, storedName);
    fs.renameSync(file.path, storedPath);
    const printableStoredName = [".png", ".jpg", ".jpeg"].includes(extension) ? `${id}-print.pdf` : "";
    if (printableStoredName) {
      await createImagePrintPdf(storedPath, extension, path.join(directory, printableStoredName));
    }
    return {
      id,
      originalName: path.extname(file.originalname || "") ? file.originalname : `${file.originalname || "photo"}${extension}`,
      storedName,
      printableStoredName,
      extension,
      size: file.size,
      pages: await estimatePages(storedPath, extension),
    };
  }));
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
  const recentHistory = readHistory().filter((job) => !activeCodes.has(job.code));
  return [...activeJobs, ...recentHistory]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function emptyPrintTotals() {
  return { bwPages: 0, colorPages: 0, totalPages: 0, jobs: 0, requests: 0, pending: 0, printing: 0, failed: 0 };
}

function addPrintTotals(target, source) {
  target.bwPages += source.bwPages || 0;
  target.colorPages += source.colorPages || 0;
  target.totalPages += source.totalPages || 0;
  target.jobs += source.jobs || 0;
  target.requests += source.requests || 0;
  target.pending += source.pending || 0;
  target.printing += source.printing || 0;
  target.failed += source.failed || 0;
}

function completedPrintDashboard() {
  const jobs = listTrackedJobs();
  const totals = emptyPrintTotals();
  const stationsSummary = {
    "poste-1": emptyPrintTotals(),
    "poste-2": emptyPrintTotals(),
  };
  const rows = [];

  for (const job of jobs) {
    const station = stationFrom(job.station);
    const stationTotals = stationsSummary[station] || emptyPrintTotals();
    const fileById = new Map((job.files || []).map((file) => [file.id, file]));
    const row = {
      code: job.code,
      customerName: job.customerName || "Client",
      station,
      stationLabel: stations[station],
      createdAt: job.createdAt,
      bwPages: 0,
      colorPages: 0,
      totalPages: 0,
      doneRequests: 0,
      pendingRequests: 0,
      printingRequests: 0,
      failedRequests: 0,
    };

    for (const printRequest of job.printRequests || []) {
      const status = printRequest.status || "queued";
      if (status === "queued") {
        totals.pending += 1;
        stationTotals.pending += 1;
        row.pendingRequests += 1;
        continue;
      }
      if (status === "printing") {
        totals.printing += 1;
        stationTotals.printing += 1;
        row.printingRequests += 1;
        continue;
      }
      if (status === "failed") {
        totals.failed += 1;
        stationTotals.failed += 1;
        row.failedRequests += 1;
        continue;
      }
      if (status !== "done") continue;

      const file = fileById.get(printRequest.fileId);
      if (!file) continue;
      const settings = sanitizePrintSettings(printRequest.originalSettings || printRequest.settings || job.printSettings || {});
      const pages = requestPageCount(file, settings);
      if (settings.colorMode === "couleur") {
        row.colorPages += pages;
      } else {
        row.bwPages += pages;
      }
      row.totalPages += pages;
      row.doneRequests += 1;
    }

    if (row.doneRequests > 0) {
      totals.bwPages += row.bwPages;
      totals.colorPages += row.colorPages;
      totals.totalPages += row.totalPages;
      totals.requests += row.doneRequests;
      totals.jobs += 1;
      stationTotals.bwPages += row.bwPages;
      stationTotals.colorPages += row.colorPages;
      stationTotals.totalPages += row.totalPages;
      stationTotals.requests += row.doneRequests;
      stationTotals.jobs += 1;
      rows.push(row);
    } else if (row.pendingRequests || row.printingRequests || row.failedRequests) {
      rows.push(row);
    }

    stationsSummary[station] = stationTotals;
  }

  return {
    generatedAt: new Date().toISOString(),
    totals,
    stations: Object.entries(stationsSummary).map(([station, values]) => ({
      station,
      stationLabel: stations[station],
      ...values,
    })),
    rows: rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20),
  };
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
  const pageRange = String(settings.pageRange || "").trim();
  const shouldPreparePdf =
    [2, 4].includes(pagesPerSheet) ||
    ["A3", "A5"].includes(settings.paperSize) ||
    ["portrait", "paysage"].includes(settings.orientation) ||
    Boolean(pageRange);
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
      const forcedOrientation = settings.orientation === "portrait" || settings.orientation === "paysage";
      const sheetIsLandscape = sheetWidth > sheetHeight;
      const sourceIsLandscape = embeddedPage.width > embeddedPage.height;
      const rotateToFit = pagesPerSheet === 1 && forcedOrientation && sheetIsLandscape !== sourceIsLandscape;
      const sourceWidth = rotateToFit ? embeddedPage.height : embeddedPage.width;
      const sourceHeight = rotateToFit ? embeddedPage.width : embeddedPage.height;
      const scale = Math.min(slotWidth / sourceWidth, slotHeight / sourceHeight);
      const width = embeddedPage.width * scale;
      const height = embeddedPage.height * scale;
      const effectiveWidth = rotateToFit ? height : width;
      const effectiveHeight = rotateToFit ? width : height;
      const x = margin + column * (slotWidth + gutter) + (slotWidth - effectiveWidth) / 2;
      const y = sheetHeight - margin - (row + 1) * slotHeight - row * gutter + (slotHeight - effectiveHeight) / 2;
      if (rotateToFit) page.drawPage(embeddedPage, { x: x + height, y, width, height, rotate: degrees(90) });
      else page.drawPage(embeddedPage, { x, y, width, height });
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


function senderAddress(parsedMail) {
  return parsedMail.from?.value?.[0]?.address || "";
}

function senderDisplayName(parsedMail) {
  return sanitizeCustomerName(parsedMail.from?.value?.[0]?.name || senderAddress(parsedMail) || "Client mail");
}

function mailSubject(value) {
  return String(value || "Vos fichiers Espace Services").replace(/[\r\n]/g, " ").slice(0, 120);
}

function mailTextForCode(job) {
  return [
    "Bonjour,",
    "",
    "Vos fichiers ont bien ete recus par l'Espace Services Bureau Vallee.",
    "",
    "Votre code dossier est : " + job.code,
    "",
    "Saisissez ce code sur le Poste Espace Services pour verifier vos documents et lancer l'impression.",
    "Le code fonctionne sur le Poste 1 et le Poste 2.",
    "",
    "Rappel : les gros fichiers peuvent prendre plus de temps. Les fichiers Word/DOC/DOCX ne sont pas acceptes sur les postes.",
  ].join("\n");
}

function mailTextForReject(reason) {
  return [
    "Bonjour,",
    "",
    "Votre envoi n'a pas pu etre prepare automatiquement.",
    "",
    reason,
    "",
    "Formats acceptes : PDF, PNG, JPEG, HEIC, WebP ou export Canva en PDF/PNG/JPEG.",
    "Si votre envoi est trop lourd, utilisez une cle USB ou rapprochez-vous d'un vendeur ou d'une vendeuse.",
  ].join("\n");
}

async function sendMailReply(nodemailer, to, subject, text) {
  if (!to) throw new Error("Adresse expediteur introuvable.");
  const accountId = await zohoGetAccountId();
  console.log('[mail] Envoi reponse a ' + to);
  const result = await zohoFetch(`/accounts/${accountId}/messages`, {
    method: 'POST',
    body: {
      fromAddress: MAIL_ADDRESS,
      toAddress: to,
      subject,
      content: text,
      mailFormat: 'plaintext',
    },
  });
  console.log('[mail] Resultat envoi: ' + JSON.stringify(result).slice(0, 200));
  if (result.status?.code !== 200 && result.status?.code !== 201) {
    throw new Error('Zoho send error: ' + JSON.stringify(result).slice(0, 200));
  }
}

async function createMailJob(parsedMail) {
  const attachments = (parsedMail.attachments || []).filter((attachment) => attachment.content?.length);
  mailRuntimeStatus.lastAttachmentCount = attachments.length;
  if (!attachments.length) {
    return { error: "Aucune piece jointe n'a ete trouvee dans votre mail." };
  }
  const totalAttachmentSize = attachments.reduce((total, attachment) => total + (attachment.size || attachment.content.length || 0), 0);
  if (totalAttachmentSize > MAX_FILE_SIZE) {
    return { error: "Votre mail est trop lourd. Limite conseillee : " + MAX_FILE_SIZE_MB + " Mo par envoi. Pour un gros dossier, utilisez une cle USB." };
  }

  const now = new Date();
  const code = reserveCode();
  const directory = jobDir(code);
  const mailFiles = [];

  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index];
    const originalname = attachment.filename || "piece-jointe-" + (index + 1);
    const tmpPath = path.join(TMP_DIR, "mail-" + Date.now() + "-" + index + (path.extname(originalname) || ""));
    const uploadLikeFile = {
      path: tmpPath,
      originalname,
      mimetype: attachment.contentType || "",
      size: attachment.size || attachment.content.length,
    };
    if (!isAllowedUploadFile(uploadLikeFile)) {
      return { error: "Le fichier \"" + originalname + "\" n'est pas dans un format accepte." };
    }
    fs.writeFileSync(tmpPath, attachment.content);
    mailFiles.push(uploadLikeFile);
  }

  const files = await storeUploadedFiles(mailFiles, directory);
  const printSettings = sanitizePrintSettings({ colorMode: "noir-blanc" });
  const job = {
    code,
    customerName: senderDisplayName(parsedMail),
    clientId: "",
    civility: "",
    printCard: false,
    source: "mail",
    station: "poste-1",
    adminUpload: false,
    printMode: "noir-blanc",
    printSettings,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + JOB_TTL_MS).toISOString(),
    files,
  };
  writeJob(job);
  return { job };
}

async function processIncomingMail(message, tools) {
  const parsedMail = await tools.simpleParser(message.source);
  const to = senderAddress(parsedMail);
  mailRuntimeStatus.lastFetchedAt = new Date().toISOString();
  mailRuntimeStatus.lastIgnoredReason = "";
  mailRuntimeStatus.lastReplyError = "";
  const result = await createMailJob(parsedMail);
  if (result.error) {
    try {
      await sendMailReply(tools.nodemailer, to, "Espace Services - envoi impossible", mailTextForReject(result.error));
    } catch (error) {
      mailRuntimeStatus.lastReplyError = error.message;
    }
    mailRuntimeStatus.lastIgnoredReason = result.error.includes("piece jointe") ? "no_attachment" : "invalid_attachment";
    console.log("[mail] Envoi refuse " + (to || "sans expediteur") + " - " + result.error);
    return;
  }

  mailRuntimeStatus.lastCode = result.job.code;
  mailRuntimeStatus.lastSuccessAt = new Date().toISOString();
  mailRuntimeStatus.processedCount += 1;
  try {
    await sendMailReply(tools.nodemailer, to, "Espace Services - code dossier " + result.job.code, mailTextForCode(result.job));
  } catch (error) {
    mailRuntimeStatus.lastReplyError = error.message;
    console.log("[mail] Code cree mais reponse impossible: " + error.message);
  }
  console.log("[mail] Code " + result.job.code + " cree pour " + (to || "sans expediteur"));
}

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || "";
const ZOHO_API_BASE = "https://mail.zoho.eu/api";
const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.eu/oauth/v2/token";

let zohoAccessToken = "";
let zohoAccessTokenExpiry = 0;
let zohoAccountId = "";

async function zohoRefreshAccessToken() {
  const https = require("https");
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const url = new URL(ZOHO_ACCOUNTS_URL);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: url.hostname, path: url.pathname, method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            zohoAccessToken = json.access_token;
            zohoAccessTokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
            resolve(json.access_token);
          } else {
            reject(new Error("Zoho token error: " + JSON.stringify(json)));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.write(params.toString());
    req.end();
  });
}

async function zohoGetToken() {
  if (!zohoAccessToken || Date.now() >= zohoAccessTokenExpiry) {
    await zohoRefreshAccessToken();
  }
  return zohoAccessToken;
}

async function zohoFetch(path, options = {}) {
  const https = require("https");
  const token = await zohoGetToken();
  const url = new URL(ZOHO_API_BASE + path);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + (url.search || ""),
      method: options.method || "GET",
      headers: { "Authorization": "Zoho-oauthtoken " + token, "Content-Type": "application/json", ...(options.headers || {}) },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (error) { resolve({ raw: data }); }
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function zohoGetAccountId() {
  if (zohoAccountId) return zohoAccountId;
  const result = await zohoFetch("/accounts");
  console.log("[mail] Zoho accounts: " + JSON.stringify(result).slice(0, 500));
  const accounts = result.data || result.accounts || [];
  const account = accounts.find((a) =>
    (a.primaryEmailAddress || a.mailAddress || a.emailAddress || "").toLowerCase() === MAIL_ADDRESS.toLowerCase()
  ) || accounts[0];
  if (!account) throw new Error("Compte Zoho introuvable - reponse: " + JSON.stringify(result).slice(0, 300));
  zohoAccountId = String(account.accountId || account.id || account.zuid || "");
  console.log("[mail] Zoho accountId: " + zohoAccountId);
  return zohoAccountId;
}

function startMailWatcher() {
  mailRuntimeStatus.enabled = MAIL_POLLING_ENABLED;
  mailRuntimeStatus.configured = Boolean(ZOHO_REFRESH_TOKEN);
  if (!MAIL_POLLING_ENABLED) {
    console.log("[mail] Lecture mail desactivee. Definir MAIL_POLLING_ENABLED=1 pour l'activer.");
    return;
  }
  if (!ZOHO_REFRESH_TOKEN) {
    console.log("[mail] ZOHO_REFRESH_TOKEN manquant. Lecture mail non demarree.");
    return;
  }

  let isPolling = false;

  async function pollMailbox() {
    if (isPolling) return;
    isPolling = true;
    mailRuntimeStatus.lastCheckAt = new Date().toISOString();
    mailRuntimeStatus.lastError = "";
    try {
      const nodemailer = require("nodemailer");
      const { simpleParser } = require("mailparser");
      const accountId = await zohoGetAccountId();

      // Récupérer les mails non lus
      const result = await zohoFetch(`/accounts/${accountId}/messages/view?limit=20&start=0`);
      console.log('[mail] Zoho inbox result: ' + JSON.stringify(result).slice(0, 600));
      const allMessages = Array.isArray(result.data) ? result.data : [];
      const messages = allMessages.filter((m) => String(m.status) === '0');
      mailRuntimeStatus.mailboxExists = allMessages.length;
      console.log('[mail] Mails en boite: ' + allMessages.length + ', non lus: ' + messages.length);

      const processedIds = readProcessedMailIds();
      const processedSet = new Set(processedIds);
      let changed = false;

      for (const msg of messages) {
        const mid = String(msg.messageId || msg.mid || '');
        if (!mid || processedSet.has(mid)) continue;

        try {
          const fromAddress = String(msg.fromAddress || msg.sender || '');
          const folderId = String(msg.folderId || '');
          console.log('[mail] Traitement ' + mid + ' de ' + fromAddress + ' folderId:' + folderId);

          // Récupérer les pièces jointes (inclure inline aussi car Gmail envoie souvent en inline)
          const attResult = await zohoFetch(`/accounts/${accountId}/folders/${folderId}/messages/${mid}/attachmentinfo?includeInline=true`);
          console.log('[mail] attachments: ' + JSON.stringify(attResult).slice(0, 500));
          const attData = attResult.data || {};
          const attachments = [...(Array.isArray(attData.attachments) ? attData.attachments : []), ...(Array.isArray(attData.inline) ? attData.inline : [])];

          if (!attachments.length) {
            console.log('[mail] Pas de PJ pour ' + mid);
            try {
              await sendMailReply(nodemailer, fromAddress, 'Espace Services - envoi impossible', mailTextForReject('Aucune piece jointe trouvee dans votre mail.'));
            } catch (e) { mailRuntimeStatus.lastReplyError = e.message; }
            mailRuntimeStatus.lastIgnoredReason = 'no_attachment';
          } else {
            const totalAttachmentSize = attachments.reduce((total, att) => total + Number(att.size || att.attachmentSize || 0), 0);
            if (totalAttachmentSize > MAX_FILE_SIZE) {
              try {
                await sendMailReply(nodemailer, fromAddress, 'Espace Services - envoi impossible', mailTextForReject('Votre mail est trop lourd. Limite conseillee : ' + MAX_FILE_SIZE_MB + ' Mo par envoi. Pour un gros dossier, utilisez une cle USB.'));
              } catch (e) { mailRuntimeStatus.lastReplyError = e.message; }
              mailRuntimeStatus.lastIgnoredReason = 'oversized_attachment';
              try { await zohoFetch(`/accounts/${accountId}/updatemessage`, { method: 'PUT', body: { mode: 'markAsRead', messageId: [mid] } }); } catch (e) {}
              processedSet.add(mid);
              processedIds.push(mid);
              changed = true;
              continue;
            }
            // Télécharger chaque pièce jointe
            const https = require('https');
            const token = await zohoGetToken();
            const mailFiles = [];
            let downloadedSize = 0;
            let rejected = false;

            for (const att of attachments) {
              const attId = String(att.attachmentId || att.id || '');
              const originalname = att.attachmentName || att.name || 'piece-jointe';
              const ext = path.extname(originalname).toLowerCase();
              if (!allowedExtensions.has(ext)) {
                rejected = true;
                try {
                  await sendMailReply(nodemailer, fromAddress, 'Espace Services - envoi impossible', mailTextForReject('Le fichier "' + originalname + '" nest pas dans un format accepte.'));
                } catch (e) { mailRuntimeStatus.lastReplyError = e.message; }
                mailRuntimeStatus.lastIgnoredReason = 'invalid_attachment';
                break;
              }

              // Télécharger le fichier
              const dlUrl = new URL(`https://mail.zoho.eu/api/accounts/${accountId}/folders/${folderId}/messages/${mid}/attachments/${attId}`);
              const fileBuffer = await new Promise((resolve, reject) => {
                const req = https.request({ hostname: dlUrl.hostname, path: dlUrl.pathname + dlUrl.search, headers: { 'Authorization': 'Zoho-oauthtoken ' + token } }, (res) => {
                  const chunks = [];
                  res.on('data', (c) => chunks.push(c));
                  res.on('end', () => resolve(Buffer.concat(chunks)));
                });
                req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout telechargement PJ')); });
                req.on('error', reject);
                req.end();
              });
              console.log('[mail] PJ telechargee: ' + originalname + ' ' + fileBuffer.length + ' octets');
              downloadedSize += fileBuffer.length;
              if (downloadedSize > MAX_FILE_SIZE) {
                rejected = true;
                try {
                  await sendMailReply(nodemailer, fromAddress, 'Espace Services - envoi impossible', mailTextForReject('Votre mail est trop lourd. Limite conseillee : ' + MAX_FILE_SIZE_MB + ' Mo par envoi. Pour un gros dossier, utilisez une cle USB.'));
                } catch (e) { mailRuntimeStatus.lastReplyError = e.message; }
                mailRuntimeStatus.lastIgnoredReason = 'oversized_attachment';
                break;
              }

              const tmpPath = path.join(TMP_DIR, 'mail-' + Date.now() + '-' + attId + ext);
              fs.writeFileSync(tmpPath, fileBuffer);
              mailFiles.push({ path: tmpPath, originalname, mimetype: att.contentType || '', size: fileBuffer.length });
            }

            if (rejected) {
              for (const file of mailFiles) {
                try { if (file.path && fs.existsSync(file.path)) fs.rmSync(file.path, { force: true }); } catch (e) {}
              }
            }

            if (!rejected && mailFiles.length) {
              const now = new Date();
              const code = reserveCode();
              const directory = jobDir(code);
              const files = await storeUploadedFiles(mailFiles, directory);
              const printSettings = sanitizePrintSettings({ colorMode: 'noir-blanc' });
              const job = {
                code,
                customerName: sanitizeCustomerName(fromAddress || 'Client mail'),
                clientId: '',
                civility: '',
                printCard: false,
                source: 'mail',
                station: 'poste-1',
                adminUpload: false,
                printMode: 'noir-blanc',
                printSettings,
                createdAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + JOB_TTL_MS).toISOString(),
                files,
              };
              writeJob(job);
              mailRuntimeStatus.lastCode = code;
              mailRuntimeStatus.lastSuccessAt = new Date().toISOString();
              mailRuntimeStatus.processedCount += 1;
              try {
                await sendMailReply(nodemailer, fromAddress, 'Espace Services - code dossier ' + code, mailTextForCode(job));
              } catch (e) {
                mailRuntimeStatus.lastReplyError = e.message;
                console.log('[mail] Code cree mais reponse impossible: ' + e.message);
              }
              console.log('[mail] Code ' + code + ' cree pour ' + (fromAddress || 'sans expediteur'));
            }
          }
        } catch (msgError) {
          console.log('[mail] Erreur traitement message ' + mid + ': ' + msgError.message);
        }

        // Marquer comme lu
        await zohoFetch(`/accounts/${accountId}/updatemessage`, {
          method: 'PUT',
          body: { mode: 'markAsRead', messageId: [mid] },
        });

        processedIds.push(mid);
        processedSet.add(mid);
        changed = true;
      }
      if (changed) writeProcessedMailIds(processedIds);
    } catch (error) {
      mailRuntimeStatus.lastError = String(error.message || error);
      console.log("[mail] Erreur lecture Zoho: " + mailRuntimeStatus.lastError);
    } finally {
      isPolling = false;
    }
  }

  pollMailbox();
  setInterval(pollMailbox, MAIL_POLL_INTERVAL_MS);
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
    clientId: job.clientId || "",
    civility: job.civility || "",
    printCard: Boolean(job.printCard),
    source: job.source || "",
    adminUpload: Boolean(job.adminUpload),
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

function firstLanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return "";
}

function requestBaseUrl(request) {
  const host = String(request.get("host") || "").toLowerCase();
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (HAS_PUBLIC_BASE_URL && (!isLocalHost || !PUBLIC_BASE_URL.includes("onrender.com"))) return PUBLIC_BASE_URL;
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    const protocol = request.get("x-forwarded-proto") || request.protocol || "http";
    return `${protocol}://${request.get("host")}`.replace(/\/$/, "");
  }
  const lanAddress = firstLanAddress();
  return lanAddress ? `http://${lanAddress}:${PORT}` : `http://localhost:${PORT}`;
}

function uploadUrl(station = "poste-1", mode = "", extras = {}, baseUrl = PUBLIC_BASE_URL) {
  const params = new URLSearchParams();
  if (mode === "admin") {
    params.set("mode", "admin");
  } else {
    params.set("station", stationFrom(station));
  }
  const customerName = sanitizeCustomerName(extras.customerName);
  const clientId = sanitizeClientId(extras.clientId);
  const civility = ["madame", "monsieur"].includes(extras.civility) ? extras.civility : "";
  if (customerName) params.set("customerName", customerName);
  if (clientId) params.set("clientId", clientId);
  if (civility) params.set("civility", civility);
  if (extras.printCard === "1") params.set("printCard", "1");
  const code = String(extras.code || "").replace(/\D/g, "").slice(0, 4);
  if (code.length === 4) params.set("code", code);
  const source = String(extras.source || "").trim().slice(0, 30);
  if (source) params.set("source", source);
  return `${String(baseUrl || PUBLIC_BASE_URL).replace(/\/$/, "")}/upload?${params.toString()}`;
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
    message: DEFAULT_SESSION_MESSAGE,
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
  qr.addData(uploadUrl(request.query.station, request.query.mode, request.query, requestBaseUrl(request)));
  qr.make();
  response.type("image/svg+xml").send(qr.createSvgTag({ cellSize: 8, margin: 4 }));
});

app.get("/qr.gif", (request, response) => {
  const qr = qrcode(0, "M");
  qr.addData(uploadUrl(request.query.station, request.query.mode, request.query, requestBaseUrl(request)));
  qr.make();
  const dataUrl = qr.createDataURL(8, 4);
  const base64 = dataUrl.replace(/^data:image\/gif;base64,/, "");
  response.type("image/gif").send(Buffer.from(base64, "base64"));
});

app.get("/api/mail/status", (request, response) => {
  const dependencyStatus = {};
  for (const dependency of ["imapflow", "mailparser", "nodemailer"]) {
    try {
      require.resolve(dependency);
      dependencyStatus[dependency] = true;
    } catch (error) {
      dependencyStatus[dependency] = false;
    }
  }
  response.json({
    ...mailRuntimeStatus,
    mailJobs: listActiveJobs()
      .filter((job) => job.source === "mail")
      .slice(0, 10)
      .map((job) => ({
        code: job.code,
        customerName: job.customerName,
        files: job.files.length,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
      })),
    hasPassword: Boolean(process.env.MAIL_PASSWORD),
    dependencies: dependencyStatus,
    imapHost: process.env.MAIL_IMAP_HOST || MAIL_IMAP_HOST,
    imapPort: Number(process.env.MAIL_IMAP_PORT) || MAIL_IMAP_PORT,
    smtpHost: process.env.MAIL_SMTP_HOST || MAIL_SMTP_HOST,
    smtpPort: Number(process.env.MAIL_SMTP_PORT) || MAIL_SMTP_PORT,
  });
});

app.get("/api/config", (request, response) => {
  const station = stationFrom(request.query.station);
  const baseUrl = requestBaseUrl(request);
  response.json({
    uploadUrl: uploadUrl(station, "", request.query, baseUrl),
    counterUploadUrl: uploadUrl(station, "admin", { source: "comptoir" }, baseUrl),
    qrUrl: `/qr.gif?station=${station}`,
    counterQrUrl: `/qr.gif?mode=admin&source=comptoir`,
    mailAddress: MAIL_ADDRESS,
    mailAddresses: { "poste-1": MAIL_ADDRESS, "poste-2": MAIL_ADDRESS },
    stationLinks: {
      "poste-1": `${baseUrl}/poste-1`,
      "poste-2": `${baseUrl}/poste-2`,
    },
  });
});

app.post("/api/clients/identify", (request, response) => {
  const customerName = sanitizeCustomerName(request.body.customerName);
  const civility = ["madame", "monsieur"].includes(request.body.civility) ? request.body.civility : "";
  const printCard = request.body.printCard === "1" || request.body.printCard === true;
  const requestedClientId = sanitizeClientId(request.body.clientId);

  if (!customerName) {
    response.status(400).json({ error: "Nom client obligatoire." });
    return;
  }

  const clients = readClients();
  const existing = findExistingClient(clients, { clientId: requestedClientId, customerName });
  const now = new Date().toISOString();

  if (existing) {
    existing.customerName = customerName;
    existing.civility = civility;
    existing.printCard = printCard;
    existing.updatedAt = now;
    writeClients(clients);
    response.json({ client: existing, isNew: false });
    return;
  }

  const client = {
    id: requestedClientId || generateClientId(clients),
    customerName,
    civility,
    printCard,
    createdAt: now,
    updatedAt: now,
  };
  clients.push(client);
  writeClients(clients);
  response.status(201).json({ client, isNew: true });
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
  const message = String(request.body.message || "").trim().slice(0, 180) || DEFAULT_SESSION_MESSAGE;
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

app.get("/api/dashboard", (request, response) => {
  response.json(completedPrintDashboard());
});

app.get("/api/jobs", (request, response) => {
  response.json({
    jobs: listTrackedJobs(),
  });
});

app.get("/api/help", (request, response) => {
  const requests = readHelpRequests();
  writeHelpRequests(requests);
  response.json({ requests: readHelpRequests() });
});

app.post("/api/help", (request, response) => {
  const station = stationFrom(request.body.station);
  const requests = readHelpRequests().filter((item) => item.station !== station);
  const helpRequest = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    station,
    stationLabel: stations[station],
    active: true,
    createdAt: new Date().toISOString(),
  };
  requests.unshift(helpRequest);
  writeHelpRequests(requests);
  response.status(201).json({ ok: true, request: helpRequest });
});

app.delete("/api/help/:station", (request, response) => {
  const station = stationFrom(request.params.station);
  writeHelpRequests(readHelpRequests().filter((item) => item.station !== station));
  response.json({ ok: true });
});

app.post("/api/jobs", upload.array("files", MAX_UPLOAD_FILES), async (request, response, next) => {
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
    const files = await storeUploadedFiles(request.files, directory);

    const job = {
      code,
      customerName: sanitizeCustomerName(request.body.customerName),
      clientId: sanitizeClientId(request.body.clientId),
      civility: ["madame", "monsieur"].includes(request.body.civility) ? request.body.civility : "",
      printCard: request.body.printCard === "1",
      source: String(request.body.source || "").trim().slice(0, 30),
      station: stationFrom(request.body.station),
      adminUpload,
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

app.post("/api/jobs/:code/files", upload.array("files", MAX_UPLOAD_FILES), async (request, response, next) => {
  try {
    const job = readJob(request.params.code);
    if (!job) {
      response.status(404).json({ error: "Session introuvable." });
      return;
    }
    if (!request.files?.length) {
      response.status(400).json({ error: "Ajoutez au moins un fichier." });
      return;
    }

    if (hasCounterOnlyFiles(request.files)) {
      cleanupTempUploads(request.files);
      response.status(400).json({ error: "Les fichiers Word, DOC et DOCX sont acceptes uniquement via le QR code comptoir." });
      return;
    }

    const files = await storeUploadedFiles(request.files, jobDir(job.code), job.files.length);
    job.files.push(...files);
    job.expiresAt = new Date(Date.now() + JOB_TTL_MS).toISOString();
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
    const customerName = sanitizeCustomerName(request.query.customerName);
    if (customerName) job.customerName = customerName;
    const clientId = sanitizeClientId(request.query.clientId);
    if (clientId) job.clientId = clientId;
    if (["madame", "monsieur"].includes(request.query.civility)) job.civility = request.query.civility;
    if (request.query.printCard === "1") job.printCard = true;
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

app.post("/api/stations/:station/commands", (request, response) => {
  const station = stationFrom(request.params.station);
  const type = String(request.body.type || "");
  if (!["open-webmail", "cleanup-browser", "shutdown-station", "restart-station"].includes(type)) {
    response.status(400).json({ error: "Commande non autorisee." });
    return;
  }

  const command = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    station,
    type,
    status: "queued",
    createdAt: new Date().toISOString(),
  };

  if (type === "open-webmail") {
    const url = String(request.body.url || "");
    if (!ALLOWED_WEBMAIL_URLS.has(url)) {
      response.status(400).json({ error: "Adresse mail non autorisee." });
      return;
    }
    command.url = url.slice(0, 300);
  }

  const commands = readCommands();
  commands.push(command);
  writeCommands(commands);
  response.status(201).json({ ok: true, command });
});

app.get("/api/stations/:station/commands/:commandId", (request, response) => {
  const station = stationFrom(request.params.station);
  const command = readCommands().find((item) => item.id === request.params.commandId && item.station === station);
  if (!command) {
    response.status(404).json({ error: "Commande introuvable." });
    return;
  }
  response.json({ command });
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

app.delete("/api/jobs/:code/files/:fileId", (request, response) => {
  const job = readJob(request.params.code);
  if (!job) {
    response.status(404).json({ error: "Code introuvable." });
    return;
  }

  const file = job.files.find((item) => item.id === request.params.fileId);
  if (!file) {
    response.status(404).json({ error: "Fichier introuvable." });
    return;
  }

  for (const name of [file.storedName, file.printableStoredName].filter(Boolean)) {
    fs.rmSync(path.join(jobDir(job.code), name), { force: true });
  }

  job.files = job.files.filter((item) => item.id !== file.id);
  job.printRequests = (job.printRequests || []).filter((requestItem) => requestItem.fileId !== file.id);
  job.expiresAt = new Date(Date.now() + JOB_TTL_MS).toISOString();
  writeJob(job);
  response.json(publicJob(job));
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
  if (error.code === "LIMIT_FILE_SIZE") {
    response.status(400).json({ error: `Fichier trop lourd. Limite : ${MAX_FILE_SIZE_MB} Mo par fichier.` });
    return;
  }
  if (error.code === "LIMIT_FILE_COUNT") {
    response.status(400).json({ error: `Trop de fichiers en une seule fois. Merci de faire un envoi plus léger ou de passer par une clé USB.` });
    return;
  }
  response.status(400).json({ error: error.message || "Operation impossible." });
});

cleanupExpiredJobs();
setInterval(cleanupExpiredJobs, 5 * 60 * 1000);
startMailWatcher();

app.listen(PORT, () => {
  console.log(`Bureau Vallee Espace Services pret sur le port ${PORT}`);
});

